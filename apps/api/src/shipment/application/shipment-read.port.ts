import type { LogisticsStageCode } from "@nexora/shared/shipment";
export interface ShipmentQuery {
  page: number;
  pageSize: number;
  q?: string;
  stage?: LogisticsStageCode;
}
export interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}
export interface ShipmentSummary {
  id: string;
  code: string;
  trackingCode: string;
  shipmentKind: string;
  provider: string | null;
  logisticsStage: LogisticsStageCode;
  providerStatus: string | null;
  providerClaimStatus: string | null;
  customerId: string | null;
  totalAmount: string | null;
  totalCurrency: string | null;
  createdAt: Date;
  updatedAt: Date;
}
export interface ShipmentChargeView {
  id: string;
  lineNo: number;
  chargeCode: string;
  amount: string;
  currency: string;
  providerLabel: string | null;
}
export interface ShipmentDetail extends ShipmentSummary {
  originWarehouse: string | null;
  serviceLevel: string | null;
  weightKg: string | null;
  packageCount: number | null;
  itemCount: number | null;
  declaredValue: string | null;
  declaredCurrency: string | null;
  exchangeRate: string | null;
  exchangeRateAt: Date | null;
  providerUpdatedAt: Date | null;
  lastSyncedAt: Date | null;
  assigneeUserId: string | null;
  internalNote: string | null;
  charges: ShipmentChargeView[];
}
export interface ShipmentHistoryView {
  id: string;
  sourceVersion: number;
  processorVersion: number;
  fromStage: LogisticsStageCode | null;
  toStage: LogisticsStageCode;
  providerStatus: string | null;
  providerChangedAt: Date | null;
  observedAt: Date;
}
export interface ShipmentPage {
  shipments: ShipmentSummary[];
  pagination: Pagination;
  stats: {
    total: number;
    byStage: Record<LogisticsStageCode, number>;
    claims: null;
  };
  claimFilterAvailable: false;
}
export interface ShipmentHistoryPage {
  history: ShipmentHistoryView[];
  pagination: Pagination;
}
export abstract class ShipmentReadPort {
  abstract list(owner: string, query: ShipmentQuery): Promise<ShipmentPage>;
  abstract get(owner: string, id: string): Promise<ShipmentDetail>;
  abstract history(
    owner: string,
    id: string,
    query: ShipmentQuery,
  ): Promise<ShipmentHistoryPage>;
}
