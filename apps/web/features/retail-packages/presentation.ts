import {
  LogisticsStage as ShipmentLogisticsStage,
  ShipmentChargeCode,
  ShipmentMilestoneCode,
  type LogisticsStageCode,
  type ShipmentChargeCodeValue,
  type ShipmentMilestoneCodeValue,
} from "@nexora/shared/shipment";
import type { RetailTabKey, RetailQuery, ShipmentListQuery } from "./types.ts";
export const RETAIL_TAB_LABELS = {
  all: "Tất cả kiện hàng",
  to_origin: "Đang đến kho gửi",
  at_origin: "Đã về kho gửi",
  in_transit: "Đang về kho nhận",
  at_dest: "Đã về kho nhận",
  delivered: "Đã giao hàng",
  disputed: "Khiếu nại / Xử lý",
} satisfies Record<RetailTabKey, string>;
export const STATUS_TABS = (
  Object.keys(RETAIL_TAB_LABELS) as RetailTabKey[]
).map((key) => ({ key, label: RETAIL_TAB_LABELS[key] }));
export const STATUS_LABELS = {
  to_origin: RETAIL_TAB_LABELS.to_origin,
  at_origin: RETAIL_TAB_LABELS.at_origin,
  in_transit: RETAIL_TAB_LABELS.in_transit,
  at_dest: RETAIL_TAB_LABELS.at_dest,
  delivered: RETAIL_TAB_LABELS.delivered,
  disputed: "Khiếu nại",
} satisfies Record<Exclude<RetailTabKey, "all">, string>;
const tabs = {
  all: undefined,
  to_origin: ShipmentLogisticsStage.TO_ORIGIN_WAREHOUSE,
  at_origin: ShipmentLogisticsStage.AT_ORIGIN_WAREHOUSE,
  in_transit: ShipmentLogisticsStage.TO_DEST_WAREHOUSE,
  at_dest: ShipmentLogisticsStage.AT_DEST_WAREHOUSE,
  delivered: ShipmentLogisticsStage.DELIVERED,
  disputed: null,
} satisfies Record<RetailTabKey, LogisticsStageCode | null | undefined>;
const stages = {
  TO_ORIGIN_WAREHOUSE: "to_origin",
  AT_ORIGIN_WAREHOUSE: "at_origin",
  TO_DEST_WAREHOUSE: "in_transit",
  AT_DEST_WAREHOUSE: "at_dest",
  DELIVERED: "delivered",
  UNKNOWN: null,
} as const satisfies Record<
  LogisticsStageCode,
  Exclude<RetailTabKey, "all" | "disputed"> | null
>;
const labels = {
  TO_ORIGIN_WAREHOUSE: STATUS_LABELS.to_origin,
  AT_ORIGIN_WAREHOUSE: STATUS_LABELS.at_origin,
  TO_DEST_WAREHOUSE: STATUS_LABELS.in_transit,
  AT_DEST_WAREHOUSE: STATUS_LABELS.at_dest,
  DELIVERED: STATUS_LABELS.delivered,
  UNKNOWN: "Chưa xác định",
} satisfies Record<LogisticsStageCode, string>;
export const tabToStage = (tab: RetailTabKey) => tabs[tab];
export const stageToTab = (stage: LogisticsStageCode) => stages[stage];
export const stageLabel = (stage: LogisticsStageCode) => labels[stage];
export function shipmentListQuery(
  query: RetailQuery,
): ShipmentListQuery | null {
  const stage = tabToStage(query.status);
  if (stage === null) return null;
  return {
    ...(stage ? { stage } : {}),
    ...(query.search ? { q: query.search } : {}),
    page: query.page,
    pageSize: query.pageSize,
  };
}
export const providerLabel = (provider: string | null) =>
  provider === "uniship" ? "Uniship" : (provider ?? "—");
const chargeLabels = {
  UNIT_PRICE: "Đơn giá",
  DOMESTIC_SHIPPING: "Ship nội địa",
  INSURANCE: "Bảo hiểm",
  COUNTING: "Kiểm đếm",
  WOOD_PACKING: "Đóng gỗ",
  BUBBLE_WRAP: "Bọt khí",
  OTHER: "Khác",
} satisfies Record<ShipmentChargeCodeValue, string>;
export const chargeLabel = (
  code: ShipmentChargeCodeValue,
  provider: string | null,
) =>
  code === ShipmentChargeCode.OTHER
    ? (provider ?? chargeLabels.OTHER)
    : chargeLabels[code];
export const MILESTONE_LABELS = {
  ORIGIN_RECEIVED: "Nhập kho gửi",
  ORIGIN_DISPATCHED: "Xuất kho gửi",
  DEST_RECEIVED: "Nhập kho nhận",
  DEST_DISPATCHED: "Xuất kho nhận",
} satisfies Record<ShipmentMilestoneCodeValue, string>;
export const MILESTONE_ORDER = Object.values(ShipmentMilestoneCode);
