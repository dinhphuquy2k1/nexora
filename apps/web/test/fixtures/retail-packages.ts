// Synthetic DTO sources and GET adapter only. Production never imports this file.
import { LogisticsStage, ShipmentChargeCode } from "@nexora/shared/shipment";
import type {
  ShipmentSummary,
  ShipmentDetail,
  ShipmentHistoryPage,
  ShipmentPage,
} from "../../features/retail-packages/types.ts";
import type { ShipmentApi } from "../../features/retail-packages/api.ts";
import { ShipmentApiError } from "../../features/retail-packages/errors.ts";
import {
  readShipmentPage,
  readShipment,
  readShipmentHistory,
} from "../../features/retail-packages/response.ts";
import { tabToStage } from "../../features/retail-packages/presentation.ts";
import { SYNTHETIC_PACKAGES } from "./retail-reference.ts";
export { SYNTHETIC_PACKAGES } from "./retail-reference.ts";
const iso = (value: string | undefined) => {
  if (!value) return null;
  const [d, m, y] = value.split("/");
  return `${y}-${m}-${d}T05:00:00.000Z`;
};
const id = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
export const REFERENCE_DETAILS: ShipmentDetail[] = SYNTHETIC_PACKAGES.map(
  (p, index) => {
    const rootId = id(index + 1),
      stage = tabToStage(p.status) ?? LogisticsStage.UNKNOWN;
    const charges: ShipmentDetail["charges"] = [
      {
        id: id(1000 + index * 10),
        lineNo: 1,
        chargeCode: ShipmentChargeCode.UNIT_PRICE,
        amount: p.unitPriceCNY.toFixed(2),
        currency: "CNY",
        providerLabel: null,
      },
    ];
    if (p.domesticShipCNY > 0)
      charges.push({
        id: id(1001 + index * 10),
        lineNo: charges.length + 1,
        chargeCode: ShipmentChargeCode.DOMESTIC_SHIPPING,
        amount: p.domesticShipCNY.toFixed(2),
        currency: "CNY",
        providerLabel: null,
      });
    for (const [enabled, code] of [
      [p.hasInsurance, ShipmentChargeCode.INSURANCE],
      [p.hasInspection, ShipmentChargeCode.COUNTING],
      [p.hasWoodenCrate, ShipmentChargeCode.WOOD_PACKING],
      [p.hasBubbleWrap, ShipmentChargeCode.BUBBLE_WRAP],
    ] as const)
      if (enabled)
        charges.push({
          id: id(2000 + index * 10 + charges.length),
          lineNo: charges.length + 1,
          chargeCode: code,
          amount: "0.00",
          currency: "CNY",
          providerLabel: null,
        });
    const milestones: ShipmentDetail["milestones"] = [];
    for (const [code, date, location] of [
      ["ORIGIN_RECEIVED", p.originWarehouseDate, p.originWarehouseName],
      ["ORIGIN_DISPATCHED", p.originWarehouseExportDate, p.originWarehouseName],
      ["DEST_RECEIVED", p.destWarehouseDate, p.destWarehouseName],
      ["DEST_DISPATCHED", p.destWarehouseExportDate, p.destWarehouseName],
    ] as const) {
      const occurredAt = iso(date);
      if (occurredAt)
        milestones.push({
          id: id(3000 + index * 10 + milestones.length),
          milestoneCode: code,
          occurredAt,
          locationName: location,
          providerLabel: null,
        });
    }
    const occurred = (code: string) =>
      milestones.find((m) => m.milestoneCode === code)?.occurredAt ?? null;
    return {
      id: rootId,
      code: `SHP${String(index + 1).padStart(6, "0")}`,
      trackingCode: p.trackingCode,
      shipmentKind: "RETAIL_PARCEL",
      provider:
        p.carrierProviderName === "Uniship" ? "uniship" : p.carrierProviderName,
      logisticsStage: stage,
      providerStatus: null,
      providerClaimStatus: null,
      customerId: null,
      createdAt: new Date(
        Date.UTC(2026, 10, 14, 0, 0, 6 - index),
      ).toISOString(),
      updatedAt: new Date(
        Date.UTC(2026, 10, 14, 0, 0, 6 - index),
      ).toISOString(),
      originWarehouse: p.originWarehouseName,
      weightKg: p.weightKg.toFixed(3),
      packageCount: p.packageCount,
      itemCount: p.itemCount,
      declaredValue: p.valueCNY.toFixed(2),
      declaredCurrency: "CNY",
      totalAmount:
        p.totalAmountVND !== undefined ? p.totalAmountVND.toFixed(2) : null,
      totalCurrency: p.totalAmountVND === undefined ? null : "VND",
      chargeSummary: {
        unitPrice: {
          state: "SINGLE",
          amount: p.unitPriceCNY.toFixed(2),
          currency: "CNY",
        },
        domesticShipping: {
          state: p.domesticShipCNY > 0 ? "SINGLE" : "NONE",
          amount: p.domesticShipCNY > 0 ? p.domesticShipCNY.toFixed(2) : null,
          currency: p.domesticShipCNY > 0 ? "CNY" : null,
        },
        hasInsurance: p.hasInsurance,
        hasCounting: p.hasInspection,
        hasWoodPacking: p.hasWoodenCrate,
        hasBubbleWrap: p.hasBubbleWrap,
      },
      milestoneSummary: {
        originReceivedAt: occurred("ORIGIN_RECEIVED"),
        originDispatchedAt: occurred("ORIGIN_DISPATCHED"),
        destReceivedAt: occurred("DEST_RECEIVED"),
        destDispatchedAt: occurred("DEST_DISPATCHED"),
        destWarehouse:
          milestones.find((m) => m.milestoneCode === "DEST_RECEIVED")
            ?.locationName ?? null,
      },
      itemSummary: { firstName: p.productName, lineCount: 1 },
      serviceLevel: null,
      exchangeRate: null,
      exchangeRateAt: null,
      providerUpdatedAt: null,
      lastSyncedAt: null,
      assigneeUserId: null,
      internalNote: null,
      charges,
      milestones,
      items: [
        {
          id: id(4000 + index),
          lineNo: 1,
          name: p.productName,
          quantity: p.itemCount,
          unitValue: null,
          currency: null,
        },
      ],
    };
  },
);
export function asSummary(detail: ShipmentDetail): ShipmentSummary {
  const {
    serviceLevel,
    exchangeRate,
    exchangeRateAt,
    providerUpdatedAt,
    lastSyncedAt,
    assigneeUserId,
    internalNote,
    charges,
    milestones,
    items,
    ...summary
  } = detail;
  void [
    serviceLevel,
    exchangeRate,
    exchangeRateAt,
    providerUpdatedAt,
    lastSyncedAt,
    assigneeUserId,
    internalNote,
    charges,
    milestones,
    items,
  ];
  return summary;
}
export const FIXTURE_DETAILS: ShipmentDetail[] = Array.from(
  { length: 30 },
  (_, i) => {
    const d = structuredClone(REFERENCE_DETAILS[i % 6]);
    d.id = id(100 + i);
    d.trackingCode = `FIXTURE${String(i).padStart(4, "0")}`;
    d.logisticsStage = Object.values(LogisticsStage)[i % 6];
    d.weightKg = (i + 1).toFixed(3);
    d.createdAt = new Date(Date.UTC(2026, 1, 1, 0, 0, 30 - i)).toISOString();
    const name = i === 0 ? "Sản phẩm kiểm thử dài ".repeat(8) : `Sản phẩm ${i}`;
    d.items = [
      {
        id: id(5000 + i),
        lineNo: 1,
        name,
        quantity: null,
        unitValue: i === 0 ? "1234567890123456.78" : null,
        currency: i === 0 ? "CNY" : null,
      },
    ];
    if (i === 0)
      d.items.push({
        id: id(6000 + i),
        lineNo: 2,
        name: "Sản phẩm bổ sung",
        quantity: 2,
        unitValue: null,
        currency: null,
      });
    d.itemSummary = { firstName: name, lineCount: d.items.length };
    d.totalAmount = null;
    d.totalCurrency = null;
    if (i === 0) {
      d.chargeSummary.unitPrice = {
        state: "MULTIPLE",
        amount: null,
        currency: null,
      };
      d.charges.push({
        id: id(7000 + i),
        lineNo: d.charges.length + 1,
        chargeCode: "UNIT_PRICE",
        amount: "9.99",
        currency: "USD",
        providerLabel: null,
      });
    }
    if (i === 1) {
      d.weightKg = null;
      d.declaredValue = null;
      d.declaredCurrency = null;
    }
    d.milestoneSummary.originReceivedAt = `2026-02-${String(10 + (i % 10)).padStart(2, "0")}T05:00:00.000Z`;
    const origin = d.milestones.find(
      (m) => m.milestoneCode === "ORIGIN_RECEIVED",
    );
    if (origin) origin.occurredAt = d.milestoneSummary.originReceivedAt;
    else
      d.milestones.unshift({
        id: id(8000 + i),
        milestoneCode: "ORIGIN_RECEIVED",
        occurredAt: d.milestoneSummary.originReceivedAt,
        locationName: d.originWarehouse,
        providerLabel: null,
      });
    return d;
  },
);
export function createRetailFixtureApi(
  details: readonly ShipmentDetail[] = FIXTURE_DETAILS,
  mode = "ready",
  events: { method: string; query?: unknown; aborted?: boolean }[] = [],
): ShipmentApi {
  const wait = (signal?: AbortSignal) =>
    new Promise<void>((resolve, reject) => {
      if (signal?.aborted) {
        reject(new DOMException("Aborted", "AbortError"));
        return;
      }
      const stop = () => {
        clearTimeout(timer);
        signal?.removeEventListener("abort", abort);
      };
      const abort = () => {
        stop();
        events.push({ method: "abort", aborted: true });
        reject(new DOMException("Aborted", "AbortError"));
      };
      const timer = setTimeout(
        () => {
          stop();
          resolve();
        },
        mode === "slow" ? 300 : 0,
      );
      signal?.addEventListener("abort", abort, { once: true });
    });
  return {
    async list(query, signal) {
      events.push({ method: "list", query: { ...query } });
      await wait(signal);
      if (mode === "error") throw Error("Synthetic network failure");
      if (mode === "malformed") return readShipmentPage({});
      const q = (query.q ?? "").toLocaleLowerCase("vi");
      const searched =
        mode === "empty" || q === "fixture-empty"
          ? []
          : details
              .filter((d) => d.trackingCode.toLocaleLowerCase("vi").includes(q))
              .sort(
                (a, b) =>
                  b.createdAt.localeCompare(a.createdAt) ||
                  b.id.localeCompare(a.id),
              );
      const byStage = Object.fromEntries(
        Object.values(LogisticsStage).map((stage) => [
          stage,
          searched.filter((d) => d.logisticsStage === stage).length,
        ]),
      ) as ShipmentPage["stats"]["byStage"];
      const filtered = query.stage
        ? searched.filter((d) => d.logisticsStage === query.stage)
        : searched;
      return readShipmentPage({
        shipments: filtered
          .slice((query.page - 1) * query.pageSize, query.page * query.pageSize)
          .map(asSummary),
        pagination: {
          page: query.page,
          pageSize: query.pageSize,
          total: filtered.length,
          totalPages: Math.ceil(filtered.length / query.pageSize),
        },
        stats: { total: searched.length, byStage, claims: null },
        claimFilterAvailable: false,
      });
    },
    async get(value, signal) {
      events.push({ method: "get" });
      await wait(signal);
      const detail = details.find((d) => d.id === value);
      if (!detail || mode === "not-found")
        throw new ShipmentApiError(404, { code: "NOT_FOUND" });
      return readShipment({ shipment: structuredClone(detail) });
    },
    async history(value, query, signal) {
      events.push({ method: "history", query });
      await wait(signal);
      const detail = details.find((d) => d.id === value);
      if (!detail) throw new ShipmentApiError(404, { code: "NOT_FOUND" });
      const history: ShipmentHistoryPage = {
        history: [
          {
            id: id(9000 + details.indexOf(detail)),
            sourceVersion: 1,
            processorVersion: 1,
            fromStage: null,
            toStage: detail.logisticsStage,
            providerStatus: null,
            observedAt: "2026-11-14T00:00:00.000Z",
            providerChangedAt:
              details.indexOf(detail) % 2 === 0
                ? "2026-11-13T23:59:00.000Z"
                : null,
          },
        ],
        pagination: { ...query, total: 1, totalPages: 1 },
      };
      return readShipmentHistory(history);
    },
  };
}
