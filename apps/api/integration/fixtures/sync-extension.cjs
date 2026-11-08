// Real-DB synthetic Domain adapter. Never imported or registered by production.
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const {
  SyncRepository,
} = require("../../dist/sync/infrastructure/sync-job.repository");
const {
  SyncJobExecutor,
} = require("../../dist/sync/application/sync-job-executor.service");
const {
  SyncCapabilityRegistry,
} = require("../../dist/sync/infrastructure/sync-capability.registry");
const {
  SyncError,
  sourceKey,
  canonicalPayload,
  payloadHash,
} = require("../../dist/sync/domain/sync-policy");
const {
  SyncErrorCode: E,
  SyncType: T,
} = require("../../dist/sync/domain/sync.constants");

function fixtureDomain(type, version, calls, sessions, behavior = {}) {
  return {
    version,
    supports: (candidate) => candidate === type,
    async begin(tx, job, source) {
      const scope = Object.freeze({
        ownerId: job.owner_user_id,
        connectionId: job.carrier_connection_id,
        sourceId: source.id,
        provider: job.provider,
        externalAccountId: job.external_account_id,
        syncType: job.sync_type,
      });
      let active = true,
        proposed;
      const requireActive = () => {
        if (!active) throw new SyncError(E.SYNC_STALE);
      };
      const session = Object.freeze({
        scope,
        stage(value, ownerId = scope.ownerId) {
          requireActive();
          if (
            ownerId !== scope.ownerId ||
            !Number.isSafeInteger(value) ||
            (proposed !== undefined && proposed !== value)
          )
            throw new SyncError(E.SOURCE_CONFLICT);
          proposed = value;
        },
      });
      sessions.push(session);
      return {
        async decide() {
          requireActive();
          assert.equal("customerId" in source, false);
          assert.equal("linkExistingCustomer" in session, false);
          calls.push([job.provider, job.sync_type, version]);
          const action = source.payload.action ?? "APPLIED";
          if (action !== "NO_PROPOSAL")
            session.stage(
              source.payload.value,
              source.payload.ownerId ?? scope.ownerId,
            );
          if (action === "THROW")
            throw Error("synthetic Domain decision failure");
          return {
            outcome: ["NO_PROPOSAL", "FAIL_COMMIT", "EXPIRE_LEASE"].includes(
              action,
            )
              ? "APPLIED"
              : action,
            retryAfterMs: 2000,
          };
        },
        async commit() {
          requireActive();
          if (proposed === undefined)
            throw new SyncError(E.PROCESSOR_UNAVAILABLE);
          active = false;
          const written =
            await tx.$executeRaw`INSERT INTO sync_extension_fixture(source_id,owner_id,channel,value) SELECT id,owner_user_id,${type},${proposed} FROM sync_source_identities WHERE id=${scope.sourceId}::uuid AND owner_user_id=${scope.ownerId}::uuid AND provider=${scope.provider} AND external_account_id=${scope.externalAccountId} AND sync_type=${scope.syncType} ON CONFLICT(source_id) DO UPDATE SET value=excluded.value WHERE sync_extension_fixture.owner_id=excluded.owner_id AND sync_extension_fixture.channel=excluded.channel`;
          if (written !== 1) throw new SyncError(E.SOURCE_CONFLICT);
          if (source.payload.action === "FAIL_COMMIT")
            throw Error("synthetic Domain persistence failure");
          if (source.payload.action === "EXPIRE_LEASE")
            await tx.$queryRaw`SELECT 1 AS waited FROM pg_sleep(1.1)`;
          if (behavior.afterWrite) await behavior.afterWrite(tx);
        },
        close() {
          active = false;
        },
      };
    },
  };
}
module.exports.fixtureDomain = fixtureDomain;

