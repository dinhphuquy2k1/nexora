#!/usr/bin/env python3
"""Execute the shipped psql registration file against test-owned PostgreSQL only."""
import concurrent.futures
import hashlib
import json
import subprocess
import sys
import time
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
NAME = 'nexora-registration-' + uuid.uuid4().hex
IMAGE = 'postgres:17.11-bookworm'
OWNED = False
STEP = 'start'


def command(args, data=None):
    return subprocess.run(args, input=data, text=True, capture_output=True, timeout=60)


def require(condition):
    if not condition:
        raise AssertionError(STEP)


def sql(statement):
    result = command(['docker', 'exec', '-i', NAME, 'psql', '-X', '-v',
                      'ON_ERROR_STOP=1', '-U', 'postgres', '-d', 'postgres',
                      '-At', '-q'], statement)
    require(result.returncode == 0)
    return result.stdout.strip()


def register(username, subject):
    # Arguments are an argv array, never interpolated into a shell or SQL body.
    return command(['docker', 'exec', NAME, 'psql', '-X', '-v',
                    'ON_ERROR_STOP=1', '-U', 'postgres', '-d', 'postgres',
                    '-v', 'username=' + username, '-v', 'uniship_userid=' + subject,
                    '-f', '/tmp/register-uniship-operator.sql'])


def snapshot():
    return sql("""SELECT json_build_array(
      (SELECT json_agg(t ORDER BY id) FROM users t),
      (SELECT json_agg(t ORDER BY id) FROM external_identities t),
      (SELECT json_agg(t ORDER BY user_id) FROM user_credentials t),
      (SELECT json_agg(t ORDER BY id) FROM sessions t));""")


def protected():
    return sql("""SELECT json_build_array(
      (SELECT json_agg(t ORDER BY id) FROM users t WHERE role='ADMIN'),
      (SELECT json_agg(t ORDER BY user_id) FROM user_credentials t),
      (SELECT json_agg(t ORDER BY id) FROM sessions t));""")


def success(username, subject):
    previous = json.loads(snapshot())
    before = int(sql('SELECT count(*) FROM users'))
    require(register(username, subject).returncode == 0)
    require(int(sql('SELECT count(*) FROM users')) == before + 1)
    rows = json.loads(sql("""SELECT coalesce(json_agg(t),'[]') FROM (
      SELECT u.username,u.role,u.status,e.provider,e.provider_subject,
      (SELECT count(*) FROM user_credentials c WHERE c.user_id=u.id) AS credentials
      FROM users u JOIN external_identities e ON e.user_id=u.id
      WHERE u.role='OPERATOR') t;"""))
    matches = [r for r in rows if r['username'] == username]
    require(matches == [dict(username=username, role='OPERATOR', status='ACTIVE',
                             provider='uniship', provider_subject=subject, credentials=0)])
    current = json.loads(snapshot())
    new_users = [r for r in current[0] if r['username'] == username]
    require(len(new_users) == 1)
    user_id = new_users[0]['id']
    new_identities = [r for r in (current[1] or []) if r['user_id'] == user_id]
    require(len(new_identities) == 1)
    current[0] = [r for r in current[0] if r['id'] != user_id] or None
    current[1] = [r for r in (current[1] or []) if r['user_id'] != user_id] or None
    require(current == previous)
    require(protected() == BASELINE)


def failure(username, subject):
    before = snapshot()
    require(register(username, subject).returncode != 0)
    require(snapshot() == before)
    require(protected() == BASELINE)


