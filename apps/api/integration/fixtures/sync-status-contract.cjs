// Invoked by the existing migrated, owned PostgreSQL Sync integration suite.
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { createRequire } = require("node:module");
const databaseRequire = createRequire(require.resolve("@nexora/database"));
const { Client } = databaseRequire("pg");
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");
const {
  SyncJobStatus: J,
  SyncType: T,
  SyncTrigger,
  ACTIVE_SYNC_JOBS,
  SyncErrorCode: E,
} = require("../../dist/sync/domain/sync.constants");
const {
  TransactionSyncDisablement,
} = require("../../dist/sync/infrastructure/sync-disablement.participant");

// Accept PostgreSQL's normalized IN/ANY catalog form, not arbitrary expressions.
// Reject extra OR clauses/functions even if their quoted literals look correct.
function statusValues(expression) {
  const normalized = expression
    .replace(/::(?:text|character varying)(?:\[\])?/g, "")
    .replace(/[()\s]/g, "");
  const match = /^status=ANYARRAY\[('[A-Z_]+'(?:,'[A-Z_]+')*)\]$/.exec(
    normalized,
  );
  assert.ok(match, "catalog predicate must be only status membership");
  const values = match[1].split(",").map((s) => s.slice(1, -1));
  assert.equal(
    new Set(values).size,
    values.length,
    "no duplicate status codes",
  );
  return values.sort();
}

