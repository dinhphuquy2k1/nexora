import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { clearTimeout, setImmediate } from "node:timers";
import ts from "typescript";
import { loadComponent } from "./helpers/render-component.mjs";

// Execute the actual component closures with deterministic hooks and controlled I/O.
// Child markup is opaque here; actual browser geometry remains in the CDP suite.
function componentHarness(file, dependencies) {
  const slots = [],
    effects = [];
  let cursor = 0;
  const changed = (previous, next) =>
    !previous || next.some((value, i) => value !== previous[i]);
  const hooks = {
    useRef(value) {
      const i = cursor++;
      return (slots[i] ??= { current: value });
    },
    useState(value) {
      const i = cursor++;
      if (!(i in slots))
        slots[i] = typeof value === "function" ? value() : value;
      return [
        slots[i],
        (next) => {
          slots[i] = typeof next === "function" ? next(slots[i]) : next;
        },
      ];
    },
    useId() {
      return "fixture-id";
    },
    useCallback(fn, deps) {
      const i = cursor++;
      if (!slots[i] || changed(slots[i].deps, deps)) slots[i] = { fn, deps };
      return slots[i].fn;
    },
    useEffect(fn, deps) {
      const i = cursor++;
      if (changed(slots[i], deps)) {
        slots[i] = deps;
        effects.push(fn);
      }
    },
  };
  const module = { exports: {} };
  const code = ts.transpileModule(
    readFileSync(new URL(file, import.meta.url), "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        jsx: ts.JsxEmit.ReactJSX,
        target: ts.ScriptTarget.ES2022,
      },
    },
  ).outputText;
  vm.runInNewContext(code, {
    module,
    exports: module.exports,
    AbortController: globalThis.AbortController,
    setTimeout,
    clearTimeout,
    require(name) {
      if (name === "react") return hooks;
      if (name === "react/jsx-runtime")
        return {
          jsx: (type, props) => ({ type, props }),
          jsxs: (type, props) => ({ type, props }),
        };
      if (name.endsWith(".css")) return { default: {} };
      if (name in dependencies) return dependencies[name];
      throw Error("Unexpected component dependency: " + name);
    },
  });
  return {
    render(props) {
      cursor = 0;
      const result = Object.values(module.exports)[0](props);
      for (const effect of effects.splice(0)) effect();
      return result;
    },
  };
}
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
