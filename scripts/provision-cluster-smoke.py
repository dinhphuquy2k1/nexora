#!/usr/bin/env python3
"""Run PostgreSQL cluster integration regression tests on an owned disposable cluster."""
import json
import re
import signal
import subprocess
import sys
import time
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RUN_ID = uuid.uuid4().hex[:12]
NAME = f"nexora-prov-{RUN_ID}"
NET = f"nexora-net-{RUN_ID}"
TOKEN = f"cluster-token-{uuid.uuid4().hex}"
ADMIN_PASS = f"adm-{uuid.uuid4().hex}{uuid.uuid4().hex}"
RUNTIME_PASS = f"{uuid.uuid4().hex}{uuid.uuid4().hex}"
TCP_TIMEOUT = 30
POLL_INTERVAL = 0.2
OWNED_CONTAINERS = []
OWNED_NETWORKS = []
PENDING_CREATIONS = []
STEP = "START"
INTERRUPTED = None


def safe(value):
    text = str(value)
    for secret in (ADMIN_PASS, RUNTIME_PASS, TOKEN):
        text = text.replace(secret, "[REDACTED]")
    return re.sub(r"postgres(?:ql)?://[^\s'\"]+", "[REDACTED_URL]", text)


def command(args, data=None, timeout=120):
    # Signals only request interruption. Let in-flight creation finish so its ID
    # can be tracked before the single finally cleanup path runs.
    try:
        return subprocess.run(args, input=data, text=True, capture_output=True, timeout=timeout)
    except subprocess.TimeoutExpired:
        raise RuntimeError("DOCKER_COMMAND_TIMEOUT") from None
    except OSError:
        raise RuntimeError("DOCKER_COMMAND_UNAVAILABLE") from None
    except UnicodeError:
        raise RuntimeError("DOCKER_RESPONSE_UNREADABLE") from None


def sig_handler(signum, frame):
    global INTERRUPTED
    if INTERRUPTED is None:
        INTERRUPTED = signum


def check_interrupted():
    if INTERRUPTED is not None:
        raise RuntimeError(f"INTERRUPTED signal={INTERRUPTED}")


def inspect_resource(kind, identity, timeout=5):
    args = ["docker", "inspect", "--type", "container", identity]
    if kind == "network":
        args = ["docker", "network", "inspect", identity]
    result = command(args, timeout=timeout)
    if result.returncode == 0:
        try:
            data = json.loads(result.stdout)
            if isinstance(data, list) and len(data) == 1 and isinstance(data[0], dict) and data[0].get("Id") == identity:
                return data[0]
        except (ValueError, TypeError, AttributeError):
            pass
        raise RuntimeError("INSPECT_UNVERIFIABLE")
    # A daemon/API/permission error is never absence. Only a precise missing
    # resource diagnostic for this exact ID confirms the deletion.
    missing = f"No such object: {identity}"
    network_missing = f"network {identity} not found"
    diagnostic = result.stderr.strip()
    if result.returncode == 1 and diagnostic in (
        missing, "Error: " + missing, "Error response from daemon: " + missing,
        network_missing, "Error response from daemon: " + network_missing,
        "Error response from daemon: No such container: " + identity,
        "Error: No such container: " + identity,
    ):
        return None
    raise RuntimeError("INSPECT_UNVERIFIABLE")


def remove_owned(kind, identity):
    tracked = OWNED_CONTAINERS if kind == "container" else OWNED_NETWORKS
    try:
        args = ["docker", "rm", "-fv", identity]
        if kind == "network":
            args = ["docker", "network", "rm", identity]
        result = command(args, timeout=10)
        state = inspect_resource(kind, identity)
        if state is not None:
            return f"{kind} {identity} still exists; remove_exit={result.returncode}"
        tracked.remove(identity)
        return None
    except (RuntimeError, ValueError) as error:
        return f"{kind} {identity} unable-to-verify {error}"


def cleanup_owned():
    errors = []
    for kind, name in list(PENDING_CREATIONS):
        error = recover_creation(kind, name)
        if error:
            errors.append(error)
    for kind, resources in [("container", OWNED_CONTAINERS), ("network", OWNED_NETWORKS)]:
        for identity in list(resources):
            error = remove_owned(kind, identity)
            if error:
                errors.append(error)
    return errors


def recover_creation(kind, name):
    # A timed-out create may have reached the daemon. Resolve its UUID name only
    # with the per-run label before promoting it to an owned exact ID.
    try:
        args = ["docker", "inspect", name] if kind == "container" else ["docker", "network", "inspect", name]
        found = command(args, timeout=5)
        if found.returncode != 0:
            missing = "No such object: " + name
            if found.returncode == 1 and found.stderr.strip() in (
                missing, "Error: " + missing, "Error response from daemon: " + missing,
                "Error response from daemon: network " + name + " not found",
            ):
                PENDING_CREATIONS.remove((kind, name))
                return None
            return f"{kind} {name} creation unable-to-verify"
        data = json.loads(found.stdout)[0]
        labels = data.get("Config", {}).get("Labels", {}) if kind == "container" else data.get("Labels", {})
        identity = data.get("Id", "")
        if labels.get("nexora.cluster-test") != RUN_ID or not re.fullmatch(r"[a-f0-9]{64}", identity):
            return f"{kind} {name} creation ownership unverified"
        tracked = OWNED_CONTAINERS if kind == "container" else OWNED_NETWORKS
        tracked.append(identity)
        PENDING_CREATIONS.remove((kind, name))
        return None
    except (RuntimeError, ValueError, TypeError, IndexError, KeyError, AttributeError):
        return f"{kind} {name} creation unable-to-verify"


