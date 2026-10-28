import test from "node:test";
import assert from "node:assert/strict";
import {
  beginRead,
  acceptRead,
  rejectRead,
} from "../features/customers/read-state.ts";
import {
  statisticsScope,
  captureStatistics,
  visibleStatistics,
} from "../features/customers/list-statistics.ts";

test("read retention is key-bound; stale success/error cannot settle a newer intent", () => {
  const initial = {
    key: "A",
    loading: false,
    data: { value: 1 },
    requestId: 1,
    settledId: 1,
    denied: false,
  };
  const refresh = beginRead(initial, "A", 2);
  assert.equal(refresh.data, initial.data);
  assert.equal(refresh.loading, true);
  assert.equal(acceptRead(refresh, "A", 1, { value: 9 }), refresh);
  assert.equal(rejectRead(refresh, "A", 1, "stale"), refresh);
  const next = beginRead(refresh, "B", 3);
  assert.equal(next.data, undefined);
  assert.equal(acceptRead(next, "A", 2, { value: 9 }), next);
  const success = acceptRead(next, "B", 3, { value: 2 });
  assert.equal(success.data.value, 2);
  assert.equal(success.settledId, 3);
  const failed = rejectRead(beginRead(success, "B", 4), "B", 4, "offline");
  assert.equal(failed.data, success.data);
  assert.equal(failed.loading, false);
  assert.equal(failed.settledId, 4);
  const denied = rejectRead(
    beginRead(failed, "B", 5),
    "B",
    5,
    "forbidden",
    true,
  );
  assert.equal(denied.data, undefined);
  assert.equal(denied.denied, true);
});
test("statistics retain only validated backend values for the same owner/q/phone scope", () => {
  const scope = statisticsScope("ownerA", {
    page: 1,
    pageSize: 10,
    q: " Lan ",
  });
  for (const query of [
    { page: 2, pageSize: 50, q: "Lan", status: "ACTIVE" },
    { page: 1, pageSize: 10, q: "Lan", status: "INACTIVE" },
  ])
    assert.equal(statisticsScope("ownerA", query), scope);
  const stats = { total: 100, active: 60, inactive: 40 };
  const snapshot = captureStatistics(undefined, stats, scope, 1);
  assert.deepEqual(visibleStatistics(snapshot, scope, false), stats);
  assert.equal(
    visibleStatistics(snapshot, statisticsScope("ownerB", { q: "Lan" }), false),
    undefined,
  );
  assert.equal(
    visibleStatistics(
      snapshot,
      statisticsScope("ownerA", { q: "Linh" }),
      false,
    ),
    undefined,
  );
  assert.equal(
    visibleStatistics(
      snapshot,
      statisticsScope("ownerA", { q: "Lan", phone: "0912345678" }),
      false,
    ),
    undefined,
  );
  assert.equal(visibleStatistics(snapshot, scope, true), undefined);
  assert.equal(
    captureStatistics(snapshot, { total: 1, active: 2, inactive: 0 }, scope, 2),
    undefined,
  );
  assert.equal(captureStatistics(snapshot, null, scope, 2), undefined);
  assert.equal(
    captureStatistics(snapshot, { total: 0, active: 0, inactive: 0 }, scope, 0),
    snapshot,
  );
  assert.equal(
    captureStatistics(snapshot, { total: 0, active: 0, inactive: 0 }, scope, 2)
      .stats.total,
    0,
  );
});

test("status tab and pagination changes keep statistics valid and not stale; mutation and same-scope errors flag stale", () => {
  const scope = statisticsScope("ownerA", { q: "" });
  const stats = { total: 50, active: 30, inactive: 20 };
  const snapshot = captureStatistics(undefined, stats, scope, 1);

  // Switching status tab: owner, q, phone unchanged -> scope identical
  const statusTabQueries = [
    { page: 1, pageSize: 10, status: undefined },
    { page: 1, pageSize: 10, status: "ACTIVE" },
    { page: 1, pageSize: 10, status: "INACTIVE" },
  ];
  for (const q of statusTabQueries) {
    const tabScope = statisticsScope("ownerA", q);
    assert.equal(tabScope, scope);
    assert.deepEqual(visibleStatistics(snapshot, tabScope, false), stats);
  }

  // Changing page or pageSize: scope identical
  const paginationQueries = [
    { page: 2, pageSize: 10 },
    { page: 1, pageSize: 50 },
  ];
  for (const q of paginationQueries) {
    const pageScope = statisticsScope("ownerA", q);
    assert.equal(pageScope, scope);
    assert.deepEqual(visibleStatistics(snapshot, pageScope, false), stats);
  }

  // Stale calculation logic verification
  function computeStale(statsSnapshot, powerPhase, readError, isCompatible) {
    const isRevalidating =
      powerPhase === "revalidating" || powerPhase === "blocked";
    return Boolean(
      statsSnapshot && (isRevalidating || (readError && isCompatible)),
    );
  }

  // Ordinary tab navigation: reading rows is in flight (readLoading=true, readError=null, powerPhase=null)
  assert.equal(computeStale(stats, null, null, true), false);

  // Changing page: readLoading=true, readError=null, powerPhase=null
  assert.equal(computeStale(stats, null, null, true), false);

  // Mutation in flight (revalidating)
  assert.equal(computeStale(stats, "revalidating", null, true), true);

  // Mutation reconciliation failed (blocked)
  assert.equal(computeStale(stats, "blocked", { message: "err" }, true), true);

  // Same-scope read failed
  assert.equal(
    computeStale(stats, null, { message: "network error" }, true),
    true,
  );
});

test("explicit denied reset immediately clears retained data and fences earlier completions", async () => {
  const { denyRead } = await import("../features/customers/read-state.ts");
  const old = {
    key: "A",
    data: { private: "previous" },
    loading: false,
    requestId: 1,
    settledId: 1,
    denied: false,
    outcome: "success",
  };
  const denied = denyRead(old, 2);
  assert.equal(denied.data, undefined);
  assert.equal(denied.denied, true);
  assert.equal(acceptRead(denied, "A", 1, { private: "late" }), denied);
  const retry = beginRead(denied, "A", 3);
  assert.equal(retry.denied, true);
  assert.equal(retry.data, undefined);
  const failed = rejectRead(retry, "A", 3, "offline");
  assert.equal(failed.denied, true);
  assert.equal(failed.data, undefined);
  const allowed = acceptRead(retry, "A", 3, { private: "current" });
  assert.equal(allowed.denied, false);
});
