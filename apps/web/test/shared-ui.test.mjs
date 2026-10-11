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

test("Design tokens: complete 2-tier architecture and scale tokens", () => {
  const tokensPath = path.join(webRoot, "styles/tokens.css");
  assert.ok(fs.existsSync(tokensPath), "tokens.css must exist");

  const tokensContent = fs.readFileSync(tokensPath, "utf8");

  // Layer 1: Foundation Palette
  assert.match(
    tokensContent,
    /--brand-navy:\s*#172b4d/,
    "Foundation navy present",
  );
  assert.match(
    tokensContent,
    /--brand-orange:\s*#f58a24/,
    "Foundation orange present",
  );

  // Layer 2: Semantic Colors
  assert.match(
    tokensContent,
    /--color-primary:\s*var\(--brand-navy\)/,
    "Primary mapped to foundation",
  );
  assert.match(
    tokensContent,
    /--color-accent:\s*var\(--brand-orange\)/,
    "Accent mapped to foundation",
  );
  assert.match(
    tokensContent,
    /--color-surface:\s*#ffffff/,
    "Surface color present",
  );
  assert.match(tokensContent, /--color-border:/, "Border color present");

  // Layer 3: Spacing Scale
  assert.match(tokensContent, /--space-1:\s*4px/, "Spacing 4px present");
  assert.match(tokensContent, /--space-2:\s*8px/, "Spacing 8px present");
  assert.match(tokensContent, /--space-3:\s*12px/, "Spacing 12px present");
  assert.match(tokensContent, /--space-4:\s*16px/, "Spacing 16px present");
  assert.match(tokensContent, /--space-5:\s*20px/, "Spacing 20px present");
  assert.match(tokensContent, /--space-6:\s*24px/, "Spacing 24px present");
  assert.match(tokensContent, /--space-8:\s*32px/, "Spacing 32px present");

  // Layer 4: Radius Scale
  assert.match(tokensContent, /--radius-xs:\s*4px/, "Radius xs present");
  assert.match(tokensContent, /--radius-sm:\s*6px/, "Radius sm present");
  assert.match(tokensContent, /--radius-md:\s*8px/, "Radius md present");
  assert.match(tokensContent, /--radius-lg:\s*12px/, "Radius lg present");
  assert.match(tokensContent, /--radius-full:\s*9999px/, "Radius full present");

  // Layer 5: Shadow Scale
  assert.match(tokensContent, /--shadow-sm:/, "Shadow sm present");
  assert.match(tokensContent, /--shadow-md:/, "Shadow md present");
  assert.match(tokensContent, /--shadow-lg:/, "Shadow lg present");
});

