import test from "node:test";
import assert from "node:assert/strict";
import {
  loadComponent,
  React,
  render,
} from "../../../scripts/test-helpers/render-component.mjs";
const { Pager } = loadComponent(new URL("../src/Pager.tsx", import.meta.url));
const props = {
  page: 2,
  pages: [1, 2, 5],
  targets: { first: 1, previous: 1, next: 3, last: 5 },
  disabled: {
    first: false,
    previous: false,
    numbers: false,
    next: false,
    last: false,
  },
  onPage() {},
  summary: React.createElement("strong", null, "feature summary"),
  selectedVariant: "emphasis",
  icons: { first: "<<", previous: "<", next: ">", last: ">>" },
  labels: {
    navigation: "Pages",
    first: "First",
    previous: "Previous",
    next: "Next",
    last: "Last",
    page: (n) => `Page ${n}`,
  },
};
function nodes(node, results = []) {
  if (!node || typeof node !== "object") return results;
  if (Array.isArray(node)) {
    for (const n of node) nodes(n, results);
    return results;
  }
  results.push(node);
  nodes(node.props?.children, results);
  return results;
}
test("Pager delegates every navigation target and preserves semantic summary and slots", () => {
  const calls = [];
  const tree = Pager({
    ...props,
    onPage: (n) => calls.push(n),
    pageSize: React.createElement("select", { "aria-label": "Size" }),
  });
  const buttons = nodes(tree).filter(
    (n) => n.props?.["aria-label"] && n.props?.onClick,
  );
  for (const button of buttons) button.props.onClick();
  assert.deepEqual(calls, [1, 1, 1, 2, 5, 3, 5]);
  const html = render(React.createElement(Pager, props));
  assert.match(html, /<nav[^>]*aria-label="Pages"/);
  assert.match(html, /<strong>feature summary<\/strong>/);
  assert.match(html, /aria-current="page"/);
  assert.match(html, /data-variant="emphasis"/);
});
test("Pager independently honors all five disabled states and unknown current-page authority", () => {
  for (const which of ["first", "previous", "numbers", "next", "last"]) {
    const tree = Pager({
      ...props,
      disabled: { ...props.disabled, [which]: true },
    });
    const buttons = nodes(tree).filter((n) => n.props?.onClick);
    assert.equal(
      buttons.filter((n) => n.props.disabled).length,
      which === "numbers" ? 3 : 1,
    );
  }
  const html = render(
    React.createElement(Pager, {
      ...props,
      currentPageKnown: false,
      disabled: {
        first: true,
        previous: true,
        numbers: true,
        next: true,
        last: true,
      },
    }),
  );
  assert.doesNotMatch(html, /aria-current/);
  assert.equal((html.match(/disabled=""/g) ?? []).length, 7);
});
test("Pager supports empty/single windows and feature-selected press/icon geometry", () => {
  for (const pages of [[], [1]]) {
    const html = render(
      React.createElement(Pager, {
        ...props,
        pages,
        page: 1,
        selectedVariant: "primary",
        pressEffect: "none",
        numberIcon: true,
      }),
    );
    assert.equal(
      (html.match(/data-press-effect="none"/g) ?? []).length,
      4 + pages.length,
    );
    if (pages.length) assert.match(html, /data-variant="primary"/);
  }
});

test("Pager always hides decorative ellipses in grouped and inline layouts", () => {
  for (const numberLayout of ["grouped", "inline"]) {
    const html = render(
      React.createElement(Pager, {
        ...props,
        pages: [1, 2, 5],
        numberLayout,
      }),
    );
    assert.equal(
      (html.match(/<span aria-hidden="true">…<\/span>/g) ?? []).length,
      1,
      `ellipsis must be hidden from screen readers in ${numberLayout} layout`,
    );
  }
});
