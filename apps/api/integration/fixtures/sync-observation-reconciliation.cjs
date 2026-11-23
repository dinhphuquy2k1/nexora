const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const {
  ShipmentAdapter,
} = require("../../dist/shipment/infrastructure/shipment.adapter");
const policy = {
  maxNewlyMissing: 1000,
  maxMissingRatioBps: 10000,
  maxObservedDropRatioBps: 10000,
};
module.exports.verifyReconciliation = async ({
  db,
  makeRepo,
  lane,
  source,
  page,
  start,
  finish,
  state,
  seen,
  scope,
  workerUrl,
  apiUrl,
  contract,
}) => {
  const repo = makeRepo(true, contract, policy);
  const scan = async (c, ids, r = repo) => {
    const { j, work } = await start(c, r);
    const rows = ids.map((x) => (typeof x === "object" ? x : source(x)));
    for (let n = 1; n <= Math.max(1, Math.ceil(rows.length / 100)); n++) {
      const w = n === 1 ? work : await r.claim(randomUUID());
      await r.page(
        w,
        page(n, rows.length, rows.slice((n - 1) * 100, n * 100)),
        1,
      );
    }
    return finish(j.id, r);
  };
  const roots = (owner) =>
    db.shipment.findMany({
      where: { ownerUserId: owner },
      orderBy: { trackingCode: "asc" },
      include: {
        charges: true,
        services: true,
        items: true,
        milestones: true,
        history: true,
      },
    });
  await scope(
    "062 bootstrap, first/second missing, unchanged/rejected restore and stable local state",
    async (c) => {
      assert.equal(
        (await scan(c, ["rA", "rB", "rC"])).reconciliationStatus,
        "BASELINE_ESTABLISHED",
      );
      const before = await roots(c.owner.id);
      const b = before.find((p) => p.trackingCode === "synthetic-rB");
      const customer = await db.customer.create({
        data: {
          ownerUserId: c.owner.id,
          createdByUserId: c.owner.id,
          name: "Owned synthetic association",
          phone: "+84912345678",
          addresses: {
            create: {
              recipientName: "Owned synthetic recipient",
              recipientPhone: "+84912345678",
              countryCode: "VN",
              addressText: "Synthetic test address",
              isDefault: true,
            },
          },
        },
      });
      await db.shipmentCharge.create({
        data: {
          shipmentId: b.id,
          lineNo: 1,
          chargeCode: "COUNTING",
          amount: "0.00",
          currency: "VND",
        },
      });
      await db.shipmentService.create({
        data: { shipmentId: b.id, serviceCode: "INSURANCE", enabled: true },
      });
      await db.shipmentMilestone.create({
        data: {
          shipmentId: b.id,
          milestoneCode: "ORIGIN_RECEIVED",
          occurredAt: new Date("2026-01-01T00:00:00Z"),
        },
      });
      await db.shipment.update({
        where: { id: b.id },
        data: {
          customerId: customer.id,
          internalNote: "private synthetic local note",
          assigneeUserId: c.owner.id,
        },
      });
      await db.shipmentItem.create({
        data: { shipmentId: b.id, lineNo: 1, name: "local preserved item" },
      });
      const preserved = await db.shipment.findUniqueOrThrow({
        where: { id: b.id },
        include: {
          items: true,
          history: true,
          charges: true,
          services: true,
          milestones: true,
        },
      });
      const first = await scan(c, ["rA", "rC"]);
      assert.equal(first.status, "SUCCEEDED");
      assert.equal(first.reconciliationNewlyHiddenCount, 1);
      const hidden = await db.shipment.findUniqueOrThrow({
        where: { id: b.id },
      });
      assert.equal(hidden.missingStreak, 1);
      assert.ok(hidden.syncHiddenAt);
      const adapter = new ShipmentAdapter(apiUrl || workerUrl);
      try {
        const q = { page: 1, pageSize: 1 };
        let list = await adapter.list(c.owner.id, q);
        assert.equal(list.stats.total, 2);
        assert.equal(list.pagination.totalPages, 2);
        assert.equal(
          (await adapter.list(c.owner.id, { ...q, q: "rB" })).pagination.total,
          0,
        );
        await assert.rejects(
          adapter.get(c.owner.id, b.id),
          (e) => e.code === "NOT_FOUND",
        );
        await assert.rejects(
          adapter.history(c.owner.id, b.id, q),
          (e) => e.code === "NOT_FOUND",
        );
      } finally {
        await adapter.close();
      }
      const second = await scan(c, ["rA", "rC"]);
      assert.equal(second.reconciliationStillMissingCount, 1);
      const twice = await db.shipment.findUniqueOrThrow({
        where: { id: b.id },
      });
      assert.equal(twice.missingStreak, 2);
      assert.deepEqual(twice.syncHiddenAt, hidden.syncHiddenAt);
      const restored = await scan(c, ["rA", "rB", "rC"]);
      assert.equal(restored.unchanged_count, 3);
      assert.equal(restored.reconciliationRestoredCount, 1);
      const active = await db.shipment.findUniqueOrThrow({
        where: { id: b.id },
        include: {
          items: true,
          history: true,
          charges: true,
          services: true,
          milestones: true,
        },
      });
      assert.equal(active.syncHiddenAt, null);
      assert.equal(active.missingStreak, 0);
      assert.equal(active.id, preserved.id);
      for (const k of [
        "customerId",
        "internalNote",
        "assigneeUserId",
        "lastSyncedAt",
        "updatedAt",
        "items",
        "history",
        "charges",
        "services",
        "milestones",
      ])
        assert.deepEqual(active[k], preserved[k]);
      await scan(c, ["rA", "rC"]);
      const rejected = source("rB", true);
      const rejectJob = await scan(c, [source("rA"), rejected, source("rC")]);
      assert.equal(rejectJob.rejected_count, 1);
      assert.equal(rejectJob.reconciliationRestoredCount, 1);
      assert.equal(
        (await db.shipment.findUnique({ where: { id: b.id } })).missingStreak,
        0,
      );
      assert.equal((await seen(rejectJob.id)).length, 0);
      assert.ok((await state(rejectJob.id)).reconciliationStatus);
    },
  );
  await scope(
    "062 configured UNTRUSTED/INCOMPLETE/FAILED/CANCELLED scans cannot mutate existing hidden state",
    async (c) => {
      await scan(c, ["uA", "uB", "uC"]);
      await scan(c, ["uA", "uC"]);
      const before = await roots(c.owner.id);
      const first = [
        source("uA"),
        source("uB"),
        source("uC"),
        ...Array.from({ length: 97 }, (_, i) =>
          source("rejected-u-" + i, true),
        ),
      ];
      const { j, work } = await start(c, repo);
      await repo.page(work, page(1, 101, first), 1);
      await repo.page(
        await repo.claim(randomUUID()),
        page(2, 101, [first[0]]),
        1,
      );
      const untrusted = await finish(j.id, repo);
      assert.equal(untrusted.scanIntegrityStatus, "UNTRUSTED");
      assert.equal(untrusted.reconciliationReason, "SCAN_NOT_VALIDATED");
      assert.deepEqual(await roots(c.owner.id), before);
      const partial = await start(c, repo);
      await repo.page(partial.work, page(1, 101, first), 1);
      await db.$executeRaw`UPDATE sync_jobs SET processing_phase='APPLYING' WHERE id=${partial.j.id}::uuid`;
      const incomplete = await finish(partial.j.id, repo);
      assert.equal(incomplete.scanIntegrityStatus, "INCOMPLETE");
      assert.equal(incomplete.reconciliationReason, "SCAN_NOT_VALIDATED");
      assert.deepEqual(await roots(c.owner.id), before);
      for (const status of ["FAILED", "CANCELLED"]) {
        const item = await start(c, repo);
        await repo.page(
          item.work,
          page(1, 3, [source("uA"), source("uB"), source("uC")]),
          1,
        );
        const applying = await repo.claim(randomUUID());
        await db.$executeRaw`UPDATE sync_jobs SET status=${status},worker_id=NULL,lease_expires_at=NULL WHERE id=${item.j.id}::uuid`;
        await assert.rejects(
          repo.apply(applying),
          (e) => e.code === "SYNC_STALE",
        );
        await repo.cleanup();
        assert.deepEqual(await roots(c.owner.id), before);
        assert.equal((await state(item.j.id)).reconciliationStatus, null);
      }
    },
  );
  await scope(
    "062 int32 streak limit skips all writes while reappearance still restores",
    async (c) => {
      await scan(c, ["oA", "oB"]);
      await scan(c, ["oA"]);
      const hidden = (await roots(c.owner.id)).find(
        (p) => p.trackingCode === "synthetic-oB",
      );
      await db.shipment.update({
        where: { id: hidden.id },
        data: { missingStreak: 2147483647 },
      });
      const before = await roots(c.owner.id);
      const blocked = await scan(c, ["oA"]);
      assert.equal(blocked.reconciliationReason, "STREAK_LIMIT_REACHED");
      assert.deepEqual(await roots(c.owner.id), before);
      const restored = await scan(c, ["oA", "oB"]);
      assert.equal(restored.reconciliationRestoredCount, 1);
      assert.equal(
        (await db.shipment.findUnique({ where: { id: hidden.id } }))
          .missingStreak,
        0,
      );
    },
  );
  await scope(
    "062 whole-operation mass/zero/disabled skips preserve visibility and trusted baseline",
    async (c) => {
      const baseline = await scan(c, ["sA", "sB", "sC"]);
      const original = await roots(c.owner.id);
      const strict = makeRepo(true, contract, {
        ...policy,
        maxNewlyMissing: 0,
      });
      const blocked = await scan(c, ["sA", "sC"], strict);
      assert.equal(
        blocked.reconciliationReason,
        "MASS_HIDE_THRESHOLD_EXCEEDED",
      );
      assert.deepEqual(await roots(c.owner.id), original);
      assert.equal(blocked.status, "SUCCEEDED");
      const zero = await scan(c, []);
      assert.equal(zero.reconciliationReason, "ZERO_RESULT_ANOMALY");
      assert.deepEqual(await roots(c.owner.id), original);
      const disabled = makeRepo();
      const off = await scan(c, ["sA", "sC"], disabled);
      assert.equal(off.reconciliationReason, "POLICY_NOT_CONFIGURED");
      assert.deepEqual(await roots(c.owner.id), original);
      assert.equal(
        (await state(baseline.id)).reconciliationStatus,
        "BASELINE_ESTABLISHED",
      );
      const ok = await scan(c, ["sA", "sC"]);
      assert.equal(ok.reconciliationNewlyHiddenCount, 1);
    },
  );
  await scope(
    "062 old summaries do not bootstrap; existing populated empty bootstrap and scope transition fail closed",
    async (c) => {
      const legacy = makeRepo();
      await scan(c, ["lA", "lB"], legacy);
      const empty = await scan(c, []);
      assert.equal(empty.reconciliationReason, "ZERO_RESULT_ANOMALY");
      const bootstrap = await scan(c, ["lA"]);
      assert.equal(bootstrap.reconciliationStatus, "BASELINE_ESTABLISHED");
      assert.equal(
        (await roots(c.owner.id)).filter((x) => x.syncHiddenAt).length,
        0,
      );
      await scan(c, ["lB"]);
      const changed = { ...contract, scope: "different-semantics" };
      const other = makeRepo(true, changed, policy);
      const { j, work } = await start(c, other);
      const p = page(1, 1, [source("lB")]);
      p.scan = { ...p.scan, ...changed };
      await other.page(work, p, 1);
      const result = await finish(j.id, other);
      assert.equal(result.reconciliationReason, "SCOPE_MISMATCH");
      const rows = await roots(c.owner.id);
      assert.equal(
        rows.find((x) => x.trackingCode === "synthetic-lA").missingStreak,
        1,
      );
    },
  );
  await scope(
    "062 repeated narrowed and widened scope changes never replace baseline or reinterpret visible roots",
    async (c) => {
      const baseline = await scan(c, ["qA", "qB", "qC"]);
      const before = await roots(c.owner.id);
      for (const scopeName of ["narrowed-query", "widened-query"]) {
        const changed = { ...contract, scope: scopeName },
          r = makeRepo(true, changed, policy);
        for (let i = 0; i < 3; i++) {
          const { j, work } = await start(c, r);
          let ids = ["qA", "qB", "qC"];
          if (scopeName === "narrowed-query") ids = ["qA", "qC"];
          if (i === 2) ids = [];
          const p = page(
            1,
            ids.length,
            ids.map((x) => source(x)),
          );
          p.scan = { ...p.scan, ...changed };
          await r.page(work, p, 1);
          const result = await finish(j.id, r);
          assert.equal(result.reconciliationReason, "SCOPE_MISMATCH");
          assert.equal(result.reconciliationStatus, "SKIPPED");
          assert.deepEqual(await roots(c.owner.id), before);
        }
      }
      assert.equal(
        (await state(baseline.id)).reconciliationStatus,
        "BASELINE_ESTABLISHED",
      );
    },
  );
  for (const phase of ["FETCHING", "APPLYING"])
    await scope(
      "062 pre-deployment " + phase + " job cannot bootstrap or reconcile",
      async (c) => {
        const { j, work } = await start(c, repo);
        if (phase === "FETCHING")
          await db.$executeRaw`UPDATE sync_jobs SET reconciliation_version=NULL WHERE id=${j.id}::uuid`;
        await repo.page(work, page(1, 1, [source("old-active")]), 1);
        if (phase === "APPLYING")
          await db.$executeRaw`UPDATE sync_jobs SET reconciliation_version=NULL WHERE id=${j.id}::uuid`;
        const result = await finish(j.id, repo);
        assert.equal(result.status, "SUCCEEDED");
        assert.equal(result.reconciliationReason, "CAPABILITY_NOT_ADMITTED");
        const bootstrap = await scan(c, ["old-active"]);
        assert.equal(bootstrap.reconciliationStatus, "BASELINE_ESTABLISHED");
      },
    );
  await scope(
    "062 empty real account establishes baseline and manual/foreign scopes never mutate",
    async (c) => {
      assert.equal(
        (await scan(c, [])).reconciliationStatus,
        "BASELINE_ESTABLISHED",
      );
      const manual = await db.shipment.create({
        data: { ownerUserId: c.owner.id, trackingCode: "manual-only" },
      });
      await scan(c, ["mA"]);
      await scan(c, ["mB"]);
      assert.equal(
        (await db.shipment.findUnique({ where: { id: manual.id } }))
          .missingStreak,
        0,
      );
      const foreign = await lane();
      await scan(foreign, ["mA"]);
      const before = await roots(foreign.owner.id);
      await scan(c, ["mB"]);
      assert.deepEqual(await roots(foreign.owner.id), before);
    },
  );
  for (const failure of ["summary", "terminal", "cleanup", "lease"])
    await scope(
      "062 " +
        failure +
        " failure rolls back visibility, summary, success and arrays; same lease retry exactly once",
      async (c) => {
        await scan(c, ["fA", "fB"]);
        const { j, work } = await start(c, repo);
        await repo.page(work, page(1, 1, [source("fA")]), 1);
        const applying = await repo.claim(randomUUID());
        const before = await roots(c.owner.id),
          jobBefore = await state(j.id),
          pagesBefore = await seen(j.id);
        const name = "reconcile_" + failure;
        let table = "sync_jobs",
          timing = "BEFORE UPDATE",
          body;
        if (failure === "summary")
          body =
            "IF NEW.reconciliation_status IS NOT NULL THEN RAISE EXCEPTION 'owned summary failure'; END IF;";
        if (failure === "terminal")
          body =
            "IF NEW.status='SUCCEEDED' THEN RAISE EXCEPTION 'owned terminal failure'; END IF;";
        if (failure === "cleanup") {
          table = "sync_job_seen_pages";
          timing = "BEFORE DELETE";
          body = "RAISE EXCEPTION 'owned cleanup failure';";
        }
        if (failure === "lease") {
          table = "shipments";
          timing = "AFTER UPDATE";
          body = `UPDATE sync_jobs SET lease_expires_at=clock_timestamp()-interval '1 second' WHERE id='${j.id}'::uuid;`;
        }
        await db.$executeRawUnsafe(
          `CREATE FUNCTION ${name}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN ${body} RETURN COALESCE(NEW,OLD); END $$`,
        );
        await db.$executeRawUnsafe(
          `CREATE TRIGGER ${name} ${timing} ON ${table} FOR EACH ROW EXECUTE FUNCTION ${name}()`,
        );
        try {
          await assert.rejects(repo.apply(applying));
          assert.deepEqual(await roots(c.owner.id), before);
          assert.deepEqual(await state(j.id), jobBefore);
          assert.deepEqual(await seen(j.id), pagesBefore);
        } finally {
          await db.$executeRawUnsafe(`DROP TRIGGER ${name} ON ${table}`);
          await db.$executeRawUnsafe(`DROP FUNCTION ${name}()`);
        }
        await repo.apply(applying);
        assert.equal((await state(j.id)).reconciliationNewlyHiddenCount, 1);
        await assert.rejects(
          repo.apply(applying),
          (e) => e.code === "SYNC_STALE",
        );
        assert.equal(
          (await roots(c.owner.id)).find(
            (x) => x.trackingCode === "synthetic-fB",
          ).missingStreak,
          1,
        );
      },
    );
  await scope(
    "062 concurrent finalization and takeover cannot increment twice",
    async (c) => {
      await scan(c, ["cA", "cB"]);
      const { j, work } = await start(c, repo);
      await repo.page(work, page(1, 1, [source("cA")]), 1);
      const old = await repo.claim(randomUUID());
      await db.$executeRaw`UPDATE sync_jobs SET lease_expires_at=clock_timestamp()-interval '1 second' WHERE id=${j.id}::uuid`;
      const other = makeRepo(true, contract, policy),
        newer = await other.claim(randomUUID());
      await assert.rejects(repo.apply(old), (e) => e.code === "SYNC_STALE");
      const result = await Promise.allSettled([
        repo.apply(newer),
        other.apply(newer),
      ]);
      assert.equal(result.filter((x) => x.status === "fulfilled").length, 1);
      assert.equal(
        (await roots(c.owner.id)).find((x) => x.trackingCode === "synthetic-cB")
          .missingStreak,
        1,
      );
    },
  );
  await scope(
    "062 reconnect preserves stable identities and conflicting root connection skips",
    async (c) => {
      await scan(c, ["dA", "dB"]);
      const before = await roots(c.owner.id);
      await db.carrierConnection.delete({ where: { id: c.connection.id } });
      const connection = await db.carrierConnection.create({
        data: {
          userId: c.owner.id,
          provider: "uniship",
          externalAccountId: c.connection.externalAccountId,
          displayName: "owned reconnect",
          status: "CONNECTED",
        },
      });
      const next = { owner: c.owner, connection };
      const hidden = await scan(next, ["dA"]);
      assert.equal(hidden.reconciliationNewlyHiddenCount, 1);
      const after = await roots(c.owner.id);
      assert.deepEqual(
        after.map((x) => x.id),
        before.map((x) => x.id),
      );
      assert.ok(after.every((x) => x.carrierConnectionId === null));
      const foreign = await lane();
      await db.shipment.update({
        where: { id: after[0].id },
        data: { carrierConnectionId: foreign.connection.id },
      });
      const conflict = await scan(next, ["dA"]);
      assert.equal(conflict.reconciliationReason, "SOURCE_SCOPE_CONFLICT");
    },
  );
};
