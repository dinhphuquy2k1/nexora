"""Verify actual container custody and actual PostgreSQL runtime authority."""
import json
import os
import subprocess
import sys

compose = ['docker', 'compose', '-f', 'compose.yml']
if '--development' in sys.argv:
    compose += ['-f', 'compose.dev.yml']
if os.environ.get('NEXORA_COMPOSE_OVERRIDE'):
    compose += ['-f', os.environ['NEXORA_COMPOSE_OVERRIDE']]


def run(args):
    result = subprocess.run(args, text=True, capture_output=True)
    if result.returncode:
        raise RuntimeError('Database isolation check failed; inspect authorized container diagnostics')
    return result.stdout


config = json.loads(run(compose + ['--profile', 'test', 'config', '--format', 'json']))
# Inspect resolved volume names, not merely textual target declarations.
admin = config['volumes']['credentials']['name']
runtime = config['volumes']['runtime_credentials']['name']
for service, expected in [('api', {runtime}), ('web', set()), ('migrate', {admin}), ('db-runtime', {admin, runtime})]:
    mounts = config['services'][service].get('volumes', [])
    secrets = {config['volumes'][m['source']]['name'] for m in mounts if m.get('source') in ('credentials', 'runtime_credentials')}
    assert secrets == expected, service + ' configured custody'
    assert all(m.get('read_only') for m in mounts if m.get('source') in ('credentials', 'runtime_credentials')), service
    container = run(compose + ['ps', '-aq', service]).strip()
    assert container, service + ' container missing'
    actual = json.loads(run(['docker', 'inspect', container]))[0]
    secret_mounts = [m for m in actual['Mounts'] if m.get('Name') in (admin, runtime)]
    assert {m['Name'] for m in secret_mounts} == expected, service + ' actual custody'
    assert all(not m['RW'] for m in secret_mounts), service + ' writable secret mount'

run(compose + ['exec', '-T', 'api', 'sh', '/scripts/api-entrypoint.sh' if '--development' not in sys.argv else '/workspace/scripts/api-entrypoint.sh', 'node', '-e', """
const assert=require('node:assert/strict'), fs=require('node:fs');
const databasePath=require.resolve('@nexora/database',{paths:[process.cwd()+'/apps/api',process.cwd()]});
const {createDatabase}=require(databasePath);
const {Client}=require('node:module').createRequire(databasePath)('pg');
const runtime=new Client({connectionString:process.env.DATABASE_URL});
assert.equal(fs.existsSync('/config/postgres_password'),false);
assert.match(new URL(process.env.DATABASE_URL).username,/^nexora_app$/);
const db=createDatabase(process.env.DATABASE_URL);
(async()=>{try {
 const [role]=await db.$queryRawUnsafe('SELECT current_user,session_user,rolsuper,rolcreatedb,rolcreaterole,rolreplication,rolbypassrls FROM pg_roles WHERE rolname=current_user');
 assert.deepEqual(role,{current_user:'nexora_app',session_user:'nexora_app',rolsuper:false,rolcreatedb:false,rolcreaterole:false,rolreplication:false,rolbypassrls:false});
 await runtime.connect();
 for(const sql of ['SET ROLE nexora','ALTER TABLE security_audit_events DISABLE TRIGGER security_audit_append_only','TRUNCATE security_audit_events','CREATE TEMP TABLE runtime_forbidden(id int)']) await assert.rejects(runtime.query(sql),e=>e.code==='42501');
} finally {await db.$disconnect();await runtime.end();}})().catch(()=>process.exit(1));
"""])
run(compose + ['run', '--rm', '--no-deps', '-T', 'migrate', 'node', '-e', """
const {Client}=require('pg');const db=new Client({connectionString:process.env.DATABASE_URL});
(async()=>{try{await db.connect();const r=await db.query('SELECT current_user,rolsuper FROM pg_roles WHERE rolname=current_user');if(r.rows[0].current_user!=='nexora'||!r.rows[0].rolsuper)throw Error();}finally{await db.end();}})().catch(()=>process.exit(1));
"""])
run(compose + ['run', '--rm', '--no-deps', '-T', 'db-runtime'])
print('Actual container credential custody, runtime denial, admin migration authority and repeat provisioning PASS')
