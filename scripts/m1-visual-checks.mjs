// Extends the existing CDP session; never receives credentials or session tokens.
import { waitForInteractiveLogin } from "./browser-login-ready.mjs";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { createHash } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
export const M1_VIEWPORTS = [
  { width: 1440, height: 900 },
  { width: 1280, height: 800 },
  { width: 1024, height: 768 },
  { width: 768, height: 1024 },
  { width: 390, height: 844 },
  { width: 375, height: 812 },
];
export async function verifyM1Visuals({
  send,
  evaluate,
  phase,
  prefix,
  directory = process.env.M1_EVIDENCE_DIR,
}) {
  if (!directory) return; // Ordinary non-M1 callers retain existing smoke behavior.
  assert.ok(["login", "mfa", "shell"].includes(phase));
  assert.ok(["admin", "operator"].includes(prefix));
  const root = resolve(directory);
  await mkdir(root, { recursive: true });
  const records = [];
  async function until(expression) {
    for (let i = 0; i < 100; i++) {
      if (await evaluate(expression)) return;
      await delay(100);
    }
    throw Error("M1 visual condition timeout");
  }
  async function capture(viewport, state) {
    // A screenshot must never contain password/proof input, even in test artifacts.
    assert.equal(
      await evaluate(
        'Array.from(document.querySelectorAll("input[name=password],input[name=mfa-code]")).some(e=>e.value.length>0)',
      ),
      false,
    );
    const shot = await send("Page.captureScreenshot", {
      format: "png",
      captureBeyondViewport: true,
    });
    const name = `${prefix}-${phase}-${viewport.width}x${viewport.height}-${state}.png`;
    const bytes = Buffer.from(shot.data, "base64");
    await writeFile(join(root, name), bytes);
    records.push({
      file: name,
      width: viewport.width,
      height: viewport.height,
      state,
      sha256: createHash("sha256").update(bytes).digest("hex"),
    });
  }
  try {
    if (phase === "login") await waitForInteractiveLogin({ until, evaluate });
    for (const viewport of M1_VIEWPORTS) {
      await send("Emulation.setDeviceMetricsOverride", {
        ...viewport,
        deviceScaleFactor: 1,
        mobile: viewport.width <= 768,
      });
      await evaluate("document.fonts.ready.then(()=>true)");
      await until("document.documentElement.scrollWidth<=window.innerWidth");
      const labels = await evaluate(
        'Array.from(document.querySelectorAll("input:not([type=hidden])")).every(e=>e.labels?.length>0||e.hasAttribute("aria-label"))',
      );
      assert.equal(labels, true, "inputs require accessible labels");
      if (phase === "shell") {
        await until(
          'Math.round(document.querySelector("header").getBoundingClientRect().height)===56',
        );
        const mobile = viewport.width <= 900;
        if (mobile) {
          await until(
            '!!document.querySelector("button[aria-label=\\"Mở menu di động\\"]")',
          );
          const overflowBefore = await evaluate("document.body.style.overflow");
          await capture(viewport, "closed");
          await evaluate(
            'document.querySelector("button[aria-label=\\"Mở menu di động\\"]").click()',
          );
          await until(
            '!!document.querySelector("dialog[open][aria-label=\\"Điều hướng di động\\"]")',
          );
          assert.equal(
            await evaluate('!!document.activeElement.closest("dialog[open]")'),
            true,
          );
          for (let i = 0; i < 12; i++) {
            await send("Input.dispatchKeyEvent", {
              type: "keyDown",
              key: "Tab",
              code: "Tab",
              windowsVirtualKeyCode: 9,
            });
            await send("Input.dispatchKeyEvent", {
              type: "keyUp",
              key: "Tab",
              code: "Tab",
              windowsVirtualKeyCode: 9,
            });
            assert.equal(
              await evaluate(
                '!!document.activeElement.closest("dialog[open]")',
              ),
              true,
              "modal focus containment",
            );
          }
          assert.equal(
            await evaluate("document.body.style.overflow"),
            "hidden",
          );
          await capture(viewport, "navigation");
          await send("Input.dispatchKeyEvent", {
            type: "keyDown",
            key: "Escape",
            code: "Escape",
            windowsVirtualKeyCode: 27,
          });
          await send("Input.dispatchKeyEvent", {
            type: "keyUp",
            key: "Escape",
            code: "Escape",
            windowsVirtualKeyCode: 27,
          });
          await until('!document.querySelector("dialog[open]")');
          assert.equal(
            await evaluate("document.body.style.overflow"),
            overflowBefore,
          );
          assert.equal(
            await evaluate('document.activeElement.getAttribute("aria-label")'),
            "Mở menu di động",
          );
          await evaluate(
            'document.querySelector("button[aria-label=\\"Mở menu di động\\"]").click()',
          );
          await until('!!document.querySelector("dialog[open]")');
          await send("Input.dispatchMouseEvent", {
            type: "mousePressed",
            x: viewport.width - 4,
            y: 100,
            button: "left",
            clickCount: 1,
          });
          await send("Input.dispatchMouseEvent", {
            type: "mouseReleased",
            x: viewport.width - 4,
            y: 100,
            button: "left",
            clickCount: 1,
          });
          await until('!document.querySelector("dialog[open]")');
          assert.equal(
            await evaluate("document.body.style.overflow"),
            overflowBefore,
          );
          await evaluate(
            'document.querySelector("button[aria-label=\\"Mở menu di động\\"]").click()',
          );
          await until('!!document.querySelector("dialog[open]")');
          await send("Emulation.setDeviceMetricsOverride", {
            width: 1440,
            height: 900,
            deviceScaleFactor: 1,
            mobile: false,
          });
          await until(
            '!document.querySelector("dialog[open]") && document.body.style.overflow!=="hidden"',
          );
          assert.equal(
            await evaluate("document.body.style.overflow"),
            overflowBefore,
          );
          await send("Emulation.setDeviceMetricsOverride", {
            ...viewport,
            deviceScaleFactor: 1,
            mobile: true,
          });
          await until(
            '!!document.querySelector("button[aria-label=\\"Mở menu di động\\"]")',
          );
        } else {
          const expected = viewport.width <= 1100 ? 72 : 240;
          await until(
            `Math.round(document.querySelector("aside").getBoundingClientRect().width)===${expected}`,
          );
          await capture(viewport, expected === 72 ? "collapsed" : "expanded");
          await evaluate(
            'document.querySelector("header button[aria-expanded]").click()',
          );
          await until(
            `Math.round(document.querySelector("aside").getBoundingClientRect().width)===${expected === 72 ? 240 : 72}`,
          );
          await capture(viewport, expected === 72 ? "expanded" : "collapsed");
          await evaluate(
            'document.querySelector("header button[aria-expanded]").click()',
          );
        }
        // Nonmodal popovers must fit even at375px and dismiss by Escape.
        await evaluate(
          'document.querySelector("button[aria-label=\\"Thông báo hệ thống\\"]").click()',
        );
        await until(
          'Array.from(document.querySelectorAll("p")).some(e=>e.textContent.includes("Chưa có thông báo"))',
        );
        assert.equal(
          await evaluate(
            'Array.from(document.querySelectorAll("p")).filter(e=>e.textContent.includes("Chưa có thông báo")).every(e=>{const r=e.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth;})',
          ),
          true,
        );
        await send("Input.dispatchKeyEvent", {
          type: "keyDown",
          key: "Escape",
          code: "Escape",
          windowsVirtualKeyCode: 27,
        });
        await send("Input.dispatchKeyEvent", {
          type: "keyUp",
          key: "Escape",
          code: "Escape",
          windowsVirtualKeyCode: 27,
        });
      } else {
        await capture(viewport, "form");
        if (phase === "login") {
          assert.equal(
            await evaluate(
              '!!document.querySelector("input[name=remember-username]")',
            ),
            true,
          );
          await evaluate(
            'document.querySelector("button").blur();Array.from(document.querySelectorAll("button")).find(e=>e.textContent.includes("Quên mật khẩu")).focus();Array.from(document.querySelectorAll("button")).find(e=>e.textContent.includes("Quên mật khẩu")).click()',
          );
          await until(
            '!!document.querySelector("dialog[open][aria-label=\\"Hỗ trợ đăng nhập\\"]")',
          );
          await send("Input.dispatchKeyEvent", {
            type: "keyDown",
            key: "Escape",
            code: "Escape",
            windowsVirtualKeyCode: 27,
          });
          await send("Input.dispatchKeyEvent", {
            type: "keyUp",
            key: "Escape",
            code: "Escape",
            windowsVirtualKeyCode: 27,
          });
          await until('!document.querySelector("dialog[open]")');
          assert.equal(
            await evaluate("document.activeElement.textContent"),
            "Quên mật khẩu?",
          );
        }
      }
      assert.equal(
        await evaluate("document.documentElement.scrollWidth<=innerWidth"),
        true,
      );
    }
    await send("DOM.enable");
    await send("CSS.enable");
    await evaluate(
      'document.fonts.ready.then(()=>{const p=document.createElement("span");p.dataset.m1FontProof="true";p.textContent="Tiếng Việt — Đặng Thị Ánh Ắ Ằ Ặ Ễ Ự";p.style.cssText="position:fixed;top:0;left:0;z-index:2147483647;background:white;color:black;font-size:16px";document.body.append(p);return new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve(p.getBoundingClientRect().width>0))));})',
    );
    const { root: doc } = await send("DOM.getDocument");
    const { nodeId } = await send("DOM.querySelector", {
      nodeId: doc.nodeId,
      selector: "[data-m1-font-proof]",
    });
    const { fonts } = await send("CSS.getPlatformFontsForNode", { nodeId });
    assert.ok(
      fonts.some(
        (f) =>
          f.isCustomFont && /inter/i.test(f.familyName) && f.glyphCount > 0,
      ),
      `actual local Inter rendering: ${JSON.stringify(fonts)}`,
    );
    await writeFile(
      join(root, `${prefix}-${phase}.json`),
      JSON.stringify(
        { sourceCommit: process.env.GITHUB_SHA ?? null, phase, records, fonts },
        null,
        2,
      ) + "\n",
    );
  } finally {
    await evaluate(
      'document.querySelector("[data-m1-font-proof]")?.remove();true',
    ).catch(() => {});
    await send("Emulation.clearDeviceMetricsOverride");
  }
  console.log(
    `M1 ${prefix} ${phase}: six viewport geometry/keyboard/font evidence PASS`,
  );
}
