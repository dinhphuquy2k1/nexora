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

// Helper to strip balanced var(...) expressions to isolate standalone fallbacks in packages/ui
function stripBalancedVars(str) {
  let result = "";
  let i = 0;
  while (i < str.length) {
    if (str.startsWith("var(", i)) {
      let depth = 1;
      let j = i + 4;
      while (j < str.length && depth > 0) {
        if (str[j] === "(") depth++;
        else if (str[j] === ")") depth--;
        j++;
      }
      result += "var(--stripped)";
      i = j;
    } else {
      result += str[i];
      i++;
    }
  }
  return result;
}

const COLOR_PROPERTIES = new Set([
  "color",
  "-webkit-text-fill-color",
  "caret-color",
  "accent-color",
  "fill",
  "stroke",
  "background",
  "background-color",
  "background-image",
  "border",
  "border-color",
  "border-top",
  "border-top-color",
  "border-bottom",
  "border-bottom-color",
  "border-left",
  "border-left-color",
  "border-right",
  "border-right-color",
  "outline",
  "outline-color",
  "box-shadow",
  "text-shadow",
]);

const RAW_COLOR_REGEX =
  /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})\b|\b(?:rgb|rgba|hsl|hsla|hwb|lab|lch|color)\s*\(|(?<![a-zA-Z0-9_-])(?:red|blue|green|black|white|gray|grey|orange|yellow|purple|pink|cyan|magenta|brown|navy|teal|olive|maroon|silver|gold|lime|aqua|fuchsia)(?![a-zA-Z0-9_-])/i;

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
    rawColors: [],
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

      // 4. Semantic ownership checks (skip tokens.css where token definitions reference tokens)
      if (!isTokensFile) {
        const varTokens = [...val.matchAll(/var\(\s*(--[a-zA-Z0-9_-]+)/g)].map(
          (m) => m[1],
        );

        for (const token of varTokens) {
          // Rule A: Text color properties (color, -webkit-text-fill-color)
          if (prop === "color" || prop === "-webkit-text-fill-color") {
            if (
              /--color-surface|--color-background|--control-bg|--color-status-(?:success|error|pending)-bg/.test(
                token,
              )
            ) {
              violations.semanticMisuse.push({
                file: filePath,
                issue: `Surface/background token '${token}' used as text color`,
                property: prop,
                value: val,
                token,
              });
            }
            if (/--color-border|--control-border/.test(token)) {
              violations.semanticMisuse.push({
                file: filePath,
                issue: `Border token '${token}' used as text color`,
                property: prop,
                value: val,
                token,
              });
            }
            if (/--shadow-/.test(token)) {
              violations.semanticMisuse.push({
                file: filePath,
                issue: `Elevation/shadow token '${token}' used as text color`,
                property: prop,
                value: val,
                token,
              });
            }
            if (/--focus-ring/.test(token)) {
              violations.semanticMisuse.push({
                file: filePath,
                issue: `Focus ring token '${token}' used as text color`,
                property: prop,
                value: val,
                token,
              });
            }
          }

          // Rule B: Surface / Background properties (background, background-color)
          if (prop === "background" || prop === "background-color") {
            if (
              /--color-text|--control-text|--color-status-(?:success|error|pending)-text|--color-accent-text/.test(
                token,
              )
            ) {
              violations.semanticMisuse.push({
                file: filePath,
                issue: `Text token '${token}' used as background`,
                property: prop,
                value: val,
                token,
              });
            }
            if (/--color-border|--control-border/.test(token)) {
              violations.semanticMisuse.push({
                file: filePath,
                issue: `Border token '${token}' used as background`,
                property: prop,
                value: val,
                token,
              });
            }
            if (/--shadow-/.test(token)) {
              violations.semanticMisuse.push({
                file: filePath,
                issue: `Elevation/shadow token '${token}' used as background`,
                property: prop,
                value: val,
                token,
              });
            }
            if (/--focus-ring/.test(token)) {
              violations.semanticMisuse.push({
                file: filePath,
                issue: `Focus ring token '${token}' used as background`,
                property: prop,
                value: val,
                token,
              });
            }
          }

          // Rule C: Border properties
          if (
            prop === "border" ||
            (prop.startsWith("border-") &&
              (prop.endsWith("color") ||
                prop === "border-top" ||
                prop === "border-bottom" ||
                prop === "border-left" ||
                prop === "border-right"))
          ) {
            if (
              /--color-text|--control-text|--color-status-(?:success|error|pending)-text|--color-accent-text/.test(
                token,
              )
            ) {
              violations.semanticMisuse.push({
                file: filePath,
                issue: `Text token '${token}' used as border`,
                property: prop,
                value: val,
                token,
              });
            }
            if (
              /--color-surface|--color-background|--control-bg|--color-status-(?:success|error|pending)-bg/.test(
                token,
              )
            ) {
              violations.semanticMisuse.push({
                file: filePath,
                issue: `Surface/background token '${token}' used as border`,
                property: prop,
                value: val,
                token,
              });
            }
            if (/--shadow-/.test(token)) {
              violations.semanticMisuse.push({
                file: filePath,
                issue: `Elevation/shadow token '${token}' used as border`,
                property: prop,
                value: val,
                token,
              });
            }
            if (/--focus-ring/.test(token)) {
              violations.semanticMisuse.push({
                file: filePath,
                issue: `Focus ring token '${token}' used as border`,
                property: prop,
                value: val,
                token,
              });
            }
          }

          // Rule D: Focus / Outline properties
          if (prop === "outline" || prop === "outline-color") {
            if (
              /--color-text|--control-text|--color-status-(?:success|error|pending)-text/.test(
                token,
              )
            ) {
              violations.semanticMisuse.push({
                file: filePath,
                issue: `Text token '${token}' used as outline/focus ring`,
                property: prop,
                value: val,
                token,
              });
            }
            if (/--color-surface|--color-background|--control-bg/.test(token)) {
              violations.semanticMisuse.push({
                file: filePath,
                issue: `Surface/background token '${token}' used as outline/focus ring`,
                property: prop,
                value: val,
                token,
              });
            }
            if (/--shadow-/.test(token)) {
              violations.semanticMisuse.push({
                file: filePath,
                issue: `Elevation/shadow token '${token}' used as outline/focus ring`,
                property: prop,
                value: val,
                token,
              });
            }
          }

          // Rule E: Elevation / Box-Shadow properties
          if (prop === "box-shadow") {
            if (
              /--color-text|--control-text|--color-status-(?:success|error|pending)-text/.test(
                token,
              )
            ) {
              violations.semanticMisuse.push({
                file: filePath,
                issue: `Text token '${token}' used as box-shadow`,
                property: prop,
                value: val,
                token,
              });
            }
            if (/--color-surface|--color-background|--control-bg/.test(token)) {
              violations.semanticMisuse.push({
                file: filePath,
                issue: `Surface/background token '${token}' used as box-shadow`,
                property: prop,
                value: val,
                token,
              });
            }
            if (/--color-border|--control-border\b/.test(token)) {
              violations.semanticMisuse.push({
                file: filePath,
                issue: `Border token '${token}' used as box-shadow`,
                property: prop,
                value: val,
                token,
              });
            }
          }
        }
      }

      // 5. Raw color enforcement per styling policy
      if (!isTokensFile && COLOR_PROPERTIES.has(prop)) {
        // Strip string literals and url(...) contents to avoid false positives
        let testVal = val
          .replace(/url\([^)]*\)/gi, "")
          .replace(/"[^"]*"/g, '""')
          .replace(/'[^']*'/g, "''");

        // In packages/ui, permitted standalone fallback values inside var(--token, fallback) are allowed
        if (!isAppWeb) {
          testVal = stripBalancedVars(testVal);
        }

        // Legitimate documented micro-shadow exceptions on complex backgrounds:
        // monogram subtle box-shadow (0 1px 2px rgba(0, 0, 0, 0.x)) per frontend.md Section E.3
        const isDocumentedMicroShadow =
          prop === "box-shadow" &&
          /^0\s+1px\s+2px\s+rgba\(0,\s*0,\s*0,\s*0\.\d+\)$/.test(testVal);

        // Legitimate documented native overlay backdrop exception per reusable-components.md Section 8
        const isDocumentedBackdrop =
          filePath.replace(/\\/g, "/").endsWith("Overlay.module.css") &&
          prop === "background" &&
          /rgb\(15\s+23\s+42\s*\/\s*55%\)/.test(testVal);

        if (!isDocumentedMicroShadow && !isDocumentedBackdrop) {
          if (RAW_COLOR_REGEX.test(testVal)) {
            violations.rawColors.push({
              file: filePath,
              property: prop,
              value: val,
              issue: `Disallowed raw color in property '${prop}': ${val}`,
            });
          }
        }
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

  assert.deepEqual(
    violations.rawColors,
    [],
    `Found unauthorized raw colors: ${JSON.stringify(violations.rawColors, null, 2)}`,
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

  // Test 4: Semantic misuse detection across all supported roles
  // 4a. Surface token used as text color
  const surfaceInTextCss = [
    {
      filePath: "apps/web/features/settings/SettingsPage.module.css",
      content: ".text { color: var(--color-surface); }",
    },
  ];
  const r4a = analyzeCssPolicy(surfaceInTextCss, declaredTokens, allowlist);
  assert.equal(r4a.semanticMisuse.length, 1);
  assert.match(r4a.semanticMisuse[0].issue, /Surface\/background token/);

  // 4b. Border token used as text color
  const borderInTextCss = [
    {
      filePath: "apps/web/features/settings/SettingsPage.module.css",
      content: ".text { color: var(--color-border); }",
    },
  ];
  const r4b = analyzeCssPolicy(borderInTextCss, declaredTokens, allowlist);
  assert.equal(r4b.semanticMisuse.length, 1);
  assert.match(r4b.semanticMisuse[0].issue, /Border token/);

  // 4c. Shadow token used as text color
  const shadowInTextCss = [
    {
      filePath: "apps/web/features/settings/SettingsPage.module.css",
      content: ".text { color: var(--shadow-sm); }",
    },
  ];
  const r4c = analyzeCssPolicy(shadowInTextCss, declaredTokens, allowlist);
  assert.equal(r4c.semanticMisuse.length, 1);
  assert.match(r4c.semanticMisuse[0].issue, /Elevation\/shadow token/);

  // 4d. Focus ring token used as text color
  const focusInTextCss = [
    {
      filePath: "apps/web/features/settings/SettingsPage.module.css",
      content: ".text { color: var(--focus-ring-on-light); }",
    },
  ];
  const r4d = analyzeCssPolicy(focusInTextCss, declaredTokens, allowlist);
  assert.equal(r4d.semanticMisuse.length, 1);
  assert.match(r4d.semanticMisuse[0].issue, /Focus ring token/);

  // 4e. Text token used as background
  const textInBgCss = [
    {
      filePath: "apps/web/features/settings/SettingsPage.module.css",
      content: ".card { background-color: var(--color-text); }",
    },
  ];
  const r4e = analyzeCssPolicy(textInBgCss, declaredTokens, allowlist);
  assert.equal(r4e.semanticMisuse.length, 1);
  assert.match(r4e.semanticMisuse[0].issue, /Text token.*used as background/);

  // 4f. Border token used as background
  const borderInBgCss = [
    {
      filePath: "apps/web/features/settings/SettingsPage.module.css",
      content: ".card { background-color: var(--color-border); }",
    },
  ];
  const r4f = analyzeCssPolicy(borderInBgCss, declaredTokens, allowlist);
  assert.equal(r4f.semanticMisuse.length, 1);
  assert.match(r4f.semanticMisuse[0].issue, /Border token.*used as background/);

  // 4g. Text token used as border
  const textInBorderCss = [
    {
      filePath: "apps/web/features/settings/SettingsPage.module.css",
      content: ".card { border-color: var(--color-text); }",
    },
  ];
  const r4g = analyzeCssPolicy(textInBorderCss, declaredTokens, allowlist);
  assert.equal(r4g.semanticMisuse.length, 1);
  assert.match(r4g.semanticMisuse[0].issue, /Text token.*used as border/);

  // 4h. Surface token used as border
  const surfaceInBorderCss = [
    {
      filePath: "apps/web/features/settings/SettingsPage.module.css",
      content: ".card { border-color: var(--color-surface); }",
    },
  ];
  const r4h = analyzeCssPolicy(surfaceInBorderCss, declaredTokens, allowlist);
  assert.equal(r4h.semanticMisuse.length, 1);
  assert.match(
    r4h.semanticMisuse[0].issue,
    /Surface\/background token.*used as border/,
  );

  // 4i. Text token used as outline
  const textInOutlineCss = [
    {
      filePath: "apps/web/features/settings/SettingsPage.module.css",
      content: ".btn { outline: 2px solid var(--color-text); }",
    },
  ];
  const r4i = analyzeCssPolicy(textInOutlineCss, declaredTokens, allowlist);
  assert.equal(r4i.semanticMisuse.length, 1);
  assert.match(r4i.semanticMisuse[0].issue, /Text token.*used as outline/);

  // 4j. Surface token used as box-shadow
  const surfaceInShadowCss = [
    {
      filePath: "apps/web/features/settings/SettingsPage.module.css",
      content: ".card { box-shadow: var(--color-surface); }",
    },
  ];
  const r4j = analyzeCssPolicy(surfaceInShadowCss, declaredTokens, allowlist);
  assert.equal(r4j.semanticMisuse.length, 1);
  assert.match(
    r4j.semanticMisuse[0].issue,
    /Surface\/background token.*used as box-shadow/,
  );

  // Test 5: Forbidden !important in features module
  const importantCss = [
    {
      filePath: "apps/web/features/shipments/Shipments.module.css",
      content: ".card { display: block !important; }",
    },
  ];
  const r5 = analyzeCssPolicy(importantCss, declaredTokens, allowlist);
  assert.equal(r5.importantOverrides.length, 1);

  // Test 6: Raw color in features module (hex colors across color, background, border)
  const rawColorHexFeatureCss = [
    {
      filePath: "apps/web/features/shipments/Shipments.module.css",
      content:
        ".x { color: #ff00ff; background: #123456; border: 1px solid #abcdef; }",
    },
  ];
  const r6 = analyzeCssPolicy(rawColorHexFeatureCss, declaredTokens, allowlist);
  assert.equal(
    r6.rawColors.length,
    3,
    "Must detect 3 raw color violations in features module",
  );

  // Test 7: Raw rgb/rgba color in apps/web component
  const rawRgbWebCss = [
    {
      filePath: "apps/web/components/Badge.module.css",
      content: ".badge { background-color: rgba(255, 0, 0, 0.5); }",
    },
  ];
  const r7 = analyzeCssPolicy(rawRgbWebCss, declaredTokens, allowlist);
  assert.equal(r7.rawColors.length, 1);
  assert.equal(r7.rawColors[0].property, "background-color");

  // Test 8: Raw named color in packages/ui outside var()
  const rawNamedUiCss = [
    {
      filePath: "packages/ui/src/CustomButton.module.css",
      content: ".btn { border: 1px solid red; color: white; }",
    },
  ];
  const r8 = analyzeCssPolicy(rawNamedUiCss, declaredTokens, allowlist);
  assert.equal(r8.rawColors.length, 2);

  // Test 9: Multiline raw color declaration
  const multilineRawCss = [
    {
      filePath: "apps/web/features/customers/CustomerList.module.css",
      content: `.box {
        border:
          1px solid
          #ff5500;
      }`,
    },
  ];
  const r9 = analyzeCssPolicy(multilineRawCss, declaredTokens, allowlist);
  assert.equal(r9.rawColors.length, 1);
  assert.equal(r9.rawColors[0].property, "border");
});

test("Token Contract: positive validation proves canonical palette and documented exceptions pass", () => {
  const declaredTokens = new Set(["--color-border", "--color-primary"]);
  const allowlist = new Set();

  // 1. Raw palette at canonical tokens.css is permitted
  const tokensCss = [
    {
      filePath: "apps/web/styles/tokens.css",
      content: ":root { --brand-navy: #172b4d; --gray-100: #f1f5f9; }",
    },
  ];
  const rTokens = analyzeCssPolicy(tokensCss, declaredTokens, allowlist);
  assert.deepEqual(rTokens.rawColors, []);

  // 2. Documented monogram micro-shadow exception passes
  const microShadowCss = [
    {
      filePath: "apps/web/components/app-shell/Header.module.css",
      content: ".brandMonogram { box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1); }",
    },
  ];
  const rShadow = analyzeCssPolicy(microShadowCss, declaredTokens, allowlist);
  assert.deepEqual(rShadow.rawColors, []);

  // 3. Documented contextual constants pass (transparent, currentColor, inherit)
  const contextualConstantsCss = [
    {
      filePath: "apps/web/app/login/login.module.css",
      content:
        ".field { color: inherit; background-color: transparent; border: 1px solid currentColor; }",
    },
  ];
  const rContext = analyzeCssPolicy(
    contextualConstantsCss,
    declaredTokens,
    allowlist,
  );
  assert.deepEqual(rContext.rawColors, []);

  // 4. Documented standalone fallbacks inside var() in packages/ui pass
  const uiStandaloneCss = [
    {
      filePath: "packages/ui/src/Panel.module.css",
      content:
        ".panel { color: var(--color-primary, #172b4d); border: 1px solid var(--color-border, #e2e8f0); }",
    },
  ];
  const rUi = analyzeCssPolicy(uiStandaloneCss, declaredTokens, allowlist);
  assert.deepEqual(rUi.rawColors, []);
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
    /\.button:hover:not\(:disabled\)\s*\{[^}]*color:\s*var\(--color-text-on-accent-hover\)/s,
    "Button:hover:not(:disabled) must consume --color-text-on-accent-hover",
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

  // Input, Button & Textarea bind font-size to --control-font-size
  assert.match(
    css,
    /\.input\s*\{[^}]*font-size:\s*var\(--control-font-size/s,
    "Input binds font-size to --control-font-size",
  );
  assert.match(
    css,
    /\.button\s*\{[^}]*font-size:\s*var\(--control-font-size/s,
    "Button binds font-size to --control-font-size",
  );
  assert.match(
    css,
    /\.textarea\s*\{[^}]*font-size:\s*var\(--control-font-size/s,
    "Textarea binds font-size to --control-font-size",
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
  const textHoverColorHex = resolveTokenHex("--color-text-on-accent-hover");
  const accentBgHex = resolveTokenHex("--color-accent");
  const accentHoverBgHex = resolveTokenHex("--color-accent-hover");

  const textRgb = hexToRgb(textColorHex);
  const textHoverRgb = hexToRgb(textHoverColorHex);
  const bgRgb = hexToRgb(accentBgHex);
  const hoverBgRgb = hexToRgb(accentHoverBgHex);

  const defaultRatio = getContrastRatio(textRgb, bgRgb);
  const hoverRatio = getContrastRatio(textHoverRgb, hoverBgRgb);

  assert.ok(
    defaultRatio >= 4.5,
    `Button default contrast ratio from resolved tokens (${textColorHex} on ${accentBgHex}) must be >= 4.5:1, but was ${defaultRatio.toFixed(2)}:1`,
  );
  assert.ok(
    hoverRatio >= 4.5,
    `Button hover contrast ratio from resolved tokens (${textHoverColorHex} on ${accentHoverBgHex}) must be >= 4.5:1, but was ${hoverRatio.toFixed(2)}:1`,
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

  // The font-size property must consume var(--control-font-size)
  assert.match(
    buttonBlock,
    /font-size:\s*var\(--control-font-size\)/,
    "Button font-size must be dynamically bound to var(--control-font-size)",
  );
  assert.match(
    inputBlock,
    /font-size:\s*var\(--control-font-size\)/,
    "Input font-size must be dynamically bound to var(--control-font-size)",
  );
});
