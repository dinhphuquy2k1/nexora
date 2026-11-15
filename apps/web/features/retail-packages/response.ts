import {
  LogisticsStage as ShipmentLogisticsStage,
  ShipmentKind,
  ShipmentChargeCode,
  ShipmentMilestoneCode,
} from "@nexora/shared/shipment";
import type {
  ShipmentSummary,
  ShipmentDetail,
  ShipmentPage,
  ShipmentHistoryPage,
} from "./types.ts";
const record = (x: unknown): x is Record<string, unknown> =>
  typeof x === "object" && x !== null && !Array.isArray(x);
const text = (x: unknown): x is string => typeof x === "string";
const nullableText = (x: unknown) => x === null || text(x);
const integer = (x: unknown): x is number =>
  typeof x === "number" && Number.isSafeInteger(x) && x >= 0;
const nullableInteger = (x: unknown) => x === null || integer(x);
const decimal = (x: unknown): x is string =>
  text(x) && /^-?(0|[1-9]\d*)(\.\d+)?$/.test(x);
const nullableDecimal = (x: unknown) => x === null || decimal(x);
const date = (x: unknown): x is string =>
  text(x) && /^\d{4}-\d{2}-\d{2}T/.test(x) && Number.isFinite(Date.parse(x));
const nullableDate = (x: unknown) => x === null || date(x);
const member = (x: unknown, values: readonly string[]) =>
  text(x) && values.includes(x);
const stage = (x: unknown) => member(x, Object.values(ShipmentLogisticsStage));
const fields = (
  x: Record<string, unknown>,
  keys: readonly string[],
  guard: (x: unknown) => boolean,
) => keys.every((key) => guard(x[key]));
function pagination(x: unknown): x is ShipmentPage["pagination"] {
  return (
    record(x) &&
    fields(x, ["page", "pageSize", "total", "totalPages"], integer) &&
    Number(x.page) >= 1 &&
    Number(x.pageSize) >= 1 &&
    Number(x.pageSize) <= 100
  );
}
function amount(x: unknown): boolean {
  if (!record(x)) return false;
  if (x.state === "SINGLE") return decimal(x.amount) && text(x.currency);
  return (
    (x.state === "NONE" || x.state === "MULTIPLE") &&
    x.amount === null &&
    x.currency === null
  );
}
function isSummary(x: unknown): x is ShipmentSummary {
  if (
    !record(x) ||
    !fields(x, ["id", "code", "trackingCode"], text) ||
    x.shipmentKind !== ShipmentKind.RETAIL_PARCEL ||
    !stage(x.logisticsStage) ||
    !fields(
      x,
      [
        "provider",
        "providerStatus",
        "providerClaimStatus",
        "customerId",
        "originWarehouse",
        "totalCurrency",
        "declaredCurrency",
      ],
      nullableText,
    ) ||
    !fields(x, ["weightKg", "declaredValue", "totalAmount"], nullableDecimal) ||
    !fields(x, ["packageCount", "itemCount"], nullableInteger) ||
    !fields(x, ["createdAt", "updatedAt"], date)
  )
    return false;
  const c = x.chargeSummary,
    m = x.milestoneSummary,
    i = x.itemSummary;
  return (
    record(c) &&
    amount(c.unitPrice) &&
    amount(c.domesticShipping) &&
    fields(
      c,
      ["hasInsurance", "hasCounting", "hasWoodPacking", "hasBubbleWrap"],
      (x) => typeof x === "boolean",
    ) &&
    record(m) &&
    fields(
      m,
      [
        "originReceivedAt",
        "originDispatchedAt",
        "destReceivedAt",
        "destDispatchedAt",
      ],
      nullableDate,
    ) &&
    nullableText(m.destWarehouse) &&
    record(i) &&
    nullableText(i.firstName) &&
    integer(i.lineCount)
  );
}
export function readShipmentPage(x: unknown): ShipmentPage {
  if (
    !record(x) ||
    !Array.isArray(x.shipments) ||
    !x.shipments.every(isSummary) ||
    !pagination(x.pagination) ||
    x.claimFilterAvailable !== false ||
    !record(x.stats) ||
    !integer(x.stats.total) ||
    x.stats.claims !== null ||
    !record(x.stats.byStage) ||
    !Object.values(ShipmentLogisticsStage).every((key) =>
      integer(
        (x.stats as Record<string, Record<string, unknown>>).byStage[key],
      ),
    )
  )
    throw Error("MALFORMED_RESPONSE");
  return x as ShipmentPage;
}
function isDetail(value: unknown): value is ShipmentDetail {
  if (!record(value)) return false;
  const x: Record<string, unknown> = value;
  if (
    !isSummary(value) ||
    !fields(
      x,
      ["serviceLevel", "assigneeUserId", "internalNote"],
      nullableText,
    ) ||
    !nullableDecimal(x.exchangeRate) ||
    !fields(
      x,
      ["exchangeRateAt", "providerUpdatedAt", "lastSyncedAt"],
      nullableDate,
    )
  )
    return false;
  return (
    Array.isArray(x.charges) &&
    x.charges.every(
      (c) =>
        record(c) &&
        text(c.id) &&
        integer(c.lineNo) &&
        c.lineNo >= 1 &&
        member(c.chargeCode, Object.values(ShipmentChargeCode)) &&
        decimal(c.amount) &&
        text(c.currency) &&
        nullableText(c.providerLabel),
    ) &&
    Array.isArray(x.milestones) &&
    x.milestones.every(
      (m) =>
        record(m) &&
        text(m.id) &&
        member(m.milestoneCode, Object.values(ShipmentMilestoneCode)) &&
        date(m.occurredAt) &&
        nullableText(m.locationName) &&
        nullableText(m.providerLabel),
    ) &&
    Array.isArray(x.items) &&
    x.items.every(
      (i) =>
        record(i) &&
        text(i.id) &&
        integer(i.lineNo) &&
        i.lineNo >= 1 &&
        text(i.name) &&
        nullableInteger(i.quantity) &&
        nullableDecimal(i.unitValue) &&
        nullableText(i.currency) &&
        (i.unitValue === null) === (i.currency === null),
    )
  );
}
export function readShipment(x: unknown): ShipmentDetail {
  if (!record(x) || !isDetail(x.shipment)) throw Error("MALFORMED_RESPONSE");
  return x.shipment;
}
export function readShipmentHistory(x: unknown): ShipmentHistoryPage {
  if (
    !record(x) ||
    !pagination(x.pagination) ||
    !Array.isArray(x.history) ||
    !x.history.every(
      (h) =>
        record(h) &&
        text(h.id) &&
        integer(h.sourceVersion) &&
        h.sourceVersion >= 1 &&
        integer(h.processorVersion) &&
        h.processorVersion >= 1 &&
        (h.fromStage === null || stage(h.fromStage)) &&
        stage(h.toStage) &&
        nullableText(h.providerStatus) &&
        nullableDate(h.providerChangedAt) &&
        date(h.observedAt),
    )
  )
    throw Error("MALFORMED_RESPONSE");
  return x as ShipmentHistoryPage;
}
