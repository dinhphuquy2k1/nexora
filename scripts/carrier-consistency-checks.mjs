import assert from "node:assert/strict";

// Extends the existing real CDP fixture session; no alternate launcher or product flags.
export async function verifyCarrierConsistency({
  send,
  evaluate,
  until,
  click,
  pointer,
  key,
  input,
  select,
  viewport,
  navigate,
  openSurface,
  capture,
  checks,
}) {
  checks.step("CARRIER_STATUS_ENVIRONMENT_COMPUTED_MATRIX");
  const readBadges = () =>
    evaluate(
      `(()=>{const read=e=>{const s=getComputedStyle(e),dot=getComputedStyle(e.firstElementChild),r=e.getBoundingClientRect();return {label:e.textContent.trim(),color:s.color,bg:s.backgroundColor,border:s.borderColor,dot:dot.backgroundColor,width:r.width,height:r.height}};return {table:read(document.querySelector('tbody span[data-tone=good],tbody span[data-tone=bad]')),header:read(document.querySelector('dialog[open]>header span[data-tone=good],dialog[open]>header span[data-tone=bad]'))}})()`,
    );
  const statuses = {
    CONNECTED: "Đang kết nối",
    ERROR: "Lỗi kết nối",
    REAUTH_REQUIRED: "Cần xác thực lại",
  };
  for (const [width, height] of [
    [1440, 900],
    [1280, 800],
    [1024, 768],
    [768, 1024],
    [390, 844],
    [375, 812],
  ]) {
    let good;
    for (const [status, label] of Object.entries(statuses)) {
      let previous;
      for (const environment of ["production", "sandbox"]) {
        await viewport(width, height);
        await navigate(
          `?parity&statusCase=${status}&environmentCase=${environment}`,
        );
        await until("document.querySelectorAll('tbody tr').length===1");
        await openSurface("sync-status");
        const current = await readBadges();
        assert.equal(current.table.label, label);
        assert.equal(current.header.label, label);
        if (previous)
          assert.deepEqual(
            current,
            previous,
            "environment cannot replace status or shift badge geometry",
          );
        if (status === "CONNECTED") good = current;
        else {
          for (const place of ["table", "header"])
            for (const property of ["color", "bg", "border", "dot"])
              assert.notEqual(
                current[place][property],
                good[place][property],
                `${status} ${place} ${property} must not appear successful`,
              );
          assert.equal(
            current.header.dot,
            current.table.dot,
            "navy header retains error dot",
          );
          // Verify semantic bindings on the actual control with existing token roles, not duplicated RGB constants.
          await evaluate(
            `(()=>{const root=document.documentElement;window.__carrierSavedTokens=['--color-carrier-header-error-bg','--color-carrier-header-error-text','--color-carrier-header-error-border'].map(n=>[n,root.style.getPropertyValue(n),root.style.getPropertyPriority(n)]);root.style.setProperty('--color-carrier-header-error-bg','var(--color-surface-subtle)');root.style.setProperty('--color-carrier-header-error-text','var(--color-primary)');root.style.setProperty('--color-carrier-header-error-border','var(--color-border)');})()`,
          );
          try {
            assert.equal(
              await evaluate(
                `(()=>{const badge=getComputedStyle(document.querySelector('dialog[open]>header span[data-tone]')),footer=getComputedStyle(document.querySelector('[data-carrier-pagination]')),tableHead=getComputedStyle(document.querySelector('thead'));return badge.backgroundColor===footer.backgroundColor && badge.color===tableHead.backgroundColor && badge.borderTopColor===footer.borderTopColor})()`,
              ),
              true,
              "dark error token overrides reach real badge",
            );
          } finally {
            await evaluate(
              `(()=>{for(const[n,v,p]of window.__carrierSavedTokens){if(v)document.documentElement.style.setProperty(n,v,p);else document.documentElement.style.removeProperty(n)}delete window.__carrierSavedTokens})()`,
            );
          }
        }
        previous = current;
        await capture(`status-${status}-${environment}`, width, height);
      }
    }
  }

  checks.step("CARRIER_MENU_SCROLL_KEYBOARD_AND_CLEANUP");
  await viewport(1440, 900);
  await navigate();
  await until("document.querySelectorAll('tbody tr').length===10");
  await select("Số dòng tài khoản mỗi trang", "50");
  await until("document.querySelectorAll('tbody tr').length===27");
  const trigger = "tbody tr:first-child button[aria-haspopup=menu]";
  const handle = await send("Runtime.evaluate", {
    expression: "window",
    returnByValue: false,
  });
  const scrollListeners = async () => {
    const r = await send("DOMDebugger.getEventListeners", {
      objectId: handle.result.objectId,
    });
    return r.listeners.filter((l) => l.type === "scroll" && l.useCapture)
      .length;
  };
  const settle = () =>
    evaluate(
      "new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))",
    );
  const base = await scrollListeners();
  async function open() {
    await pointer(trigger);
    await until("!!document.querySelector('[role=menu]')");
    await settle();
    assert.equal(await scrollListeners(), base + 1);
  }
  try {
    for (const [deltaX, deltaY] of [
      [0, 120],
      [-120, 0],
    ]) {
      await evaluate("document.querySelector('[role=region]').scrollTop=0");
      await settle();
      await open();
      const before = await evaluate(
        "({x:document.querySelector('[role=region]').scrollLeft,y:document.querySelector('[role=region]').scrollTop})",
      );
      const point = await evaluate(
        "(()=>{const r=document.querySelector('[role=region]').getBoundingClientRect();return {x:r.left+80,y:r.top+80}})()",
      );
      await send("Input.dispatchMouseEvent", {
        type: "mouseWheel",
        ...point,
        deltaX,
        deltaY,
      });
      await until("!document.querySelector('[role=menu]')");
      await settle();
      const after = await evaluate(
        "({x:document.querySelector('[role=region]').scrollLeft,y:document.querySelector('[role=region]').scrollTop})",
      );
      assert.ok(
        before.x !== after.x || before.y !== after.y,
        "genuine table scroll occurred",
      );
      assert.equal(await scrollListeners(), base);
    }
    await evaluate("document.querySelector('[role=region]').scrollTop=0");
    await settle();
    for (let i = 0; i < 3; i++) {
      await open();
      await key("End");
      assert.equal(
        await evaluate("document.activeElement.textContent.trim()"),
        "Ngắt kết nối",
      );
      await key("Home");
      assert.equal(
        await evaluate("document.activeElement.textContent.trim()"),
        "Chi tiết đồng bộ",
      );
      await key("ArrowDown");
      assert.equal(
        await evaluate("document.activeElement.textContent.trim()"),
        "Chi tiết tài khoản",
      );
      await key("ArrowUp");
      await key("Escape");
      await until("!document.querySelector('[role=menu]')");
      assert.equal(
        await evaluate(
          `document.activeElement===document.querySelector(${JSON.stringify(trigger)})`,
        ),
        true,
      );
      await settle();
      assert.equal(await scrollListeners(), base);
    }
    await open();
    await viewport(1280, 800);
    await until("!document.querySelector('[role=menu]')");
    await settle();
    assert.equal(await scrollListeners(), base);
    await open();
    await pointer("h1");
    await until("!document.querySelector('[role=menu]')");
    await settle();
    assert.equal(await scrollListeners(), base);
    await open();
    await click("Chi tiết tài khoản");
    await until("!!document.querySelector('dialog[open]')");
    await key("Escape");
    await until("!document.querySelector('dialog[open]')");
    await settle();
    assert.equal(await scrollListeners(), base);
    await open();
    await input('input[aria-label="Tìm tài khoản kết nối"]', "no-matching-row");
    await until(
      "document.querySelectorAll('tbody tr').length===0 && !document.querySelector('[role=menu]')",
    );
    await settle();
    assert.equal(
      await scrollListeners(),
      base,
      "row unmount removes capture listener",
    );
  } finally {
    await send("Runtime.releaseObject", { objectId: handle.result.objectId });
  }

  checks.step("CARRIER_HISTORY_RAW_TYPES_DATES_AND_PAGES");
  await viewport(1440, 900);
  await navigate();
  await until("document.querySelectorAll('tbody tr').length===10");
  await openSurface("sync-history");
  assert.deepEqual(
    await evaluate(
      "[...document.querySelector('select[aria-label=\"Lọc loại dữ liệu đồng bộ\"]').options].map(o=>o.value)",
    ),
    ["all", "Kiện hàng", "Khách hàng", "Tracking", "Inventory"],
  );
  await click("Trang cuối lịch sử");
  await until(
    "!!document.querySelector('[data-carrier-history-id=\"history-36\"]')",
  );
  await select("Lọc loại dữ liệu đồng bộ", "Kiện hàng");
  await until(
    "!!document.querySelector('[data-carrier-history-id=\"history-0\"]')",
  );
  await select("Lọc lịch sử đồng bộ", "completed");
  await input(
    'input[aria-label="Khoảng ngày lịch sử"]',
    "01/01/2026 - 01/01/2026",
  );
  await click("Lọc lại");
  await until(
    "document.querySelectorAll('[data-carrier-history-id]').length===4",
  );
  assert.deepEqual(
    await evaluate(
      "[...document.querySelectorAll('[data-carrier-history-id]')].map(e=>e.getAttribute('data-carrier-history-id'))",
    ),
    ["history-0", "history-12", "history-24", "history-36"],
  );
  await pointer('[data-carrier-history-id="history-0"]');
  await until("document.querySelectorAll('dialog[open]').length===2");
  await key("Escape");
  await until("document.querySelectorAll('dialog[open]').length===1");
  await key("Escape");
  await until("!document.querySelector('dialog[open]')");
  checks.step("CARRIER_STATUS_SCROLL_HISTORY_REGRESSIONS_PASS");
}
