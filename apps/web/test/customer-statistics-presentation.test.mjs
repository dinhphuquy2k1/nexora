import test from "node:test";
import assert from "node:assert/strict";
import { loadComponent, React, render } from "./helpers/render-component.mjs";
const { CustomerStatsBar } = loadComponent(
  new URL("../features/customers/CustomerStatsBar.tsx", import.meta.url)
    .pathname,
);
const stats = { total: 9, active: 7, inactive: 2 };
test("statistics preserve identical tab contents across fresh, refreshing and failed snapshots", () => {
  const views = [
    { loading: false },
    { stale: true, loading: true },
    { stale: true, loading: false, error: true },
  ].map((state) =>
    render(
      React.createElement(CustomerStatsBar, { stats, onChange() {}, ...state }),
    ),
  );
  const tabs = views.map(
    (html) => html.match(/<div role="tablist".*?<\/div>/s)[0],
  );
  assert.equal(tabs[0], tabs[1]);
  assert.equal(tabs[1], tabs[2]);
  assert.match(views[1], /data-freshness="stale"/);
  assert.doesNotMatch(views.join(""), /statsHint|Thống kê cũ ·/);
  assert.match(
    views[2],
    /role="status" class="srOnly">Không tải được thống kê/,
  );
  assert.match(views[2], /chưa được đối chiếu/);
});
test("unavailable statistics never masquerade as zeros", () => {
  const html = render(
    React.createElement(CustomerStatsBar, { loading: false, onChange() {} }),
  );
  assert.equal((html.match(/>—<\/span>/g) || []).length, 3);
  assert.match(html, /data-freshness="unavailable"/);
});
