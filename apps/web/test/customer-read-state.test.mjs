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
