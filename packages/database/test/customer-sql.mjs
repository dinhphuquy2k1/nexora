// Native PostgreSQL SQL/privilege evidence, NOT Prisma migrate/history/drift evidence.
// Raw Customer inserts deliberately omit addresses; raw address inserts may have no default.
// These expose physical-schema/legacy-audit boundaries, NOT valid business API creation.
import { test } from "node:test";
import assert from "node:assert/strict";
import { Client } from "pg";
import { readdir, readFile } from "node:fs/promises";
import { randomUUID, randomBytes } from "node:crypto";
import { provisionRuntime, runtimeUrl } from "../scripts/provision-runtime.mjs";
const migration = new URL(
  "../prisma/migrations/20261020010000_customers/migration.sql",
  import.meta.url,
);
test("real PostgreSQL customer upgrade, constraints, sequence and restricted runtime (native SQL only)", async () => {
  const sql = await readFile(migration, "utf8");
  assert.ok(process.env.DATABASE_URL, "isolated admin DATABASE_URL required");
  const admin = new Client({ connectionString: process.env.DATABASE_URL });
  await admin.connect();
  const name = "nexora_customer_sql_" + randomUUID().replaceAll("-", "");
  let db, runtime;
  try {
    await admin.query(`CREATE DATABASE "${name}"`);
    const url = new URL(process.env.DATABASE_URL);
    url.pathname = "/" + name;
    db = new Client({ connectionString: url.toString() });
    await db.connect();
    const root = new URL("../prisma/migrations/", import.meta.url);
    for (const entry of (await readdir(root)).sort())
      if (entry !== "20261020010000_customers" && /^\d/.test(entry))
        await db.query(
          await readFile(new URL(entry + "/migration.sql", root), "utf8"),
        );
    const a = randomUUID(),
      b = randomUUID();
    for (const id of [a, b])
      await db.query(
        "INSERT INTO users(id,username,role,status,updated_at) VALUES($1,$2,'OPERATOR','ACTIVE',now())",
        [id, id],
      );
    await db.query(
      "INSERT INTO user_credentials(user_id,password_hash) VALUES($1,'preserve-hash')",
      [a],
    );
    await db.query(
      "INSERT INTO sessions(id,user_id,token_hash,expires_at) VALUES($1,$2,$3,now()+interval '1 day')",
      [randomUUID(), a, "a".repeat(64)],
    );
    await db.query(
      "INSERT INTO user_mfa(user_id,totp_secret_ciphertext,nonce,auth_tag,key_version,last_used_step) VALUES($1,'opaque','nonce','tag',1,0)",
      [a],
    );
    await db.query(
      "INSERT INTO mfa_challenges(user_id,token_hash,expires_at) VALUES($1,$2,now()+interval '1 day')",
      [a, "b".repeat(64)],
    );
    await db.query(
      "INSERT INTO mfa_recovery_codes(user_id,code_hash) VALUES($1,$2)",
      [a, "c".repeat(64)],
    );
    await db.query(
      "INSERT INTO operator_setup_tokens(user_id,issued_by,token_hash,expires_at) VALUES($1,$1,$2,now()+interval '1 day')",
      [a, "d".repeat(64)],
    );
    await db.query(
      'INSERT INTO stored_files(id,sha256,"sizeBytes") VALUES($1,$2,1)',
      [randomUUID(), "e".repeat(64)],
    );
    await db.query(
      "INSERT INTO security_audit_events(event_type,outcome,reason,provider,correlation_id) VALUES('CONNECT','SUCCESS','VERIFIED','uniship',$1)",
      [randomUUID()],
    );
    const c = randomUUID();
    await db.query(
      "INSERT INTO carrier_connections(id,user_id,provider,external_account_id,display_name,status) VALUES($1,$2,'uniship','owned-fixture','Fixture','CONNECTED')",
      [c, a],
    );
    await db.query(
      "INSERT INTO carrier_connection_secrets(connection_id,secret_type,ciphertext,nonce,auth_tag,key_version) VALUES($1,'PASSWORD','opaque','nonce','tag',1)",
      [c],
    );
    const tables = (
      await db.query(
        "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename",
      )
    ).rows.map((x) => x.tablename);
    const snapshot = async () => {
      const out = {};
      for (const table of tables)
        out[table] = (
          await db.query(
            `SELECT to_jsonb(t) row FROM "${table}" t ORDER BY to_jsonb(t)::text`,
          )
        ).rows;
      return out;
    };
    const before = await snapshot();
    await db.query(sql);
    assert.deepEqual(await snapshot(), before);
    assert.deepEqual(
      (
        await db.query(
          "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename",
        )
      ).rows.map((x) => x.tablename),
      [...tables, "customers", "customer_addresses"].sort(),
    );
    const password = randomBytes(32).toString("hex");
    await provisionRuntime(url.toString(), password);
    runtime = new Client({
      connectionString: runtimeUrl(url.toString(), password),
    });
    await runtime.connect();
    assert.equal(
      (await runtime.query("SELECT current_user")).rows[0].current_user,
      "nexora_app",
    );
    const auditSql = await readFile(
      new URL("../scripts/audit-customer-addresses.sql", import.meta.url),
      "utf8",
    );
    async function audit() {
      const results = await db.query(auditSql);
      return results.find(
        (result) => result.rows?.[0]?.zero_address_customers !== undefined,
      ).rows[0];
    }
    const create = async (owner, phone, client = runtime) =>
      (
        await client.query(
          "INSERT INTO customers(owner_user_id,created_by_user_id,name,phone_normalized) VALUES($1,$1,$2,$3) RETURNING *",
          [owner, "Fixture Customer", phone],
        )
      ).rows[0];
    const one = await create(a, "+84912345678");
    assert.equal(one.code, "KH000001");
    await assert.rejects(
      create(a, "+84912345678"),
      (e) => e.code === "23505" && e.constraint === "uq_customers_owner_phone",
    );
    await create(b, "+84912345678");
    const parallelCreate = async (owner, phone) => {
      const client = new Client({
        connectionString: runtimeUrl(url.toString(), password),
      });
      await client.connect();
      try {
        return await create(owner, phone, client);
      } finally {
        await client.end();
      }
    };
    const concurrent = await Promise.all(
      Array.from({ length: 12 }, (_, i) =>
        parallelCreate(a, "+1202555" + String(i).padStart(4, "0")),
      ),
    );
    assert.equal(new Set(concurrent.map((x) => x.code)).size, 12);
    const same = await Promise.allSettled([
      parallelCreate(a, "+84987654321"),
      parallelCreate(a, "+84987654321"),
    ]);
    assert.equal(same.filter((x) => x.status === "fulfilled").length, 1);
    await assert.rejects(
      runtime.query(
        "INSERT INTO customers(owner_user_id,created_by_user_id,code,name,phone_normalized) VALUES($1,$1,$2,'Fixture','+12025558888')",
        [a, one.code],
      ),
      (e) => e.code === "23505" && e.constraint === "uq_customers_code",
    );
    await assert.rejects(
      runtime.query(
        "INSERT INTO customers(owner_user_id,created_by_user_id,name,phone_normalized) VALUES($1,$2,'Fixture','+12025558888')",
        [randomUUID(), a],
      ),
      (e) => e.code === "23503",
    );
    await assert.rejects(
      runtime.query(
        "INSERT INTO customers(owner_user_id,created_by_user_id,name,phone_normalized) VALUES($1,$2,'Fixture','+12025558888')",
        [a, randomUUID()],
      ),
      (e) => e.code === "23503",
    );
    await assert.rejects(
      runtime.query("UPDATE customers SET created_at=NULL WHERE id=$1", [
        one.id,
      ]),
      (e) => e.code === "23502",
    );
    await assert.rejects(
      runtime.query("UPDATE customers SET updated_at=NULL WHERE id=$1", [
        one.id,
      ]),
      (e) => e.code === "23502",
    );
    await runtime.query("UPDATE customers SET status='INACTIVE' WHERE id=$1", [
      one.id,
    ]);
    await db.query("SELECT setval('customer_code_seq',999999)");
    assert.equal((await create(a, "+12025559999")).code, "KH1000000");
    await assert.rejects(
      runtime.query("UPDATE customers SET status='INVALID' WHERE id=$1", [
        one.id,
      ]),
      (e) => e.code === "23514",
    );
    await assert.rejects(
      db.query("DELETE FROM users WHERE id=$1", [a]),
      (e) => e.code === "23503",
    );
    await assert.rejects(
      runtime.query("DELETE FROM customers WHERE id=$1", [one.id]),
      (e) => e.code === "42501",
    );
    for (const statement of [
      "CREATE TABLE forbidden(id int)",
      "CREATE TEMP TABLE forbidden(id int)",
      "SELECT * FROM security_audit_events",
      "UPDATE security_audit_events SET reason=reason",
      "ALTER TABLE security_audit_events DISABLE TRIGGER ALL",
      "SELECT setval('customer_code_seq',1)",
    ]) {
      await assert.rejects(runtime.query(statement), (e) => e.code === "42501");
    }
    assert.ok(
      (await audit()).zero_address_customers > 0,
      "audit detects deliberate raw legacy zero-address fixtures",
    );
    assert.equal((await audit()).multiple_default_customers, 0);
    const address = (
      await runtime.query(
        "INSERT INTO customer_addresses(customer_id,recipient_name,recipient_phone,country_code,address_text,is_default) VALUES($1,'Receiver','+84912345678','VN','Fixture address',true) RETURNING id",
        [one.id],
      )
    ).rows[0];
    await assert.rejects(
      runtime.query(
        "INSERT INTO customer_addresses(customer_id,recipient_name,recipient_phone,country_code,address_text,is_default) VALUES($1,'Receiver','+84912345678','VN','Other',true)",
        [one.id],
      ),
      (e) => e.code === "23505",
    );
    await runtime.query("UPDATE customer_addresses SET label=$1 WHERE id=$2", [
      "updated",
      address.id,
    ]);
    await runtime.query("DELETE FROM customer_addresses WHERE id=$1", [
      address.id,
    ]);
    await runtime.query(
      "INSERT INTO customer_addresses(customer_id,recipient_name,recipient_phone,address_text) VALUES($1,'Preserved receiver','+84912345678','Preserved address')",
      [one.id],
    );
    assert.equal(
      (await audit()).customers_without_default,
      1,
      "audit detects the deliberate non-default raw address; no automatic repair",
    );
    const preservedAddresses = (
      await db.query("SELECT * FROM customer_addresses ORDER BY id")
    ).rows;
    const preservedSequence = (
      await db.query("SELECT last_value,is_called FROM customer_code_seq")
    ).rows;
    const preserved = (await db.query("SELECT * FROM customers ORDER BY id"))
      .rows;
    await provisionRuntime(url.toString(), password);
    assert.deepEqual(
      (await db.query("SELECT * FROM customers ORDER BY id")).rows,
      preserved,
    );
    assert.deepEqual(
      (await db.query("SELECT * FROM customer_addresses ORDER BY id")).rows,
      preservedAddresses,
    );
    assert.deepEqual(
      (await db.query("SELECT last_value,is_called FROM customer_code_seq"))
        .rows,
      preservedSequence,
    );
    assert.deepEqual(await snapshot(), before);
    await assert.rejects(
      runtime.query(
        "INSERT INTO customer_addresses(customer_id,recipient_name,recipient_phone,address_text) VALUES($1,'Receiver','+84912345678','Fixture')",
        [randomUUID()],
      ),
      (e) => e.code === "23503",
    );
    await runtime.query(
      "INSERT INTO customer_addresses(customer_id,recipient_name,recipient_phone,address_text) VALUES($1,'Receiver','+84912345678','Fixture')",
      [one.id],
    );
    await db.query("DELETE FROM customers WHERE id=$1", [one.id]);
    assert.equal(
      (
        await db.query(
          "SELECT count(*)::int count FROM customer_addresses WHERE customer_id=$1",
          [one.id],
        )
      ).rows[0].count,
      0,
    );
  } finally {
    await runtime?.end();
    await db?.end();
    await admin.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
    await admin.end();
  }
});
