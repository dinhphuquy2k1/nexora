/** Persisted Shipment codes shared with the approved read API contract. */
export const ShipmentKind = { RETAIL_PARCEL: "RETAIL_PARCEL" } as const;
export type ShipmentKindCode = (typeof ShipmentKind)[keyof typeof ShipmentKind];
export const LogisticsStage = {
  TO_ORIGIN_WAREHOUSE: "TO_ORIGIN_WAREHOUSE",
  AT_ORIGIN_WAREHOUSE: "AT_ORIGIN_WAREHOUSE",
  TO_DEST_WAREHOUSE: "TO_DEST_WAREHOUSE",
  AT_DEST_WAREHOUSE: "AT_DEST_WAREHOUSE",
  DELIVERED: "DELIVERED",
  UNKNOWN: "UNKNOWN",
} as const;
export type LogisticsStageCode =
  (typeof LogisticsStage)[keyof typeof LogisticsStage];
export const ShipmentChargeCode = {
  WEIGHT_FREIGHT: "WEIGHT_FREIGHT",
  UNIT_PRICE: "UNIT_PRICE",
  DOMESTIC_SHIPPING: "DOMESTIC_SHIPPING",
  INSURANCE: "INSURANCE",
  COUNTING: "COUNTING",
  WOOD_PACKING: "WOOD_PACKING",
  BUBBLE_WRAP: "BUBBLE_WRAP",
  OTHER: "OTHER",
} as const;
export type ShipmentChargeCodeValue =
  (typeof ShipmentChargeCode)[keyof typeof ShipmentChargeCode];

export const ShipmentMilestoneCode = {
  ORIGIN_RECEIVED: "ORIGIN_RECEIVED",
  ORIGIN_DISPATCHED: "ORIGIN_DISPATCHED",
  DEST_RECEIVED: "DEST_RECEIVED",
  DEST_DISPATCHED: "DEST_DISPATCHED",
} as const;
export type ShipmentMilestoneCodeValue =
  (typeof ShipmentMilestoneCode)[keyof typeof ShipmentMilestoneCode];

/** Independent optional-service facts; never inferred from monetary charges. */
export const ShipmentServiceCode = {
  INSURANCE: "INSURANCE",
  COUNTING: "COUNTING",
  FRAGILE_GOODS: "FRAGILE_GOODS",
  FOAM: "FOAM",
} as const;
export type ShipmentServiceCodeValue =
  (typeof ShipmentServiceCode)[keyof typeof ShipmentServiceCode];

/** Canonical Shipment weight and freight-price unit on the wire. */
export const ShipmentWeightUnit = { KILOGRAM: "kg" } as const;
export type ShipmentWeightUnitCode =
  (typeof ShipmentWeightUnit)[keyof typeof ShipmentWeightUnit];
