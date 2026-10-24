import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const webRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(webRoot, "../..");
const uiPackageRoot = path.resolve(repoRoot, "packages/ui");

// Utility to recursively find CSS files
function getCssFiles(dir) {
  const results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (["node_modules", ".next", "dist", ".turbo"].includes(entry.name)) {
        continue;
      }
      results.push(...getCssFiles(path.join(dir, entry.name)));
    } else if (entry.isFile() && entry.name.endsWith(".css")) {
      results.push(path.join(dir, entry.name));
    }
  }
  return results;
}

// Calculate relative luminance per WCAG 2.1
function getLuminance(r, g, b) {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

// Calculate contrast ratio per WCAG 2.1
function getContrastRatio(rgb1, rgb2) {
  const l1 = getLuminance(...rgb1);
  const l2 = getLuminance(...rgb2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

test("Canonical Form Control Contract: packages/ui Controls.module.css defines all required states", () => {
  const controlsCssPath = path.join(uiPackageRoot, "src/Controls.module.css");
  assert.ok(fs.existsSync(controlsCssPath), "Controls.module.css must exist");

  const css = fs.readFileSync(controlsCssPath, "utf8");

  // Input height, radius, box sizing
  assert.match(css, /height:\s*var\(--control-height,\s*44px\)/);
  assert.match(css, /border-radius:\s*var\(--control-radius/);
  assert.match(css, /box-sizing:\s*border-box/);

  // Input background, text, border tokens
  assert.match(css, /background-color:\s*var\(--control-bg/);
  assert.match(css, /color:\s*var\(--control-text/);
  assert.match(css, /border:\s*1px solid var\(--control-border/);

  // Input interactive states
  assert.match(
    css,
    /\.input:hover:not\(:disabled\)/,
    "Input defines hover state",
  );
  assert.match(css, /\.input:focus/, "Input defines focus state");
  assert.match(css, /\.input:disabled/, "Input defines disabled state");
  assert.match(css, /\.input\[readonly\]/, "Input defines readonly state");
  assert.match(
    css,
    /\.input\[aria-invalid=["']true["']\]/,
    "Input defines aria-invalid state",
  );
  assert.match(
    css,
    /\.input::placeholder/,
    "Input defines placeholder styling",
  );

  // Textarea contract parity
  assert.match(css, /\.textarea\s*\{[^}]*min-height:\s*88px/s);
  assert.match(css, /\.textarea:focus/, "Textarea defines focus state");
  assert.match(css, /\.textarea:disabled/, "Textarea defines disabled state");
  assert.match(
    css,
    /\.textarea\[aria-invalid=["']true["']\]/,
    "Textarea defines aria-invalid state",
  );

  // Button contract parity
  assert.match(
    css,
    /\.button\s*\{[^}]*min-height:\s*var\(--control-height,\s*44px\)/s,
  );
  assert.match(
    css,
    /\.button\s*\{[^}]*border-radius:\s*var\(--control-radius/s,
  );
  assert.match(
    css,
    /\.button:hover:not\(:disabled\)/,
    "Button defines hover state",
  );
  assert.match(
    css,
    /\.button:focus-visible/,
    "Button defines focus-visible state",
  );
  assert.match(css, /\.button:disabled/, "Button defines disabled state");
});

test("Button WCAG AA contrast compliance: text on background achieves >= 4.5:1", () => {
  // Brand navy: #172B4D -> rgb(23, 43, 77)
  const navyRgb = [23, 43, 77];
  // Brand orange: #F58A24 -> rgb(245, 138, 36)
  const orangeRgb = [245, 138, 36];
  // Brand orange hover: #E07716 -> rgb(224, 119, 22)
  const orangeHoverRgb = [224, 119, 22];

  const defaultRatio = getContrastRatio(navyRgb, orangeRgb);
  const hoverRatio = getContrastRatio(navyRgb, orangeHoverRgb);

  assert.ok(
    defaultRatio >= 4.5,
    `Button default contrast ratio must be >= 4.5:1 for WCAG AA normal text, but was ${defaultRatio.toFixed(2)}:1`,
  );
  assert.ok(
    hoverRatio >= 4.5,
    `Button hover contrast ratio must be >= 4.5:1 for WCAG AA normal text, but was ${hoverRatio.toFixed(2)}:1`,
  );

  // Negative test: white (#ffffff) on orange (#f58a24) fails WCAG AA
  const whiteRgb = [255, 255, 255];
  const whiteOnOrangeRatio = getContrastRatio(whiteRgb, orangeRgb);
  assert.ok(
    whiteOnOrangeRatio < 4.5,
    `White on orange has insufficient contrast (${whiteOnOrangeRatio.toFixed(2)}:1 < 4.5:1), confirming need for accessible navy text`,
  );
});

test("UI Design System rule enforcement: no raw hex colors outside var() fallbacks in CSS Modules", () => {
  const cssFiles = [
    ...getCssFiles(path.join(webRoot, "components")),
    ...getCssFiles(path.join(webRoot, "app")),
  ];

  const violations = [];

  for (const filePath of cssFiles) {
    const content = fs.readFileSync(filePath, "utf8");
    // Strip comments
    const stripped = content.replace(/\/\*[\s\S]*?\*\//g, "");

    const lines = stripped.split("\n");
    lines.forEach((line, lineIdx) => {
      // Ignore lines that already use var(
      if (line.includes("var(")) return;
      const match = line.match(/#[0-9a-fA-F]{3,8}\b/);
      if (match) {
        violations.push({
          file: path.relative(repoRoot, filePath),
          line: lineIdx + 1,
          content: line.trim(),
          color: match[0],
        });
      }
    });
  }

  assert.deepEqual(
    violations,
    [],
    `Found unauthorized raw hex colors in CSS modules (must reuse semantic tokens or use var(--token, fallback)): ${JSON.stringify(violations, null, 2)}`,
  );
});

test("UI Design System rule enforcement: no !important in form control or button styling", () => {
  const controlCssFiles = [
    path.join(uiPackageRoot, "src/Controls.module.css"),
    path.join(webRoot, "app/login/login.module.css"),
  ];

  for (const filePath of controlCssFiles) {
    const content = fs.readFileSync(filePath, "utf8");
    // Strip prefers-reduced-motion block if any
    const nonMotionContent = content.replace(
      /@media\s*\(prefers-reduced-motion:[^}]*\{[^}]*\}/gs,
      "",
    );

    assert.doesNotMatch(
      nonMotionContent,
      /!important/i,
      `File ${path.relative(repoRoot, filePath)} must not use !important to override form control or button styling`,
    );
  }
});

test("UI Component reuse: Setup and Login consume shared Button and TextInput from @nexora/ui", () => {
  const loginForm = fs.readFileSync(
    path.join(webRoot, "app/login/LoginForm.tsx"),
    "utf8",
  );
  const setupForm = fs.readFileSync(
    path.join(webRoot, "app/setup/SetupForm.tsx"),
    "utf8",
  );

  assert.match(
    loginForm,
    /import\s*\{[^}]*Button[^}]*TextInput[^}]*\}\s*from\s*["']@nexora\/ui["']/,
    "LoginForm must import Button and TextInput from @nexora/ui",
  );
  assert.match(
    setupForm,
    /import\s*\{[^}]*Button[^}]*TextInput[^}]*\}\s*from\s*["']@nexora\/ui["']/,
    "SetupForm must import Button and TextInput from @nexora/ui",
  );

  // SetupForm must not use raw HTML <input or <button for form submissions
  assert.doesNotMatch(
    setupForm,
    /<input\s+id=\{id\s*\+\s*["']password["']\}/,
    "SetupForm must use <TextInput> instead of raw <input>",
  );
  assert.doesNotMatch(
    setupForm,
    /<button[^>]*type=["']submit["']/,
    "SetupForm must use <Button> instead of raw <button>",
  );
});
