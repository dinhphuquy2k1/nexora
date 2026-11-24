// Actual-component synthetic GET adapter; never imported by production.
import { createRoot } from "react-dom/client";
import { ShipmentApiError } from "../../features/retail-packages/errors.ts";
import { ToastProvider } from "@nexora/ui";
import { RetailPackageListPage } from "../../features/retail-packages/RetailPackageListPage.tsx";
import {
  createRetailFixtureApi,
  FIXTURE_DETAILS,
  REFERENCE_DETAILS,
} from "./retail-packages.ts";
import "../../styles/globals.css";
const params = new URLSearchParams(location.search),
  mode = params.get("fixtureMode") ?? "ready";
params.delete("fixtureMode");
const search = params.toString();
history.replaceState(
  null,
  "",
  location.pathname + (search ? "?" + search : ""),
);
// Mutable synthetic population exists only in the explicitly selected review fixture.
const reviewDetails = Array.from({ length: 100 }, (_, i) => ({
  ...structuredClone(FIXTURE_DETAILS[0]),
  id: `10000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`,
  logisticsStage: "AT_ORIGIN_WAREHOUSE" as const,
  trackingCode: `REFRESH-${String(i + 1).padStart(3, "0")}`,
}));
const population = [...reviewDetails];
let failure = false;
const events: { method: string; query?: unknown; aborted?: boolean }[] = [];
let held = mode === "held";
const releases = new Set<() => void>();
Object.assign(window, {
  __retailFixture: {
    events,
    mode,
    replaceCount: (count: number) => {
      population.splice(0, population.length, ...reviewDetails.slice(0, count));
    },
    fail: (value: boolean) => {
      failure = value;
    },
    hold: () => {
      held = true;
    },
    release: () => {
      held = false;
      for (const release of releases) release();
      releases.clear();
    },
  },
});
const fixtureApi = createRetailFixtureApi(
  location.pathname === "/reference-sample"
    ? REFERENCE_DETAILS
    : mode === "refresh"
      ? population
      : FIXTURE_DETAILS,
  mode === "held" ? "ready" : mode,
  events,
);
const api = {
  ...fixtureApi,
  list: async (...args: Parameters<typeof fixtureApi.list>) => {
    const response = await fixtureApi.list(...args);
    if (held) await new Promise<void>((resolve) => releases.add(resolve));
    if (failure) throw new ShipmentApiError(500, { code: "INTERNAL_ERROR" });
    return response;
  },
};
createRoot(document.getElementById("fixture-root")!).render(
  <ToastProvider>
    <div data-retail-fixture data-fixture-mode={mode}>
      <p>Môi trường kiểm thử cô lập — dữ liệu tổng hợp, không lưu.</p>
      <RetailPackageListPage api={api} initialSearch={"?" + search} />
    </div>
  </ToastProvider>,
);
