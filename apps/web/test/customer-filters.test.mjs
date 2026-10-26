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
test("exact-phone typing stays a local draft until explicit Apply; no invalid prefix request storm", () => {
  const requests = [],
    drafts = [];
  const tree = CustomerFilters({
    query: { page: 1, pageSize: 10 },
    draft: "",
    phoneDraft: "0912345678",
    onPhoneDraft: (value) => drafts.push(value),
    onQuery: (value) => requests.push(value),
    onSearch() {},
    onClear() {},
    onReload() {},
    onClearFilters() {},
  });
  const input = find(tree, (n) => n.props?.name === "phone");
  for (const value of ["0", "09", "091"])
    input.props.onChange({ target: { value } });
  assert.deepEqual(drafts, ["0", "09", "091"]);
  assert.equal(requests.length, 0);
  let prevented = false;
  find(tree, (n) => n.type === "form").props.onSubmit({
    preventDefault() {
      prevented = true;
    },
  });
  assert.equal(prevented, true);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].phone, "0912345678");
  assert.equal(requests[0].page, 1);
  assert.deepEqual(Object.keys(requests[0]).sort(), ["page", "phone"]);
});
