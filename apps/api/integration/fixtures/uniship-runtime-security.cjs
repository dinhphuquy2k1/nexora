const assert = require("node:assert/strict");
const { randomUUID, randomBytes, createHash } = require("node:crypto");
const {
  WorkerCarrierStore,
} = require("../../dist/carrier/infrastructure/worker-carrier-store");
const {
  CarrierCredentialVault,
} = require("../../dist/carrier/infrastructure/carrier-credential-vault");
const {
  CarrierConnectionLifecycleService,
} = require("../../dist/carrier/application/carrier-connection-lifecycle.service");
const {
  PostgresSecurityAudit,
} = require("../../dist/carrier/infrastructure/security-audit.adapter");
const { SecretCipher } = require("../../dist/common/crypto/secret-cipher");
const {
  EnvironmentKeyring,
} = require("../../dist/common/crypto/environment-keyring");
const {
  SyncRepository,
} = require("../../dist/sync/infrastructure/sync-job.repository");
const {
  SyncCapabilityRegistry,
} = require("../../dist/sync/infrastructure/sync-capability.registry");
const { loadSyncConfig } = require("../../dist/sync/domain/sync-policy");
const key = randomBytes(32).toString("base64");
const cipher = () =>
  new SecretCipher(
    new EnvironmentKeyring({
      CARRIER_KEYRING_JSON: JSON.stringify({ 1: key }),
      CARRIER_ACTIVE_KEY_VERSION: "1",
    }),
  );
