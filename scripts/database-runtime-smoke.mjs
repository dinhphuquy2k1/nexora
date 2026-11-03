import assert from "node:assert/strict";
import { dockerCommand } from "./docker-command.mjs";
const development = process.argv.includes("--development");
const compose = ["compose", "-f", "compose.yml"];
if (development) compose.push("-f", "compose.dev.yml");
if (process.env.NEXORA_COMPOSE_OVERRIDE)
  compose.push("-f", process.env.NEXORA_COMPOSE_OVERRIDE);
async function run(args) {
  const r = await dockerCommand(args);
  if (r.code !== 0)
    throw Error(
      "Database isolation check failed; inspect authorized container diagnostics",
    );
  return r.stdout;
}
let step = "CONFIG_CUSTODY";
try {
  const config = JSON.parse(
    await run([...compose, "--profile", "test", "config", "--format", "json"]),
  );
  const admin = config.volumes.credentials.name,
    runtime = config.volumes.runtime_credentials.name,
    sync = config.volumes.sync_credentials.name;
  for (const [service, expected] of [
    ["api", [runtime]],
    ["web", []],
    ["sync-worker", [sync]],
    ["migrate", [admin]],
    ["db-runtime", [admin, runtime, sync]],
  ]) {
    const mounts = config.services[service].volumes || [];
    const secrets = mounts.filter((m) =>
      ["credentials", "runtime_credentials", "sync_credentials"].includes(
        m.source,
      ),
    );
    assert.deepEqual(
      secrets.map((m) => config.volumes[m.source].name).sort(),
      expected.sort(),
      service + " configured custody",
    );
    assert.ok(
      secrets.every((m) => m.read_only),
      service,
    );
    const container = (await run([...compose, "ps", "-aq", service])).trim();
    assert.ok(container, service + " container missing");
    const actual = JSON.parse(await run(["inspect", container]))[0];
    const actualSecrets = actual.Mounts.filter((m) =>
      [admin, runtime, sync].includes(m.Name),
    );
    assert.deepEqual(
      actualSecrets.map((m) => m.Name).sort(),
      expected.sort(),
      service + " actual custody",
    );
    assert.ok(
      actualSecrets.every((m) => !m.RW),
      service + " writable secret mount",
    );
  }
  step = "API_RUNTIME_AUTHORITY";
  const entrypoint = development
    ? "/workspace/scripts/api-entrypoint.sh"
    : "/scripts/api-entrypoint.sh";
  await run([
    ...compose,
    "exec",
    "-T",
    "api",
    "sh",
    entrypoint,
    "node",
    "-e",
    "\nconst assert=require('node:assert/strict'), fs=require('node:fs');\nconst databasePath=require.resolve('@nexora/database',{paths:[process.cwd()+'/apps/api',process.cwd()]});\nconst {createDatabase}=require(databasePath);\nconst {Client}=require('node:module').createRequire(databasePath)('pg');\nconst runtime=new Client({connectionString:process.env.DATABASE_URL});\nassert.equal(fs.existsSync('/config/postgres_password'),false);\nassert.match(new URL(process.env.DATABASE_URL).username,/^nexora_app$/);\nconst db=createDatabase(process.env.DATABASE_URL);\n(async()=>{try {\n const [role]=await db.$queryRawUnsafe('SELECT current_user,session_user,rolsuper,rolcreatedb,rolcreaterole,rolreplication,rolbypassrls FROM pg_roles WHERE rolname=current_user');\n assert.deepEqual(role,{current_user:'nexora_app',session_user:'nexora_app',rolsuper:false,rolcreatedb:false,rolcreaterole:false,rolreplication:false,rolbypassrls:false});\n await runtime.connect();\n for(const sql of ['SET ROLE nexora','ALTER TABLE security_audit_events DISABLE TRIGGER security_audit_append_only','TRUNCATE security_audit_events','CREATE TEMP TABLE runtime_forbidden(id int)','DELETE FROM customers',\"SELECT setval('customer_code_seq',1)\"]) await assert.rejects(runtime.query(sql),e=>e.code==='42501');\n} finally {await db.$disconnect();await runtime.end();}})().catch(()=>process.exit(1));\n",
  ]);
  step = "MIGRATION_AUTHORITY";
  await run([
    ...compose,
    "run",
    "--rm",
    "--no-deps",
    "-T",
    "migrate",
    "node",
    "-e",
    "\nconst {Client}=require('pg');const db=new Client({connectionString:process.env.DATABASE_URL});\n(async()=>{try{await db.connect();const r=await db.query('SELECT current_user,rolsuper FROM pg_roles WHERE rolname=current_user');if(r.rows[0].current_user!=='nexora'||!r.rows[0].rolsuper)throw Error();}finally{await db.end();}})().catch(()=>process.exit(1));\n",
  ]);
  step = "REPEAT_ROLE_PROVISION";
  await run([...compose, "run", "--rm", "--no-deps", "-T", "db-runtime"]);
  step = "WORKER_RUNTIME_AUTHORITY";
  const workerContainer = (
    await run([...compose, "ps", "-q", "sync-worker"])
  ).trim();
  const workerState = JSON.parse(await run(["inspect", workerContainer]))[0];
  assert.ok(
    Object.values(workerState.NetworkSettings.Ports ?? {}).every(
      (v) => v === null,
    ),
    "worker published port",
  );
  assert.ok(
    !(workerState.Config.Env ?? []).some((v) =>
      /^(IDENTITY_KEYRING_JSON|CARRIER_KEYRING_JSON)=/.test(v),
    ),
    "unexpected worker crypto custody",
  );
  const workerEntry = development
    ? "/workspace/scripts/sync-worker-entrypoint.sh"
    : "/scripts/sync-worker-entrypoint.sh";
  const workerProbe = `const assert=require('node:assert/strict'),fs=require('node:fs');assert.equal(fs.existsSync('/config/postgres_password'),false);assert.equal(fs.existsSync('/runtime-config/postgres_app_password'),false);const uid=fs.readFileSync('/proc/1/status','utf8').split(String.fromCharCode(10)).find(l=>l.startsWith('Uid:')).slice(4).trim().split(String.fromCharCode(9))[0];assert.ok(Number(uid)>0);assert.equal(new URL(process.env.DATABASE_URL).username,'nexora_sync');const databasePath=require.resolve('@nexora/database',{paths:[process.cwd()+'/apps/api',process.cwd()]});const {Client}=require('node:module').createRequire(databasePath)('pg');const db=new Client({connectionString:process.env.DATABASE_URL});(async()=>{try{await db.connect();assert.equal((await db.query('SELECT current_user AS actor')).rows[0].actor,'nexora_sync');await db.query('BEGIN');await db.query('SELECT status FROM public.sync_lock_user($1)',[require('node:crypto').randomUUID()]);await db.query('ROLLBACK');for(const sql of ['SELECT * FROM sessions','SELECT * FROM user_credentials','SELECT * FROM carrier_connection_secrets','UPDATE users SET status=status','UPDATE users SET updated_at=clock_timestamp()','UPDATE carrier_connections SET updated_at=clock_timestamp()','UPDATE customers SET updated_at=clock_timestamp()','UPDATE carrier_user_states SET generation=generation+1','SET ROLE nexora'])await assert.rejects(db.query(sql),e=>e.code==='42501');}finally{await db.end();}})().catch(()=>process.exit(1));`;
  await run([
    ...compose,
    "exec",
    "-T",
    "sync-worker",
    "sh",
    workerEntry,
    "node",
    "-e",
    workerProbe,
  ]);
  // These services belong to this smoke project. Restore both on every failure.
  step = "WORKER_WITH_API_STOPPED";
  try {
    await run([...compose, "stop", "api"]);
    await run([
      ...compose,
      "exec",
      "-T",
      "sync-worker",
      "node",
      "-e",
      `const fs=require('node:fs');const file='/tmp/nexora-sync-heartbeat';const read=()=>{try{return Number(fs.readFileSync(file,'utf8'));}catch{return null;}};(async()=>{let first=read();for(let i=0;i<100;i++){await new Promise(r=>setTimeout(r,100));const next=read();if(Number.isFinite(first)&&Number.isFinite(next)&&next>first)return;if(Number.isFinite(next))first??=next;}process.exitCode=1;})();`,
    ]);
  } finally {
    await run([...compose, "start", "api"]);
  }
  step = "API_RESTORED_READY";
  const readyProbe = `(async()=>{for(let i=0;i<40;i++){try{if((await fetch('http://127.0.0.1:4000/api/health/ready')).ok)return;}catch{}await new Promise(r=>setTimeout(r,500));}process.exitCode=1;})();`;
  await run([...compose, "exec", "-T", "api", "node", "-e", readyProbe]);
  step = "API_WITH_WORKER_STOPPED";
  try {
    await run([...compose, "stop", "sync-worker"]);
    await run([...compose, "exec", "-T", "api", "node", "-e", readyProbe]);
  } finally {
    await run([...compose, "start", "sync-worker"]);
  }
  console.log(
    "Actual non-root private worker custody, restricted role and API/worker independence PASS",
  );

  console.log(
    "Actual container credential custody, runtime denial, admin migration authority and repeat provisioning PASS",
  );
} catch {
  console.error(`DATABASE_RUNTIME_SMOKE_FAILED step=${step}`);
  process.exitCode = 1;
}
