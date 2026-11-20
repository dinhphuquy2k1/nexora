import {
  ShipmentChargeCode as C,
  ShipmentMilestoneCode as M,
} from "@nexora/shared/shipment";
import { CarrierProvider } from "../../../carrier/domain/carrier";
import { SyncError, sourceKey } from "../../../sync/domain/sync-policy";
import { SyncErrorCode } from "../../../sync/domain/sync.constants";
import type {
  NormalizedSource,
  SyncPage,
} from "../../../sync/application/sync.port";
import {
  DecimalValue,
  ShipmentError,
  parseShipmentProviderInput,
} from "../../domain/shipment";

export const UnishipDiagnostic = {
  STATUS_UNKNOWN: "UNISHIP_STATUS_UNKNOWN",
  REQUIRED_FIELD_MISSING: "UNISHIP_REQUIRED_FIELD_MISSING",
  FIELD_TYPE_CHANGED: "UNISHIP_FIELD_TYPE_CHANGED",
  ENVELOPE_INVALID: "UNISHIP_ENVELOPE_INVALID",
  ORIGIN_DISPATCH_CONFLICT: "UNISHIP_ORIGIN_DISPATCH_CONFLICT",
} as const;
export type UnishipDiagnosticCode =
  (typeof UnishipDiagnostic)[keyof typeof UnishipDiagnostic];
