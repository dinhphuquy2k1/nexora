import { CARRIER_PROVIDER_MAX_LENGTH } from "../../carrier/domain/carrier";
import { isUuid } from "../../common/validation/uuid";
import {
  LogisticsStage,
  ShipmentKind,
  ShipmentChargeCode,
  ShipmentMilestoneCode,
  ShipmentServiceCode,
  type ShipmentServiceCodeValue,
  type ShipmentMilestoneCodeValue,
  type LogisticsStageCode,
  type ShipmentChargeCodeValue,
} from "@nexora/shared/shipment";
export const SHIPMENT_MAX_CHARGE_LINES = 50;
export const SHIPMENT_MAX_ITEM_LINES = 500;
export const SHIPMENT_MAX_MILESTONES = 4;
export const SHIPMENT_MAX_SERVICES = Object.values(ShipmentServiceCode).length;

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
export interface MilestoneEntry {
  milestoneCode: ShipmentMilestoneCodeValue;
  occurredAt: string;
  locationName: string | null;
  providerLabel: string | null;
}
export interface ItemLine {
  lineNo: number;
  name: string;
  quantity: number | null;
  unitValue: string | null;
  currency: string | null;
}
export interface ServiceEntry {
  serviceCode: ShipmentServiceCodeValue;
  enabled: boolean;
}
export interface ShipmentFreightUnitPrice {
  amount: string;
  currency: string;
  unit: "kg";
}
export interface ShipmentProviderAttributeValues {
  originWarehouseId?: string;
  freightUnitPrice?: ShipmentFreightUnitPrice;
  providerCreatedAt?: string;
  lastMileMethod?: string;
}
export interface ShipmentProviderAttributes {
  schemaVersion: 1;
  provider: string;
  values: ShipmentProviderAttributeValues;
}
export interface ShipmentProviderAttributesPatch {
  schemaVersion: 1;
  provider: string;
  values: {
    [K in keyof ShipmentProviderAttributeValues]?:
      | ShipmentProviderAttributeValues[K]
      | null;
  };
}
export class ShipmentPatchConflict extends Error {
  constructor() {
    super("CHARGE_PATCH_AMBIGUOUS");
  }
}
export interface ProviderFields {
  actualPackageCount?: number | null;
  providerPaidAmount?: string | null;
  providerRemainingAmount?: string | null;
  providerPaidAt?: string | null;
  destinationWarehouse?: string | null;
  providerAttributes?: ShipmentProviderAttributes | null;
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
  milestones?: MilestoneEntry[];
  items?: ItemLine[];
  services?: ServiceEntry[];
  providerChangedAt?: string | null;
  stageChanged: boolean;
  fromStage: LogisticsStageCode | null;
}
const textFields = {
  trackingCode: 256,
  originWarehouse: 256,
  serviceLevel: 128,
  destinationWarehouse: 256,
  providerStatus: 128,
  providerClaimStatus: 128,
} as const;
const decimalFields = {
  weightKg: [10, 3],
  providerPaidAmount: [18, 2],
  providerRemainingAmount: [18, 2],
  declaredValue: [18, 2],
  totalAmount: [18, 2],
  exchangeRate: [18, 6],
} as const;
const dateFields = [
  "exchangeRateAt",
  "providerUpdatedAt",
  "providerPaidAt",
] as const;
const currencyFields = ["declaredCurrency", "totalCurrency"] as const;
const countFields = [
  "packageCount",
  "itemCount",
  "actualPackageCount",
] as const;
const allowed = [
  "providerAttributesPatch",
  "chargePatch",
  "milestonePatch",
  "providerChangedAt",
  "shipmentKind",
  ...Object.keys(textFields),
  ...Object.keys(decimalFields),
  ...dateFields,
  ...currencyFields,
  ...countFields,
  "charges",
  "milestones",
  "items",
  "services",
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
function count(value: unknown): number | null {
  if (value === null) return null;
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < 0 ||
    value > 2147483647
  )
    invalid();
  return value;
}
function milestonePayload(input: unknown): MilestoneEntry {
  const row = shipmentRecord(input, [
    "milestoneCode",
    "occurredAt",
    "locationName",
    "providerLabel",
  ]);
  if (
    !Object.values(ShipmentMilestoneCode).includes(
      row.milestoneCode as ShipmentMilestoneCodeValue,
    )
  )
    invalid();
  return {
    milestoneCode: row.milestoneCode as ShipmentMilestoneCodeValue,
    occurredAt: date(row.occurredAt),
    locationName: row.locationName == null ? null : text(row.locationName, 256),
    providerLabel:
      row.providerLabel == null ? null : text(row.providerLabel, 256),
  };
}
function itemPayload(input: unknown): Omit<ItemLine, "lineNo"> {
  const row = shipmentRecord(input, [
    "name",
    "quantity",
    "unitValue",
    "currency",
  ]);
  const name = text(row.name, 512);
  if (!name.trim().length) invalid();
  const unitValue =
    row.unitValue == null ? null : DecimalValue.parse(row.unitValue, 18, 2);
  const itemCurrency = row.currency == null ? null : currency(row.currency);
  if (
    (unitValue === null) !== (itemCurrency === null) ||
    unitValue?.startsWith("-")
  )
    invalid();
  return {
    name,
    quantity: count(row.quantity ?? null),
    unitValue,
    currency: itemCurrency,
  };
}
function servicePayload(input: unknown): ServiceEntry {
  const row = shipmentRecord(input, ["serviceCode", "enabled"]);
  if (
    !Object.values(ShipmentServiceCode).includes(
      row.serviceCode as ShipmentServiceCodeValue,
    ) ||
    typeof row.enabled !== "boolean"
  )
    invalid();
  return {
    serviceCode: row.serviceCode as ShipmentServiceCodeValue,
    enabled: row.enabled,
  };
}
export interface ShipmentMilestoneInput {
  milestoneCode: ShipmentMilestoneCodeValue;
  occurredAt: string;
  locationName?: string | null;
  providerLabel?: string | null;
}
export interface ShipmentItemInput {
  name: string;
  quantity?: number | null;
  unitValue?: string | null;
  currency?: string | null;
}
export type ShipmentChargeInput = Omit<
  ChargeLine,
  "lineNo" | "providerLabel"
