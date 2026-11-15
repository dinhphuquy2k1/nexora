// Extends the existing CDP session and synthetic DTO fixture; no new launcher.
import assert from "node:assert/strict";
export async function verifyRetailLoading({
  send,
  evaluate,
  navigate,
  until,
  origin,
  snapshot,
  viewports,
}) {
  const measurements = [];
  const measure = () =>
    evaluate(`(()=>{
    const root=document.querySelector('#retail-packages-list-page');
    const rect=e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height}};
    const find=name=>root.querySelector('[class*="'+name+'"]');
    const header=root.querySelector('thead');
    const skeleton=[...root.querySelectorAll('tbody tr[data-skeleton]')];
    const firstCard=root.querySelector('[data-skeleton-card], [class*="mobileCard"][role="button"]');
    const cardBounds=firstCard?{...rect(firstCard),product:rect(firstCard.querySelector('[class*="mobileCardProduct"]')),meta:rect(firstCard.querySelector('[class*="mobileCardMeta"]'))}:null;
    return {
      firstCard:cardBounds,
      deck:rect(find('commandDeck')),tabs:rect(find('tabBarWrapper')),toolbar:rect(find('toolbar')),card:rect(find('dataCard')),header:rect(header),footer:rect(find('paginationBar')),
      tabWidths:[...root.querySelectorAll('[role=tab]')].map(e=>e.getBoundingClientRect().width),
      badges:[...root.querySelectorAll('[role=tab] [class*="tabCount"]')].map(e=>({text:e.textContent,width:e.getBoundingClientRect().width})),
      skeleton:skeleton.length,cells:skeleton.map(e=>e.cells.length),columns:root.querySelectorAll('col').length,
      cards:root.querySelectorAll('[data-skeleton-card]').length,
      busy:root.querySelector('table').getAttribute('aria-busy'),
      animation:root.querySelector('[data-placeholder]')?getComputedStyle(root.querySelector('[data-placeholder]')).animationName:null,
      noOverflow:document.documentElement.scrollWidth<=innerWidth,
      hidden:skeleton.every(e=>e.getAttribute('aria-hidden')==='true'),
      visibleLoading:[...root.querySelectorAll('p,td')].some(e=>e.textContent.includes('Đang tải danh sách kiện lẻ')),
      shadow:getComputedStyle(root.querySelector('th[data-column="trackingCode"]')).boxShadow,
      border:getComputedStyle(root.querySelector('th[data-column="trackingCode"]')).borderBottom,
      ordinaryBorder:getComputedStyle(root.querySelector('th[data-column="productName"]')).borderBottom,
    };
  })()`);
  const stable = (before, after, width) => {
    for (const name of [
      "deck",
      "tabs",
      "toolbar",
      "card",
      "header",
      "footer",
    ]) {
      // Mobile content height naturally changes with row count; anchors above cards remain fixed.
      const fields =
        width < 768 && ["card", "footer"].includes(name)
          ? ["x", "width"]
          : ["x", "y", "width", "height"];
      for (const field of fields)
        assert.ok(
          Math.abs(before[name][field] - after[name][field]) < 1,
          `${width} ${name}.${field} displaced`,
        );
    }
    assert.deepEqual(
      before.tabWidths,
      after.tabWidths,
      "badge change displaced tabs",
    );
    assert.equal(after.noOverflow, true);
    assert.equal(after.shadow, "none");
    assert.equal(after.border, after.ordinaryBorder);
  };
  for (const [width, height] of viewports) {
    await send("Emulation.setDeviceMetricsOverride", {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await navigate(origin + "/fixture?fixtureMode=held");
    await until("document.querySelectorAll('tr[data-skeleton]').length===5");
    await evaluate("document.fonts.ready");
    const initial = await measure();
    if (width === viewports[0][0]) {
      await snapshot("v2-initial-loading");
      await send("Emulation.setDeviceMetricsOverride", {
        width,
        height,
        deviceScaleFactor: 1,
        mobile: false,
      });
    }
    assert.equal(initial.cards, 5);
    assert.equal(initial.hidden, true);
    assert.equal(initial.busy, "true");
    assert.equal(initial.visibleLoading, false);
    assert.ok(initial.cells.every((n) => n === initial.columns));
    await send("Emulation.setEmulatedMedia", {
      features: [{ name: "prefers-reduced-motion", value: "reduce" }],
    });
    assert.equal((await measure()).animation, "none");
    await send("Emulation.setEmulatedMedia", { features: [] });
    await evaluate("window.__retailFixture.release();true");
    await until(
      "document.querySelector('[data-read-state]').dataset.readState==='ready'",
    );
    const loaded = await measure();
    measurements.push({ width, height, initial, loaded });
    stable(initial, loaded, width);
    if (width < 768) {
      assert.ok(initial.firstCard.height > 0 && loaded.firstCard.height > 0);
      assert.ok(Math.abs(initial.firstCard.x - loaded.firstCard.x) < 1);
      assert.ok(Math.abs(initial.firstCard.width - loaded.firstCard.width) < 1);
      // Real product/meta text may wrap; compare the remaining card structure.
      const structure = (c) => c.height - c.product.height - c.meta.height;
      assert.ok(
        Math.abs(structure(initial.firstCard) - structure(loaded.firstCard)) <=
          2,
        "mobile skeleton structural height must match actual card",
      );
    }
    for (const status of ["to_origin", "all"]) {
      await evaluate(
        `window.__retailFixture.hold();document.querySelector('#retail-tab-${status}').click();true`,
      );
      await until("document.querySelectorAll('tr[data-skeleton]').length===5");
      const pending = await measure();
      measurements.push({ width, height, status, pending });
      if (width === viewports[0][0] && status === "to_origin") {
        await snapshot("v2-tab-loading");
        await send("Emulation.setDeviceMetricsOverride", {
          width,
          height,
          deviceScaleFactor: 1,
          mobile: false,
        });
      }
      stable(loaded, pending, width);
      assert.deepEqual(
        pending.badges.map((x) => x.text),
        loaded.badges.map((x) => x.text),
        "known counts must survive tab navigation",
      );
      await evaluate("window.__retailFixture.release();true");
      await until(
        "document.querySelector('[data-read-state]').dataset.readState==='ready'",
      );
      stable(loaded, await measure(), width);
    }
    if (width >= 768) {
      for (const offset of [0, 180]) {
        const sticky = await evaluate(
          `(()=>{const scroll=document.querySelector('[class*="tableScroll"]');scroll.scrollLeft=${offset};const th=scroll.querySelector('th[data-column="trackingCode"]'),body=scroll.querySelector('tr[data-package-id] td[data-column="trackingCode"]');return{left:th.getBoundingClientRect().left-scroll.getBoundingClientRect().left,position:getComputedStyle(th).position,shadow:getComputedStyle(th).boxShadow,bodyShadow:getComputedStyle(body).boxShadow}})()`,
        );
        assert.equal(sticky.position, "sticky");
        assert.equal(sticky.shadow, "none");
        assert.notEqual(sticky.bodyShadow, "none");
        if (offset) assert.ok(Math.abs(sticky.left) < 2);
      }
    }
  }
  await send("Emulation.clearDeviceMetricsOverride");
  await navigate(origin + "/fixture");
  await until(
    "document.querySelector('[data-read-state]').dataset.readState==='ready'",
  );
  // Actual shared badges with the Retail class: measure representative values without clipping.
  const badgeGeometry = await evaluate(
    `(()=>{const b=document.querySelector('#retail-tab-all [class*="tabCount"]'),text=b.firstElementChild,original=text.textContent;const values=['—','0','1','10','100','1000000000'];const measurements=values.map(value=>{text.textContent=value;return{value,width:b.getBoundingClientRect().width,scroll:b.scrollWidth,client:b.clientWidth}});text.textContent=original;return measurements})()`,
  );
  assert.equal(new Set(badgeGeometry.slice(0, 5).map((x) => x.width)).size, 1);
  assert.ok(badgeGeometry.at(-1).width > badgeGeometry[0].width);
  assert.ok(
    badgeGeometry.every((x) => x.scroll <= x.client),
    "large counts must not clip",
  );
  await snapshot("v2-loading-verified");
  console.log(
    "RETAIL_V2_GEOMETRY_PASS",
    JSON.stringify({ viewports, badgeGeometry, measurements }),
  );
}
