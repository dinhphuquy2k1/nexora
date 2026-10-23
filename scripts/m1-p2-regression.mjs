import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import {
  terminateChildProcess,
  cleanupBrowserProfile,
} from "./browser-teardown.mjs";

const baseUrl = process.env.BASE_URL || "http://127.0.0.1:3001";
const executable =
  process.env.CHROME_BIN ||
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

console.log(`Starting CDP regression runner with executable: ${executable}`);

const profile = await mkdtemp(join(tmpdir(), "nexora-m1-p2-"));
const chrome = spawn(
  executable,
  [
    "--headless=new",
    "--no-sandbox",
    "--disable-gpu",
    "--remote-debugging-port=0",
    `--user-data-dir=${profile}`,
  ],
  { stdio: ["ignore", "ignore", "pipe"] },
);

let port;
for (let i = 0; i < 100; i++) {
  try {
    port = (await readFile(join(profile, "DevToolsActivePort"), "utf8")).split(
      "\n",
    )[0];
    break;
  } catch {
    await delay(100);
  }
}

if (!port) {
  await terminateChildProcess(chrome).catch(() => {});
  await cleanupBrowserProfile(profile).catch(() => {});
  throw new Error("Failed to start Chrome or obtain DevToolsActivePort");
}

console.log(`Chrome DevTools listening on port ${port}`);
const targets = await fetch(`http://127.0.0.1:${port}/json/list`).then((res) =>
  res.json(),
);
const pageTarget = targets.find((t) => t.type === "page");
console.log(`Connecting to page target: ${pageTarget.webSocketDebuggerUrl}`);

const socket = new globalThis.WebSocket(pageTarget.webSocketDebuggerUrl);
await new Promise((resolve) =>
  socket.addEventListener("open", resolve, { once: true }),
);

let msgId = 0;
const pending = new Map();
socket.addEventListener("message", (event) => {
  const data = JSON.parse(event.data);
  if (data.method === "Runtime.consoleAPICalled") {
    console.log(
      "Browser console:",
      data.params.type,
      data.params.args.map((a) => a.value || a.description),
    );
  }
  if (data.method === "Runtime.exceptionThrown") {
    console.error("Browser exception:", data.params.exceptionDetails);
  }
  if (data.id && pending.has(data.id)) {
    const { resolve, reject } = pending.get(data.id);
    pending.delete(data.id);
    if (data.error) reject(new Error(data.error.message));
    else resolve(data.result);
  }
});

const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const id = ++msgId;
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });

const evaluate = async (expression) => {
  const res = await send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  return res.result?.value;
};

