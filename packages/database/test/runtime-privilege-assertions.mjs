import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { runtimeUrl } from "../scripts/provision-runtime.mjs";
export async function assertRuntimePrivileges(adminUrl, password) {
  const db = new Client({ connectionString: runtimeUrl(adminUrl, password) }),
    admin = new Client({ connectionString: adminUrl });
  await db.connect();
  await admin.connect();
  try {
    const role = (
      await db.query(
        "SELECT current_user,session_user,rolsuper,rolcreatedb,rolcreaterole,rolreplication,rolbypassrls,rolcanlogin,rolinherit FROM pg_roles WHERE rolname=current_user",
      )
    ).rows[0];
    assert.deepEqual(role, {
      current_user: "nexora_app",
      session_user: "nexora_app",
      rolsuper: false,
      rolcreatedb: false,
      rolcreaterole: false,
      rolreplication: false,
      rolbypassrls: false,
      rolcanlogin: true,
      rolinherit: false,
    });
    assert.equal(
      (
        await db.query(
          "SELECT count(*)::int AS count FROM pg_auth_members WHERE member=(SELECT oid FROM pg_roles WHERE rolname=current_user)",
        )
      ).rows[0].count,
      0,
    );
    const event = (
      await db.query(
        "INSERT INTO security_audit_events(event_type,outcome,reason,provider,correlation_id) VALUES ('CONNECT','SUCCESS','VERIFIED','uniship',$1::uuid) RETURNING id",
        [randomUUID()],
      )
    ).rows[0];
    assert.ok(event.id);
    const denied = [
      "UPDATE security_audit_events SET reason='UNAVAILABLE'",
      "DELETE FROM security_audit_events",
      "TRUNCATE security_audit_events",
      "ALTER TABLE security_audit_events DISABLE TRIGGER security_audit_append_only",
      "DROP TRIGGER security_audit_append_only ON security_audit_events",
      "DROP TABLE security_audit_events",
      "ALTER FUNCTION reject_security_audit_mutation() SECURITY DEFINER",
      "DROP FUNCTION reject_security_audit_mutation()",
      "SET ROLE nexora",
      "SET session_replication_role=replica",
      "CREATE TABLE public.forbidden(id int)",
      "CREATE TEMP TABLE forbidden_temp(id int)",
      "CREATE SCHEMA forbidden",
      "CREATE DATABASE forbidden_database",
      "CREATE ROLE forbidden_role",
      "SELECT reason FROM security_audit_events",
      "SELECT * FROM _prisma_migrations",
    ];
    for (const sql of denied)
      await assert.rejects(
        db.query(sql),
        (error) => error.code === "42501",
        sql.split(" ").slice(0, 3).join(" "),
      );
    const trigger = (
      await admin.query(
        "SELECT tgenabled FROM pg_trigger WHERE tgname='security_audit_append_only'",
      )
    ).rows[0];
    assert.equal(trigger.tgenabled, "O");
    await assert.rejects(
      admin.query("UPDATE security_audit_events SET reason='UNAVAILABLE'"),
      (error) => error.code === "42501",
    );
    const altered = (
      await admin.query(
        "SELECT (SELECT count(*) FROM pg_class WHERE relowner=(SELECT oid FROM pg_roles WHERE rolname='nexora_app'))::int + (SELECT count(*) FROM pg_namespace WHERE nspowner=(SELECT oid FROM pg_roles WHERE rolname='nexora_app'))::int + (SELECT count(*) FROM pg_proc WHERE proowner=(SELECT oid FROM pg_roles WHERE rolname='nexora_app'))::int + (SELECT count(*) FROM pg_database WHERE datdba=(SELECT oid FROM pg_roles WHERE rolname='nexora_app'))::int AS count",
      )
    ).rows[0].count;
    assert.equal(altered, 0);
  } finally {
    await db.end();
    await admin.end();
  }
  const wrong = new Client({
    connectionString: runtimeUrl(adminUrl, "0".repeat(64)),
    connectionTimeoutMillis: 3000,
  });
  try {
    await assert.rejects(wrong.connect(), (e) => e.code === "28P01");
  } finally {
    await wrong.end().catch(() => {});
  }
}
