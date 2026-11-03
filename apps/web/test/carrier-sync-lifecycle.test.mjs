import test from "node:test";
import assert from "node:assert/strict";
import { setImmediate } from "node:timers";
import { componentHarness } from "./helpers/component-harness.mjs";
import { loadComponent, React, render } from "./helpers/render-component.mjs";

const tick = () => new Promise((resolve) => setImmediate(resolve));
test("Sync mutation 401 fences pending reads, reconciliation, retries and late successful responses", async () => {
  const { SyncApiError } = loadComponent(
    new URL("../features/carrier-connections/sync-api.ts", import.meta.url),
  );
  let reads = 0,
    writes = 0,
    redirects = 0,
    late;
  const api = {
    configs: async () => {
      reads++;
      if (reads === 2)
        return new Promise((resolve) => {
          late = resolve;
        });
      return {};
    },
    jobs: async () => ({}),
    admit: async () => {
      writes++;
      throw new SyncApiError(401);
    },
  };
  const router = { replace: () => redirects++ };
  const harness = componentHarness(
    "../features/carrier-connections/CarrierLiveSyncDrawer.tsx",
    {
      "@nexora/shared": { SyncJobStatus: {} },
      "next/navigation": { useRouter: () => router },
      "./sync-api.ts": { createSyncApi: () => api, SyncApiError },
      "./sync-response.ts": { syncPresentation: () => ({ items: [] }) },
      "./sync-presentation.ts": { syncHistoryRange: () => ({}) },
      "./CarrierDataSyncDrawer.tsx": { CarrierDataSyncDrawer: "drawer" },
    },
  );
  const props = { row: { id: "owned" }, onClose() {} };
  harness.render(props);
  await tick();
  const view = harness.render(props);
  view.props.onReload();
  await tick();
  view.props.onSync("SHIPMENT");
  await tick();
  assert.equal(redirects, 1);
  assert.equal(reads, 2, "401 must not start reconciliation");
  late({});
  await tick();
  const denied = harness.render(props);
  assert.equal(denied.props.data, undefined);
  assert.equal(denied.props.blocked, true);
  denied.props.onReload();
  denied.props.onSync("SHIPMENT");
  await tick();
  assert.equal(reads, 2);
  assert.equal(writes, 1);
});
function findElement(node, type) {
  if (!node || typeof node !== "object") return;
  if (node.type === type) return node;
  for (const child of Object.values(node.props ?? {})) {
    for (const item of Array.isArray(child) ? child : [child]) {
      const found = findElement(item, type);
      if (found) return found;
    }
  }
}
test("partial schedule readback rebases Cancel while retaining only the unsaved differences", () => {
  const presentation = loadComponent(
    new URL(
      "../features/carrier-connections/sync-presentation.ts",
      import.meta.url,
    ),
  );
  const harness = componentHarness(
    "../features/carrier-connections/CarrierDataSyncDrawer.tsx",
    {
      "@nexora/ui": { Button: "button", Overlay: "overlay", TabBar: "tabs" },
      "lucide-react": {},
      "./presentation.ts": { UNAVAILABLE: "unavailable" },
      "./sync-presentation.ts": presentation,
      "./CarrierConnectionList.tsx": { ConnectionBadge: "badge" },
      "./CarrierConnectionDrawer.tsx": { CarrierDrawerFrame: "frame" },
      "./CarrierSyncPanels.tsx": {
        SyncStatusPanel: "status",
        SyncSchedulePanel: "schedule",
        SyncHistoryPanel: "history",
      },
      "./CarrierSyncInspection.tsx": { CarrierSyncInspection: "inspection" },
    },
  );
  const item = (id, enabled) => ({
    id,
    autoEnabled: enabled,
    autoInterval: "60",
  });
  let props = {
    data: { items: [item("SHIPMENT", false), item("CUSTOMER", false)] },
    onClose() {},
  };
  let view = harness.render(props);
  findElement(view, "tabs").props.onValueChange("schedule");
  view = harness.render(props);
  const edit = findElement(view, "schedule").props.onChange;
  edit("SHIPMENT", { enabled: true, interval: "60" });
  edit("CUSTOMER", { enabled: true, interval: "60" });
  // First PATCH committed, second failed. Accepted GET reports only the first.
  props = {
    ...props,
    data: { items: [item("SHIPMENT", true), item("CUSTOMER", false)] },
  };
  harness.render(props);
  view = harness.render(props);
  assert.equal(
    findElement(view, "schedule").props.draft.CUSTOMER.enabled,
    true,
  );
  assert.equal(
    findElement(view, "schedule").props.draft.SHIPMENT.enabled,
    true,
  );
  const frame = findElement(view, "frame");
  const cancel = findElement(frame.props.footer, "button");
  assert.equal(cancel.props.children, "Hủy");
  cancel.props.onClick();
  view = harness.render(props);
  const current = findElement(view, "schedule").props.draft;
  assert.equal(
    current.SHIPMENT.enabled,
    true,
    "Cancel must keep the committed A",
  );
  assert.equal(
    current.CUSTOMER.enabled,
    false,
    "Cancel discards only unsaved B",
  );
});
test("read denial during a pending schedule PATCH suppresses the next PATCH and late success feedback", async () => {
  const { SyncApiError } = loadComponent(
    new URL("../features/carrier-connections/sync-api.ts", import.meta.url),
  );
  let reads = 0,
    writes = 0,
    finish;
  const api = {
    configs: async () => {
      if (++reads > 1) throw new SyncApiError(401);
      return {};
    },
    jobs: async () => ({}),
    configure: async () => {
      writes++;
      await new Promise((resolve) => {
        finish = resolve;
      });
    },
  };
  const router = { replace() {} };
  const harness = componentHarness(
    "../features/carrier-connections/CarrierLiveSyncDrawer.tsx",
    {
      "@nexora/shared": { SyncJobStatus: {} },
      "next/navigation": { useRouter: () => router },
      "./sync-api.ts": { createSyncApi: () => api, SyncApiError },
      "./sync-response.ts": {
        syncPresentation: () => ({
          items: ["SHIPMENT", "CUSTOMER"].map((id) => ({
            id,
            available: true,
            autoEnabled: false,
            autoInterval: "60",
          })),
        }),
      },
      "./sync-presentation.ts": { syncHistoryRange: () => ({}) },
      "./CarrierDataSyncDrawer.tsx": { CarrierDataSyncDrawer: "drawer" },
    },
  );
  const props = { row: { id: "owned" }, onClose() {} };
  harness.render(props);
  await tick();
  const view = harness.render(props);
  const saving = view.props.onSaveSchedule({
    SHIPMENT: { enabled: true, interval: "60" },
    CUSTOMER: { enabled: true, interval: "60" },
  });
  await tick();
  view.props.onReload();
  await tick();
  finish();
  await saving;
  const denied = harness.render(props);
  assert.equal(writes, 1);
  assert.equal(reads, 2);
  assert.equal(denied.props.data, undefined);
  assert.equal(denied.props.blocked, true);
  assert.equal(denied.props.feedback, "Phiên đăng nhập đã kết thúc.");
});
test("Sync blocks writes until authoritative config data exists; initial loading never confirms a write", async () => {
  let reads = 0,
    writes = 0,
    finish;
  const api = {
    configs: async () => {
      reads++;
      if (reads === 1)
        return new Promise((resolve) => {
          finish = resolve;
        });
      return {};
    },
    jobs: async () => ({}),
    admit: async () => {
      writes++;
      return {};
    },
  };
  const router = { replace() {} };
  const harness = componentHarness(
    "../features/carrier-connections/CarrierLiveSyncDrawer.tsx",
    {
      "@nexora/shared": { SyncJobStatus: {} },
      "next/navigation": { useRouter: () => router },
      "./sync-api.ts": { createSyncApi: () => api },
      "./sync-response.ts": { syncPresentation: () => ({ items: [] }) },
      "./sync-presentation.ts": { syncHistoryRange: () => ({}) },
      "./CarrierDataSyncDrawer.tsx": { CarrierDataSyncDrawer: "drawer" },
    },
  );
  const props = { row: { id: "owned" }, onClose() {} };
  const loading = harness.render(props);
  assert.equal(loading.props.blocked, true);
  loading.props.onSync("SHIPMENT");
  await loading.props.onSaveSchedule({
    SHIPMENT: { enabled: true, interval: "60" },
  });
  await tick();
  assert.equal(writes, 0);
  assert.equal(reads, 1);
  assert.equal(harness.render(props).props.feedback, "");
  finish({});
  await tick();
  const ready = harness.render(props);
  assert.equal(ready.props.blocked, false);
  ready.props.onSync("SHIPMENT");
  await tick();
  assert.equal(writes, 1);
});
test("parent read401 aborts pending Inspection and rejects late detail200 plus future reads", async () => {
  const { SyncApiError } = loadComponent(
    new URL("../features/carrier-connections/sync-api.ts", import.meta.url),
  );
  let reads = 0,
    details = 0,
    finish,
    detailSignal;
  const api = {
    configs: async () => {
      if (++reads > 1) throw new SyncApiError(401);
      return {};
    },
    jobs: async () => ({}),
    jobDetail: (_id, _job, _page, signal) => {
      details++;
      detailSignal = signal;
      return new Promise((resolve) => {
        finish = resolve;
      });
    },
  };
  const router = { replace() {} };
  const h = componentHarness(
    "../features/carrier-connections/CarrierLiveSyncDrawer.tsx",
    {
      "@nexora/shared": { SyncJobStatus: {} },
      "next/navigation": { useRouter: () => router },
      "./sync-api.ts": { createSyncApi: () => api, SyncApiError },
      "./sync-response.ts": { syncPresentation: () => ({ items: [] }) },
      "./sync-presentation.ts": { syncHistoryRange: () => ({}) },
      "./CarrierDataSyncDrawer.tsx": { CarrierDataSyncDrawer: "drawer" },
    },
  );
  const p = { row: { id: "connection" }, onClose() {} };
  h.render(p);
  await tick();
  let view = h.render(p);
  const result = view.props
    .jobDetail("job", 1, new globalThis.AbortController().signal)
    .then(
      (data) => ({ data }),
      (error) => ({ error }),
    );
  view.props.onReload();
  await tick();
  view = h.render(p);
  assert.equal(view.props.denied, true);
  assert.equal(detailSignal.aborted, true);
  finish({ issues: [{ sourceId: "private-after-denial" }], issueTotal: 1 });
  assert.equal((await result).error?.status, 401);
  await assert.rejects(
    view.props.jobDetail("job", 1, new globalThis.AbortController().signal),
    (e) => e.status === 401,
  );
  assert.equal(details, 1);
  h.unmount();
});

