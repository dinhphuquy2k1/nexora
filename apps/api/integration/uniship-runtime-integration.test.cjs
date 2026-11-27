const { clearTimeout } = require("node:timers");
const { AbortController, URLSearchParams, performance } = globalThis;
require("reflect-metadata");
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { createServer } = require("node:http");
const { execFileSync } = require("node:child_process");
const { resolve } = require("node:path");
const { readFile } = require("node:fs/promises");
const { createDatabase } = require("@nexora/database");
test(
  "Controlled Uniship runtime scoped persistence and real HTTP contracts",
  { timeout: 180000 },
  async (t) => {
    const admin = createDatabase(process.env.DATABASE_URL),
      name = "nexora_controlled_" + randomUUID().replaceAll("-", "");
    const url = new URL(process.env.DATABASE_URL);
    url.pathname = "/" + name;
    let db, worker;
    let owned = false;
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
      await t.test(
        "forward migration installs fixed private scoped credential functions",
        async () => {
          const rows = await db.$queryRawUnsafe(
            "SELECT to_regprocedure('public.sync_carrier_snapshot(uuid,uuid,integer,uuid)')::text AS capability",
          );
          assert.ok(rows[0].capability);
        },
      );
      if (!process.env.DISPOSABLE_CLUSTER_TOKEN) {
        t.diagnostic(
          "Controlled restricted-role verification NOT RUN: unsigned cluster; canonical signed shipment-worker suite required",
        );
        return;
      }
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
      await provisionRuntime(url.toString(), password);
      const apiUrlForTest = runtimeUrl(url.toString(), password);
      await provisionRuntime(url.toString(), password, { role: "nexora_sync" });
      const workerUrlForTest = runtimeUrl(
        url.toString(),
        password,
        "nexora_sync",
      );
      worker = createDatabase(workerUrlForTest);
      await t.test(
        "worker fixed capabilities are granted without secret/Identity/audit mutation authority",
        async () => {
          const [r] = await worker.$queryRawUnsafe(
            "SELECT has_function_privilege(current_user,'public.sync_carrier_snapshot(uuid,uuid,integer,uuid)','EXECUTE') AS scoped,has_table_privilege(current_user,'public.carrier_connection_secrets','SELECT') AS secrets,has_table_privilege(current_user,'public.users','UPDATE') AS users,has_table_privilege(current_user,'public.security_audit_events','UPDATE,DELETE') AS audit",
          );
          assert.equal(r.scoped, true);
          assert.equal(r.secrets, false);
          assert.equal(r.users, false);
          assert.equal(r.audit, false);
        },
      );
      await t.test(
        "native bounded-state CHECKs, private functions and repeat provisioning stay restrictive",
        async () => {
          const functions = await db.$queryRawUnsafe(
            "SELECT proname,prosecdef,proconfig,has_function_privilege('public',p.oid,'EXECUTE') AS exposed FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND (p.proname LIKE 'sync_carrier_%' OR p.proname LIKE 'carrier_http_%' OR p.proname LIKE '_sync_carrier_%' OR p.proname LIKE '_uniship_http_%')",
          );
          assert.equal(functions.length, 16);
          assert.equal(
            functions.some((f) => f.proname === "sync_carrier_load"),
            false,
          );
          for (const name of [
            "sync_carrier_load_token",
            "sync_carrier_authorize_recovery",
            "sync_carrier_load_recovery_password",
            "_sync_carrier_token_context",
            "_sync_carrier_recovery_context",
          ])
            assert.ok(functions.some((f) => f.proname === name));
          for (const f of functions) {
            assert.equal(f.prosecdef, true);
            assert.deepEqual(f.proconfig, ["search_path=pg_catalog"]);
            assert.equal(f.exposed, false);
          }
          const [permissions] = await worker.$queryRawUnsafe(
            "SELECT has_table_privilege(current_user,'public.uniship_http_budget','SELECT,INSERT,UPDATE,DELETE') AS budget,has_table_privilege(current_user,'public.carrier_worker_recoveries','SELECT,INSERT,UPDATE,DELETE') AS recovery,has_function_privilege(current_user,'public._sync_carrier_context(uuid,uuid,integer,uuid)','EXECUTE') AS private",
          );
          assert.deepEqual(permissions, {
            budget: false,
            recovery: false,
            private: false,
          });
          for (const role of ["nexora_app", "nexora_sync"]) {
            for (const signature of [
              "_sync_carrier_token_context(uuid)",
              "_sync_carrier_recovery_context(uuid,uuid,integer,uuid,integer)",
            ]) {
              const [permission] =
                await db.$queryRaw`SELECT has_function_privilege(${role},${"public." + signature},'EXECUTE') AS allowed`;
              assert.equal(permission.allowed, false);
            }
          }
          for (const signature of [
            "sync_carrier_load_token(uuid,uuid,integer,uuid,integer)",
            "sync_carrier_authorize_recovery(uuid,uuid,integer,uuid,integer)",
            "sync_carrier_load_recovery_password(uuid,uuid,integer,uuid,integer)",
          ]) {
            const [permission] =
              await db.$queryRaw`SELECT has_function_privilege('nexora_app',${"public." + signature},'EXECUTE') AS allowed`;
            assert.equal(permission.allowed, false);
          }
          await db.$executeRawUnsafe(
            "GRANT SELECT(ciphertext) ON carrier_connection_secrets TO nexora_sync",
          );
          await provisionRuntime(url.toString(), password, {
            role: "nexora_sync",
          });
          const [revoked] = await worker.$queryRawUnsafe(
            "SELECT has_column_privilege(current_user,'carrier_connection_secrets','ciphertext','SELECT') AS secret",
          );
          assert.equal(revoked.secret, false);
          const owner = await db.user.create({
            data: { username: "check-" + randomUUID(), role: "OPERATOR" },
          });
          for (const patch of ["'bad','PENDING'", "'uniship','BAD'"]) {
            await assert.rejects(
              db.$executeRawUnsafe(
                `INSERT INTO uniship_http_budget(provider,owner_user_id,scope_kind,scope_id) VALUES (${patch.split(",")[0]},'${owner.id}',${patch.split(",")[1]},'${owner.id}')`,
              ),
            );
          }
          await assert.rejects(
            db.$executeRaw`INSERT INTO uniship_http_budget(owner_user_id,scope_kind,scope_id,failures) VALUES(${owner.id}::uuid,'PENDING',${owner.id}::uuid,31)`,
          );
          await assert.rejects(
            db.$executeRaw`INSERT INTO uniship_http_budget(owner_user_id,scope_kind,scope_id,lease_token) VALUES(${owner.id}::uuid,'PENDING',${owner.id}::uuid,${randomUUID()}::uuid)`,
          );
        },
      );
      await t.test(
        "worker carrier scope binds credentials and recovery to the owned execution",
        async (t) => {
          const {
            WorkerCarrierStore,
          } = require("../dist/carrier/infrastructure/worker-carrier-store");
          const owner = await db.user.create({
            data: { username: "controlled-" + randomUUID(), role: "OPERATOR" },
          });
          await db.carrierUserState.create({ data: { userId: owner.id } });
          const connection = await db.carrierConnection.create({
            data: {
              userId: owner.id,
              provider: "uniship",
              externalAccountId: "123",
              loginIdentifier: "synthetic",
              displayName: "Synthetic scoped fixture",
              status: "CONNECTED",
            },
          });
          const workerId = randomUUID();
          const job = await db.syncJob.create({
            data: {
              owner_user_id: owner.id,
              carrier_connection_id: connection.id,
              provider: "uniship",
              external_account_id: "123",
              sync_type: "SHIPMENT",
              trigger_source: "MANUAL",
              status: "RUNNING",
              generation: 0,
              lifecycle_version: 0,
              worker_id: workerId,
              lease_version: 1,
              lease_expires_at: new Date(Date.now() + 60000),
            },
          });
          const store = new WorkerCarrierStore(workerUrlForTest);
          await t.test(
            "scoped Worker credential SQL has a bounded lock wait",
            async () => {
              let locked, release;
              const ready = new Promise((r) => (locked = r)),
                done = new Promise((r) => (release = r));
              const holder = db.$transaction(
                async (tx) => {
                  await tx.$queryRaw`SELECT id FROM users WHERE id=${owner.id}::uuid FOR UPDATE`;
                  locked();
                  await done;
                },
                { timeout: 5000 },
              );
              await ready;
              const timer = setTimeout(release, 1500),
                start = performance.now();
              try {
                await store.withJob(job, () =>
                  assert.rejects(
                    store.read(owner.id, connection.id),
                    (e) => e.code === "SERVICE_UNAVAILABLE",
                  ),
                );
                assert.ok(performance.now() - start < 1000);
              } finally {
                clearTimeout(timer);
                release();
                await holder;
              }
            },
          );
          await t.test(
            "bounded runtime audit INSERT fails closed under a real table lock",
            async () => {
              const {
                PostgresSecurityAudit,
              } = require("../dist/carrier/infrastructure/security-audit.adapter");
              const audit = new PostgresSecurityAudit(worker, true);
              let locked, release;
              const ready = new Promise((r) => (locked = r)),
                done = new Promise((r) => (release = r));
              const holder = db.$transaction(
                async (tx) => {
                  await tx.$executeRawUnsafe(
                    "LOCK TABLE security_audit_events IN ACCESS EXCLUSIVE MODE",
                  );
                  locked();
                  await done;
                },
                { timeout: 5000 },
              );
              await ready;
              const timer = setTimeout(release, 1500),
                start = performance.now();
              try {
                await assert.rejects(
                  audit.append({
                    userId: owner.id,
                    connectionId: connection.id,
                    provider: "uniship",
                    eventType: "PASSWORD_DECRYPT",
                    outcome: "ALLOWED",
                    reason: "RECOVERY_REQUESTED",
                    correlationId: randomUUID(),
                  }),
                  (e) =>
                    (e.meta?.code ??
                      e.meta?.driverAdapterError?.cause?.originalCode) ===
                    "55P03",
                );
                assert.ok(performance.now() - start < 1000);
              } finally {
                clearTimeout(timer);
                release();
                await holder;
              }
            },
          );
          await t.test(
            "NULL snapshot version cannot authorize credential load",
            async () => {
              await assert.rejects(
                worker.$queryRaw`SELECT public.sync_carrier_load_token(${job.id}::uuid,${workerId}::uuid,1,${randomUUID()}::uuid,NULL::integer)`,
              );
            },
          );
          await t.test(
            "NULL permit cannot finish an idle rate row",
            async () => {
              await db.$executeRaw`INSERT INTO uniship_http_budget(owner_user_id,scope_kind,scope_id,connection_id) VALUES(${owner.id}::uuid,'CONNECTION',${connection.id}::uuid,${connection.id}::uuid)`;
              const [before] =
                await db.$queryRaw`SELECT next_allowed_at,blocked_until FROM uniship_http_budget WHERE connection_id=${connection.id}::uuid`;
              const [result] =
                await worker.$queryRaw`SELECT public.sync_carrier_http_finish(${job.id}::uuid,${workerId}::uuid,1,${randomUUID()}::uuid,NULL::uuid,1000) AS result`;
              assert.equal(result.result, false);
              const [after] =
                await db.$queryRaw`SELECT next_allowed_at,blocked_until FROM uniship_http_budget WHERE connection_id=${connection.id}::uuid`;
              assert.deepEqual(after, before);
            },
          );
          try {
            await assert.rejects(store.read(owner.id, connection.id));
            await store.withJob(job, async () => {
              const snapshot = await store.read(owner.id, connection.id);
              assert.equal(snapshot.version, 0);
              await assert.rejects(store.read(randomUUID(), connection.id));
              await assert.rejects(store.read(owner.id, randomUUID()));
              await t.test(
                "normal token capability excludes password",
                async () => {
                  const token = await (store.loadToken ?? store.load).call(
                    store,
                    owner.id,
                    snapshot,
                  );
                  assert.equal(
                    Object.hasOwn(token, "password"),
                    false,
                    "normal token load must not return password",
                  );
                },
              );
              await t.test(
                "password capability requires recovery proof before claim",
                async () => {
                  await assert.rejects(
                    (store.loadRecoveryPassword ?? store.load).call(
                      store,
                      owner.id,
                      snapshot,
                    ),
                    "password recovery requires a claim even when ordinary lifecycle matches",
                  );
                },
              );
              const claimed = await store.claim(
                owner.id,
                connection.id,
                snapshot.version,
              );
              assert.equal(claimed.version, 1);
              assert.equal(
                (await db.syncJob.findUnique({ where: { id: job.id } }))
                  .lifecycle_version,
                0,
              );
              const loaded = await store.loadRecoveryPassword(
                owner.id,
                claimed,
              );
              assert.equal(loaded.loginIdentifier, "synthetic");
              await assert.rejects(
                store.loadRecoveryPassword(owner.id, {
                  ...claimed,
                  version: 0,
                }),
              );
              await store.fail(owner.id, claimed, "ERROR");
              assert.equal(
                (
                  await db.carrierConnection.findUnique({
                    where: { id: connection.id },
                  })
                ).lifecycleVersion,
                2,
              );
              await assert.rejects(
                store.loadRecoveryPassword(owner.id, claimed),
              );
            });
          } finally {
            await store.onApplicationShutdown();
          }
        },
      );
      await t.test(
        "actual API and Worker HTTP arrivals share PostgreSQL pacing and cooldown",
        async (t) => {
          const {
            PostgresHttpAdmission,
          } = require("../dist/carrier/infrastructure/uniship/postgres-http-admission");
          const {
            UnishipHttpClient,
          } = require("../dist/carrier/infrastructure/uniship/uniship-http.client");
          const {
            WorkerCarrierStore,
          } = require("../dist/carrier/infrastructure/worker-carrier-store");
          const owner = await db.user.create({
            data: { username: "rate-" + randomUUID(), role: "OPERATOR" },
          });
          await db.carrierUserState.create({ data: { userId: owner.id } });
          const connection = await db.carrierConnection.create({
            data: {
              userId: owner.id,
              provider: "uniship",
              externalAccountId: "rate-" + randomUUID(),
              loginIdentifier: "synthetic",
              displayName: "Synthetic rate fixture",
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
          const arrivals = [];
          let status = 200,
            hold = false,
            arrived,
            held;
          const server = createServer((req, res) => {
            arrivals.push({
              at: performance.now(),
              path: new URL(req.url, "http://mock").pathname,
            });
            if (hold) {
              held = res;
              arrived();
              return;
            }
            res.statusCode = status;
            if (status === 429) res.setHeader("retry-after", "2");
            res.setHeader("content-type", "application/json");
            res.end(
              JSON.stringify(
                req.method === "POST"
                  ? { token: "synthetic-token", user: { userid: 123 } }
                  : { data: [] },
              ),
            );
          });
          await new Promise((r) => server.listen(0, "127.0.0.1", r));
          const apiAdmission = new PostgresHttpAdmission(apiUrlForTest, "api"),
            workerAdmission = new PostgresHttpAdmission(
              workerUrlForTest,
              "worker",
            ),
            store = new WorkerCarrierStore(workerUrlForTest);
          const base = "http://127.0.0.1:" + server.address().port;
          const apiClient = new UnishipHttpClient({
              apiUrl: base,
              admission: apiAdmission,
            }),
            workerClient = new UnishipHttpClient({
              apiUrl: base,
              admission: workerAdmission,
            });
          const ctx = { ownerUserId: owner.id, connectionId: connection.id },
            pending = { ownerUserId: owner.id, connectionId: null };
          try {
            await t.test(
              "same connection across API/Worker instances dispatches no faster than one per second",
              async () => {
                await store.withJob(job, async () => {
                  const workerCtx = { ...ctx, execution: store.execution() };
                  await Promise.all([
                    apiClient.getShipment(
                      "/client/api/chinaStores/",
                      "synthetic-token",
                      new AbortController().signal,
                      new URLSearchParams(),
                      ctx,
                    ),
                    workerClient.getShipment(
                      "/client/api/transition/",
                      "synthetic-token",
                      new AbortController().signal,
                      new URLSearchParams(),
                      workerCtx,
                    ),
                  ]);
                });
                assert.equal(arrivals.length, 2);
                const spacing = arrivals[1].at - arrivals[0].at;
                assert.ok(spacing >= 1000, `actual request spacing ${spacing}`);
                console.log(
                  "UNISHIP_HTTP_PACING_DIAGNOSTIC",
                  JSON.stringify({
                    scope: "same-connection-api-worker",
                    arrivalSpacingMs: spacing,
                  }),
                );
              },
            );
            await t.test(
              "authenticate and verify share the stable pending-owner bucket",
              async () => {
                const before = arrivals.length;
                await apiClient.authenticate(
                  { username: "synthetic", password: "synthetic" },
                  undefined,
                  pending,
                );
                await apiClient.verify("synthetic-token", undefined, pending);
                assert.equal(arrivals.length, before + 2);
                assert.ok(
                  arrivals[before + 1].at - arrivals[before].at >= 1000,
                );
              },
            );
            await t.test(
              "aborting a pacing waiter does not dispatch another request",
              async () => {
                await apiClient.getShipment(
                  "/client/api/chinaStores/",
                  "synthetic-token",
                  new AbortController().signal,
                  new URLSearchParams(),
                  ctx,
                );
                const before = arrivals.length,
                  abort = new AbortController();
                const promise = apiClient.getShipment(
                  "/client/api/transition/",
                  "synthetic-token",
                  abort.signal,
                  new URLSearchParams(),
                  ctx,
                );
                abort.abort();
                await assert.rejects(promise);
                assert.equal(arrivals.length, before);
              },
            );
            await t.test(
              "shutdown aborts and drains a real admitted HTTP dispatch",
              async () => {
                const shutdownAdmission = new PostgresHttpAdmission(
                    apiUrlForTest,
                    "api",
                  ),
                  client = new UnishipHttpClient({
                    apiUrl: base,
                    admission: shutdownAdmission,
                  });
                const ready = new Promise((r) => (arrived = r));
                hold = true;
                const work = client.getShipment(
                    "/client/api/transition/",
                    "synthetic-token",
                    new AbortController().signal,
                    new URLSearchParams(),
                    ctx,
                  ),
                  rejected = assert.rejects(work);
                try {
                  await ready;
                  const before = arrivals.length;
                  await shutdownAdmission.onApplicationShutdown();
                  await rejected;
                  await assert.rejects(
                    client.getShipment(
                      "/client/api/transition/",
                      "synthetic-token",
                      new AbortController().signal,
                      new URLSearchParams(),
                      ctx,
                    ),
                  );
                  assert.equal(arrivals.length, before);
                } finally {
                  hold = false;
                  held?.end("{}");
                  await shutdownAdmission.onApplicationShutdown();
                }
                await db.$executeRaw`UPDATE uniship_http_budget SET blocked_until=NULL,next_allowed_at=clock_timestamp() WHERE connection_id=${connection.id}::uuid`;
              },
            );
            await t.test(
              "expired permit cannot finish or reset its successor cooldown",
              async () => {
                const old = randomUUID(),
                  successor = randomUUID();
                await db.$executeRaw`UPDATE uniship_http_budget SET lease_token=${old}::uuid,lease_expires_at=clock_timestamp()-interval '1 second' WHERE connection_id=${connection.id}::uuid`;
                const [permit] =
                  await db.$queryRaw`SELECT public.carrier_http_reserve(${owner.id}::uuid,${connection.id}::uuid,${successor}::uuid) AS result`;
                assert.equal(permit.result.acquired, true);
                const [stale] =
                  await db.$queryRaw`SELECT public.carrier_http_finish(${owner.id}::uuid,${connection.id}::uuid,${old}::uuid,300000) AS result`;
                assert.equal(stale.result, false);
                const [owned] =
                  await db.$queryRaw`SELECT lease_token,blocked_until FROM uniship_http_budget WHERE connection_id=${connection.id}::uuid`;
                assert.equal(owned.lease_token, successor);
                assert.equal(owned.blocked_until, null);
                const [released] =
                  await db.$queryRaw`SELECT public.carrier_http_finish(${owner.id}::uuid,${connection.id}::uuid,${successor}::uuid,0) AS result`;
                assert.equal(released.result, true);
              },
            );
            await t.test(
              "shutdown aborts and drains acquisition budget and releases its slot",
              async () => {
                const {
                  PostgresProviderBudget,
                } = require("../dist/carrier/infrastructure/uniship/postgres-provider-budget");
                const budget = new PostgresProviderBudget(apiUrlForTest);
                let started;
                const ready = new Promise((r) => (started = r));
                const work = budget.run(
                  (signal) =>
                    new Promise((_resolve, reject) => {
                      started();
                      signal.addEventListener(
                        "abort",
                        () => reject(signal.reason),
                        { once: true },
                      );
                    }),
                );
                const rejected = assert.rejects(work);
                await ready;
                await budget.onApplicationShutdown();
                await rejected;
                const [leases] =
                  await db.$queryRaw`SELECT count(*)::int AS count FROM sync_provider_budget WHERE provider='uniship' AND lease_token IS NOT NULL`;
                assert.equal(leases.count, 0);
                await assert.rejects(
                  budget.run(async () => assert.fail("closed budget")),
                );
              },
            );
            await t.test(
              "different connection progresses while the first connection permit is held",
              async () => {
                const other = await db.carrierConnection.create({
                    data: {
                      userId: owner.id,
                      provider: "uniship",
                      externalAccountId: "independent-" + randomUUID(),
                      loginIdentifier: "synthetic",
                      displayName: "Independent synthetic",
                      status: "CONNECTED",
                    },
                  }),
                  token = randomUUID();
                await db.$executeRaw`UPDATE uniship_http_budget SET next_allowed_at=clock_timestamp() WHERE connection_id=${connection.id}::uuid`;
                const [reservation] =
                  await db.$queryRaw`SELECT public.carrier_http_reserve(${owner.id}::uuid,${connection.id}::uuid,${token}::uuid) AS result`;
                assert.equal(reservation.result.acquired, true);
                const before = arrivals.length;
                try {
                  await apiClient.getShipment(
                    "/client/api/chinaStores/",
                    "synthetic-token",
                    new AbortController().signal,
                    new URLSearchParams(),
                    { ownerUserId: owner.id, connectionId: other.id },
                  );
                  assert.equal(arrivals.length, before + 1);
                } finally {
                  await db.$queryRaw`SELECT public.carrier_http_finish(${owner.id}::uuid,${connection.id}::uuid,${token}::uuid,0)`;
                }
              },
            );
            await t.test(
              "5xx fails closed with bounded shared cooldown and no follow-up HTTP",
              async () => {
                status = 503;
                await assert.rejects(
                  apiClient.getShipment(
                    "/client/api/chinaStores/",
                    "synthetic-token",
                    new AbortController().signal,
                    new URLSearchParams(),
                    ctx,
                  ),
                );
                const before = arrivals.length;
                await assert.rejects(
                  apiClient.getShipment(
                    "/client/api/chinaStores/",
                    "synthetic-token",
                    new AbortController().signal,
                    new URLSearchParams(),
                    ctx,
                  ),
                  (e) => e.code === "RATE_LIMITED" && e.retryAfterMs <= 300000,
                );
                assert.equal(arrivals.length, before);
                status = 200;
                await db.$executeRaw`UPDATE uniship_http_budget SET blocked_until=NULL,next_allowed_at=clock_timestamp() WHERE connection_id=${connection.id}::uuid`;
              },
            );
            await t.test(
              "429 establishes bounded cooldown and next request fails without HTTP dispatch",
              async () => {
                status = 429;
                await assert.rejects(
                  apiClient.getShipment(
                    "/client/api/chinaStores/",
                    "synthetic-token",
                    new AbortController().signal,
                    new URLSearchParams(),
                    ctx,
                  ),
                );
                const before = arrivals.length;
                await assert.rejects(
                  apiClient.getShipment(
                    "/client/api/chinaStores/",
                    "synthetic-token",
                    new AbortController().signal,
                    new URLSearchParams(),
                    ctx,
                  ),
                  (e) =>
                    e.code === "RATE_LIMITED" &&
                    e.retryAfterMs >= 1000 &&
                    e.retryAfterMs <= 300000,
                );
                assert.equal(arrivals.length, before);
                status = 200;
              },
            );
          } finally {
            await apiAdmission.onApplicationShutdown();
            await workerAdmission.onApplicationShutdown();
            await store.onApplicationShutdown();
            await new Promise((r) => server.close(r));
          }
        },
      );
      await require("./fixtures/uniship-runtime-security.cjs")(t, {
        db,
        workerUrl: workerUrlForTest,
      });
      await require("./fixtures/uniship-runtime-activation.cjs")(t, {
        db,
        workerUrl: workerUrlForTest,
        apiUrl: apiUrlForTest,
      });
      await require("./fixtures/uniship-runtime-composed.cjs")(t, {
        db,
        workerUrl: workerUrlForTest,
        apiUrl: apiUrlForTest,
      });
    } finally {
      await worker?.$disconnect();
      await db?.$disconnect();
      if (owned) await admin.$executeRawUnsafe(`DROP DATABASE "${name}"`);
      await admin.$disconnect();
    }
  },
);
