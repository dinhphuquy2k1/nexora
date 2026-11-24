const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { createDatabase } = require("@nexora/database");
const {
  ReconciliationStatus: S,
  ReconciliationReason: R,
} = require("../../dist/sync/domain/sync-reconciliation.constants");
module.exports.verifyReconciliationSchema = async ({
  t,
  db,
  lane,
  workerUrl,
  apiUrl,
  adminUrl,
}) => {
  await t.test(
    "062 physical visibility/coherent summary and exact native status/reason/version parity",
    async () => {
      const c = await lane();
      const columns =
        await db.$queryRaw`SELECT column_name,data_type,is_nullable,column_default,datetime_precision FROM information_schema.columns WHERE table_schema='public' AND table_name='shipments' AND column_name IN ('sync_hidden_at','missing_streak')`;
      assert.equal(
        columns.find((c) => c.column_name === "sync_hidden_at")
          .datetime_precision,
        3,
      );
      assert.equal(
        columns.find((c) => c.column_name === "missing_streak").is_nullable,
        "NO",
      );
      assert.match(
        columns.find((c) => c.column_name === "missing_streak").column_default,
        /0/,
      );
      const catalog =
        () => db.$queryRaw`SELECT c.conname,c.convalidated,c.conrelid::regclass::text AS table_name,
    ARRAY(SELECT a.attname::text FROM unnest(c.conkey) WITH ORDINALITY k(attnum,ord) JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=k.attnum ORDER BY k.ord) AS columns,
    pg_get_constraintdef(c.oid) AS definition FROM pg_constraint c WHERE c.conrelid IN ('shipments'::regclass,'sync_jobs'::regclass) AND c.contype='c'`;
      const constraints = await catalog();
      const visibility = constraints.find(
        (x) => x.conname === "chk_shipments_sync_visibility",
      );
      assert.equal(visibility.convalidated, true);
      assert.equal(visibility.table_name, "shipments");
      assert.deepEqual([...visibility.columns].sort(), [
        "missing_streak",
        "sync_hidden_at",
      ]);
      const stamp = constraints.find(
        (x) => x.columns.join(",") === "reconciliation_version",
      );
      assert.equal(stamp.convalidated, true);
      assert.match(stamp.definition, />= 1/);

      for (const [name, column, values] of [
        [
          "chk_sync_jobs_reconciliation_status",
          "reconciliation_status",
          Object.values(S),
        ],
        [
          "chk_sync_jobs_reconciliation_reason",
          "reconciliation_reason",
          Object.values(R),
        ],
      ]) {
        const constraint = constraints.find((x) => x.conname === name);
        assert.equal(constraint.table_name, "sync_jobs");
        assert.equal(constraint.convalidated, true);
        assert.deepEqual(constraint.columns, [column]);
        const extracted = [
          ...constraint.definition.matchAll(/'([A-Z_]+)'/g),
        ].map((x) => x[1]);
        assert.deepEqual([...new Set(extracted)].sort(), values.sort());
        const rollback = Symbol("catalog mutation rollback");
        await assert.rejects(
          db.$transaction(async (tx) => {
            await tx.$executeRawUnsafe(
              `ALTER TABLE sync_jobs DROP CONSTRAINT ${name}`,
            );
            await tx.$executeRawUnsafe(
              `ALTER TABLE sync_jobs ADD CONSTRAINT ${name} CHECK(${column} IN (${[...values, "EXTRA"].map((x) => "'" + x + "'").join(",")}))`,
            );
            const [row] = await tx.$queryRawUnsafe(
              `SELECT pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE conname='${name}'`,
            );
            assert.notDeepEqual(
              [
                ...new Set(
                  [...row.definition.matchAll(/'([A-Z_]+)'/g)].map((x) => x[1]),
                ),
              ].sort(),
              values.sort(),
            );
            throw rollback;
          }),
          (e) => e === rollback,
        );
      }
      const insert = (
        status,
        reason,
        version = 1,
      ) => db.$executeRaw`INSERT INTO sync_jobs(id,owner_user_id,provider,external_account_id,sync_type,trigger_source,status,generation,lifecycle_version,reconciliation_version,reconciliation_status,reconciliation_reason,reconciliation_newly_hidden_count,reconciliation_restored_count,reconciliation_still_missing_count)
    VALUES(${randomUUID()}::uuid,${c.owner.id}::uuid,'uniship',${c.connection.externalAccountId},'SHIPMENT','MANUAL','CANCELLED',0,0,${version},${status},${reason},0,0,0)`;
      for (const status of Object.values(S))
        await insert(
          status,
          status === S.SKIPPED ? R.POLICY_NOT_CONFIGURED : null,
        );
      for (const reason of Object.values(R)) await insert(S.SKIPPED, reason);
      for (const [status, reason, version] of [
        ["EXTRA", null, 1],
        [S.SKIPPED, "EXTRA", 1],
        [S.APPLIED, R.POLICY_NOT_CONFIGURED, 1],
        [S.SKIPPED, null, 1],
        [S.APPLIED, null, 0],
        [S.APPLIED, null, -1],
      ])
        await assert.rejects(
          insert(status, reason, version),
          (e) =>
            e.meta?.code === "23514" ||
            e.cause?.originalCode === "23514" ||
            JSON.stringify(e).includes("23514"),
        );
      const root = await db.shipment.create({
        data: { ownerUserId: c.owner.id, trackingCode: "schema" },
      });
      for (const [hidden, streak] of [
        [null, 1],
        [new Date(), 0],
        [new Date(), -1],
      ])
        await assert.rejects(
          db.shipment.update({
            where: { id: root.id },
            data: { syncHiddenAt: hidden, missingStreak: streak },
          }),
        );
      await db.shipment.update({
        where: { id: root.id },
        data: { syncHiddenAt: new Date(), missingStreak: 2147483647 },
      });
    },
  );
  if (apiUrl)
    await t.test(
      "062 actual worker/API credentials allow only approved visibility column writes",
      async () => {
        const c = await lane();
        const root = await db.shipment.create({
          data: { ownerUserId: c.owner.id, trackingCode: "runtime-owned" },
        });
        const worker = createDatabase(workerUrl),
          app = createDatabase(apiUrl);
        try {
          assert.equal(
            (await worker.$queryRaw`SELECT current_user`)[0].current_user,
            "nexora_sync",
          );
          await db.$executeRawUnsafe(
            "GRANT UPDATE ON shipments TO nexora_sync",
          );
          await db.$executeRawUnsafe(
            "GRANT UPDATE(sync_hidden_at,missing_streak) ON shipments TO nexora_app",
          );
          const { provisionRuntime } = await import(
            "../../../../packages/database/scripts/provision-runtime.mjs"
          );
          const { readFile } = require("node:fs/promises");
          const password = (
            await readFile(process.env.API_TEST_RUNTIME_PASSWORD_FILE, "utf8")
          ).trim();
          await provisionRuntime(adminUrl, password, { role: "nexora_sync" });
          await provisionRuntime(adminUrl, password);

          await worker.$executeRaw`UPDATE shipments SET sync_hidden_at=clock_timestamp(),missing_streak=1 WHERE id=${root.id}::uuid`;
          await worker.$executeRaw`UPDATE shipments SET sync_hidden_at=NULL,missing_streak=0 WHERE id=${root.id}::uuid`;
          for (const sql of [
            "UPDATE shipments SET internal_note='forbidden'",
            "UPDATE shipments SET owner_user_id=owner_user_id",
            "UPDATE shipments SET source_identity_id=source_identity_id",
            "UPDATE shipments SET code=code",
            "UPDATE shipments SET customer_id=customer_id",
            "UPDATE shipments SET assignee_user_id=assignee_user_id",
            "DELETE FROM shipments",
          ])
            await assert.rejects(worker.$executeRawUnsafe(sql));
          for (const sql of [
            "UPDATE shipments SET sync_hidden_at=NULL,missing_streak=0",
            "UPDATE shipments SET tracking_code=tracking_code",
          ])
            await assert.rejects(app.$executeRawUnsafe(sql));
          const [acl] =
            await worker.$queryRaw`SELECT has_table_privilege(current_user,'shipments','UPDATE') AS table_update,has_column_privilege(current_user,'shipments','sync_hidden_at','UPDATE') AS hidden_update,has_column_privilege(current_user,'shipments','missing_streak','UPDATE') AS streak_update`;
          assert.deepEqual(acl, {
            table_update: false,
            hidden_update: true,
            streak_update: true,
          });
        } finally {
          await worker.$disconnect();
          await app.$disconnect();
        }
      },
    );
};
