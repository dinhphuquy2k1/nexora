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

// Utility to recursively find all production CSS files in a directory,
// deliberately excluding generated/build/vendor artifacts.
function getCssFiles(dir) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (
        ["node_modules", ".next", "dist", ".turbo", "coverage"].includes(
          entry.name,
        )
      ) {
        continue;
      }
      results.push(...getCssFiles(path.join(dir, entry.name)));
    } else if (entry.isFile() && entry.name.endsWith(".css")) {
      results.push(path.join(dir, entry.name));
    }
  }
  return results;
}

// Strip CSS comments safely
function stripCssComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
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

// Helper to collect all declared tokens in tokens.css
function getDeclaredTokens(tokensPath) {
  const declared = new Set();
  if (!fs.existsSync(tokensPath)) return declared;
  const content = stripCssComments(fs.readFileSync(tokensPath, "utf8"));
  const matches = content.matchAll(/(--[a-zA-Z0-9_-]+)\s*:/g);
  for (const m of matches) {
    declared.add(m[1]);
  }
  return declared;
}

// Core CSS Policy Analyzer for production files and simulated future modules
function analyzeCssPolicy(fileList, declaredTokens, allowlist = new Set()) {
  const violations = {
    invalidTokens: [],
    unnecessaryFallbacks: [],
    nestedFallbackChains: [],
    semanticMisuse: [],
    importantOverrides: [],
  };

  for (const { filePath, content } of fileList) {
    const stripped = stripCssComments(content);
    const isAppWeb = filePath.includes("apps/web");
    const isTokensFile = filePath.endsWith("tokens.css");

    // 1. Check for !important in CSS modules
    if (filePath.endsWith(".module.css")) {
      // Strip prefers-reduced-motion blocks
      const nonMotion = stripped.replace(
        /@media\s*\(prefers-reduced-motion:[^}]*\{[^}]*\}/gs,
        "",
      );
      if (/!important/i.test(nonMotion)) {
        violations.importantOverrides.push({
          file: filePath,
          issue: "CSS Module contains forbidden !important override",
        });
      }
    }

    // 2. Check for invalid token references
    const varRefs = stripped.matchAll(/var\(\s*(--[a-zA-Z0-9_-]+)/g);
    for (const match of varRefs) {
      const token = match[1];
      if (!declaredTokens.has(token) && !allowlist.has(token)) {
        violations.invalidTokens.push({ file: filePath, token });
      }
    }

    // 3. Fallback policy enforcement
    // Split into CSS declarations (handles multiline declarations)
    const declMatches = stripped.matchAll(/([a-zA-Z0-9_-]+)\s*:\s*([^;]+);/gs);
    for (const declMatch of declMatches) {
      const prop = declMatch[1].trim().toLowerCase();
      const val = declMatch[2].trim();

      // Check unnecessary fallbacks in apps/web (excluding tokens.css)
      if (isAppWeb && !isTokensFile) {
        const fallbackMatch = val.match(
          /var\(\s*(--[a-zA-Z0-9_-]+)\s*,\s*[^)]+\)/,
        );
        if (fallbackMatch) {
          violations.unnecessaryFallbacks.push({
            file: filePath,
            property: prop,
            value: val,
            token: fallbackMatch[1],
          });
        }
      }

      // Check nested fallback chains in packages/ui: var(--a, var(--b...))
      if (!isAppWeb) {
        if (/var\([^,]+,\s*var\(/.test(val)) {
          violations.nestedFallbackChains.push({
            file: filePath,
            property: prop,
            value: val,
          });
        }
      }

      // 4. Semantic ownership checks
      if (prop === "color" && /var\(--[^)]*border[^)]*\)/.test(val)) {
        violations.semanticMisuse.push({
          file: filePath,
          issue: "Border token used as text color",
          property: prop,
          value: val,
        });
      }
      if (
        (prop === "border" || prop === "border-color") &&
        /var\(--[^)]*text[^)]*\)/.test(val)
      ) {
        violations.semanticMisuse.push({
          file: filePath,
          issue: "Text token used as border color",
          property: prop,
          value: val,
        });
      }
    }
  }

  return violations;
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

  // Semantic context tokens
  const requiredSemanticTokens = [
    "--color-text-on-dark",
    "--color-text-on-dark-muted",
    "--color-border-on-dark",
    "--color-border-on-dark-subtle",
    "--color-surface-on-dark",
    "--color-surface-on-dark-hover",
    "--color-text-on-accent",
  ];

  for (const token of requiredSemanticTokens) {
    const regex = new RegExp(`${token}\\s*:`);
    assert.match(
      tokensContent,
      regex,
      `Semantic context token '${token}' must be declared in tokens.css`,
    );
  }
});

