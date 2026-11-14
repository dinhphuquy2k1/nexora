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
