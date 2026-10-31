// Browser test entry only: never imported by a production route or feature.
import type { RetailPackage } from "../../features/retail-packages/types.ts";
import { createRoot } from "react-dom/client";
import { ToastProvider } from "@nexora/ui";
import { RetailPackageListPage } from "../../features/retail-packages/RetailPackageListPage.tsx";
import { STATUS_LABELS } from "../../features/retail-packages/columns.ts";
import { SYNTHETIC_PACKAGES } from "./retail-packages.ts";
import "../../app/styles.css";
const packages = Array.from({ length: 30 }, (_, i) => ({
  ...SYNTHETIC_PACKAGES[i % 6],
  id: `fixture-${i}`,
  status: (
    [
      "to_origin",
      "at_origin",
      "in_transit",
      "at_dest",
      "delivered",
      "disputed",
    ] as const
  )[i % 6],
  statusText:
    STATUS_LABELS[
      (
        [
          "to_origin",
          "at_origin",
          "in_transit",
          "at_dest",
          "delivered",
          "disputed",
        ] as const
      )[i % 6]
    ],
  trackingCode: `FIXTURE${String(i).padStart(4, "0")}`,
  weightKg: i + 1,
  originWarehouseDate: String(10 + (i % 10)).padStart(2, "0") + "/02/2026",
  productName: i === 0 ? "Sản phẩm kiểm thử dài ".repeat(8) : `Sản phẩm ${i}`,
  totalAmountVND: undefined,
}));
const params = new URLSearchParams(location.search);
let data: readonly RetailPackage[] = packages;
if (location.pathname === "/reference-sample") data = [...SYNTHETIC_PACKAGES];
if (params.get("search") === "fixture-empty") data = [];
createRoot(document.getElementById("fixture-root")!).render(
  <ToastProvider>
    <div data-retail-fixture>
      <p>Môi trường kiểm thử cô lập — dữ liệu tổng hợp, không lưu.</p>
      <RetailPackageListPage initialPackages={data} availability="available" />
    </div>
  </ToastProvider>,
);
