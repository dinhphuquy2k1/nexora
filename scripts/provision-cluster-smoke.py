#!/usr/bin/env python3
"""Run real PostgreSQL runtime provisioning concurrency and failure recovery on an owned disposable cluster."""
import os
import re
import signal
import subprocess
import sys
import time
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
NAME = "nexora-prov-" + uuid.uuid4().hex
TOKEN = "cluster-token-" + uuid.uuid4().hex
ADMIN_PASS = uuid.uuid4().hex + uuid.uuid4().hex
OWNED = False
STEP = "START"


def command(args, data=None):
    return subprocess.run(
        args, input=data, text=True, capture_output=True, timeout=120
    )


def cleanup_owned():
    global OWNED
    if OWNED:
        command(["docker", "rm", "-fv", NAME])
        OWNED = False


def sig_handler(signum, frame):
    cleanup_owned()
    sys.exit(128 + signum)


signal.signal(signal.SIGINT, sig_handler)
signal.signal(signal.SIGTERM, sig_handler)

try:
    STEP = "SPAWN_DISPOSABLE_CLUSTER"
    res = command(
        [
            "docker",
            "run",
            "-d",
            "--name",
            NAME,
            "-p",
            "127.0.0.1:0:5432",
            "-e",
            "POSTGRES_USER=nexora",
            "-e",
            "POSTGRES_DB=nexora",
            "-e",
            f"POSTGRES_PASSWORD={ADMIN_PASS}",
            "postgres:17.11-bookworm",
        ]
    )
    if res.returncode != 0:
        raise RuntimeError(f"Failed to start disposable postgres container: {res.stderr}")
    OWNED = True

    STEP = "POLL_READINESS"
    for attempt in range(100):
        if (
            command(
                [
                    "docker",
                    "exec",
                    NAME,
                    "pg_isready",
                    "-h",
                    "127.0.0.1",
                    "-U",
                    "nexora",
                    "-d",
                    "nexora",
                ]
            ).returncode
            == 0
        ):
            break
        time.sleep(0.2)
    else:
        raise AssertionError("READINESS_TIMEOUT")

    STEP = "RESOLVE_PORT_AND_SIGN"
    port_res = command(["docker", "port", NAME, "5432"])
    if port_res.returncode != 0 or not port_res.stdout.strip():
        raise RuntimeError(f"Failed to resolve container port: {port_res.stderr}")
    
    # Format of docker port output: e.g. "0.0.0.0:51234" or "127.0.0.1:51234"
    match = re.search(r":(\d+)$", port_res.stdout.strip().splitlines()[0])
    if not match:
        raise RuntimeError(f"Cannot parse port from docker port output: {port_res.stdout}")
    host_port = match.group(1)

    # Stamp cluster ownership token in pg_shdescription via database comment
    stamp_res = command(
        [
            "docker",
            "exec",
            NAME,
            "psql",
            "-X",
            "-v",
            "ON_ERROR_STOP=1",
            "-U",
            "nexora",
            "-d",
            "nexora",
            "-c",
            f"COMMENT ON DATABASE nexora IS '{TOKEN}';",
        ]
    )
    if stamp_res.returncode != 0:
        raise RuntimeError(f"Failed to plant cluster token signature: {stamp_res.stderr}")

    STEP = "EXECUTE_NODE_TEST"
    admin_url = f"postgresql://nexora:{ADMIN_PASS}@127.0.0.1:{host_port}/nexora"
    env = os.environ.copy()
    env["DISPOSABLE_CLUSTER_ADMIN_URL"] = admin_url
    env["DISPOSABLE_CLUSTER_TOKEN"] = TOKEN

    test_proc = subprocess.run(
        ["node", str(ROOT / "packages/database/test/provision-cluster.mjs")],
        env=env,
        text=True,
        capture_output=True,
        timeout=180,
    )
    if test_proc.returncode != 0:
        print(test_proc.stdout, file=sys.stdout)
        print(test_proc.stderr, file=sys.stderr)
        raise RuntimeError(f"provision-cluster.mjs exited with code {test_proc.returncode}")

    if test_proc.stdout:
        print(test_proc.stdout.strip())
    print("Actual disposable cluster provisioning regression PASS")

except Exception as err:
    print(f"PROVISION_CLUSTER_SMOKE_FAILED step={STEP} err={err}", file=sys.stderr)
    sys.exit(1)
finally:
    cleanup_owned()