export type UnishipWarning = (code: UnishipDiagnosticCode) => void;
const noWarning: UnishipWarning = () => {};
class NumericLexeme {
  constructor(readonly source: string) {
    Object.freeze(this);
  }
}
function decoded(text: string, warn: UnishipWarning): unknown {
  try {
    return JSON.parse(
      text,
      (_key: string, value: unknown, context?: { source?: string }) => {
        if (typeof value !== "number") return value;
        if (typeof context?.source !== "string")
          throw new Error("Numeric source context required");
        return new NumericLexeme(context.source);
      },
    );
  } catch (error) {
    if (error instanceof SyntaxError || error instanceof RangeError)
      return envelopeInvalid(warn);
    throw error;
  }
}
function envelopeInvalid(warn: UnishipWarning): never {
  warn(UnishipDiagnostic.ENVELOPE_INVALID);
  throw new SyncError(SyncErrorCode.SOURCE_INVALID);
}
function object(value: unknown): value is Record<string, unknown> {
  return (
    value !== null &&
    typeof value === "object" &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}
function integerText(value: unknown): string | null {
  return value instanceof NumericLexeme &&
    /^(0|[1-9]\d{0,127})$/.test(value.source)
    ? value.source
    : null;
}
function integer(value: unknown): number | null {
  const text = integerText(value);
  if (text === null) return null;
  const number = Number(text);
  return Number.isSafeInteger(number) ? number : null;
}
/** UTC+7 source wall time; validate calendar in UTC before applying the fixed offset. */
export function parseUnishipLocalTimestamp(value: unknown): string {
  if (
    typeof value !== "string" ||
    value.startsWith("0000") ||
    !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?$/.test(value)
  )
    throw new ShipmentError("VALIDATION_ERROR");
  const wall =
    value.replace(
      /(?:\.(\d{1,3}))?$/,
      (_, f: string | undefined) => "." + (f ?? "").padEnd(3, "0"),
    ) + "Z";
  const date = new Date(wall);
  if (!Number.isFinite(date.getTime()) || date.toISOString() !== wall)
    throw new ShipmentError("VALIDATION_ERROR");
  const utc = new Date(date.getTime() - 7 * 60 * 60 * 1000).toISOString();
  if (utc.startsWith("0000")) throw new ShipmentError("VALIDATION_ERROR");
  return utc;
}
function sourceCount(value: unknown): number {
  if (!(value instanceof NumericLexeme) || value.source.length > 128)
    throw new ShipmentError("VALIDATION_ERROR");
  const m = /^(-?)(\d+)(?:\.(\d+))?(?:[eE]([+-]?\d{1,4}))?$/.exec(value.source);
  if (!m) throw new ShipmentError("VALIDATION_ERROR");
  const coefficient = BigInt(m[2] + (m[3] ?? ""));
  if (coefficient === 0n) return 0;
  if (m[1]) throw new ShipmentError("VALIDATION_ERROR");
  const power = Number(m[4] ?? 0) - (m[3]?.length ?? 0);
  let result: bigint;
  if (power >= 0) {
    if (coefficient.toString().length + power > 10)
      throw new ShipmentError("VALIDATION_ERROR");
    result = coefficient * 10n ** BigInt(power);
  } else {
    if (-power > 128) throw new ShipmentError("VALIDATION_ERROR");
    const divisor = 10n ** BigInt(-power);
    if (coefficient % divisor !== 0n)
      throw new ShipmentError("VALIDATION_ERROR");
    result = coefficient / divisor;
  }
  if (result > 2147483647n) throw new ShipmentError("VALIDATION_ERROR");
  return Number(result);
}
function sourceDecimal(value: unknown, scale = 2): string {
  if (!(value instanceof NumericLexeme))
    throw new ShipmentError("VALIDATION_ERROR");
  const out = DecimalValue.parse(value.source, 18, scale);
  if (out.startsWith("-")) throw new ShipmentError("VALIDATION_ERROR");
  return out;
}
function envelope(text: string, warn: UnishipWarning) {
  const value = decoded(text, warn);
  if (
    !object(value) ||
    integer(value.status) !== 200 ||
    value.message !== "Success" ||
    !Array.isArray(value.data)
  )
    return envelopeInvalid(warn);
  const total = integer(value.total),
    offset = integer(value.offset),
    size = integer(value.rowsPerPage);
  if (total === null || offset === null || size === null || size < 1)
    return envelopeInvalid(warn);
  return { data: value.data, total, offset, size, summary: value.summary };
}
export function parseUnishipWarehouses(
  text: string,
  warn: UnishipWarning = noWarning,
): ReadonlyMap<string, string> {
  const value = envelope(text, warn);
  if (
    value.offset !== 0 ||
    value.total !== value.data.length ||
    value.size < value.total ||
    value.summary !== null
  )
    return envelopeInvalid(warn);
  const names = new Map<string, string>(),
    seen = new Set<string>();
  for (const entry of value.data) {
    if (!object(entry)) return envelopeInvalid(warn);
    const id = integerText(entry.ID),
      type = integer(entry.StoreType);
    if (
      id === null ||
      id === "0" ||
      type === null ||
      typeof entry.Name !== "string" ||
      seen.has(id)
    )
      return envelopeInvalid(warn);
    seen.add(id);
    // Only the China namespace is an origin. Names are never identifiers.
    if (
      type === 1 &&
      entry.Name.length > 0 &&
      entry.Name.length <= 256 &&
      !entry.Name.includes("\0")
    )
      names.set(id, entry.Name);
  }
  return names;
}
function record(
  value: unknown,
  warehouses: ReadonlyMap<string, string>,
  warn: UnishipWarning,
): NormalizedSource {
  if (!object(value)) return envelopeInvalid(warn);
  const id = integerText(value.ID);
  if (id === null || id === "0") {
    warn(
      value.ID == null
        ? UnishipDiagnostic.REQUIRED_FIELD_MISSING
        : UnishipDiagnostic.FIELD_TYPE_CHANGED,
    );
    throw new SyncError(SyncErrorCode.SOURCE_INVALID);
  }
  const identity = sourceKey("uniship-parcel-v1", [id]);
  const invalidRecord = (code: UnishipDiagnosticCode): NormalizedSource => {
    warn(code);
    return { identity, payload: { invalid: true } };
  };
  if (value.TransactionCode == null || value.Status == null)
    return invalidRecord(UnishipDiagnostic.REQUIRED_FIELD_MISSING);
  const status = integerText(value.Status);
  if (typeof value.TransactionCode !== "string" || status === null)
    return invalidRecord(UnishipDiagnostic.FIELD_TYPE_CHANGED);
  let oldStatus: string | null = null;
  if (status === "13" && value.OldStatus != null) {
    oldStatus = integerText(value.OldStatus);
    if (oldStatus === null)
      return invalidRecord(UnishipDiagnostic.FIELD_TYPE_CHANGED);
  }
  const shipment: Record<string, unknown> = {
    trackingCode: value.TransactionCode,
    providerStatus: status,
    providerClaimStatus: status === "13" ? "13" : null,
  };
  if (value.Weight != null) {
    if (!(value.Weight instanceof NumericLexeme))
      return invalidRecord(UnishipDiagnostic.FIELD_TYPE_CHANGED);
    try {
      shipment.weightKg = DecimalValue.parse(value.Weight.source, 10, 3);
    } catch (error) {
      if (error instanceof ShipmentError)
        return invalidRecord(UnishipDiagnostic.FIELD_TYPE_CHANGED);
      throw error;
    }
  }
  const warehouseId = integerText(value.ChinaStoreID);
  if (value.ChinaStoreID != null && warehouseId === null)
    return invalidRecord(UnishipDiagnostic.FIELD_TYPE_CHANGED);
  const origin = warehouseId === null ? undefined : warehouses.get(warehouseId);
  if (origin !== undefined) shipment.originWarehouse = origin;
  else warn(UnishipDiagnostic.REQUIRED_FIELD_MISSING);
  try {
    for (const [source, target] of [
      ["NumberOfPack", "packageCount"],
      ["RealNumberOfPack", "actualPackageCount"],
    ] as const)
      if (value[source] != null) shipment[target] = sourceCount(value[source]);
    for (const [source, target] of [
      ["TotalAmount", "totalAmount"],
      ["TotalPaidAmount", "providerPaidAmount"],
      ["TotalRemainAmount", "providerRemainingAmount"],
    ] as const)
      if (value[source] != null)
        shipment[target] = sourceDecimal(value[source]);
    if (
      value.TotalAmount != null ||
      value.TotalPaidAmount != null ||
      value.TotalRemainAmount != null
    )
      shipment.totalCurrency = "VND";
    if (value.ExchangeRate != null) {
      shipment.exchangeRate = sourceDecimal(value.ExchangeRate, 6);
      shipment.exchangeRateAt = null;
    }
    for (const [source, target] of [
      ["PaymentDate", "providerPaidAt"],
      ["ModifiedDate", "providerUpdatedAt"],
    ] as const)
      if (value[source] != null)
        shipment[target] = parseUnishipLocalTimestamp(value[source]);
    if (value.ReceivePlaceName != null)
      shipment.destinationWarehouse = value.ReceivePlaceName;
    const attributes: Record<string, unknown> = {};
    if (warehouseId !== null) attributes.originWarehouseId = warehouseId;
    if (value.PriceAmount != null)
      attributes.freightUnitPrice = {
        amount: sourceDecimal(value.PriceAmount),
        currency: "VND",
        unit: "kg",
      };
    if (value.CreatedDate != null)
      attributes.providerCreatedAt = parseUnishipLocalTimestamp(
        value.CreatedDate,
      );
    if (value.ShippingMethod != null)
      attributes.lastMileMethod = value.ShippingMethod;
    if (Object.keys(attributes).length)
      shipment.providerAttributesPatch = {
        schemaVersion: 1,
        provider: CarrierProvider.UNISHIP,
        values: attributes,
      };
    const charges = [];
    for (const [source, chargeCode] of [
      ["FeeWeightAmount", C.WEIGHT_FREIGHT],
      ["GuaranteeAmountVND", C.INSURANCE],
      ["FragileFeeVND", C.WOOD_PACKING],
      ["FoamFeeVND", C.BUBBLE_WRAP],
    ] as const)
      if (value[source] != null)
        charges.push({
          chargeCode,
          amount: sourceDecimal(value[source]),
          currency: "VND",
        });
    if (charges.length) shipment.chargePatch = { lines: charges };
    const milestones = [];
    for (const [source, milestoneCode] of [
      ["StoreCNImportDate", M.ORIGIN_RECEIVED],
      ["StoreCNExportDate", M.ORIGIN_DISPATCHED],
      ["StoreVNImportDate", M.DEST_RECEIVED],
      ["StoreVNExportDate", M.DEST_DISPATCHED],
    ] as const) {
      if (value[source] == null) continue;
      const occurredAt = parseUnishipLocalTimestamp(value[source]);
      if (
        source === "StoreCNExportDate" &&
        value.StoreCNExDate != null &&
        parseUnishipLocalTimestamp(value.StoreCNExDate) !== occurredAt
      ) {
        warn(UnishipDiagnostic.ORIGIN_DISPATCH_CONFLICT);
        continue;
      }
      milestones.push({
        milestoneCode,
        occurredAt,
        ...(source === "StoreVNImportDate" && value.ReceivePlaceName != null
          ? { locationName: value.ReceivePlaceName }
          : {}),
      });
    }
    if (milestones.length) shipment.milestonePatch = { entries: milestones };
    return {
      identity,
      payload: {
        shipment: { ...parseShipmentProviderInput(shipment) },
        oldStatus,
      },
    };
  } catch (error) {
    if (error instanceof ShipmentError)
      return invalidRecord(UnishipDiagnostic.FIELD_TYPE_CHANGED);
    throw error;
  }
}
export function parseUnishipPage(
  text: string,
  page: number,
  size: number,
  warehouses: ReadonlyMap<string, string>,
  warn: UnishipWarning = noWarning,
): SyncPage {
  if (
    !Number.isSafeInteger(page) ||
    page < 1 ||
    !Number.isSafeInteger(size) ||
    size < 1 ||
    size > 100
  )
    return envelopeInvalid(warn);
  const offset = (page - 1) * size;
  if (!Number.isSafeInteger(offset)) return envelopeInvalid(warn);
  const value = envelope(text, warn);
  if (
    value.offset !== offset ||
    value.size !== size ||
    value.total < offset ||
    value.data.length !== Math.min(size, value.total - offset) ||
    (page > 1 && value.data.length === 0)
  )
    return envelopeInvalid(warn);
  if (!object(value.summary)) return envelopeInvalid(warn);
  for (const key of [
    "TotalStatusAll",
    "TotalStatus0",
    "TotalStatus1",
    "TotalStatus2",
    "TotalStatus3",
    "TotalStatus4",
    "TotalStatus5",
    "TotalStatus13",
  ])
    if (integer(value.summary[key]) === null) return envelopeInvalid(warn);
  const records = value.data.map((entry) => record(entry, warehouses, warn));
  const identities = new Set<string>();
  for (const entry of records) {
    if (identities.has(entry.identity.key)) return envelopeInvalid(warn);
    identities.add(entry.identity.key);
  }
  const done = offset + records.length === value.total;
  if (!done && !Number.isSafeInteger(page + 1)) return envelopeInvalid(warn);
  return done ? { records, done } : { records, done, nextPage: page + 1 };
}
