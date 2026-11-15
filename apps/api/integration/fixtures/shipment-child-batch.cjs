// Test-owned real PostgreSQL checks, never a production registration.
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { performance } = require("node:perf_hooks");
const os = require("node:os");
const {
  SyncRepository,
} = require("../../dist/sync/infrastructure/sync-job.repository");
const {
  SyncCapabilityRegistry,
} = require("../../dist/sync/infrastructure/sync-capability.registry");
const {
  ShipmentSyncProcessor,
} = require("../../dist/shipment/application/shipment-sync.processor");
const {
  createShipmentSyncBinding,
} = require("../../dist/shipment/infrastructure/shipment-sync-domain.binding");
const {
  loadSyncConfig,
  sourceKey,
} = require("../../dist/sync/domain/sync-policy");
const { LogisticsStage: S } = require("@nexora/shared/shipment");
const limits = require("../../dist/shipment/domain/shipment");
const chargeLimit = limits.SHIPMENT_MAX_CHARGE_LINES ?? 50;
const itemLimit = limits.SHIPMENT_MAX_ITEM_LINES ?? 500;
const codes = [
  "ORIGIN_RECEIVED",
  "ORIGIN_DISPATCHED",
  "DEST_RECEIVED",
  "DEST_DISPATCHED",
];
const tables = ["shipment_charges", "shipment_milestones", "shipment_items"];
const delegates = {
  shipmentCharge: tables[0],
  shipmentMilestone: tables[1],
  shipmentItem: tables[2],
};
async function verifyChildContext({ t, db, url, timing }) {
  const owner = await db.user.create({
    data: { username: "batch-" + randomUUID(), role: "OPERATOR" },
  });
  const connection = await db.carrierConnection.create({
    data: {
      userId: owner.id,
      provider: "uniship",
      externalAccountId: "batch-" + randomUUID(),
      displayName: "Isolated batch fixture",
      status: "CONNECTED",
    },
  });
  const base = createShipmentSyncBinding(
    new ShipmentSyncProcessor(
      1,
      { at: S.AT_ORIGIN_WAREHOUSE, done: S.DELIVERED },
      () => {},
    ),
  );
  let writes = [];
  const binding = {
    ...base,
    begin(tx, ...args) {
      const tracked = new Proxy(tx, {
        get(target, key) {
          if (key === "$executeRaw")
            return async (sql, ...values) => {
              const table = tables.find((name) =>
                sql.join("?").startsWith("INSERT INTO " + name + "("),
              );
              if (table) writes.push({ table, kind: "upsert" });
              return target.$executeRaw(sql, ...values);
            };
          if (delegates[key])
            return new Proxy(target[key], {
              get(delegate, method) {
                if (method === "deleteMany")
                  return async (options) => {
                    writes.push({ table: delegates[key], kind: "delete" });
                    return delegate.deleteMany(options);
                  };
                const value = delegate[method];
                return typeof value === "function"
                  ? value.bind(delegate)
                  : value;
              },
            });
          const value = target[key];
          return typeof value === "function" ? value.bind(target) : value;
        },
      });
      return base.begin(tracked, ...args);
    },
  };
  const repo = new SyncRepository(
    url,
    loadSyncConfig({ SYNC_ENABLED: "true", SYNC_SHIPMENT_ENABLED: "true" }),
    new SyncCapabilityRegistry([
      {
        providerName: "uniship",
        type: "SHIPMENT",
        provider: {
          strategy: () => "FULL",
          fetch: async () => {
            throw Error("no fixture network");
          },
        },
        domain: binding,
      },
    ]),
    "shared",
  );
  const payload = (phase, count = itemLimit, charges = chargeLimit) => ({
    trackingCode: "batch-" + phase,
    providerStatus: phase ? "done" : "at",
    charges: {
      complete: true,
      lines: Array.from({ length: charges }, () => ({
        chargeCode: phase ? "OTHER" : "DOMESTIC_SHIPPING",
        amount: phase ? "2.00" : "1.00",
        currency: phase ? "VND" : "CNY",
        providerLabel: phase ? "b" : "a",
      })),
    },
    milestones: {
      complete: true,
      entries: codes.map((milestoneCode) => ({
        milestoneCode,
        occurredAt: phase ? "2026-11-15T01:00:00Z" : "2026-11-15T00:00:00Z",
        locationName: phase ? "b" : "a",
        providerLabel: phase ? "b" : "a",
      })),
    },
    items: {
      complete: true,
      lines: Array.from({ length: count }, () => ({
        name: phase ? "b" : "a",
        quantity: phase ? 2 : 1,
        unitValue: phase ? "2.00" : "1.00",
        currency: phase ? "VND" : "CNY",
      })),
    },
  });
  const record = (key, value) => ({
    identity: sourceKey("child-batch-v1", [key]),
    payload: value,
  });
  const apply = async (records) => {
    const job = await repo.admit(owner.id, connection.id, "SHIPMENT", "MANUAL");
    const fetching = await repo.claim(randomUUID());
    assert.equal(fetching.id, job.id);
    await repo.page(fetching, { records, done: true }, 1);
    const work = await repo.claim(randomUUID());
    assert.equal(work.id, job.id);
    writes = [];
    const start = performance.now();
    await repo.apply(work);
    const ms = performance.now() - start;
    const state = await repo.job(owner.id, connection.id, job.id);
    assert.equal(state.status, "SUCCEEDED");
    return { ms, state, writes: [...writes] };
  };
  const versions = async () => {
    const output = {};
    for (const table of tables)
      output[table] = await db.$queryRawUnsafe(
        `SELECT c.*,c.xmin::text AS version FROM ${table} c JOIN shipments s ON s.id=c.shipment_id WHERE s.owner_user_id=$1::uuid ORDER BY c.id`,
        owner.id,
      );
    return output;
  };
  try {
    if (!timing)
      await t.test(
        "child writes are fixed per table; nulls, identity/xmin, one middle change, absent and empty",
        async () => {
          const checkWrites = (result, count) => {
            for (const table of tables)
              assert.equal(
                result.writes.filter((w) => w.table === table).length,
                count,
                table,
              );
          };
          checkWrites(await apply([record("shape", payload(0, 1, 1))]), 2);
          const larger = payload(0, 5, 5);
          larger.charges.lines[2].providerLabel = null;
          larger.items.lines[2] = {
            name: "nulls",
            quantity: null,
            unitValue: null,
            currency: null,
          };
          larger.milestones.entries[2].locationName = null;
          larger.milestones.entries[2].providerLabel = null;
          checkWrites(await apply([record("shape", larger)]), 2);
          const before = await versions();
          assert.equal(
            before.shipment_charges.find((c) => c.line_no === 3).provider_label,
            null,
          );
          const nullable = before.shipment_items.find((c) => c.line_no === 3);
          for (const key of ["quantity", "unit_value", "currency"])
            assert.equal(nullable[key], null);
          const milestone = before.shipment_milestones.find(
            (c) => c.milestone_code === "DEST_RECEIVED",
          );
          assert.equal(milestone.location_name, null);
          assert.equal(milestone.provider_label, null);
          const forced = { ...larger, trackingCode: "force-no-child-update" };
          checkWrites(await apply([record("shape", forced)]), 2);
          assert.deepEqual(await versions(), before);
          const middle = globalThis.structuredClone(forced);
          middle.charges.lines[2].amount = "3.00";
          middle.items.lines[2].name = "changed-middle";
          middle.milestones.entries[2].occurredAt = "2026-11-15T02:00:00Z";
          checkWrites(await apply([record("shape", middle)]), 2);
          const changed = await versions();
          for (const table of tables) {
            assert.deepEqual(
              changed[table].map((c) => c.id),
              before[table].map((c) => c.id),
            );
            assert.equal(
              changed[table].filter(
                (c, i) => c.version !== before[table][i].version,
              ).length,
              1,
              table,
            );
          }
          checkWrites(
            await apply([record("shape", { trackingCode: "absent" })]),
            0,
          );
          assert.deepEqual(await versions(), changed);
          checkWrites(
            await apply([
              record("shape", {
                charges: { complete: true, lines: [] },
                milestones: { complete: true, entries: [] },
                items: { complete: true, lines: [] },
              }),
            ]),
            1,
          );
          for (const rows of Object.values(await versions()))
            assert.equal(rows.length, 0);
        },
      );
    if (!timing)
      await t.test(
        "one oversized shipment is REJECTED_SOURCE while valid page siblings apply and job settles",
        async () => {
          const result = await apply([
            record("over", payload(0, 1, chargeLimit + 1)),
            record("valid-a", payload(0, 1, 1)),
            record("valid-b", payload(0, 1, 1)),
          ]);
          assert.equal(result.state.rejected_count, 1);
          assert.equal(result.state.applied_count, 2);
          const outcomes = await db.syncJobItem.findMany({
            where: { job_id: result.state.id },
            select: { processing_outcome: true },
          });
          assert.deepEqual(outcomes.map((r) => r.processing_outcome).sort(), [
            "APPLIED",
            "APPLIED",
            "REJECTED_SOURCE",
          ]);
        },
      );
    if (timing)
      await t.test(
        "full page at child limits applies within half of the transaction timeout",
        async () => {
          const records = (phase) =>
            Array.from({ length: 100 }, (_, i) =>
              record("timing-" + i, payload(phase)),
            );
          const first = await apply(records(0));
          const before = await versions();
          const changed = await apply(records(1));
          const updated = await versions();
          for (const table of tables) {
            assert.deepEqual(
              updated[table].map((c) => c.id),
              before[table].map((c) => c.id),
            );
            assert.equal(
              updated[table].length,
              100 *
                (table === tables[0]
                  ? chargeLimit
                  : table === tables[1]
                    ? 4
                    : itemLimit),
            );
            const map = new Map(before[table].map((c) => [c.id, c.version]));
            assert.equal(
              updated[table].filter((c) => c.version !== map.get(c.id)).length,
              100 *
                (table === tables[0]
                  ? chargeLimit
                  : table === tables[1]
                    ? 4
                    : itemLimit),
            );
          }
          const identical = await apply(records(1));
          assert.deepEqual(await versions(), updated);
          assert.equal(identical.writes.length, 0);
          const postgres = (await db.$queryRaw`SELECT version() AS version`)[0]
            .version;
          console.log(
            "SHIPMENT_CHILD_BATCH_TIMING",
            JSON.stringify({
              shipments: 100,
              charges: chargeLimit,
              items: itemLimit,
              milestones: 4,
              firstMs: +first.ms.toFixed(3),
              changedMs: +changed.ms.toFixed(3),
              identicalMs: +identical.ms.toFixed(3),
              firstChildWrites: first.writes.length,
              changedChildWrites: changed.writes.length,
              identicalChildWrites: identical.writes.length,
              postgres,
              machine: {
                hostname: os.hostname(),
                platform: os.platform(),
                arch: os.arch(),
                cpus: os.cpus().length,
                model: os.cpus()[0]?.model,
              },
            }),
          );
          for (const result of [first, changed])
            assert.equal(result.state.applied_count, 100);
          assert.equal(
            await db.syncJobItem.count({
              where: { job_id: identical.state.id },
            }),
            0,
          );
          assert.equal(first.writes.length, 600);
          assert.equal(changed.writes.length, 600);
          assert.ok(
            first.ms <= 7500,
            `first apply ${first.ms.toFixed(3)}ms exceeds7500ms`,
          );
        },
      );
  } finally {
    await repo.close();
  }
}
async function verifyShipmentChildBatch(context) {
  if (!context.isolated) {
    await verifyChildContext({ ...context, timing: false });
    await verifyChildContext({ ...context, timing: true });
    return;
  }
  // Sync's existing probes count all rows and leave test jobs behind. Own a separate
  // migrated database rather than changing their assertions or the engine claim.
  const { createDatabase } = require("@nexora/database");
  const { execFileSync } = require("node:child_process");
  const { resolve } = require("node:path");
  const admin = createDatabase(context.url);
  const name = "nexora_child_batch_" + randomUUID().replaceAll("-", "");
  const url = new URL(context.url);
  url.pathname = "/" + name;
  let owned = false,
    db;
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
    await verifyChildContext({
      t: context.t,
      db,
      url: url.toString(),
      timing: false,
    });
    await verifyChildContext({
      t: context.t,
      db,
      url: url.toString(),
      timing: true,
    });
  } finally {
    await db?.$disconnect();
    if (owned)
      await admin.$executeRawUnsafe(`DROP DATABASE "${name}" WITH (FORCE)`);
    await admin.$disconnect();
  }
}
module.exports = { verifyShipmentChildBatch };
