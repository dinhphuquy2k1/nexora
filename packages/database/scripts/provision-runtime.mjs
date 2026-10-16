import { Client } from "pg";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
export const RUNTIME_ROLE = "nexora_app";
export const RUNTIME_GRANTS = {
  users: ["SELECT", "INSERT", "UPDATE"],
  user_credentials: ["SELECT", "INSERT"],
  sessions: ["SELECT", "INSERT", "DELETE"],
  operator_setup_tokens: ["SELECT", "INSERT", "UPDATE"],
  carrier_connections: ["SELECT", "INSERT", "UPDATE", "DELETE"],
  carrier_connection_secrets: ["SELECT", "INSERT", "UPDATE", "DELETE"],
  carrier_user_states: ["SELECT", "INSERT", "UPDATE"],
  stored_files: ["SELECT", "INSERT"],
};
const identifier = (value) => '"' + value.replaceAll('"', '""') + '"';
export function runtimeUrl(adminUrl, password) {
  const url = new URL(adminUrl);
  url.username = RUNTIME_ROLE;
  url.password = password;
  return url.toString();
}
function restricted(role) {
  return (
    role &&
    !role.rolsuper &&
    !role.rolcreatedb &&
    !role.rolcreaterole &&
    !role.rolreplication &&
    !role.rolbypassrls
  );
}
/** Trusted one-shot provisioning only. Never imported into API runtime. */
export async function provisionRuntime(adminUrl, password) {
  if (!/^[a-f0-9]{64}$/.test(password)) throw Error("INVALID_RUNTIME_SECRET");
  const db = new Client({
    connectionString: adminUrl,
    connectionTimeoutMillis: 5000,
  });
  db.on("error", () => {});
  try {
    await db.connect();
    await db.query("BEGIN");
    // Password DDL is constructed only in memory. Suppress session SQL/error logging
    // before sending it; never print driver exceptions, SQL, URLs or parameters.
    await db.query(
      "SET LOCAL log_statement='none'; SET LOCAL log_min_duration_statement=-1; SET LOCAL log_min_error_statement='panic'; SET LOCAL log_parameter_max_length_on_error=0",
    );
    await db.query(
      "SELECT pg_advisory_xact_lock(hashtext('nexora_runtime_role_provision'))",
    );
    const existing = (
      await db.query("SELECT * FROM pg_roles WHERE rolname=$1", [RUNTIME_ROLE])
    ).rows[0];
    if (existing && !restricted(existing)) throw Error("UNSAFE_RUNTIME_ROLE");
    if (!existing)
      await db.query(
        "CREATE ROLE nexora_app LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS",
      );
    const unsafe = await db.query(
      `SELECT EXISTS(SELECT 1 FROM pg_auth_members WHERE member=(SELECT oid FROM pg_roles WHERE rolname=$1))
      OR EXISTS(SELECT 1 FROM pg_database WHERE datdba=(SELECT oid FROM pg_roles WHERE rolname=$1))
      OR EXISTS(SELECT 1 FROM pg_namespace WHERE nspowner=(SELECT oid FROM pg_roles WHERE rolname=$1))
      OR EXISTS(SELECT 1 FROM pg_class WHERE relowner=(SELECT oid FROM pg_roles WHERE rolname=$1))
      OR EXISTS(SELECT 1 FROM pg_proc WHERE proowner=(SELECT oid FROM pg_roles WHERE rolname=$1)) AS unsafe`,
      [RUNTIME_ROLE],
    );
    if (unsafe.rows[0].unsafe) throw Error("UNSAFE_RUNTIME_ROLE");
    await db.query(
      `ALTER ROLE nexora_app LOGIN NOINHERIT PASSWORD '${password}'`,
    );
    const name = identifier(
      (await db.query("SELECT current_database() AS name")).rows[0].name,
    );
    await db.query(`REVOKE CREATE,TEMP ON DATABASE ${name} FROM PUBLIC`);
    await db.query(`REVOKE ALL ON DATABASE ${name} FROM nexora_app`);
    await db.query(`GRANT CONNECT ON DATABASE ${name} TO nexora_app`);
    await db.query(
      "REVOKE CREATE ON SCHEMA public FROM PUBLIC; REVOKE ALL ON SCHEMA public FROM nexora_app; GRANT USAGE ON SCHEMA public TO nexora_app",
    );
    await db.query(
      "REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC,nexora_app; REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM PUBLIC,nexora_app",
    );
    // Table REVOKE does not clear column ACLs left by an earlier manual grant.
    const columns = await db.query(
      "SELECT table_name,column_name FROM information_schema.columns WHERE table_schema='public'",
    );
    for (const column of columns.rows)
      await db.query(
        `REVOKE SELECT(${identifier(column.column_name)}),INSERT(${identifier(column.column_name)}),UPDATE(${identifier(column.column_name)}),REFERENCES(${identifier(column.column_name)}) ON TABLE public.${identifier(column.table_name)} FROM PUBLIC,nexora_app`,
      );
    await db.query(
      "ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM PUBLIC,nexora_app; ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM PUBLIC,nexora_app",
    );
    for (const [table, grants] of Object.entries(RUNTIME_GRANTS))
      await db.query(
        `GRANT ${grants.join(",")} ON TABLE public.${identifier(table)} TO nexora_app`,
      );
    await db.query(
      "GRANT INSERT ON TABLE public.security_audit_events TO nexora_app; GRANT SELECT(id) ON TABLE public.security_audit_events TO nexora_app",
    );
    await db.query(
      "REVOKE ALL ON FUNCTION public.reject_security_audit_mutation() FROM PUBLIC,nexora_app",
    );
    await db.query("COMMIT");
    const runtime = new Client({
      connectionString: runtimeUrl(adminUrl, password),
      connectionTimeoutMillis: 5000,
    });
    runtime.on("error", () => {});
    try {
      await runtime.connect();
      const role = (
        await runtime.query(
          "SELECT *,current_user AS actor,session_user AS session_actor FROM pg_roles WHERE rolname=current_user",
        )
      ).rows[0];
      if (
        !restricted(role) ||
        role.actor !== RUNTIME_ROLE ||
        role.session_actor !== RUNTIME_ROLE
      )
        throw Error("UNSAFE_RUNTIME_ROLE");
      const check = (
        await runtime.query(`SELECT has_table_privilege(current_user,'security_audit_events','INSERT') AS ins,
        has_column_privilege(current_user,'security_audit_events','id','SELECT') AS sel,
        has_table_privilege(current_user,'security_audit_events','UPDATE,DELETE,TRUNCATE,TRIGGER') AS mutate,
        has_schema_privilege(current_user,'public','CREATE') AS ddl,
        has_database_privilege(current_user,current_database(),'CREATE,TEMP') AS dbddl`)
      ).rows[0];
      if (!check.ins || !check.sel || check.mutate || check.ddl || check.dbddl)
        throw Error("UNSAFE_RUNTIME_GRANTS");
    } finally {
      await runtime.end().catch(() => {});
    }
  } catch {
    await db.query("ROLLBACK").catch(() => {});
    throw Error("DATABASE_RUNTIME_PROVISION_FAILED");
  } finally {
    await db.end().catch(() => {});
  }
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    if (process.argv.length !== 2 || !process.env.DATABASE_URL)
      throw Error("INVALID_PROVISION_INVOCATION");
    const password = (
      await readFile("/runtime-config/postgres_app_password", "utf8")
    ).trim();
    await provisionRuntime(process.env.DATABASE_URL, password);
    console.log("Restricted database runtime provisioning PASS");
  } catch {
    console.error(
      "DATABASE_RUNTIME_PROVISION_FAILED: check role conflicts, custody and schema with an authorized administrator.",
    );
    process.exitCode = 1;
  }
}
