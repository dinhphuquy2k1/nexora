import test from "node:test";
import assert from "node:assert/strict";
import { setImmediate } from "node:timers";
import { componentHarness } from "./helpers/component-harness.mjs";
import { loadComponent } from "./helpers/render-component.mjs";
const { SyncApiError } = loadComponent(
  new URL("../features/carrier-connections/sync-api.ts", import.meta.url),
);
const tick = () => new Promise((resolve) => setImmediate(resolve));
function harness() {
  return componentHarness(
    "../features/carrier-connections/CarrierSyncInspection.tsx",
    {
      "@nexora/ui": { Button: "button", Overlay: "overlay" },
      "lucide-react": {},
      "./presentation.ts": { UNAVAILABLE: "unavailable" },
      "./sync-api.ts": { SyncApiError, JOB_ISSUE_PAGE_SIZE: 10 },
    },
  );
}
const inspection = (id) => ({
  kind: "history",
  item: {
    id,
    time: "Synthetic",
    detail: "Safe overview",
    dataType: "SHIPMENT",
    source: "Thủ công",
    state: "completed",
    startedAt: null,
  },
});
const props = (jobDetail, id = "job-a", onUnauthorized = () => {}) => ({
  inspection: inspection(id),
  connectionId: "connection-a",
  jobDetail,
  onUnauthorized,
  onClose() {},
});
const issue = (id = "source-a") => ({
  id,
  sourceId: id,
  sourceVersion: 2,
  processorVersion: 1,
  outcome: "NEEDS_REVIEW",
  errorCode: "SOURCE_CONFLICT",
  payload: "PRIVATE_RAW_PAYLOAD",
  token: "PRIVATE_TOKEN",
});
function find(node, label) {
  if (!node || typeof node !== "object") return;
  if (node.props?.["aria-label"] === label) return node;
  for (const child of Object.values(node.props ?? {})) {
    for (const item of Array.isArray(child) ? child : [child]) {
      const result = find(item, label);
      if (result) return result;
    }
  }
}
const json = (view) => JSON.stringify(view);
test("Inspection reads safe issue fields, empty result and server pagination without rendering extra payload", async () => {
  const h = harness(),
    calls = [];
  const reader = async (id, page, signal) => {
    calls.push({ id, page, signal });
    return {
      job: { id },
      issues: id === "empty" ? [] : page === 1 ? [issue()] : [],
      issueTotal: id === "empty" ? 0 : 11,
    };
  };
  const p = props(reader);
  h.render(p);
  await tick();
  let view = h.render(p);
  assert.equal(calls.length, 1);
  assert.ok(json(view).includes("source-a"));
  assert.ok(json(view).includes("NEEDS_REVIEW"));
  assert.ok(json(view).includes("SOURCE_CONFLICT"));
  assert.ok(!json(view).includes("PRIVATE_RAW_PAYLOAD"));
  assert.ok(!json(view).includes("PRIVATE_TOKEN"));
  find(view, "Trang lỗi sau").props.onClick();
  h.render(p);
  await tick();
  view = h.render(p);
  assert.equal(calls.at(-1).page, 2);
  assert.ok(json(view).includes("Không có bản ghi cần kiểm tra"));
  const empty = { ...p, inspection: inspection("empty") };
  h.render(empty);
  await tick();
  assert.ok(json(h.render(empty)).includes("Không có bản ghi cần kiểm tra"));
  assert.equal(calls.at(-1).page, 1);
  h.unmount();
});
test("Inspection aborts switched/closed reads, fences stale results and clears403/404 data", async () => {
  const h = harness(),
    pending = [];
  const reader = (id, page, signal) =>
    new Promise((resolve, reject) =>
      pending.push({ id, page, signal, resolve, reject }),
    );
  const a = props(reader);
  h.render(a);
  assert.equal(pending.length, 1);
  const b = { ...a, inspection: inspection("job-b") };
  h.render(b);
  assert.equal(pending[0].signal.aborted, true);
  pending[0].resolve({
    job: { id: "job-a" },
    issues: [issue("old-source")],
    issueTotal: 1,
  });
  pending[1].resolve({
    job: { id: "job-b" },
    issues: [issue("current-source")],
    issueTotal: 1,
  });
  await tick();
  assert.ok(!json(h.render(b)).includes("old-source"));
  assert.ok(json(h.render(b)).includes("current-source"));
  for (const status of [403, 404]) {
    const next = { ...b, inspection: inspection("job-" + status) };
    h.render(next);
    assert.ok(!json(h.render(next)).includes("current-source"));
    pending.at(-1).reject(new SyncApiError(status));
    await tick();
    const text = json(h.render(next));
    assert.ok(
      text.includes(status === 403 ? "không có quyền" : "Không tìm thấy"),
    );
    assert.ok(!text.includes("current-source"));
  }
  h.render({ ...b, inspection: inspection("closing") });
  const last = pending.at(-1);
  h.unmount();
  assert.equal(last.signal.aborted, true);
  const writes = h.writes;
  last.resolve({
    job: { id: "closing" },
    issues: [issue("late")],
    issueTotal: 1,
  });
  await tick();
  assert.equal(h.writes, writes);
});
test("Inspection401 invokes current denial flow and generic failures expose safe error only", async () => {
  let denied = 0;
  const h = harness();
  const p = props(
    async () => {
      throw new SyncApiError(401);
    },
    "job",
    () => denied++,
  );
  h.render(p);
  await tick();
  assert.equal(denied, 1);
  h.unmount();
  const failed = harness();
  const next = props(async () => {
    throw Error("PRIVATE_PROVIDER_RESPONSE");
  });
  failed.render(next);
  await tick();
  const text = json(failed.render(next));
  assert.ok(text.includes("Không thể tải chi tiết"));
  assert.ok(!text.includes("PRIVATE_PROVIDER_RESPONSE"));
  failed.unmount();
});
test("opening/closing Inspection preserves Drawer schedule draft, tab and history query", () => {
  const presentation = loadComponent(
    new URL(
      "../features/carrier-connections/sync-presentation.ts",
      import.meta.url,
    ),
  );
  const h = componentHarness(
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
  function type(node, name) {
    if (!node || typeof node !== "object") return;
    if (node.type === name) return node;
    for (const child of Object.values(node.props ?? {})) {
      for (const item of Array.isArray(child) ? child : [child]) {
        const result = type(item, name);
        if (result) return result;
      }
    }
  }
  const p = {
    row: { id: "connection" },
    data: {
      items: [{ id: "SHIPMENT", autoEnabled: false, autoInterval: "60" }],
      history: [],
    },
    jobDetail: async () => ({ issues: [], issueTotal: 0 }),
    onClose() {},
  };
  let view = h.render(p);
  type(view, "tabs").props.onValueChange("schedule");
  view = h.render(p);
  type(view, "schedule").props.onChange("SHIPMENT", {
    enabled: true,
    interval: "60",
  });
  type(view, "tabs").props.onValueChange("history");
  view = h.render(p);
  type(view, "history").props.onChange({
    type: "SHIPMENT",
    page: 2,
    range: "01/01/2026 - 01/01/2026",
  });
  view = h.render(p);
  type(view, "history").props.onInspect(inspection("job-a").item);
  view = h.render(p);
  assert.equal(type(view, "inspection").props.connectionId, "connection");
  assert.equal(type(view, "inspection").props.jobDetail, p.jobDetail);
  type(view, "inspection").props.onClose();
  view = h.render(p);
  assert.equal(type(view, "tabs").props.value, "history");
  assert.equal(type(view, "history").props.query.page, 2);
  assert.equal(type(view, "history").props.query.type, "SHIPMENT");
  type(view, "tabs").props.onValueChange("schedule");
  view = h.render(p);
  assert.equal(type(view, "schedule").props.draft.SHIPMENT.enabled, true);
  type(view, "tabs").props.onValueChange("history");
  view = h.render(p);
  type(view, "history").props.onInspect(inspection("job-a").item);
  view = h.render(p);
  assert.ok(type(view, "inspection"));
  const denied = { ...p, denied: true };
  view = h.render(denied);
  assert.equal(
    type(view, "inspection"),
    undefined,
    "parent denial immediately unmounts Inspection",
  );
  h.unmount();
});

test("Live progress retains real Job metadata but never claims unsupported realtime logs", async () => {
  for (const logs of [undefined, ["UNSUPPORTED_LIVE_LOG"]]) {
    const h = harness();
    const p = {
      inspection: {
        kind: "progress",
        item: {
          id: "SHIPMENT",
          label: "Kiện hàng",
          state: "running",
          jobId: "owned-job",
          processed: 3,
          total: 7,
          checkpoint: "APPLYING",
          detail: "APPLYING · Áp dụng 3 · Cần xem 1",
          logs,
        },
      },
      connectionId: "owned-connection",
      jobDetail: async () => ({
        job: { id: "owned-job" },
        issues: [],
        issueTotal: 0,
      }),
      onClose() {},
    };
    h.render(p);
    await tick();
    const view = json(h.render(p));
    assert.ok(view.includes("owned-job"));
    assert.ok(view.includes("APPLYING · Áp dụng 3 · Cần xem 1"));
    assert.ok(!view.includes("Nhật ký Worker thời gian thực"));
    assert.ok(!view.includes("Chưa có nhật ký"));
    assert.ok(!view.includes("UNSUPPORTED_LIVE_LOG"));
    h.unmount();
  }
});

test("Preview progress preserves supplied reference log presentation", () => {
  const h = harness();
  const view = json(
    h.render({
      inspection: {
        kind: "progress",
        item: {
          id: "preview",
          label: "Synthetic preview",
          state: "running",
          logs: ["PREVIEW_FIRST", "PREVIEW_SECOND"],
        },
      },
      onClose() {},
    }),
  );
  assert.ok(view.includes("Nhật ký Worker thời gian thực"));
  assert.ok(view.includes("PREVIEW_FIRST\\nPREVIEW_SECOND"));
  h.unmount();
});
