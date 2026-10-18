#!/usr/bin/env python3
"""Run the existing five Docker scripts in a clean, secret-free detached clone."""
import argparse
import hashlib
import ipaddress
import json
import os
from pathlib import Path
import platform
import re
import shutil
import signal
import socket
import subprocess
import tempfile
import time
from datetime import datetime, timezone
import urllib.error
import urllib.request
import uuid

ROOT = Path(__file__).resolve().parent.parent
SCRIPTS = ['quality-docker.sh', 'runtime-smoke.sh', 'public-https-smoke.sh',
           'data-smoke.sh', 'dev-smoke.sh']
# Only fixed facts/numeric summaries enter distributable evidence, never raw logs.
MARKERS = ['Runtime smoke PASS', 'Restart/down-up persistence checks PASS',
           'Dev frozen install/HMR/workspace/drift/data preservation PASS',
           'Workspace boundaries PASS', 'All matched files use Prettier code style!',
           'Documentation entry points, task governance, evidence, and relative links are valid.']


def now():
    return datetime.now(timezone.utc).isoformat()


def filtered(line):
    for marker in MARKERS:
        if marker in line:
            return marker
    harness = re.fullmatch(r'Ran (\d+) tests? in [0-9.]+s', line.strip())
    if harness:
        return 'HARNESS_UNIT_TESTS=' + harness[1]
    diagnostic = re.fullmatch(r'(Step|Category): ([A-Z][A-Z0-9_]{1,80})', line.strip())
    if diagnostic:
        return diagnostic[1].upper() + '=' + diagnostic[2]
    summary = re.search(r'(?:ℹ|#) (tests|pass|fail|skipped|cancelled) (\d+)\s*$', line)
    if summary:
        return 'TEST_SUMMARY ' + summary[1] + '=' + summary[2]
    for needle, category in [('binaries.prisma.sh', 'PRISMA_ENGINE_NETWORK'),
                             ('certificate verify failed', 'TLS_TRUST'),
                             ('address already in use', 'PORT_CONFLICT'),
                             ('ASSERTION_FAILED', 'ASSERTION_FAILED')]:
        if needle in line:
            return category
    return None


def clean_env():
    # Preserve transport/registry trust, not application secrets or Compose settings.
    keys = ['PATH', 'HOME', 'USER', 'TMPDIR', 'DOCKER_CONFIG', 'DOCKER_HOST', 'DOCKER_CONTEXT',
            'HTTP_PROXY', 'HTTPS_PROXY', 'NO_PROXY', 'http_proxy', 'https_proxy', 'no_proxy',
            'SSL_CERT_FILE', 'SSL_CERT_DIR', 'NODE_EXTRA_CA_CERTS', 'REQUESTS_CA_BUNDLE', 'CHROME_BIN']
    env = {k: os.environ[k] for k in keys if k in os.environ}
    env['PYTHONDONTWRITEBYTECODE'] = '1'
    return env


def text(args, cwd=ROOT, env=None):
    return subprocess.check_output(args, cwd=cwd, env=env, text=True, stderr=subprocess.DEVNULL, timeout=30).strip()


def run_step(args, cwd, env, log):
    """No tee pipeline; preserve the child's exit code and suppress raw diagnostics."""
    start = time.monotonic()
    with log.open('w') as output:
        proc = subprocess.Popen(args, cwd=cwd, env=env, stdout=subprocess.PIPE,
                                stderr=subprocess.STDOUT, start_new_session=True)
        try:
            while True:
                chunk = proc.stdout.readline(65536)
                if not chunk:
                    break
                safe = filtered(chunk.decode('utf8', errors='replace'))
                if safe:
                    output.write(safe + '\n')
            code = proc.wait()
        except BaseException:
            os.killpg(proc.pid, signal.SIGTERM)
            try:
                proc.wait(timeout=10)
            except subprocess.TimeoutExpired:
                os.killpg(proc.pid, signal.SIGKILL)
                proc.wait()
            raise
        finally:
            proc.stdout.close()
    return code, round(time.monotonic() - start, 3)


def docker_subnets(networks):
    return [ipaddress.ip_network(c['Subnet'], strict=False)
            for network in networks for c in (network.get('IPAM', {}).get('Config') or [])
            if c.get('Subnet')]


