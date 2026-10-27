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
  if (value.mainOutlineStyle !== undefined) {
    assert.ok(
      value.mainOutlineStyle === "none" || value.mainOutlineWidth === 0,
      "Main contentArea must not have an outline",
    );
  }
  if (value.mainBorderTop !== undefined) {
    assert.equal(value.mainBorderTop, 0, "Main must not have border-top");
  }
  if (value.mainBorderLeft !== undefined) {
    assert.equal(value.mainBorderLeft, 0, "Main must not have border-left");
  }
}
export async function verifyWorkspaceGeometry({ evaluate, width }) {
  const value = await evaluate(
    `(()=>{const header=document.querySelector('[data-workspace-frame="header"]'),main=document.querySelector('[data-workspace-frame="content"]');if(!header||!main)return null;const h=header.getBoundingClientRect(),m=main.getBoundingClientRect(),s=getComputedStyle(main),wrapper=main.parentElement;return {variant:main.closest('[data-layout-variant]').dataset.layoutVariant,gutter:parseFloat(s.paddingLeft),headerLeft:h.left+parseFloat(getComputedStyle(header).paddingLeft),headerRight:h.right-parseFloat(getComputedStyle(header).paddingRight),mainLeft:m.left+parseFloat(s.paddingLeft),mainRight:m.right-parseFloat(s.paddingRight),headerHeight:header.closest('header').getBoundingClientRect().height,frameWidth:m.width,wrapperWidth:wrapper.clientWidth,noBodyOverflow:document.documentElement.scrollWidth<=innerWidth,mainOutlineStyle:s.outlineStyle,mainOutlineWidth:parseFloat(s.outlineWidth)||0,mainBorderTop:parseFloat(s.borderTopWidth)||0,mainBorderLeft:parseFloat(s.borderLeftWidth)||0};})()`,
  );
  assertWorkspaceGeometry(value, width);
  return value;
}
export async function verifyMainFocusOutlineContract({ evaluate }) {
  const result = await evaluate(`(()=>{
    const main = document.querySelector('[data-workspace-frame="content"]');
    if (!main) return null;
    const initialStyle = getComputedStyle(main);
    const initialOutline = initialStyle.outlineStyle;
    const initialBorderTop = parseFloat(initialStyle.borderTopWidth) || 0;
    const initialBorderLeft = parseFloat(initialStyle.borderLeftWidth) || 0;

    // Controlled programmatic focus
    main.focus();
    const focused = document.activeElement === main;
    const focusedStyle = getComputedStyle(main);
    const focusedOutline = focusedStyle.outlineStyle;
    const focusedOutlineWidth = parseFloat(focusedStyle.outlineWidth) || 0;
    const focusedBorderTop = parseFloat(focusedStyle.borderTopWidth) || 0;
    const focusedBorderLeft = parseFloat(focusedStyle.borderLeftWidth) || 0;

    // Check interactive child controls retain their focus
    const btn = main.querySelector('button, a[href]');
    let btnHasFocus = false;
    if (btn) {
      btn.focus();
      btnHasFocus = document.activeElement === btn;
    }

    // Blur
    main.blur();

    return {
      hasMain: true,
      tabIndex: main.tabIndex,
      initialOutline,
      initialBorderTop,
      initialBorderLeft,
      focused,
      focusedOutline,
      focusedOutlineWidth,
      focusedBorderTop,
      focusedBorderLeft,
      btnHasFocus,
    };
  })()`);
  assert.ok(result?.hasMain, "Main workspace-frame content must exist");
  assert.equal(
    result.tabIndex,
    -1,
    "Main content must retain tabIndex=-1 for programmatic navigation",
  );
  assert.equal(
    result.focused,
    true,
    "Main content must accept programmatic focus without error",
  );
  assert.ok(
    result.focusedOutline === "none" || result.focusedOutlineWidth === 0,
    "Main content must not display focus outline",
  );
  assert.equal(result.focusedBorderTop, 0, "Main must not have border-top");
  assert.equal(result.focusedBorderLeft, 0, "Main must not have border-left");
  return result;
}
export async function verifyCustomerTableGeometry({ evaluate }) {
  const value = await evaluate(
    `(()=>{const table=document.querySelector('main table'),row=table?.querySelector('tbody tr');if(!table||!row)return null;const headers=Array.from(table.querySelectorAll('thead th')).map(e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e),range=document.createRange();range.selectNodeContents(e);const text=range.getBoundingClientRect();return {left:r.left,right:r.right,textLeft:text.left,textRight:text.right,paddingLeft:parseFloat(s.paddingLeft),paddingRight:parseFloat(s.paddingRight)}}),cells=Array.from(row.children).map(e=>{const r=e.getBoundingClientRect();return {left:r.left,right:r.right,colspan:e.colSpan}});const skeletonRows=Array.from(table.querySelectorAll('tbody tr[data-skeleton]')).map(tr=>{const cList=Array.from(tr.children);return {cellCount:cList.length,rowHeight:tr.getBoundingClientRect().height,fits:cList.every(td=>{const r=td.getBoundingClientRect(),s=getComputedStyle(td),ch=td.firstElementChild;if(!ch)return true;const cr=ch.getBoundingClientRect();return cr.left>=r.left+parseFloat(s.paddingLeft)-1&&cr.right<=r.right-parseFloat(s.paddingRight)+1;}),balanced:[0,1,2,3,4,5,6,7,8].every(idx=>{const td=cList[idx];if(!td)return true;const r=td.getBoundingClientRect(),ch=td.firstElementChild;if(!ch)return true;const cr=ch.getBoundingClientRect();return Math.abs((cr.left+cr.width/2)-(r.left+r.width/2))<1;}),textWidthRatios:[1,2,3,4,7].map(idx=>{const td=cList[idx];if(!td)return 0;const r=td.getBoundingClientRect(),s=getComputedStyle(td),ch=td.firstElementChild;if(!ch)return 0;const usable=r.width-parseFloat(s.paddingLeft)-parseFloat(s.paddingRight);return usable>0?ch.getBoundingClientRect().width/usable:0;})};});return {cols:table.querySelectorAll('colgroup col').length,headers,cells,skeleton:row.hasAttribute('data-skeleton'),skeletonRows,bodyContentFits:Array.from(table.querySelectorAll('tbody tr:not([data-skeleton])')).filter(row=>row.children.length===9).every(row=>Array.from(row.children).every(cell=>{const r=cell.getBoundingClientRect(),s=getComputedStyle(cell),range=document.createRange();range.selectNodeContents(cell);const content=range.getBoundingClientRect();return content.left>=r.left+parseFloat(s.paddingLeft)-1&&content.right<=r.right-parseFloat(s.paddingRight)+1;}))};})()`,
  );
  assert.ok(value, "real table must exist");
  assert.equal(value.cols, 9);
  assert.equal(
    value.bodyContentFits,
    true,
    "actual row content must stay inside its padded columns",
  );
  assert.equal(value.headers.length, 9);
  for (const [index, header] of value.headers.entries()) {
    assert.ok(
      header.textLeft >= header.left + header.paddingLeft - 1,
      `header ${index} text must fit its left content edge`,
    );
    assert.ok(
      header.textRight <= header.right - header.paddingRight + 1,
      `header ${index} text must fit its right content edge`,
    );
  }
  if (value.cells.length === 1) {
    assert.equal(value.cells[0].colspan, 9);
    return value;
  }
  assert.equal(value.cells.length, 9);
  for (let i = 0; i < 9; i++) {
    assert.ok(Math.abs(value.headers[i].left - value.cells[i].left) < 1);
    assert.ok(Math.abs(value.headers[i].right - value.cells[i].right) < 1);
  }
  if (value.skeleton) {
    assert.ok(value.skeletonRows.length === 5, "Skeleton must render 5 rows");
    assert.ok(
      value.skeletonRows.every((r) => r.fits),
      "Skeleton placeholders must remain inside cell padding box",
    );
    assert.ok(
      value.skeletonRows.every((r) => r.balanced),
      "Skeleton horizontal margins must be balanced in all 9 columns",
    );
    assert.ok(
      value.skeletonRows.every((r) =>
        r.textWidthRatios.every((w) => w >= 0.8 && w <= 0.95),
      ),
      "Skeleton text placeholders must occupy 80-92% of usable cell width",
    );
    assert.ok(
      value.skeletonRows.every((r) => Math.abs(r.rowHeight - 44.5) <= 1.5),
      "Skeleton row height must remain stable (~44.5px)",
    );
  }
  return value;
}