test("F8 accepted schedule reload and Cancel show persisted nextRun without losing another draft/tab", () => {
  const model = loadComponent(
    new URL(
      "../features/carrier-connections/sync-presentation.ts",
      import.meta.url,
    ),
  );
  const { SyncSchedulePanel } = loadComponent(
    new URL(
      "../features/carrier-connections/CarrierSyncPanels.tsx",
      import.meta.url,
    ),
  );
  const harness = componentHarness(
    "../features/carrier-connections/CarrierDataSyncDrawer.tsx",
    {
      "@nexora/ui": { Button: "button", Overlay: "overlay", TabBar: "tabs" },
      "lucide-react": {},
      "./presentation.ts": { UNAVAILABLE: "unavailable" },
      "./sync-presentation.ts": model,
      "./CarrierConnectionList.tsx": { ConnectionBadge: "badge" },
      "./CarrierConnectionDrawer.tsx": { CarrierDrawerFrame: "frame" },
      "./CarrierSyncPanels.tsx": {
        SyncStatusPanel: "status",
        SyncSchedulePanel: "schedule",
        SyncHistoryPanel: "history",
      },
      "./CarrierSyncInspection.tsx": { CarrierSyncInspection: "inspection" },
    },
  );
  const item = (id, enabled, nextRun, interval = "60") => ({
    id,
    label: id,
    icon: "package",
    state: "idle",
    available: true,
    autoEnabled: enabled,
    autoInterval: interval,
    nextRun,
  });
  let props = {
    data: {
      items: [
        item("SHIPMENT", true, "2026-11-03T10:20:00Z"),
        item("CUSTOMER", false),
      ],
    },
    onClose() {},
  };
  findElement(harness.render(props), "tabs").props.onValueChange("schedule");
  const html = () =>
    render(
      React.createElement(
        SyncSchedulePanel,
        findElement(harness.render(props), "schedule").props,
      ),
    );
  assert.match(html(), /17:20/);
  let panel = findElement(harness.render(props), "schedule");
  panel.props.onChange("SHIPMENT", { enabled: true, interval: "120" });
  panel.props.onChange("CUSTOMER", { enabled: true, interval: "240" });
  assert.doesNotMatch(html(), /17:20/);
  // The existing PATCH/readback lifecycle accepts only Backend-confirmed values.
  props = {
    ...props,
    data: {
      items: [
        item("SHIPMENT", true, "2026-11-03T11:20:00Z", "120"),
        item("CUSTOMER", false),
      ],
    },
  };
  harness.render(props);
  assert.match(html(), /18:20/);
  assert.equal(
    findElement(harness.render(props), "tabs").props.value,
    "schedule",
  );
  assert.equal(
    findElement(harness.render(props), "schedule").props.draft.CUSTOMER
      .interval,
    "240",
  );
  findElement(
    findElement(harness.render(props), "frame").props.footer,
    "button",
  ).props.onClick();
  assert.match(html(), /18:20/);
  assert.equal(
    findElement(harness.render(props), "schedule").props.draft.CUSTOMER.enabled,
    false,
  );
  assert.equal(
    findElement(harness.render(props), "schedule").props.draft.SHIPMENT
      .interval,
    "120",
  );
});

