require("reflect-metadata");
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { execFileSync } = require("node:child_process");
const { resolve } = require("node:path");
const { readFile } = require("node:fs/promises");
const { createDatabase } = require("@nexora/database");
const {
  SyncRepository,
} = require("../dist/sync/infrastructure/sync-job.repository");
const {
  SyncCapabilityRegistry,
} = require("../dist/sync/infrastructure/sync-capability.registry");
const {
  loadSyncConfig,
  sourceKey,
} = require("../dist/sync/domain/sync-policy");
const {
  ShipmentSyncProcessor,
} = require("../dist/shipment/application/shipment-sync.processor");
const {
  createShipmentSyncBinding,
} = require("../dist/shipment/infrastructure/shipment-sync-domain.binding");
const { LogisticsStage: S } = require("@nexora/shared/shipment");

test(
  "Uniship adapter genuine PostgreSQL source/stage/child/fence contracts",
  { timeout: 180000 },
  async (t) => {
    assert.ok(process.env.DATABASE_URL, "genuine PostgreSQL required");
    const admin = createDatabase(process.env.DATABASE_URL);
    const name = "nexora_uniship_" + randomUUID().replaceAll("-", "");
    const url = new URL(process.env.DATABASE_URL);
    url.pathname = "/" + name;
    let db,
      owned = false;
    const repos = [];
    try {
      await admin.$executeRawUnsafe(`CREATE DATABASE "${name}"`);
      owned = true;
      execFileSync(
        process.execPath,
        [
          resolve("../../packages/database/node_modules/prisma/build/cli.js"),
          "migrate",
          "deploy",
          "--config",
          resolve("../../packages/database/prisma.config.ts"),
        ],
        {
          env: { ...process.env, DATABASE_URL: url.toString() },
          stdio: "pipe",
          timeout: 60000,
        },
      );
      db = createDatabase(url.toString());
      let workerUrl = url.toString();
      if (process.env.DISPOSABLE_CLUSTER_TOKEN) {
        assert.equal(
          process.env.DATABASE_URL,
          process.env.DISPOSABLE_CLUSTER_ADMIN_URL,
        );
        const marker = await admin.$queryRawUnsafe(
          "SELECT description FROM pg_shdescription JOIN pg_database ON objoid=pg_database.oid WHERE datname=current_database()",
        );
        assert.equal(
          marker[0]?.description,
          process.env.DISPOSABLE_CLUSTER_TOKEN,
        );
        const { provisionRuntime, runtimeUrl } = await import(
          "../../../packages/database/scripts/provision-runtime.mjs"
        );
        const password = (
          await readFile(process.env.API_TEST_RUNTIME_PASSWORD_FILE, "utf8")
        ).trim();
        await provisionRuntime(url.toString(), password, {
          role: "nexora_sync",
        });
        workerUrl = runtimeUrl(url.toString(), password, "nexora_sync");
        const worker = createDatabase(workerUrl);
        try {
          assert.equal(
            (await worker.$queryRawUnsafe("SELECT current_user"))[0]
              .current_user,
            "nexora_sync",
          );
        } finally {
          await worker.$disconnect();
        }
      }
      const owner = await db.user.create({
        data: { username: "uniship-" + randomUUID(), role: "OPERATOR" },
      });
      const connection = await db.carrierConnection.create({
        data: {
          userId: owner.id,
          provider: "uniship",
          externalAccountId: "synthetic-" + randomUUID(),
          displayName: "Uniship isolated fixture",
          status: "CONNECTED",
        },
      });
      const noFetch = {
        strategy: () => "FULL",
        fetch: async () => {
          throw Error("fixture-only direct staging");
        },
      };
      const repo = (processor, provider = noFetch) => {
        const r = new SyncRepository(
          workerUrl,
          loadSyncConfig({ SYNC_ENABLED: "true" }),
          new SyncCapabilityRegistry([
            {
              providerName: "uniship",
              type: "SHIPMENT",
              provider,
              domain: createShipmentSyncBinding(processor),
            },
          ]),
          "shared",
        );
        repos.push(r);
        return r;
      };
      const prepare = async (r, records) => {
        const j = await r.admit(owner.id, connection.id, "SHIPMENT", "MANUAL");
        const work = await r.claim(randomUUID());
        assert.equal(work.id, j.id);
        await r.page(
          work,
          { records, done: true },
          r.capabilities.resolve("uniship", "SHIPMENT").processor.version,
        );
        return j;
      };
      const finish = async (r, j, actor = owner, link = connection) => {
        for (let i = 0; i < 10; i++) {
          const state = await r.job(actor.id, link.id, j.id);
          if (["SUCCEEDED", "FAILED", "CANCELLED"].includes(state.status))
            return state;
          const work = await r.claim(randomUUID());
          assert.ok(work);
          await r.apply(work);
        }
        throw Error("fixture did not settle");
      };
      const run = async (r, records) => finish(r, await prepare(r, records));
      const records = (payload, key = "stage-context") => [
        { identity: sourceKey("uniship-parcel-v1", [key]), payload },
      ];
      await t.test(
        "locked session exposes immutable previous physical stage for reprocessing",
        async () => {
          const payload = {
            trackingCode: "stage-context",
            providerStatus: "5",
          };
          const seed = repo(new ShipmentSyncProcessor(1, { 5: S.DELIVERED }));
          assert.equal((await run(seed, records(payload))).status, "SUCCEEDED");
          let calls = 0;
          const generic = new ShipmentSyncProcessor(2, { 5: S.DELIVERED });
          const probe = repo({
            version: 2,
            supports: () => true,
            apply: async (source, session) => {
              calls++;
              assert.equal(Object.isFrozen(session), true);
              assert.equal(session.existingLogisticsStage, S.DELIVERED);
              assert.equal(
                Object.getOwnPropertyDescriptor(
                  session,
                  "existingLogisticsStage",
                ).writable,
                false,
              );
              return generic.apply(source, session);
            },
          });
          assert.equal(
            (await run(probe, records(payload))).status,
            "SUCCEEDED",
          );
          assert.equal(calls, 1);
        },
      );
      await t.test(
        "mock HTTP and real encrypted Carrier lifecycle feed fenced Shipment persistence",
        async (sub) => {
          const http = require("node:http");
          const { randomBytes } = require("node:crypto");
          const {
            captured,
            stores,
            row,
            page,
          } = require("../test/helpers/uniship-fixture.cjs");
          const {
            UnishipShipmentProvider,
          } = require("../dist/shipment/infrastructure/uniship/uniship-shipment.provider");
          const {
            UnishipShipmentProcessor,
          } = require("../dist/shipment/infrastructure/uniship/uniship-shipment.processor");
          const {
            UnishipHttpClient,
          } = require("../dist/carrier/infrastructure/uniship/uniship-http.client");
          const {
            UnishipAdapter,
          } = require("../dist/carrier/infrastructure/uniship/uniship-adapter");
          const {
            CarrierLifecycleAdapter,
          } = require("../dist/carrier/infrastructure/carrier-lifecycle.adapter");
          const {
            CarrierConnectionLifecycleService,
          } = require("../dist/carrier/application/carrier-connection-lifecycle.service");
          const {
            CarrierCredentialVault,
          } = require("../dist/carrier/infrastructure/carrier-credential-vault");
          const {
            PostgresSecurityAudit,
          } = require("../dist/carrier/infrastructure/security-audit.adapter");
          const {
            UserCarrierAdmission,
          } = require("../dist/carrier/infrastructure/uniship/provider-budget");
          const {
            SecretCipher,
          } = require("../dist/common/crypto/secret-cipher");
          const { provisionRuntime, runtimeUrl } = await import(
            "../../../packages/database/scripts/provision-runtime.mjs"
          );
          const password = (
            await readFile(
              process.env.API_TEST_RUNTIME_PASSWORD_FILE ??
                "/runtime-config/postgres_app_password",
              "utf8",
            )
          ).trim();
          await provisionRuntime(url.toString(), password);
          const store = new CarrierLifecycleAdapter(
            runtimeUrl(url.toString(), password),
          );
          const tokens = new Map(),
            warnings = [],
            requests = [];
          let rawPage = page([row()]),
            rejectOnce = false,
            failSecond = false,
            serial = 0;
          const server = http.createServer(async (req, res) => {
            const u = new URL(req.url, "http://fixture");
            res.setHeader("content-type", "application/json");
            if (req.method === "POST") {
              let text = "";
              for await (const chunk of req) text += chunk;
              const body = JSON.parse(text);
              if (u.pathname === "/client/api-token-auth/") {
                const token = "synthetic-uniship-private-" + ++serial;
                tokens.set(token, body.username);
                return res.end(
                  JSON.stringify({ token, user: { userid: body.username } }),
                );
              }
              assert.equal(u.pathname, "/client/api-token-verify/");
              return res.end(
                JSON.stringify({
                  token: body.token,
                  user: { userid: tokens.get(body.token) },
                }),
              );
            }
            assert.equal(req.method, "GET");
            assert.ok(tokens.has(req.headers.authorization?.slice(7)));
            requests.push([u.pathname, u.searchParams.get("page")]);
            if (rejectOnce) {
              rejectOnce = false;
              res.writeHead(401);
              return res.end();
            }
            if (u.pathname === "/client/api/chinaStores/")
              return res.end(stores);
            assert.equal(u.pathname, "/client/api/transition/");
            if (failSecond && u.searchParams.get("page") === "2") {
              res.writeHead(503);
              return res.end();
            }
            return res.end(
              typeof rawPage === "function"
                ? rawPage(Number(u.searchParams.get("page")))
                : rawPage,
            );
          });
          await new Promise((r) => server.listen(0, "127.0.0.1", r));
          try {
            const client = new UnishipHttpClient({
              apiUrl: `http://127.0.0.1:${server.address().port}`,
            });
            const key = randomBytes(32),
              cipher = new SecretCipher({
                activeVersion: () => 1,
                key: () => key,
              });
            const audit = new PostgresSecurityAudit(store.client);
            const lifecycle = new CarrierConnectionLifecycleService(
              store,
              new CarrierCredentialVault(
                store,
                cipher,
                new UnishipAdapter(client),
                audit,
              ),
              new UserCarrierAdmission(),
              audit,
            );
            const actor = await db.user.create({
              data: {
                username: "uniship-http-" + randomUUID(),
                role: "OPERATOR",
              },
            });
            const link = await lifecycle.connect(actor.id, {
              loginIdentifier: "700001",
              password: "SyntheticProviderPassword!",
              displayName: "Fixture-backed read",
            });
            const provider = new UnishipShipmentProvider(
              client,
              lifecycle,
              store,
              (c) => warnings.push(c),
            );
            const processor = new UnishipShipmentProcessor(1, (c) =>
                warnings.push(c),
              ),
              r = repo(processor, provider);
            const admitted = async () => {
              const j = await r.admit(actor.id, link.id, "SHIPMENT", "MANUAL");
              const work = await r.claim(randomUUID());
              assert.equal(work.id, j.id);
              return { j, work };
            };
            const fetchPage = async (work) =>
              provider.fetch(work, new globalThis.AbortController().signal);
            const ingest = async () => {
              const { j, work } = await admitted();
              await r.page(work, await fetchPage(work), 1);
              return finish(r, j, actor, link);
            };
            sub.afterEach(async () => {
              rawPage = page([row()]);
              failSecond = false;
              rejectOnce = false;
              await db.syncJob.updateMany({
                where: {
                  owner_user_id: actor.id,
                  carrier_connection_id: link.id,
                  status: { in: ["QUEUED", "RUNNING", "WAITING"] },
                },
                data: {
                  status: "CANCELLED",
                  worker_id: null,
                  lease_expires_at: null,
                },
              });
            });
            const getRoot = (ID = 100001) =>
              db.shipment.findFirstOrThrow({
                where: {
                  ownerUserId: actor.id,
                  source: { source_key: JSON.stringify([String(ID)]) },
                },
                include: {
                  history: { orderBy: { observedAt: "asc" } },
                  services: true,
                  charges: true,
                  milestones: true,
                  items: true,
                },
              });
            const jobCancel = async (j) =>
              db.$executeRaw`UPDATE sync_jobs SET status='CANCELLED',worker_id=NULL,lease_expires_at=NULL WHERE id=${j.id}::uuid`;
            const childVersions = async (id) => {
              const result = {};
              for (const table of [
                "shipment_services",
                "shipment_charges",
                "shipment_items",
                "shipment_milestones",
              ])
                result[table] = await db.$queryRawUnsafe(
                  `SELECT *,xmin::text AS version FROM ${table} WHERE shipment_id=$1::uuid ORDER BY id`,
                  id,
                );
              return result;
            };
            await sub.test(
              "first/identical/changed ingestion, exact identity and hash/source versions",
              async () => {
                assert.equal((await ingest()).status, "SUCCEEDED");
                const root = await getRoot();
                assert.equal(root.logisticsStage, S.TO_ORIGIN_WAREHOUSE);
                assert.equal(root.history.length, 1);
                assert.equal(root.customerId, null);
                const identity = await db.syncSourceIdentity.findUniqueOrThrow({
                  where: { id: root.sourceIdentityId },
                });
                assert.equal(identity.source_key_scheme, "uniship-parcel-v1");
                assert.equal(identity.observed_source_version, 1);
                assert.equal((await ingest()).unchanged_count, 1);
                assert.equal(
                  (await getRoot()).updatedAt.getTime(),
                  root.updatedAt.getTime(),
                );
                rawPage = page([
                  row({
                    FeeOther: 999999,
                    ShippingInfo: "unverified provider text",
                  }),
                ]);
                assert.equal(
                  (await ingest()).unchanged_count,
                  1,
                  "unverified fields do not alter normalized payload hash",
                );
                rawPage = page([
                  row({ TransactionCode: "changed-tracking", Status: 5 }),
                ]);
                await ingest();
                const changed = await getRoot();
                assert.equal(changed.id, root.id);
                assert.equal(changed.trackingCode, "changed-tracking");
                assert.equal(changed.history.length, 2);
                assert.equal(
                  (
                    await db.syncSourceIdentity.findUniqueOrThrow({
                      where: { id: root.sourceIdentityId },
                    })
                  ).observed_source_version,
                  2,
                );
                const sealed = await db.carrierConnectionSecret.findMany({
                  where: { connectionId: link.id },
                });
                assert.equal(
                  JSON.stringify(sealed).includes("SyntheticProviderPassword!"),
                  false,
                );
                assert.equal(
                  JSON.stringify(sealed).includes("synthetic-uniship-private"),
                  false,
                );
                assert.equal(
                  JSON.stringify(
                    await db.providerSourceRecord.findMany({
                      where: { identity: { owner_user_id: actor.id } },
                    }),
                  ).includes("redacted-user"),
                  false,
                );
                assert.equal(captured.includes('"rowsPerPage": 15'), true);
              },
            );
            await sub.test(
              "synthetic claim fallback and return preserve stage/history without claiming lifecycle capture",
              async () => {
                for (const [Status, OldStatus, expected, history] of [
                  [13, null, S.DELIVERED, 2],
                  [13, 99, S.DELIVERED, 2],
                  [13, 4, S.AT_DEST_WAREHOUSE, 3],
                  [13, null, S.AT_DEST_WAREHOUSE, 3],
                  [4, null, S.AT_DEST_WAREHOUSE, 3],
                  [99, null, S.UNKNOWN, 4],
                ]) {
                  rawPage = page([row({ Status, OldStatus })]);
                  await ingest();
                  const root = await getRoot();
                  assert.equal(root.logisticsStage, expected);
                  assert.equal(
                    root.providerClaimStatus,
                    Status === 13 ? "13" : null,
                  );
                  assert.equal(root.history.length, history);
                }
                rawPage = page([
                  row({ ID: 100002, Status: 13, OldStatus: null }),
                ]);
                await ingest();
                const root = await getRoot(100002);
                assert.equal(root.logisticsStage, S.UNKNOWN);
                assert.equal(root.providerClaimStatus, "13");
                assert.equal(root.history.length, 1);
                assert.ok(warnings.includes("UNISHIP_STATUS_UNKNOWN"));
              },
            );
            await sub.test(
              "authoritative true/false/empty children reconcile; incomplete wire collections preserve IDs/xmin",
              async () => {
                const root = await getRoot(),
                  normalized = (
                    await (async () => {
                      rawPage = page([row()]);
                      const { j, work } = await admitted();
                      const p = await fetchPage(work);
                      await jobCancel(j);
                      return p;
                    })()
                  ).records[0];
                const shipment = {
                  ...normalized.payload.shipment,
                  services: {
                    complete: true,
                    entries: [
                      { serviceCode: "INSURANCE", enabled: false },
                      { serviceCode: "FOAM", enabled: true },
                    ],
                  },
                  charges: {
                    complete: true,
                    lines: [
                      {
                        chargeCode: "WOOD_PACKING",
                        amount: "1.00",
                        currency: "CNY",
                      },
                    ],
                  },
                  items: {
                    complete: true,
                    lines: [
                      {
                        name: "known-item",
                        quantity: 2,
                        unitValue: "1.23",
                        currency: "CNY",
                      },
                    ],
                  },
                  milestones: {
                    complete: true,
                    entries: [
                      {
                        milestoneCode: "DEST_RECEIVED",
                        occurredAt: "2026-11-16T00:00:00Z",
                        locationName: "synthetic",
                      },
                    ],
                  },
                };
                const authoritative = async (input) => {
                  const { j, work } = await admitted();
                  await r.page(
                    work,
                    {
                      records: [
                        {
                          ...normalized,
                          payload: { shipment: input, oldStatus: null },
                        },
                      ],
                      done: true,
                      scan: {
                        ...provider.fullScan,
                        pageNumber: work.next_page,
                        reportedTotal: 1,
                      },
                    },
                    1,
                  );
                  return finish(r, j, actor, link);
                };
                await authoritative(shipment);
                const before = await childVersions(root.id);
                assert.equal(
                  before.shipment_services.find(
                    (v) => v.service_code === "INSURANCE",
                  ).enabled,
                  false,
                );
                for (const flags of [
                  { IsGuarantee: null },
                  { IsGuarantee: null, IsCheck: null },
                  {
                    IsGuarantee: null,
                    IsCheck: null,
                    IsFragileGoods: null,
                    IsFoam: null,
                    FeeShip: 99,
                  },
                ]) {
                  rawPage = page([
                    row({
                      ...flags,
                      ProductName: null,
                      StoreVNImportDate: null,
                    }),
                  ]);
                  await ingest();
                  assert.deepEqual(await childVersions(root.id), before);
                }
                await authoritative({
                  ...shipment,
                  services: {
                    complete: true,
                    entries: [{ serviceCode: "INSURANCE", enabled: true }],
                  },
                });
                assert.deepEqual(
                  (await getRoot()).services.map((v) => [
                    v.serviceCode,
                    v.enabled,
                  ]),
                  [["INSURANCE", true]],
                );
                await authoritative({
                  ...normalized.payload.shipment,
                  services: { complete: true, entries: [] },
                  charges: { complete: true, lines: [] },
                  items: { complete: true, lines: [] },
                  milestones: { complete: true, entries: [] },
                });
                for (const values of Object.values(
                  await childVersions(root.id),
                ))
                  assert.equal(values.length, 0);
                rawPage = page([
                  row({ GuaranteeAmount: 999, ProductName: null }),
                ]);
                await ingest();
                for (const values of Object.values(
                  await childVersions(root.id),
                ))
                  assert.equal(values.length, 0);
              },
            );
            await sub.test(
              "deterministic invalid record rejects with valid sibling; malformed page never advances checkpoint",
              async () => {
                rawPage = page([
                  row({ ID: 100003, TransactionCode: null }),
                  row({ ID: 100004 }),
                ]);
                const state = await ingest();
                assert.equal(state.rejected_count, 1);
                assert.equal(state.applied_count, 1);
                assert.equal(
                  await db.shipment.count({
                    where: {
                      ownerUserId: actor.id,
                      source: {
                        source_key: JSON.stringify(["100003"]),
                      },
                    },
                  }),
                  0,
                );
                rawPage = "{}";
                const { j, work } = await admitted();
                await assert.rejects(
                  fetchPage(work),
                  (e) => e.code === "SOURCE_INVALID",
                );
                assert.equal(
                  (await r.job(actor.id, link.id, j.id)).next_page,
                  1,
                );
                assert.equal(
                  await db.syncJobItem.count({ where: { job_id: j.id } }),
                  0,
                );
                await jobCancel(j);
              },
            );
            await sub.test(
              "real second-page retry retains checkpoint then completes101 identities",
              async () => {
                const first = Array.from({ length: 100 }, (_, i) =>
                  row({ ID: 200000 + i }),
                );
                rawPage = (n) =>
                  n === 1
                    ? page(first, { total: 101 })
                    : page([row({ ID: 200100 })], { total: 101, offset: 100 });
                const { j, work } = await admitted();
                await r.page(work, await fetchPage(work), 1);
                let next = await r.claim(randomUUID());
                assert.equal(next.next_page, 2);
                failSecond = true;
                await assert.rejects(
                  fetchPage(next),
                  (e) => e.code === "PROVIDER_RETRY",
                );
                await r.wait(next, "PROVIDER_RETRY", 1);
                const waiting = await r.job(actor.id, link.id, j.id);
                assert.equal(waiting.next_page, 2);
                assert.equal(waiting.status, "WAITING");
                failSecond = false;
                await db.$executeRaw`UPDATE sync_jobs SET available_at=clock_timestamp()-interval '1 second' WHERE id=${j.id}::uuid`;
                next = await r.claim(randomUUID());
                assert.equal(next.next_page, 2);
                await r.page(next, await fetchPage(next), 1);
                assert.equal(
                  (await finish(r, j, actor, link)).status,
                  "SUCCEEDED",
                );
                assert.equal(
                  await db.shipment.count({
                    where: {
                      ownerUserId: actor.id,
                      trackingCode: "synthetic-uniship",
                      source: {
                        source_key: {
                          in: first.map((x) => JSON.stringify([String(x.ID)])),
                        },
                      },
                    },
                  }),
                  100,
                );
                assert.ok(
                  requests.filter(
                    ([path, p]) =>
                      path === "/client/api/transition/" && p === "2",
                  ).length >= 2,
                );
                // The provider has no snapshot isolation: a cross-page repeat uses
                // the existing source identity, never another Shipment or a seen cache.
                rawPage = (n) =>
                  n === 1
                    ? page(first, { total: 101 })
                    : page([first[0]], { total: 101, offset: 100 });
                const repeated = await admitted();
                await r.page(repeated.work, await fetchPage(repeated.work), 1);
                const repeatedSecond = await r.claim(randomUUID());
                await r.page(
                  repeatedSecond,
                  await fetchPage(repeatedSecond),
                  1,
                );
                assert.equal(
                  (await finish(r, repeated.j, actor, link)).status,
                  "SUCCEEDED",
                );
                const scan = await db.syncJob.findUniqueOrThrow({
                  where: { id: repeated.j.id },
                });
                assert.equal(scan.scanIntegrityStatus, "UNTRUSTED");
                assert.equal(scan.scanIntegrityReason, "DUPLICATE_IDENTITY");
                assert.equal(scan.scanObservedCount, 100);
                assert.equal(
                  await db.syncJobSeenPage.count({
                    where: { jobId: repeated.j.id },
                  }),
                  0,
                );
                assert.equal(
                  await db.syncSourceIdentity.count({
                    where: {
                      owner_user_id: actor.id,
                      external_account_id: link.externalAccountId,
                      source_key: JSON.stringify(["200000"]),
                    },
                  }),
                  1,
                );
                assert.equal(
                  await db.shipment.count({
                    where: {
                      ownerUserId: actor.id,
                      source: { source_key: JSON.stringify(["200000"]) },
                    },
                  }),
                  1,
                );
                rawPage = page([row()]);
              },
            );
            await sub.test(
              "SQL failure rolls back root/history and all child proposals without source rejection",
              async () => {
                const before = await getRoot();
                const normalized = (
                  await (async () => {
                    const { j, work } = await admitted();
                    const p = await fetchPage(work);
                    await jobCancel(j);
                    return p;
                  })()
                ).records[0];
                await db.$executeRawUnsafe(
                  "CREATE FUNCTION uniship_rollback() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic uniship rollback'; END $$",
                );
                await db.$executeRawUnsafe(
                  "CREATE TRIGGER uniship_rollback BEFORE UPDATE ON shipments FOR EACH ROW WHEN (NEW.tracking_code='rollback') EXECUTE FUNCTION uniship_rollback()",
                );
                let j;
                try {
                  const prepared = await admitted();
                  j = prepared.j;
                  await r.page(
                    prepared.work,
                    {
                      records: [
                        {
                          ...normalized,
                          payload: {
                            shipment: {
                              ...normalized.payload.shipment,
                              trackingCode: "rollback",
                              services: {
                                complete: true,
                                entries: [
                                  { serviceCode: "FOAM", enabled: true },
                                ],
                              },
                              items: {
                                complete: true,
                                lines: [{ name: "must-not-commit" }],
                              },
                            },
                            oldStatus: null,
                          },
                        },
                      ],
                      done: true,
                      scan: {
                        ...provider.fullScan,
                        pageNumber: prepared.work.next_page,
                        reportedTotal: 1,
                      },
                    },
                    1,
                  );
                  const applying = await r.claim(randomUUID());
                  await assert.rejects(
                    r.apply(applying),
                    (e) =>
                      /Code: `P0001`/.test(e.message) &&
                      /synthetic uniship rollback/.test(e.message),
                  );
                  assert.deepEqual(await getRoot(), before);
                  assert.equal(
                    (
                      await db.syncJobItem.findFirstOrThrow({
                        where: { job_id: j.id },
                      })
                    ).processing_outcome,
                    "PENDING",
                  );
                  assert.equal(
                    (await r.job(actor.id, link.id, j.id)).rejected_count,
                    0,
                  );
                } finally {
                  await db.$executeRawUnsafe(
                    "DROP TRIGGER uniship_rollback ON shipments",
                  );
                  await db.$executeRawUnsafe(
                    "DROP FUNCTION uniship_rollback()",
                  );
                  if (j) await jobCancel(j);
                }
              },
            );
            await sub.test(
              "actual owner/account, generation, cancellation, lease and processor-version fences reject stale work",
              async () => {
                rawPage = page([row({ ID: 990000 })]);
                const other = await db.user.create({
                  data: {
                    username: "uni-" + randomUUID(),
                    role: "OPERATOR",
                  },
                });
                let { j, work } = await admitted();
                const calls = requests.length;
                await assert.rejects(
                  provider.fetch(
                    { ...work, owner_user_id: other.id },
                    new globalThis.AbortController().signal,
                  ),
                  (e) => e.code === "SYNC_UNAVAILABLE",
                );
                assert.equal(requests.length, calls);
                await assert.rejects(
                  provider.fetch(
                    { ...work, external_account_id: "foreign" },
                    new globalThis.AbortController().signal,
                  ),
                  (e) => e.code === "SYNC_STALE",
                );
                assert.equal(requests.length, calls);
                const p = await fetchPage(work);
                await jobCancel(j);
                await assert.rejects(
                  r.page(work, p, 1),
                  (e) => e.code === "SYNC_STALE",
                );
                ({ j, work } = await admitted());
                const p2 = await fetchPage(work);
                await db.$executeRaw`UPDATE sync_jobs SET lease_expires_at=clock_timestamp()-interval '1 second' WHERE id=${j.id}::uuid`;
                await assert.rejects(
                  r.page(work, p2, 1),
                  (e) => e.code === "SYNC_STALE",
                );
                await jobCancel(j);
                ({ j, work } = await admitted());
                const p3 = await fetchPage(work);
                await db.$executeRaw`UPDATE carrier_user_states SET generation=generation+1 WHERE user_id=${actor.id}::uuid`;
                await assert.rejects(
                  r.page(work, p3, 1),
                  (e) => e.code === "SYNC_STALE",
                );
                await jobCancel(j);
                ({ j, work } = await admitted());
                await r.page(work, await fetchPage(work), 2);
                const applying = await r.claim(randomUUID());
                await assert.rejects(
                  r.apply(applying),
                  (e) => e.code === "PROCESSOR_UNAVAILABLE",
                );
                await jobCancel(j);
                assert.equal(
                  await db.shipment.count({ where: { ownerUserId: other.id } }),
                  0,
                );
              },
            );
            await sub.test(
              "real token rejection uses audited recovery and invalidates old lifecycle job",
              async () => {
                const before = await db.securityAuditEvent.count({
                  where: {
                    connectionId: link.id,
                    eventType: "PASSWORD_DECRYPT",
                  },
                });
                const { j, work } = await admitted();
                rejectOnce = true;
                const p = await fetchPage(work);
                await assert.rejects(
                  r.page(work, p, 1),
                  (e) => e.code === "SYNC_STALE",
                );
                await jobCancel(j);
                assert.equal(
                  await db.securityAuditEvent.count({
                    where: {
                      connectionId: link.id,
                      eventType: "PASSWORD_DECRYPT",
                    },
                  }),
                  before + 1,
                );
                assert.equal((await ingest()).status, "SUCCEEDED");
              },
            );
            await sub.test(
              "same provider ID remains distinct across actual owner/account credentials",
              async () => {
                const other = await db.user.create({
                  data: { username: "scope-" + randomUUID(), role: "OPERATOR" },
                });
                const otherLink = await lifecycle.connect(other.id, {
                  loginIdentifier: "700002",
                  password: "SyntheticProviderPassword!",
                  displayName: "Independent fixture account",
                });
                const second = repo(
                  new UnishipShipmentProcessor(1, (c) => warnings.push(c)),
                  provider,
                );
                const j = await second.admit(
                  other.id,
                  otherLink.id,
                  "SHIPMENT",
                  "MANUAL",
                );
                const work = await second.claim(randomUUID());
                assert.equal(work.id, j.id);
                await second.page(work, await fetchPage(work), 1);
                assert.equal(
                  (await finish(second, j, other, otherLink)).status,
                  "SUCCEEDED",
                );
                const copied = await db.shipment.findFirstOrThrow({
                  where: { ownerUserId: other.id },
                });
                const original = await getRoot();
                assert.notEqual(copied.id, original.id);
                assert.notEqual(
                  copied.sourceIdentityId,
                  original.sourceIdentityId,
                );
                assert.equal(copied.trackingCode, "synthetic-uniship");
                assert.equal(copied.carrierConnectionId, otherLink.id);
                assert.equal(original.carrierConnectionId, link.id);
              },
            );
            assert.ok(
              warnings.every((c) =>
                [
                  "UNISHIP_STATUS_UNKNOWN",
                  "UNISHIP_REQUIRED_FIELD_MISSING",
                  "UNISHIP_FIELD_TYPE_CHANGED",
                  "UNISHIP_ENVELOPE_INVALID",
                ].includes(c),
              ),
            );
          } finally {
            server.closeAllConnections();
            await new Promise((resolve) => server.close(resolve));
            await store.client.$disconnect();
          }
        },
      );
    } finally {
      for (const r of repos) await r.close();
      await db?.$disconnect();
      if (owned)
        await admin.$executeRawUnsafe(`DROP DATABASE "${name}" WITH (FORCE)`);
      await admin.$disconnect();
    }
  },
);
