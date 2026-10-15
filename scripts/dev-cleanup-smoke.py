#!/usr/bin/env python3
"""Exercise optional cleanup with real psql in an owned, unpublished database."""
import subprocess
import sys
import time
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
NAME = 'nexora-cleanup-' + uuid.uuid4().hex
DB = 'nexora_test_' + uuid.uuid4().hex
OWNED = False
STEP = 'START'


def command(args, data=None):
    return subprocess.run(args, input=data, text=True, capture_output=True, timeout=120)


def require(value):
    if not value:
        raise AssertionError(STEP)


def sql(statement, database=DB):
    result = command(['docker', 'exec', '-i', NAME, 'psql', '-X', '-v',
                      'ON_ERROR_STOP=1', '-U', 'postgres', '-d', database,
                      '-At', '-q'], statement)
    require(result.returncode == 0)
    return result.stdout.strip()


def cleanup(**overrides):
    values = dict(deployment_env='development', expected_database=DB,
                  username_prefix='test_demo')
    values.update(overrides)
    args = ['docker', 'exec', NAME, 'psql', '-X', '-v', 'ON_ERROR_STOP=1',
            '-U', 'postgres', '-d', DB, '-f', '/tmp/cleanup.sql']
    for key, value in values.items():
        args.extend(['-v', key + '=' + value])
    return command(args)


try:
    require(command(['docker', 'run', '-d', '--network', 'none', '--name', NAME,
                     '-e', 'POSTGRES_HOST_AUTH_METHOD=trust', 'postgres:17.11-bookworm']).returncode == 0)
    OWNED = True
    for attempt in range(100):
        if command(['docker', 'exec', NAME, 'pg_isready', '-h', '127.0.0.1', '-U', 'postgres']).returncode == 0:
            break
        time.sleep(.2)
    else:
        raise AssertionError('READINESS')
    sql('CREATE DATABASE "' + DB + '"', 'postgres')
    STEP = 'DDL_AND_FIXTURES'
    # Raw committed DDL tests the maintenance file only. Genuine Prisma deploy
    # history, preservation and drift are separately tested by test:migrations.
    for migration in sorted((ROOT / 'packages/database/prisma/migrations').glob('*/migration.sql')):
        sql(migration.read_text())
    sql("""INSERT INTO users(id,username,role,updated_at) VALUES
      ('00000000-0000-4000-8000-000000000001','test_demo-admin','ADMIN',now()),
      ('00000000-0000-4000-8000-000000000002','test_demo-unconfigured','OPERATOR',now()),
      ('00000000-0000-4000-8000-000000000003','test_demo-configured','OPERATOR',now()),
      ('00000000-0000-4000-8000-000000000004','other-unconfigured','OPERATOR',now());
      INSERT INTO user_credentials(user_id,password_hash) VALUES
      ('00000000-0000-4000-8000-000000000003','fixture-not-used-for-login');""")
    require(command(['docker', 'cp', str(ROOT / 'scripts/sql/cleanup-dev-operators.sql'), NAME + ':/tmp/cleanup.sql']).returncode == 0)
    STEP = 'DRY_RUN_AND_GUARDS'
    require(cleanup().returncode == 0)
    require(sql('SELECT count(*) FROM users') == '4')
    for invalid in [dict(deployment_env='production'), dict(expected_database='wrong'),
                    dict(username_prefix=''), dict(dry_run='false'),
                    dict(dry_run='false', confirmation='wrong')]:
        require(cleanup(**invalid).returncode != 0)
        require(sql('SELECT count(*) FROM users') == '4')
    STEP = 'EXPLICIT_DELETE'
    require(cleanup(dry_run='false', confirmation='DELETE_TEST_OPERATORS').returncode == 0)
    require(sql('SELECT count(*) FROM users') == '3')
    require(sql("SELECT count(*) FROM users WHERE username='test_demo-unconfigured'") == '0')
    require(sql("SELECT count(*) FROM users WHERE role='ADMIN'") == '1')
    require(sql('SELECT count(*) FROM user_credentials') == '1')
    print('Actual psql cleanup dry-run, guards and protected-user preservation PASS')
except Exception:
    print('DEV_CLEANUP_TEST_FAILED step=' + STEP, file=sys.stderr)
    sys.exit(1)
finally:
    if OWNED:
        command(['docker', 'rm', '-fv', NAME])
