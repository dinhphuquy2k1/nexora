import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import ts from "typescript";
import { setImmediate } from "node:timers";
const { AbortController, Response } = globalThis;
const root = new URL("../features/retail-packages/", import.meta.url);
test("Shipment API only sends bounded read parameters, signal and safe errors", async () => {
  const { createShipmentApi } = await import(new URL("api.ts", root));
  const calls = [],
    signal = new AbortController().signal;
  const api = createShipmentApi({
    GET: async (path, options) => {
      calls.push({ path, options });
      return {
        response: new Response("{}", { status: 403 }),
        error: { code: "DENIED", message: "private", requestId: "safe-id" },
      };
    },
  });
  await assert.rejects(
    api.list(
      {
        stage: "DELIVERED",
        q: "tracking",
        page: 2,
        pageSize: 10,
        claim: "open",
        filters: [],
      },
      signal,
    ),
    (e) => e.status === 403 && !e.message.includes("private"),
  );
  assert.deepEqual(calls[0].options.params.query, {
    stage: "DELIVERED",
    q: "tracking",
    page: 2,
    pageSize: 10,
  });
  assert.equal(calls[0].options.signal, signal);
  await assert.rejects(api.get("id", signal));
  await assert.rejects(api.history("id", { page: 1, pageSize: 100 }, signal));
  assert.deepEqual(
    calls.map((c) => c.path),
    ["/api/shipments", "/api/shipments/{id}", "/api/shipments/{id}/history"],
  );
  assert.deepEqual(calls[2].options.params, {
    path: { id: "id" },
    query: { page: 1, pageSize: 100 },
  });
  const broken = createShipmentApi({
    GET: async () => ({ response: new Response("{}"), data: { bad: true } }),
  });
  await assert.rejects(
    broken.list({ page: 1, pageSize: 10 }),
    /MALFORMED_RESPONSE/,
  );
});
/** Minimal hook scheduling double; assertions exercise the real feature hook source. */
async function hookHarness(api) {
  const filename = new URL("useShipmentRead.ts", root);
  const { loadComponent } = await import("./helpers/render-component.mjs");
  let index = 0,
    slots = [],
    effects = [],
    cleanups = [],
    pending = [];
  const react = {
    useRef: (value) => {
      const n = index++;
      slots[n] ??= { current: value };
      return slots[n];
    },
    useState: (value) => {
      const n = index++;
      if (!(n in slots))
        slots[n] = typeof value === "function" ? value() : value;
      return [
        slots[n],
        (next) => {
          slots[n] = typeof next === "function" ? next(slots[n]) : next;
        },
      ];
    },
    useEffect: (fn, deps) => {
      const n = index++;
      if (!effects[n] || deps.some((v, i) => v !== effects[n][i])) {
        effects[n] = deps;
        pending.push(() => {
          cleanups[n]?.();
          cleanups[n] = fn();
        });
      }
    },
    useCallback: (fn) => fn,
  };
  const module = { exports: {} };
  const code = ts.transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const require = createRequire(import.meta.url);
  const errors = await import(new URL("errors.ts", root));
  vm.runInNewContext(code, {
    module,
    exports: module.exports,
    require: (name) =>
      name === "react"
        ? react
        : name === "./errors.ts"
          ? errors
          : name.startsWith(".")
            ? loadComponent(new URL(name, root))
            : require(name),
    AbortController,
    console,
  });
  return {
    render(query) {
      index = 0;
      const result = module.exports.useShipmentList(query, api);
      for (const effect of pending.splice(0)) effect();
      return result;
    },
    renderDetail(id) {
      index = 0;
      const result = module.exports.useShipmentDetail(id, api);
      for (const effect of pending.splice(0)) effect();
      return result;
    },
    unmount() {
      for (const cleanup of cleanups) cleanup?.();
    },
  };
}
test("Shipment list hook aborts old requests, ignores late results and clears denied data", async () => {
  const requests = [];
  const api = {
    list: (query, signal) =>
      new Promise((resolve, reject) =>
        requests.push({ query, signal, resolve, reject }),
      ),
  };
  const h = await hookHarness(api),
    q = { status: "all", search: "A", page: 1, pageSize: 10, filters: [] };
  h.render(q);
  h.render({ ...q, search: "B" });
  assert.equal(requests.length, 2);
  assert.equal(requests[0].signal.aborted, true);
  requests[0].resolve({ old: true });
  requests[1].resolve({ new: true });
  await new Promise(setImmediate);
  assert.equal(h.render({ ...q, search: "B" }).data.new, true);
  h.render({ ...q, search: "B" }).refresh();
  h.render({ ...q, search: "B" });
  assert.equal(requests.length, 3);
  assert.equal(h.render({ ...q, search: "B" }).data.new, true);
  const { ShipmentApiError } = await import(new URL("errors.ts", root));
  requests[2].reject(new ShipmentApiError(403, { code: "DENIED" }));
  await new Promise(setImmediate);
  assert.equal(h.render({ ...q, search: "B" }).data, undefined);
  assert.equal(h.render({ ...q, search: "B" }).status, "error");
  h.render({ ...q, status: "disputed" });
  assert.equal(requests.length, 3);
  h.unmount();
});

