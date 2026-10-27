import test from "node:test";
import assert from "node:assert/strict";
import { loadComponent } from "./helpers/render-component.mjs";
const { CustomerFilters } = loadComponent(
  new URL("../features/customers/CustomerFilters.tsx", import.meta.url)
    .pathname,
);
function find(node, predicate) {
  if (!node || typeof node !== "object") return;
  if (predicate(node)) return node;
  for (const child of [node.props?.children].flat(Infinity)) {
    const match = find(child, predicate);
    if (match) return match;
  }
}
test("CustomerFilters toolbar renders search and refresh without secondary phone control", () => {
  let cleared = false;
  let reloaded = false;
  const searches = [];
  const tree = CustomerFilters({
    query: { page: 1, pageSize: 10 },
    draft: "Alice",
    onSearch: (value) => searches.push(value),
    onClear: () => {
      cleared = true;
    },
    onReload: () => {
      reloaded = true;
    },
    onClearFilters() {},
  });

  // Verify secondary phone filter control is NOT present in toolbar
  const phoneInput = find(tree, (n) => n.props?.name === "phone");
  assert.equal(phoneInput, undefined, "phone input must not exist in toolbar");
  const phoneSummary = find(tree, (n) => n.type === "summary");
  assert.equal(phoneSummary, undefined, "summary tag must not exist");

  // Verify search input exists with draft
  const searchInput = find(tree, (n) => n.props?.name === "q");
  assert.ok(searchInput, "search input exists");
  assert.equal(searchInput.props.value, "Alice");
  searchInput.props.onChange({ target: { value: "Bob" } });
  assert.deepEqual(searches, ["Bob"]);

  // Verify clear search button works
  const clearBtn = find(
    tree,
    (n) => n.props?.["aria-label"] === "Xóa từ khóa tìm kiếm",
  );
  assert.ok(clearBtn, "clear search button exists when draft is present");
  clearBtn.props.onClick();
  assert.equal(cleared, true);

  // Verify reload button works
  const reloadBtn = find(tree, (n) => n.props?.["aria-label"] === "Làm mới");
  assert.ok(reloadBtn, "reload button exists");
  reloadBtn.props.onClick();
  assert.equal(reloaded, true);
});

test("CustomerFilters communicates active URL phone filter and supports clear action", () => {
  let filtersCleared = false;
  const tree = CustomerFilters({
    query: { page: 1, pageSize: 10, phone: "0912345678" },
    draft: "",
    onSearch() {},
    onClear() {},
    onReload() {},
    onClearFilters: () => {
      filtersCleared = true;
    },
    filteredTotal: 1,
    statsTotal: 42,
  });

  // Verify filter badge renders when phone filter is active in URL query
  const clearFilterBtn = find(
    tree,
    (n) => n.props?.["aria-label"] === "Xóa các điều kiện lọc hiện tại",
  );
  assert.ok(clearFilterBtn, "filter badge with clear action is displayed");
  clearFilterBtn.props.onClick();
  assert.equal(filtersCleared, true, "clicking clear removes active filters");
});

test("CustomerFilters manual reload exposes pending state without changing label width", () => {
  const tree = CustomerFilters({
    query: { page: 1, pageSize: 20 }, draft: "", reloading: true,
    onSearch() {}, onClear() {}, onReload() {}, onClearFilters() {},
  });
  const btn = find(tree, (n) => n.props?.["aria-label"] === "Làm mới");
  assert.ok(btn);
  assert.equal(btn.props.disabled, true);
  assert.equal(btn.props["aria-busy"], true);
});