def create_owned(args, kind, name):
    tracked = OWNED_CONTAINERS if kind == "container" else OWNED_NETWORKS
    PENDING_CREATIONS.append((kind, name))
    try:
        result = command(args)
    except RuntimeError:
        recover_creation(kind, name)
        raise
    identity = result.stdout.strip()
    if not re.fullmatch(r"[a-f0-9]{64}", identity):
        recover_creation(kind, name)
        raise RuntimeError("CREATE_FAILED ownership recovery attempted")
    tracked.append(identity)
    PENDING_CREATIONS.remove((kind, name))
    if result.returncode != 0:
        raise RuntimeError("CREATE_FAILED")
    check_interrupted()
    return identity


def psql(cid, sql, timeout=5):
    return command([
        "docker", "exec", "-i", cid, "sh", "-c",
        'PGPASSWORD="$POSTGRES_PASSWORD" exec psql -X -h "$1" -p 5432 -v ON_ERROR_STOP=1 -U nexora -d nexora -Atq', 'sh', NAME,
    ], data=sql, timeout=timeout)


def wait_tcp(cid):
    deadline = time.monotonic() + TCP_TIMEOUT
    while time.monotonic() < deadline:
        check_interrupted()
        try:
            data = inspect_resource("container", cid, timeout=min(5, max(0.01, deadline - time.monotonic())))
        except RuntimeError as error:
            if str(error) == "DOCKER_COMMAND_TIMEOUT":
                raise RuntimeError("TCP_READINESS_TIMEOUT") from None
            raise
        if data is None or not data.get("State", {}).get("Running"):
            raise RuntimeError("POSTGRES_STARTUP_FAILED")
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            break
        try:
            result = psql(cid, "SELECT 1;", timeout=min(5, remaining))
        except RuntimeError as error:
            if str(error) == "DOCKER_COMMAND_TIMEOUT":
                raise RuntimeError("TCP_READINESS_TIMEOUT") from None
            raise
        if result.returncode == 0 and result.stdout.strip() == "1":
            check_interrupted()
            return
        time.sleep(min(POLL_INTERVAL, max(0, deadline - time.monotonic())))
    raise RuntimeError("TCP_READINESS_TIMEOUT")


def suite_failure(suite, result, container_exit=None):
    # Driver/assertion dumps can contain SQL. Keep original exit/category without
    # publishing query text, connection URLs or assertion payloads.
    output = result.stdout + result.stderr
    categories = [code for code in (
        "ERR_ASSERTION", "AssertionError", "MODULE_NOT_FOUND",
        "DISPOSABLE_CLUSTER_REQUIRED", "CLUSTER_OWNERSHIP_UNVERIFIED",
        "NETWORK_TCP_QUERY_FAILED", "ECONNREFUSED", "ECONNRESET", "ETIMEDOUT",
    ) if code in output]
    states = re.findall(r"code:\s*['\"]([0-9A-Z]{5})['\"]", output)
    return RuntimeError(f"SUITE_FAILED suite={suite} attach_exit={result.returncode} container_exit={container_exit} categories={categories} sqlstates={states}")