test("F8 successful PATCH is followed by real presentation of Backend-confirmed nextRun", async () => {
  const response = loadComponent(
    new URL(
      "../features/carrier-connections/sync-response.ts",
      import.meta.url,
    ),
  );
  let configs = [
      {
        syncType: "SHIPMENT",
        enabled: false,
        intervalMinutes: 60,
        nextRunAt: null,
        available: true,
      },
    ],
    writes = 0,
    reads = 0;
  const api = {
    configs: async () => {
      reads++;
      return configs;
    },
    jobs: async () => ({
      jobs: [],
      total: 0,
      types: ["SHIPMENT"],
      summary: { total: 0, completed: 0, running: 0, failed: 0 },
    }),
    configure: async (_id, type, enabled, interval) => {
      writes++;
      assert.equal(type, "SHIPMENT");
      assert.equal(enabled, true);
      assert.equal(interval, 120);
      configs = [
        {
          ...configs[0],
          enabled,
          intervalMinutes: interval,
          nextRunAt: "2026-11-03T10:20:00Z",
        },
      ];
      return configs[0];
    },
  };
  const harness = componentHarness(
    "../features/carrier-connections/CarrierLiveSyncDrawer.tsx",
    {
      "@nexora/shared": { SyncJobStatus: {} },
      "next/navigation": { useRouter: () => ({ replace() {} }) },
      "./sync-api.ts": { createSyncApi: () => api },
      "./sync-response.ts": response,
      "./sync-presentation.ts": { syncHistoryRange: () => ({}) },
      "./CarrierDataSyncDrawer.tsx": { CarrierDataSyncDrawer: "drawer" },
    },
  );
  const props = { row: { id: "owned" }, onClose() {} };
  harness.render(props);
  await tick();
  const before = harness.render(props);
  assert.equal(before.props.data.items[0].nextRun, undefined);
  await before.props.onSaveSchedule({
    SHIPMENT: { enabled: true, interval: "120" },
  });
  await tick();
  const saved = harness.render(props);
  assert.equal(writes, 1);
  assert.ok(reads >= 2);
  assert.equal(saved.props.data.items[0].nextRun, "2026-11-03T10:20:00Z");
  assert.equal(saved.props.data.items[0].autoInterval, "120");
  const { SyncSchedulePanel } = loadComponent(
    new URL(
      "../features/carrier-connections/CarrierSyncPanels.tsx",
      import.meta.url,
    ),
  );
  const { initialSchedule } = loadComponent(
    new URL(
      "../features/carrier-connections/sync-presentation.ts",
      import.meta.url,
    ),
  );
  assert.match(
    render(
      React.createElement(SyncSchedulePanel, {
        items: saved.props.data.items,
        draft: initialSchedule(saved.props.data.items),
        onChange() {},
      }),
    ),
    /17:20/,
  );
});
