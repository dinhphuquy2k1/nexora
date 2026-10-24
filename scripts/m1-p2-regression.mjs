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

// Relative luminance per WCAG 2.1
function getLuminance(r, g, b) {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

function getContrast(rgb1, rgb2) {
  const l1 = getLuminance(...rgb1);
  const l2 = getLuminance(...rgb2);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

try {
  await send("Page.enable");
  await send("Runtime.enable");
  await send("DOM.enable");
  await send("CSS.enable");

  // Step 1: Authenticate operator session via API to access protected AppShell
  console.log("Authenticating operator session...");
  const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: baseUrl,
    },
    body: JSON.stringify({
      username: "regression_user",
      password: "BrowserTestPass123!",
    }),
  });

  const rawCookie = loginRes.headers.get("set-cookie");
  let sessionToken = null;
  if (rawCookie) {
    const match = rawCookie.match(/nexora_session=([^;]+)/);
    if (match) sessionToken = match[1];
  }

  if (!sessionToken) {
    throw new Error(
      `Failed to obtain session cookie from /api/auth/login, status: ${loginRes.status}`,
    );
  }

  await send("Network.enable");
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
        domContentLoadedBrandDisplay: null,
        layoutShifts: [],
      };

      // Measure on DOMContentLoaded (HTML parsed, CSS applied, before hydration completes)
      document.addEventListener("DOMContentLoaded", () => {
        const aside = document.querySelector("aside");
        if (aside) {
          window.__fpMeasurements.domContentLoadedAsideWidth = Math.round(aside.getBoundingClientRect().width);
        }
        const brand = document.querySelector("header [class*='collapsedBrand']");
        if (brand) {
          window.__fpMeasurements.domContentLoadedBrandDisplay = window.getComputedStyle(brand).display;
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
      domContentLoadedBrandDisplay: measurements?.domContentLoadedBrandDisplay,
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
    if (settledWidth !== 72) {
      errors.push(
        `Compact desktop (${width}px) must settle at collapsed width (72px), but was ${settledWidth}px`,
      );
    }
    // Verify Header first-paint brand display at 901-1100px
    if (measurements?.domContentLoadedBrandDisplay !== "flex") {
      errors.push(
        `Compact desktop (${width}px) Header must display collapsedBrand ('flex') at first paint, but was '${measurements?.domContentLoadedBrandDisplay}'`,
      );
    }
    if (scrollWidth > width) {
      errors.push(
        `Compact desktop (${width}px) has horizontal overflow: scrollWidth ${scrollWidth} > viewport ${width}`,
      );
    }

    const totalShift = (measurements?.layoutShifts || []).reduce(
      (sum, s) => sum + s.value,
      0,
    );
    if (totalShift > 0.05) {
      errors.push(
        `Compact desktop (${width}px) layout shift exceeded 0.05 threshold: ${totalShift}`,
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
      domContentLoadedBrandDisplay: measurements?.domContentLoadedBrandDisplay,
      settledWidth,
      scrollWidth,
    });

    if (measurements?.domContentLoadedAsideWidth !== 240) {
      errors.push(
        `Expanded desktop (${width}px) must have expanded width (240px) at first paint, but had ${measurements?.domContentLoadedAsideWidth}px`,
      );
    }
    if (settledWidth !== 240) {
      errors.push(
        `Expanded desktop (${width}px) must settle at expanded width (240px), but was ${settledWidth}px`,
      );
    }
    // Verify Header first-paint brand display at 1101px+ is "none"
    if (measurements?.domContentLoadedBrandDisplay !== "none") {
      errors.push(
        `Expanded desktop (${width}px) Header must hide collapsedBrand ('none') at first paint, but was '${measurements?.domContentLoadedBrandDisplay}'`,
      );
    }
    if (scrollWidth > width) {
      errors.push(
        `Expanded desktop (${width}px) has horizontal overflow: scrollWidth ${scrollWidth} > viewport ${width}`,
      );
    }

    if (width === 1280) await capture("expanded_1280x800_desktop");
    if (width === 1440) await capture("expanded_1440x900_desktop");
  }

  // Helper to wait for DOM condition
  const until = async (fnStr, errorMsg, timeoutMs = 8000) => {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const ok = await evaluate(fnStr);
      if (ok) return true;
      await delay(50);
    }
    throw new Error(errorMsg || `Timeout waiting for ${fnStr}`);
  };

  // Test suite 3: Mobile drawer accessibility and toggle states (768px, 390px, 375px)
  const mobileViewports = [
    { name: "tablet_768x1024", w: 768, h: 1024 },
    { name: "mobile_390x844", w: 390, h: 844 },
    { name: "mobile_375x812", w: 375, h: 812 },
  ];

  for (const { name, w: width, h: height } of mobileViewports) {
    console.log(
      `\nTesting mobile drawer & accessibility at ${width}x${height}...`,
    );
    await send("Emulation.setDeviceMetricsOverride", {
      width,
      height,
      deviceScaleFactor: 2,
      mobile: true,
    });

    await send("Page.navigate", { url: `${baseUrl}/` });
    await until(
      "document.readyState === 'complete'",
      `Failed to load page at ${width}x${height}`,
    );
    await delay(300);

    // Initial closed state assertions
    const closedState = await evaluate(`({
      expanded: document.querySelector('header button[aria-expanded]')?.getAttribute('aria-expanded'),
      label: document.querySelector('header button[aria-expanded]')?.getAttribute('aria-label'),
      title: document.querySelector('header button[aria-expanded]')?.getAttribute('title'),
      scrollWidth: document.documentElement.scrollWidth,
    })`);
    console.log(`${name} closed state:`, closedState);

    if (closedState.expanded !== "false") {
      errors.push(
        `${name} closed state must have aria-expanded='false', had: ${closedState.expanded}`,
      );
    }
    if (closedState.label !== "Mở menu di động") {
      errors.push(
        `${name} closed state must have aria-label='Mở menu di động', had: ${closedState.label}`,
      );
    }
    if (closedState.scrollWidth > width) {
      errors.push(
        `${name} closed state has horizontal overflow: ${closedState.scrollWidth} > ${width}`,
      );
    }
    await capture(`${name}_closed`);

    // Click toggle button to open drawer
    await evaluate(
      "document.querySelector('header button[aria-expanded]').click()",
    );
    await until(
      '!!document.querySelector("dialog[open]")',
      `Mobile dialog did not open after toggle click at ${width}px`,
    );
    await delay(200);

    const openState = await evaluate(`({
      expanded: document.querySelector('header button[aria-expanded]')?.getAttribute('aria-expanded'),
      label: document.querySelector('header button[aria-expanded]')?.getAttribute('aria-label'),
      title: document.querySelector('header button[aria-expanded]')?.getAttribute('title'),
      scrollWidth: document.documentElement.scrollWidth,
      hasCloseButton: !!document.querySelector("dialog[open] button[aria-label='Đóng menu di động']"),
    })`);
    console.log(`${name} open state:`, openState);

    if (openState.expanded !== "true") {
      errors.push(
        `${name} open state must have aria-expanded='true', had: ${openState.expanded}`,
      );
    }
    if (openState.label !== "Đóng menu di động") {
      errors.push(
        `${name} open state must have aria-label='Đóng menu di động', had: ${openState.label}`,
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

  // Test suite 4: Login page fidelity, standardized form controls & contrast
  console.log(
    "\nTesting login page visual fidelity, form controls and contrast...",
  );
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

  const loginGeometry = await evaluate(`(() => {
    const card = document.querySelector("section[aria-labelledby='login-heading']");
    const usernameInput = document.querySelector("input[name='username']");
    const submitBtn = document.querySelector("button[type='submit']");
    const userStyle = window.getComputedStyle(usernameInput);
    const btnStyle = window.getComputedStyle(submitBtn);

    return {
      cardWidth: Math.round(card?.getBoundingClientRect().width || 0),
      cardRadius: window.getComputedStyle(card).borderRadius,
      monogramPresent: !!document.querySelector("[class*='logoMonogram']"),
      inputHeight: Math.round(usernameInput.getBoundingClientRect().height),
      inputRadius: userStyle.borderRadius,
      inputBg: userStyle.backgroundColor,
      inputBorder: userStyle.borderColor,
      buttonHeight: Math.round(submitBtn.getBoundingClientRect().height),
      buttonRadius: btnStyle.borderRadius,
      submitBg: btnStyle.backgroundColor,
      submitColor: btnStyle.color,
    };
  })()`);
  console.log("Login geometry:", loginGeometry);

  if (loginGeometry.cardWidth > 420) {
    errors.push(
      `Login card width should be <= 420px matching ZIP reference, but was ${loginGeometry.cardWidth}px`,
    );
  }
  if (loginGeometry.inputHeight !== 44) {
    errors.push(
      `Input height must be 44px (--control-height), but was ${loginGeometry.inputHeight}px`,
    );
  }
  if (loginGeometry.buttonHeight !== 44) {
    errors.push(
      `Button height must be 44px (--control-height), but was ${loginGeometry.buttonHeight}px`,
    );
  }
  if (loginGeometry.inputRadius !== "12px") {
    errors.push(
      `Input border-radius must be 12px (--control-radius), but was ${loginGeometry.inputRadius}`,
    );
  }
  if (loginGeometry.buttonRadius !== "12px") {
    errors.push(
      `Button border-radius must be 12px (--control-radius), but was ${loginGeometry.buttonRadius}`,
    );
  }

  // Parse colors to calculate WCAG AA contrast
  const parseRgb = (str) => {
    const m = str.match(/\d+/g);
    return m ? m.slice(0, 3).map(Number) : [0, 0, 0];
  };
  const submitTextRgb = parseRgb(loginGeometry.submitColor);
  const submitBgRgb = parseRgb(loginGeometry.submitBg);
  const contrastRatio = getContrast(submitTextRgb, submitBgRgb);
  console.log(
    `Button contrast ratio: ${contrastRatio.toFixed(2)}:1 (Text: ${loginGeometry.submitColor}, Bg: ${loginGeometry.submitBg})`,
  );

  if (contrastRatio < 4.5) {
    errors.push(
      `Button text contrast on accent background (${contrastRatio.toFixed(2)}:1) fails WCAG AA standard (requires >= 4.5:1)`,
    );
  }

  // Runtime Token Override Verification
  console.log("\nTesting Runtime Token Override on form controls...");
  const overrideTest = await evaluate(`(() => {
    const input = document.querySelector("input[name='username']");
    const button = document.querySelector("button[type='submit']");
    const initialInputHeight = window.getComputedStyle(input).height;
    const initialButtonHeight = window.getComputedStyle(button).height;
    const initialInputRadius = window.getComputedStyle(input).borderRadius;
    const initialButtonRadius = window.getComputedStyle(button).borderRadius;

    // Dynamically override root tokens
    document.documentElement.style.setProperty('--control-height', '52px');
    document.documentElement.style.setProperty('--control-radius', '6px');

    const updatedInputHeight = window.getComputedStyle(input).height;
    const updatedButtonHeight = window.getComputedStyle(button).height;
    const updatedInputRadius = window.getComputedStyle(input).borderRadius;
    const updatedButtonRadius = window.getComputedStyle(button).borderRadius;

    // Restore root tokens
    document.documentElement.style.removeProperty('--control-height');
    document.documentElement.style.removeProperty('--control-radius');

    const restoredInputHeight = window.getComputedStyle(input).height;
    const restoredButtonHeight = window.getComputedStyle(button).height;
    const restoredInputRadius = window.getComputedStyle(input).borderRadius;
    const restoredButtonRadius = window.getComputedStyle(button).borderRadius;

    return {
      initial: { inputHeight: initialInputHeight, buttonHeight: initialButtonHeight, inputRadius: initialInputRadius, buttonRadius: initialButtonRadius },
      updated: { inputHeight: updatedInputHeight, buttonHeight: updatedButtonHeight, inputRadius: updatedInputRadius, buttonRadius: updatedButtonRadius },
      restored: { inputHeight: restoredInputHeight, buttonHeight: restoredButtonHeight, inputRadius: restoredInputRadius, buttonRadius: restoredButtonRadius },
    };
  })()`);
  console.log("Runtime Token Override results:", overrideTest);

  if (
    overrideTest.updated.inputHeight !== "52px" ||
    overrideTest.updated.buttonHeight !== "52px"
  ) {
    errors.push(
      `Runtime token override --control-height: 52px failed: input was ${overrideTest.updated.inputHeight}, button was ${overrideTest.updated.buttonHeight}`,
    );
  }
  if (
    overrideTest.updated.inputRadius !== "6px" ||
    overrideTest.updated.buttonRadius !== "6px"
  ) {
    errors.push(
      `Runtime token override --control-radius: 6px failed: input was ${overrideTest.updated.inputRadius}, button was ${overrideTest.updated.buttonRadius}`,
    );
  }
  if (
    overrideTest.restored.inputHeight !== overrideTest.initial.inputHeight ||
    overrideTest.restored.buttonHeight !== overrideTest.initial.buttonHeight
  ) {
    errors.push(
      `Runtime token override restoration failed for height: restored input ${overrideTest.restored.inputHeight} vs initial ${overrideTest.initial.inputHeight}`,
    );
  }

  // Test input focus state styling with real user click via CDP
  const rect = await evaluate(`(() => {
    const el = document.querySelector("input[name='username']");
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  })()`);
  await send("Input.dispatchMouseEvent", {
    type: "mousePressed",
    x: rect.x,
    y: rect.y,
    button: "left",
    clickCount: 1,
  });
  await send("Input.dispatchMouseEvent", {
    type: "mouseReleased",
    x: rect.x,
    y: rect.y,
    button: "left",
    clickCount: 1,
  });
  await delay(200);

  const focusDebugAfter = await evaluate(`({
    activeTag: document.activeElement?.tagName,
    activeName: document.activeElement?.getAttribute('name'),
    hasFocus: document.hasFocus(),
    styleBorder: window.getComputedStyle(document.querySelector("input[name='username']")).borderColor,
    matchesFocus: document.querySelector("input[name='username']").matches(":focus"),
    matchesFocusVisible: document.querySelector("input[name='username']").matches(":focus-visible"),
  })`);
  console.log("After CDP click focus:", focusDebugAfter);

  const focusBorder = focusDebugAfter.styleBorder;
  if (focusBorder !== "rgb(245, 138, 36)") {
    errors.push(
      `Input focus border-color must be rgb(245, 138, 36), but was '${focusBorder}'`,
    );
  }

  // Test form validation error state styling
  await evaluate("document.querySelector(\"button[type='submit']\").click()");
  await delay(200);
  const invalidBorder = await evaluate(
    "window.getComputedStyle(document.querySelector(\"input[name='username'][aria-invalid='true']\")).borderColor",
  );
  if (invalidBorder !== "rgb(151, 61, 43)") {
    errors.push(
      `Invalid input border-color must be rgb(151, 61, 43), but was '${invalidBorder}'`,
    );
  }

  await capture("login_page_desktop");

  // Test suite 5: Setup page fidelity & shared control consumption
  console.log("\nTesting setup page visual fidelity and shared controls...");
  await send("Page.navigate", {
    url: `${baseUrl}/setup#token=fake_test_token_sample`,
  });
  await delay(500);

  const setupGeometry = await evaluate(`(() => {
    const passInput = document.querySelector("input[name='password']");
    const submitBtn = document.querySelector("button[type='submit']");
    if (!passInput || !submitBtn) return null;
    return {
      inputHeight: Math.round(passInput.getBoundingClientRect().height),
      inputRadius: window.getComputedStyle(passInput).borderRadius,
      buttonHeight: Math.round(submitBtn.getBoundingClientRect().height),
      buttonRadius: window.getComputedStyle(submitBtn).borderRadius,
      buttonBg: window.getComputedStyle(submitBtn).backgroundColor,
      buttonColor: window.getComputedStyle(submitBtn).color,
    };
  })()`);
  console.log("Setup geometry:", setupGeometry);

  if (setupGeometry) {
    if (setupGeometry.inputHeight !== 44) {
      errors.push(
        `Setup input height must be 44px, but was ${setupGeometry.inputHeight}px`,
      );
    }
    if (setupGeometry.buttonHeight !== 44) {
      errors.push(
        `Setup button height must be 44px, but was ${setupGeometry.buttonHeight}px`,
      );
    }
  }

  if (errors.length > 0) {
    console.error("\n--- REGRESSION FAILURES DETECTED (RED EVIDENCE) ---");
    errors.forEach((err, idx) => console.error(`${idx + 1}. ${err}`));
    throw new Error(`Regression checks failed with ${errors.length} error(s)`);
  }

  console.log("\nALL P2 & DESIGN TOKEN REGRESSION CHECKS PASSED!");
} finally {
  try {
    socket.close();
  } catch {
    // Ignore close errors
  }
  await terminateChildProcess(chrome).catch(() => {});
  await cleanupBrowserProfile(profile).catch(() => {});
}