try:
    result = command(['docker', 'run', '-d', '--network', 'none', '--name', NAME,
                      '-e', 'POSTGRES_HOST_AUTH_METHOD=trust', IMAGE])
    require(result.returncode == 0)
    OWNED = True
    for attempt in range(100):
        if command(['docker', 'exec', NAME, 'pg_isready', '-U', 'postgres']).returncode == 0:
            break
        time.sleep(0.1)
    else:
        require(False)
    STEP = 'committed-schema'
    # Apply unmodified DDL, not fabricated Prisma history. Canonical quality also
    # runs the separate genuine Prisma migration/deploy/drift integration suite.
    for migration in sorted((ROOT / 'packages/database/prisma/migrations').glob('*/migration.sql')):
        sql(migration.read_text())
    source = ROOT / 'scripts/sql/register-uniship-operator.sql'
    require(command(['docker', 'cp', str(source), NAME + ':/tmp/register-uniship-operator.sql']).returncode == 0)
    copied = command(['docker', 'exec', NAME, 'cat', '/tmp/register-uniship-operator.sql'])
    require(copied.returncode == 0 and hashlib.sha256(copied.stdout.encode()).digest()
            == hashlib.sha256(source.read_bytes()).digest())
    sql("""INSERT INTO users(id,username,role,status,created_at,updated_at)
      VALUES('00000000-0000-0000-0000-000000000001','fixture_admin','ADMIN','ACTIVE',now(),now());
      INSERT INTO user_credentials(user_id,password_hash)
      VALUES('00000000-0000-0000-0000-000000000001','test-only-not-a-login-hash');
      INSERT INTO sessions(id,user_id,token_hash,expires_at)
      VALUES('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001',repeat('a',64),now()+interval '1 day');""")
    BASELINE = protected()
    STEP = 'success'
    success('operator_one', '10482')
    print('PASS actual-file success / ACTIVE OPERATOR / one identity / zero credentials', flush=True)
    STEP = 'duplicates'
    failure('operator_one', '10483')
    failure('operator_two', '10482')
    failure('fixture_admin', '10484')
    print('PASS duplicate username / subject / ADMIN collision rollback', flush=True)
    STEP = 'validation'
    for username in ['', ' ', 'ab', 'x' * 51, ' abc', 'abc ']:
        failure(username, '20001')
    for subject in ['', ' ', 'x' * 129, ' 20002', '20002 ']:
        failure('invalid_subject', subject)
    success('x' * 50, '9' * 128)
    success('abc', '1')
    print('PASS validation and accepted length boundaries', flush=True)
    STEP = 'literal-safety'
    # Canonical username and identity storage policies have no character allowlist.
    # The HTTP adapter separately validates positive decimal provider userid.
    success("O'Brien", '30001')
    success("literal'; DROP TABLE users; --", "subject'; DROP TABLE users; --")
    success('nhân_viên', '30002')
    print('PASS quotes / SQL-like input stored literally / Unicode; no new policy', flush=True)
    STEP = 'second-insert-rollback'
    sql("""CREATE FUNCTION test_identity_failure() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN IF NEW.provider_subject='forced_failure' THEN
        RAISE EXCEPTION 'test-owned second insert failure'; END IF; RETURN NEW; END $$;
      CREATE TRIGGER test_identity_failure BEFORE INSERT ON external_identities
      FOR EACH ROW EXECUTE FUNCTION test_identity_failure();""")
    failure('must_not_survive', 'forced_failure')
    sql('DROP TRIGGER test_identity_failure ON external_identities; DROP FUNCTION test_identity_failure();')
    print('PASS forced second INSERT failure leaves no orphan user', flush=True)
    STEP = 'concurrency'
    # A shared advisory lock inside a test-owned trigger holds both transactions
    # after preflight; releasing it guarantees a genuine unique-index race.
    sql("""CREATE FUNCTION test_registration_barrier() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN IF NEW.username IN ('race_one','race_two') THEN
        PERFORM pg_advisory_xact_lock_shared(711012); END IF; RETURN NEW; END $$;
      CREATE TRIGGER test_registration_barrier BEFORE INSERT ON users
      FOR EACH ROW EXECUTE FUNCTION test_registration_barrier();""")
    holder = subprocess.Popen(['docker', 'exec', '-i', NAME, 'psql', '-X', '-v',
                               'ON_ERROR_STOP=1', '-U', 'postgres', '-At', '-q'],
                              stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    try:
        holder.stdin.write('SELECT pg_advisory_lock(711012);\n')
        holder.stdin.flush()
        require(holder.stdout.readline() == '\n')
        before = int(sql('SELECT count(*) FROM users'))
        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
            futures = [pool.submit(register, name, '40001') for name in ['race_one', 'race_two']]
            try:
                for attempt in range(100):
                    if sql("SELECT count(*) FROM pg_locks WHERE locktype='advisory' AND objid=711012 AND NOT granted") == '2':
                        break
                    time.sleep(0.05)
                else:
                    require(False)
            finally:
                holder.stdin.write('SELECT pg_advisory_unlock(711012);\n\\q\n')
                holder.stdin.flush()
            results = [future.result() for future in futures]
        require(sorted(r.returncode == 0 for r in results) == [False, True])
        require(int(sql('SELECT count(*) FROM users')) == before + 1)
        require(sql("SELECT count(*) FROM external_identities WHERE provider_subject='40001'") == '1')
        require(sql("SELECT count(*) FROM users WHERE username IN ('race_one','race_two')") == '1')
    finally:
        holder.communicate(timeout=10)
    require(protected() == BASELINE)
    require(sql("SELECT count(*) FROM user_credentials c JOIN users u ON c.user_id=u.id WHERE u.role='OPERATOR'") == '0')
    print('PASS concurrent same subject: one winner / loser rollback / protected rows unchanged', flush=True)
except Exception:
    # Never print captured SQL, driver exceptions, input values or database dumps.
    print('FAIL SQL registration smoke at ' + STEP, file=sys.stderr)
    sys.exit(1)
finally:
    if OWNED:
        cleanup = command(['docker', 'rm', '-f', '-v', NAME])
        if cleanup.returncode != 0:
            print('FAIL test-owned container cleanup', file=sys.stderr)
            sys.exit(1)