def attach_suite(identity):
    # The container already has a tracked ID. Interrupt only its attach client;
    # finally removes the owned container, even if the suite is still running.
    proc = subprocess.Popen(["docker", "start", "-a", identity], text=True,
                            stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    deadline = time.monotonic() + 180
    try:
        while True:
            check_interrupted()
            if time.monotonic() >= deadline:
                raise RuntimeError("SUITE_TIMEOUT")
            try:
                stdout, stderr = proc.communicate(timeout=0.2)
                return subprocess.CompletedProcess(proc.args, proc.returncode, stdout, stderr)
            except subprocess.TimeoutExpired:
                pass
    finally:
        if proc.poll() is None:
            proc.kill()
        proc.communicate()


def run_suites(suite_arg):
    suites = {
        "provision": ["node", "packages/database/test/provision-cluster.mjs"],
        "customer-sql": ["node", "--test", "packages/database/test/customer-sql.mjs"],
    }
    if suite_arg is not None and suite_arg not in suites:
        raise RuntimeError("INVALID_SUITE")
    selected = [suite_arg] if suite_arg else list(suites)
    global STEP
    STEP = "CREATE_NETWORK"
    create_owned(["docker", "network", "create", "--label", f"nexora.cluster-test={RUN_ID}", NET], "network", NET)
    STEP = "CREATE_POSTGRES"
    cid = create_owned([
        "docker", "create", "--name", NAME, "--label", f"nexora.cluster-test={RUN_ID}", "--network", NET,
        "-e", "POSTGRES_USER=nexora", "-e", "POSTGRES_DB=nexora", "-e", f"POSTGRES_PASSWORD={ADMIN_PASS}",
        "postgres:17.11-bookworm",
    ], "container", NAME)
    STEP = "START_POSTGRES"
    if command(["docker", "start", cid]).returncode != 0:
        raise RuntimeError("POSTGRES_STARTUP_FAILED")
    STEP = "VERIFY_OWNERSHIP"
    data = inspect_resource("container", cid)
    if not data or data.get("Name") != f"/{NAME}" or data.get("Config", {}).get("Image") != "postgres:17.11-bookworm" or NET not in data.get("NetworkSettings", {}).get("Networks", {}):
        raise RuntimeError("CLUSTER_OWNERSHIP_UNVERIFIED")
    STEP = "POLL_TCP_READINESS"
    wait_tcp(cid)
    STEP = "STAMP_SIGNATURE"
    if psql(cid, f"COMMENT ON DATABASE nexora IS '{TOKEN}';").returncode != 0:
        raise RuntimeError("STAMP_FAILED")
    STEP = "VERIFY_TOOLING_IMAGE"
    check_interrupted()
    if command(["docker", "image", "inspect", "nexora-dev:0.1.0"]).returncode != 0:
        if command(["docker", "build", "-f", "docker/Dockerfile.tools", "--target", "dev", "-t", "nexora-dev:0.1.0", "."]).returncode != 0:
            raise RuntimeError("TOOLING_BUILD_FAILED")
    admin_url = f"postgresql://nexora:{ADMIN_PASS}@{NAME}:5432/nexora"
    # Same tooling container/network/credentials as the suite: verify real TCP SQL
    # before any suite DDL. No polling container or host Node dependency.
    network_probe = '''const {Client}=require("/workspace/packages/database/node_modules/pg");
(async()=>{const c=new Client({connectionString:process.env.DISPOSABLE_CLUSTER_ADMIN_URL});
try {await c.connect();const r=await c.query("SELECT 1 AS ready");
if(r.rows[0]?.ready!==1)throw Error();}
catch {console.error("NETWORK_TCP_QUERY_FAILED");process.exitCode=1;}
finally {await c.end().catch(()=>{});}})();'''
    for suite in selected:
        check_interrupted()
        STEP = f"EXECUTE_SUITE_{suite.upper()}"
        name = f"nexora-test-{RUN_ID}-{suite}"
        args = ["docker", "create", "--name", name, "--label", f"nexora.cluster-test={RUN_ID}", "--network", NET,
                "-e", f"DISPOSABLE_CLUSTER_ADMIN_URL={admin_url}", "-e", f"DISPOSABLE_CLUSTER_TOKEN={TOKEN}", "-e", f"DISPOSABLE_CLUSTER_RUNTIME_PASSWORD={RUNTIME_PASS}"]
        for directory in ("test", "scripts", "prisma"):
            args += ["-v", f"{ROOT / 'packages/database' / directory}:/workspace/packages/database/{directory}:ro"]
        args += ["--entrypoint", "sh", "nexora-dev:0.1.0", "-c", 'node -e "$1" && shift && exec "$@"', "sh", network_probe, *suites[suite]]
        test_id = create_owned(args, "container", name)
        result = attach_suite(test_id)
        # Preserve an attach/suite failure even if later inspection/removal fails.
        if result.returncode != 0:
            raise suite_failure(suite, result)
        state = inspect_resource("container", test_id)
        suite_exit = state.get("State", {}).get("ExitCode") if state else None
        if not isinstance(suite_exit, int):
            raise RuntimeError("SUITE_EXIT_UNVERIFIABLE")
        if suite_exit != 0:
            raise suite_failure(suite, result, suite_exit)
        if result.stdout:
            print(safe(result.stdout.strip()))
        check_interrupted()
        error = remove_owned("container", test_id)
        if error:
            raise RuntimeError("CLEANUP_FAILED: " + error)


def main():
    global STEP
    signal.signal(signal.SIGINT, sig_handler)
    signal.signal(signal.SIGTERM, sig_handler)
    original_error = None
    try:
        args = sys.argv[1:]
        if len(args) > 1 or (args and not args[0].startswith("--suite=")):
            raise RuntimeError("INVALID_SUITE")
        run_suites(args[0].split("=", 1)[1] if args else None)
        check_interrupted()
    except Exception as error:
        original_error = error
        print(safe(f"PROVISION_CLUSTER_SMOKE_FAILED step={STEP} err={error}"), file=sys.stderr)
    finally:
        errors = cleanup_owned()
        if errors:
            print(safe("CLEANUP_FAILED: " + "; ".join(errors)), file=sys.stderr)
    if INTERRUPTED is not None:
        return 128 + INTERRUPTED
    if original_error is not None or errors:
        return 1
    print("Actual disposable cluster tests PASS (all requested suites and cleanup verified)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
