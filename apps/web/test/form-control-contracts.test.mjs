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

// ============================================================================
// GROUP 1: TOKEN CONTRACT TESTS
// ============================================================================

test("Token Contract: mandatory design tokens defined in tokens.css", () => {
  const tokensPath = path.join(webRoot, "styles/tokens.css");
  assert.ok(fs.existsSync(tokensPath), "tokens.css must exist");

  const tokensContent = fs.readFileSync(tokensPath, "utf8");

  // Mandatory Form Control Contract tokens
  const requiredControlTokens = [
    "--control-height",
    "--control-radius",
    "--control-padding-x",
    "--control-padding-y",
    "--control-font-size",
    "--control-bg",
    "--control-bg-focus",
    "--control-text",
    "--control-placeholder",
    "--control-border",
    "--control-border-hover",
    "--control-focus-border",
    "--control-focus-ring",
    "--control-disabled-bg",
    "--control-disabled-text",
    "--control-disabled-border",
    "--control-readonly-bg",
    "--control-invalid-border",
    "--control-invalid-focus-ring",
  ];

  for (const token of requiredControlTokens) {
    const regex = new RegExp(`${token}\\s*:`);
    assert.match(
      tokensContent,
      regex,
      `Mandatory control token '${token}' must be declared in tokens.css`,
    );
  }

  // Typography scale tokens
  const requiredTypographyTokens = [
    "--font-size-2xs",
    "--font-size-xs",
    "--font-size-sm",
    "--font-size-base",
    "--font-size-md",
    "--font-size-lg",
    "--font-size-xl",
    "--font-size-2xl",
    "--font-size-3xl",
  ];

  for (const token of requiredTypographyTokens) {
    const regex = new RegExp(`${token}\\s*:`);
    assert.match(
      tokensContent,
      regex,
      `Typography token '${token}' must be declared in tokens.css`,
    );
  }

  // Dark-surface context tokens
  const requiredDarkTokens = [
    "--color-text-on-dark",
    "--color-text-on-dark-muted",
    "--color-border-on-dark",
    "--color-border-on-dark-subtle",
    "--color-surface-on-dark",
    "--color-surface-on-dark-hover",
  ];

  for (const token of requiredDarkTokens) {
    const regex = new RegExp(`${token}\\s*:`);
    assert.match(
      tokensContent,
      regex,
      `Dark-surface token '${token}' must be declared in tokens.css`,
    );
  }
});

test("Token Contract: token references graph is valid with no circular dependencies", () => {
  const tokensPath = path.join(webRoot, "styles/tokens.css");
  const content = fs.readFileSync(tokensPath, "utf8");
  const stripped = content.replace(/\/\*[\s\S]*?\*\//g, "");

  const declarations = new Map();
  const lines = stripped.split("\n");

  for (const line of lines) {
    const match = line.match(/^\s*(--[a-zA-Z0-9_-]+)\s*:\s*([^;]+);/);
    if (match) {
      const token = match[1];
      const value = match[2];
      const refs = [...value.matchAll(/var\(\s*(--[a-zA-Z0-9_-]+)/g)].map(
        (m) => m[1],
      );
      declarations.set(token, refs);
    }
  }

  // Cycle detection via DFS
  const visited = new Set();
  const recursionStack = new Set();

  function detectCycle(token, pathTrail = []) {
    visited.add(token);
    recursionStack.add(token);
    pathTrail.push(token);

    const dependencies = declarations.get(token) || [];
    for (const dep of dependencies) {
      if (!visited.has(dep)) {
        detectCycle(dep, [...pathTrail]);
      } else if (recursionStack.has(dep)) {
        throw new Error(
          `Circular token reference detected: ${[...pathTrail, dep].join(" -> ")}`,
        );
      }
    }

    recursionStack.delete(token);
  }

  for (const token of declarations.keys()) {
    if (!visited.has(token)) {
      detectCycle(token);
    }
  }

  assert.ok(
    declarations.size > 20,
    "Token graph must contain all declared tokens without cycles",
  );
});

test("Token Contract: fallback policy enforcement across apps/web and packages/ui", () => {
  const webCssFiles = [
    ...getCssFiles(path.join(webRoot, "components")),
    ...getCssFiles(path.join(webRoot, "app")),
  ];

  const webViolations = [];

  for (const filePath of webCssFiles) {
    const content = fs.readFileSync(filePath, "utf8");
    const lines = content.split("\n");

    lines.forEach((line, idx) => {
      const trimmed = line.trim();
      if (trimmed.startsWith("/*") || trimmed.startsWith("*")) return;

      // In apps/web, tokens are mandatory and provided by root theme.
      // Unnecessary fallbacks like var(--space-4, 16px) or var(--color-surface, #fff) are forbidden.
      const match = trimmed.match(/var\((--[a-zA-Z0-9_-]+),\s*[^)]+\)/);
      if (match) {
        webViolations.push({
          file: path.relative(repoRoot, filePath),
          line: idx + 1,
          content: trimmed,
          token: match[1],
        });
      }
    });
  }

  assert.deepEqual(
    webViolations,
    [],
    `Found unnecessary var() fallbacks in apps/web (tokens are guaranteed by root tokens.css): ${JSON.stringify(webViolations, null, 2)}`,
  );
});

test("Token Contract: semantic ownership compliance", () => {
  const allCssFiles = [
    ...getCssFiles(path.join(webRoot, "components")),
    ...getCssFiles(path.join(webRoot, "app")),
    ...getCssFiles(path.join(uiPackageRoot, "src")),
  ];

  const semanticViolations = [];

  for (const filePath of allCssFiles) {
    const content = fs.readFileSync(filePath, "utf8");
    const lines = content.split("\n");

    lines.forEach((line, idx) => {
      const trimmed = line.trim();
      if (trimmed.startsWith("/*") || trimmed.startsWith("*")) return;

      // 1. Text color using border token
      if (/^\s*color\s*:\s*var\(--[^)]*border[^)]*\)/.test(line)) {
        semanticViolations.push({
          file: path.relative(repoRoot, filePath),
          line: idx + 1,
          issue: "Border token used as text color",
          content: trimmed,
        });
      }
    });
  }

  assert.deepEqual(
    semanticViolations,
    [],
    `Found semantic token misuse: ${JSON.stringify(semanticViolations, null, 2)}`,
  );
});

