import test from "node:test";
import assert from "node:assert/strict";
import { loadComponent, React, render } from "./helpers/render-component.mjs";
const { Panel } = loadComponent(
  new URL("../../../packages/ui/src/Panel.tsx", import.meta.url).pathname,
);
test("Panel keeps title/children compatibility and shares compact/action composition", () => {
  const standard = render(
    React.createElement(Panel, { title: "Tiêu đề" }, "Nội dung"),
  );
  assert.match(standard, /data-density="standard"/);
  assert.match(standard, /<h2[^>]*>Tiêu đề<\/h2>/);
  assert.match(standard, /Nội dung/);
  const compact = render(
    React.createElement(
      Panel,
      {
        title: "Thông tin",
        density: "compact",
        actions: React.createElement("button", {}, "Sửa"),
      },
      "Hồ sơ",
    ),
  );
  assert.match(compact, /data-density="compact"/);
  assert.match(compact, /<button>Sửa<\/button>/);
});
