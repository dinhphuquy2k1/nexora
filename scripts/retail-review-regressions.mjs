import assert from "node:assert/strict";

// Reuse the real Chromium/Next fixture harness. All user activations here use CDP pointer/keyboard.
export async function runDrawerRegression({
  cdp,
  evaluate,
  wait,
  key,
  navigate,
  pointer,
}) {
  const sidebar =
    "document.querySelector('aside[aria-label=\"Thanh điều hướng chính\"]')";
  const backdrop =
    "document.querySelector('button[aria-label=\"Đóng ngăn điều hướng\"]')";
  const toggle = 'button[aria-label*="thanh điều hướng"]';
  const closed = `getComputedStyle(${sidebar}).visibility==='hidden' && !${backdrop}`;
  const open = `getComputedStyle(${sidebar}).visibility==='visible' && !!${backdrop}`;
  await cdp("Emulation.setDeviceMetricsOverride", {
    width: 390,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await navigate("/shipments/retail");
  await wait(open);
  await pointer('aside nav a[href="/settings"]');
  await wait("location.pathname==='/settings'");
  await wait(closed);
  assert.ok(
    await evaluate(`!${sidebar}.contains(document.activeElement)`),
    "navigation must not focus hidden sidebar",
  );
  await pointer(toggle);
  await wait(open);
  await pointer('aside nav a[href="/settings"]');
  await wait(closed);
  assert.ok(
    await evaluate(`!${sidebar}.contains(document.activeElement)`),
    "same-page link must close safely",
  );
  await pointer(toggle);
  await wait(open);
  await pointer('aside nav a[href^="/shipments/retail"]');
  await wait("location.pathname==='/shipments/retail'");
  await wait(closed);
  await pointer(toggle);
  await wait(open);
  await evaluate(
    "history.pushState(null,'',location.pathname+'?q=drawer-query')",
  );
  assert.ok(await evaluate(open), "query-only change must not close drawer");
  for (let i = 0; i < 14; i++) {
    await key("Tab");
    assert.ok(
      await evaluate(`${sidebar}.contains(document.activeElement)`),
      "Tab must stay in the open modal drawer",
    );
  }
  await key("Escape");
  await wait(closed);
  await wait(
    "document.activeElement?.getAttribute('aria-label')==='Mở rộng thanh điều hướng'",
  );
  for (let i = 0; i < 18; i++) {
    await key("Tab");
    assert.ok(
      await evaluate(`!${sidebar}.contains(document.activeElement)`),
      "hidden sidebar must not receive Tab focus",
    );
  }
  await pointer(toggle);
  await wait(open);
  await pointer('button[aria-label="Đóng menu di động"]');
  await wait(closed);
  await wait(
    "document.activeElement?.getAttribute('aria-label')==='Mở rộng thanh điều hướng'",
  );
  await cdp("Emulation.setDeviceMetricsOverride", {
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await pointer(toggle);
  await wait(`${sidebar}.getBoundingClientRect().width>200`);
  await pointer('aside nav a[href="/settings"]');
  await wait("location.pathname==='/settings'");
  assert.ok(
    await evaluate(`${sidebar}.getBoundingClientRect().width>200`),
    "desktop expanded sidebar must persist",
  );
  await pointer(toggle);
  await wait(`${sidebar}.getBoundingClientRect().width<100`);
  await pointer('aside nav a[href^="/shipments/retail"]');
  await wait("location.pathname==='/shipments/retail'");
  assert.ok(
    await evaluate(`${sidebar}.getBoundingClientRect().width<100`),
    "desktop collapsed sidebar must persist",
  );
}

export async function runSelectorRegression({
  cdp,
  evaluate,
  wait,
  key,
  navigate,
  pointer,
  accountA,
  accountB,
}) {
  const trigger = 'button[aria-label^="Phạm vi vận chuyển"]';
  const panel =
    "document.querySelector('[role=dialog][aria-label=\"Chọn hãng và tài khoản\"]')";
  const list = `${panel}.querySelector(':scope > div')`;
  const selected = `${panel}?.querySelector('button[data-option][aria-pressed=true]')`;
  const visible = `(()=>{const row=${selected},list=${list};if(!row||!list)return false;const r=row.getBoundingClientRect(),v=list.getBoundingClientRect();return r.top>=v.top-1 && r.bottom<=v.bottom+1})()`;
  await cdp("Emulation.setDeviceMetricsOverride", {
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await navigate(`/shipments/retail?provider=uniship&connection=${accountA}`);
  await wait(
    "document.body.textContent.includes('Dữ liệu kiện lẻ chưa được triển khai')",
  );
  await evaluate(
    "document.body.style.minHeight='1800px';window.scrollTo(0,150)",
  );
  await pointer(trigger);
  await wait(panel);
  // Move only the list to reach the fixture row through a native pointer.
  await evaluate(`${list}.scrollTop=${list}.scrollHeight`);
  await pointer(`button[title$="${accountB}"]`);
  await wait(
    `new URLSearchParams(location.search).get('connection')==='${accountB}'`,
  );
  await pointer(trigger);
  await wait(panel);
  await evaluate(`${list}.scrollTop=0`);
  await pointer('button[aria-label="Thu gọn Uniship"]');
  await wait(`!${panel}.querySelector('button[title$="${accountB}"]')`);
  await key("Escape");
  await pointer(trigger);
  await wait(panel);
  await wait(`${panel}.querySelector('button[title$="${accountB}"]')`);
  await wait(visible);
  assert.ok(
    await evaluate(`${list}.scrollTop>0`),
    "selected account below viewport must be revealed in options",
  );
  assert.equal(
    await evaluate("window.scrollY"),
    150,
    "revealing selection must not scroll page",
  );
  await evaluate(`${list}.scrollTop=0`);
  await pointer('button[aria-label="Thu gọn Uniship"]');
  await wait(`!${panel}.querySelector('button[title$="${accountB}"]')`);
  await pointer('input[aria-label="Tìm hãng hoặc tài khoản"]');
  await cdp("Input.insertText", { text: "bổ sung" });
  await wait(`${panel}.textContent.includes('bổ sung')`);
  await evaluate(`${list}.scrollTop=0`);
  await pointer('button[aria-label="Thu gọn Uniship"]');
  await wait(`!${panel}.querySelector('button[title$="${accountB}"]')`);
  await pointer('input[aria-label="Tìm hãng hoặc tài khoản"]');
  const history = (await cdp("Page.getNavigationHistory")).entries;
  const previous = history
    .filter((e) => new URL(e.url).searchParams.get("connection") === accountA)
    .at(-1);
  assert.ok(previous, "fixture needs a real account history entry");
  await cdp("Page.navigateToHistoryEntry", { entryId: previous.id });
  await wait(
    `new URLSearchParams(location.search).get('connection')==='${accountA}'`,
  );
  await wait(visible);
  assert.ok(
    await evaluate(
      "document.activeElement===document.querySelector('input[aria-label=\"Tìm hãng hoặc tài khoản\"]')",
    ),
    "Back must preserve search focus",
  );
  assert.equal(
    await evaluate(
      "document.querySelector('input[aria-label=\"Tìm hãng hoặc tài khoản\"]').value",
    ),
    "bổ sung",
  );
  await evaluate(`${list}.scrollTop=0`);
  await pointer('button[aria-label="Thu gọn Uniship"]');
  await wait(`!${panel}.querySelector('button[title$="${accountA}"]')`);
  await pointer('input[aria-label="Tìm hãng hoặc tài khoản"]');
  await cdp("Page.navigateToHistoryEntry", { entryId: history.at(-1).id });
  await wait(
    `new URLSearchParams(location.search).get('connection')==='${accountB}'`,
  );
  await wait(visible);
  assert.equal(
    await evaluate(
      `${panel}.querySelectorAll('[data-option][aria-pressed=true]').length`,
    ),
    1,
  );
  assert.ok(
    await evaluate(`${panel}.textContent.includes('bổ sung')`),
    "search results must coexist with selected row",
  );
  // Clear search, then explicitly collapse: selection reveal must not fight this user action.
  await pointer('input[aria-label="Tìm hãng hoặc tài khoản"]');
  await key("a", "KeyA", 2);
  await key("Backspace");
  await evaluate(`${list}.scrollTop=0`);
  await pointer('button[aria-label="Thu gọn Uniship"]');
  await wait(`!${panel}.querySelector('button[title$="${accountB}"]')`);
  await key("Escape");
  assert.equal(
    await evaluate(
      `getComputedStyle(document.querySelector('${trigger}')).width`,
    ),
    "260px",
  );
  await wait(
    `getComputedStyle(document.querySelector('${trigger}')).backgroundColor==='rgb(255, 255, 255)'`,
  );
}

export async function runRetailReturnRegression({ base }) {
  const target =
    "/shipments/retail?provider=uniship&connection=22222222-2222-4222-8222-222222222222&q=%C3%A1o&page=3";
  for (const cookie of [undefined, "nexora_session=expired-fixture"]) {
    const response = await fetch(base + target, {
      redirect: "manual",
      headers: cookie ? { cookie } : {},
      signal: AbortSignal.timeout(10000),
    });
    assert.equal(response.status, 307);
    const location = new URL(response.headers.get("location"), base);
    assert.equal(location.pathname, "/login");
    assert.equal(
      location.searchParams.get("from"),
      target,
      "scoped retail deep link must survive both cookie-missing and server-rejected session redirects",
    );
  }
}