test("Shipment detail hook fences both reads by ID and handles 404/malformed errors", async () => {
  const requests = [];
  const pending = (method, id, signal) =>
    new Promise((resolve, reject) =>
      requests.push({ method, id, signal, resolve, reject }),
    );
  const api = {
    get: (id, signal) => pending("get", id, signal),
    history: (id, query, signal) => {
      assert.equal(
        JSON.stringify(query),
        JSON.stringify({ page: 1, pageSize: 100 }),
      );
      return pending("history", id, signal);
    },
  };
  const h = await hookHarness(api);
  h.renderDetail("A");
  h.renderDetail("B");
  assert.equal(requests.length, 4);
  assert.equal(requests[0].signal.aborted, true);
  assert.equal(requests[1].signal.aborted, true);
  requests[0].resolve({ id: "A" });
  requests[1].resolve({ history: [] });
  requests[2].resolve({ id: "B" });
  requests[3].resolve({ history: [] });
  await new Promise(setImmediate);
  assert.equal(h.renderDetail("B").data.shipment.id, "B");
  h.renderDetail("C");
  const { ShipmentApiError } = await import(new URL("errors.ts", root));
  requests[4].reject(new ShipmentApiError(404, { code: "NOT_FOUND" }));
  requests[5].resolve({ history: [] });
  await new Promise(setImmediate);
  assert.equal(h.renderDetail("C").data, undefined);
  assert.equal(h.renderDetail("C").error.notFound, true);
  h.renderDetail("C").refresh();
  h.renderDetail("C");
  requests[6].reject(Error("MALFORMED_RESPONSE"));
  requests[7].resolve({ history: [] });
  await new Promise(setImmediate);
  assert.equal(h.renderDetail("C").status, "error");
  h.unmount();
});

for (const deniedFirst of [false, true])
  test(`Detail refresh clears denied data despite sibling transient failure; deniedFirst=${deniedFirst}`, async () => {
    const requests = [];
    const api = {
      get: (id, signal) =>
        new Promise((resolve, reject) =>
          requests.push({ method: "get", resolve, reject, signal }),
        ),
      history: (id, q, signal) =>
        new Promise((resolve, reject) =>
          requests.push({ method: "history", resolve, reject, signal }),
        ),
    };
    const h = await hookHarness(api);
    h.renderDetail("A");
    requests[0].resolve({ id: "A" });
    requests[1].resolve({ history: [] });
    await new Promise(setImmediate);
    assert.equal(h.renderDetail("A").data.shipment.id, "A");
    h.renderDetail("A").refresh();
    h.renderDetail("A");
    const { ShipmentApiError } = await import(new URL("errors.ts", root));
    if (deniedFirst) {
      requests[2].reject(new ShipmentApiError(401, { code: "UNAUTHORIZED" }));
      await new Promise(setImmediate);
      assert.equal(h.renderDetail("A").data, undefined);
      requests[3].reject(Error("transient"));
    } else {
      requests[3].reject(Error("transient"));
      await new Promise(setImmediate);
      requests[2].reject(new ShipmentApiError(403, { code: "DENIED" }));
    }
    await new Promise(setImmediate);
    assert.equal(h.renderDetail("A").data, undefined);
    assert.equal(h.renderDetail("A").error.denied, true);
    h.unmount();
  });
