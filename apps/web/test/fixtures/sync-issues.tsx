// Isolated UI/SDK fixture only; never imported by a production route.
import { useState } from "react";
import { CarrierDataSyncDrawer } from "../../features/carrier-connections/CarrierDataSyncDrawer.tsx";
import { createSyncApi } from "../../features/carrier-connections/sync-api.ts";
import { CARRIER_FIXTURES, SYNC_FIXTURE } from "./carrier-connections.ts";
import type { SyncPresentation } from "../../features/carrier-connections/types.ts";
const api = createSyncApi();
export const ISSUE_CONNECTION_ID = "11111111-1111-4111-8111-111111111111";
export const issueJobId = (n: number) =>
  "22222222-2222-4222-8222-" + String(n).padStart(12, "0");
const data: SyncPresentation = {
  items: SYNC_FIXTURE.items
    .slice(0, 2)
    .map((item, i) => ({
      ...item,
      available: true,
      autoEnabled: false,
      state: "completed",
      warning: true,
      jobId: issueJobId(i + 1),
    })),
  history: Array.from({ length: 6 }, (_, i) => ({
    id: issueJobId(i + 1),
    time: "Synthetic",
    startedAt: "2026-01-01T00:00:00Z",
    dataType: "SHIPMENT",
    source: "Thủ công",
    state: i < 3 ? "completed" : "failed",
    warning: true,
    records: 100,
    detail: "Synthetic safe counters",
  })),
};
const read = (jobId: string, page: number, signal: AbortSignal) =>
  api.jobDetail(ISSUE_CONNECTION_ID, jobId, page, signal);
export function SyncIssuesFixture() {
  const [open, setOpen] = useState(true);
  return open ? (
    <CarrierDataSyncDrawer
      row={{ ...CARRIER_FIXTURES[0], id: ISSUE_CONNECTION_ID }}
      data={data}
      jobDetail={read}
      onDetailUnauthorized={() => {
        document.body.dataset.syncDenied = "true";
      }}
      onClose={() => setOpen(false)}
    />
  ) : null;
}
