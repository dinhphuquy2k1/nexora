// Isolated fixture entry: never imported by a product route or authentication guard.
import { createRoot } from "react-dom/client";
import { SyncIssuesFixture } from "./sync-issues.tsx";
import { ToastProvider } from "@nexora/ui";
import { CarrierConnectionsPage } from "../../features/carrier-connections/CarrierConnectionsPage.tsx";
import {
  CARRIER_FIXTURES,
  SYNC_FIXTURE,
  PARITY_ROWS,
  PARITY_SYNC,
  PARITY_PROVIDERS,
} from "./carrier-connections.ts";
import "../../app/styles.css";
const params = new URLSearchParams(location.search),
  parity = params.has("parity"),
  statusCase = (["CONNECTED", "ERROR", "REAUTH_REQUIRED"] as const).find(
    (status) => status === params.get("statusCase"),
  ),
  environmentCase = (["production", "sandbox"] as const).find(
    (environment) => environment === params.get("environmentCase"),
  ),
  baseRecords = params.has("empty")
    ? []
    : parity
      ? PARITY_ROWS
      : CARRIER_FIXTURES,
  sync = parity ? PARITY_SYNC : SYNC_FIXTURE;
const records = statusCase
  ? [
      {
        ...PARITY_ROWS[0],
        status: statusCase,
        preview: { ...PARITY_ROWS[0].preview, environment: environmentCase },
      },
    ]
  : baseRecords;
createRoot(document.getElementById("fixture-root")!).render(
  <ToastProvider>
    <style>{`[data-parity-stage]{position:absolute;left:var(--workspace-gutter);right:var(--workspace-gutter);top:calc(var(--header-height) + var(--workspace-padding-block));height:calc(100dvh - var(--header-height) - 2 * var(--workspace-padding-block));display:flex;flex-direction:column;min-height:0;}@media(min-width:901px){[data-parity-stage]{left:calc(var(--sidebar-width) + var(--workspace-gutter));}}`}</style>
    <div
      data-fixture-label
      aria-label="Dữ liệu kiểm thử"
      style={{ position: "absolute", left: 0, top: 0, fontSize: 10 }}
    >
      Dữ liệu kiểm thử tổng hợp — không kết nối hãng, không lưu.
    </div>
    <div data-parity-stage>
      <CarrierConnectionsPage
        records={records}
        previewProviders={parity ? PARITY_PROVIDERS : undefined}
        syncByConnection={Object.fromEntries(
          records.map((row, index) => [
            row.id,
            parity && index > 0
              ? {
                  ...sync,
                  items: sync.items.map((item) => ({
                    ...item,
                    state: "completed",
                    progress: undefined,
                    total: 1240,
                  })),
                }
              : sync,
          ]),
        )}
      />
    </div>
    {params.has("syncIssues") && <SyncIssuesFixture />}
  </ToastProvider>,
);