try {
  await send("Page.enable");
  await send("Network.enable");
  await send("Runtime.enable");

  // Log in as operator to obtain valid session cookie
  console.log("Authenticating operator session...");
  let sessionToken = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
        method: "POST",
        headers: { "content-type": "application/json", origin: baseUrl },
        body: JSON.stringify({
          username: "operator_reg_test",
          password: "TestPass123!456",
        }),
      });
      if (loginRes.status === 200) {
        const setCookie = loginRes.headers.get("set-cookie");
        sessionToken = setCookie.match(/nexora_session=([a-f0-9]+)/)[1];
        break;
      }
    } catch {
      // Retry connection
    }
    await delay(500);
  }
  assert.ok(sessionToken, "Operator login failed after retries");

  await send("Network.setCookie", {
    name: "nexora_session",
    value: sessionToken,
    domain: new URL(baseUrl).hostname,
    path: "/",
    httpOnly: true,
    sameSite: "Lax",
  });

  // Inject script to capture first-paint geometry and layout shifts before any app code runs
  await send("Page.addScriptToEvaluateOnNewDocument", {
    source: `
      window.__fpMeasurements = {
        domContentLoadedAsideWidth: null,
        firstPaintAsideWidth: null,
        layoutShifts: [],
      };

      // Measure on DOMContentLoaded (HTML parsed, CSS applied, before hydration completes)
      document.addEventListener("DOMContentLoaded", () => {
        const aside = document.querySelector("aside");
        if (aside) {
          window.__fpMeasurements.domContentLoadedAsideWidth = Math.round(aside.getBoundingClientRect().width);
        }
      });

      // Observe layout shifts
      try {
        new PerformanceObserver((entryList) => {
          for (const entry of entryList.getEntries()) {
            if (!entry.hadRecentInput) {
              window.__fpMeasurements.layoutShifts.push({
                value: entry.value,
                sources: (entry.sources || []).map(s => ({
                  tagName: s.node?.tagName,
                  prevRect: s.previousRect ? { width: s.previousRect.width, left: s.previousRect.left } : null,
                  currRect: s.currentRect ? { width: s.currentRect.width, left: s.currentRect.left } : null,
                })),
              });
            }
          }
        }).observe({ type: "layout-shift", buffered: true });
      } catch (e) {}
    `,
  });

  const errors = [];
  const { writeFile, mkdir } = await import("node:fs/promises");
  await mkdir("scratch/screenshots", { recursive: true });

  const capture = async (name) => {
    const shot = await send("Page.captureScreenshot");
    await writeFile(
      `scratch/screenshots/${name}.png`,
      Buffer.from(shot.data, "base64"),
    );
    console.log(`Saved screenshot: scratch/screenshots/${name}.png`);
  };

  // Test suite 1: First paint geometry at compact desktop viewports (901px, 1024px, 1100px)
  const compactViewports = [
    { w: 901, h: 800 },
    { w: 1024, h: 768 },
    { w: 1100, h: 800 },
  ];
  for (const { w: width, h: height } of compactViewports) {
    console.log(`\nTesting compact desktop viewport: ${width}x${height}`);
    await send("Emulation.setDeviceMetricsOverride", {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: false,
    });

    await send("Page.navigate", { url: `${baseUrl}/` });
    for (let i = 0; i < 50; i++) {
      const ready = await evaluate("document.readyState !== 'loading'");
      if (ready) break;
      await delay(50);
    }
    await delay(300);

    const measurements = await evaluate("window.__fpMeasurements");
    const settledWidth = await evaluate(
      "Math.round(document.querySelector('aside')?.getBoundingClientRect().width || 0)",
    );
    const scrollWidth = await evaluate("document.documentElement.scrollWidth");
    console.log(`Viewport ${width}px results:`, {
      domContentLoadedAsideWidth: measurements?.domContentLoadedAsideWidth,
      settledWidth,
      scrollWidth,
      shiftCount: measurements?.layoutShifts?.length || 0,
      totalShift: (measurements?.layoutShifts || []).reduce(
        (sum, s) => sum + s.value,
        0,
      ),
    });

    if (measurements?.domContentLoadedAsideWidth !== 72) {
      errors.push(
        `Compact desktop (${width}px) must have collapsed width (72px) at first paint, but had ${measurements?.domContentLoadedAsideWidth}px`,
      );
    }
    if (scrollWidth > width) {
      errors.push(
        `Compact desktop (${width}px) has horizontal overflow: scrollWidth ${scrollWidth} > ${width}`,
      );
    }
    if (width === 1024) {
      await capture("compact_1024x768_first_paint");
    }
  }

  // Test suite 2: First paint geometry at expanded desktop viewports (1101px, 1280px, 1440px)
  const expandedViewports = [
    { w: 1101, h: 900 },
    { w: 1280, h: 800 },
    { w: 1440, h: 900 },
  ];
  for (const { w: width, h: height } of expandedViewports) {
    console.log(`\nTesting expanded desktop viewport: ${width}x${height}`);
    await send("Emulation.setDeviceMetricsOverride", {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: false,
    });

    await send("Page.navigate", { url: `${baseUrl}/` });
    for (let i = 0; i < 50; i++) {
      const ready = await evaluate("document.readyState !== 'loading'");
      if (ready) break;
      await delay(50);
    }
    await delay(300);

    const measurements = await evaluate("window.__fpMeasurements");
    const settledWidth = await evaluate(
      "Math.round(document.querySelector('aside')?.getBoundingClientRect().width || 0)",
    );
    const scrollWidth = await evaluate("document.documentElement.scrollWidth");
    console.log(`Viewport ${width}px results:`, {
      domContentLoadedAsideWidth: measurements?.domContentLoadedAsideWidth,
      settledWidth,
      scrollWidth,
    });

    if (measurements?.domContentLoadedAsideWidth !== 240) {
      errors.push(
        `Expanded desktop (${width}px) must have expanded width (240px) at first paint, but had ${measurements?.domContentLoadedAsideWidth}px`,
      );
    }
    if (scrollWidth > width) {
      errors.push(
        `Expanded desktop (${width}px) has horizontal overflow: scrollWidth ${scrollWidth} > ${width}`,
      );
    }
    if (width === 1440) {
      await capture("expanded_1440x900_desktop");
    }
    if (width === 1280) {
      await capture("expanded_1280x800_desktop");
    }
  }

  // Test suite 3: Mobile drawer toggle label, aria-expanded, dialog and close button (768px, 390px, 375px)
  const mobileViewports = [
    { w: 768, h: 1024, name: "tablet_768x1024" },
    { w: 390, h: 844, name: "mobile_390x844" },
    { w: 375, h: 812, name: "mobile_375x812" },
  ];

  for (const { w: width, h: height, name } of mobileViewports) {
    console.log(
      `\nTesting mobile drawer & accessibility at ${width}x${height}...`,
    );
    await send("Emulation.setDeviceMetricsOverride", {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: true,
    });

    await send("Page.navigate", { url: `${baseUrl}/` });
    for (let i = 0; i < 50; i++) {
      const ready = await evaluate(
        "document.readyState === 'complete' && !!document.querySelector('header')",
      );
      if (ready) break;
      await delay(50);
    }
    await delay(300);

    async function until(expr, timeoutMsg) {
      for (let i = 0; i < 100; i++) {
        if (await evaluate(expr)) return;
        await delay(100);
      }
      const current = await evaluate(`({
        label: document.querySelector('header button[aria-expanded]')?.getAttribute('aria-label'),
        expanded: document.querySelector('header button[aria-expanded]')?.getAttribute('aria-expanded'),
        title: document.querySelector('header button[aria-expanded]')?.getAttribute('title'),
        innerWidth: window.innerWidth,
        mediaMatches: window.matchMedia('(max-width: 900px)').matches,
      })`);
      console.error("Condition timed out:", expr, "current:", current);
      throw new Error(timeoutMsg || `Timeout waiting for ${expr}`);
    }

    // Wait for hydration to settle mobile button state
    await until(
      'document.querySelector("header button[aria-expanded]")?.getAttribute("aria-label") === "Mở menu di động"',
      "Hydration timeout: toggle button did not transition to mobile 'Mở menu di động'",
    );

    // Check initial closed state
    const closedState = await evaluate(`({
      expanded: document.querySelector('header button[aria-expanded]')?.getAttribute('aria-expanded'),
      label: document.querySelector('header button[aria-expanded]')?.getAttribute('aria-label'),
      title: document.querySelector('header button[aria-expanded]')?.getAttribute('title'),
      scrollWidth: document.documentElement.scrollWidth,
    })`);
    console.log(`${name} closed state:`, closedState);

    if (
      closedState.expanded !== "false" ||
      closedState.label !== "Mở menu di động" ||
      closedState.title !== "Mở menu di động"
    ) {
      errors.push(
        `${name} closed toggle failed: ${JSON.stringify(closedState)}`,
      );
    }
    if (closedState.scrollWidth > width) {
      errors.push(
        `${name} closed state has horizontal overflow: ${closedState.scrollWidth} > ${width}`,
      );
    }
    await capture(`${name}_closed`);

    // Open the drawer
    await evaluate(
      "document.querySelector('header button[aria-expanded]').click()",
    );
    await until(
      '!!document.querySelector("dialog[open]")',
      "Mobile dialog did not open after toggle click",
    );

    // Check open state
    const openState = await evaluate(`({
      expanded: document.querySelector('header button[aria-expanded]')?.getAttribute('aria-expanded'),
      label: document.querySelector('header button[aria-expanded]')?.getAttribute('aria-label'),
      title: document.querySelector('header button[aria-expanded]')?.getAttribute('title'),
      scrollWidth: document.documentElement.scrollWidth,
      hasCloseButton: !!document.querySelector("dialog[open] button[aria-label='Đóng menu di động']"),
    })`);
    console.log(`${name} open state:`, openState);

    if (openState.expanded !== "true") {
      errors.push(`${name} open toggle must have aria-expanded='true'`);
    }
    if (openState.label !== "Đóng menu di động") {
      errors.push(
        `${name} open toggle must have aria-label='Đóng menu di động', but was '${openState.label}'`,
      );
    }
    if (openState.title !== "Đóng menu di động") {
      errors.push(
        `${name} open toggle must have title='Đóng menu di động', but was '${openState.title}'`,
      );
    }
    if (!openState.hasCloseButton) {
      errors.push(
        `${name} drawer must contain compact close button with aria-label='Đóng menu di động'`,
      );
    }
    if (openState.scrollWidth > width) {
      errors.push(
        `${name} open state has horizontal overflow: ${openState.scrollWidth} > ${width}`,
      );
    }
    await capture(`${name}_open`);

    // Click inside close button to dismiss drawer
    await evaluate(
      "document.querySelector(\"dialog[open] button[aria-label='Đóng menu di động']\").click()",
    );
    await until(
      '!document.querySelector("dialog[open]")',
      "Mobile dialog did not close after close button click",
    );

    const closedAfterButtonClick = await evaluate(`({
      expanded: document.querySelector('header button[aria-expanded]')?.getAttribute('aria-expanded'),
      label: document.querySelector('header button[aria-expanded]')?.getAttribute('aria-label'),
    })`);
    if (
      closedAfterButtonClick.expanded !== "false" ||
      closedAfterButtonClick.label !== "Mở menu di động"
    ) {
      errors.push(
        `${name} failed to reset toggle after close button click: ${JSON.stringify(closedAfterButtonClick)}`,
      );
    }
  }

  // Test suite 4: Login page fidelity and layout
  console.log("\nTesting login page visual fidelity...");
  await send("Emulation.setDeviceMetricsOverride", {
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  });
  // Clear cookie to view login page
  await send("Network.deleteCookies", {
    name: "nexora_session",
    domain: new URL(baseUrl).hostname,
  });
  await send("Page.navigate", { url: `${baseUrl}/login` });
  for (let i = 0; i < 50; i++) {
    const ready = await evaluate(
      "document.readyState === 'complete' && !!document.querySelector('input[name=\"username\"]')",
    );
    if (ready) break;
    await delay(50);
  }
  await delay(500);

  const loginGeometry = await evaluate(`({
    cardWidth: Math.round(document.querySelector("section[aria-labelledby='login-heading']")?.getBoundingClientRect().width || 0),
    monogramPresent: !!document.querySelector(".login_logoMonogram__Wb_a6, [class*='logoMonogram']"),
    inputRadius: window.getComputedStyle(document.querySelector("input[name='username']")).borderRadius,
    submitBg: window.getComputedStyle(document.querySelector("button[type='submit']")).backgroundColor,
    submitColor: window.getComputedStyle(document.querySelector("button[type='submit']")).color,
  })`);
  console.log("Login geometry:", loginGeometry);
  if (loginGeometry.cardWidth > 420) {
    errors.push(
      `Login card width should be <= 420px matching ZIP reference, but was ${loginGeometry.cardWidth}px`,
    );
  }
  await capture("login_page_desktop");

  if (errors.length > 0) {
    console.error("\n--- REGRESSION FAILURES DETECTED (RED EVIDENCE) ---");
    errors.forEach((err, idx) => console.error(`${idx + 1}. ${err}`));
    throw new Error(`Regression checks failed with ${errors.length} error(s)`);
  }

  console.log("\nALL P2 REGRESSION CHECKS PASSED!");
} finally {
  try {
    socket.close();
  } catch {
    // Ignore close errors
  }
  await terminateChildProcess(chrome).catch(() => {});
  await cleanupBrowserProfile(profile).catch(() => {});
}
