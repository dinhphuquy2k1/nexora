const assert = require("node:assert/strict");
const { readFile } = require("node:fs/promises");
const { resolve } = require("node:path");
const {
  UnishipShipmentProcessor,
} = require("../../dist/shipment/infrastructure/uniship/uniship-shipment.processor");
const {
  parseUnishipPage,
  parseUnishipWarehouses,
} = require("../../dist/shipment/infrastructure/uniship/uniship-normalizer");
const { stores, page } = require("../../test/helpers/uniship-fixture.cjs");
const { sourceKey } = require("../../dist/sync/domain/sync-policy");
module.exports.verifyMappingV2 = async ({
  t,
  db,
  owner,
  connection,
  makeRepo,
  prepare,
  finish,
  req,
  foreignToken,
}) => {
  await t.test(
    "mapping v2 genuine worker-safe partial sync, attributes, reprocessing, rollback and typed HTTP",
    async () => {
      // Prior fence cases intentionally leave jobs pending; this database is UUID-owned by this suite.
      await db.$executeRawUnsafe(
        "UPDATE sync_jobs SET status='CANCELLED',worker_id=NULL,lease_expires_at=NULL WHERE status IN ('QUEUED','RUNNING','WAITING')",
      );
      const raw = await readFile(
        resolve(
          __dirname,
          "../../test/fixtures/uniship/mapping-v2/owner-discussion-sample.json",
        ),
        "utf8",
      );
      const sourceRow = JSON.parse(raw).data[0];
      const warehouses = parseUnishipWarehouses(stores);
      const normalize = (row) =>
        parseUnishipPage(page([row]), 1, 100, warehouses, () => {}).records[0];
      const source = normalize(sourceRow);
      const v1 = makeRepo(new UnishipShipmentProcessor(1, () => {}));
      const v2 = makeRepo(new UnishipShipmentProcessor(undefined, () => {}));
      assert.equal(
        v2.capabilities.resolve("uniship", "SHIPMENT").processor.version,
        2,
      );
      const apply = async (record, repo = v2) =>
        finish(await prepare([record], repo), repo);
      const seed = {
        identity: source.identity,
        payload: {
          shipment: {
            trackingCode: sourceRow.TransactionCode,
            providerStatus: "5",
            providerClaimStatus: null,
            charges: {
              complete: true,
              lines: [
                {
                  chargeCode: "OTHER",
                  amount: "2.00",
                  currency: "CNY",
                  providerLabel: "preserve unrelated",
                },
                {
                  chargeCode: "INSURANCE",
                  amount: "3.00",
                  currency: "VND",
                  providerLabel: "preserve selected label",
                },
              ],
            },
            milestones: {
              complete: true,
              entries: [
                {
                  milestoneCode: "ORIGIN_RECEIVED",
                  occurredAt: "2026-11-13T00:00:00.000Z",
                  providerLabel: "preserve milestone label",
                },
              ],
            },
          },
          oldStatus: null,
        },
      };
      assert.equal((await apply(seed, v1)).status, "SUCCEEDED");
      const identity = await db.syncSourceIdentity.findFirstOrThrow({
        where: {
          owner_user_id: owner.id,
          external_account_id: connection.externalAccountId,
          source_key: source.identity.key,
          source_key_scheme: "uniship-parcel-v1",
        },
      });
      const get = () =>
        db.shipment.findUniqueOrThrow({
          where: { sourceIdentityId: identity.id },
          include: {
            charges: { orderBy: { lineNo: "asc" } },
            milestones: { orderBy: { milestoneCode: "asc" } },
            services: true,
            history: true,
          },
        });
      let before = await get();
      await db.shipment.update({
        where: { id: before.id },
        data: {
          internalNote: "nexora-owned preserved",
          assigneeUserId: owner.id,
        },
      });
      before = await get();
      const unrelated = before.charges[0],
        insurance = before.charges[1],
        firstMilestone = before.milestones[0];
      assert.equal((await apply(source)).status, "SUCCEEDED");
      let mapped = await get();
      assert.equal(mapped.id, before.id);
      assert.equal(mapped.code, before.code);
      assert.equal(mapped.internalNote, "nexora-owned preserved");
      assert.equal(mapped.assigneeUserId, owner.id);
      assert.equal(mapped.logisticsStage, "DELIVERED");
      assert.equal(mapped.history.length, before.history.length);
      assert.equal(mapped.packageCount, 1);
      assert.equal(mapped.actualPackageCount, 1);
      assert.equal(mapped.totalAmount.toFixed(2), "940.00");
      assert.equal(mapped.providerRemainingAmount.toFixed(2), "0.00");
      assert.equal(mapped.providerPaidAmount.toFixed(2), "940.00");
      assert.equal(mapped.exchangeRate.toFixed(6), "3980.000000");
      assert.equal(mapped.exchangeRateAt, null);
      assert.equal(
        mapped.providerPaidAt.toISOString(),
        "2026-11-16T23:59:01.000Z",
      );
      assert.deepEqual(mapped.charges[0], unrelated);
      assert.equal(mapped.charges[1].id, insurance.id);
      assert.equal(mapped.charges[1].providerLabel, insurance.providerLabel);
      assert.equal(mapped.charges[1].amount.toFixed(2), "0.00");
      assert.equal(mapped.charges.length, 5);
      assert.equal(mapped.milestones.length, 4);
      assert.equal(
        mapped.milestones.find((m) => m.milestoneCode === "ORIGIN_RECEIVED").id,
        firstMilestone.id,
      );
      assert.equal(mapped.services.length, 0);
      assert.equal(
        mapped.providerAttributes.values.freightUnitPrice.amount,
        "23500.00",
      );
      const versions = () =>
        db.$queryRawUnsafe(
          "SELECT id,xmin::text AS xmin FROM shipment_charges WHERE shipment_id=$1::uuid ORDER BY line_no",
          mapped.id,
        );
      const feeVersions = await versions();
      assert.equal((await apply(source)).status, "SUCCEEDED");
      assert.deepEqual(await versions(), feeVersions);
      assert.equal((await get()).id, mapped.id);
      // Unresolved China warehouse lookup must preserve the last consistent ID/name pair.
      assert.equal(
        (await apply(normalize({ ...sourceRow, ChinaStoreID: 999999 }))).status,
        "SUCCEEDED",
      );
      const unresolvedWarehouse = await get();
      assert.equal(unresolvedWarehouse.originWarehouse, mapped.originWarehouse);
      assert.equal(
        unresolvedWarehouse.providerAttributes.values.originWarehouseId,
        mapped.providerAttributes.values.originWarehouseId,
      );
      const partial = {
        ...sourceRow,
        FeeWeightAmount: null,
        GuaranteeAmountVND: null,
        FragileFeeVND: null,
        FoamFeeVND: null,
        StoreCNImportDate: null,
        StoreCNExportDate: null,
        StoreCNExDate: null,
        StoreVNExportDate: null,
        PriceAmount: null,
        CreatedDate: null,
        ShippingMethod: null,
        ChinaStoreID: null,
        TotalAmount: null,
        TotalPaidAmount: null,
        TotalRemainAmount: null,
        ExchangeRate: null,
        ReceivePlaceName: "Kho nhận cập nhật",
        ShippingInfo: "excluded-private-marker",
        FakeCustomerName: "excluded-private-marker",
        IsFoam: true,
      };
      assert.equal((await apply(normalize(partial))).status, "SUCCEEDED");
      const preserved = await get();
      assert.deepEqual(preserved.charges, mapped.charges);
      assert.deepEqual(await versions(), feeVersions);
      assert.equal(preserved.milestones.length, 4);
      assert.equal(
        preserved.providerAttributes.values.freightUnitPrice.amount,
        "23500.00",
      );
      assert.equal(
        preserved.providerAttributes.values.lastMileMethod,
        "CPN-VietelPost",
      );
      assert.equal(preserved.services.length, 0);
      assert.equal(preserved.history.length, mapped.history.length);
      const staging = await db.providerSourceRecord.findUniqueOrThrow({
        where: { source_identity_id: identity.id },
      });
      assert.ok(
        !JSON.stringify(staging.normalized_payload).includes(
          "excluded-private-marker",
        ),
      );
      assert.ok(
        !JSON.stringify(staging.normalized_payload).includes("ShippingInfo"),
      );
      const detail = await req("/" + mapped.id);
      assert.equal(detail.response.status, 200);
      const wire = detail.body.shipment;
      assert.equal(wire.actualPackageCount, 1);
      assert.equal(wire.providerPaidAmount, "940.00");
      assert.equal(wire.providerRemainingAmount, "0.00");
      assert.equal(wire.destinationWarehouse, "Kho nhận cập nhật");
      assert.deepEqual(wire.freightUnitPrice, {
        amount: "23500.00",
        currency: "VND",
        unit: "kg",
      });
      assert.equal(wire.originWarehouseProviderId, "19");
      assert.equal(wire.providerCreatedAt, "2026-11-14T01:23:36.000Z");
      assert.equal(wire.lastMileMethod, "CPN-VietelPost");
      assert.equal(wire.providerAttributes, undefined);
      assert.ok(!JSON.stringify(wire).includes("PriceAmount"));
      const list = await req(
        "?q=" + encodeURIComponent(sourceRow.TransactionCode),
      );
      assert.equal(list.response.status, 200);
      assert.equal(list.body.shipments.length, 1);
      assert.equal(list.body.shipments[0].providerPaidAmount, undefined);
      assert.deepEqual(
        list.body.shipments[0].freightUnitPrice,
        wire.freightUnitPrice,
      );
      assert.equal(
        (await req("/" + mapped.id, foreignToken)).response.status,
        404,
      );
      // Existing duplicate target fee is a business conflict, not arbitrary replacement.
      await db.shipmentCharge.create({
        data: {
          shipmentId: mapped.id,
          lineNo: 6,
          chargeCode: "INSURANCE",
          amount: "9.00",
          currency: "VND",
        },
      });
      const ambiguousBefore = await get();
      const ambiguous = await apply(source);
      assert.equal(ambiguous.status, "SUCCEEDED");
      assert.deepEqual(await get(), ambiguousBefore);
      const recordAfter = await db.providerSourceRecord.findUniqueOrThrow({
        where: { source_identity_id: identity.id },
      });
      assert.equal(recordAfter.processing_status, "NEEDS_REVIEW");
      await db.shipmentCharge.deleteMany({
        where: { shipmentId: mapped.id, lineNo: 6 },
      });
      // Force a child SQL failure after root update; complete transaction must roll back.
      const rollbackBefore = await get();
      await db.$executeRawUnsafe(
        "CREATE FUNCTION mapping_child_fail() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN IF NEW.amount=941 THEN RAISE EXCEPTION 'MAPPING_CHILD_FAILURE'; END IF; RETURN NEW; END$$",
      );
      await db.$executeRawUnsafe(
        "CREATE TRIGGER mapping_child_fail BEFORE UPDATE ON shipment_charges FOR EACH ROW EXECUTE FUNCTION mapping_child_fail()",
      );
      let job;
      try {
        job = await prepare(
          [
            normalize({
              ...sourceRow,
              FeeWeightAmount: 941,
              ReceivePlaceName: "must rollback",
            }),
          ],
          v2,
        );
        const work = await v2.claim(require("node:crypto").randomUUID());
        await assert.rejects(v2.apply(work));
        assert.deepEqual(await get(), rollbackBefore);
      } finally {
        await db.$executeRawUnsafe(
          "DROP TRIGGER mapping_child_fail ON shipment_charges",
        );
        await db.$executeRawUnsafe("DROP FUNCTION mapping_child_fail()");
        if (job)
          await db.$executeRawUnsafe(
            "UPDATE sync_jobs SET status='CANCELLED',worker_id=NULL,lease_expires_at=NULL WHERE id=$1::uuid",
            job.id,
          );
      }
      // Same old minimal payload with processor2 changes neither identity nor source version and cannot backfill missing facts.
      const old = {
        identity: sourceKey("uniship-parcel-v1", ["341828"]),
        payload: {
          shipment: {
            trackingCode: "synthetic-reprocessing",
            providerStatus: "5",
            providerClaimStatus: null,
          },
          oldStatus: null,
        },
      };
      assert.equal((await apply(old, v1)).status, "SUCCEEDED");
      const oldIdentity = await db.syncSourceIdentity.findFirstOrThrow({
        where: {
          owner_user_id: owner.id,
          source_key: old.identity.key,
          source_key_scheme: old.identity.scheme,
        },
      });
      const oldRoot = await db.shipment.findUniqueOrThrow({
        where: { sourceIdentityId: oldIdentity.id },
      });
      assert.equal((await apply(old)).status, "SUCCEEDED");
      const remapped = await db.shipment.findUniqueOrThrow({
        where: { sourceIdentityId: oldIdentity.id },
        include: { history: true },
      });
      assert.equal(remapped.id, oldRoot.id);
      assert.equal(remapped.providerAttributes, null);
      assert.equal(remapped.actualPackageCount, null);
      assert.equal(remapped.history.length, 1);
      assert.equal(
        (
          await db.syncSourceIdentity.findUniqueOrThrow({
            where: { id: oldIdentity.id },
          })
        ).observed_source_version,
        1,
      );
    },
  );
};
