#!/usr/bin/env python3
"""Run PostgreSQL cluster integration regression tests on an owned disposable cluster."""
import json
import os
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

OWNED_CONTAINERS = []
OWNED_NETWORKS = []
STEP = "START"


def command(args, data=None):
    return subprocess.run(
        args, input=data, text=True, capture_output=True, timeout=120
    )


def cleanup_owned():
    global OWNED_CONTAINERS, OWNED_NETWORKS
    errors = []
    for cid in list(OWNED_CONTAINERS):
        command(["docker", "rm", "-fv", cid])
        check = command(["docker", "inspect", cid])
        if check.returncode == 0:
            errors.append(f"container {cid} still exists")
        else:
            if cid in OWNED_CONTAINERS:
                OWNED_CONTAINERS.remove(cid)

    for net in list(OWNED_NETWORKS):
        command(["docker", "network", "rm", net])
        check = command(["docker", "network", "inspect", net])
        if check.returncode == 0:
            errors.append(f"network {net} still exists")
        else:
            if net in OWNED_NETWORKS:
                OWNED_NETWORKS.remove(net)

    return errors


def sig_handler(signum, frame):
    cleanup_owned()
    sys.exit(128 + signum)


signal.signal(signal.SIGINT, sig_handler)
signal.signal(signal.SIGTERM, sig_handler)

original_error = None

try:
    suite_arg = None
    for arg in sys.argv[1:]:
        if arg.startswith("--suite="):
            suite_arg = arg.split("=", 1)[1]

    if suite_arg == "provision":
        suites = [
            ("provision", ["node", "packages/database/test/provision-cluster.mjs"])
        ]
    elif suite_arg == "customer-sql":
        suites = [
            (
                "customer-sql",
                ["node", "--test", "packages/database/test/customer-sql.mjs"],
            )
        ]
    elif suite_arg is None:
        suites = [
            (
                "provision",
                ["node", "packages/database/test/provision-cluster.mjs"],
            ),
            (
                "customer-sql",
                ["node", "--test", "packages/database/test/customer-sql.mjs"],
            ),
        ]
    else:
        raise ValueError(
            f"Unknown suite '{suite_arg}'. Valid choices: provision, customer-sql"
        )

    STEP = "CREATE_NETWORK"
    net_res = command(["docker", "network", "create", NET])
    if net_res.returncode != 0:
        raise RuntimeError(
            f"Failed to create disposable network: {net_res.stderr.strip()}"
        )
    OWNED_NETWORKS.append(NET)

    STEP = "SPAWN_DISPOSABLE_CLUSTER"
    res = command(
        [
            "docker",
            "run",
            "-d",
            "--name",
            NAME,
            "--network",
            NET,
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
        raise RuntimeError(
            f"Failed to start disposable postgres container: {res.stderr.strip()}"
        )
    cid = res.stdout.strip()
    OWNED_CONTAINERS.append(cid)

    STEP = "VERIFY_OWNERSHIP"
    inspect_res = command(["docker", "inspect", cid])
    if inspect_res.returncode != 0:
        raise RuntimeError(f"Failed to inspect spawned container: {cid}")
    data = json.loads(inspect_res.stdout)[0]
    if data.get("Id") != cid:
        raise RuntimeError("Container ID mismatch")
    if data.get("Name") != f"/{NAME}":
        raise RuntimeError("Container Name mismatch")
    if not data.get("State", {}).get("Running"):
        raise RuntimeError("Container is not running")
    if "postgres:17.11-bookworm" not in data.get("Config", {}).get("Image", ""):
        raise RuntimeError("Container image mismatch")
    if NET not in data.get("NetworkSettings", {}).get("Networks", {}):
        raise RuntimeError("Container network mismatch")

    STEP = "POLL_READINESS"
    for attempt in range(100):
        if (
            command(
                [
                    "docker",
                    "exec",
                    NAME,
                    "psql",
                    "-U",
                    "nexora",
                    "-d",
                    "nexora",
                    "-c",
                    "SELECT 1;",
                ]
            ).returncode
            == 0
        ):
            break
        time.sleep(0.2)
    else:
        raise AssertionError("READINESS_TIMEOUT")

    STEP = "STAMP_SIGNATURE"
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
        raise RuntimeError(
            f"Failed to plant cluster token signature: {stamp_res.stderr.strip()}"
        )

    STEP = "VERIFY_TOOLING_IMAGE"
    img_check = command(["docker", "image", "inspect", "nexora-dev:0.1.0"])
    if img_check.returncode != 0:
        build_res = command(
            [
                "docker",
                "build",
                "-f",
                "docker/Dockerfile.tools",
                "--target",
                "dev",
                "-t",
                "nexora-dev:0.1.0",
                ".",
            ]
        )
        if build_res.returncode != 0:
            raise RuntimeError(
                f"Failed to build tooling image nexora-dev:0.1.0: {build_res.stderr.strip()}"
            )

    admin_url = f"postgresql://nexora:{ADMIN_PASS}@{NAME}:5432/nexora"

    for suite_name, cmd in suites:
        STEP = f"EXECUTE_SUITE_{suite_name.upper()}"
        test_container_name = f"nexora-test-{RUN_ID}-{suite_name}"
        OWNED_CONTAINERS.append(test_container_name)

        t_mount = (
            str(ROOT / "packages/database/test")
            + ":/workspace/packages/database/test:ro"
        )
        s_mount = (
            str(ROOT / "packages/database/scripts")
            + ":/workspace/packages/database/scripts:ro"
        )
        p_mount = (
            str(ROOT / "packages/database/prisma")
            + ":/workspace/packages/database/prisma:ro"
        )

        run_cmd = [
            "docker",
            "run",
            "--name",
            test_container_name,
            "--network",
            NET,
            "-e",
            f"DISPOSABLE_CLUSTER_ADMIN_URL={admin_url}",
            "-e",
            f"DISPOSABLE_CLUSTER_TOKEN={TOKEN}",
            "-e",
            f"DISPOSABLE_CLUSTER_RUNTIME_PASSWORD={RUNTIME_PASS}",
            "-v",
            t_mount,
            "-v",
            s_mount,
            "-v",
            p_mount,
            "--entrypoint",
            cmd[0],
            "nexora-dev:0.1.0",
            *cmd[1:],
        ]

        test_proc = subprocess.run(
            run_cmd,
            text=True,
            capture_output=True,
            timeout=180,
        )

        command(["docker", "rm", "-fv", test_container_name])
        if test_container_name in OWNED_CONTAINERS:
            OWNED_CONTAINERS.remove(test_container_name)

        if test_proc.returncode != 0:
            if test_proc.stdout:
                print(test_proc.stdout.strip(), file=sys.stdout)
            if test_proc.stderr:
                print(test_proc.stderr.strip(), file=sys.stderr)
            raise RuntimeError(
                f"Test suite '{suite_name}' failed with code {test_proc.returncode}"
            )

        if test_proc.stdout:
            print(test_proc.stdout.strip())

    print(
        "Actual disposable cluster tests PASS (all requested suites verified in isolated container)"
    )

except Exception as err:
    original_error = err
    print(
        f"PROVISION_CLUSTER_SMOKE_FAILED step={STEP} err={err}", file=sys.stderr
    )
finally:
    cleanup_errors = cleanup_owned()
    if cleanup_errors:
        print(
            "CLEANUP_FAILED: " + "; ".join(cleanup_errors),
            file=sys.stderr,
        )
        if not original_error:
            sys.exit(1)
    if original_error:
        sys.exit(1)
