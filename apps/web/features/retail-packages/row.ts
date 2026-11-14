import type { ShipmentSummary, RetailRow } from "./types.ts";
import { providerLabel, stageLabel, stageToTab } from "./presentation.ts";
import { formatWeight, formatMoney, formatDate } from "./format.ts";
function fee(group: ShipmentSummary["chargeSummary"]["unitPrice"]): string {
  if (group.state === "MULTIPLE") return "Nhiều dòng";
  if (group.state === "SINGLE")
    return formatMoney(group.amount, group.currency);
  return "—";
}
export function toRetailRow(s: ShipmentSummary): RetailRow {
  return {
    id: s.id,
    trackingCode: s.trackingCode,
    carrierLabel: providerLabel(s.provider),
    productName:
      s.itemSummary.firstName === null
        ? "—"
        : s.itemSummary.firstName +
          (s.itemSummary.lineCount > 1
            ? ` +${s.itemSummary.lineCount - 1}`
            : ""),
    itemCount: s.itemCount === null ? "—" : String(s.itemCount),
    packageCount: s.packageCount === null ? "—" : String(s.packageCount),
    originWarehouseDate: formatDate(s.milestoneSummary.originReceivedAt),
    originWarehouseExportDate: formatDate(
      s.milestoneSummary.originDispatchedAt,
    ),
    destWarehouseDate: formatDate(s.milestoneSummary.destReceivedAt),
    destWarehouseExportDate: formatDate(s.milestoneSummary.destDispatchedAt),
    weightKg: formatWeight(s.weightKg),
    unitPriceCNY: fee(s.chargeSummary.unitPrice),
    domesticShipCNY: fee(s.chargeSummary.domesticShipping),
    valueCNY: formatMoney(s.declaredValue, s.declaredCurrency),
    hasInsurance: s.chargeSummary.hasInsurance,
    hasInspection: s.chargeSummary.hasCounting,
    hasWoodenCrate: s.chargeSummary.hasWoodPacking,
    hasBubbleWrap: s.chargeSummary.hasBubbleWrap,
    status: stageToTab(s.logisticsStage),
    statusText: stageLabel(s.logisticsStage),
    originWarehouseName: s.originWarehouse ?? "—",
    destWarehouseName: s.milestoneSummary.destWarehouse ?? "—",
    totalAmountVND: formatMoney(s.totalAmount, s.totalCurrency),
  };
}
