import { CARRIER_PROVIDER_MAX_LENGTH } from "../../carrier/domain/carrier";
import { isUuid } from "../../common/validation/uuid";
import {
  LogisticsStage,
  ShipmentKind,
  ShipmentChargeCode,
  type LogisticsStageCode,
  type ShipmentChargeCodeValue,
} from "@nexora/shared/shipment";
export class ShipmentError extends Error {
  constructor(
    readonly code:
      | "VALIDATION_ERROR"
      | "UNAUTHORIZED"
      | "NOT_FOUND"
      | "CLAIM_FILTER_UNAVAILABLE",
  ) {
    super(code);
  }
}
export function invalid(): never {
  throw new ShipmentError("VALIDATION_ERROR");
}
export function shipmentRecord(
  input: unknown,
  allowed: readonly string[],
): Record<string, unknown> {
  if (
    !input ||
    typeof input !== "object" ||
    Array.isArray(input) ||
    ![Object.prototype, null].includes(Object.getPrototypeOf(input)) ||
    Reflect.ownKeys(input).some(
      (k) => typeof k !== "string" || !allowed.includes(k),
    )
  )
    invalid();
  return input as Record<string, unknown>;
}
/** Exact decimal validation; padding zeros is not rounding or arithmetic. */
export class DecimalValue {
  static parse(input: unknown, precision: number, scale: number): string {
    if (typeof input !== "string" || !/^-?(0|[1-9]\d*)(\.\d+)?$/.test(input))
      invalid();
    const [integer, fraction = ""] = input.replace(/^-/, "").split(".");
    if (integer.length > precision - scale || fraction.length > scale)
      invalid();
    const sign =
      input.startsWith("-") && /[1-9]/.test(integer + fraction) ? "-" : "";
    return sign + integer + "." + fraction.padEnd(scale, "0");
  }
}
export interface ChargeLine {
  lineNo: number;
  chargeCode: ShipmentChargeCodeValue;
  amount: string;
  currency: string;
  providerLabel: string | null;
}
export interface ProviderFields {
  trackingCode?: string;
  shipmentKind?: typeof ShipmentKind.RETAIL_PARCEL;
  originWarehouse?: string | null;
  serviceLevel?: string | null;
  weightKg?: string | null;
  packageCount?: number | null;
  itemCount?: number | null;
  declaredValue?: string | null;
  declaredCurrency?: string | null;
  totalAmount?: string | null;
  totalCurrency?: string | null;
  exchangeRate?: string | null;
  exchangeRateAt?: string | null;
  providerStatus?: string | null;
  logisticsStage: LogisticsStageCode;
  providerClaimStatus?: string | null;
  providerUpdatedAt?: string | null;
}
export interface ProviderOperation {
  fields: ProviderFields;
  charges?: ChargeLine[];
  providerChangedAt?: string | null;
  stageChanged: boolean;
  fromStage: LogisticsStageCode | null;
}
const textFields = {
  trackingCode: 256,
  originWarehouse: 256,
  serviceLevel: 128,
  providerStatus: 128,
  providerClaimStatus: 128,
} as const;
const decimalFields = {
  weightKg: [10, 3],
  declaredValue: [18, 2],
  totalAmount: [18, 2],
  exchangeRate: [18, 6],
} as const;
const dateFields = ["exchangeRateAt", "providerUpdatedAt"] as const;
const currencyFields = ["declaredCurrency", "totalCurrency"] as const;
const countFields = ["packageCount", "itemCount"] as const;
const allowed = [
  "providerChangedAt",
  "shipmentKind",
  ...Object.keys(textFields),
  ...Object.keys(decimalFields),
  ...dateFields,
  ...currencyFields,
  ...countFields,
  "charges",
];
function text(value: unknown, max: number): string {
  if (
    typeof value !== "string" ||
    !value.length ||
    value.length > max ||
    value.includes("\0")
  )
    invalid();
  return value;
}
function currency(value: unknown): string {
  if (typeof value !== "string" || !/^[A-Z]{3}$/.test(value)) invalid();
  return value;
}
function date(value: unknown): string {
  if (
    typeof value !== "string" ||
    value.startsWith("0000") ||
    !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?Z$/.test(value)
  )
    invalid();
  const d = new Date(value);
  if (
    !Number.isFinite(d.getTime()) ||
    d.toISOString().replace(".000Z", "Z") !== value.replace(/\.0{1,3}Z$/, "Z")
  ) {
    // Compare normalized fractions while rejecting calendar rollover and lost precision.
    if (
      !Number.isFinite(d.getTime()) ||
      d.toISOString() !==
        value.replace(
          /(?:\.(\d{1,3}))?Z$/,
          (_, f) => "." + (f || "").padEnd(3, "0") + "Z",
        )
    )
      invalid();
  }
  return d.toISOString();
}
export type ShipmentChargeInput = Omit<
  ChargeLine,
  "lineNo" | "providerLabel"
