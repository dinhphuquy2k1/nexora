import type { components, paths } from "@nexora/sdk";
export type ShipmentSummary = components["schemas"]["ShipmentSummaryDto"];
export type ShipmentDetail = components["schemas"]["ShipmentDetailDto"];
export type ShipmentPage = components["schemas"]["ShipmentPageDto"];
export type ShipmentHistoryPage =
  components["schemas"]["ShipmentHistoryPageDto"];
export type ShipmentHistory = components["schemas"]["ShipmentHistoryDto"];
type ApiQuery = NonNullable<
  paths["/api/shipments"]["get"]["parameters"]["query"]
>;
export type ShipmentListQuery = Required<Pick<ApiQuery, "page" | "pageSize">> &
  Pick<ApiQuery, "q" | "stage">;
export type RetailTabKey =
  | "all"
  | "to_origin"
  | "at_origin"
  | "in_transit"
  | "at_dest"
  | "delivered"
  | "disputed";
export interface TrackingStep {
  readonly title: string;
  readonly time: string;
  readonly completed: boolean;
  readonly current?: boolean;
  readonly description: string;
}
/** Formatted read-only view data; never persisted or used to derive backend totals. */
export interface RetailRow {
  readonly id: string;
  readonly trackingCode: string;
  readonly carrierLabel: string;
  readonly productName: string;
  readonly itemCount: string;
  readonly packageCount: string;
  readonly originWarehouseDate: string;
  readonly originWarehouseExportDate: string;
  readonly destWarehouseDate: string;
  readonly destWarehouseExportDate: string;
  readonly weightKg: string;
  readonly unitPriceCNY: string;
  readonly domesticShipCNY: string;
  readonly valueCNY: string;
  readonly hasInsurance: boolean;
  readonly hasInspection: boolean;
  readonly hasWoodenCrate: boolean;
  readonly hasBubbleWrap: boolean;
  readonly status: Exclude<RetailTabKey, "all" | "disputed"> | null;
  readonly statusText: string;
  readonly originWarehouseName: string;
  readonly destWarehouseName: string;
  readonly totalAmountVND: string;
}

/** Column configuration for the retail packages table. */
export interface ColumnConfig {
  readonly id: string;
  readonly width: number;
  readonly basic?: boolean;
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

/** URL state for Retail; legacy filters are parsed but do not affect API results. */
export interface RetailQuery {
  readonly status: RetailTabKey;
  readonly search: string;
  readonly page: number;
  readonly pageSize: number;
  readonly filters: readonly FilterCondition[];
}
