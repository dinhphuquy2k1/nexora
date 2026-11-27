const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const {
  SyncRepository,
} = require("../../dist/sync/infrastructure/sync-job.repository");
const {
  SyncCapabilityRegistry,
} = require("../../dist/sync/infrastructure/sync-capability.registry");
const { loadSyncConfig } = require("../../dist/sync/domain/sync-policy");
const {
  createUnishipRuntimePolicy,
} = require("../../dist/sync/infrastructure/uniship-runtime-policy");
module.exports = async function verifyActivation(t, { db, apiUrl, workerUrl }) {
  const queues = [];
  const capabilities = new SyncCapabilityRegistry([
    {
      providerName: "uniship",
      type: "SHIPMENT",
      provider: {
        strategy: () => "FULL",
        fetch: async () => assert.fail("eligibility fixture never fetches"),
      },
      domain: {
        version: 1,
        supports: () => true,
        begin: async () => assert.fail("no domain operation"),
      },
    },
  ]);
  async function seed() {
    const owner = await db.user.create({
      data: { username: "activation-" + randomUUID(), role: "OPERATOR" },
    });
    await db.carrierUserState.create({ data: { userId: owner.id } });
    const connection = await db.carrierConnection.create({
      data: {
        userId: owner.id,
        provider: "uniship",
        externalAccountId: BigInt(
          "0x" + randomUUID().replaceAll("-", ""),
        ).toString(),
        loginIdentifier: "synthetic",
        displayName: "Synthetic activation fixture",
        status: "CONNECTED",
      },
    });
    const schedule = await db.syncConfig.create({
      data: {
        carrier_connection_id: connection.id,
        sync_type: "SHIPMENT",
        enabled: true,
        interval_minutes: 60,
        next_run_at: new Date(0),
      },
    });
    const policy = {
      ownerUserId: owner.id,
      externalAccountId: connection.externalAccountId,
      loginIdentifier: "synthetic",
      mode: "MANUAL_ONLY",
    };
    return { owner, connection, schedule, policy };
  }
  function queue(policy, mode = "api", enabled = true) {
    const result = new SyncRepository(
      mode === "api" ? apiUrl : workerUrl,
      loadSyncConfig({ SYNC_ENABLED: "true" }),
      capabilities,
      mode === "api" ? "exclusive" : "shared",
      createUnishipRuntimePolicy(policy, enabled),
    );
    queues.push(result);
    return result;
  }
  try {
    await t.test(
      "manual-only blocks direct AUTO and scheduler despite existing enabled/due onboarding intent",
      async () => {
        const f = await seed(),
          r = queue(f.policy);
        await assert.rejects(
          r.admit(f.owner.id, f.connection.id, "SHIPMENT", "AUTO"),
          (e) => e.code === "SYNC_UNAVAILABLE",
        );
        await r.schedule();
        assert.equal(
          await db.syncJob.count({
            where: { carrier_connection_id: f.connection.id },
          }),
          0,
        );
        const s = await db.syncConfig.findUnique({
          where: { id: f.schedule.id },
        });
        assert.equal(s.enabled, true);
        assert.equal(s.interval_minutes, 60);
      },
    );
    await t.test(
      "manual works independently of schedule enabled/due, unauthorized connection does not",
      async () => {
        const f = await seed(),
          other = await seed(),
          r = queue(f.policy);
        await db.syncConfig.update({
          where: { id: f.schedule.id },
          data: { enabled: false, next_run_at: null },
        });
        const manual = await r.admit(
          f.owner.id,
          f.connection.id,
          "SHIPMENT",
          "MANUAL",
        );
        assert.equal(manual.trigger_source, "MANUAL");
        await assert.rejects(
          r.admit(other.owner.id, other.connection.id, "SHIPMENT", "MANUAL"),
          (e) => e.code === "SYNC_UNAVAILABLE",
        );
        assert.equal(
          (await r.configs(other.owner.id, other.connection.id)).find(
            (c) => c.sync_type === "SHIPMENT",
          ).available,
          false,
        );
        const off = queue(f.policy, "worker", false);
        assert.equal(await off.claim(randomUUID()), null);
        await assert.rejects(
          off.admit(f.owner.id, f.connection.id, "SHIPMENT", "MANUAL"),
          (e) => e.code === "SYNC_UNAVAILABLE",
        );
      },
    );
    await t.test(
      "blocked AUTO does not occupy candidate selection or the owner manual lane",
      async () => {
        const f = await seed();
        const old = await db.syncJob.create({
          data: {
            owner_user_id: f.owner.id,
            carrier_connection_id: f.connection.id,
            provider: "uniship",
            external_account_id: f.connection.externalAccountId,
            sync_type: "SHIPMENT",
            trigger_source: "AUTO",
            generation: 0,
            lifecycle_version: 0,
            available_at: new Date(0),
          },
        });
        const r = queue(f.policy),
          worker = queue(f.policy, "worker");
        assert.equal(await worker.claim(randomUUID()), null);
        const manual = await r.admit(
          f.owner.id,
          f.connection.id,
          "SHIPMENT",
          "MANUAL",
        );
        assert.notEqual(manual.id, old.id);
        assert.equal(manual.trigger_source, "MANUAL");
        assert.equal(
          (await db.syncJob.findUnique({ where: { id: old.id } })).status,
          "CANCELLED",
        );
        const work = await worker.claim(randomUUID());
        assert.equal(work.id, manual.id);
      },
    );
    await t.test(
      "automatic admission requires approved mode plus persisted enabled/due and minimum60 without rewriting15/30",
      async () => {
        const f = await seed(),
          r = queue({ ...f.policy, mode: "AUTOMATIC" });
        for (const patch of [
          { enabled: false },
          { enabled: true, next_run_at: new Date(Date.now() + 3600000) },
          { enabled: true, next_run_at: new Date(0), interval_minutes: 15 },
          { interval_minutes: 30 },
        ]) {
          await db.syncConfig.update({
            where: { id: f.schedule.id },
            data: patch,
          });
          await assert.rejects(
            r.admit(f.owner.id, f.connection.id, "SHIPMENT", "AUTO"),
            (e) => e.code === "SYNC_UNAVAILABLE",
          );
        }
        assert.equal(
          (await db.syncConfig.findUnique({ where: { id: f.schedule.id } }))
            .interval_minutes,
          30,
        );
        await db.syncConfig.update({
          where: { id: f.schedule.id },
          data: { interval_minutes: 60 },
        });
        const admitted = await r.admit(
          f.owner.id,
          f.connection.id,
          "SHIPMENT",
          "AUTO",
        );
        const work = await queue(
          { ...f.policy, mode: "AUTOMATIC" },
          "worker",
        ).claim(randomUUID());
        assert.equal(work.id, admitted.id);
      },
    );
  } finally {
    for (const r of queues) await r.close();
  }
};