> & { providerLabel?: string | null };
/** Explicit collection authority is part of the typed normalized contract. */
export interface ShipmentProviderInput
  extends Omit<ProviderFields, "logisticsStage"> {
  charges?: { complete: true; lines: readonly ShipmentChargeInput[] };
  providerChangedAt?: string | null;
}
interface NormalizedProviderPatch {
  fields: Omit<ProviderFields, "logisticsStage">;
  charges?: ChargeLine[];
  providerChangedAt?: string | null;
}
function normalizeProviderPatch(input: unknown): NormalizedProviderPatch {
  const raw = shipmentRecord(input, allowed);
  const out: Record<string, unknown> = {};
  if (Object.hasOwn(raw, "shipmentKind")) {
    if (raw.shipmentKind !== ShipmentKind.RETAIL_PARCEL) invalid();
    out.shipmentKind = ShipmentKind.RETAIL_PARCEL;
  }
  for (const [key, max] of Object.entries(textFields))
    if (Object.hasOwn(raw, key))
      out[key] =
        raw[key] === null && key !== "trackingCode"
          ? null
          : text(raw[key], max);
  for (const [key, [p, s]] of Object.entries(decimalFields))
    if (Object.hasOwn(raw, key)) {
      out[key] = raw[key] === null ? null : DecimalValue.parse(raw[key], p, s);
      if (
        key === "weightKg" &&
        typeof out[key] === "string" &&
        (out[key] as string).startsWith("-")
      )
        invalid();
    }
  for (const key of currencyFields)
    if (Object.hasOwn(raw, key))
      out[key] = raw[key] === null ? null : currency(raw[key]);
  for (const key of dateFields)
    if (Object.hasOwn(raw, key))
      out[key] = raw[key] === null ? null : date(raw[key]);
  for (const key of countFields)
    if (Object.hasOwn(raw, key)) {
      const v = raw[key];
      if (
        v !== null &&
        (typeof v !== "number" ||
          !Number.isInteger(v) ||
          v < 0 ||
          v > 2147483647)
      )
        invalid();
      out[key] = v;
    }
  let charges: ChargeLine[] | undefined;
  if (Object.hasOwn(raw, "charges")) {
    const snapshot = shipmentRecord(raw.charges, ["complete", "lines"]);
    if (
      snapshot.complete !== true ||
      !Array.isArray(snapshot.lines) ||
      snapshot.lines.length > 32767
    )
      invalid();
    charges = Array.from(snapshot.lines, (value, index) => {
      const row = shipmentRecord(value, [
        "chargeCode",
        "amount",
        "currency",
        "providerLabel",
      ]);
      if (
        !Object.values(ShipmentChargeCode).includes(
          row.chargeCode as ShipmentChargeCodeValue,
        )
      )
        invalid();
      return {
        lineNo: index + 1,
        chargeCode: row.chargeCode as ShipmentChargeCodeValue,
        amount: DecimalValue.parse(row.amount, 18, 2),
        currency: currency(row.currency),
        providerLabel:
          row.providerLabel === undefined || row.providerLabel === null
            ? null
            : text(row.providerLabel, 256),
      };
    });
  }
  let providerChangedAt: string | null | undefined;
  if (Object.hasOwn(raw, "providerChangedAt"))
    providerChangedAt =
      raw.providerChangedAt === null ? null : date(raw.providerChangedAt);
  return {
    fields: out as Omit<ProviderFields, "logisticsStage">,
    providerChangedAt,
    charges,
  };
}

/** Reuse the same validator at generic-source and Aggregate command boundaries. */
export function parseShipmentProviderInput(
  input: unknown,
): ShipmentProviderInput {
  const normalized = normalizeProviderPatch(input);
  const result: ShipmentProviderInput = { ...normalized.fields };
  if (normalized.charges !== undefined)
    result.charges = {
      complete: true,
      lines: normalized.charges.map((c) => ({
        chargeCode: c.chargeCode,
        amount: c.amount,
        currency: c.currency,
        providerLabel: c.providerLabel,
      })),
    };
  if (normalized.providerChangedAt !== undefined)
    result.providerChangedAt = normalized.providerChangedAt;
  return result;
}
function prepareOperation(
  existing: { logisticsStage: LogisticsStageCode } | null,
  input: unknown,
  stage: LogisticsStageCode,
): ProviderOperation {
  if (!Object.values(LogisticsStage).includes(stage)) invalid();
  const normalized = normalizeProviderPatch(input);
  if (!existing && normalized.fields.trackingCode === undefined) invalid();
  return {
    ...normalized,
    fields: { ...normalized.fields, logisticsStage: stage },
    stageChanged: !existing || existing.logisticsStage !== stage,
    fromStage: existing?.logisticsStage ?? null,
  };
}

