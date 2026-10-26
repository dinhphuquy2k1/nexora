// Controlled response scheduling in the existing real browser; not an infrastructure mock PASS.
import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";
export async function verifyCustomerReadRaces({
  send,
  evaluate,
  socket,
  baseUrl,
  fill,
  click,
  ready,
  snapshot,
  customer,
  list,
  checks,
}) {
  await send("Emulation.setDeviceMetricsOverride", {
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  });
  let held,
    interceptError,
    mode = "hold",
    requests = 0;
  const stale = "Không có kết quả A";
  const latest = customer.name;
  const handler = (event) => {
    const m = JSON.parse(event.data);
    if (m.method !== "Fetch.requestPaused") return;
    const p = m.params;
    void (async () => {
      const url = new URL(p.request.url);
      requests++;
      if (url.searchParams.get("q") === stale) {
        held = p.requestId;
        return;
      }
      if (mode === "forbidden") {
        await send("Fetch.fulfillRequest", {
          requestId: p.requestId,
          responseCode: 403,
          responseHeaders: [
            { name: "content-type", value: "application/json" },
          ],
          body: Buffer.from(
            JSON.stringify({
              code: "FORBIDDEN",
              message: "Controlled failure",
            }),
          ).toString("base64"),
        });
        return;
      }
      if (mode === "old") {
        await send("Fetch.fulfillRequest", {
          requestId: p.requestId,
          responseCode: 200,
          responseHeaders: [
            { name: "content-type", value: "application/json" },
          ],
          body: Buffer.from(
            JSON.stringify({
              customers: list.customers,
              pagination: list.pagination,
            }),
          ).toString("base64"),
        });
        return;
      }
      await send("Fetch.continueRequest", { requestId: p.requestId });
    })().catch((e) => {
      interceptError = e;
    });
  };
  const waitHeld = async () => {
    for (let n = 0; n < 100; n++) {
      if (held) return;
      await delay(100);
    }
    throw Error("CUSTOMER_READ_NOT_DISPATCHED");
  };
  socket.addEventListener("message", handler);
  await send("Fetch.enable", {
    patterns: [
      { urlPattern: baseUrl + "/api/customers?*", requestStage: "Request" },
    ],
  });
  try {
    checks.step("CUSTOMER_READ_DEBOUNCE_GENERATION");
    await fill("q", stale);
    assert.equal(
      await evaluate(
        '!!Array.from(document.querySelectorAll("[role=status]")).find(e=>e.textContent.startsWith("Đang tải khách hàng"))',
      ),
      true,
    );
    await delay(150);
    assert.equal(held, undefined);
    await waitHeld();
    await snapshot("loading");
    await fill("q", latest);
    await delay(350);
    await ready();
    assert.equal(
      await evaluate(
        `!!Array.from(document.querySelectorAll('a')).find(a=>a.textContent===${JSON.stringify(customer.code)})`,
      ),
      true,
    );
    // A can be aborted by transport; the feature's generation guard remains unit-tested independently.
    await send("Fetch.fulfillRequest", {
      requestId: held,
      responseCode: 500,
      responseHeaders: [{ name: "content-type", value: "application/json" }],
      body: Buffer.from(
        JSON.stringify({
          code: "INTERNAL_ERROR",
          message: "Controlled stale error",
        }),
      ).toString("base64"),
    }).catch(() => {});
    held = undefined;
    await delay(100);
    assert.equal(
      await evaluate(
        '!!document.querySelector("main [role=alert], main [data-customer-error]")',
      ),
      false,
    );
    assert.equal(
      await evaluate(
        `new URLSearchParams(location.search).get('q')===${JSON.stringify(latest)}`,
      ),
      true,
    );
    checks.step("CUSTOMER_SEARCH_RELOAD_FLUSH");
    await fill("q", "Lan");
    await click("Làm mới");
    await ready();
    assert.equal(
      await evaluate('new URLSearchParams(location.search).get("q")'),
      "Lan",
    );
    await delay(350);
    assert.equal(
      await evaluate('new URLSearchParams(location.search).get("q")'),
      "Lan",
    );
    assert.equal(
      await evaluate('document.querySelector("input[name=q]").value'),
      "Lan",
    );
    await fill("q", latest);
    await delay(350);
    await ready();
    checks.step("CUSTOMER_OLD_STATS_RUNTIME");
    mode = "old";
    await click("Xóa từ khóa tìm kiếm");
    await ready();
    assert.equal(
      await evaluate(
        'document.querySelector("main").textContent.includes("Thống kê chưa khả dụng")',
      ),
      true,
    );
    await snapshot("stats-unavailable");
    mode = "hold";
    await click("Làm mới");
    await ready();
    assert.equal(
      await evaluate(
        'document.querySelector("main").textContent.includes("Thống kê chưa khả dụng")',
      ),
      false,
    );
    checks.step("CUSTOMER_FORBIDDEN_NOT_SESSION");
    mode = "forbidden";
    await click("Làm mới");
    await ready(true);
    assert.equal(await evaluate("location.pathname"), "/customers");
    assert.equal(
      await evaluate(
        '!!document.querySelector("main [role=alert], main [data-customer-error]")',
      ),
      true,
    );
    await snapshot("request-error");
    checks.step("CUSTOMER_FORBIDDEN_EXPLICIT_RETRY");
    await dismissCustomerToasts({ evaluate });
    mode = "hold";
    await click("Làm mới");
    await ready();
    checks.step("CUSTOMER_READ_UNMOUNT");
    await fill("q", stale);
    await waitHeld();
    await evaluate(
      `document.querySelector('a[href="/settings"]').click();true`,
    );
    for (let n = 0; n < 100; n++) {
      if (await evaluate('location.pathname==="/settings"')) break;
      await delay(100);
    }
    assert.equal(await evaluate("location.pathname"), "/settings");
    await send("Fetch.continueRequest", { requestId: held }).catch(() => {});
    held = undefined;
    assert.equal(interceptError, undefined);
    assert.ok(requests >= 4);
  } finally {
    try {
      if (held)
        await send("Fetch.continueRequest", { requestId: held }).catch(
          () => {},
        );
      await send("Fetch.disable");
    } finally {
      socket.removeEventListener("message", handler);
      await send("Emulation.clearDeviceMetricsOverride");
    }
  }
  console.log(
    "Customer controlled debounce/latest/stale-error/old-stats/unmount browser checks PASS",
  );
}

