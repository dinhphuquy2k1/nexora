import assert from "node:assert/strict";
export function assertWorkspaceGeometry(value, width) {
  assert.ok(value, "workspace frames must exist");
  assert.ok(["standard", "wide"].includes(value.variant));
  const gutter = width <= 600 ? 12 : width <= 900 ? 16 : 24;
  assert.equal(value.gutter, gutter);
  assert.ok(
    Math.abs(value.headerLeft - value.mainLeft) < 1,
    "Header/main left edges",
  );
  assert.ok(
    Math.abs(value.headerRight - value.mainRight) < 1,
    "Header/main right edges",
  );
  assert.ok(Math.abs(value.headerHeight - 56) < 1, "sticky Header height");
  if (value.variant === "standard")
    assert.ok(value.frameWidth <= 1601, "standard max width");
  else
    assert.ok(
      Math.abs(value.frameWidth - value.wrapperWidth) < 1,
      "wide fills MainWrapper",
    );
  assert.ok(value.noBodyOverflow, "no document horizontal overflow");
}
export async function verifyWorkspaceGeometry({ evaluate, width }) {
  const value = await evaluate(
    `(()=>{const header=document.querySelector('[data-workspace-frame="header"]'),main=document.querySelector('[data-workspace-frame="content"]');if(!header||!main)return null;const h=header.getBoundingClientRect(),m=main.getBoundingClientRect(),s=getComputedStyle(main),wrapper=main.parentElement;return {variant:main.closest('[data-layout-variant]').dataset.layoutVariant,gutter:parseFloat(s.paddingLeft),headerLeft:h.left+parseFloat(getComputedStyle(header).paddingLeft),headerRight:h.right-parseFloat(getComputedStyle(header).paddingRight),mainLeft:m.left+parseFloat(s.paddingLeft),mainRight:m.right-parseFloat(s.paddingRight),headerHeight:header.closest('header').getBoundingClientRect().height,frameWidth:m.width,wrapperWidth:wrapper.clientWidth,noBodyOverflow:document.documentElement.scrollWidth<=innerWidth};})()`,
  );
  assertWorkspaceGeometry(value, width);
  return value;
}
export async function verifyCustomerTableGeometry({ evaluate }) {
  const value = await evaluate(
    `(()=>{const table=document.querySelector('main table'),row=table?.querySelector('tbody tr');if(!table||!row)return null;const headers=Array.from(table.querySelectorAll('thead th')).map(e=>{const r=e.getBoundingClientRect();return {left:r.left,right:r.right}}),cells=Array.from(row.children).map(e=>{const r=e.getBoundingClientRect();return {left:r.left,right:r.right,colspan:e.colSpan}});return {cols:table.querySelectorAll('colgroup col').length,headers,cells,skeleton:row.hasAttribute('data-skeleton')};})()`,
  );
  assert.ok(value, "real table must exist");
  assert.equal(value.cols, 9);
  assert.equal(value.headers.length, 9);
  if (value.cells.length === 1) {
    assert.equal(value.cells[0].colspan, 9);
    return value;
  }
  assert.equal(value.cells.length, 9);
  for (let i = 0; i < 9; i++) {
    assert.ok(Math.abs(value.headers[i].left - value.cells[i].left) < 1);
    assert.ok(Math.abs(value.headers[i].right - value.cells[i].right) < 1);
  }
  return value;
}
