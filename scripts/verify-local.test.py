#!/usr/bin/env python3
"""Harness unit tests only: never evidence of Docker/Prisma/runtime success."""
import importlib.util
import contextlib
import io
import json
import subprocess
import os
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.dont_write_bytecode = True


def load(name):
    spec = importlib.util.spec_from_file_location(name, Path(__file__).with_name(name + '.py'))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


verify = load('verify-local')
projects = load('smoke-project')


class HarnessTests(unittest.TestCase):
    def test_docker_network_without_ipam_ranges(self):
        ranges = verify.docker_subnets([{'IPAM': {'Config': None}}, {'IPAM': {'Config': [{'Subnet': '172.18.0.0/16'}]}}])
        self.assertEqual([str(value) for value in ranges], ['172.18.0.0/16'])

    def test_failure_exit_and_secret_safe_log(self):
        with tempfile.TemporaryDirectory() as directory:
            log = Path(directory) / 'safe.log'
            code, duration = verify.run_step(
                [sys.executable, '-c', 'print("password=private session_token=secret"); print("# pass 2"); raise SystemExit(7)'],
                directory, verify.clean_env(), log)
            self.assertEqual(code, 7)
            self.assertGreaterEqual(duration, 0)
            self.assertEqual(log.read_text(), 'TEST_SUMMARY pass=2\n')

    def test_filter_never_keeps_arbitrary_payloads(self):
        for raw in ['DATABASE_URL=postgresql://user:secret@db', 'MFA secret: private',
                    'setup#token=secret', '-----BEGIN PRIVATE KEY-----', 'password correct PASS']:
            self.assertIsNone(verify.filtered(raw))
        self.assertEqual(verify.filtered('checksum failed binaries.prisma.sh secret'), 'PRISMA_ENGINE_NETWORK')

    def test_environment_is_transport_only(self):
        with patch.dict(os.environ, {'IDENTITY_KEYRING_JSON': 'secret', 'CARRIER_KEYRING_JSON': 'secret',
                                    'DATABASE_URL': 'secret', 'COMPOSE_FILE': 'production', 'WEB_PORT': '443'}):
            env = verify.clean_env()
            for name in ['IDENTITY_KEYRING_JSON', 'CARRIER_KEYRING_JSON', 'DATABASE_URL', 'COMPOSE_FILE', 'WEB_PORT']:
                self.assertNotIn(name, env)

    def test_reject_existing_or_invalid_project_without_claim(self):
        for project in ['nexora', 'production', '../foreign', 'nexora-smoke-123']:
            with self.assertRaises(ValueError):
                projects.claim(project, run=lambda *_args, **_kwargs: 'existing-resource')

    def test_check_all_resource_types_and_claim_once(self):
        with tempfile.TemporaryDirectory() as directory, patch.dict(os.environ, {'NEXORA_VERIFICATION_OWNERSHIP_DIR': directory}):
            calls = []
            def empty(args, **_kwargs):
                calls.append(args)
                return ''
            projects.claim('nexora-smoke-123', run=empty)
            self.assertTrue((Path(directory) / 'nexora-smoke-123').exists())
            self.assertEqual(len(calls), 5)
            with self.assertRaises(FileExistsError):
                projects.claim('nexora-smoke-123', run=empty)

    def test_unlabelled_name_collision_is_rejected(self):
        def docker(args, **_kwargs):
            return 'nexora-smoke-123_foreign\n' if '--format' in args else ''
        with self.assertRaises(ValueError):
            projects.claim('nexora-smoke-123', run=docker)

    def test_launch_exception_after_preflight_never_returns_success(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory) / 'source'
            root.mkdir()
            for command in [['init', '-q'], ['config', 'user.name', 'Harness fixture'], ['config', 'user.email', 'fixture@example.invalid']]:
                subprocess.run(['git', '-C', str(root), *command], check=True, capture_output=True)
            (root / 'fixture.txt').write_text('unit fixture only\n')
            (root / 'pnpm-lock.yaml').write_text('unit fixture only\n')
            subprocess.run(['git', '-C', str(root), 'add', '.'], check=True, capture_output=True)
            subprocess.run(['git', '-C', str(root), 'commit', '-qm', 'fixture'], check=True, capture_output=True)
            sha = subprocess.check_output(['git', '-C', str(root), 'rev-parse', 'HEAD'], text=True).strip()
            evidence = Path(directory) / 'evidence'
            # Real clean Git clone, simulated missing executable after preflight;
            # this never runs or impersonates a database/runtime verification.
            original_text = verify.text
            def fixture_text(args, cwd=None, env=None):
                return original_text(args, root if cwd is None else cwd, env)
            with patch.object(verify, 'ROOT', root), patch.object(verify, 'text', fixture_text), \
                 patch.object(verify, 'preflight'), patch.object(verify.signal, 'signal'), \
                 patch.object(verify, 'run_step', side_effect=[(0, 0.01), FileNotFoundError()]), \
                 patch.object(sys, 'argv', ['verify-local', '--sha', sha, '--output', str(evidence)]), \
                 contextlib.redirect_stdout(io.StringIO()):
                self.assertNotEqual(verify.main(), 0)
            self.assertNotEqual(json.loads((evidence / 'summary.json').read_text())['exit_code'], 0)

    def test_cleanup_only_exact_owned_labels_and_retains_failure(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            registry = root / 'owned'
            registry.mkdir()
            (registry / 'nexora-smoke-123').write_text('nexora-smoke-123\n')
            queries, commands, records = [], [], []
            def lookup(args, *_args, **_kwargs):
                queries.append(args)
                return 'owned-id'
            def remove(args, *_args, **_kwargs):
                commands.append(args)
                return 9, 0.01
            with patch.object(verify, 'text', lookup), patch.object(verify, 'run_step', remove):
                self.assertTrue(verify.cleanup_owned(root, {}, registry, records, root))
            self.assertTrue(all(q[-1] == 'label=com.docker.compose.project=nexora-smoke-123' for q in queries))
            self.assertTrue(all(c[-1] == 'owned-id' for c in commands))
            self.assertTrue(all(r['exit_code'] == 9 for r in records))


if __name__ == '__main__':
    unittest.main()
