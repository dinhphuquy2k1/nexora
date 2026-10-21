import { readdir, readFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const UUID_PATTERN_REGEX =
  /\[[0-9a-fA-F-]+\]\{8\}-\[[0-9a-fA-F-]+\]\{4\}-\[[0-9a-fA-F-]+\]\{4\}/;
const HEX64_PATTERN_REGEX = /\[[0-9a-fA-F-]+\]\{64\}/;

export const EXPECTED_SKILL_SCENARIOS = [
  {
    id: "uuid-reuse",
    scenario: "New Customer UUID validator",
    expectedDecision: "REUSE_COMMON_UUID",
    rule: "Reuse canonical isUuid from apps/api/src/common/validation/uuid.ts instead of declaring a duplicate regex.",
  },
  {
    id: "phone-reuse",
    scenario: "New User.phone contact capability",
    expectedDecision: "INSPECT_AND_REUSE_PHONE_NUMBER_VO",
    rule: "Reuse neutral PhoneNumber VO from apps/api/src/common/value-objects/phone-number.ts; do not copy Customer domain parsing.",
  },
  {
    id: "country-reuse",
    scenario: "New Shipment recipient country",
    expectedDecision: "REUSE_NEUTRAL_COUNTRY_CODE",
    rule: "Reuse neutral CountryCode from apps/api/src/common/value-objects/country-code.ts; keep Shipment domain address policies independent.",
  },
  {
    id: "shared-status-web",
    scenario: "New CustomerStatus comparison in Web",
    expectedDecision: "IMPORT_SHARED_STATUS",
    rule: "Import CustomerStatus from @nexora/shared; do not declare duplicate status constants.",
  },
  {
    id: "customer-default-address",
    scenario: "Customer default-address transition",
    expectedDecision: "KEEP_CUSTOMER_AGGREGATE_RULE",
    rule: "Keep default-address selection and minimum cardinality rule inside CustomerAggregate; do not move to shared or service.",
  },
  {
    id: "active-user-lock",
    scenario: "ACTIVE user lock",
    expectedDecision: "KEEP_INDEPENDENT_TRANSACTION_LOGIC",
    rule: "Do not merge Identity and Carrier transaction logic merely because row-locking SQL looks similar.",
  },
  {
    id: "doc-only-change",
    scenario: "Simple documentation-only change",
    expectedDecision: "CLASSIFY_BOUNDED_NO_LARGE_DDD",
    rule: "Classify as BOUNDED; do not demand an unnecessary full DDD Aggregate design for documentation updates.",
  },
  {
    id: "significant-domain",
    scenario: "Significant new domain (e.g. Shipments)",
    expectedDecision: "REQUIRE_FULL_MODELING_PREFLIGHT",
    rule: "Require full DDD Modeling Preflight (ADR-008) and explicit owner design approval before implementation.",
  },
  {
    id: "approved-design-handed",
    scenario: "Existing owner-approved design handed to coding agent",
    expectedDecision: "IMPLEMENT_APPROVED_DESIGN_DIRECTLY",
    rule: "Implement the approved design directly; do not restart the discovery process or generate new alternatives.",
  },
  {
    id: "unexpected-conflict",
    scenario: "Unexpected architectural conflict detected during inspection",
    expectedDecision: "DOCUMENT_PLAN_ISSUE_AND_STOP",
    rule: "Stop and document a concrete PLAN ISSUE rather than silently overriding the approved design or project rules.",
  },
];

/**
 * Checks a file for unauthorized duplicate implementations of canonical primitives.
 */
export function checkDuplicateValidationGuards(filePath, content) {
  const normalizedPath = filePath.replace(/\\/g, "/");
  const failures = [];

  // Exclude test files, fixtures, build output, and the canonical modules themselves
  if (
    normalizedPath.includes("/test/") ||
    normalizedPath.includes(".test.") ||
    normalizedPath.includes(".spec.") ||
    normalizedPath.includes("/fixtures/") ||
    normalizedPath.includes("/dist/") ||
    normalizedPath.includes("/scripts/")
  ) {
    return failures;
  }

  // 1. UUID Regex guard
  if (
    !normalizedPath.endsWith("apps/api/src/common/validation/uuid.ts") &&
    UUID_PATTERN_REGEX.test(content)
  ) {
    failures.push(
      `Duplicate UUID regex pattern detected in ${normalizedPath}. Must use isUuid from apps/api/src/common/validation/uuid.ts.`,
    );
  }

  // 2. Hex64 Regex guard
  if (
    !normalizedPath.endsWith("apps/api/src/common/validation/hex.ts") &&
    HEX64_PATTERN_REGEX.test(content)
  ) {
    failures.push(
      `Duplicate lowercase hex64 regex pattern detected in ${normalizedPath}. Must use isLowercaseHex64 from apps/api/src/common/validation/hex.ts.`,
    );
  }

  // 3. Direct libphonenumber-js import guard
  if (
    !normalizedPath.endsWith(
      "apps/api/src/common/value-objects/phone-number.ts",
    ) &&
    (content.includes('from "libphonenumber-js') ||
      content.includes("from 'libphonenumber-js") ||
      content.includes('require("libphonenumber-js') ||
      content.includes("require('libphonenumber-js"))
  ) {
    failures.push(
      `Direct libphonenumber-js import detected in ${normalizedPath}. Must use PhoneNumber from apps/api/src/common/value-objects/phone-number.ts.`,
    );
  }

  // 4. Direct i18n-iso-countries import guard
  if (
    !normalizedPath.endsWith(
      "apps/api/src/common/value-objects/country-code.ts",
    ) &&
    (content.includes('from "i18n-iso-countries') ||
      content.includes("from 'i18n-iso-countries") ||
      content.includes('require("i18n-iso-countries') ||
      content.includes("require('i18n-iso-countries"))
  ) {
    failures.push(
      `Direct i18n-iso-countries import detected in ${normalizedPath}. Must use CountryCode from apps/api/src/common/value-objects/country-code.ts.`,
    );
  }

  return failures;
}

/**
 * Validates task markdown content for required design governance, reuse audit matrix, and approval evidence.
 */
export function validateTaskDesignGovernance(taskContent, taskPath = "") {
  const failures = [];
  const normalizedPath = taskPath.replace(/\\/g, "/");

  // Historical completed tasks and pre-ADR-009 active tasks (before NEXORA-027) are grandfathered
  if (normalizedPath.includes("docs/tasks/completed/")) {
    return failures;
  }
  const taskNumberMatch = normalizedPath.match(/NEXORA-(\d+)/);
  if (taskNumberMatch) {
    const taskNum = parseInt(taskNumberMatch[1], 10);
    if (taskNum < 27) {
      return failures;
    }
  }

  // Check task classification
  const classificationMatch = taskContent.match(
    /Classification:\s*(BOUNDED|SIGNIFICANT|SPIKE)/i,
  );
  if (!classificationMatch) {
    failures.push(
      "Missing valid Task Classification (BOUNDED, SIGNIFICANT, or SPIKE).",
    );
  }

  const classification = classificationMatch
    ? classificationMatch[1].toUpperCase()
    : null;

  // Check Documentation Impact declaration
  if (
    !taskContent.includes("Documentation Impact: REQUIRED") &&
    !taskContent.includes("Documentation Impact: NONE")
  ) {
    failures.push(
      "Missing canonical Documentation Impact declaration (REQUIRED or NONE).",
    );
  }

  // Check for Reuse Audit Matrix or approved reuse section
  const hasReuseMatrix =
    taskContent.includes("Reuse alternatives") ||
    taskContent.includes("Reuse Alternatives") ||
    taskContent.includes("Approved Reuse Architecture") ||
    taskContent.includes("reusable-components");

  if (!hasReuseMatrix) {
    failures.push("Missing mandatory Reuse & Design Audit section or matrix.");
  }

  // Check for Approval Evidence
  const hasApprovalEvidence =
    taskContent.includes("Approved") ||
    taskContent.includes("approved") ||
    taskContent.includes("Owner-approved") ||
    taskContent.includes("owner-approved") ||
    taskContent.includes("Approval evidence");

  if (!hasApprovalEvidence) {
    failures.push("Missing documented design approval evidence.");
  }

  // For SIGNIFICANT tasks, verify deeper design requirements
  if (classification === "SIGNIFICANT") {
    const hasInvariantsOrDDD =
      taskContent.includes("invariants") ||
      taskContent.includes("Aggregate") ||
      taskContent.includes("DDD") ||
      taskContent.includes("Tactical DDD") ||
      taskContent.includes("Value Objects");

    if (!hasInvariantsOrDDD) {
      failures.push(
        "SIGNIFICANT tasks must document domain invariants or Tactical DDD boundaries.",
      );
    }
  }

  return failures;
}

/**
 * Recursively scans directory for production TypeScript files and runs duplicate guards.
 */
export async function scanDuplicateGuards(rootDir) {
  const failures = [];
  const apiSrcDir = resolve(rootDir, "apps/api/src");

  async function walk(dir) {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = resolve(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (entry.isFile() && fullPath.endsWith(".ts")) {
        const content = await readFile(fullPath, "utf8");
        const fileFailures = checkDuplicateValidationGuards(fullPath, content);
        failures.push(...fileFailures);
      }
    }
  }

  try {
    await walk(apiSrcDir);
  } catch (err) {
    failures.push(`Failed to scan apps/api/src: ${err.message}`);
  }

  return failures;
}

/**
 * Scans active task files to verify design governance compliance.
 */
export async function scanActiveTasksGovernance(rootDir) {
  const failures = [];
  const activeTasksDir = resolve(rootDir, "docs/tasks/active");

  try {
    const entries = await readdir(activeTasksDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith(".md")) {
        const fullPath = resolve(activeTasksDir, entry.name);
        const content = await readFile(fullPath, "utf8");
        const taskFailures = validateTaskDesignGovernance(content, fullPath);
        for (const failure of taskFailures) {
          failures.push(`${entry.name}: ${failure}`);
        }
      }
    }
  } catch (err) {
    failures.push(`Failed to read active tasks: ${err.message}`);
  }

  return failures;
}

/**
 * Main execution runner.
 */
export async function runPreflightCheck(rootDir) {
  console.log("Running Nexora Preflight Policy & Duplication Check...");

  const duplicateFailures = await scanDuplicateGuards(rootDir);
  const taskFailures = await scanActiveTasksGovernance(rootDir);
  const allFailures = [...duplicateFailures, ...taskFailures];

  if (allFailures.length > 0) {
    console.error("\n❌ Preflight policy violations detected:");
    for (const failure of allFailures) {
      console.error(`  - ${failure}`);
    }
    return { success: false, failures: allFailures };
  }

  console.log(
    "\n✅ All preflight governance, task design reviews, and duplication guards passed.",
  );
  return { success: true, failures: [] };
}

// CLI entry point
const isDirectCall =
  process.argv[1] &&
  fileURLToPath(import.meta.url).replace(/\\/g, "/") ===
    process.argv[1].replace(/\\/g, "/");

if (isDirectCall) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const result = await runPreflightCheck(root);
  if (!result.success) {
    process.exit(1);
  }
}