module.exports.verifySyncExtensions = async ({
  t,
  url,
  db,
  owner,
  other,
  cfg,
}) => {
  const connections = [],
    accounts = [],
    substituted = [],
    queues = [],
    calls = [],
    sessions = [],
    fetched = [];
  const record = (key, value, action, ownerId) => ({
    identity: sourceKey("extension-v1", [key]),
    payload: {
      value,
      ...(action ? { action } : {}),
      ...(ownerId ? { ownerId } : {}),
    },
  });
  const a = {
    strategy: (provider, type) =>
      provider === "uniship" && type === T.SHIPMENT ? "FULL" : null,
    async fetch(job, signal) {
      signal.throwIfAborted();
      fetched.push([job.sync_type, job.next_page, job.next_cursor]);
      return job.next_page === 1
        ? { records: [record("same-key", 1)], done: false, nextPage: 2 }
        : {
            records: [record("second-key", 2)],
            done: true,
            watermark: "full-finish",
          };
    },
  };
  const b = {
    strategy: (provider, type) =>
      provider === "uniship" && type === T.CUSTOMER ? "INCREMENTAL" : null,
    async fetch(job, signal) {
      signal.throwIfAborted();
      fetched.push([job.sync_type, job.next_page, job.next_cursor]);
      return !job.next_cursor
        ? {
            records: [record("same-key", 10)],
            done: false,
            nextCursor: "cursor-b1",
          }
        : {
            records: [record("second-key", 11)],
            done: true,
            watermark: "wm-b2",
          };
    },
  };
  const registry = () =>
    new SyncCapabilityRegistry([
      {
        providerName: "uniship",
        type: T.SHIPMENT,
        provider: a,
        domain: fixtureDomain(T.SHIPMENT, 2, calls, sessions),
      },
      {
        providerName: "uniship",
        type: T.CUSTOMER,
        provider: b,
        domain: fixtureDomain(T.CUSTOMER, 3, calls, sessions),
      },
    ]);
  const queue = (config = cfg, capabilities = registry()) => {
    const q = new SyncRepository(url, config, capabilities, "shared");
    queues.push(q);
    return q;
  };
  const lane = async (userId = owner.id) => {
    const c = await db.carrierConnection.create({
      data: {
        userId,
        provider: "uniship",
        externalAccountId: randomUUID(),
        displayName: "Synthetic extension contract",
        status: "CONNECTED",
      },
    });
    connections.push(c.id);
    accounts.push(c.externalAccountId);
    return c;
  };
  const cancel = async (id) =>
    db.$executeRaw`UPDATE sync_jobs SET status='CANCELLED',worker_id=NULL,lease_expires_at=NULL WHERE carrier_connection_id=${id}::uuid AND status IN ('QUEUED','RUNNING','WAITING')`;
  const check = (name, run) =>
    t.test(name, async () => {
      const first = connections.length;
      try {
        return await run();
      } finally {
        for (const id of connections.slice(first)) {
          await cancel(id);
          await db.$executeRaw`UPDATE sync_configs SET enabled=false,next_run_at=NULL WHERE carrier_connection_id=${id}::uuid`;
        }
      }
    });
  const stage = async (q, con, type, records, version) => {
    const job = await q.admit(owner.id, con.id, type, "MANUAL"),
      fetched = await q.claim(randomUUID());
    assert.equal(fetched.id, job.id);
    await q.page(fetched, { records, done: true }, version);
    const applying = await q.claim(randomUUID());
    assert.equal(applying.id, job.id);
    return applying;
  };
  await db.$executeRawUnsafe(
    "CREATE TABLE sync_extension_fixture(source_id UUID PRIMARY KEY REFERENCES sync_source_identities(id),owner_id UUID NOT NULL REFERENCES users(id),channel TEXT NOT NULL,value INTEGER NOT NULL)",
  );
  try {
    await check(
      "extension: second capability uses unchanged MANUAL/AUTO scheduler, exact dispatch and durable cursor restart",
      async () => {
        const con = await lane();
        let q = queue();
        await q.configure(owner.id, con.id, T.CUSTOMER, true, 15);
        await db.$executeRaw`UPDATE sync_configs SET next_run_at=clock_timestamp()-interval '1 second' WHERE carrier_connection_id=${con.id}::uuid AND sync_type=${T.CUSTOMER}`;
        const manual = await Promise.all([
          q.admit(owner.id, con.id, T.SHIPMENT, "MANUAL"),
          q.admit(owner.id, con.id, T.SHIPMENT, "AUTO"),
        ]);
        assert.equal(
          manual[0].id,
          manual[1].id,
          "same active lane remains unique",
        );
        await q.schedule();
        const auto = (await q.jobs(owner.id, con.id, 1, 20)).jobs.find(
          (j) => j.sync_type === T.CUSTOMER,
        );
        assert.equal(auto.trigger_source, "AUTO");
        assert.equal(auto.fetch_strategy, "INCREMENTAL");
        let restarted = false;
        for (let n = 0; n < 20; n++) {
          const jobs = (await q.jobs(owner.id, con.id, 1, 20)).jobs;
          if (jobs.every((j) => j.status === "SUCCEEDED")) break;
          const work = await q.claim(randomUUID());
          assert.ok(work);
          await new SyncJobExecutor(q).execute(
            work,
            new globalThis.AbortController().signal,
          );
          if (
            !restarted &&
            work.sync_type === T.CUSTOMER &&
            work.processing_phase === "FETCHING" &&
            !work.next_cursor
          ) {
            assert.equal(
              (await q.job(owner.id, con.id, auto.id)).next_cursor,
              "cursor-b1",
            );
            await q.close();
            q = queue();
            restarted = true;
          }
        }
        const done = (await q.jobs(owner.id, con.id, 1, 20)).jobs;
        assert.equal(done.length, 2);
        assert.ok(
          done.every((j) => j.status === "SUCCEEDED" && j.applied_count === 2),
        );
        assert.equal(restarted, true);
        assert.deepEqual(
          fetched.filter((x) => x[0] === T.SHIPMENT).map((x) => x[1]),
          [1, 2],
        );
        assert.deepEqual(
          fetched.filter((x) => x[0] === T.CUSTOMER).map((x) => x[2]),
          [null, "cursor-b1"],
        );
        assert.deepEqual([...new Set(calls.map((x) => x.join(":")))].sort(), [
          "uniship:CUSTOMER:3",
          "uniship:SHIPMENT:2",
        ]);
        const rows =
          await db.$queryRaw`SELECT f.channel,f.value,s.customer_id,p.applied_version,p.source_version,p.applied_processor_version FROM sync_extension_fixture f JOIN sync_source_identities s ON s.id=f.source_id JOIN provider_source_records p ON p.source_identity_id=s.id ORDER BY f.channel,f.value`;
        assert.equal(rows.length, 4);
        assert.ok(
          rows.every(
            (r) =>
              r.customer_id === null && r.applied_version === r.source_version,
          ),
        );
        assert.deepEqual(
          rows.map((r) => r.applied_processor_version),
          [3, 3, 2, 2],
        );
        assert.equal(
          (await q.configs(owner.id, con.id)).find(
            (c) => c.sync_type === T.CUSTOMER,
          ).last_completed_watermark,
          "wm-b2",
        );
        for (const session of sessions)
          assert.throws(
            () => session.stage(999),
            (e) => e.code === E.SYNC_STALE,
          );
      },
    );
    await check(
      "extension: no proposal cannot forge APPLIED; all non-applied outcomes discard staged Domain work",
      async () => {
        for (const action of [
          "NO_PROPOSAL",
          "REJECTED_SOURCE",
          "NEEDS_REVIEW",
          "RETRYABLE_ERROR",
          "INVALID_OUTCOME",
        ]) {
          const con = await lane(),
            q = queue(),
            work = await stage(
              q,
              con,
              T.SHIPMENT,
              [record(action, 4, action)],
              2,
            );
          if (["NO_PROPOSAL", "INVALID_OUTCOME"].includes(action))
            await assert.rejects(
              q.apply(work),
              (e) => e.code === E.PROCESSOR_UNAVAILABLE,
            );
          else await q.apply(work);
          const [{ n }] =
            await db.$queryRaw`SELECT count(*)::int AS n FROM sync_extension_fixture f JOIN sync_job_items i ON i.source_identity_id=f.source_id WHERE i.job_id=${work.id}::uuid`;
          assert.equal(n, 0);
          const state = await q.job(owner.id, con.id, work.id);
          assert.equal(state.applied_count, 0);
          if (action === "RETRYABLE_ERROR") {
            assert.equal(state.status, "WAITING");
            assert.equal(
              (await q.configs(owner.id, con.id)).find(
                (c) => c.sync_type === T.SHIPMENT,
              )?.last_completed_watermark ?? null,
              null,
            );
          }
          if (["REJECTED_SOURCE", "NEEDS_REVIEW"].includes(action))
            assert.equal(state.status, "SUCCEEDED");
          await cancel(con.id);
        }
      },
    );
    await check(
      "extension: decision exception, persistence exception and expired lease roll back actual Domain writes atomically",
      async () => {
        for (const action of ["THROW", "FAIL_COMMIT", "EXPIRE_LEASE"]) {
          const con = await lane(),
            q = queue({ ...cfg, leaseSeconds: 1 }),
            work = await stage(
              q,
              con,
              T.SHIPMENT,
              [record(action, 9, action)],
              2,
            );
          await assert.rejects(
            q.apply(work),
            action === "EXPIRE_LEASE"
              ? (e) => e.code === E.SYNC_STALE
              : undefined,
          );
          const [state] =
            await db.$queryRaw`SELECT i.processing_outcome,p.applied_version,(SELECT count(*)::int FROM sync_extension_fixture f WHERE f.source_id=i.source_identity_id) AS writes FROM sync_job_items i JOIN provider_source_records p ON p.source_identity_id=i.source_identity_id WHERE i.job_id=${work.id}::uuid`;
          assert.equal(state.writes, 0);
          assert.equal(state.applied_version, 0);
          assert.equal(state.processing_outcome, "PENDING");
          assert.equal(
            (await q.job(owner.id, con.id, work.id)).applied_count,
            0,
          );
          await cancel(con.id);
        }
      },
    );
    await check(
      "extension: owner mismatch and processor-version mismatch cannot apply",
      async () => {
        const q = queue(),
          con = await lane(),
          work = await stage(
            q,
            con,
            T.SHIPMENT,
            [record("foreign-owner", 7, "APPLIED", other.id)],
            2,
          );
        await assert.rejects(
          q.apply(work),
          (e) => e.code === E.SOURCE_CONFLICT,
        );
        await cancel(con.id);
        const con2 = await lane(),
          work2 = await stage(
            q,
            con2,
            T.SHIPMENT,
            [record("wrong-version", 7)],
            99,
          );
        await assert.rejects(
          q.apply(work2),
          (e) => e.code === E.PROCESSOR_UNAVAILABLE,
        );
        await cancel(con2.id);
      },
    );
    await check(
      "extension: source manifest owner/provider/account/type substitution is rejected before Domain invocation",
      async () => {
        const q = queue();
        for (const scope of [
          { owner_user_id: other.id },
          { provider: "fixture-foreign" },
          { external_account_id: randomUUID() },
          { sync_type: T.CUSTOMER },
        ]) {
          const con = await lane(),
            work = await stage(q, con, T.SHIPMENT, [record("scoped", 12)], 2);
          const key = sourceKey("extension-v1", [randomUUID()]),
            id = randomUUID();
          substituted.push(id);
          const facts = {
            owner_user_id: owner.id,
            provider: "uniship",
            external_account_id: con.externalAccountId,
            sync_type: T.SHIPMENT,
            ...scope,
          };
          await db.$executeRaw`INSERT INTO sync_source_identities(id,owner_user_id,provider,external_account_id,sync_type,source_key_scheme,source_key,source_key_hash) VALUES(${id}::uuid,${facts.owner_user_id}::uuid,${facts.provider},${facts.external_account_id},${facts.sync_type},${key.scheme},${key.key},${key.hash})`;
          await db.$executeRaw`INSERT INTO provider_source_records(source_identity_id,normalized_payload,payload_hash,source_version,processor_version) VALUES(${id}::uuid,'{"value":12}'::jsonb,${payloadHash(canonicalPayload({ value: 12 }))},1,2)`;
          await db.$executeRaw`UPDATE sync_job_items SET source_identity_id=${id}::uuid WHERE job_id=${work.id}::uuid`;
          const before = calls.length;
          await assert.rejects(
            q.apply(work),
            (e) => e.code === E.SOURCE_CONFLICT,
          );
          assert.equal(calls.length, before);
          await cancel(con.id);
        }
      },
    );
    await check(
      "extension: unsupported/disabled capability cannot admit/fetch and malformed normalized sources cannot checkpoint",
      async () => {
        const con = await lane(),
          unsupported = queue(cfg, new SyncCapabilityRegistry([]));
        await assert.rejects(
          unsupported.admit(owner.id, con.id, T.SHIPMENT, "MANUAL"),
          (e) => e.code === E.SYNC_UNAVAILABLE,
        );
        await assert.rejects(
          queue({ ...cfg, enabled: false }).admit(
            owner.id,
            con.id,
            T.SHIPMENT,
            "MANUAL",
          ),
          (e) => e.code === E.SYNC_UNAVAILABLE,
        );
        const q = queue(),
          j = await q.admit(owner.id, con.id, T.SHIPMENT, "MANUAL"),
          work = await q.claim(randomUUID());
        assert.equal(work.id, j.id);
        await assert.rejects(
          q.page(
            work,
            {
              records: [
                {
                  identity: { scheme: "bad!", key: "x", hash: "x" },
                  payload: {},
                },
              ],
              done: true,
            },
            2,
          ),
          (e) => e.code === E.SOURCE_INVALID,
        );
        assert.equal((await q.job(owner.id, con.id, j.id)).fetched_count, 0);
        await cancel(con.id);
      },
    );
  } finally {
    for (const id of connections) await cancel(id);
    for (const q of queues) await q.close();
    await db.$executeRawUnsafe("DROP TABLE sync_extension_fixture");
    await db.$executeRaw`DELETE FROM sync_job_items WHERE job_id IN (SELECT id FROM sync_jobs WHERE carrier_connection_id=ANY(${connections}::uuid[]))`;
    await db.$executeRaw`DELETE FROM provider_source_records WHERE source_identity_id IN (SELECT id FROM sync_source_identities WHERE external_account_id=ANY(${accounts}::text[]) OR id=ANY(${substituted}::uuid[]))`;
    await db.$executeRaw`DELETE FROM sync_source_identities WHERE external_account_id=ANY(${accounts}::text[]) OR id=ANY(${substituted}::uuid[])`;
    await db.$executeRaw`DELETE FROM sync_jobs WHERE carrier_connection_id=ANY(${connections}::uuid[])`;
    await db.carrierConnection.deleteMany({
      where: { id: { in: connections } },
    });
  }
};