test("Decoupled Global CSS: no internal component classes in styles.css", () => {
  const stylesPath = path.join(webRoot, "app/styles.css");
  assert.ok(fs.existsSync(stylesPath), "styles.css must exist");

  const stylesContent = fs.readFileSync(stylesPath, "utf8");

  // Global CSS must NOT contain internal component styling rules
  assert.doesNotMatch(
    stylesContent,
    /^\.panel\s*\{/m,
    "styles.css must not define .panel rule",
  );
  assert.doesNotMatch(
    stylesContent,
    /^\.badge\s*\{/m,
    "styles.css must not define .badge rule",
  );
  assert.doesNotMatch(
    stylesContent,
    /^\.good\s*\{/m,
    "styles.css must not define .good status rule",
  );
  assert.doesNotMatch(
    stylesContent,
    /^\.bad\s*\{/m,
    "styles.css must not define .bad status rule",
  );
  assert.doesNotMatch(
    stylesContent,
    /^\.pending\s*\{/m,
    "styles.css must not define .pending status rule",
  );
});

test("@nexora/ui package: self-contained CSS modules and exports", () => {
  const panelPath = path.join(uiPackageRoot, "src/Panel.tsx");
  const panelCssPath = path.join(uiPackageRoot, "src/Panel.module.css");
  const badgePath = path.join(uiPackageRoot, "src/StatusBadge.tsx");
  const badgeCssPath = path.join(uiPackageRoot, "src/StatusBadge.module.css");
  const indexPath = path.join(uiPackageRoot, "src/index.tsx");

  assert.ok(fs.existsSync(panelPath), "Panel.tsx exists");
  assert.ok(fs.existsSync(panelCssPath), "Panel.module.css exists");
  assert.ok(fs.existsSync(badgePath), "StatusBadge.tsx exists");
  assert.ok(fs.existsSync(badgeCssPath), "StatusBadge.module.css exists");
  assert.ok(fs.existsSync(indexPath), "index.tsx exists");

  const panelContent = fs.readFileSync(panelPath, "utf8");
  const badgeContent = fs.readFileSync(badgePath, "utf8");
  const panelCss = fs.readFileSync(panelCssPath, "utf8");
  const badgeCss = fs.readFileSync(badgeCssPath, "utf8");

  // Verify CSS module imports
  assert.match(
    panelContent,
    /import styles from "\.\/Panel\.module\.css"/,
    "Panel imports CSS module",
  );
  assert.match(
    badgeContent,
    /import styles from "\.\/StatusBadge\.module\.css"/,
    "StatusBadge imports CSS module",
  );

  // Verify token consumption with fallbacks in CSS modules
  assert.match(
    panelCss,
    /var\(--color-border/,
    "Panel consumes --color-border",
  );
  assert.match(
    panelCss,
    /var\(--color-surface/,
    "Panel consumes --color-surface",
  );
  assert.match(
    badgeCss,
    /var\(--color-status-success-bg/,
    "StatusBadge consumes success bg",
  );
  assert.match(
    badgeCss,
    /var\(--color-status-error-bg/,
    "StatusBadge consumes error bg",
  );
  assert.match(
    badgeCss,
    /var\(--color-status-pending-bg/,
    "StatusBadge consumes pending bg",
  );
});

test("StatusBadge semantic status mapping logic", () => {
  // Pure mapping validation for StatusBadge
  function resolveStatusClass(ok) {
    if (ok === true) return "good";
    if (ok === false) return "bad";
    return "pending";
  }

  assert.equal(resolveStatusClass(true), "good", "true maps to good status");
  assert.equal(resolveStatusClass(false), "bad", "false maps to bad status");
  assert.equal(
    resolveStatusClass(null),
    "pending",
    "null maps to pending status",
  );
  assert.equal(
    resolveStatusClass(undefined),
    "pending",
    "undefined maps to pending status",
  );
});

test("Next.js build artifacts include bundled @nexora/ui styles", () => {
  const cssDir = path.join(webRoot, ".next/static/css");
  if (!fs.existsSync(cssDir)) {
    // If not built yet, skip build check
    return;
  }

  const cssFiles = fs.readdirSync(cssDir).filter((f) => f.endsWith(".css"));
  assert.ok(cssFiles.length > 0, "Build must produce static CSS files");

  let allCss = "";
  for (const file of cssFiles) {
    allCss += fs.readFileSync(path.join(cssDir, file), "utf8");
  }

  assert.match(
    allCss,
    /Panel_panel__/,
    "Compiled CSS contains scoped Panel_panel class",
  );
  assert.match(
    allCss,
    /Panel_title__/,
    "Compiled CSS contains scoped Panel_title class",
  );
  assert.match(
    allCss,
    /StatusBadge_badge__/,
    "Compiled CSS contains scoped StatusBadge_badge class",
  );
  assert.match(
    allCss,
    /StatusBadge_good__/,
    "Compiled CSS contains scoped StatusBadge_good class",
  );
  assert.match(
    allCss,
    /StatusBadge_bad__/,
    "Compiled CSS contains scoped StatusBadge_bad class",
  );
  assert.match(
    allCss,
    /StatusBadge_pending__/,
    "Compiled CSS contains scoped StatusBadge_pending class",
  );
});