> & { providerLabel?: string | null };
/** Explicit collection authority is part of the typed normalized contract. */
export interface ShipmentProviderInput
  extends Omit<ProviderFields, "logisticsStage" | "providerAttributes"> {
  providerAttributesPatch?: ShipmentProviderAttributesPatch;
  chargePatch?: {
    lines: readonly Pick<ChargeLine, "chargeCode" | "amount" | "currency">[];
  };
  milestonePatch?: {
    entries: readonly Omit<ShipmentMilestoneInput, "providerLabel">[];
  };
  charges?: { complete: true; lines: readonly ShipmentChargeInput[] };
  milestones?: { complete: true; entries: readonly ShipmentMilestoneInput[] };
  items?: { complete: true; lines: readonly ShipmentItemInput[] };
  services?: { complete: true; entries: readonly ServiceEntry[] };
  providerChangedAt?: string | null;
}
interface NormalizedProviderPatch {
  providerAttributesPatch?: ShipmentProviderAttributes;
  chargePatch?: Pick<ChargeLine, "chargeCode" | "amount" | "currency">[];
  milestonePatch?: Omit<ShipmentMilestoneInput, "providerLabel">[];
  fields: Omit<ProviderFields, "logisticsStage">;
  charges?: ChargeLine[];
  milestones?: MilestoneEntry[];
  items?: ItemLine[];
  services?: ServiceEntry[];
  providerChangedAt?: string | null;
}
function normalizeProviderPatch(input: unknown): NormalizedProviderPatch {
  const raw = shipmentRecord(input, allowed);
  const out: Record<string, unknown> = {};
  if (
    (Object.hasOwn(raw, "charges") && Object.hasOwn(raw, "chargePatch")) ||
    (Object.hasOwn(raw, "milestones") && Object.hasOwn(raw, "milestonePatch"))
  )
    invalid();
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
        ["weightKg", "providerPaidAmount", "providerRemainingAmount"].includes(
          key,
        ) &&
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
      out[key] = count(raw[key]);
    }
  let charges: ChargeLine[] | undefined;
  if (Object.hasOwn(raw, "charges")) {
    const snapshot = shipmentRecord(raw.charges, ["complete", "lines"]);
    if (
      snapshot.complete !== true ||
      !Array.isArray(snapshot.lines) ||
      snapshot.lines.length > SHIPMENT_MAX_CHARGE_LINES
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
  let milestones: MilestoneEntry[] | undefined;
  if (Object.hasOwn(raw, "milestones")) {
    const snapshot = shipmentRecord(raw.milestones, ["complete", "entries"]);
    if (
      snapshot.complete !== true ||
      !Array.isArray(snapshot.entries) ||
      snapshot.entries.length > SHIPMENT_MAX_MILESTONES
    )
      invalid();
    milestones = Array.from(snapshot.entries, milestonePayload);
    if (
      new Set(milestones.map((m) => m.milestoneCode)).size !== milestones.length
    )
      invalid();
    const order = Object.values(ShipmentMilestoneCode);
    milestones.sort(
      (a, b) => order.indexOf(a.milestoneCode) - order.indexOf(b.milestoneCode),
    );
  }
  let items: ItemLine[] | undefined;
  if (Object.hasOwn(raw, "items")) {
    const snapshot = shipmentRecord(raw.items, ["complete", "lines"]);
    if (
      snapshot.complete !== true ||
      !Array.isArray(snapshot.lines) ||
      snapshot.lines.length > SHIPMENT_MAX_ITEM_LINES
    )
      invalid();
    items = Array.from(snapshot.lines, (row, i) => ({
      lineNo: i + 1,
      ...itemPayload(row),
    }));
  }
  let services: ServiceEntry[] | undefined;
  if (Object.hasOwn(raw, "services")) {
    const snapshot = shipmentRecord(raw.services, ["complete", "entries"]);
    if (
      snapshot.complete !== true ||
      !Array.isArray(snapshot.entries) ||
      snapshot.entries.length > SHIPMENT_MAX_SERVICES
    )
      invalid();
    services = Array.from(snapshot.entries, servicePayload);
    if (new Set(services.map((s) => s.serviceCode)).size !== services.length)
      invalid();
    const order = Object.values(ShipmentServiceCode);
    services.sort(
      (a, b) => order.indexOf(a.serviceCode) - order.indexOf(b.serviceCode),
    );
  }
  let providerChangedAt: string | null | undefined;
  if (Object.hasOwn(raw, "providerChangedAt"))
    providerChangedAt =
      raw.providerChangedAt === null ? null : date(raw.providerChangedAt);
  const providerAttributesPatch = Object.hasOwn(raw, "providerAttributesPatch")
    ? attributesValue(raw.providerAttributesPatch, true)
    : undefined;
  let chargePatch: NormalizedProviderPatch["chargePatch"];
  if (Object.hasOwn(raw, "chargePatch")) {
    const patch = shipmentRecord(raw.chargePatch, ["lines"]);
    if (
      !Array.isArray(patch.lines) ||
      patch.lines.length > SHIPMENT_MAX_CHARGE_LINES
    )
      invalid();
    const codes = [
      ShipmentChargeCode.WEIGHT_FREIGHT,
      ShipmentChargeCode.INSURANCE,
      ShipmentChargeCode.COUNTING,
      ShipmentChargeCode.WOOD_PACKING,
      ShipmentChargeCode.BUBBLE_WRAP,
    ] as readonly string[];
    for (const line of patch.lines) {
      const row = shipmentRecord(line, ["chargeCode", "amount", "currency"]);
      if (!codes.includes(row.chargeCode as string)) invalid();
    }
    const lines = normalizeProviderPatch({
      charges: { complete: true, lines: patch.lines },
    }).charges!;
    if (
      new Set(lines.map((c) => c.chargeCode)).size !== lines.length ||
      lines.some((c) => c.amount.startsWith("-"))
    )
      invalid();
    chargePatch = lines.map(({ chargeCode, amount, currency }) => ({
      chargeCode,
      amount,
      currency,
    }));
  }
  let milestonePatch: NormalizedProviderPatch["milestonePatch"];
  if (Object.hasOwn(raw, "milestonePatch")) {
    const patch = shipmentRecord(raw.milestonePatch, ["entries"]);
    if (
      !Array.isArray(patch.entries) ||
      patch.entries.length > SHIPMENT_MAX_MILESTONES
    )
      invalid();
    milestonePatch = Array.from(patch.entries, (value) => {
      const row = shipmentRecord(value, [
        "milestoneCode",
        "occurredAt",
        "locationName",
      ]);
      const normalized = milestonePayload(row);
      return {
        milestoneCode: normalized.milestoneCode,
        occurredAt: normalized.occurredAt,
        ...(row.locationName == null
          ? {}
          : { locationName: normalized.locationName }),
      };
    });
    if (
      new Set(milestonePatch.map((m) => m.milestoneCode)).size !==
      milestonePatch.length
    )
      invalid();
  }
  return {
    providerAttributesPatch,
    chargePatch,
    milestonePatch,
    fields: out as Omit<ProviderFields, "logisticsStage">,
    providerChangedAt,
    charges,
    milestones,
    items,
    services,
  };
}

/** Reuse the same validator at generic-source and Aggregate command boundaries. */
export function parseShipmentProviderInput(
  input: unknown,
): ShipmentProviderInput {
  const normalized = normalizeProviderPatch(input);
  const result: ShipmentProviderInput = { ...normalized.fields };
  if (normalized.providerAttributesPatch !== undefined)
    result.providerAttributesPatch = normalized.providerAttributesPatch;
  if (normalized.chargePatch !== undefined)
    result.chargePatch = { lines: normalized.chargePatch };
  if (normalized.milestonePatch !== undefined)
    result.milestonePatch = { entries: normalized.milestonePatch };
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
  if (normalized.milestones !== undefined)
    result.milestones = {
      complete: true,
      entries: normalized.milestones.map((m) => ({ ...m })),
    };
  if (normalized.items !== undefined)
    result.items = {
      complete: true,
      lines: normalized.items.map((i) => ({
        name: i.name,
        quantity: i.quantity,
        unitValue: i.unitValue,
        currency: i.currency,
      })),
    };
  if (normalized.services !== undefined)
    result.services = {
      complete: true,
      entries: normalized.services.map((s) => ({ ...s })),
    };
  if (normalized.providerChangedAt !== undefined)
    result.providerChangedAt = normalized.providerChangedAt;
  return result;
}
function prepareOperation(
  existing: Pick<
    ShipmentState,
    "logisticsStage" | "charges" | "milestones" | "providerAttributes"
  > | null,
  input: unknown,
  stage: LogisticsStageCode,
  provider: string | null,
): ProviderOperation {
  if (!Object.values(LogisticsStage).includes(stage)) invalid();
  const {
    chargePatch,
    milestonePatch,
    providerAttributesPatch,
    ...normalized
  } = normalizeProviderPatch(input);
  if (!existing && normalized.fields.trackingCode === undefined) invalid();
  if (chargePatch !== undefined) {
    const lines = (existing?.charges ?? []).map(
      ({ lineNo, chargeCode, amount, currency, providerLabel }) => ({
        lineNo,
        chargeCode,
        amount,
        currency,
        providerLabel,
      }),
    );
    for (const patch of chargePatch) {
      const matches = lines.filter(
        (line) => line.chargeCode === patch.chargeCode,
      );
      if (matches.length > 1) throw new ShipmentPatchConflict();
      if (matches.length) Object.assign(matches[0], patch);
      else {
        if (lines.length >= SHIPMENT_MAX_CHARGE_LINES || lines.length >= 32767)
          invalid();
        lines.push({ ...patch, lineNo: lines.length + 1, providerLabel: null });
      }
    }
    normalized.charges = lines;
  }
  if (milestonePatch !== undefined) {
    const entries = new Map(
      (existing?.milestones ?? []).map((m) => [
        m.milestoneCode,
        {
          milestoneCode: m.milestoneCode,
          occurredAt: m.occurredAt,
          locationName: m.locationName,
          providerLabel: m.providerLabel,
        },
      ]),
    );
    for (const patch of milestonePatch) {
      const old = entries.get(patch.milestoneCode);
      entries.set(patch.milestoneCode, {
        ...(old ?? { locationName: null, providerLabel: null }),
        ...patch,
      });
    }
    const order = Object.values(ShipmentMilestoneCode);
    normalized.milestones = [...entries.values()].sort(
      (a, b) => order.indexOf(a.milestoneCode) - order.indexOf(b.milestoneCode),
    );
  }
  if (providerAttributesPatch !== undefined) {
    if (providerAttributesPatch.provider !== provider) invalid();
    if (Object.keys(providerAttributesPatch.values).length) {
      const old = parseShipmentProviderAttributes(
        existing?.providerAttributes ?? null,
        provider,
      );
      normalized.fields.providerAttributes = parseShipmentProviderAttributes(
        {
          ...providerAttributesPatch,
          values: { ...old?.values, ...providerAttributesPatch.values },
        },
        provider,
      );
    }
  }
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
  milestones: ShipmentMilestoneState[];
  items: ShipmentItemState[];
  services: ShipmentServiceState[];
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
export interface ShipmentMilestoneState extends MilestoneEntry {
  id: string | null;
}
export interface ShipmentItemState extends ItemLine {
  id: string | null;
}
class ShipmentMilestone {
  private constructor(private readonly state: ShipmentMilestoneState) {}
  static from(state: ShipmentMilestoneState): ShipmentMilestone {
    if (state.id !== null && !isUuid(state.id)) invalid();
    const payload = milestonePayload({
      milestoneCode: state.milestoneCode,
      occurredAt: state.occurredAt,
      locationName: state.locationName,
      providerLabel: state.providerLabel,
    });
    return new ShipmentMilestone(Object.freeze({ id: state.id, ...payload }));
  }
  snapshot(): ShipmentMilestoneState {
    return { ...this.state };
  }
}
class ShipmentItem {
  private constructor(private readonly state: ShipmentItemState) {}
  static from(state: ShipmentItemState): ShipmentItem {
    if (state.id !== null && !isUuid(state.id)) invalid();
    if (
      !Number.isInteger(state.lineNo) ||
      state.lineNo < 1 ||
      state.lineNo > 32767
    )
      invalid();
    const payload = itemPayload({
      name: state.name,
      quantity: state.quantity,
      unitValue: state.unitValue,
      currency: state.currency,
    });
    return new ShipmentItem(
      Object.freeze({ id: state.id, lineNo: state.lineNo, ...payload }),
    );
  }
  snapshot(): ShipmentItemState {
    return { ...this.state };
  }
}
export interface ShipmentServiceState extends ServiceEntry {
  id: string | null;
}
class ShipmentService {
  private constructor(private readonly state: ShipmentServiceState) {}
  static from(input: ShipmentServiceState): ShipmentService {
    const state = shipmentRecord(input, ["id", "serviceCode", "enabled"]);
    if (state.id !== null && !isUuid(state.id)) invalid();
    const payload = servicePayload({
      serviceCode: state.serviceCode,
      enabled: state.enabled,
    });
    return new ShipmentService(
      Object.freeze({ id: state.id as string | null, ...payload }),
    );
  }
  snapshot(): ShipmentServiceState {
    return { ...this.state };
  }
}
/** Encapsulated Shipment root. Persist only its explicit provider operation, never a generic save. */
export class ShipmentAggregate {
  private readonly state: Omit<
    ShipmentState,
    "charges" | "milestones" | "items" | "services"
  >;
  private charges: ShipmentCharge[];
  private milestones: ShipmentMilestone[];
  private items: ShipmentItem[];
  private services: ShipmentService[];
  private proposed?: ProviderOperation;
  private constructor(state: ShipmentState) {
    const { charges, milestones, items, services, ...root } =
      structuredClone(state);
    this.state = root;
    this.charges = charges.map((c) => ShipmentCharge.from(c));
    const order = Object.values(ShipmentMilestoneCode);
    this.milestones = milestones
      .map((m) => ShipmentMilestone.from(m))
      .sort(
        (a, b) =>
          order.indexOf(a.snapshot().milestoneCode) -
          order.indexOf(b.snapshot().milestoneCode),
      );
    this.items = items.map((i) => ShipmentItem.from(i));
    const serviceOrder = Object.values(ShipmentServiceCode);
    this.services = services
      .map((s) => ShipmentService.from(s))
      .sort(
        (a, b) =>
          serviceOrder.indexOf(a.snapshot().serviceCode) -
          serviceOrder.indexOf(b.snapshot().serviceCode),
      );
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
    const operation = prepareOperation(null, input, stage, provider);
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
      milestones: (operation.milestones ?? []).map((m) => ({ ...m, id: null })),
      items: (operation.items ?? []).map((i) => ({ ...i, id: null })),
      services: (operation.services ?? []).map((s) => ({ ...s, id: null })),
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
    if (
      !Array.isArray(snapshot.milestones) ||
      snapshot.milestones.length > 4 ||
      snapshot.milestones.some((m) => !m) ||
      new Set(snapshot.milestones.map((m) => m.milestoneCode)).size !==
        snapshot.milestones.length ||
      !Array.isArray(snapshot.items) ||
      snapshot.items.length > 32767 ||
      snapshot.items.some((i, index) => !i || i.lineNo !== index + 1)
    )
      invalid();
    if (
      !Array.isArray(snapshot.services) ||
      snapshot.services.length > SHIPMENT_MAX_SERVICES ||
      snapshot.services.some((s) => !s) ||
      new Set(snapshot.services.map((s) => s.serviceCode)).size !==
        snapshot.services.length
    )
      invalid();
    if (snapshot.providerAttributes !== undefined)
      parseShipmentProviderAttributes(
        snapshot.providerAttributes,
        snapshot.provider,
      );
    if (snapshot.actualPackageCount !== undefined)
      count(snapshot.actualPackageCount);
    for (const amount of [
      snapshot.providerPaidAmount,
      snapshot.providerRemainingAmount,
    ])
      if (amount != null && DecimalValue.parse(amount, 18, 2).startsWith("-"))
        invalid();
    if (snapshot.providerPaidAt != null) date(snapshot.providerPaidAt);
    if (snapshot.destinationWarehouse != null)
      text(snapshot.destinationWarehouse, 256);
    return new ShipmentAggregate(snapshot);
  }
  applyProvider(input: unknown, stage: LogisticsStageCode): void {
    const operation = prepareOperation(
      {
        logisticsStage: this.state.logisticsStage,
        charges: this.charges.map((c) => c.snapshot()),
        milestones: this.milestones.map((m) => m.snapshot()),
        providerAttributes: this.state.providerAttributes,
      },
      input,
      stage,
      this.state.provider,
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
    let milestones = this.milestones,
      items = this.items;
    if (operation.milestones !== undefined) {
      const ids = new Map(
        this.milestones.map((m) => {
          const row = m.snapshot();
          return [row.milestoneCode, row.id];
        }),
      );
      milestones = operation.milestones.map((m) =>
        ShipmentMilestone.from({ ...m, id: ids.get(m.milestoneCode) ?? null }),
      );
    }
    if (operation.items !== undefined)
      items = operation.items.map((item, i) =>
        ShipmentItem.from({
          ...item,
          id: this.items[i]?.snapshot().id ?? null,
        }),
      );
    let services = this.services;
    if (operation.services !== undefined) {
      const ids = new Map(
        this.services.map((s) => {
          const row = s.snapshot();
          return [row.serviceCode, row.id];
        }),
      );
      services = operation.services.map((s) =>
        ShipmentService.from({ ...s, id: ids.get(s.serviceCode) ?? null }),
      );
    }
    Object.assign(this.state, operation.fields);
    this.charges = charges;
    this.milestones = milestones;
    this.items = items;
    this.services = services;
    this.proposed = operation;
  }
  snapshot(): ShipmentState {
    return {
      ...structuredClone(this.state),
      charges: this.charges.map((c) => c.snapshot()),
      milestones: this.milestones.map((m) => m.snapshot()),
      items: this.items.map((i) => i.snapshot()),
      services: this.services.map((s) => s.snapshot()),
    };
  }
  operation(): ProviderOperation {
    if (!this.proposed) invalid();
    return structuredClone(this.proposed);
  }
}

function attributesValue(
  input: unknown,
  patch: boolean,
): ShipmentProviderAttributes {
  const row = shipmentRecord(input, ["schemaVersion", "provider", "values"]);
  if (row.schemaVersion !== 1) invalid();
  const provider = text(row.provider, CARRIER_PROVIDER_MAX_LENGTH);
  const values = shipmentRecord(row.values, [
    "originWarehouseId",
    "freightUnitPrice",
    "providerCreatedAt",
    "lastMileMethod",
  ]);
  const out: ShipmentProviderAttributeValues = {};
  for (const key of ["originWarehouseId", "lastMileMethod"] as const)
    if (Object.hasOwn(values, key)) {
      if (patch && values[key] === null) continue;
      out[key] = text(values[key], 128);
    }
  if (
    Object.hasOwn(values, "providerCreatedAt") &&
    !(patch && values.providerCreatedAt === null)
  )
    out.providerCreatedAt = date(values.providerCreatedAt);
  if (
    Object.hasOwn(values, "freightUnitPrice") &&
    !(patch && values.freightUnitPrice === null)
  ) {
    const price = shipmentRecord(values.freightUnitPrice, [
      "amount",
      "currency",
      "unit",
    ]);
    if (price.unit !== "kg") invalid();
    const amount = DecimalValue.parse(price.amount, 18, 2);
    if (amount.startsWith("-")) invalid();
    out.freightUnitPrice = {
      amount,
      currency: currency(price.currency),
      unit: "kg",
    };
  }
  const result: ShipmentProviderAttributes = {
    schemaVersion: 1,
    provider,
    values: out,
  };
  if (
    (!patch && !Object.keys(out).length) ||
    new TextEncoder().encode(JSON.stringify(result)).byteLength > 1024
  )
    invalid();
  return result;
}
export function parseShipmentProviderAttributes(
  input: unknown,
  provider: string | null,
): ShipmentProviderAttributes | null {
  if (input === null) return null;
  const value = attributesValue(input, false);
  if (value.provider !== provider) invalid();
  return value;
}