/** Genuine PATCH is continued; only the following GET is fault-injected. */
export async function verifyCustomerPower({
  send,
  evaluate,
  socket,
  baseUrl,
  ready,
  snapshot,
  click,
  checks,
}) {
  let patches = 0,
    failRead = false,
    interceptError;
  const patchIds = [];
  const patchStatuses = new Map();
  const handler = (event) => {
    const message = JSON.parse(event.data);
    if (message.method === "Network.responseReceived") {
      if (patchIds.includes(message.params.requestId))
        patchStatuses.set(
          message.params.requestId,
          message.params.response.status,
        );
      return;
    }
    if (message.method !== "Fetch.requestPaused") return;
    const { requestId, request } = message.params;
    void (async () => {
      if (request.method === "PATCH") {
        patches++;
        patchIds.push(message.params.networkId);
      }
      if (
        failRead &&
        request.method === "GET" &&
        new URL(request.url).pathname === "/api/customers"
      ) {
        await send("Fetch.fulfillRequest", {
          requestId,
          responseCode: 500,
          responseHeaders: [
            { name: "content-type", value: "application/json" },
          ],
          body: Buffer.from(
            JSON.stringify({
              code: "INTERNAL_ERROR",
              message: "Controlled reconciliation failure",
            }),
          ).toString("base64"),
        });
      } else await send("Fetch.continueRequest", { requestId });
    })().catch((error) => {
      interceptError = error;
    });
  };
  const powerSelector = "main tbody button[aria-busy]";
  async function until(predicate) {
    for (let n = 0; n < 100; n++) {
      if (interceptError) throw interceptError;
      if (await evaluate(predicate)) return;
      await delay(100);
    }
    throw Error("CUSTOMER_POWER_CONDITION");
  }
  socket.addEventListener("message", handler);
  await send("Fetch.enable", {
    patterns: [
      { urlPattern: baseUrl + "/api/customers*", requestStage: "Request" },
    ],
  });
  try {
    checks.step("CUSTOMER_TOAST_DISMISS_AND_SINGLE_VIEWPORT");
    assert.equal(
      await evaluate(
        "document.querySelectorAll('[data-toast-viewport]').length",
      ),
      1,
    );
    await dismissCustomerToasts({ evaluate });
    checks.step("CUSTOMER_POWER_SAME_TICK");
    await until(
      `Array.from(document.querySelectorAll('${powerSelector}')).filter(b=>!b.disabled).length>=2`,
    );
    await evaluate(
      `(()=>{const buttons=Array.from(document.querySelectorAll('${powerSelector}')).filter(b=>!b.disabled);buttons[0].click();buttons[1].click();return true;})()`,
    );
    await until(
      `document.querySelectorAll('${powerSelector}').length>=2&&Array.from(document.querySelectorAll('${powerSelector}')).every(b=>!b.disabled)`,
    );
    assert.equal(
      patches,
      1,
      "same-tick two-row action sends exactly one genuine PATCH",
    );
    await ready();
    checks.step("CUSTOMER_TOAST_SUCCESS_TIMER_PAUSES_HOVER");
    const location = await evaluate(
      "(()=>{const el=document.querySelector('[data-toast-message][role=status]');if(!el)return null;const r=el.getBoundingClientRect();return{x:r.left+r.width/2,y:r.top+r.height/2};})()",
    );
    assert.ok(location);
    await send("Input.dispatchMouseEvent", { type: "mouseMoved", ...location });
    await delay(5200);
    assert.equal(
      await evaluate(
        "Boolean(document.querySelector('[data-toast-message][role=status]'))",
      ),
      true,
      "hover pauses success expiry",
    );
    await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: 0, y: 0 });
    await until("!document.querySelector('[data-toast-message][role=status]')");
    checks.step("CUSTOMER_POWER_COMMITTED_WRITE_FAILED_READ");
    await dismissCustomerToasts({ evaluate });
    const target = await evaluate(
      `document.querySelector('${powerSelector}').closest('tr').querySelector('a[href]').getAttribute('href')`,
    );
    assert.match(target, /^\/customers\/[0-9a-f-]{36}$/i);
    const readTarget = () =>
      evaluate(
        `fetch('/api'+${JSON.stringify(target)}).then(async r=>({status:r.status,value:(await r.json()).customer.status}))`,
      );
    const before = await readTarget();
    assert.equal(before.status, 200);
    assert.ok(["ACTIVE", "INACTIVE"].includes(before.value));
    failRead = true;
    await evaluate(`document.querySelector('${powerSelector}').click();true`);
    await until(
      `!!document.querySelector('main [data-customer-error]')&&document.querySelectorAll('${powerSelector}').length>=2&&Array.from(document.querySelectorAll('${powerSelector}')).every(b=>b.disabled)`,
    );
    assert.equal(patches, 2);
    assert.equal(
      patchStatuses.get(patchIds[1]),
      200,
      "second actual PATCH must return HTTP200",
    );
    const committed = await readTarget();
    assert.equal(committed.status, 200);
    assert.equal(
      committed.value,
      before.value === "ACTIVE" ? "INACTIVE" : "ACTIVE",
      "nonfaulted owner read proves second write committed",
    );
    assert.equal(
      await evaluate(
        `Array.from(document.querySelectorAll('[data-toast-message]')).some(e=>e.getAttribute('role')==='status'&&e.textContent.includes('Đã cập nhật trạng thái'))&&Array.from(document.querySelectorAll('[data-toast-message]')).some(e=>e.getAttribute('role')==='alert')`,
      ),
      true,
      "confirmed write and failed read have distinct actual Toasts",
    );
    checks.step("CUSTOMER_TOAST_PERSISTENT_ERROR_KEYBOARD_DISMISS");
    await delay(5200);
    assert.equal(
      await evaluate(
        "Boolean(document.querySelector('[data-toast-message][role=alert]'))",
      ),
      true,
      "error never expires automatically",
    );
    await snapshot("power-reconciliation-error");
    checks.step("CUSTOMER_TOAST_KEYBOARD_DISMISS");
    await send("Page.bringToFront");
    await evaluate(
      "document.querySelector('button[aria-label=\"Làm mới\"]').focus();document.querySelector('[data-toast-message][role=alert]').parentElement.querySelector('button').focus();true",
    );
    assert.equal(
      await evaluate(
        "document.hasFocus()&&Boolean(document.activeElement.closest('[data-toast-id]'))",
      ),
      true,
      "actual Toast close control must have keyboard focus",
    );
    await send("Input.dispatchKeyEvent", {
      type: "keyDown",
      key: "Enter",
      code: "Enter",
      windowsVirtualKeyCode: 13,
    });
    await send("Input.dispatchKeyEvent", {
      type: "keyUp",
      key: "Enter",
      code: "Enter",
      windowsVirtualKeyCode: 13,
    });
    await until("!document.querySelector('[data-toast-message][role=alert]')");
    assert.equal(
      await evaluate(
        "document.activeElement===document.querySelector('button[aria-label=\"Làm mới\"]')",
      ),
      true,
      "keyboard dismissal restores previous live focus",
    );
    assert.equal(
      await evaluate(
        "Boolean(document.querySelector('main [data-customer-error]'))",
      ),
      true,
      "essential error stays inline after Toast dismissal",
    );
    failRead = false;
    checks.step("CUSTOMER_POWER_EXPLICIT_READ_RETRY");
    await click("Đối chiếu lại dữ liệu");
    checks.step("CUSTOMER_POWER_RETRY_READ_SETTLED");
    await ready();
    checks.step("CUSTOMER_POWER_RETRY_CONTROLS_ENABLED");
    await until(
      `document.querySelectorAll('${powerSelector}').length>=2&&Array.from(document.querySelectorAll('${powerSelector}')).every(b=>!b.disabled)`,
    );
    assert.equal(patches, 2, "Retry reconciles GET without repeating PATCH");
    assert.equal(interceptError, undefined);
  } finally {
    socket.removeEventListener("message", handler);
    await send("Fetch.disable");
  }
}

export async function dismissCustomerToasts({ evaluate }) {
  for (let n = 0; n < 6; n++) {
    const dismissed = await evaluate(
      "(()=>{const button=document.querySelector('[data-toast-viewport] button');if(!button)return false;button.click();return true;})()",
    );
    if (!dismissed) break;
  }
  assert.equal(
    await evaluate("document.querySelectorAll('[data-toast-message]').length"),
    0,
  );
}
