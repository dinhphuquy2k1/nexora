// Extends the existing Retail CDP session and synthetic read-only fixture.
import assert from "node:assert/strict";
export async function verifyRetailRefresh({
  send,
  evaluate,
  navigate,
  until,
  origin,
}) {
  const ready =
    "document.querySelector('[data-read-state]')?.dataset.readState==='ready'";
  const refresh = '[aria-label="Làm mới dữ liệu"]';
  const count = () =>
    evaluate("document.querySelector('[data-retail-count]').textContent");
  const page = () =>
    evaluate("new URLSearchParams(location.search).get('page')");
  const lists = () =>
    evaluate(
      "window.__retailFixture.events.filter(e=>e.method==='list').length",
    );
  async function click(selector) {
    const point = await evaluate(
      `(()=>{const b=document.querySelector(${JSON.stringify(selector)});if(!b||b.disabled)return null;b.scrollIntoView({block:'center'});const r=b.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`,
    );
    assert.ok(point, selector);
    await send("Input.dispatchMouseEvent", {
      type: "mousePressed",
      button: "left",
      clickCount: 1,
      ...point,
    });
    await send("Input.dispatchMouseEvent", {
      type: "mouseReleased",
      button: "left",
      clickCount: 1,
      ...point,
    });
  }
  const start = async (current = 5) => {
    await navigate(
      origin +
        `/fixture?fixtureMode=refresh&search=REFRESH&page=${current}&pageSize=20`,
    );
    await until(ready);
    await evaluate(
      `window.reviewHistory={push:0,replace:0};for(const k of ['push','replace']){const fn=history[k+'State'].bind(history);history[k+'State']=(...args)=>{window.reviewHistory[k]++;return fn(...args)}};window.reviewDocument=document;true`,
    );
  };
  const replaceCount = (n) =>
    evaluate(`window.__retailFixture.replaceCount(${n});true`);
  const verifyQuery = async () =>
    assert.deepEqual(
      await evaluate(
        "(()=>{const p=new URLSearchParams(location.search);return[p.get('search'),p.get('pageSize')]})()",
      ),
      ["REFRESH", "20"],
    );

  // Regression must exercise the actual shared Button, not call the hook directly.
  await start();
  assert.equal(
    await evaluate(
      `document.querySelector(${JSON.stringify(refresh)})?.disabled`,
    ),
    false,
  );
  for (const [total, expectedPage, range] of [
    [78, 4, "61–78"],
    [15, 1, "1–15"],
    [0, 1, "0–0"],
  ]) {
    await start();
    const before = await lists();
    await replaceCount(total);
    await click(refresh);
    await until(
      `${ready} && new URLSearchParams(location.search).get('page')==='${expectedPage}' && document.querySelector('[data-retail-count]').textContent==='${total} kiện lẻ'`,
    );
    assert.equal(
      await lists(),
      before + 2,
      "one refresh and one corrected-page read",
    );
    assert.equal(
      await evaluate(
        "document.querySelector('[class*=paginationRange]').textContent",
      ),
      range,
    );
    assert.deepEqual(await evaluate("window.reviewHistory"), {
      push: 0,
      replace: 1,
    });
    assert.equal(await evaluate("window.reviewDocument===document"), true);
    await verifyQuery();
    assert.equal(
      await evaluate(
        "document.querySelector('#retail-tab-all [class*=badge]').textContent",
      ),
      String(total),
    );
    assert.equal(
      await evaluate(
        "document.querySelectorAll('tbody [data-package-id]').length",
      ),
      total === 78 ? 18 : total,
    );
  }
  // Page still valid, same-key loading retention, error retention and retry.
  await start(2);
  await replaceCount(95);
  await click(refresh);
  await until(
    `${ready} && document.querySelector('[data-retail-count]').textContent==='95 kiện lẻ'`,
  );
  assert.equal(await page(), "2");
  assert.deepEqual(await evaluate("window.reviewHistory"), {
    push: 0,
    replace: 0,
  });
  await evaluate(
    "window.__retailFixture.hold();window.__retailFixture.fail(true);true",
  );
  await click(refresh);
  await until(
    "document.querySelector('[data-read-state]').dataset.readState==='loading'",
  );
  assert.equal(await page(), "2");
  assert.equal(await count(), "95 kiện lẻ");
  assert.equal(
    await evaluate(
      `document.querySelector(${JSON.stringify(refresh)}).disabled`,
    ),
    true,
  );
  await evaluate("window.__retailFixture.release();true");
  await until(
    "document.querySelector('[data-read-state]').dataset.readState==='error'",
  );
  assert.equal(await page(), "2");
  assert.equal(
    await evaluate(
      `document.querySelector(${JSON.stringify(refresh)}).disabled`,
    ),
    false,
  );
  await evaluate(
    "window.__retailFixture.fail(false);window.__retailFixture.replaceCount(15);true",
  );
  await click("[role=alert] button");
  await until(
    `${ready} && new URLSearchParams(location.search).get('page')==='1'`,
  );

  // Open detail is remounted by the same refresh path; hidden identity returns404.
  await start(1);
  await click('tbody button[aria-label^="Xem"]');
  await until(
    "!!document.querySelector('dialog[open] [data-detail-state=ready]')",
  );
  // The native modal intentionally blocks pointer input to the toolbar. Dispatch
  // the real Button's DOM click while open to verify parent refresh plumbing.
  const detailsBefore = await evaluate(
    "window.__retailFixture.events.filter(e=>e.method==='get'||e.method==='history').length",
  );
  await replaceCount(0);
  await evaluate(
    `document.querySelector(${JSON.stringify(refresh)}).click();true`,
  );
  await until(
    "!!document.querySelector('dialog[open] [data-detail-state=error]')",
  );
  assert.equal(
    await evaluate(
      "window.__retailFixture.events.filter(e=>e.method==='get'||e.method==='history').length",
    ),
    detailsBefore + 2,
  );
  assert.equal(
    await evaluate(
      "!!document.querySelector('dialog [data-detail-state=ready]')",
    ),
    false,
  );
  await until(
    `${ready} && document.querySelector('[data-retail-count]').textContent==='0 kiện lẻ'`,
  );
  // Restore uses the exact same synthetic identity (backend restoration is tested in PG).
  await evaluate("document.querySelector('dialog[open]').close();true");
  await replaceCount(100);
  await click(refresh);
  await until(
    `${ready} && document.querySelectorAll('tbody [data-package-id]').length===20`,
  );

  // Non-all stage and legacy inert filter chips survive correction unchanged.
  const filters = JSON.stringify([
    { field: "trackingCode", operator: "contains", value: "REFRESH" },
  ]);
  await navigate(
    origin +
      "/fixture?fixtureMode=refresh&status=at_origin&search=REFRESH&page=5&pageSize=20&filters=" +
      encodeURIComponent(filters),
  );
  await until(ready);
  await replaceCount(78);
  const beforeKeyboard = await lists();
  await evaluate(
    `document.querySelector(${JSON.stringify(refresh)}).focus();true`,
  );
  await send("Input.dispatchKeyEvent", {
    type: "keyDown",
    key: "Enter",
    code: "Enter",
    windowsVirtualKeyCode: 13,
    text: "\r",
  });
  await send("Input.dispatchKeyEvent", {
    type: "keyUp",
    key: "Enter",
    code: "Enter",
    windowsVirtualKeyCode: 13,
  });
  await until(
    `${ready} && new URLSearchParams(location.search).get('page')==='4'`,
  );
  assert.equal(await lists(), beforeKeyboard + 2);
  assert.equal(
    await evaluate("new URLSearchParams(location.search).get('status')"),
    "at_origin",
  );
  assert.equal(
    await evaluate("new URLSearchParams(location.search).get('filters')"),
    filters,
  );
  assert.equal(
    await evaluate(
      "document.querySelector('[role=tab][aria-selected=true]').id",
    ),
    "retail-tab-at_origin",
  );
  await verifyQuery();

  // A pending search must win over recovery based on the old query's new total.
  await start();
  await replaceCount(0);
  await evaluate("window.__retailFixture.hold();true");
  await click(refresh);
  await until(
    "document.querySelector('[data-read-state]').dataset.readState==='loading'",
  );
  await click("input[type=search]");
  await send("Input.insertText", { text: "-changed" });
  await replaceCount(0);
  await evaluate("window.__retailFixture.release();true");
  await until(
    "new URLSearchParams(location.search).get('search').includes('-changed')",
  );
  await until(ready);
  assert.equal(await page(), "1");
  assert.equal(await evaluate("window.reviewHistory.replace"), 0);
  await evaluate("history.back();true");
  await until("new URLSearchParams(location.search).get('search')==='REFRESH'");
  await until(ready);
  await evaluate("history.forward();true");
  await until(
    "new URLSearchParams(location.search).get('search').includes('-changed')",
  );
  await until(ready);
  for (const search of ["page=bad", "status=disputed&page=5"]) {
    await navigate(origin + "/fixture?fixtureMode=refresh&" + search);
    await until(`!!document.querySelector(${JSON.stringify(refresh)})`);
    assert.equal(
      await evaluate(
        `document.querySelector(${JSON.stringify(refresh)}).disabled`,
      ),
      true,
    );
    assert.equal(await lists(), 0);
  }
  console.log(
    "RETAIL_REFRESH_PAGINATION_PASS",
    JSON.stringify({
      recovery: ["5→4", "5→1", "5→empty"],
      toolbar: "pointer",
      retry: true,
      detail404: true,
      history: true,
      debounce: true,
    }),
  );
  // Restore the expected initial fixture for the existing checks that follow.
  await navigate(origin + "/fixture");
  await until(ready);
}