test("Token Contract: token references graph is valid with no circular dependencies", () => {
  const tokensPath = path.join(webRoot, "styles/tokens.css");
  const content = fs.readFileSync(tokensPath, "utf8");
  const stripped = stripCssComments(content);

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

test("Token Contract: complete production frontend CSS policy compliance", () => {
  const tokensPath = path.join(webRoot, "styles/tokens.css");
  const declaredTokens = getDeclaredTokens(tokensPath);
  const allowlist = new Set(["--font-inter"]);

  // Discover all production CSS across apps/web and packages/ui
  const allWebCss = getCssFiles(webRoot);
  const allUiCss = getCssFiles(path.join(uiPackageRoot, "src"));

  const productionCssFiles = [...allWebCss, ...allUiCss].map((fp) => ({
    filePath: path.relative(repoRoot, fp).replace(/\\/g, "/"),
    content: fs.readFileSync(fp, "utf8"),
  }));

  assert.ok(
    productionCssFiles.length >= 8,
    `Production CSS discovery must discover all CSS files, found: ${productionCssFiles.length}`,
  );

  const violations = analyzeCssPolicy(
    productionCssFiles,
    declaredTokens,
    allowlist,
  );

  assert.deepEqual(
    violations.invalidTokens,
    [],
    `Found invalid CSS token references: ${JSON.stringify(violations.invalidTokens, null, 2)}`,
  );

  assert.deepEqual(
    violations.unnecessaryFallbacks,
    [],
    `Found unnecessary var() fallbacks in apps/web: ${JSON.stringify(violations.unnecessaryFallbacks, null, 2)}`,
  );

  assert.deepEqual(
    violations.nestedFallbackChains,
    [],
    `Found nested fallback chains in packages/ui: ${JSON.stringify(violations.nestedFallbackChains, null, 2)}`,
  );

  assert.deepEqual(
    violations.semanticMisuse,
    [],
    `Found semantic token misuse: ${JSON.stringify(violations.semanticMisuse, null, 2)}`,
  );

  assert.deepEqual(
    violations.importantOverrides,
    [],
    `Found forbidden !important in CSS modules: ${JSON.stringify(violations.importantOverrides, null, 2)}`,
  );
});

test("Token Contract: negative validation proves policy violations are detected in features/ modules", () => {
  const declaredTokens = new Set(["--space-4", "--color-primary"]);
  const allowlist = new Set();

  // Test 1: Invalid token reference in future features path
  const invalidFeatureCss = [
    {
      filePath: "apps/web/features/customers/CustomerTable.module.css",
      content: ".table { padding: var(--non-existent-token); }",
    },
  ];
  const r1 = analyzeCssPolicy(invalidFeatureCss, declaredTokens, allowlist);
  assert.equal(r1.invalidTokens.length, 1);
  assert.equal(r1.invalidTokens[0].token, "--non-existent-token");

  // Test 2: Unnecessary fallback in features path
  const fallbackFeatureCss = [
    {
      filePath: "apps/web/features/customers/AddressDrawer.module.css",
      content: ".drawer { margin: var(--space-4, 16px); }",
    },
  ];
  const r2 = analyzeCssPolicy(fallbackFeatureCss, declaredTokens, allowlist);
  assert.equal(r2.unnecessaryFallbacks.length, 1);
  assert.equal(r2.unnecessaryFallbacks[0].token, "--space-4");

  // Test 3: Nested fallback chain in packages/ui
  const nestedUiCss = [
    {
      filePath: "packages/ui/src/NewControl.module.css",
      content: ".box { border: 1px solid var(--a, var(--b, #000)); }",
    },
  ];
  const r3 = analyzeCssPolicy(nestedUiCss, declaredTokens, allowlist);
  assert.equal(r3.nestedFallbackChains.length, 1);

  // Test 4: Semantic misuse (border token used as color)
  const semanticCss = [
    {
      filePath: "apps/web/features/settings/SettingsPage.module.css",
      content: ".text { color: var(--color-border); }",
    },
  ];
  const r4 = analyzeCssPolicy(semanticCss, declaredTokens, allowlist);
  assert.equal(r4.semanticMisuse.length, 1);
  assert.equal(r4.semanticMisuse[0].issue, "Border token used as text color");

  // Test 5: Forbidden !important in features module
  const importantCss = [
    {
      filePath: "apps/web/features/shipments/Shipments.module.css",
      content: ".card { display: block !important; }",
    },
  ];
  const r5 = analyzeCssPolicy(importantCss, declaredTokens, allowlist);
  assert.equal(r5.importantOverrides.length, 1);
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

test("Component Consistency: Button WCAG AA contrast compliance (>= 4.5:1) from resolved theme tokens", () => {
  const tokensPath = path.join(webRoot, "styles/tokens.css");
  const tokensContent = fs.readFileSync(tokensPath, "utf8");

  // Dynamically resolve token references to their underlying hex color
  function resolveTokenHex(tokenName, visited = new Set()) {
    if (visited.has(tokenName)) throw new Error(`Cycle resolving ${tokenName}`);
    visited.add(tokenName);
    const regex = new RegExp(`${tokenName}\\s*:\\s*([^;]+);`);
    const match = tokensContent.match(regex);
    if (!match) throw new Error(`Token ${tokenName} not found in tokens.css`);
    const val = match[1].trim();
    if (val.startsWith("var(")) {
      const inner = val.match(/var\(\s*(--[a-zA-Z0-9_-]+)/)?.[1];
      return resolveTokenHex(inner, visited);
    }
    return val;
  }

  function hexToRgb(hex) {
    let clean = hex.replace("#", "").trim();
    if (clean.length === 3) {
      clean = clean
        .split("")
        .map((c) => c + c)
        .join("");
    }
    const num = parseInt(clean, 16);
    return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
  }

  // Resolve actual theme tokens
  const textColorHex = resolveTokenHex("--color-text-on-accent");
  const accentBgHex = resolveTokenHex("--color-accent");
  const accentHoverBgHex = resolveTokenHex("--color-accent-hover");

  const textRgb = hexToRgb(textColorHex);
  const bgRgb = hexToRgb(accentBgHex);
  const hoverBgRgb = hexToRgb(accentHoverBgHex);

  const defaultRatio = getContrastRatio(textRgb, bgRgb);
  const hoverRatio = getContrastRatio(textRgb, hoverBgRgb);

  assert.ok(
    defaultRatio >= 4.5,
    `Button default contrast ratio from resolved tokens (${textColorHex} on ${accentBgHex}) must be >= 4.5:1, but was ${defaultRatio.toFixed(2)}:1`,
  );
  assert.ok(
    hoverRatio >= 4.5,
    `Button hover contrast ratio from resolved tokens (${textColorHex} on ${accentHoverBgHex}) must be >= 4.5:1, but was ${hoverRatio.toFixed(2)}:1`,
  );

  // Negative test proof: An inaccessible combination (e.g. white text on brand orange) MUST fail WCAG AA
  const inaccessibleWhiteRgb = [255, 255, 255];
  const inaccessibleRatio = getContrastRatio(inaccessibleWhiteRgb, bgRgb);
  assert.ok(
    inaccessibleRatio < 4.5,
    `Inaccessible color combination (white on orange, ${inaccessibleRatio.toFixed(2)}:1) must fail WCAG AA threshold (< 4.5:1)`,
  );
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
    /height:\s*var\(--control-height\)/,
    "Button height must be dynamically bound to var(--control-height)",
  );
  assert.match(
    inputBlock,
    /height:\s*var\(--control-height\)/,
    "Input height must be dynamically bound to var(--control-height)",
  );

  // The border-radius property must consume var(--control-radius)
  assert.match(
    buttonBlock,
    /border-radius:\s*var\(--control-radius\)/,
    "Button border-radius must be dynamically bound to var(--control-radius)",
  );
  assert.match(
    inputBlock,
    /border-radius:\s*var\(--control-radius\)/,
    "Input border-radius must be dynamically bound to var(--control-radius)",
  );
});