module.exports.verifySyncStatusContracts = async ({
  t,
  url,
  db,
  owner,
  repo,
}) => {
  const client = new Client({ connectionString: url });
  const lanes = [],
    actors = [];
  const statuses = Object.values(J),
    types = Object.values(T);
  const terminals = statuses.filter((s) => !ACTIVE_SYNC_JOBS.includes(s));
  const quote = (s) => "'" + s.replaceAll("'", "''") + "'";
  const list = (values) => values.map(quote).join(",");
  async function lane(userId = owner.id) {
    const row = await db.carrierConnection.create({
      data: {
        userId,
        provider: "uniship",
        externalAccountId: randomUUID(),
        displayName: "Owned status contract",
        status: "CONNECTED",
      },
    });
    lanes.push(row.id);
    return row;
  }
  async function actor() {
    const row = await db.user.create({
      data: { username: "status-" + randomUUID(), role: "OPERATOR" },
    });
    actors.push(row.id);
    return row;
  }
  async function insert(c, status, type = T.SHIPMENT) {
    const values = [
      c.id,
      c.userId,
      c.provider,
      c.externalAccountId,
      type,
      SyncTrigger.MANUAL,
    ];
    const statusColumn = status === undefined ? "" : ",status";
    const statusValue = status === undefined ? "" : ",$7";
    if (status !== undefined) values.push(status);
    return (
      await client.query(
        `INSERT INTO sync_jobs(carrier_connection_id,owner_user_id,provider,external_account_id,sync_type,trigger_source,generation,lifecycle_version${statusColumn}) VALUES($1,$2,$3,$4,$5,$6,0,1${statusValue}) RETURNING *`,
        values,
      )
    ).rows[0];
  }
  async function catalog() {
    const checks = (
      await client.query(
        `SELECT c.conname,c.convalidated,pg_get_expr(c.conbin,c.conrelid) AS expression FROM pg_constraint c JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attname='status' WHERE c.conrelid='public.sync_jobs'::regclass AND c.contype='c' AND c.conkey=ARRAY[a.attnum]`,
      )
    ).rows;
    assert.equal(checks.length, 1, "one exact status CHECK");
    assert.equal(checks[0].convalidated, true);
    assert.deepEqual(
      statusValues(checks[0].expression),
      [...statuses].sort(),
      "CHECK matches all Job statuses exactly",
    );
    const [index] = (
      await client.query(
        `SELECT i.indisunique,i.indisvalid,i.indisready,pg_get_expr(i.indpred,i.indrelid) AS predicate,ARRAY(SELECT a.attname::text FROM unnest(i.indkey) WITH ORDINALITY AS k(attnum,n) JOIN pg_attribute a ON a.attrelid=i.indrelid AND a.attnum=k.attnum WHERE k.n<=i.indnkeyatts ORDER BY k.n) AS columns FROM pg_index i JOIN pg_class c ON c.oid=i.indexrelid WHERE c.oid='public.uq_sync_jobs_active'::regclass AND i.indrelid='public.sync_jobs'::regclass`,
      )
    ).rows;
    assert.ok(index);
    assert.equal(index.indisunique, true);
    assert.equal(index.indisvalid, true);
    assert.equal(index.indisready, true);
    assert.deepEqual(index.columns, ["carrier_connection_id", "sync_type"]);
    assert.deepEqual(
      statusValues(index.predicate),
      [...ACTIVE_SYNC_JOBS].sort(),
      "index predicate matches Domain active set exactly",
    );
    const [def] = (
      await client.query(
        `SELECT pg_get_expr(d.adbin,d.adrelid) AS expression FROM pg_attrdef d JOIN pg_attribute a ON a.attrelid=d.adrelid AND a.attnum=d.adnum WHERE d.adrelid='public.sync_jobs'::regclass AND a.attname='status'`,
      )
    ).rows;
    assert.ok(def);
    // This expression is server-owned catalog SQL in an isolated test DB.
    assert.equal(
      (await client.query(`SELECT ${def.expression} AS value`)).rows[0].value,
      J.QUEUED,
    );
    return checks[0].conname;
  }
  async function snapshots(c) {
    return (
      await client.query(
        "SELECT * FROM sync_jobs WHERE carrier_connection_id=$1 ORDER BY id",
        [c.id],
      )
    ).rows;
  }
  async function seed(c, status) {
    const row = await insert(c, status);
    await client.query(
      "UPDATE sync_jobs SET lease_version=7,worker_id=$2,lease_expires_at=clock_timestamp()+interval '1 hour' WHERE id=$1",
      [row.id, randomUUID()],
    );
    await client.query(
      "INSERT INTO sync_configs(carrier_connection_id,sync_type,enabled,interval_minutes,next_run_at) VALUES($1,$2,true,60,clock_timestamp()) ON CONFLICT DO NOTHING",
      [c.id, T.SHIPMENT],
    );
    return (await snapshots(c)).find((j) => j.id === row.id);
  }
  function cancelled(before, after) {
    if (ACTIVE_SYNC_JOBS.includes(before.status)) {
      assert.equal(after.status, J.CANCELLED);
      assert.equal(after.last_error_code, E.SYNC_STALE);
      assert.equal(after.lease_version, before.lease_version + 1);
      assert.equal(after.worker_id, null);
      assert.equal(after.lease_expires_at, null);
      assert.ok(after.finished_at);
      assert.ok(after.updated_at >= before.updated_at);
    } else
      assert.deepEqual(
        after,
        before,
        "terminal Job remains byte-for-byte unchanged",
      );
  }
  await client.connect();
  try {
    await t.test(
      "status contract: generated Prisma/default/CHECK/index catalog and exact sets",
      async () => {
        assert.equal(new Set(statuses).size, statuses.length);
        assert.ok(ACTIVE_SYNC_JOBS.length > 0);
        assert.ok(ACTIVE_SYNC_JOBS.every((s) => statuses.includes(s)));
        const schema = readFileSync(
          resolve(
            __dirname,
            "../../../../packages/database/prisma/schema.prisma",
          ),
          "utf8",
        );
        const model = /^model SyncJob\s*\{([\s\S]*?)^\}/m.exec(schema);
        assert.ok(model, "Prisma SyncJob model exists");
        const field = /^\s*status\s+String\s+([^\n]+)/m.exec(model[1]);
        assert.ok(field, "status remains a scalar String");
        assert.equal(/@default\("([^"\n]+)"\)/.exec(field[1])?.[1], J.QUEUED);
        const generatedLane = await lane();
        const generated = await db.syncJob.create({
          data: {
            carrier_connection_id: generatedLane.id,
            owner_user_id: owner.id,
            provider: generatedLane.provider,
            external_account_id: generatedLane.externalAccountId,
            sync_type: T.SHIPMENT,
            trigger_source: SyncTrigger.MANUAL,
            generation: 0,
            lifecycle_version: 1,
          },
        });
        assert.equal(
          generated.status,
          J.QUEUED,
          "generated Prisma INSERT default",
        );
        await catalog();
        const c = await lane();
        assert.equal(
          (await insert(c)).status,
          J.QUEUED,
          "INSERT without status uses actual DB default",
        );
      },
    );
    await t.test(
      "status contract: catalog rejects actual CHECK/default/index drift and restores DDL",
      async () => {
        const constraint = await catalog();
        const variants = [
          `ALTER TABLE sync_jobs ALTER COLUMN status SET DEFAULT ${quote(J.RUNNING)}`,
          `ALTER TABLE sync_jobs DROP CONSTRAINT ${constraint}; ALTER TABLE sync_jobs ADD CONSTRAINT ${constraint} CHECK(status IN (${list(statuses.filter((s) => s !== J.FAILED))}))`,
          `ALTER TABLE sync_jobs DROP CONSTRAINT ${constraint}; ALTER TABLE sync_jobs ADD CONSTRAINT ${constraint} CHECK(status IN (${list([...statuses, "UNAPPROVED"])}))`,
          `ALTER TABLE sync_jobs DROP CONSTRAINT ${constraint}; ALTER TABLE sync_jobs ADD CONSTRAINT ${constraint} CHECK(status IN (${list(statuses)}) OR true)`,
          `DROP INDEX uq_sync_jobs_active; CREATE UNIQUE INDEX uq_sync_jobs_active ON sync_jobs(carrier_connection_id,sync_type) WHERE status IN (${list(ACTIVE_SYNC_JOBS.slice(1))})`,
          `DROP INDEX uq_sync_jobs_active; CREATE UNIQUE INDEX uq_sync_jobs_active ON sync_jobs(carrier_connection_id,sync_type) WHERE status IN (${list([...ACTIVE_SYNC_JOBS, J.SUCCEEDED])})`,
        ];
        for (const ddl of variants) {
          await client.query("BEGIN");
          try {
            await client.query(ddl);
            await assert.rejects(catalog, assert.AssertionError);
          } finally {
            await client.query("ROLLBACK");
          }
          await catalog();
        }
      },
    );
    await t.test(
      "status contract: every valid status accepted, invalid status fails exact CHECK",
      async () => {
        const constraint = await catalog();
        for (const status of statuses)
          assert.equal((await insert(await lane(), status)).status, status);
        const c = await lane();
        for (const value of ["UNKNOWN", "queued", ""])
          await assert.rejects(
            () => insert(c, value),
            (e) => e.code === "23514" && e.constraint === constraint,
          );
      },
    );
    await t.test(
      "status contract: each active pair conflicts only on active-lane index",
      async () => {
        for (const first of ACTIVE_SYNC_JOBS)
          for (const second of ACTIVE_SYNC_JOBS) {
            const c = await lane();
            await insert(c, first);
            await assert.rejects(
              () => insert(c, second),
              (e) =>
                e.code === "23505" && e.constraint === "uq_sync_jobs_active",
            );
          }
        const c = await lane();
        await insert(c, J.RUNNING, types[0]);
        await insert(c, J.QUEUED, types[1]);
        assert.equal(
          (await snapshots(c)).length,
          2,
          "different types can be active on one connection",
        );
      },
    );
    await t.test(
      "status contract: terminal history never prevents a new active lane",
      async () => {
        const c = await lane();
        for (const status of terminals) {
          await insert(c, status);
          await insert(c, status);
        }
        const active = await insert(c, ACTIVE_SYNC_JOBS[0]);
        assert.equal(active.status, ACTIVE_SYNC_JOBS[0]);
        assert.equal((await snapshots(c)).length, terminals.length * 2 + 1);
      },
    );
    await t.test(
      "status contract: prepared partial-index inference and repository return-existing",
      async () => {
        const c = await lane();
        await client.query(
          `PREPARE sync_contract_admit(uuid,uuid,text,text,text,text) AS INSERT INTO sync_jobs(carrier_connection_id,owner_user_id,provider,external_account_id,sync_type,trigger_source,generation,lifecycle_version) VALUES($1,$2,$3,$4,$5,$6,0,1) ON CONFLICT(carrier_connection_id,sync_type) WHERE status IN ('QUEUED','RUNNING','WAITING') DO NOTHING RETURNING id`,
        );
        try {
          const sql = `EXECUTE sync_contract_admit(${[c.id, c.userId, c.provider, c.externalAccountId, T.SHIPMENT, SyncTrigger.MANUAL].map(quote).join(",")})`;
          const [created] = (await client.query(sql)).rows;
          assert.ok(created);
          assert.equal((await client.query(sql)).rowCount, 0);
          for (const status of ACTIVE_SYNC_JOBS) {
            await client.query("UPDATE sync_jobs SET status=$2 WHERE id=$1", [
              created.id,
              status,
            ]);
            assert.equal(
              (await repo.admit(owner.id, c.id, T.SHIPMENT, SyncTrigger.MANUAL))
                .id,
              created.id,
            );
            assert.equal((await snapshots(c)).length, 1);
          }
        } finally {
          await client.query("DEALLOCATE sync_contract_admit");
        }
      },
    );
    await t.test(
      "status contract: disable cancels all active statuses, preserves terminals and foreign owner",
      async () => {
        const user = await actor(),
          foreign = await actor(),
          cases = [];
        for (const status of statuses) {
          const c = await lane(user.id);
          cases.push({ c, before: await seed(c, status) });
        }
        const other = await lane(foreign.id),
          otherBefore = await seed(other, J.RUNNING);
        await db.$transaction((tx) =>
          new TransactionSyncDisablement(tx).disable(user.id),
        );
        for (const { c, before } of cases) {
          cancelled(before, (await snapshots(c))[0]);
          const config = (
            await client.query(
              "SELECT enabled,next_run_at FROM sync_configs WHERE carrier_connection_id=$1",
              [c.id],
            )
          ).rows[0];
          assert.equal(config.enabled, false);
          assert.equal(config.next_run_at, null);
        }
        assert.deepEqual((await snapshots(other))[0], otherBefore);
        assert.equal(
          (
            await client.query(
              "SELECT enabled FROM sync_configs WHERE carrier_connection_id=$1",
              [other.id],
            )
          ).rows[0].enabled,
          true,
        );
      },
    );
    await t.test(
      "status contract: removeConnection scopes every active status and preserves terminals",
      async () => {
        const user = await actor(),
          foreign = await actor();
        for (const active of ACTIVE_SYNC_JOBS) {
          const target = await lane(user.id),
            sameOwner = await lane(user.id),
            other = await lane(foreign.id);
          const before = [await seed(target, active)];
          for (const terminal of terminals)
            before.push(await seed(target, terminal));
          const sameBefore = await seed(sameOwner, J.RUNNING),
            otherBefore = await seed(other, J.RUNNING);
          await db.$transaction((tx) =>
            new TransactionSyncDisablement(tx).removeConnection(
              foreign.id,
              target.id,
            ),
          );
          assert.deepEqual(
            await snapshots(target),
            [...before].sort((a, b) => a.id.localeCompare(b.id)),
            "wrong owner cannot cancel target",
          );
          await db.$transaction((tx) =>
            new TransactionSyncDisablement(tx).removeConnection(
              user.id,
              target.id,
            ),
          );
          const after = await snapshots(target);
          for (const row of before)
            cancelled(
              row,
              after.find((j) => j.id === row.id),
            );
          assert.deepEqual((await snapshots(sameOwner))[0], sameBefore);
          assert.deepEqual((await snapshots(other))[0], otherBefore);
        }
      },
    );
  } finally {
    try {
      await client.query(
        "DELETE FROM sync_jobs WHERE carrier_connection_id=ANY($1::uuid[])",
        [lanes],
      );
      await db.carrierConnection.deleteMany({ where: { id: { in: lanes } } });
      await db.user.deleteMany({ where: { id: { in: actors } } });
    } finally {
      await client.end();
    }
  }
};
