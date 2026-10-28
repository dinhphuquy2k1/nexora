/**
 * Retail Packages (Kiện lẻ TMĐT) — presentation-only types.
 *
 * These are view/UI types only. There is no persisted shipment domain or
 * backend API for retail packages in the current sprint. All data presented
 * in this module comes from synthetic test fixtures; the production UI will
 * render an honest empty/planned state when no real data is available.
 *
 * Domain ownership: Shipment presentation (UI only).
 * Backend: NOT IMPLEMENTED. No API calls for retail packages.
 */

/** Status values for a retail package — presentation layer only. */
export type RetailPackageStatus =
  | "to_origin"
  | "at_origin"
  | "in_transit"
  | "at_dest"
  | "delivered"
  | "disputed";

/** Tab filter keys for the status bar. */
export type StatusTabKey = "all" | RetailPackageStatus;

/** A single step in the tracking timeline. */
export interface TrackingStep {
  readonly title: string;
  readonly time: string;
  readonly completed: boolean;
  readonly current?: boolean;
  readonly description: string;
}

/**
 * A retail package record as displayed in the list.
 * This is a presentation model, not a domain entity.
 * Fields reflect what the reference ZIP presents; no fake business values
 * should be computed from these in production.
 */
export interface RetailPackage {
  readonly id: string;
  readonly trackingCode: string;
  readonly carrierConnectionId: string;
  readonly carrierProviderName: string;
  readonly accountConnectionId: string;
  readonly accountName: string;
  readonly carrierId: string;
  readonly carrierCode: string;
  readonly carrierName: string;
  readonly carrierService: string;
  readonly productName: string;
  readonly itemCount: number;
  readonly packageCount: number;
  readonly originWarehouseDate: string | undefined;
  readonly originWarehouseExportDate: string | undefined;
  readonly destWarehouseDate: string | undefined;
  readonly destWarehouseExportDate: string | undefined;
  readonly weightKg: number;
  readonly unitPriceCNY: number;
  readonly domesticShipCNY: number;
  readonly valueCNY: number;
  readonly hasInsurance: boolean;
  readonly hasInspection: boolean;
  readonly hasWoodenCrate: boolean;
  readonly hasBubbleWrap: boolean;
  readonly status: RetailPackageStatus;
  readonly statusText: string;
  readonly originWarehouseName: string;
  readonly destWarehouseName: string;
  readonly totalAmountVND: number;
  readonly timeline: readonly TrackingStep[];
}

/** Column configuration for the retail packages table. */
export interface ColumnConfig {
  readonly id: string;
  readonly label: string;
  readonly defaultVisible: boolean;
  readonly required?: boolean;
  readonly align?: "left" | "center" | "right";
}

/** Column visibility map keyed by column id. */
export type ColumnVisibility = Record<string, boolean>;

/** Active filter chip. */
export interface FilterCondition {
  readonly id: string;
  readonly field: string;
  readonly operator: string;
  readonly value: string;
  readonly displayLabel: string;
}

/** Query state for retail packages list — all client-side (no API). */
export interface RetailQuery {
  readonly status: StatusTabKey;
  readonly search: string;
  readonly page: number;
  readonly pageSize: number;
  readonly filters: readonly FilterCondition[];
}
