import test from "node:test";
import assert from "node:assert/strict";
import { loadComponent, React, render } from "./helpers/render-component.mjs";
const apiFile = new URL(
    "../features/carrier-connections/sync-api.ts",
    import.meta.url,
  ),
  mapFile = new URL(
    "../features/carrier-connections/sync-response.ts",
    import.meta.url,
  );
test("Sync SDK transport scopes reads, forwards cancellation and uses exact mutation contracts", async () => {
  const { createSyncApi, SyncApiError } = loadComponent(apiFile),
    calls = [],
    signal = new globalThis.AbortController().signal;
  const client = {
    GET: async (path, options) => {
      calls.push({ path, options });
      return {
        response: new globalThis.Response("{}"),
        data: path.endsWith("sync-configs")
          ? { configs: [] }
          : { jobs: [], total: 0 },
      };
    },
    POST: async (path, options) => {
      calls.push({ path, options });
      return {
        response: new globalThis.Response("{}"),
        data: { job: { id: "job" } },
      };
    },
    PATCH: async (path, options) => {
      calls.push({ path, options });
      return {
        response: new globalThis.Response("{}"),
        data: { config: { enabled: true } },
      };
    },
  };
  const api = createSyncApi(client);
  await api.configs("owned", signal);
  await api.jobs("owned", 3, signal, {
    syncType: "SHIPMENT",
    status: "FAILED,CANCELLED",
  });
  await api.admit("owned", "SHIPMENT");
  await api.configure("owned", "SHIPMENT", true, 60);
  assert.equal(calls[0].options.signal, signal);
  assert.equal(calls[1].options.params.query.page, 3);
  assert.equal(calls[1].options.params.query.pageSize, 4);
  assert.equal(calls[1].options.params.path.id, "owned");
  assert.equal(
    JSON.stringify(calls[2].options.body),
    JSON.stringify({ syncType: "SHIPMENT" }),
  );
  assert.equal(
    JSON.stringify(calls[3].options.body),
    JSON.stringify({ enabled: true, intervalMinutes: 60 }),
  );
  const denied = createSyncApi({
    ...client,
    GET: async () => ({
      response: new globalThis.Response("{}", { status: 401 }),
      error: { message: "secret-provider-body" },
    }),
  });
  await assert.rejects(
    denied.configs("owned", signal),
    (e) =>
      e instanceof SyncApiError &&
      e.status === 401 &&
      !e.message.includes("secret-provider-body"),
  );
});
test("Sync projection keeps global totals and latest stream independent from filtered page; queued has no fabricated start", () => {
  const { syncPresentation } = loadComponent(mapFile);
  const j = {
    id: "job",
    syncType: "SHIPMENT",
    triggerSource: "MANUAL",
    status: "SUCCEEDED",
    phase: "APPLYING",
    fetchedCount: 100,
    newCount: 100,
    changedCount: 0,
    unchangedCount: 0,
    appliedCount: 99,
    rejectedCount: 0,
    needsReviewCount: 1,
    startedAt: "2026-01-01T00:00:00Z",
    finishedAt: "2026-01-01T00:01:00Z",
    createdAt: "2026-01-01T00:00:00Z",
    errorCode: null,
  };
  const c = {
    syncType: "SHIPMENT",
    available: true,
    enabled: false,
    intervalMinutes: 60,
    lastSuccessAt: j.finishedAt,
    nextRunAt: null,
    lastCompletedAt: j.finishedAt,
    latestJob: j,
  };
  const page = {
    jobs: [
      {
        ...j,
        id: "queued",
        status: "QUEUED",
        startedAt: null,
        finishedAt: null,
      },
    ],
    total: 100,
    summary: { total: 100, completed: 99, running: 1, failed: 0 },
    types: ["SHIPMENT"],
  };
  const data = syncPresentation([c], page);
  assert.equal(data.serverHistory.total, 100);
  assert.equal(data.serverHistory.summary.completed, 99);
  assert.equal(data.items[0].state, "completed");
  assert.equal(data.items[0].warning, true);
  assert.equal(data.history[0].startedAt, null);
  assert.equal(data.history[0].createdAt, j.createdAt);
  assert.equal(data.history[0].time, "Chưa bắt đầu");
  assert.match(data.history[0].detail, /Thời lượng —/);
  const { filterSyncHistory } = loadComponent(
    new URL(
      "../features/carrier-connections/sync-presentation.ts",
      import.meta.url,
    ),
  );
  assert.equal(
    filterSyncHistory(data.history, "all", "all", "01/01/2026 - 01/01/2026")
      .entries.length,
    1,
  );
});
test("Server-paged history uses backend total and scoped summary without summing a page", () => {
  const { SyncHistoryPanel } = loadComponent(
    new URL(
      "../features/carrier-connections/CarrierSyncPanels.tsx",
      import.meta.url,
    ),
  );
  const html = render(
    React.createElement(SyncHistoryPanel, {
      data: {
        items: [],
        history: [
          {
            id: "last-page",
            time: "Chưa bắt đầu",
            startedAt: null,
            createdAt: "2026-01-01T00:00:00Z",
            dataType: "SHIPMENT",
            source: "Thủ công",
            state: "queued",
            detail: "FETCHING",
          },
        ],
        serverHistory: {
          total: 9,
          types: ["SHIPMENT"],
          summary: { total: 9, completed: 8, running: 1, failed: 0 },
        },
      },
      query: {
        type: "all",
        state: "all",
        range: "",
        appliedRange: "",
        page: 3,
      },
      onChange: () => {},
      onInspect: () => {},
    }),
  );
  assert.match(html, /Hiển thị 9 bản ghi/);
  assert.match(html, /last-page/);
  assert.match(html, /aria-label="Trang lịch sử 3" aria-current="page"[^>]*>3/);
  assert.doesNotMatch(html, /thời điểm bắt đầu không hợp lệ/);
});
test("Job Detail uses existing generated SDK with scoped IDs, issue page and cancellation", async () => {
  const { createSyncApi, JOB_ISSUE_PAGE_SIZE } = loadComponent(apiFile);
  let call;
  const api = createSyncApi({
    GET: async (path, options) => {
      call = { path, options };
      return {
        response: new globalThis.Response("{}"),
        data: { job: { id: "job" }, issues: [], issueTotal: 0 },
      };
    },
  });
  const signal = new globalThis.AbortController().signal;
  assert.equal(
    (await api.jobDetail("connection", "job", 2, signal)).issueTotal,
    0,
  );
  assert.equal(call.path, "/api/carrier-connections/{id}/sync-jobs/{jobId}");
  assert.equal(call.options.params.path.id, "connection");
  assert.equal(call.options.params.path.jobId, "job");
  assert.equal(call.options.params.query.page, 2);
  assert.equal(call.options.params.query.pageSize, JOB_ISSUE_PAGE_SIZE);
  assert.equal(call.options.signal, signal);
});