const digest = (value) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
module.exports = async function verifyWorkerSecurity(t, { db, workerUrl }) {
  const resources = [];
  const registry = new SyncCapabilityRegistry([
    {
      providerName: "uniship",
      type: "SHIPMENT",
      provider: {
        strategy: () => "FULL",
        fetch: async () => assert.fail("no synthetic transport"),
      },
      domain: {
        version: 1,
        supports: () => true,
        begin: async () => assert.fail("stale job never reaches domain"),
      },
    },
  ]);
  const queue = new SyncRepository(
    workerUrl,
    loadSyncConfig({ SYNC_ENABLED: "true" }),
    registry,
    "shared",
  );
  resources.push(queue);
  async function seed() {
    const owner = await db.user.create({
      data: { username: "custody-" + randomUUID(), role: "OPERATOR" },
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
        displayName: "Synthetic custody fixture",
        status: "CONNECTED",
      },
    });
    const job = await db.syncJob.create({
      data: {
        owner_user_id: owner.id,
        carrier_connection_id: connection.id,
        provider: "uniship",
        external_account_id: connection.externalAccountId,
        sync_type: "SHIPMENT",
        trigger_source: "MANUAL",
        status: "RUNNING",
        generation: 0,
        lifecycle_version: 0,
        worker_id: randomUUID(),
        lease_version: 1,
        lease_expires_at: new Date(Date.now() + 60000),
      },
    });
    const secret = cipher();
    for (const [type, purpose, value, expiresAt] of [
      ["PASSWORD", "CARRIER_PASSWORD", "synthetic-password", null],
      ["ACCESS_TOKEN", "CARRIER_TOKEN", "synthetic-old-token", new Date(0)],
    ])
      await db.carrierConnectionSecret.create({
        data: {
          connectionId: connection.id,
          secretType: type,
          ...secret.encrypt(
            purpose,
            `${connection.id}:${owner.id}:uniship:${type}`,
            value,
          ),
          expiresAt,
        },
      });
    const store = new WorkerCarrierStore(workerUrl);
    resources.push(store);
    const before = digest(
      await db.carrierConnectionSecret.findMany({
        where: { connectionId: connection.id },
        orderBy: { secretType: "asc" },
      }),
    );
    return { owner, connection, job, store, secret, before };
  }
  function service(f, provider, c = f.secret) {
    const audit = new PostgresSecurityAudit(f.store.client);
    return new CarrierConnectionLifecycleService(
      f.store,
      new CarrierCredentialVault(f.store, c, provider, audit),
      { admit() {} },
      audit,
    );
  }
  try {
    for (const [label, mutate] of [
      [
        "wrong operation",
        async (f) =>
          db.carrierWorkerRecovery.update({
            where: { connectionId: f.connection.id },
            data: { operationToken: randomUUID() },
          }),
      ],
      [
        "wrong worker",
        async (f) =>
          db.carrierWorkerRecovery.update({
            where: { connectionId: f.connection.id },
            data: { workerId: randomUUID() },
          }),
      ],
      [
        "wrong lease",
        async (f) =>
          db.carrierWorkerRecovery.update({
            where: { connectionId: f.connection.id },
            data: { leaseVersion: 2 },
          }),
      ],
      [
        "expired proof",
        async (f) =>
          db.carrierWorkerRecovery.update({
            where: { connectionId: f.connection.id },
            data: { expiresAt: new Date(0) },
          }),
      ],
      [
        "wrong proof generation",
        async (f) =>
          db.carrierWorkerRecovery.update({
            where: { connectionId: f.connection.id },
            data: { generation: 1 },
          }),
      ],
      [
        "wrong proof version",
        async (f) =>
          db.carrierWorkerRecovery.update({
            where: { connectionId: f.connection.id },
            data: { connectionVersion: 2 },
          }),
      ],
      [
        "expired lease after claim",
        async (f) =>
          db.syncJob.update({
            where: { id: f.job.id },
            data: { lease_expires_at: new Date(0) },
          }),
      ],
      [
        "disabled after claim",
        async (f) =>
          db.user.update({
            where: { id: f.owner.id },
            data: { status: "DISABLED" },
          }),
      ],
      [
        "deleted after claim",
        async (f) =>
          db.carrierConnection.delete({ where: { id: f.connection.id } }),
      ],
      [
        "changed generation after claim",
        async (f) =>
          db.carrierUserState.update({
            where: { userId: f.owner.id },
            data: { generation: 1 },
          }),
      ],
      [
        "changed lifecycle after claim",
        async (f) =>
          db.carrierConnection.update({
            where: { id: f.connection.id },
            data: { lifecycleVersion: 2 },
          }),
      ],
      [
        "proof for another job",
        async (f) => {
          const other = await db.syncJob.create({
            data: {
              owner_user_id: f.owner.id,
              carrier_connection_id: f.connection.id,
              provider: "uniship",
              external_account_id: f.connection.externalAccountId,
              sync_type: "SHIPMENT",
              trigger_source: "MANUAL",
              status: "SUCCEEDED",
              generation: 0,
              lifecycle_version: 0,
            },
          });
          await db.carrierWorkerRecovery.update({
            where: { connectionId: f.connection.id },
            data: { jobId: other.id },
          });
        },
      ],
    ])
      await t.test(`recovery password proof rejects ${label}`, async () => {
        const f = await seed();
        try {
          await f.store.withJob(f.job, async () => {
            const claimed = await f.store.claim(f.owner.id, f.connection.id, 0);
            await f.store.authorizeRecovery(f.owner.id, claimed);
            const password = await f.store.loadRecoveryPassword(
              f.owner.id,
              claimed,
            );
            assert.equal(Object.hasOwn(password, "token"), false);
            assert.ok(password.password);
            // Ordinary lifecycle equality cannot bypass the recovery-specific proof.
            await db.syncJob.update({
              where: { id: f.job.id },
              data: { lifecycle_version: claimed.version },
            });
            await mutate(f);
            await assert.rejects(
              f.store.authorizeRecovery(f.owner.id, claimed),
              { code: "STALE" },
            );
            await assert.rejects(
              f.store.loadRecoveryPassword(f.owner.id, claimed),
              { code: "STALE" },
            );
          });
        } finally {
          await db.syncJob.deleteMany({ where: { owner_user_id: f.owner.id } });
          await db.user.delete({ where: { id: f.owner.id } });
        }
      });
    for (const change of ["generation", "successor lease"])
      await t.test(
        `post-audit ${change} change keeps committed audit but blocks password load/decrypt`,
        async () => {
          const f = await seed();
          let decrypts = 0,
            requests = 0,
            passwordLoads = 0;
          const audit = new PostgresSecurityAudit(f.store.client);
          const reader = {
            authorizeRecovery: f.store.authorizeRecovery.bind(f.store),
            loadToken: f.store.loadToken.bind(f.store),
            loadRecoveryPassword: async (...args) => {
              passwordLoads++;
              return f.store.loadRecoveryPassword(...args);
            },
          };
          const vault = new CarrierCredentialVault(
            reader,
            {
              decrypt() {
                decrypts++;
                assert.fail("stale after audit");
              },
            },
            {
              acquire: async () => {
                requests++;
                assert.fail("stale after audit");
              },
            },
            {
              append: async (event) => {
                await audit.append(event);
                if (change === "generation")
                  await db.carrierUserState.update({
                    where: { userId: f.owner.id },
                    data: { generation: 1 },
                  });
                else
                  await db.syncJob.update({
                    where: { id: f.job.id },
                    data: { worker_id: randomUUID(), lease_version: 2 },
                  });
              },
            },
          );
          try {
            await f.store.withJob(f.job, async () => {
              const snapshot = await f.store.claim(
                f.owner.id,
                f.connection.id,
                0,
              );
              await assert.rejects(
                vault.acquireStored(f.owner.id, snapshot, randomUUID()),
                { code: "STALE" },
              );
            });
            assert.equal(passwordLoads, 1);
            assert.equal(decrypts, 0);
            assert.equal(requests, 0);
            assert.equal(
              await db.securityAuditEvent.count({
                where: {
                  connectionId: f.connection.id,
                  eventType: "PASSWORD_DECRYPT",
                  outcome: "ALLOWED",
                },
              }),
              1,
            );
            assert.equal(
              digest(
                await db.carrierConnectionSecret.findMany({
                  where: { connectionId: f.connection.id },
                  orderBy: { secretType: "asc" },
                }),
              ),
              f.before,
            );
            const row = await db.syncJob.findUnique({
              where: { id: f.job.id },
            });
            assert.equal(row.status, "RUNNING");
            assert.equal(
              row.lease_version,
              change === "successor lease" ? 2 : 1,
            );
          } finally {
            await db.syncJob.deleteMany({
              where: { owner_user_id: f.owner.id },
            });
            await db.user.delete({ where: { id: f.owner.id } });
          }
        },
      );
    await t.test(
      "real Worker recovery commits audit/credentials atomically, old job cannot page/apply, new job uses recovered token",
      async () => {
        const f = await seed();
        let acquired = 0,
          operations = 0;
        const lifecycle = service(f, {
          acquire: async () => {
            acquired++;
            return {
              externalAccountId: f.connection.externalAccountId,
              token: "synthetic-recovered",
              expiresAt: null,
            };
          },
        });
        await f.store.withJob(f.job, () =>
          assert.rejects(
            lifecycle.withToken(
              f.owner.id,
              f.connection.id,
              async () => operations++,
            ),
            (e) => e.code === "STALE",
          ),
        );
        assert.equal(acquired, 1);
        assert.equal(operations, 0);
        const current = await db.carrierConnection.findUnique({
          where: { id: f.connection.id },
        });
        assert.equal(current.lifecycleVersion, 2);
        assert.equal(
          (await db.syncJob.findUnique({ where: { id: f.job.id } }))
            .lifecycle_version,
          0,
        );
        const audits = await db.securityAuditEvent.findMany({
          where: { connectionId: f.connection.id },
          select: { eventType: true, outcome: true },
        });
        assert.equal(
          audits.filter(
            (e) =>
              e.eventType === "PASSWORD_DECRYPT" && e.outcome === "ALLOWED",
          ).length,
          1,
        );
        assert.equal(
          audits.filter(
            (e) => e.eventType === "RECOVERY" && e.outcome === "SUCCESS",
          ).length,
          1,
        );
        await assert.rejects(
          queue.page(f.job, { records: [], done: true }, 1),
          (e) => e.code === "SYNC_STALE",
        );
        await assert.rejects(
          queue.apply(f.job),
          (e) => e.code === "SYNC_STALE",
        );
        await queue.cancelStale(f.job);
        assert.equal(
          (await db.syncJob.findUnique({ where: { id: f.job.id } })).status,
          "CANCELLED",
        );
        assert.equal(
          (await db.syncJob.findUnique({ where: { id: f.job.id } }))
            .reconciliationStatus,
          null,
        );
        assert.equal(
          await db.syncJobSeenPage.count({ where: { jobId: f.job.id } }),
          0,
        );
        const next = await queue.admit(
          f.owner.id,
          f.connection.id,
          "SHIPMENT",
          "MANUAL",
        );
        assert.equal(next.lifecycle_version, 2);
        assert.notEqual(next.id, f.job.id);
        const work = await queue.claim(randomUUID());
        assert.equal(work.id, next.id);
        const result = await f.store.withJob(work, () =>
          lifecycle.withToken(f.owner.id, f.connection.id, async (token) => {
            assert.ok(token === "synthetic-recovered");
            return 42;
          }),
        );
        assert.equal(result, 42);
        assert.equal(acquired, 1);
        await lifecycle.onApplicationShutdown();
      },
    );
    await t.test(
      "failed recovery terminalizes only its owned invalidated job and releases active lane",
      async () => {
        const {
          LifecycleFailure,
          LifecycleCode,
        } = require("../../dist/carrier/domain/lifecycle");
        const f = await seed(),
          lifecycle = service(f, {
            acquire: async () => {
              throw new LifecycleFailure(LifecycleCode.SERVICE_UNAVAILABLE);
            },
          });
        await f.store.withJob(f.job, () =>
          assert.rejects(
            lifecycle.withToken(f.owner.id, f.connection.id, async () =>
              assert.fail("no data fetch"),
            ),
          ),
        );
        const connection = await db.carrierConnection.findUnique({
          where: { id: f.connection.id },
        });
        assert.equal(connection.status, "ERROR");
        assert.equal(connection.lifecycleVersion, 2);
        await queue.wait(f.job, "PROVIDER_RETRY", 1000);
        assert.equal(
          (await db.syncJob.findUnique({ where: { id: f.job.id } })).status,
          "CANCELLED",
        );
        await lifecycle.onApplicationShutdown();
      },
    );
    await t.test(
      "database audit failure prevents password decrypt and authentication",
      async () => {
        const f = await seed();
        let decrypts = 0,
          acquired = 0;
        const decrypt = f.secret.decrypt.bind(f.secret);
        f.secret.decrypt = (...args) => {
          decrypts++;
          return decrypt(...args);
        };
        await db.$executeRawUnsafe(
          "CREATE FUNCTION reject_controlled_decrypt() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.event_type='PASSWORD_DECRYPT' THEN RAISE EXCEPTION 'synthetic audit failure';END IF;RETURN NEW;END $$",
        );
        await db.$executeRawUnsafe(
          "CREATE TRIGGER reject_controlled_decrypt BEFORE INSERT ON security_audit_events FOR EACH ROW EXECUTE FUNCTION reject_controlled_decrypt()",
        );
        try {
          const lifecycle = service(f, {
            acquire: async () => {
              acquired++;
              assert.fail("audit failure must prevent authentication");
            },
          });
          await f.store.withJob(f.job, () =>
            assert.rejects(
              lifecycle.withToken(f.owner.id, f.connection.id, async () =>
                assert.fail("no operation"),
              ),
              (e) => e.code === "AUDIT_UNAVAILABLE",
            ),
          );
          assert.equal(decrypts, 0);
          assert.equal(acquired, 0);
          assert.equal(
            digest(
              await db.carrierConnectionSecret.findMany({
                where: { connectionId: f.connection.id },
                orderBy: { secretType: "asc" },
              }),
            ),
            f.before,
          );
          await queue.cancelStale(f.job);
          assert.equal(
            (await db.syncJob.findUnique({ where: { id: f.job.id } })).status,
            "CANCELLED",
          );
        } finally {
          await db.$executeRawUnsafe(
            "DROP TRIGGER reject_controlled_decrypt ON security_audit_events",
          );
          await db.$executeRawUnsafe(
            "DROP FUNCTION reject_controlled_decrypt()",
          );
        }
      },
    );
    await t.test(
      "missing Carrier key fails closed without overwriting stored secrets or requiring manual reauth",
      async () => {
        const f = await seed();
        const lifecycle = service(
          f,
          { acquire: async () => assert.fail("missing key prevents login") },
          new SecretCipher(new EnvironmentKeyring({})),
        );
        await f.store.withJob(f.job, () =>
          assert.rejects(
            lifecycle.withToken(f.owner.id, f.connection.id, async () =>
              assert.fail("no operation"),
            ),
          ),
        );
        assert.equal(
          (
            await db.carrierConnection.findUnique({
              where: { id: f.connection.id },
            })
          ).status,
          "CONNECTED",
        );
        assert.equal(
          digest(
            await db.carrierConnectionSecret.findMany({
              where: { connectionId: f.connection.id },
              orderBy: { secretType: "asc" },
            }),
          ),
          f.before,
        );
      },
    );
    await t.test(
      "verified account mismatch cannot replace credentials and requires owner reconnect",
      async () => {
        const f = await seed();
        const lifecycle = service(f, {
          acquire: async () => ({
            externalAccountId: "wrong-verified-account",
            token: "synthetic",
            expiresAt: null,
          }),
        });
        await f.store.withJob(f.job, () =>
          assert.rejects(
            lifecycle.withToken(f.owner.id, f.connection.id, async () =>
              assert.fail("no data request"),
            ),
            (e) => e.code === "IDENTITY_MISMATCH",
          ),
        );
        assert.equal(
          (
            await db.carrierConnection.findUnique({
              where: { id: f.connection.id },
            })
          ).status,
          "REAUTH_REQUIRED",
        );
        assert.equal(
          digest(
            await db.carrierConnectionSecret.findMany({
              where: { connectionId: f.connection.id },
              orderBy: { secretType: "asc" },
            }),
          ),
          f.before,
        );
      },
    );
    await t.test(
      "manual reconnect during Worker recovery wins CAS and cannot be overwritten by late acquisition",
      async () => {
        const f = await seed();
        let manuallyStored;
        const lifecycle = service(f, {
          acquire: async () => {
            const replacement = f.secret.encrypt(
              "CARRIER_TOKEN",
              `${f.connection.id}:${f.owner.id}:uniship:ACCESS_TOKEN`,
              "synthetic-manual-token",
            );
            await db.$transaction(async (tx) => {
              await tx.carrierConnection.update({
                where: { id: f.connection.id },
                data: { lifecycleVersion: { increment: 1 } },
              });
              await tx.carrierConnectionSecret.update({
                where: {
                  connectionId_secretType: {
                    connectionId: f.connection.id,
                    secretType: "ACCESS_TOKEN",
                  },
                },
                data: replacement,
              });
            });
            manuallyStored = digest(
              await db.carrierConnectionSecret.findMany({
                where: { connectionId: f.connection.id },
                orderBy: { secretType: "asc" },
              }),
            );
            return {
              externalAccountId: f.connection.externalAccountId,
              token: "synthetic-late-worker",
              expiresAt: null,
            };
          },
        });
        await f.store.withJob(f.job, () =>
          assert.rejects(
            lifecycle.withToken(f.owner.id, f.connection.id, async () =>
              assert.fail("no data request"),
            ),
            (e) => e.code === "STALE",
          ),
        );
        assert.equal(
          digest(
            await db.carrierConnectionSecret.findMany({
              where: { connectionId: f.connection.id },
              orderBy: { secretType: "asc" },
            }),
          ),
          manuallyStored,
        );
      },
    );
    for (const [label, mutate] of [
      [
        "disabled owner",
        async (f) =>
          db.user.update({
            where: { id: f.owner.id },
            data: { status: "DISABLED" },
          }),
      ],
      [
        "revoked generation",
        async (f) =>
          db.carrierUserState.update({
            where: { userId: f.owner.id },
            data: { generation: { increment: 1 } },
          }),
      ],
      [
        "deleted connection",
        async (f) =>
          db.carrierConnection.delete({ where: { id: f.connection.id } }),
      ],
      [
        "wrong job provider",
        async (f) =>
          db.syncJob.update({
            where: { id: f.job.id },
            data: { provider: "fixture-other" },
          }),
      ],
      [
        "expired job lease",
        async (f) =>
          db.syncJob.update({
            where: { id: f.job.id },
            data: { lease_expires_at: new Date(0) },
          }),
      ],
    ])
      await t.test(
        `scoped credential load fails closed for ${label}`,
        async () => {
          const f = await seed(),
            snapshot = await f.store.withJob(f.job, () =>
              f.store.read(f.owner.id, f.connection.id),
            );
          await mutate(f);
          await f.store.withJob(f.job, () =>
            assert.rejects(
              f.store.loadRecoveryPassword(f.owner.id, snapshot),
              (e) => e.code === "STALE",
            ),
          );
        },
      );
    await t.test(
      "stale Worker cannot read credentials or cancel the successor lease",
      async () => {
        const f = await seed();
        const snapshot = await f.store.withJob(f.job, () =>
          f.store.read(f.owner.id, f.connection.id),
        );
        const successor = randomUUID();
        await db.syncJob.update({
          where: { id: f.job.id },
          data: { worker_id: successor, lease_version: 2 },
        });
        await db.carrierConnection.update({
          where: { id: f.connection.id },
          data: { lifecycleVersion: 1 },
        });
        await f.store.withJob(f.job, () =>
          assert.rejects(
            f.store.loadRecoveryPassword(f.owner.id, snapshot),
            (e) => e.code === "STALE",
          ),
        );
        await queue.cancelStale(f.job);
        let row = await db.syncJob.findUnique({ where: { id: f.job.id } });
        assert.equal(row.status, "RUNNING");
        assert.equal(row.worker_id, successor);
        assert.equal(row.lease_version, 2);
        await queue.cancelStale({
          ...f.job,
          worker_id: successor,
          lease_version: 2,
        });
        row = await db.syncJob.findUnique({ where: { id: f.job.id } });
        assert.equal(row.status, "CANCELLED");
      },
    );
  } finally {
    for (const value of resources.reverse())
      await (value.close?.() ?? value.onApplicationShutdown());
  }
};
