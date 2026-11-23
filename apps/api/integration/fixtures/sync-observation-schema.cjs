const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { createRequire } = require("node:module");
const { Client } = createRequire(require.resolve("@nexora/database"))("pg");
const {
  SyncScanIntegrityStatus: I,
  SyncScanIntegrityReason: R,
} = require("../../dist/sync/domain/sync-observation.constants");
module.exports.verifyObservationSchema = async ({
  t,
  db,
  workerUrl,
  apiUrl,
  adminUrl,
  lane,
}) => {
  await t.test(
    "seen-page physical PK/FK/array bounds and exact nullable summary vocabulary",
    async () => {
      const c = await lane();
      const job = await db.syncJob.create({
        data: {
          owner_user_id: c.owner.id,
          carrier_connection_id: c.connection.id,
          provider: "uniship",
          external_account_id: c.connection.externalAccountId,
          sync_type: "SHIPMENT",
          trigger_source: "MANUAL",
          generation: 0,
          lifecycle_version: 0,
          status: "CANCELLED",
        },
      });
      const jobId = job.id;
      const columns =
        await db.$queryRaw`SELECT column_name,data_type,udt_name,is_nullable,datetime_precision,column_default FROM information_schema.columns WHERE table_schema='public' AND table_name='sync_job_seen_pages'`;
      const column = (name) => columns.find((c) => c.column_name === name);
      assert.equal(column("source_identity_ids").udt_name, "_uuid");
      assert.equal(column("source_identity_ids").is_nullable, "NO");
      for (const name of ["page_no", "reported_total"]) {
        assert.equal(column(name).data_type, "integer");
        assert.equal(column(name).is_nullable, "NO");
      }
      assert.equal(column("job_id").udt_name, "uuid");
      assert.equal(column("created_at").datetime_precision, 3);
      assert.equal(column("created_at").is_nullable, "NO");
      assert.ok(column("created_at").column_default);
      const constraints =
        await db.$queryRaw`SELECT c.conname,c.contype::text AS contype,c.convalidated,c.confdeltype::text AS confdeltype,c.confupdtype::text AS confupdtype,ARRAY(SELECT a.attname::text FROM unnest(c.confkey) WITH ORDINALITY k(attnum,ord) JOIN pg_attribute a ON a.attrelid=c.confrelid AND a.attnum=k.attnum ORDER BY k.ord) AS parent_columns,c.confrelid::regclass::text AS parent,
    ARRAY(SELECT a.attname::text FROM unnest(c.conkey) WITH ORDINALITY k(attnum,ord) JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=k.attnum ORDER BY k.ord) AS columns,
    pg_get_constraintdef(c.oid) AS definition
   FROM pg_constraint c WHERE c.conrelid='sync_job_seen_pages'::regclass`;
      assert.deepEqual(constraints.find((c) => c.contype === "p").columns, [
        "job_id",
        "page_no",
      ]);
      const fk = constraints.find((c) => c.contype === "f");
      assert.equal(fk.parent, "sync_jobs");
      assert.equal(fk.confdeltype, "c");
      assert.equal(fk.confupdtype, "a");
      assert.deepEqual(fk.parent_columns, ["id"]);
      assert.deepEqual(fk.columns, ["job_id"]);
      const indexes =
        await db.$queryRaw`SELECT indexname FROM pg_indexes WHERE tablename='sync_job_seen_pages'`;
      assert.equal(indexes.length, 1, "only composite PK index");
      assert.ok(constraints.every((c) => c.convalidated));
      async function insert(pageNo, ids = [], total = 0, id = jobId) {
        return db.$executeRaw`INSERT INTO sync_job_seen_pages(job_id,page_no,source_identity_ids,reported_total) VALUES(${id}::uuid,${pageNo},${ids}::uuid[],${total})`;
      }
      await insert(1);
      await insert(
        2,
        Array.from({ length: 500 }, () => randomUUID()),
        500,
      );
      for (const [n, ids, total, id] of [
        [0, [], 0],
        [-1, [], 0],
        [3, [], -1],
        [3, [null], 1],
        [3, Array.from({ length: 501 }, () => randomUUID()), 501],
        [1, [], 0],
        [4, [], 0, randomUUID()],
      ])
        await assert.rejects(insert(n, ids, total, id));
      await assert.rejects(
        db.$executeRaw`INSERT INTO sync_job_seen_pages(job_id,page_no,source_identity_ids,reported_total) VALUES(${jobId}::uuid,3,NULL,0)`,
      );
      await assert.rejects(
        db.$executeRaw`INSERT INTO sync_job_seen_pages(job_id,page_no,source_identity_ids,reported_total) VALUES(${jobId}::uuid,3,ARRAY[ARRAY[${randomUUID()}::uuid]],1)`,
      );
      await assert.rejects(
        db.$executeRaw`INSERT INTO sync_job_seen_pages(job_id,page_no,source_identity_ids,reported_total) VALUES(${jobId}::uuid,3,array_fill(${randomUUID()}::uuid,ARRAY[1],ARRAY[0]),1)`,
      );
      for (const [column, values] of [
        ["scan_integrity_status", Object.values(I)],
        ["scan_integrity_reason", Object.values(R)],
      ]) {
        const [row] =
          await db.$queryRaw`SELECT c.convalidated,pg_get_constraintdef(c.oid) AS definition,
    ARRAY(SELECT a.attname::text FROM unnest(c.conkey) k(attnum) JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=k.attnum) AS columns
    FROM pg_constraint c WHERE c.conrelid='sync_jobs'::regclass AND c.conname=${column === "scan_integrity_status" ? "chk_sync_scan_status" : "chk_sync_scan_reason"}`;
        assert.equal(row.convalidated, true);
        assert.deepEqual(row.columns, [column]);
        assert.deepEqual(
          [...row.definition.matchAll(/'([A-Z_]+)'/g)].map((m) => m[1]).sort(),
          [...values].sort(),
        );
        const original = row.definition;
        // Rollback-only mutation proves the exact catalog oracle is sensitive.
        await assert.rejects(
          db.$transaction(async (tx) => {
            const name =
              column === "scan_integrity_status"
                ? "chk_sync_scan_status"
                : "chk_sync_scan_reason";
            await tx.$executeRawUnsafe(
              `ALTER TABLE sync_jobs DROP CONSTRAINT ${name}`,
            );
            await tx.$executeRawUnsafe(
              `ALTER TABLE sync_jobs ADD CONSTRAINT ${name} CHECK (${column} IN (${[...values, "EXTRA"].map((v) => "'" + v + "'").join(",")}))`,
            );
            const [changed] =
              await tx.$queryRaw`SELECT convalidated,pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE conrelid='sync_jobs'::regclass AND conname=${name}`;
            assert.equal(changed.convalidated, true);
            assert.deepEqual(
              [...changed.definition.matchAll(/'([A-Z_]+)'/g)]
                .map((m) => m[1])
                .sort(),
              [...values].sort(),
            );
          }),
          (e) => e.code === "ERR_ASSERTION",
        );
        const [restored] =
          await db.$queryRaw`SELECT pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE conrelid='sync_jobs'::regclass AND conname=${column === "scan_integrity_status" ? "chk_sync_scan_status" : "chk_sync_scan_reason"}`;
        assert.equal(restored.definition, original);
      }
      const native = new Client({ connectionString: adminUrl });
      await native.connect();
      try {
        const insert = (status, reason) =>
          native.query(
            "INSERT INTO sync_jobs(owner_user_id,carrier_connection_id,provider,external_account_id,sync_type,trigger_source,generation,lifecycle_version,status,scan_integrity_status,scan_integrity_reason,scan_observed_count,scan_reported_total,scan_scope_fingerprint) VALUES($1,$2,'uniship',$3,'SHIPMENT','MANUAL',0,0,'CANCELLED',$4,$5,0,0,$6)",
            [
              c.owner.id,
              c.connection.id,
              c.connection.externalAccountId,
              status,
              reason,
              "a".repeat(64),
            ],
          );
        for (const status of Object.values(I))
          await insert(
            status,
            status === "VALIDATED" ? null : "COUNT_MISMATCH",
          );
        for (const reason of Object.values(R))
          await insert("INCOMPLETE", reason);
        await assert.rejects(
          insert("BAD", "COUNT_MISMATCH"),
          (e) => e.code === "23514" && e.constraint === "chk_sync_scan_status",
        );
        await assert.rejects(
          insert("INCOMPLETE", "BAD"),
          (e) => e.code === "23514" && e.constraint === "chk_sync_scan_reason",
        );
      } finally {
        await native.end();
      }
      for (const status of Object.values(I)) {
        await db.syncJob.update({
          where: { id: jobId },
          data: {
            scanIntegrityStatus: status,
            scanIntegrityReason:
              status === "VALIDATED" ? null : "COUNT_MISMATCH",
            scanObservedCount: 0,
            scanReportedTotal: 0,
            scanScopeFingerprint: "a".repeat(64),
          },
        });
      }
      for (const reason of Object.values(R))
        await db.syncJob.update({
          where: { id: jobId },
          data: {
            scanIntegrityStatus: "INCOMPLETE",
            scanIntegrityReason: reason,
          },
        });
      for (const data of [
        { scanIntegrityStatus: "BAD" },
        { scanIntegrityReason: "BAD" },
        { scanObservedCount: -1 },
        { scanReportedTotal: -1 },
        { scanScopeFingerprint: "bad" },
        {
          scanIntegrityStatus: "VALIDATED",
          scanIntegrityReason: null,
          scanObservedCount: 1,
          scanReportedTotal: 0,
        },
        { scanIntegrityStatus: null },
      ])
        await assert.rejects(db.syncJob.update({ where: { id: jobId }, data }));
      await db.syncJob.delete({ where: { id: jobId } });
      assert.equal(await db.syncJobSeenPage.count({ where: { jobId } }), 0);
    },
  );
  if (workerUrl && apiUrl)
    await t.test(
      "actual nexora_sync credentials allow only seen SELECT/INSERT/DELETE; API denied",
      async () => {
        const worker = new Client({ connectionString: workerUrl }),
          api = new Client({ connectionString: apiUrl });
        await worker.connect();
        await api.connect();
        const c = await lane(),
          job = await db.syncJob.create({
            data: {
              owner_user_id: c.owner.id,
              carrier_connection_id: c.connection.id,
              provider: "uniship",
              external_account_id: c.connection.externalAccountId,
              sync_type: "SHIPMENT",
              trigger_source: "MANUAL",
              generation: 0,
              lifecycle_version: 0,
              status: "CANCELLED",
            },
          });
        try {
          await db.$executeRawUnsafe(
            "GRANT UPDATE ON sync_job_seen_pages TO nexora_sync",
          );
          await db.$executeRawUnsafe(
            "GRANT SELECT ON sync_job_seen_pages TO nexora_app",
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
          assert.equal(
            (await worker.query("SELECT current_user")).rows[0].current_user,
            "nexora_sync",
          );
          assert.equal(
            (await api.query("SELECT current_user")).rows[0].current_user,
            "nexora_app",
          );
          await worker.query(
            "INSERT INTO sync_job_seen_pages(job_id,page_no,source_identity_ids,reported_total) VALUES($1,1,ARRAY[]::uuid[],0)",
            [job.id],
          );
          assert.equal(
            (
              await worker.query(
                "SELECT page_no FROM sync_job_seen_pages WHERE job_id=$1",
                [job.id],
              )
            ).rows.length,
            1,
          );
          for (const sql of [
            "UPDATE sync_job_seen_pages SET reported_total=0",
            "TRUNCATE sync_job_seen_pages",
            "ALTER TABLE sync_job_seen_pages ADD COLUMN forbidden int",
            "DROP TABLE sync_job_seen_pages",
          ])
            await assert.rejects(worker.query(sql), (e) => e.code === "42501");
          for (const sql of [
            "SELECT * FROM sync_job_seen_pages",
            "INSERT INTO sync_job_seen_pages(job_id,page_no,source_identity_ids,reported_total) VALUES($1,2,ARRAY[]::uuid[],0)",
            "UPDATE sync_job_seen_pages SET reported_total=0",
            "DELETE FROM sync_job_seen_pages",
            "TRUNCATE sync_job_seen_pages",
          ])
            await assert.rejects(
              api.query(sql, sql.includes("$1") ? [job.id] : []),
              (e) => e.code === "42501",
            );
          await worker.query(
            "DELETE FROM sync_job_seen_pages WHERE job_id=$1",
            [job.id],
          );
          assert.equal(
            (
              await worker.query(
                "SELECT count(*)::int AS n FROM sync_job_seen_pages WHERE job_id=$1",
                [job.id],
              )
            ).rows[0].n,
            0,
          );
        } finally {
          await worker.end();
          await api.end();
        }
      },
    );
};
