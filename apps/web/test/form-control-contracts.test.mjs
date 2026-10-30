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

// Strip CSS comments safely while respecting string literals, escapes, and token boundaries
function stripCssComments(css) {
  let result = "";
  let inString = null;
  let inComment = false;
  let isEscaped = false;

  for (let i = 0; i < css.length; i++) {
    const ch = css[i];

    if (isEscaped) {
      isEscaped = false;
      if (!inComment) result += ch;
      continue;
    }

    if (inComment) {
      if (ch === "*" && css[i + 1] === "/") {
        inComment = false;
        i++;
        if (result.length > 0 && !/\s$/.test(result)) {
          result += " ";
        }
      }
      continue;
    }

    if (inString) {
      if (ch === "\\") {
        isEscaped = true;
        result += ch;
        continue;
      }
      result += ch;
      if (ch === inString) {
        inString = null;
      }
      continue;
    }

    if (ch === "/" && css[i + 1] === "*") {
      inComment = true;
      i++;
      continue;
    }

    if (ch === "\\") {
      isEscaped = true;
      result += ch;
      continue;
    }

    if (ch === '"' || ch === "'") {
      inString = ch;
      result += ch;
      continue;
    }

    result += ch;
  }

  return result;
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

// Syntax-safe selector list splitter respecting functions (:is, :not, :where), attributes, and strings
function splitSelectorList(selector) {
  const selectors = [];
  let buffer = "";
  let parenDepth = 0;
  let bracketDepth = 0;
  let inString = null;
  let isEscaped = false;

  for (let i = 0; i < selector.length; i++) {
    const ch = selector[i];

    if (isEscaped) {
      buffer += ch;
      isEscaped = false;
      continue;
    }

    if (ch === "\\") {
      buffer += ch;
      isEscaped = true;
      continue;
    }

    if (inString) {
      buffer += ch;
      if (ch === inString) {
        inString = null;
      }
      continue;
    }

    if (ch === '"' || ch === "'") {
      inString = ch;
      buffer += ch;
      continue;
    }

    if (ch === "(") {
      parenDepth++;
      buffer += ch;
      continue;
    }

    if (ch === ")") {
      if (parenDepth > 0) parenDepth--;
      buffer += ch;
      continue;
    }

    if (ch === "[") {
      bracketDepth++;
      buffer += ch;
      continue;
    }

    if (ch === "]") {
      if (bracketDepth > 0) bracketDepth--;
      buffer += ch;
      continue;
    }

    if (ch === "," && parenDepth === 0 && bracketDepth === 0 && !inString) {
      const trimmed = buffer.trim();
      if (trimmed.length > 0) {
        selectors.push(trimmed);
      }
      buffer = "";
      continue;
    }

    buffer += ch;
  }

  const trimmed = buffer.trim();
  if (trimmed.length > 0) {
    selectors.push(trimmed);
  }

  return selectors;
}

// Parse CSS declarations respecting block delimiters, strings, URLs, nested parens, and comments
function parseCssDeclarations(css) {
  const declarations = [];
  const selectorStack = [];
  let buffer = "";
  let currentProp = null;
  let inString = null;
  let inComment = false;
  let parenDepth = 0;
  let isEscaped = false;

  for (let i = 0; i < css.length; i++) {
    const ch = css[i];

    if (isEscaped) {
      buffer += ch;
      isEscaped = false;
      continue;
    }

    if (inComment) {
      if (ch === "*" && css[i + 1] === "/") {
        inComment = false;
        i++;
        if (buffer.length > 0 && !/\s$/.test(buffer)) {
          buffer += " ";
        }
      }
      continue;
    }

    if (inString) {
      if (ch === "\\") {
        buffer += ch;
        isEscaped = true;
        continue;
      }
      buffer += ch;
      if (ch === inString) {
        inString = null;
      }
      continue;
    }

    if (ch === "/" && css[i + 1] === "*") {
      inComment = true;
      i++;
      continue;
    }

    if (ch === "\\") {
      buffer += ch;
      isEscaped = true;
      continue;
    }

    if (ch === '"' || ch === "'") {
      inString = ch;
      buffer += ch;
      continue;
    }

    if (ch === "(") {
      parenDepth++;
      buffer += ch;
      continue;
    }

    if (ch === ")") {
      if (parenDepth > 0) parenDepth--;
      buffer += ch;
      continue;
    }

    if (parenDepth > 0) {
      buffer += ch;
      continue;
    }

    if (ch === "{") {
      const selector = buffer.trim();
      selectorStack.push(selector);
      buffer = "";
      currentProp = null;
      continue;
    }

    if (ch === "}") {
      if (currentProp !== null) {
        const val = buffer.trim();
        if (val.length > 0) {
          const currentSelector =
            selectorStack
              .filter(
                (s) =>
                  s &&
                  !s.startsWith("@media") &&
                  !s.startsWith("@supports") &&
                  !s.startsWith("@keyframes"),
              )
              .join(" ")
              .trim() ||
            selectorStack[selectorStack.length - 1] ||
            "";
          declarations.push({
            selector: currentSelector,
            context: selectorStack.filter((s) => s.startsWith("@")).join(" "),
            property: currentProp.toLowerCase(),
            value: val,
          });
        }
        currentProp = null;
      }
      selectorStack.pop();
      buffer = "";
      continue;
    }

    if (ch === ":") {
      const top = selectorStack[selectorStack.length - 1];
      const isInsideAtRule =
        top &&
        (top.startsWith("@media") ||
          top.startsWith("@supports") ||
          top.startsWith("@keyframes"));
      if (selectorStack.length > 0 && !isInsideAtRule && currentProp === null) {
        const candidateProp = buffer.trim();
        if (/^[a-zA-Z0-9_-]+$/.test(candidateProp)) {
          currentProp = candidateProp;
          buffer = "";
          continue;
        }
      }
      buffer += ch;
      continue;
    }

    if (ch === ";") {
      if (currentProp !== null) {
        const val = buffer.trim();
        const currentSelector =
          selectorStack
            .filter(
              (s) =>
                s &&
                !s.startsWith("@media") &&
                !s.startsWith("@supports") &&
                !s.startsWith("@keyframes"),
            )
            .join(" ")
            .trim() ||
          selectorStack[selectorStack.length - 1] ||
          "";
        declarations.push({
          selector: currentSelector,
          context: selectorStack.filter((s) => s.startsWith("@")).join(" "),
          property: currentProp.toLowerCase(),
          value: val,
        });
        currentProp = null;
      }
      buffer = "";
      continue;
    }

    buffer += ch;
  }

  return declarations;
}

const DOCUMENTED_STANDALONE_FALLBACK_FILES = new Set([
  "packages/ui/src/Panel.module.css",
  "packages/ui/src/StatusBadge.module.css",
]);

function isDocumentedStandaloneFallbackFile(normPath) {
  for (const f of DOCUMENTED_STANDALONE_FALLBACK_FILES) {
    if (normPath === f || normPath.endsWith("/" + f)) {
      return true;
    }
  }
  return false;
}

const DOCUMENTED_MONOGRAMS = [
  {
    fileSuffix: "apps/web/components/app-shell/Sidebar.module.css",
    expectedSelector: ".logoMonogram",
    expectedVal: "0 1px 2px rgba(0, 0, 0, 0.2)",
  },
  {
    fileSuffix: "apps/web/components/app-shell/Header.module.css",
    expectedSelector: ".collapsedLogo",
    expectedVal: "0 1px 2px rgba(0, 0, 0, 0.1)",
  },
  {
    fileSuffix: "apps/web/app/login/login.module.css",
    expectedSelector: ".logoMonogram",
    expectedVal: "0 1px 2px rgba(0, 0, 0, 0.05)",
  },
];

function isDocumentedMicroShadow(normPath, selector, prop, val) {
  if (prop !== "box-shadow") return false;
  const normalizedVal = val.replace(/\s+/g, " ").trim();

  for (const entry of DOCUMENTED_MONOGRAMS) {
    if (
      (normPath === entry.fileSuffix ||
        normPath.endsWith("/" + entry.fileSuffix)) &&
      normalizedVal === entry.expectedVal
    ) {
      const selectors = splitSelectorList(selector);
      if (
        selectors.length > 0 &&
        selectors.every((s) => s === entry.expectedSelector)
      ) {
        return true;
      }
    }
  }

  return false;
}

function stripDocumentedBackdrop(normPath, selector, prop, val) {
  const isOverlayFile =
    normPath === "packages/ui/src/Overlay.module.css" ||
    normPath.endsWith("/packages/ui/src/Overlay.module.css");

  if (!isOverlayFile) return val;
  if (prop !== "background" && prop !== "background-color") return val;

  const selectors = splitSelectorList(selector);
  if (
    selectors.length === 0 ||
    !selectors.every((s) => s === ".overlay::backdrop" || s === "::backdrop")
  ) {
    return val;
  }

  return val
    .replace(/rgb\(15\s+23\s+42\s*\/\s*55%\)/gi, "")
    .replace(/rgba\(15,\s*23,\s*42,\s*0?\.55\)/gi, "")
    .trim();
}

function stripSafeUrlsAndStrings(val) {
  let result = "";
  let inString = null;
  let inUrl = false;
  let parenDepth = 0;
  let isEscaped = false;

  for (let i = 0; i < val.length; i++) {
    const ch = val[i];

    if (isEscaped) {
      isEscaped = false;
      continue;
    }

    if (ch === "\\") {
      isEscaped = true;
      continue;
    }

    if (inString) {
      if (ch === inString) {
        inString = null;
        result += '""';
      }
      continue;
    }

    if (inUrl) {
      if (ch === "(") {
        parenDepth++;
        continue;
      }
      if (ch === ")") {
        parenDepth--;
        if (parenDepth === 0) {
          inUrl = false;
        }
        continue;
      }
      if (ch === '"' || ch === "'") {
        const quote = ch;
        let escaped = false;
        i++;
        while (i < val.length) {
          if (escaped) {
            escaped = false;
            i++;
            continue;
          }
          if (val[i] === "\\") {
            escaped = true;
            i++;
            continue;
          }
          if (val[i] === quote) {
            break;
          }
          i++;
        }
        continue;
      }
      continue;
    }

    if (ch === '"' || ch === "'") {
      inString = ch;
      continue;
    }

    if (
      (ch === "u" || ch === "U") &&
      val.slice(i, i + 4).toLowerCase() === "url("
    ) {
      inUrl = true;
      parenDepth = 1;
      i += 3;
      result += "url()";
      continue;
    }

    result += ch;
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
    sizingOverrides: [],
  };

  for (const { filePath, content } of fileList) {
    const normPath = filePath.replace(/\\/g, "/");
    const isAppWeb = normPath.includes("apps/web");
    const isCanonicalTokensFile =
      normPath === "apps/web/styles/tokens.css" ||
      normPath.endsWith("/apps/web/styles/tokens.css");

    // 1. Check for !important in CSS modules
    if (normPath.endsWith(".module.css")) {
      const stripped = stripCssComments(content);
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

    // 2. Parse declarations with robust state machine
    const declarations = parseCssDeclarations(content);
    const privateMappings = new Map([
      ["--_control-height", "--control-size-"],
      ["--_control-padding-x", "--control-padding-"],
      ["--_control-padding-y", "--control-padding-block-"],
      ["--_control-icon", "--icon-control-"],
      ["--_control-indicator", "--checkbox-indicator-"],
    ]);
    const ownsControls =
      /(?:^|\/)packages\/ui\/src\/Controls\.module\.css$/.test(normPath);
    const localTokens = new Set();
    if (ownsControls) {
      for (const [local, target] of privateMappings) {
        const valid = ["default", "medium", "large"].every((size) =>
          declarations.some(
            (d) =>
              d.selector.trim() === `.size[data-size="${size}"]` &&
              d.property === local &&
              d.value.trim() === `var(${target}${size})`,
          ),
        );
        if (valid) localTokens.add(local);
      }
    }

    for (const decl of declarations) {
      const { selector, property: prop, value: val } = decl;
      const isTokenDefinition = isCanonicalTokensFile && prop.startsWith("--");
      const variant = ["default", "medium", "large"].find(
        (size) => selector.trim() === `.size[data-size="${size}"]`,
      );
      const validPrivateDeclaration =
        ownsControls &&
        variant &&
        privateMappings.has(prop) &&
        val.trim() === `var(${privateMappings.get(prop)}${variant})`;

      if (
        prop === "--control-height" ||
        (!isCanonicalTokensFile &&
          /^(?:--control-(?:size-|radius$|font-size$|padding-))/.test(prop)) ||
        (prop.startsWith("--_control-") &&
          (!localTokens.has(prop) || !validPrivateDeclaration))
      ) {
        violations.sizingOverrides.push({
          file: filePath,
          selector,
          property: prop,
        });
      }

      // 2a. Check for invalid token references
      const varRefs = val.matchAll(/var\(\s*(--[a-zA-Z0-9_-]+)/g);
      for (const match of varRefs) {
        const token = match[1];
        if (
          !declaredTokens.has(token) &&
          !allowlist.has(token) &&
          !localTokens.has(token)
        ) {
          violations.invalidTokens.push({ file: filePath, token });
        }
      }

      // 2b. Check unnecessary fallbacks in apps/web (excluding canonical tokens.css token definitions)
      if (isAppWeb && !isTokenDefinition) {
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

      // 2c. Check nested fallback chains in packages/ui: var(--a, var(--b...))
      if (!isAppWeb) {
        if (/var\([^,]+,\s*var\(/.test(val)) {
          violations.nestedFallbackChains.push({
            file: filePath,
            property: prop,
            value: val,
          });
        }
      }

      // 2d. Semantic ownership checks (skip canonical token definitions)
      if (!isTokenDefinition) {
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

      // 2e. Raw color enforcement per styling policy
      if (COLOR_PROPERTIES.has(prop)) {
        if (isTokenDefinition) {
          // Token definitions in canonical tokens.css are allowed to declare raw palette colors
          continue;
        }

        // Check documented micro-shadow exception
        if (isDocumentedMicroShadow(normPath, selector, prop, val)) {
          continue;
        }

        // Strip string literals and url(...) contents safely without regex truncation
        let testVal = stripSafeUrlsAndStrings(val);

        // Strip documented backdrop color if in Overlay.module.css under ::backdrop
        testVal = stripDocumentedBackdrop(normPath, selector, prop, testVal);

        // In packages/ui, ONLY documented standalone fallback files are permitted to have fallbacks stripped
        if (isDocumentedStandaloneFallbackFile(normPath)) {
          testVal = stripBalancedVars(testVal);
        }

        if (RAW_COLOR_REGEX.test(testVal)) {
          violations.rawColors.push({
            file: filePath,
            selector,
            property: prop,
            value: val,
            issue: `Disallowed raw color in property '${prop}': ${val}`,
          });
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
    "--control-size-default",
    "--control-size-medium",
    "--control-size-large",
    "--control-radius",
    "--control-padding-default",
    "--control-padding-block-default",
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
    "--color-tab-line-indicator",
    "--color-tab-line-selected-text",
    "--color-tab-line-unselected-text",
    "--color-tab-line-hover-bg",
    "--color-tab-line-border",
    "--color-count-line-selected-bg",
    "--color-count-line-selected-text",
    "--color-count-line-unselected-bg",
    "--color-count-line-unselected-text",
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

function validateTokenDefinitions(css) {
  const scopes = new Map();
  for (const { selector, context, property, value } of parseCssDeclarations(
    css,
  )) {
    if (!property.startsWith("--")) continue;
    const key = `${context}::${selector}`;
    if (!scopes.has(key)) scopes.set(key, new Map());
    const scope = scopes.get(key);
    if (scope.has(property) && scope.get(property) !== value)
      throw Error(`Conflicting token definition ${property} in ${key}`);
    scope.set(property, value);
  }
  const root = scopes.get(":::root") ?? new Map();
  for (const scope of scopes.values()) {
    const definitions = new Map([...root, ...scope]);
    const visited = new Set(),
      active = new Set();
    function visit(token) {
      if (active.has(token)) throw Error(`Circular token reference: ${token}`);
      if (visited.has(token)) return;
      active.add(token);
      for (const [, dep] of (definitions.get(token) ?? "").matchAll(
        /var\(\s*(--[a-zA-Z0-9_-]+)/g,
      ))
        visit(dep);
      active.delete(token);
      visited.add(token);
    }
    for (const token of definitions.keys()) visit(token);
  }
  return scopes;
}
test("Token Contract: parser detects conflicts and cycles without flattening media overrides", () => {
  const content = fs.readFileSync(
    path.join(webRoot, "styles/tokens.css"),
    "utf8",
  );
  assert.ok(validateTokenDefinitions(content).size >= 3);
  assert.throws(
    () => validateTokenDefinitions(":root{--a:1px;--a:2px;}"),
    /Conflicting/,
  );
  assert.throws(
    () => validateTokenDefinitions(":root{--a:var(--b);--b:var(--a);}"),
    /Circular/,
  );
  assert.throws(
    () =>
      validateTokenDefinitions(
        ":root{--a:var(--b);--b:1px;} @media(max-width:900px){:root{--b:var(--a);}}",
      ),
    /Circular/,
  );
  assert.doesNotThrow(() =>
    validateTokenDefinitions(
      ':root{--a:1px;--b:calc(var(--a) * 2);--text:"a;b:c";} @media(max-width:900px){:root{--a:2px;}} .size[data-size="default"]{--_control:var(--b);}',
    ),
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

  // Test 10: Raw color at final declaration without semicolon
  const rawNoSemicolonCss = [
    {
      filePath: "apps/web/Card.module.css",
      content: ".card { color: #ff00ff }",
    },
  ];
  const r10 = analyzeCssPolicy(rawNoSemicolonCss, declaredTokens, allowlist);
  assert.equal(
    r10.rawColors.length,
    1,
    "Must detect raw color at final declaration without semicolon",
  );

  // Test 11: Semantic misuse at final declaration without semicolon
  const semanticNoSemicolonCss = [
    {
      filePath: "apps/web/Card.module.css",
      content: ".card { color: var(--color-surface) }",
    },
  ];
  const r11 = analyzeCssPolicy(
    semanticNoSemicolonCss,
    declaredTokens,
    allowlist,
  );
  assert.equal(
    r11.semanticMisuse.length,
    1,
    "Must detect semantic misuse at final declaration without semicolon",
  );

  // Test 12: Unnecessary fallback at final declaration without semicolon
  const fallbackNoSemicolonCss = [
    {
      filePath: "apps/web/Card.module.css",
      content: ".card { color: var(--color-text, red) }",
    },
  ];
  const r12 = analyzeCssPolicy(
    fallbackNoSemicolonCss,
    declaredTokens,
    allowlist,
  );
  assert.equal(
    r12.unnecessaryFallbacks.length,
    1,
    "Must detect unnecessary fallback at final declaration without semicolon",
  );

  // Test 13: Two consecutive blocks where first block lacks final semicolon
  const twoBlocksNoSemicolonCss = [
    {
      filePath: "apps/web/Card.module.css",
      content: ".card { color: #ff00ff } .other { background: #123456 }",
    },
  ];
  const r13 = analyzeCssPolicy(
    twoBlocksNoSemicolonCss,
    declaredTokens,
    allowlist,
  );
  assert.equal(
    r13.rawColors.length,
    2,
    "Must detect both declarations across block boundary without semicolon",
  );
  assert.equal(r13.rawColors[0].selector, ".card");
  assert.equal(r13.rawColors[1].selector, ".other");

  // Test 14: Feature tokens.css is NOT exempted (Bypass A)
  const featureTokensCss = [
    {
      filePath: "apps/web/features/orders/tokens.css",
      content: ".x { color: #ff00ff; }",
    },
  ];
  const r14 = analyzeCssPolicy(featureTokensCss, declaredTokens, allowlist);
  assert.equal(
    r14.rawColors.length,
    1,
    "tokens.css under feature directory MUST NOT be exempted",
  );

  // Test 15: Canonical tokens.css non-token component declaration is NOT exempted
  const canonicalComponentDeclCss = [
    {
      filePath: "apps/web/styles/tokens.css",
      content: ".x { color: #ff00ff; }",
    },
  ];
  const r15 = analyzeCssPolicy(
    canonicalComponentDeclCss,
    declaredTokens,
    allowlist,
  );
  assert.equal(
    r15.rawColors.length,
    1,
    "Non-token declaration in canonical tokens.css MUST NOT be exempted",
  );

  // Test 16: Card with 0.9 opacity micro-shadow is NOT exempted (Bypass B)
  const arbitraryCardShadowCss = [
    {
      filePath: "apps/web/Card.module.css",
      content: ".card { box-shadow: 0 1px 2px rgba(0, 0, 0, 0.9); }",
    },
  ];
  const r16 = analyzeCssPolicy(
    arbitraryCardShadowCss,
    declaredTokens,
    allowlist,
  );
  assert.equal(
    r16.rawColors.length,
    1,
    "Arbitrary card micro-shadow with 0.9 opacity MUST NOT be exempted",
  );

  // Test 17: Card with 0.1 opacity micro-shadow is NOT exempted (wrong component/selector)
  const cardWithHeaderOpacityShadowCss = [
    {
      filePath: "apps/web/Card.module.css",
      content: ".card { box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1); }",
    },
  ];
  const r17 = analyzeCssPolicy(
    cardWithHeaderOpacityShadowCss,
    declaredTokens,
    allowlist,
  );
  assert.equal(
    r17.rawColors.length,
    1,
    "Arbitrary card with 0.1 opacity MUST NOT be exempted without documented contract",
  );

  // Test 18: Monogram with extra shadow layer is NOT exempted
  const monogramExtraLayerCss = [
    {
      filePath: "apps/web/components/app-shell/Sidebar.module.css",
      content:
        ".logoMonogram { box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2), 0 2px 4px red; }",
    },
  ];
  const r18 = analyzeCssPolicy(
    monogramExtraLayerCss,
    declaredTokens,
    allowlist,
  );
  assert.equal(
    r18.rawColors.length,
    1,
    "Monogram with additional unauthorized shadow layer MUST NOT be exempted",
  );

  // Test 19: Standalone fallback in unapproved component is NOT exempted (Bypass C)
  const unapprovedUiFallbackCss = [
    {
      filePath: "packages/ui/src/NewControl.module.css",
      content: ".x { color: var(--color-text, #ff00ff); }",
    },
  ];
  const r19 = analyzeCssPolicy(
    unapprovedUiFallbackCss,
    declaredTokens,
    allowlist,
  );
  assert.equal(
    r19.rawColors.length,
    1,
    "Standalone fallback in NewControl.module.css MUST NOT be exempted without contract",
  );

  // Test 20: Backdrop color on wrong selector .x in Overlay.module.css is NOT exempted
  const wrongSelectorBackdropCss = [
    {
      filePath: "packages/ui/src/Overlay.module.css",
      content: ".x { background: rgb(15 23 42 / 55%); }",
    },
  ];
  const r20 = analyzeCssPolicy(
    wrongSelectorBackdropCss,
    declaredTokens,
    allowlist,
  );
  assert.equal(
    r20.rawColors.length,
    1,
    "Backdrop color on non-::backdrop selector MUST NOT be exempted",
  );

  // Test 21: Backdrop color with extra red in Overlay.module.css is NOT exempted (Bypass D)
  const contaminatedBackdropCss = [
    {
      filePath: "packages/ui/src/Overlay.module.css",
      content:
        ".overlay::backdrop { background: linear-gradient(red, rgb(15 23 42 / 55%)); }",
    },
  ];
  const r21 = analyzeCssPolicy(
    contaminatedBackdropCss,
    declaredTokens,
    allowlist,
  );
  assert.equal(
    r21.rawColors.length,
    1,
    "Declaration containing backdrop color with additional unauthorized red MUST NOT be exempted",
  );

  // Test 22: Backdrop color in another file is NOT exempted
  const otherFileBackdropCss = [
    {
      filePath: "apps/web/features/customers/Modal.module.css",
      content: ".modal::backdrop { background: rgb(15 23 42 / 55%); }",
    },
  ];
  const r22 = analyzeCssPolicy(otherFileBackdropCss, declaredTokens, allowlist);
  assert.equal(
    r22.rawColors.length,
    1,
    "Backdrop color outside Overlay.module.css MUST NOT be exempted",
  );

  // Test 23: Comment marker probe drops no declarations and preserves selector identity
  const commentMarkerProbeCss = [
    {
      filePath: "apps/web/features/comments/Probe.module.css",
      content:
        '.a { content: "/*"; color: #ff00ff; }\n.b { content: "*/"; color: var(--color-text); }',
    },
  ];
  const r23 = analyzeCssPolicy(
    commentMarkerProbeCss,
    declaredTokens,
    allowlist,
  );
  assert.equal(
    r23.rawColors.length,
    1,
    "Must detect raw color #ff00ff inside declaration following isolated comment opener string",
  );
  assert.equal(r23.rawColors[0].selector, ".a");
  assert.equal(r23.rawColors[0].property, "color");
  assert.equal(r23.rawColors[0].value, "#ff00ff");

  // Test 24: Isolated comment opener string does not drop subsequent declarations
  const isolatedOpenerCss = [
    {
      filePath: "apps/web/features/comments/Opener.module.css",
      content: '.x { content: "/*"; color: #ff00ff; }',
    },
  ];
  const r24 = analyzeCssPolicy(isolatedOpenerCss, declaredTokens, allowlist);
  assert.equal(r24.rawColors.length, 1);
  assert.equal(r24.rawColors[0].selector, ".x");

  // Test 25: Isolated comment closer string does not drop subsequent declarations
  const isolatedCloserCss = [
    {
      filePath: "apps/web/features/comments/Closer.module.css",
      content: '.x { content: "*/"; color: #ff00ff; }',
    },
  ];
  const r25 = analyzeCssPolicy(isolatedCloserCss, declaredTokens, allowlist);
  assert.equal(r25.rawColors.length, 1);
  assert.equal(r25.rawColors[0].selector, ".x");

  // Test 26: Escaped quotes with comment markers are parsed safely
  const escapedQuotesWithCommentsCss = [
    {
      filePath: "apps/web/features/comments/Escaped.module.css",
      content:
        '.x { content: "escaped \\" /* inside string \\""; color: #ff00ff; }',
    },
  ];
  const r26 = analyzeCssPolicy(
    escapedQuotesWithCommentsCss,
    declaredTokens,
    allowlist,
  );
  assert.equal(r26.rawColors.length, 1);
  assert.equal(r26.rawColors[0].selector, ".x");

  // Test 27: Generic .brandMonogram in feature path is NOT exempted (fixture leakage eliminated)
  const fixtureLeakageProbeCss = [
    {
      filePath: "apps/web/features/x/X.module.css",
      content: ".brandMonogram { box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1); }",
    },
  ];
  const r27 = analyzeCssPolicy(
    fixtureLeakageProbeCss,
    declaredTokens,
    allowlist,
  );
  assert.equal(
    r27.rawColors.length,
    1,
    "Generic .brandMonogram in features module MUST NOT be exempted",
  );

  // Test 28: Near-match selector .collapsedLogoExtra in Header is NOT exempted
  const nearMatchSelectorCss = [
    {
      filePath: "apps/web/components/app-shell/Header.module.css",
      content:
        ".collapsedLogoExtra { box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1); }",
    },
  ];
  const r28 = analyzeCssPolicy(nearMatchSelectorCss, declaredTokens, allowlist);
  assert.equal(
    r28.rawColors.length,
    1,
    "Near-match selector substring MUST NOT match documented monogram exception",
  );

  // Test 29: Selector list .collapsedLogo, .card in Header is NOT exempted for the declaration
  const selectorListContaminatedMonogramCss = [
    {
      filePath: "apps/web/components/app-shell/Header.module.css",
      content:
        ".collapsedLogo, .card { box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1); }",
    },
  ];
  const r29 = analyzeCssPolicy(
    selectorListContaminatedMonogramCss,
    declaredTokens,
    allowlist,
  );
  assert.equal(
    r29.rawColors.length,
    1,
    "Selector list containing non-approved selector (.card) MUST NOT be exempted",
  );

  // Test 30: Selector list .overlay::backdrop, .card in Overlay is NOT exempted
  const selectorListContaminatedBackdropCss = [
    {
      filePath: "packages/ui/src/Overlay.module.css",
      content: ".overlay::backdrop, .card { background: rgb(15 23 42 / 55%); }",
    },
  ];
  const r30 = analyzeCssPolicy(
    selectorListContaminatedBackdropCss,
    declaredTokens,
    allowlist,
  );
  assert.equal(
    r30.rawColors.length,
    1,
    "Backdrop selector list containing non-backdrop selector MUST NOT be exempted",
  );

  // Test 31: Commas inside pseudo-class functions/attributes are not naively split
  const functionCommaSelectorCss = [
    {
      filePath: "apps/web/components/app-shell/Sidebar.module.css",
      content:
        ".logoMonogram:is(:hover, :focus) { box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2); }",
    },
  ];
  const r31 = analyzeCssPolicy(
    functionCommaSelectorCss,
    declaredTokens,
    allowlist,
  );
  assert.equal(
    r31.rawColors.length,
    1,
    "Extended selector scope like :is(:hover, :focus) MUST NOT match exact .logoMonogram contract",
  );
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

  // 2. Documented monogram micro-shadow exceptions pass for all 3 approved owners/selectors/values
  const microShadowsCss = [
    {
      filePath: "apps/web/components/app-shell/Sidebar.module.css",
      content: ".logoMonogram { box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2); }",
    },
    {
      filePath: "apps/web/components/app-shell/Header.module.css",
      content: ".collapsedLogo { box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1); }",
    },
    {
      filePath: "apps/web/app/login/login.module.css",
      content: ".logoMonogram { box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05); }",
    },
  ];
  const rShadows = analyzeCssPolicy(microShadowsCss, declaredTokens, allowlist);
  assert.deepEqual(rShadows.rawColors, []);

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
    {
      filePath: "packages/ui/src/StatusBadge.module.css",
      content: ".badge { color: var(--color-status-success-text, #166534); }",
    },
  ];
  const rUi = analyzeCssPolicy(uiStandaloneCss, declaredTokens, allowlist);
  assert.deepEqual(rUi.rawColors, []);

  // 5. Documented native overlay backdrop in packages/ui/src/Overlay.module.css passes
  const overlayBackdropCss = [
    {
      filePath: "packages/ui/src/Overlay.module.css",
      content: ".overlay::backdrop { background: rgb(15 23 42 / 55%); }",
    },
  ];
  const rBackdrop = analyzeCssPolicy(
    overlayBackdropCss,
    declaredTokens,
    allowlist,
  );
  assert.deepEqual(rBackdrop.rawColors, []);

  // 6. Safe non-color constructs do not cause false positives (comments, escaped strings, URLs)
  const safeConstructsCss = [
    {
      filePath: "apps/web/components/Safe.module.css",
      content: `
        /* color: #ff0000; border: 1px solid blue; */
        .safe {
          content: "color: red; \\"url(;)\\"";
          background-image: url("data:image/svg;utf8,<svg>;");
        }
      `,
    },
  ];
  const rSafe = analyzeCssPolicy(safeConstructsCss, declaredTokens, allowlist);
  assert.deepEqual(rSafe.rawColors, []);

  // 7. Strings containing comment markers /* and */ without raw colors pass safely
  const commentInStringsCss = [
    {
      filePath: "apps/web/components/CommentStrings.module.css",
      content:
        '.a { content: "/* safe */"; color: var(--color-primary); }\n.b { content: "*/"; color: var(--color-border); }',
    },
  ];
  const rCommentStrings = analyzeCssPolicy(
    commentInStringsCss,
    declaredTokens,
    allowlist,
  );
  assert.deepEqual(rCommentStrings.rawColors, []);

  // 8. Real CSS comments between tokens preserve token boundaries
  const commentTokenBoundaryCss = [
    {
      filePath: "apps/web/components/TokenBoundary.module.css",
      content:
        ".box { border: 1px/* comment */solid/* comment */var(--color-border); }",
    },
  ];
  const rCommentTokens = analyzeCssPolicy(
    commentTokenBoundaryCss,
    declaredTokens,
    allowlist,
  );
  assert.deepEqual(rCommentTokens.rawColors, []);

  // 9. Strings and URLs with semicolons, parentheses, or query params do not truncate declarations
  const urlAndStringComplexCss = [
    {
      filePath: "apps/web/components/ComplexUrl.module.css",
      content: `
        .complex {
          content: "string with ; and (parens) and /* markers */";
          background-image: url("https://example.com/asset.png?a=1;b=2&c=(3)/*not-comment*/");
          color: var(--color-primary);
        }
      `,
    },
  ];
  const rUrlComplex = analyzeCssPolicy(
    urlAndStringComplexCss,
    declaredTokens,
    allowlist,
  );
  assert.deepEqual(rUrlComplex.rawColors, []);

  // 10. Path normalization works with both Windows backslashes and POSIX forward slashes
  const windowsPathFallbackCss = [
    {
      filePath: "packages\\ui\\src\\Panel.module.css",
      content: ".panel { color: var(--color-primary, #172b4d); }",
    },
  ];
  const rWinPath = analyzeCssPolicy(
    windowsPathFallbackCss,
    declaredTokens,
    allowlist,
  );
  assert.deepEqual(rWinPath.rawColors, []);
});

// ============================================================================
// GROUP 2: COMPONENT CONSISTENCY TESTS
// ============================================================================

test("Component Consistency: Form controls share canonical contract tokens for sizing and states", () => {
  const controlsCssPath = path.join(uiPackageRoot, "src/Controls.module.css");
  assert.ok(fs.existsSync(controlsCssPath), "Controls.module.css must exist");

  const css = fs.readFileSync(controlsCssPath, "utf8");

  // Input & Button bind sizing to --_control-height and --control-radius
  assert.match(
    css,
    /\.input\s*\{[^}]*height:\s*var\(--_control-height/s,
    "Input binds height to --_control-height",
  );
  assert.match(
    css,
    /\.button\s*\{[^}]*height:\s*var\(--_control-height/s,
    "Button binds height to --_control-height",
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

test("Component Consistency: Button, status, tab and pagination canonical palette token bindings", () => {
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

  // Authoritative owner-selected palette verification
  assert.equal(
    resolveTokenHex("--color-text-on-accent").toLowerCase(),
    "#ffffff",
    "Button default foreground must resolve to white (#ffffff)",
  );
  assert.equal(
    resolveTokenHex("--color-text-on-accent-hover").toLowerCase(),
    "#ffffff",
    "Button hover foreground must resolve to white (#ffffff)",
  );
  assert.equal(
    resolveTokenHex("--color-accent").toLowerCase(),
    "#f58a24",
    "Accent background must resolve to brand orange (#f58a24)",
  );
  assert.equal(
    resolveTokenHex("--color-accent-hover").toLowerCase(),
    "#e07716",
    "Accent hover background must resolve to brand orange hover (#e07716)",
  );

  // Tab and Pagination tokens
  assert.equal(
    resolveTokenHex("--color-tab-selected-bg").toLowerCase(),
    "#f58a24",
    "Selected tab background must resolve to brand orange",
  );
  assert.equal(
    resolveTokenHex("--color-tab-selected-text").toLowerCase(),
    "#ffffff",
    "Selected tab text must resolve to white",
  );
  assert.equal(
    resolveTokenHex("--color-pagination-selected-bg").toLowerCase(),
    "#f58a24",
    "Selected pagination background must resolve to brand orange",
  );
  assert.equal(
    resolveTokenHex("--color-pagination-selected-text").toLowerCase(),
    "#ffffff",
    "Selected pagination text must resolve to white",
  );

  // Line TabBar and CountBadge tokens
  assert.equal(
    resolveTokenHex("--color-tab-line-indicator").toLowerCase(),
    "#f58a24",
    "Line tab indicator must resolve to brand orange",
  );
  assert.equal(
    resolveTokenHex("--color-tab-line-selected-text").toLowerCase(),
    "#1f2937",
    "Line tab selected text must resolve to dark gray",
  );
  assert.equal(
    resolveTokenHex("--color-tab-line-unselected-text").toLowerCase(),
    "#64748b",
    "Line tab unselected text must resolve to gray-500",
  );
  assert.equal(
    resolveTokenHex("--color-tab-line-hover-bg").toLowerCase(),
    "#f8fafc",
    "Line tab hover background must resolve to gray-50",
  );
  assert.equal(
    resolveTokenHex("--color-tab-line-border").toLowerCase(),
    "#e2e8f0",
    "Line tab border must resolve to gray-200",
  );
  assert.equal(
    resolveTokenHex("--color-count-line-selected-bg").toLowerCase(),
    "#fff7ed",
    "Line count selected bg must resolve to brand-orange-light",
  );
  assert.equal(
    resolveTokenHex("--color-count-line-selected-text").toLowerCase(),
    "#c2410c",
    "Line count selected text must resolve to brand-orange-text",
  );
  assert.equal(
    resolveTokenHex("--color-count-line-unselected-bg").toLowerCase(),
    "#f1f5f9",
    "Line count unselected bg must resolve to gray-100",
  );
  assert.equal(
    resolveTokenHex("--color-count-line-unselected-text").toLowerCase(),
    "#64748b",
    "Line count unselected text must resolve to gray-500",
  );

  // Status badges
  assert.equal(
    resolveTokenHex("--color-status-success-bg").toLowerCase(),
    "#ecfdf5",
    "Active status background must resolve to emerald-50",
  );
  assert.equal(
    resolveTokenHex("--color-status-success-text").toLowerCase(),
    "#047857",
    "Active status text must resolve to emerald-700",
  );
  assert.equal(
    resolveTokenHex("--color-status-success-border").toLowerCase(),
    "#a7f3d0",
    "Active status border must resolve to emerald-200",
  );
  assert.equal(
    resolveTokenHex("--color-status-pending-bg").toLowerCase(),
    "#f1f5f9",
    "Inactive status background must resolve to gray-100",
  );
  assert.equal(
    resolveTokenHex("--color-status-pending-text").toLowerCase(),
    "#475569",
    "Inactive status text must resolve to gray-600",
  );
  assert.equal(
    resolveTokenHex("--color-status-pending-border").toLowerCase(),
    "#cbd5e1",
    "Inactive status border must resolve to gray-300",
  );

  // Diagnostic contrast verification: white on orange yields ~2.46:1 per authorized design decision
  const contrast = getContrastRatio([255, 255, 255], [245, 138, 36]);
  assert.ok(
    contrast > 2.0 && contrast < 3.0,
    `White on orange contrast ratio must compute to ~2.46:1 (got ${contrast.toFixed(2)}:1)`,
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

  // The height property must consume var(--_control-height)
  assert.match(
    buttonBlock,
    /height:\s*var\(--_control-height\)/,
    "Button height must be dynamically bound to var(--_control-height)",
  );
  assert.match(
    inputBlock,
    /height:\s*var\(--_control-height\)/,
    "Input height must be dynamically bound to var(--_control-height)",
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

test("Size policy rejects feature-level public token shadows and retired height aliases", () => {
  const declared = getDeclaredTokens(path.join(webRoot, "styles/tokens.css"));
  for (const content of [
    ".page { --control-size-default:48px; }",
    ".page { --control-height:32px; }",
  ]) {
    const result = analyzeCssPolicy(
      [{ filePath: "apps/web/features/future/page.module.css", content }],
      declared,
    );
    assert.ok(result.sizingOverrides?.length > 0);
  }
  const valid = analyzeCssPolicy(
    [
      {
        filePath: "apps/web/features/future/page.module.css",
        content: ".page { width:calc(100% - 4px); padding:var(--space-4); }",
      },
    ],
    declared,
  );
  assert.equal(valid.sizingOverrides?.length, 0);
});

test("Private mappings cannot be bypassed by extra declarations beside valid mappings", () => {
  const declared = getDeclaredTokens(path.join(webRoot, "styles/tokens.css"));
  const valid = fs.readFileSync(
    path.join(uiPackageRoot, "src/Controls.module.css"),
    "utf8",
  );
  for (const rogue of [
    ".input { --_control-height: 44px; }",
    '.size[data-size="default"] { --_control-height: 44px; }',
    '@media (min-width: 600px) { .size[data-size="default"] { --_control-height: 28px; } }',
  ]) {
    const result = analyzeCssPolicy(
      [
        {
          filePath: "packages/ui/src/Controls.module.css",
          content: valid + rogue,
        },
      ],
      declared,
    );
    assert.ok(result.sizingOverrides.length > 0);
  }
});