// ============================================================================
// GROUP 2: COMPONENT CONSISTENCY TESTS
// ============================================================================

test("Component Consistency: Form controls share canonical contract tokens for sizing and states", () => {
  const controlsCssPath = path.join(uiPackageRoot, "src/Controls.module.css");
  assert.ok(fs.existsSync(controlsCssPath), "Controls.module.css must exist");

  const css = fs.readFileSync(controlsCssPath, "utf8");

  // Input & Button bind sizing to --control-height and --control-radius
  assert.match(
    css,
    /\.input\s*\{[^}]*height:\s*var\(--control-height/s,
    "Input binds height to --control-height",
  );
  assert.match(
    css,
    /\.button\s*\{[^}]*height:\s*var\(--control-height/s,
    "Button binds height to --control-height",
  );
  assert.match(
    css,
    /\.input\s*\{[^}]*border-radius:\s*var\(--control-radius/s,
    "Input binds radius to --control-radius",
  );
  assert.match(
    css,
    /\.button\s*\{[^}]*border-radius:\s*var\(--control-radius/s,
    "Button binds radius to --control-radius",
  );
  assert.match(
    css,
    /\.textarea\s*\{[^}]*border-radius:\s*var\(--control-radius/s,
    "Textarea binds radius to --control-radius",
  );

  // Input and Textarea contract parity
  assert.match(
    css,
    /\.input\s*\{[^}]*border:\s*1px solid var\(--control-border/s,
  );
  assert.match(
    css,
    /\.textarea\s*\{[^}]*border:\s*1px solid var\(--control-border/s,
  );
  assert.match(css, /\.input\s*\{[^}]*background-color:\s*var\(--control-bg/s);
  assert.match(
    css,
    /\.textarea\s*\{[^}]*background-color:\s*var\(--control-bg/s,
  );

  // Interactive states parity
  assert.match(css, /\.input:focus/, "Input defines focus state");
  assert.match(css, /\.textarea:focus/, "Textarea defines focus state");
  assert.match(css, /\.button:focus-visible/, "Button defines focus state");

  assert.match(css, /\.input:disabled/, "Input defines disabled state");
  assert.match(css, /\.textarea:disabled/, "Textarea defines disabled state");
  assert.match(css, /\.button:disabled/, "Button defines disabled state");

  assert.match(
    css,
    /\.input\[aria-invalid=["']true["']\]/,
    "Input defines invalid state",
  );
  assert.match(
    css,
    /\.textarea\[aria-invalid=["']true["']\]/,
    "Textarea defines invalid state",
  );

  // Specificity protection: hover must not override active focus state
  assert.match(
    css,
    /\.input:hover[^{]*:not\(:focus\)/,
    "Input hover state excludes active focus to prevent overriding focus border",
  );
  assert.match(
    css,
    /\.textarea:hover[^{]*:not\(:focus\)/,
    "Textarea hover state excludes active focus to prevent overriding focus border",
  );
});

test("Component Consistency: Button WCAG AA contrast compliance (>= 4.5:1)", () => {
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
});

test("Component Consistency: no !important in form control or button styling", () => {
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

test("Component Consistency: UI Component reuse in LoginForm and SetupForm", () => {
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

// ============================================================================
// GROUP 3: RUNTIME TOKEN OVERRIDE CONTRACT
// ============================================================================

test("Runtime Token Override: Controls cascade directly from root CSS custom properties", () => {
  const controlsCss = fs.readFileSync(
    path.join(uiPackageRoot, "src/Controls.module.css"),
    "utf8",
  );

  // Ensure controls do NOT hardcode literal pixel heights or radii in class selectors
  const buttonBlock = controlsCss.match(/\.button\s*\{([^}]+)\}/)?.[1] || "";
  const inputBlock = controlsCss.match(/\.input\s*\{([^}]+)\}/)?.[1] || "";

  // The height property must consume var(--control-height)
  assert.match(
    buttonBlock,
    /height:\s*var\(--control-height/,
    "Button height must be dynamically bound to var(--control-height)",
  );
  assert.match(
    inputBlock,
    /height:\s*var\(--control-height/,
    "Input height must be dynamically bound to var(--control-height)",
  );

  // The border-radius property must consume var(--control-radius)
  assert.match(
    buttonBlock,
    /border-radius:\s*var\(--control-radius/,
    "Button border-radius must be dynamically bound to var(--control-radius)",
  );
  assert.match(
    inputBlock,
    /border-radius:\s*var\(--control-radius/,
    "Input border-radius must be dynamically bound to var(--control-radius)",
  );
});