def preflight(source, env, facts):
    versions = [('node', ['node', '--version']), ('pnpm', ['pnpm', '--version']),
                ('docker', ['docker', 'version', '--format', '{{.Server.Version}}']),
                ('compose', ['docker', 'compose', 'version', '--short']),
                ('buildx', ['docker', 'buildx', 'version']), ('python', ['python3', '--version']),
                ('openssl', ['openssl', 'version']), ('tar', ['tar', '--version']),
                ('timeout', ['timeout', '--version'])]
    for name, args in versions:
        try:
            value = text(args, source, env)
        except (OSError, subprocess.SubprocessError):
            raise ValueError('TOOL_' + name.upper() + '_UNAVAILABLE') from None
        match = re.search(r'\d+\.\d+(?:\.\d+)?', value)
        if not match:
            raise ValueError('MISSING_TOOL_' + name.upper())
        facts[name] = match[0]
    if facts['node'] != (source / '.nvmrc').read_text().strip():
        raise ValueError('WRONG_NODE_VERSION')
    if facts['pnpm'] != json.loads((source / 'package.json').read_text())['packageManager'].split('@')[1]:
        raise ValueError('WRONG_PNPM_VERSION')
    if tuple(map(int, facts['compose'].split('.'))) < (2, 24, 4):
        raise ValueError('COMPOSE_OVERLAY_UNSUPPORTED')
    if platform.system() != 'Linux':
        raise ValueError('LINUX_OR_UBUNTU_WSL2_REQUIRED')
    endpoint = text(['docker', 'context', 'inspect', '--format', '{{.Endpoints.docker.Host}}'], source, env) if env.get('DOCKER_CONTEXT') else env.get('DOCKER_HOST') or text(['docker', 'context', 'inspect', '--format', '{{.Endpoints.docker.Host}}'], source, env)
    if not endpoint.startswith('unix://'):
        raise ValueError('LOCAL_DOCKER_SOCKET_REQUIRED')
    facts['docker_os'] = text(['docker', 'info', '--format', '{{.OSType}}'], source, env)
    facts['docker_architecture'] = text(['docker', 'info', '--format', '{{.Architecture}}'], source, env)
    if facts['docker_os'] != 'linux':
        raise ValueError('LINUX_DOCKER_ENGINE_REQUIRED')
    browser = env.get('CHROME_BIN') or next((shutil.which(x) for x in ['google-chrome', 'chromium', 'chromium-browser'] if shutil.which(x)), None)
    if not browser:
        raise ValueError('BROWSER_REQUIRED')
    facts['browser'] = re.search(r'\d+\.\d+\.\d+\.\d+', text([browser, '--version'], source, env))[0]
    for port in [3001, 5432]:
        with socket.socket() as listener:
            listener.bind(('127.0.0.1', port))
    reserved = [ipaddress.ip_network(x) for x in ['172.30.10.0/24', '172.30.11.0/24']]
    routes = json.loads(text(['ip', '-j', 'route'], source, env))
    networks = [ipaddress.ip_network(r['dst'], strict=False) for r in routes if r.get('dst') not in [None, 'default']]
    ids = text(['docker', 'network', 'ls', '-q'], source, env).split()
    if ids:
        networks.extend(docker_subnets(json.loads(text(['docker', 'network', 'inspect', *ids], source, env))))
    if any(a.version == b.version and a.overlaps(b) for a in reserved for b in networks):
        raise ValueError('PUBLIC_SUBNET_CONFLICT')
    text(['docker', 'compose', '-f', 'compose.yml', '-f', 'compose.dev.yml', 'config', '--quiet'], source, env)
    # Probe genuine pinned Docker-Linux engine checksum, never a mirror or TLS bypass.
    versions_in_lock = set(re.findall(r'@prisma/engines-version@[^\s\']*?([0-9a-f]{40})', (source / 'pnpm-lock.yaml').read_text()))
    if len(versions_in_lock) != 1:
        raise ValueError('PRISMA_ENGINE_VERSION_AMBIGUOUS')
    target = 'linux-arm64-openssl-3.0.x' if facts['docker_architecture'] in ['aarch64', 'arm64'] else 'debian-openssl-3.0.x'
    probes = [('REGISTRY', 'https://registry-1.docker.io/v2/'),
              ('PACKAGE_REGISTRY', 'https://registry.npmjs.org/pnpm/' + facts['pnpm']),
              ('PRISMA_CHECKSUM', 'https://binaries.prisma.sh/all_commits/' + next(iter(versions_in_lock)) + '/' + target + '/schema-engine.gz.sha256')]
    for name, url in probes:
        try:
            with urllib.request.urlopen(url, timeout=20) as response:
                if name == 'PRISMA_CHECKSUM' and not re.fullmatch(rb'[0-9a-f]{64}\s*', response.read(256)):
                    raise ValueError('INVALID_PRISMA_CHECKSUM_RESPONSE')
        except urllib.error.HTTPError as error:
            if name == 'REGISTRY' and error.code == 401:
                continue  # Reachable registry; actual authenticated pulls are still required.
            raise ValueError(name + '_HTTP_' + str(error.code)) from None
        except (urllib.error.URLError, TimeoutError):
            raise ValueError(name + '_NETWORK_BLOCKED') from None


