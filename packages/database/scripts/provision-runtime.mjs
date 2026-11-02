import { Client } from "pg";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
export const RUNTIME_ROLE = "nexora_app";
export const SYNC_GRANTS = {
  sync_configs: ["SELECT", "INSERT", "UPDATE"],
  sync_jobs: ["SELECT", "INSERT", "UPDATE"],
  sync_job_items: ["SELECT", "INSERT", "UPDATE"],
  sync_source_identities: ["SELECT", "INSERT", "UPDATE"],
  provider_source_records: ["SELECT", "INSERT", "UPDATE", "DELETE"],
  sync_provider_budget: ["SELECT", "INSERT", "UPDATE"],
  users: ["SELECT"],
  carrier_user_states: ["SELECT"],
  carrier_connections: ["SELECT"],
  customers: ["SELECT"],
};
export const RUNTIME_GRANTS = {
  sync_configs: ["SELECT", "INSERT", "UPDATE"],
  sync_jobs: ["SELECT", "INSERT", "UPDATE"],
  sync_job_items: ["SELECT", "INSERT", "UPDATE"],
  sync_source_identities: ["SELECT", "INSERT", "UPDATE"],
  provider_source_records: ["SELECT", "INSERT", "UPDATE", "DELETE"],
  sync_provider_budget: ["SELECT", "INSERT", "UPDATE"],
  customers: ["SELECT", "INSERT", "UPDATE"],
  customer_addresses: ["SELECT", "INSERT", "UPDATE", "DELETE"],
  users: ["SELECT", "INSERT", "UPDATE"],
  user_credentials: ["SELECT", "INSERT"],
  user_mfa: ["SELECT", "INSERT"],
  mfa_challenges: ["SELECT", "INSERT", "DELETE"],
  mfa_recovery_codes: ["SELECT", "INSERT"],
  sessions: ["SELECT", "INSERT", "DELETE"],
  operator_setup_tokens: ["SELECT", "INSERT", "UPDATE"],
  carrier_connections: ["SELECT", "INSERT", "UPDATE", "DELETE"],
  carrier_connection_secrets: ["SELECT", "INSERT", "UPDATE", "DELETE"],
  carrier_user_states: ["SELECT", "INSERT", "UPDATE"],
  stored_files: ["SELECT", "INSERT"],
};
const identifier = (value) => '"' + value.replaceAll('"', '""') + '"';
export function runtimeUrl(adminUrl, password, role = RUNTIME_ROLE) {
  const url = new URL(adminUrl);
  url.username = role;
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
export function isRetryableProvisionError(err) {
  if (err?.code === "55P03") return true;
  if (
    err?.code === "XX000" &&
    (err?.routine === "simple_heap_update" ||
      err?.message?.includes("concurrently updated"))
  ) {
    return true;
  }
  return false;
}
function validateTimeout(val, maxMs, defaultVal) {
  const timeoutStr = val === undefined ? defaultVal : val;
  if (typeof timeoutStr !== "string") throw Error("INVALID_TIMEOUT_FORMAT");
  const match = timeoutStr.match(/^(\d+)(ms|s|min)?$/);
  if (!match) throw Error("INVALID_TIMEOUT_FORMAT");
  const num = Number(match[1]);
  if (!Number.isFinite(num) || num <= 0) throw Error("INVALID_TIMEOUT_FORMAT");
  const unit = match[2] || "ms";
  const factor = unit === "min" ? 60000 : unit === "s" ? 1000 : 1;
  const ms = num * factor;
  if (ms > maxMs) throw Error("INVALID_TIMEOUT_FORMAT");
  return timeoutStr;
}
function sanitizeError(err, secrets) {
  if (!err) return err;
  for (const secret of secrets) {
    if (!secret || typeof secret !== "string" || secret.length < 4) continue;
    for (const prop of [
      "message",
      "stack",
      "detail",
      "internalQuery",
      "where",
      "hint",
    ]) {
      if (typeof err[prop] === "string" && err[prop].includes(secret)) {
        err[prop] = err[prop].replaceAll(secret, "[REDACTED]");
      }
    }
  }
  return err;
}
/** Trusted one-shot provisioning only. Never imported into API runtime. */
export async function provisionRuntime(adminUrl, password, options = {}) {
  const role = options.role ?? RUNTIME_ROLE;
  if (![RUNTIME_ROLE, "nexora_sync"].includes(role))
    throw Error("INVALID_RUNTIME_ROLE");
  const selectedGrants = role === RUNTIME_ROLE ? RUNTIME_GRANTS : SYNC_GRANTS;
  if (!/^[a-f0-9]{64}$/.test(password)) throw Error("INVALID_RUNTIME_SECRET");
  const lockTimeout = validateTimeout(options.lockTimeout, 60000, "10s");
  const statementTimeout = validateTimeout(
    options.statementTimeout,
    300000,
    "30s",
  );
  let maxAttempts = 5;
  if (options.maxAttempts !== undefined) {
    if (
      typeof options.maxAttempts !== "number" ||
      !Number.isInteger(options.maxAttempts) ||
      options.maxAttempts < 1 ||
      options.maxAttempts > 20
    ) {
      throw Error("INVALID_RETRY_CONFIG");
    }
    maxAttempts = options.maxAttempts;
  }
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
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
        `SET LOCAL lock_timeout='${lockTimeout}'; SET LOCAL statement_timeout='${statementTimeout}'; SET LOCAL log_statement='none'; SET LOCAL log_min_duration_statement=-1; SET LOCAL log_min_error_statement='panic'; SET LOCAL log_parameter_max_length_on_error=0`,
      );
      await db.query(
        "SELECT pg_advisory_xact_lock(hashtext('nexora_runtime_role_provision'))",
      );
      await db.query("LOCK TABLE pg_authid IN EXCLUSIVE MODE");
      const existing = (
        await db.query("SELECT * FROM pg_roles WHERE rolname=$1", [role])
      ).rows[0];
      if (existing && !restricted(existing)) throw Error("UNSAFE_RUNTIME_ROLE");
      if (!existing)
        await db.query(
          `CREATE ROLE ${role} LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS`,
        );
      const unsafe = await db.query(
        `SELECT EXISTS(SELECT 1 FROM pg_auth_members WHERE member=(SELECT oid FROM pg_roles WHERE rolname=$1))
        OR EXISTS(SELECT 1 FROM pg_database WHERE datdba=(SELECT oid FROM pg_roles WHERE rolname=$1))
        OR EXISTS(SELECT 1 FROM pg_namespace WHERE nspowner=(SELECT oid FROM pg_roles WHERE rolname=$1))
        OR EXISTS(SELECT 1 FROM pg_class WHERE relowner=(SELECT oid FROM pg_roles WHERE rolname=$1))
        OR EXISTS(SELECT 1 FROM pg_proc WHERE proowner=(SELECT oid FROM pg_roles WHERE rolname=$1)) AS unsafe`,
        [role],
      );
      if (unsafe.rows[0].unsafe) throw Error("UNSAFE_RUNTIME_ROLE");
      await db.query(
        `ALTER ROLE ${role} LOGIN NOINHERIT PASSWORD '${password}'`,
      );
      const name = identifier(
        (await db.query("SELECT current_database() AS name")).rows[0].name,
      );
      await db.query(`REVOKE CREATE,TEMP ON DATABASE ${name} FROM PUBLIC`);
      await db.query(`REVOKE ALL ON DATABASE ${name} FROM ${role}`);
      await db.query(`GRANT CONNECT ON DATABASE ${name} TO ${role}`);
      await db.query(
        `REVOKE CREATE ON SCHEMA public FROM PUBLIC; REVOKE ALL ON SCHEMA public FROM ${role}; GRANT USAGE ON SCHEMA public TO ${role}`,
      );
      await db.query(
        `REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC,${role}; REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM PUBLIC,${role}`,
      );
      // Table REVOKE does not clear column ACLs left by an earlier manual grant.
      const columns = await db.query(
        "SELECT table_name,column_name FROM information_schema.columns WHERE table_schema='public'",
      );
      for (const column of columns.rows)
        await db.query(
          `REVOKE SELECT(${identifier(column.column_name)}),INSERT(${identifier(column.column_name)}),UPDATE(${identifier(column.column_name)}),REFERENCES(${identifier(column.column_name)}) ON TABLE public.${identifier(column.table_name)} FROM PUBLIC,${role}`,
        );
      await db.query(
        `ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM PUBLIC,${role}; ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM PUBLIC,${role}`,
      );
      for (const [table, grants] of Object.entries(selectedGrants))
        await db.query(
          `GRANT ${grants.join(",")} ON TABLE public.${identifier(table)} TO ${role}`,
        );
      if (role === RUNTIME_ROLE) {
        await db.query(
          `GRANT USAGE ON SEQUENCE public.customer_code_seq TO ${role}; REVOKE ALL ON FUNCTION public.next_customer_code() FROM PUBLIC,${role}; GRANT EXECUTE ON FUNCTION public.next_customer_code() TO ${role}`,
        );
        await db.query(
          `GRANT UPDATE(last_used_step) ON user_mfa TO ${role}; GRANT UPDATE(consumed_at) ON mfa_challenges TO ${role}; GRANT UPDATE(used_at) ON mfa_recovery_codes TO ${role}`,
        );
        await db.query(
          `GRANT INSERT ON TABLE public.security_audit_events TO ${role}; GRANT SELECT(id) ON TABLE public.security_audit_events TO ${role}`,
        );
        await db.query(
          `REVOKE ALL ON FUNCTION public.reject_security_audit_mutation() FROM PUBLIC,${role}`,
        );
      } else {
        await db.query(
          `GRANT UPDATE(id) ON users,carrier_connections,customers TO ${role}; GRANT UPDATE(user_id) ON carrier_user_states TO ${role}`,
        );
      }
      await db.query("COMMIT");
      const runtimeRole = role;
      const runtime = new Client({
        connectionString: runtimeUrl(adminUrl, password, role),
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
          role.actor !== runtimeRole ||
          role.session_actor !== runtimeRole
        )
          throw Error("UNSAFE_RUNTIME_ROLE");
        if (runtimeRole === RUNTIME_ROLE) {
          const check = (
            await runtime.query(`SELECT has_table_privilege(current_user,'security_audit_events','INSERT') AS ins,
          has_column_privilege(current_user,'security_audit_events','id','SELECT') AS sel,
          has_table_privilege(current_user,'security_audit_events','UPDATE,DELETE,TRUNCATE,TRIGGER') AS mutate,
          has_schema_privilege(current_user,'public','CREATE') AS ddl,
          has_database_privilege(current_user,current_database(),'CREATE,TEMP') AS dbddl`)
          ).rows[0];
          if (
            !check.ins ||
            !check.sel ||
            check.mutate ||
            check.ddl ||
            check.dbddl
          )
            throw Error("UNSAFE_RUNTIME_GRANTS");
        }
      } finally {
        await runtime.end().catch(() => {});
      }
      return;
    } catch (err) {
      await db.query("ROLLBACK").catch(() => {});
      const secrets = [password];
      try {
        const parsed = new URL(adminUrl);
        if (parsed.password) secrets.push(parsed.password);
        secrets.push(parsed.toString());
      } catch {
        // Suppress URL parse errors on non-URL adminUrl fixtures
      }
      sanitizeError(err, secrets);
      if (attempt < maxAttempts - 1 && isRetryableProvisionError(err)) {
        await new Promise((r) => setTimeout(r, 100 * (attempt + 1)));
        continue;
      }
      throw Error("DATABASE_RUNTIME_PROVISION_FAILED", { cause: err });
    } finally {
      await db.end().catch(() => {});
    }
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
    const workerPassword = (
      await readFile("/sync-config/postgres_sync_password", "utf8")
    ).trim();
    await provisionRuntime(process.env.DATABASE_URL, workerPassword, {
      role: "nexora_sync",
    });
    console.log("Restricted database runtime provisioning PASS");
  } catch {
    console.error(
      "DATABASE_RUNTIME_PROVISION_FAILED: check role conflicts, custody and schema with an authorized administrator.",
    );
    process.exitCode = 1;
  }
}
