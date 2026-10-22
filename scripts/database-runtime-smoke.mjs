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
try {
  const config = JSON.parse(
    await run([...compose, "--profile", "test", "config", "--format", "json"]),
  );
  const admin = config.volumes.credentials.name,
    runtime = config.volumes.runtime_credentials.name;
  for (const [service, expected] of [
    ["api", [runtime]],
    ["web", []],
    ["migrate", [admin]],
    ["db-runtime", [admin, runtime]],
  ]) {
    const mounts = config.services[service].volumes || [];
    const secrets = mounts.filter((m) =>
      ["credentials", "runtime_credentials"].includes(m.source),
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
      [admin, runtime].includes(m.Name),
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
  await run([
    ...compose,
    ...[
      "exec",
      "-T",
      "api",
      "sh",
      "__ENTRYPOINT__",
      "node",
      "-e",
      "\nconst assert=require('node:assert/strict'), fs=require('node:fs');\nconst databasePath=require.resolve('@nexora/database',{paths:[process.cwd()+'/apps/api',process.cwd()]});\nconst {createDatabase}=require(databasePath);\nconst {Client}=require('node:module').createRequire(databasePath)('pg');\nconst runtime=new Client({connectionString:process.env.DATABASE_URL});\nassert.equal(fs.existsSync('/config/postgres_password'),false);\nassert.match(new URL(process.env.DATABASE_URL).username,/^nexora_app$/);\nconst db=createDatabase(process.env.DATABASE_URL);\n(async()=>{try {\n const [role]=await db.$queryRawUnsafe('SELECT current_user,session_user,rolsuper,rolcreatedb,rolcreaterole,rolreplication,rolbypassrls FROM pg_roles WHERE rolname=current_user');\n assert.deepEqual(role,{current_user:'nexora_app',session_user:'nexora_app',rolsuper:false,rolcreatedb:false,rolcreaterole:false,rolreplication:false,rolbypassrls:false});\n await runtime.connect();\n for(const sql of ['SET ROLE nexora','ALTER TABLE security_audit_events DISABLE TRIGGER security_audit_append_only','TRUNCATE security_audit_events','CREATE TEMP TABLE runtime_forbidden(id int)','DELETE FROM customers',\"SELECT setval('customer_code_seq',1)\"]) await assert.rejects(runtime.query(sql),e=>e.code==='42501');\n} finally {await db.$disconnect();await runtime.end();}})().catch(()=>process.exit(1));\n",
    ].map((v) =>
      v === "__ENTRYPOINT__"
        ? development
          ? "/workspace/scripts/api-entrypoint.sh"
          : "/scripts/api-entrypoint.sh"
        : v,
    ),
  ]);
  await run([
    ...compose,
    ...[
      "run",
      "--rm",
      "--no-deps",
      "-T",
      "migrate",
      "node",
      "-e",
      "\nconst {Client}=require('pg');const db=new Client({connectionString:process.env.DATABASE_URL});\n(async()=>{try{await db.connect();const r=await db.query('SELECT current_user,rolsuper FROM pg_roles WHERE rolname=current_user');if(r.rows[0].current_user!=='nexora'||!r.rows[0].rolsuper)throw Error();}finally{await db.end();}})().catch(()=>process.exit(1));\n",
    ].map((v) =>
      v === "__ENTRYPOINT__"
        ? development
          ? "/workspace/scripts/api-entrypoint.sh"
          : "/scripts/api-entrypoint.sh"
        : v,
    ),
  ]);
  await run([...compose, "run", "--rm", "--no-deps", "-T", "db-runtime"]);
  console.log(
    "Actual container credential custody, runtime denial, admin migration authority and repeat provisioning PASS",
  );
} catch {
  console.error("DATABASE_RUNTIME_SMOKE_FAILED");
  process.exitCode = 1;
}