def cleanup_owned(source, env, registry, records, output):
    failed = False
    # Claim markers are written only after rejecting all pre-existing resources.
    for marker in registry.iterdir():
        project = marker.name
        if marker.read_text().strip() != project or not re.fullmatch(r'nexora-(?:verify|smoke|data-smoke|dev-smoke|https)-[a-z0-9-]+', project):
            failed = True
            continue
        for kind, listing, deleting in [('containers', ['ps', '-aq'], ['rm', '-f']),
                                        ('volumes', ['volume', 'ls', '-q'], ['volume', 'rm']),
                                        ('networks', ['network', 'ls', '-q'], ['network', 'rm'])]:
            try:
                ids = text(['docker', *listing, '--filter', 'label=com.docker.compose.project=' + project], source, env).split()
                if ids:
                    rc, duration = run_step(['docker', *deleting, *ids], source, env, output / (project + '-' + kind + '.log'))
                    records.append({'step': 'owned_cleanup_' + kind, 'exit_code': rc, 'seconds': duration})
                    failed |= rc != 0
            except Exception:
                failed = True
    return failed


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--sha', required=True, help='exact commit to verify (must be HEAD)')
    parser.add_argument('--output', help='new absolute evidence directory outside this checkout')
    parser.add_argument('--preflight-only', action='store_true')
    args = parser.parse_args()
    os.umask(0o077)
    output = Path(args.output).resolve() if args.output else Path(tempfile.mkdtemp(prefix='nexora-verify-'))
    if args.output:
        if not Path(args.output).is_absolute() or output.is_relative_to(ROOT):
            parser.error('output must be a new absolute directory outside the source checkout')
        output.mkdir(mode=0o700)
    began = time.monotonic()
    def interrupt(_signum, _frame):
        raise KeyboardInterrupt()
    signal.signal(signal.SIGTERM, interrupt)
    evidence = {'mandatory': {name: 'NOT_RUN' for name in SCRIPTS}, 'started_utc': now(), 'timezone': 'UTC', 'os': platform.system(),
                'release': platform.release(), 'steps': [], 'tools': {}, 'result': 'BLOCKED'}
    source = output / 'checkout'
    registry = output / 'ownership'
    registry.mkdir(mode=0o700)
    env = clean_env()
    code = 2
    try:
        evidence['sha'] = text(['git', 'rev-parse', 'HEAD'])
        evidence['branch'] = text(['git', 'branch', '--show-current']) or 'DETACHED'
        if args.sha != evidence['sha'] or text(['git', 'status', '--porcelain', '--untracked-files=all']):
            raise ValueError('EXACT_HEAD_CLEAN_WORKTREE_REQUIRED')
        evidence['source_clean_before'] = True
        evidence['lockfile_sha256'] = hashlib.sha256((ROOT / 'pnpm-lock.yaml').read_bytes()).hexdigest()
        text(['git', 'clone', '--quiet', '--no-hardlinks', '--no-checkout', str(ROOT), str(source)], env=env)
        text(['git', 'checkout', '--quiet', '--detach', args.sha], source, env)
        evidence['actual_checkout_sha'] = text(['git', 'rev-parse', 'HEAD'], source, env)
        evidence['actual_checkout_branch'] = text(['git', 'branch', '--show-current'], source, env) or 'DETACHED'
        evidence['test_checkout_clean_before'] = not bool(text(['git', 'status', '--porcelain', '--untracked-files=all'], source, env))
        if evidence['actual_checkout_sha'] != args.sha or not evidence['test_checkout_clean_before']:
            raise ValueError('EXACT_CLEAN_TEST_CHECKOUT_REQUIRED')
        if (source / '.env').exists() or (source / '.env.public').exists():
            raise ValueError('TRACKED_RUNTIME_ENV_FORBIDDEN')
        env['NEXORA_VERIFICATION_RUN_ID'] = uuid.uuid4().hex
        env['COMPOSE_PROJECT_NAME'] = 'nexora-verify-' + env['NEXORA_VERIFICATION_RUN_ID']
        env['NEXORA_VERIFICATION_OWNERSHIP_DIR'] = str(registry)
        rc, duration = run_step(['python3', 'scripts/verify-local.test.py'], source, env, output / 'harness-selftest.log')
        evidence['steps'].append({'step': 'harness_selftest', 'exit_code': rc, 'seconds': duration})
        if rc:
            code = rc
            evidence['result'] = 'FAIL'
            raise ValueError('HARNESS_SELFTEST_FAILED')
        preflight(source, env, evidence['tools'])
        evidence['preflight'] = 'PASS'
        code = 0
        if args.preflight_only:
            evidence['result'] = 'PREFLIGHT_ONLY'
        else:
            for script in SCRIPTS:
                started = now()
                rc, duration = run_step(['sh', 'scripts/' + script], source, env, output / (script + '.log'))
                evidence['steps'].append({'step': script, 'command': 'sh scripts/' + script, 'started_utc': started, 'ended_utc': now(), 'seconds': duration, 'exit_code': rc})
                evidence['mandatory'][script] = 'PASS' if rc == 0 else 'FAIL'
                if rc:
                    code = rc
                    break
                if script == 'quality-docker.sh':
                    rc, duration = run_step(['docker', 'compose', '-f', 'compose.yml', '-f', 'compose.dev.yml', 'down'], source, env, output / 'stop-development.log')
                    evidence['steps'].append({'step': 'stop_development', 'exit_code': rc, 'seconds': duration})
                    if rc:
                        code = rc
                        break
            evidence['result'] = 'LOCAL_VERIFICATION_PASS' if code == 0 else 'FAIL'
    except KeyboardInterrupt:
        code = 130
        evidence['reason'] = 'INTERRUPTED'
    except Exception as error:
        if code == 0:
            code = 1
        # Never persist raw exceptions/subprocess stderr; they can contain secrets.
        reason = str(error) if isinstance(error, ValueError) else 'UNEXPECTED_' + type(error).__name__.upper()
        evidence['reason'] = reason if re.fullmatch(r'[A-Z_0-9]+', reason) else 'PREREQUISITE_OR_EXECUTION_BLOCKED'
    finally:
        if cleanup_owned(source, env, registry, evidence['steps'], output):
            if code == 0:
                code = 1
            evidence['result'] = 'FAIL'
            evidence['cleanup'] = 'FAIL'
        else:
            evidence['cleanup'] = 'PASS'
        try:
            evidence['source_head_after'] = text(['git', 'rev-parse', 'HEAD'])
            evidence['test_checkout_head_after'] = text(['git', 'rev-parse', 'HEAD'], source, env) if source.exists() else None
            evidence['source_clean_after'] = not bool(text(['git', 'status', '--porcelain', '--untracked-files=all']))
            evidence['test_checkout_clean_after'] = source.exists() and not bool(text(['git', 'status', '--porcelain', '--untracked-files=all'], source, env))
        except Exception:
            evidence['source_clean_after'] = False
            evidence['test_checkout_clean_after'] = False
        if code == 0 and not (evidence['source_clean_after'] and evidence['test_checkout_clean_after'] and evidence.get('source_head_after') == evidence.get('sha') and evidence.get('test_checkout_head_after') == evidence.get('sha')):
            code = 1
            evidence['result'] = 'FAIL'
        code = code if code >= 0 else 128 - code
        evidence['seconds'] = round(time.monotonic() - began, 3)
        evidence['ended_utc'] = now()
        evidence['exit_code'] = code
        (output / 'summary.json').write_text(json.dumps(evidence, indent=2) + '\n')
        logs = sorted(output.glob('*.log')) + [output / 'summary.json']
        (output / 'SHA256SUMS').write_text(''.join(hashlib.sha256(p.read_bytes()).hexdigest() + '  ' + p.name + '\n' for p in logs))
        print(json.dumps({'result': evidence['result'], 'exit_code': code, 'evidence': str(output)}))
    return code


if __name__ == '__main__':
    raise SystemExit(main())
