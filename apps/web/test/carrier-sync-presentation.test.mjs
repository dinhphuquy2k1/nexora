import test from "node:test";
import assert from "node:assert/strict";
import { loadComponent, React, render } from "./helpers/render-component.mjs";
const panels = loadComponent(
  new URL(
    "../features/carrier-connections/CarrierSyncPanels.tsx",
    import.meta.url,
  ),
);
const schedule = loadComponent(
  new URL(
    "../features/carrier-connections/sync-presentation.ts",
    import.meta.url,
  ),
);
const item = (overrides = {}) => ({
  id: "SHIPMENT",
  code: "SHIPMENT",
  label: "Kiện hàng",
  icon: "package",
  state: "idle",
  available: true,
  autoEnabled: true,
  autoInterval: "60",
  nextRun: "2026-11-03T10:20:00Z",
  ...overrides,
});
const scheduleHtml = (items, draft = schedule.initialSchedule(items)) =>
  render(
    React.createElement(panels.SyncSchedulePanel, {
      items,
      draft,
      integrated: true,
      onChange() {},
    }),
  );
test("F8 Next Run uses the persisted Backend timestamp in Vietnam time", () => {
  const html = scheduleHtml([item()]);
  assert.match(html, /Lần chạy tiếp theo/);
  assert.match(html, /17:20/);
  assert.doesNotMatch(html, /Invalid Date/);
});
test("F8 null/invalid timestamps, saved-off and unsaved schedule edits never invent a next run", () => {
  for (const nextRun of [null, undefined, "not-a-date"]) {
    const html = scheduleHtml([item({ nextRun })]);
    assert.match(html, /class="readonlyField">—<\/span>/);
    assert.doesNotMatch(html, /Invalid Date/);
  }
  assert.doesNotMatch(scheduleHtml([item({ autoEnabled: false })]), /17:20/);
  assert.doesNotMatch(
    scheduleHtml([item({ autoEnabled: false })], {
      SHIPMENT: { enabled: true, interval: "60" },
    }),
    /17:20/,
  );
  assert.doesNotMatch(
    scheduleHtml([item()], { SHIPMENT: { enabled: true, interval: "120" } }),
    /17:20/,
  );
  assert.doesNotMatch(
    scheduleHtml([item()], { SHIPMENT: { enabled: false, interval: "60" } }),
    /17:20/,
  );
});
test("F8 unrelated draft edits do not hide a confirmed row schedule", () => {
  const items = [
    item(),
    item({
      id: "CUSTOMER",
      label: "Khách hàng",
      autoEnabled: false,
      nextRun: undefined,
    }),
  ];
  const draft = {
    ...schedule.initialSchedule(items),
    CUSTOMER: { enabled: true, interval: "120" },
  };
  assert.match(scheduleHtml(items, draft), /17:20/);
  assert.equal(draft.CUSTOMER.interval, "120");
});
const query = {
  type: "all",
  state: "all",
  range: "",
  appliedRange: "",
  page: 1,
};
const historyEntry = (dataType, id = dataType) => ({
  id,
  dataType,
  time: "Synthetic",
  startedAt: "2026-01-01T00:00:00Z",
  source: "Thủ công",
  state: "completed",
  records: 1,
});
const historyHtml = (dataTypes) =>
  render(
    React.createElement(panels.SyncHistoryPanel, {
      data: { items: [], history: dataTypes.map((t) => historyEntry(t)) },
      query,
      onChange() {},
      onInspect() {},
    }),
  );
test("F9 canonical SyncType history uses correct icons and labels without changing raw filter values", () => {
  const html = historyHtml(["SHIPMENT", "CUSTOMER", "UNKNOWN"]);
  for (const [type, icon, label] of [
    ["SHIPMENT", "package", "Kiện hàng"],
    ["CUSTOMER", "user", "Khách hàng"],
    ["UNKNOWN", "layers", "UNKNOWN"],
  ]) {
    const row = html
      .split('data-carrier-history-id="' + type + '"')[1]
      .split("</button>")[0];
    assert.match(row, new RegExp("lucide-" + icon));
    assert.match(row, new RegExp("<strong>" + label + "</strong>"));
    assert.match(
      html,
      new RegExp('<option value="' + type + '">' + label + "</option>"),
    );
  }
});
test("F9 legacy preview aliases remain presentational and server pagination stays authoritative", () => {
  const legacy = historyHtml(["Shipment", "Customer"]);
  assert.match(legacy, /lucide-package/);
  assert.match(legacy, /lucide-user/);
  assert.match(legacy, /<option value="Shipment">Kiện hàng<\/option>/);
  const html = render(
    React.createElement(panels.SyncHistoryPanel, {
      data: {
        items: [],
        history: [historyEntry("CUSTOMER")],
        serverHistory: {
          total: 41,
          types: ["SHIPMENT", "CUSTOMER"],
          summary: { total: 41, completed: 41, running: 0, failed: 0 },
        },
      },
      query,
      onChange() {},
      onInspect() {},
    }),
  );
  assert.match(html, /41/);
  assert.match(html, /Trang <strong>1<\/strong> \/ <strong>11<\/strong>/);
  assert.match(html, /<option value="CUSTOMER">Khách hàng<\/option>/);
});

test("F9 history callbacks retain canonical API filters and authoritative server page numbers", () => {
  const patches = [],
    data = {
      items: [],
      history: [historyEntry("SHIPMENT")],
      serverHistory: {
        total: 41,
        types: ["SHIPMENT", "CUSTOMER"],
        summary: { total: 41, completed: 41, running: 0, failed: 0 },
      },
    };
  const view = panels.SyncHistoryPanel({
    data,
    query,
    onChange: (patch) => patches.push(patch),
    onInspect() {},
  });
  const pending = [view],
    nodes = [];
  while (pending.length) {
    const node = pending.pop();
    if (!node || typeof node !== "object") continue;
    if (Array.isArray(node)) {
      pending.push(...node);
      continue;
    }
    nodes.push(node);
    // Execute the extracted stateless presentation component, keeping its real
    // callbacks in this feature-to-Pager integration assertion.
    if (typeof node.type === "function" && node.type.name === "Pager")
      pending.push(node.type(node.props));
    pending.push(node.props?.children);
  }
  const filter = nodes.find(
    (n) => n.props?.["aria-label"] === "Lọc loại dữ liệu đồng bộ",
  );
  filter.props.onChange({ target: { value: "CUSTOMER" } });
  filter.props.onChange({ target: { value: "SHIPMENT" } });
  nodes
    .find((n) => n.props?.["aria-label"] === "Trang sau lịch sử")
    .props.onClick();
  assert.deepEqual(
    patches.map((p) => ({ ...p })),
    [{ type: "CUSTOMER", page: 1 }, { type: "SHIPMENT", page: 1 }, { page: 2 }],
  );
  assert.equal(data.history[0].dataType, "SHIPMENT");
});