export interface ShipmentChargeState extends ChargeLine {
  id: string | null;
}
export interface ShipmentCreationScope {
  ownerUserId: string;
  sourceIdentityId: string;
  carrierConnectionId: string | null;
  provider: string;
}
export interface ShipmentState extends ProviderFields {
  id: string | null;
  code: string | null;
  ownerUserId: string;
  sourceIdentityId: string | null;
  carrierConnectionId: string | null;
  provider: string | null;
  customerId: string | null;
  assigneeUserId: string | null;
  internalNote: string | null;
  updatedByUserId: string | null;
  lastSyncedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  charges: ShipmentChargeState[];
}
/** Current ordered child; identity is DB-owned, and is retained for the same position. */
class ShipmentCharge {
  private constructor(private readonly state: ShipmentChargeState) {}
  static from(state: ShipmentChargeState): ShipmentCharge {
    if (state.id !== null && !isUuid(state.id)) invalid();
    if (
      !Number.isInteger(state.lineNo) ||
      state.lineNo < 1 ||
      state.lineNo > 32767
    )
      invalid();
    if (!Object.values(ShipmentChargeCode).includes(state.chargeCode))
      invalid();
    const copy = {
      ...state,
      amount: DecimalValue.parse(state.amount, 18, 2),
      currency: currency(state.currency),
      providerLabel:
        state.providerLabel === null ? null : text(state.providerLabel, 256),
    };
    return new ShipmentCharge(Object.freeze(copy));
  }
  snapshot(): ShipmentChargeState {
    return { ...this.state };
  }
}
/** Encapsulated Shipment root. Persist only its explicit provider operation, never a generic save. */
export class ShipmentAggregate {
  private readonly state: Omit<ShipmentState, "charges">;
  private charges: ShipmentCharge[];
  private proposed?: ProviderOperation;
  private constructor(state: ShipmentState) {
    const { charges, ...root } = structuredClone(state);
    this.state = root;
    this.charges = charges.map((c) => ShipmentCharge.from(c));
  }
  static create(
    scope: ShipmentCreationScope,
    input: unknown,
    stage: LogisticsStageCode,
  ): ShipmentAggregate {
    const { ownerUserId, sourceIdentityId, carrierConnectionId, provider } =
      shipmentRecord(scope, [
        "ownerUserId",
        "sourceIdentityId",
        "carrierConnectionId",
        "provider",
      ]) as unknown as ShipmentCreationScope;
    if (
      !isUuid(ownerUserId) ||
      !isUuid(sourceIdentityId) ||
      (carrierConnectionId !== null && !isUuid(carrierConnectionId)) ||
      typeof provider !== "string" ||
      !provider.length ||
      provider.length > CARRIER_PROVIDER_MAX_LENGTH
    )
      invalid();
    const operation = prepareOperation(null, input, stage);
    const root = new ShipmentAggregate({
      id: null,
      code: null,
      ownerUserId,
      sourceIdentityId,
      carrierConnectionId,
      provider,
      customerId: null,
      assigneeUserId: null,
      internalNote: null,
      updatedByUserId: null,
      lastSyncedAt: null,
      createdAt: null,
      updatedAt: null,
      shipmentKind: ShipmentKind.RETAIL_PARCEL,
      ...operation.fields,
      charges: (operation.charges ?? []).map((c) => ({ ...c, id: null })),
    });
    root.proposed = operation;
    return root;
  }
  static hydrate(snapshot: ShipmentState): ShipmentAggregate {
    if (
      !snapshot ||
      !isUuid(snapshot.id) ||
      !isUuid(snapshot.ownerUserId) ||
      typeof snapshot.code !== "string" ||
      !/^SHP\d{6,}$/.test(snapshot.code) ||
      !Object.values(LogisticsStage).includes(snapshot.logisticsStage) ||
      snapshot.shipmentKind !== ShipmentKind.RETAIL_PARCEL
    )
      invalid();
    if (
      (snapshot.sourceIdentityId === null) !== (snapshot.provider === null) ||
      (snapshot.providerStatus != null && snapshot.provider === null)
    )
      invalid();
    if (
      snapshot.provider !== null &&
      (typeof snapshot.provider !== "string" ||
        !snapshot.provider.length ||
        snapshot.provider.length > CARRIER_PROVIDER_MAX_LENGTH)
    )
      invalid();
    for (const id of [
      snapshot.sourceIdentityId,
      snapshot.carrierConnectionId,
      snapshot.customerId,
      snapshot.assigneeUserId,
      snapshot.updatedByUserId,
    ])
      if (id !== null && !isUuid(id)) invalid();
    if (
      !Array.isArray(snapshot.charges) ||
      snapshot.charges.some((c, i) => c.lineNo !== i + 1)
    )
      invalid();
    return new ShipmentAggregate(snapshot);
  }
  applyProvider(input: unknown, stage: LogisticsStageCode): void {
    const operation = prepareOperation(
      { logisticsStage: this.state.logisticsStage },
      input,
      stage,
    );
    // Validate and construct every child before modifying the root or collection.
    let charges = this.charges;
    if (operation.charges !== undefined)
      charges = operation.charges.map((c, i) =>
        ShipmentCharge.from({
          ...c,
          id: this.charges[i]?.snapshot().id ?? null,
        }),
      );
    Object.assign(this.state, operation.fields);
    this.charges = charges;
    this.proposed = operation;
  }
  snapshot(): ShipmentState {
    return {
      ...structuredClone(this.state),
      charges: this.charges.map((c) => c.snapshot()),
    };
  }
  operation(): ProviderOperation {
    if (!this.proposed) invalid();
    return structuredClone(this.proposed);
  }
}
