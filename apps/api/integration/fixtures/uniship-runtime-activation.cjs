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
    const {
      UnishipSyncRuntime,
    } = require("../../dist/sync/infrastructure/uniship-sync.runtime");
    const {
      CarrierLifecycleAdapter,
    } = require("../../dist/carrier/infrastructure/carrier-lifecycle.adapter");
    const { createHash, randomBytes } = require("node:crypto");
    const key = randomBytes(32).toString("base64");
    const sealedDigest = (value) =>
      createHash("sha256").update(JSON.stringify(value)).digest("hex");
    async function state(f) {
      return {
        connection: await db.carrierConnection.findUnique({
          where: { id: f.connection.id },
        }),
        generation: await db.carrierUserState.findUnique({
          where: { userId: f.owner.id },
        }),
        credentials: sealedDigest(
          await db.carrierConnectionSecret.findMany({
            where: { connectionId: f.connection.id },
            orderBy: { secretType: "asc" },
          }),
        ),
        schedules: await db.syncConfig.findMany({
          where: { carrier_connection_id: f.connection.id },
          orderBy: { id: "asc" },
        }),
        jobs: await db.syncJob.findMany({
          where: { carrier_connection_id: f.connection.id },
          orderBy: { id: "asc" },
        }),
      };
    }
    function carrier(f, patch = {}, environment = {}) {
      return new UnishipSyncRuntime(
        apiUrl,
        {
          NODE_ENV: "test",
          SYNC_ENABLED: "true",
          UNISHIP_API_URL: "http://127.0.0.1:9",
          CARRIER_KEYRING_JSON: JSON.stringify({ 1: key }),
          CARRIER_ACTIVE_KEY_VERSION: "1",
          UNISHIP_ACTIVATION_POLICY_JSON: JSON.stringify({
            ...f.policy,
            ...patch,
          }),
          ...environment,
        },
        "api",
      );
    }
    for (const scenario of [
      { label: "owner denied", patch: { ownerUserId: randomUUID() }, calls: 0 },
      { label: "login denied", login: "other-synthetic", calls: 0 },
      {
        label: "optional connection denied",
        patch: { connectionId: randomUUID() },
        calls: 0,
      },
      { label: "verified account denied", wrongAccount: true, calls: 2 },
      { label: "auth verify incoherent", incoherent: true, calls: 2 },
      { label: "approved scoped connect", calls: 2, success: true },
    ])
      await t.test(
        `Sync OFF scoped initial connect: ${scenario.label}`,
        async () => {
          const { createServer } = require("node:http");
          const f = await seed();
          // Initial UI connection has no existing row or predeclared connection UUID.
          await db.carrierConnection.delete({ where: { id: f.connection.id } });
          let requests = 0;
          const server = createServer(async (req, res) => {
            requests++;
            for await (const chunk of req) void chunk;
            const account =
              scenario.wrongAccount || (scenario.incoherent && requests === 2)
                ? "999"
                : f.policy.externalAccountId;
            res.setHeader("content-type", "application/json");
            res.end(
              JSON.stringify({
                token: "synthetic-connect-token",
                user: { userid: account },
              }),
            );
          });
          await new Promise((resolve) =>
            server.listen(0, "127.0.0.1", resolve),
          );
          const runtime = carrier(f, scenario.patch, {
            SYNC_ENABLED: "false",
            UNISHIP_API_URL: `http://127.0.0.1:${server.address().port}`,
          });
          try {
            const operation = runtime.carrier.lifecycle.connect(f.owner.id, {
              loginIdentifier: scenario.login ?? "synthetic",
              password: "synthetic-password",
              displayName: "Synthetic scoped connection",
            });
            if (scenario.success)
              assert.equal((await operation).status, "CONNECTED");
            else
              await assert.rejects(operation, {
                code: scenario.calls
                  ? "CANDIDATE_IDENTITY_MISMATCH"
                  : "SERVICE_UNAVAILABLE",
              });
            assert.equal(requests, scenario.calls);
            assert.equal(
              await db.carrierConnection.count({
                where: { userId: f.owner.id },
              }),
              scenario.success ? 1 : 0,
            );
            assert.equal(
              await db.carrierConnectionSecret.count({
                where: { connection: { userId: f.owner.id } },
              }),
              scenario.success ? 2 : 0,
            );
            assert.equal(
              await db.syncConfig.count({
                where: { connection: { userId: f.owner.id } },
              }),
              scenario.success ? 1 : 0,
            );
            assert.equal(
              runtime.capabilities.resolve("uniship", "SHIPMENT"),
              null,
            );
          } finally {
            await runtime.onApplicationShutdown();
            await new Promise((resolve) => server.close(resolve));
            await db.user.delete({ where: { id: f.owner.id } });
          }
        },
      );
    await t.test(
      "Sync OFF external target scoped initial connect and reconnect persist encrypted credentials cleanly",
      async (st) => {
        const f = await seed();
        await db.carrierConnection.delete({ where: { id: f.connection.id } });
        const calls = [];
        st.mock.method(globalThis, "fetch", async (url) => {
          const parsed = new URL(String(url));
          assert.equal(parsed.origin, "https://kh.uniship.vn");
          calls.push(parsed.pathname);
          return new globalThis.Response(
            JSON.stringify({
              token:
                calls.length <= 2
                  ? "synthetic-external-connect-token"
                  : "synthetic-external-reconnect-token",
              user: { userid: f.policy.externalAccountId },
            }),
            { status: 200, headers: { "content-type": "application/json" } },
          );
        });
        const runtime = carrier(
          f,
          {},
          {
            SYNC_ENABLED: "false",
            UNISHIP_API_URL: "https://kh.uniship.vn",
            UNISHIP_LIVE_AUTHORIZED: "true",
          },
        );
        try {
          const connected = await runtime.carrier.lifecycle.connect(
            f.owner.id,
            {
              loginIdentifier: "synthetic",
              password: "synthetic-password",
              displayName: "Synthetic external connection",
            },
          );
          assert.equal(connected.status, "CONNECTED");
          assert.deepEqual(calls, [
            "/client/api-token-auth/",
            "/client/api-token-verify/",
          ]);
          const reconnected = await runtime.carrier.lifecycle.reconnect(
            f.owner.id,
            connected.id,
            "synthetic-password",
          );
          assert.equal(reconnected.status, "CONNECTED");
          assert.deepEqual(calls, [
            "/client/api-token-auth/",
            "/client/api-token-verify/",
            "/client/api-token-auth/",
            "/client/api-token-verify/",
          ]);
          const row = await db.carrierConnection.findUnique({
            where: { id: connected.id },
          });
          assert.equal(row.lifecycleVersion, 2);
          assert.equal(
            await db.carrierConnectionSecret.count({
              where: { connectionId: connected.id },
            }),
            2,
          );
          assert.equal(
            await db.syncConfig.count({
              where: { connection: { userId: f.owner.id } },
            }),
            1,
          );
          assert.equal(
            runtime.capabilities.resolve("uniship", "SHIPMENT"),
            null,
          );
        } finally {
          await runtime.onApplicationShutdown();
          await db.syncJob.deleteMany({ where: { owner_user_id: f.owner.id } });
          await db.user.delete({ where: { id: f.owner.id } });
        }
      },
    );
    for (const [label, patch, environment] of [
      ["owner", { ownerUserId: randomUUID() }, {}],
      ["login", { loginIdentifier: "other-synthetic" }, {}],
      ["account", { externalAccountId: "999" }, {}],
      ["optional connection", { connectionId: randomUUID() }, {}],
      [
        "missing external scope with Sync OFF",
        {},
        {
          SYNC_ENABLED: "false",
          UNISHIP_API_URL: "https://kh.uniship.vn",
          UNISHIP_LIVE_AUTHORIZED: "true",
          UNISHIP_ACTIVATION_POLICY_JSON: "",
        },
      ],
      [
        "live opt-in disabled",
        {},
        {
          UNISHIP_API_URL: "https://kh.uniship.vn",
          UNISHIP_LIVE_AUTHORIZED: "false",
        },
      ],
      [
        "unapproved external origin",
        {},
        {
          UNISHIP_API_URL: "https://other.invalid",
          UNISHIP_LIVE_AUTHORIZED: "true",
        },
      ],
    ])
      await t.test(
        `activation-denied reconnect (${label}) leaves credentials lifecycle and jobs unchanged`,
        async () => {
          const f = await seed();
          await db.carrierConnectionSecret.create({
            data: {
              connectionId: f.connection.id,
              secretType: "PASSWORD",
              ciphertext: "synthetic-sealed",
              nonce: "synthetic",
              authTag: "synthetic",
              keyVersion: 1,
            },
          });
          await db.syncJob.create({
            data: {
              owner_user_id: f.owner.id,
              carrier_connection_id: f.connection.id,
              provider: "uniship",
              external_account_id: f.connection.externalAccountId,
              sync_type: "SHIPMENT",
              trigger_source: "MANUAL",
              generation: 0,
              lifecycle_version: 0,
            },
          });
          const runtime = carrier(f, patch, environment);
          let requests = 0;
          runtime.carrier.client.authenticate = async () => {
            requests++;
            assert.fail("denied reconnect cannot dispatch");
          };
          try {
            const before = await state(f);
            await assert.rejects(
              runtime.carrier.lifecycle.reconnect(
                f.owner.id,
                f.connection.id,
                "synthetic",
              ),
              { code: "SERVICE_UNAVAILABLE" },
            );
            assert.deepEqual(await state(f), before);
            assert.equal(requests, 0);
          } finally {
            await runtime.onApplicationShutdown();
            await db.syncJob.deleteMany({
              where: { owner_user_id: f.owner.id },
            });
            await db.user.delete({ where: { id: f.owner.id } });
          }
        },
      );
    for (const status of ["CONNECTED", "ERROR", "REAUTH_REQUIRED"])
      await t.test(
        `valid manual reconnect from ${status} verifies loopback provider and completes`,
        async () => {
          const { createServer } = require("node:http");
          const f = await seed();
          await db.carrierConnection.update({
            where: { id: f.connection.id },
            data: { status },
          });
          let requests = 0;
          const server = createServer(async (req, res) => {
            requests++;
            for await (const chunk of req) {
              void chunk; // Consume only; never retain credentials.
            }
            res.setHeader("content-type", "application/json");
            res.end(
              JSON.stringify({
                token: "synthetic-reconnect-token",
                user: { userid: f.connection.externalAccountId },
              }),
            );
          });
          await new Promise((resolve) =>
            server.listen(0, "127.0.0.1", resolve),
          );
          const runtime = carrier(
            f,
            {},
            { UNISHIP_API_URL: `http://127.0.0.1:${server.address().port}` },
          );
          try {
            const result = await runtime.carrier.lifecycle.reconnect(
              f.owner.id,
              f.connection.id,
              "synthetic",
            );
            assert.equal(result.status, "CONNECTED");
            assert.equal(requests, 2);
            const row = await db.carrierConnection.findUnique({
              where: { id: f.connection.id },
            });
            assert.equal(row.lifecycleVersion, 2);
            assert.equal(
              await db.carrierConnectionSecret.count({
                where: { connectionId: f.connection.id },
              }),
              2,
            );
          } finally {
            await runtime.onApplicationShutdown();
            await new Promise((resolve) => server.close(resolve));
            await db.syncJob.deleteMany({
              where: { owner_user_id: f.owner.id },
            });
            await db.user.delete({ where: { id: f.owner.id } });
          }
        },
      );
    for (const [label, mutate] of [
      [
        "generation",
        async (f) =>
          db.carrierUserState.update({
            where: { userId: f.owner.id },
            data: { generation: 1 },
          }),
      ],
      [
        "version",
        async (f) =>
          db.carrierConnection.update({
            where: { id: f.connection.id },
            data: { lifecycleVersion: 1 },
          }),
      ],
      [
        "delete",
        async (f) =>
          db.carrierConnection.delete({ where: { id: f.connection.id } }),
      ],
    ])
      await t.test(
        `manual reconnect CAS rejects ${label} change between precheck and claim`,
        async () => {
          const f = await seed(),
            runtime = carrier(f);
          const context = runtime.carrier.context;
          const original = runtime.carrier.store.claimReconnect.bind(
            runtime.carrier.store,
          );
          runtime.carrier.store.claimReconnect = async (...args) => {
            await mutate(f);
            return original(...args);
          };
          let requests = 0;
          runtime.carrier.client.authenticate = async () => {
            requests++;
            assert.fail("stale reconnect cannot dispatch");
          };
          try {
            context(
              f.owner.id,
              f.connection.id,
              "synthetic",
              await runtime.carrier.store.read(f.owner.id, f.connection.id),
            );
            await assert.rejects(
              runtime.carrier.lifecycle.reconnect(
                f.owner.id,
                f.connection.id,
                "synthetic",
              ),
              (e) => ["STALE", "NOT_FOUND"].includes(e.code),
            );
            assert.equal(requests, 0);
            const row = await db.carrierConnection.findUnique({
              where: { id: f.connection.id },
            });
            if (row)
              assert.equal(row.lifecycleVersion, label === "version" ? 1 : 0);
          } finally {
            await runtime.onApplicationShutdown();
            await db.syncJob.deleteMany({
              where: { owner_user_id: f.owner.id },
            });
            await db.user.delete({ where: { id: f.owner.id } });
          }
        },
      );
    await t.test(
      "API metadata and credential projections read only the requested secret type",
      async () => {
        const f = await seed(),
          store = new CarrierLifecycleAdapter(apiUrl),
          reads = [];
        const client = store.client;
        store.instance = client.$extends({
          query: {
            carrierConnection: {
              async findUniqueOrThrow({ args, query }) {
                assert.equal(
                  args.select?.secrets,
                  undefined,
                  "metadata must not hydrate secrets",
                );
                return query(args);
              },
            },
            carrierConnectionSecret: {
              async findUnique({ args, query }) {
                reads.push(args.where.connectionId_secretType.secretType);
                return query(args);
              },
            },
          },
        });
        try {
          const snapshot = await store.read(f.owner.id, f.connection.id);
          assert.deepEqual(reads.splice(0), ["ACCESS_TOKEN"]);
          await store.authorizeRecovery(f.owner.id, snapshot);
          assert.deepEqual(reads, []);
          await store.loadToken(f.owner.id, snapshot);
          assert.deepEqual(reads.splice(0), ["ACCESS_TOKEN"]);
          await store.loadRecoveryPassword(f.owner.id, snapshot);
          assert.deepEqual(reads.splice(0), ["PASSWORD"]);
          for (const status of ["ERROR", "REAUTH_REQUIRED"]) {
            await db.carrierConnection.update({
              where: { id: f.connection.id },
              data: { status },
            });
            const initial = await store.read(f.owner.id, f.connection.id);
            const claimed = await store.claimReconnect(
              f.owner.id,
              f.connection.id,
              initial,
            );
            assert.equal(claimed.version, initial.version + 1);
            assert.equal(claimed.connection.status, status);
          }
        } finally {
          await store.onApplicationShutdown();
          await db.syncJob.deleteMany({ where: { owner_user_id: f.owner.id } });
          await db.user.delete({ where: { id: f.owner.id } });
        }
      },
    );
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
