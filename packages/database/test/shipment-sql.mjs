// Cluster-global roles are exercised only on a signed disposable cluster.
import { test } from "node:test";
import assert from "node:assert/strict";
import { Client } from "pg";
import { randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { provisionRuntime, runtimeUrl } from "../scripts/provision-runtime.mjs";
const adminUrl = process.env.DISPOSABLE_CLUSTER_ADMIN_URL,
  token = process.env.DISPOSABLE_CLUSTER_TOKEN,
  password = process.env.DISPOSABLE_CLUSTER_RUNTIME_PASSWORD;
if (!adminUrl || !token || !password)
  throw Error("DISPOSABLE_CLUSTER_REQUIRED");
test(
  "Shipment real nexora_sync column authority and append-only history",
  { timeout: 90000 },
  async () => {
    const admin = new Client({ connectionString: adminUrl });
    await admin.connect();
    let db, worker, app;
    const name = "nexora_shipment_" + randomUUID().replaceAll("-", "");
    let owned = false;
    try {
      const stamp = await admin.query(
        "SELECT description FROM pg_shdescription JOIN pg_database ON objoid=pg_database.oid WHERE datname=current_database()",
      );
      assert.equal(stamp.rows[0]?.description, token);
      assert.equal(
        (
          await admin.query(
            "SELECT datname FROM pg_database WHERE datname IN ('production','staging')",
          )
        ).rowCount,
        0,
      );
      await admin.query(`CREATE DATABASE "${name}"`);
      owned = true;
      const u = new URL(adminUrl);
      u.pathname = "/" + name;
      db = new Client({ connectionString: u.toString() });
      await db.connect();
      const root = new URL("../prisma/migrations/", import.meta.url);
      for (const dir of (await readdir(root))
        .filter((x) => /^\d/.test(x))
        .sort())
        await db.query(
          await readFile(new URL(dir + "/migration.sql", root), "utf8"),
        );
      await provisionRuntime(u.toString(), password);
      await provisionRuntime(u.toString(), password, { role: "nexora_sync" });
      await provisionRuntime(u.toString(), password, { role: "nexora_sync" });
      worker = new Client({
        connectionString: runtimeUrl(u.toString(), password, "nexora_sync"),
      });
      app = new Client({
        connectionString: runtimeUrl(u.toString(), password),
      });
      await worker.connect();
      await app.connect();
      assert.equal(
        (await worker.query("SELECT current_user")).rows[0].current_user,
        "nexora_sync",
      );
      const owner = (
        await db.query(
          "INSERT INTO users(id,username,role,updated_at) VALUES(gen_random_uuid(),$1,'OPERATOR',CURRENT_TIMESTAMP) RETURNING id",
          ["shipment-" + randomUUID()],
        )
      ).rows[0].id;
      const rootRow = (
        await worker.query(
          "INSERT INTO shipments(owner_user_id,tracking_code) VALUES($1,$2) RETURNING *",
          [owner, "fixture"],
        )
      ).rows[0];
      assert.match(rootRow.code, /^VD\d{6,}$/);
      await worker.query(
        "UPDATE shipments SET total_amount=$1,total_currency=$2 WHERE id=$3",
        ["9999999999999999.99", "CNY", rootRow.id],
      );
      for (const column of [
        "id",
        "created_at",
        "carrier_connection_id",
        "provider",
        "customer_id",
        "assignee_user_id",
        "internal_note",
        "updated_by_user_id",
        "owner_user_id",
        "source_identity_id",
        "code",
      ]) {
        const value =
          column === "created_at"
            ? "2026-11-13T00:00:00Z"
            : column === "provider"
              ? "uniship"
              : column === "internal_note" || column === "code"
                ? "forbidden"
                : owner;
        await assert.rejects(
          worker.query(`UPDATE shipments SET ${column}=$1 WHERE id=$2`, [
            value,
            rootRow.id,
          ]),
          (e) => e.code === "42501",
        );
        if (
          ![
            "owner_user_id",
            "source_identity_id",
            "carrier_connection_id",
            "provider",
          ].includes(column)
        )
          await assert.rejects(
            worker.query(
              `INSERT INTO shipments(owner_user_id,tracking_code,${column === "owner_user_id" ? "id" : column}) VALUES($1,'forbidden',$2)`,
              [owner, value],
            ),
            (e) => e.code === "42501",
          );
      }
      await worker.query(
        "INSERT INTO shipment_charges(shipment_id,line_no,charge_code,amount,currency) VALUES($1,1,'OTHER','1.01','CNY')",
        [rootRow.id],
      );
      await worker.query(
        "UPDATE shipment_charges SET amount='2.02' WHERE shipment_id=$1",
        [rootRow.id],
      );
      await assert.rejects(
        worker.query(
          "UPDATE shipment_charges SET line_no=2 WHERE shipment_id=$1",
          [rootRow.id],
        ),
        (e) => e.code === "42501",
      );
      await worker.query(
        "INSERT INTO shipment_stage_history(shipment_id,source_version,processor_version,to_stage) VALUES($1,1,1,'UNKNOWN')",
        [rootRow.id],
      );
      for (const sql of [
        "UPDATE shipment_stage_history SET source_version=2",
        "DELETE FROM shipment_stage_history",
        "DELETE FROM shipments",
      ])
        await assert.rejects(worker.query(sql), (e) => e.code === "42501");
      assert.equal(
        (await app.query("SELECT * FROM shipments WHERE id=$1", [rootRow.id]))
          .rowCount,
        1,
      );
      for (const table of [
        "shipments",
        "shipment_charges",
        "shipment_stage_history",
      ])
        await assert.rejects(
          app.query(`DELETE FROM ${table}`),
          (e) => e.code === "42501",
        );
      await worker.query("DELETE FROM shipment_charges WHERE shipment_id=$1", [
        rootRow.id,
      ]);
    } finally {
      await worker?.end();
      await app?.end();
      await db?.end();
      if (owned) await admin.query(`DROP DATABASE "${name}" WITH (FORCE)`);
      await admin.end();
    }
  },
);
