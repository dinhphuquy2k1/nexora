import { readdir, readFile, access } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * ============================================================================
 * Nexora Preflight Policy, Governance & Duplication Guard
 * ============================================================================
 * Architecture Enforcement: ADR-008, ADR-009, PROJECT_RULES.md
 *
 * Tier 1 Screening: Fast dependency-free preflight heuristic guards.
 * Tier 2 Verification: TypeScript AST & ESLint rules (scripts/eslint-rules).
 * ============================================================================
 */

const UUID_PATTERN_REGEX =
  /\[[0-9a-fA-F-]+\]\{8\}-\[[0-9a-fA-F-]+\]\{4\}-\[[0-9a-fA-F-]+\]\{4\}/;
const HEX64_PATTERN_REGEX = /\[[0-9a-fA-F-]+\]\{64\}/;

export const AUTHORIZED_APPROVAL_AUTHORITIES = ["dinhphuquy2k1"];

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

function isPlaceholderValue(val) {
  if (!val || typeof val !== "string") return true;
  const lower = val.toLowerCase().trim();
  return (
    lower.startsWith("<") ||
    lower.endsWith(">") ||
    lower === "todo" ||
    lower === "tbd" ||
    lower === "..." ||
    lower === "placeholder" ||
    lower === "none"
  );
}

/**
 * Tier 1: Checks a file for unauthorized duplicate implementations of canonical primitives.
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
 * Parses the structured `## Design Review & Reuse Decision` section from a task document.
 */
export function parseStructuredDesignRecord(content) {
  const sectionHeader = "## Design Review & Reuse Decision";
  const sectionIndex = content.indexOf(sectionHeader);
  if (sectionIndex === -1) {
    return {
      exists: false,
      error: `Missing required '${sectionHeader}' section.`,
      fields: {},
      failures: [`Missing required '${sectionHeader}' section.`],
    };
  }

  // Extract section text up to next ## heading or EOF
  const afterHeader = content.slice(sectionIndex + sectionHeader.length);
  const nextHeadingMatch = afterHeader.search(/\n##\s+/);
  const sectionText =
    nextHeadingMatch === -1
      ? afterHeader
      : afterHeader.slice(0, nextHeadingMatch);

  const lines = sectionText.split("\n");
  const fields = {};
  const duplicateKeys = new Set();
  const failures = [];

  const fieldKeyMap = {
    "task id": "taskId",
    classification: "classification",
    "plan revision": "planRevision",
    "reviewed baseline": "reviewedBaseline",
    "approval authority": "approvalAuthority",
    "approval status": "approvalStatus",
    "approval evidence": "approvalEvidence",
  };

  const statusMatches = [];

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    // Match lines like "- **Key**: Value" or "Key: Value" or "**Key**: Value"
    const match = trimmed.match(/^(?:-\s*)?\*{0,2}([^:*]+)\*{0,2}:\s*(.+)$/);
    if (!match) continue;

    const keyLower = match[1].trim().toLowerCase();
    const value = match[2].trim();

    if (keyLower === "approval status") {
      statusMatches.push(value);
    }

    const fieldName = fieldKeyMap[keyLower];
    if (fieldName) {
      if (fields[fieldName] !== undefined) {
        duplicateKeys.add(fieldName);
      } else {
        fields[fieldName] = value;
      }
    }
  }

  // Check duplicate status fields
  if (statusMatches.length > 1 || duplicateKeys.has("approvalStatus")) {
    failures.push(
      "Duplicate Approval status declarations in Design Review section.",
    );
  }

  // Required fields
  const required = [
    ["taskId", "Task ID"],
    ["classification", "Classification"],
    ["planRevision", "Plan revision"],
    ["reviewedBaseline", "Reviewed baseline"],
    ["approvalAuthority", "Approval authority"],
    ["approvalStatus", "Approval status"],
    ["approvalEvidence", "Approval evidence"],
  ];

  for (const [key, label] of required) {
    const val = fields[key];
    if (!val || val.length === 0) {
      failures.push(
        `Missing required field '${label}' in Design Review section.`,
      );
    } else if (isPlaceholderValue(val)) {
      failures.push(
        `Field '${label}' contains invalid placeholder value: '${val}'.`,
      );
    }
  }

  // Validate status value
  const validStatuses = ["APPROVED", "PENDING_REVIEW", "REVISION_REQUIRED"];
  if (fields.approvalStatus) {
    if (!validStatuses.includes(fields.approvalStatus)) {
      failures.push(
        `Invalid Approval status '${fields.approvalStatus}'. Allowed values: ${validStatuses.join(", ")}.`,
      );
    }
  }

  return {
    exists: true,
    sectionText,
    fields,
    statusMatches,
    failures,
  };
}

/**
 * Validates task markdown content for required design governance, reuse audit matrix, and approval evidence.
 */
export function validateTaskDesignGovernance(
  taskContent,
  taskPath = "",
  options = {},
) {
  const failures = [];
  const normalizedPath = taskPath.replace(/\\/g, "/");

  // Historical completed tasks are grandfathered from retrospective design review enforcement
  if (normalizedPath.includes("docs/tasks/completed/")) {
    return failures;
  }

  const mode =
    options.mode || (options.isPrBinding ? "implementation" : "structural");

  // If running in structural mode, and the task has no design record section,
  // it is an untouched historical task predating ADR-009 and is not retroactively invalidated.
  if (
    mode === "structural" &&
    !taskContent.includes("## Design Review & Reuse Decision")
  ) {
    return failures;
  }

  // 1. Parse structured section
  const parsed = parseStructuredDesignRecord(taskContent);
  if (!parsed.exists) {
    failures.push(parsed.error);
    return failures;
  }

  failures.push(...parsed.failures);

  const { fields } = parsed;

  // 2. Validate classification
  const classification = fields.classification?.toUpperCase();
  if (
    classification &&
    !["BOUNDED", "SIGNIFICANT", "SPIKE"].includes(classification)
  ) {
    failures.push(`Invalid Task Classification: '${fields.classification}'.`);
  }

  // 3. Status validation:
  // In implementation mode, status MUST be APPROVED (PENDING_REVIEW and REVISION_REQUIRED fail).
  // In structural mode, PENDING_REVIEW and REVISION_REQUIRED are valid task states.
  if (mode === "implementation") {
    if (fields.approvalStatus && fields.approvalStatus !== "APPROVED") {
      failures.push(
        `Approval status is '${fields.approvalStatus}'; task cannot proceed until approved.`,
      );
    }
  }

  // 4. Validate Documentation Impact declaration
  if (
    !taskContent.includes("Documentation Impact: REQUIRED") &&
    !taskContent.includes("Documentation Impact: NONE")
  ) {
    failures.push(
      "Missing canonical Documentation Impact declaration (REQUIRED or NONE).",
    );
  }

  // 5. Validate Reuse & Design Audit Matrix
  // Must contain table with the required canonical columns
  const requiredMatrixHeaders = [
    "component",
    "existing implementations",
    "domain owner",
    "reuse alternatives",
    "selected approach",
    "rationale",
    "risks",
    "verification",
  ];

  const lowerContent = taskContent.toLowerCase();
  const missingHeaders = requiredMatrixHeaders.filter(
    (header) => !lowerContent.includes(header),
  );

  if (missingHeaders.length > 0) {
    failures.push(
      `Incomplete Reuse & Design Audit Matrix. Missing required columns/rows: ${missingHeaders.join(", ")}.`,
    );
  }

  // 6. For SIGNIFICANT tasks, verify deeper design requirements (Tactical DDD)
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
 * Parses an explicit machine-readable design approval decision block from a review or comment body.
 *
 * Recognized format:
 * NEXORA DESIGN APPROVAL
 * Task: <taskId>
 * Plan revision: <planRevision>
 * Decision: <APPROVED | REVISION_REQUIRED | REVOKED>
 */
export function parseApprovalDecisionBlock(text) {
  if (!text || typeof text !== "string") return null;

  // Normalize CRLF to LF
  const normalized = text.replace(/\r\n/g, "\n");

  // Strip fenced code blocks (``` ... ``` or ~~~ ... ~~~)
  const withoutCodeBlocks = normalized.replace(
    /(```[\s\S]*?```|~~~[\s\S]*?~~~)/g,
    "",
  );

  // Filter out blockquote lines (starting with '>')
  const lines = withoutCodeBlocks
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => !l.startsWith(">"));

  const headerRegex = /^\*{0,2}NEXORA\s+DESIGN\s+APPROVAL\*{0,2}$/i;
  const headerIndices = [];
  for (let i = 0; i < lines.length; i++) {
    if (headerRegex.test(lines[i])) {
      headerIndices.push(i);
    }
  }

  // Must contain exactly one formal header
  if (headerIndices.length !== 1) {
    return null;
  }

  const headerIndex = headerIndices[0];

  const taskMatches = [];
  const planMatches = [];
  const decMatches = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    const taskMatch = line.match(
      /^(?:-\s*)?\*{0,2}(?:Task|Task ID)\*{0,2}:\s*`?([A-Za-z0-9_-]+)`?$/i,
    );
    if (taskMatch) {
      taskMatches.push({ index: i, value: taskMatch[1].trim() });
      continue;
    }

    const revMatch = line.match(
      /^(?:-\s*)?\*{0,2}Plan\s+revision\*{0,2}:\s*`?([A-Za-z0-9_.-]+)`?$/i,
    );
    if (revMatch) {
      planMatches.push({ index: i, value: revMatch[1].trim() });
      continue;
    }

    const decMatch = line.match(
      /^(?:-\s*)?\*{0,2}(?:Decision|Approval status)\*{0,2}:\s*`?([A-Za-z_]+)`?$/i,
    );
    if (decMatch) {
      decMatches.push({ index: i, value: decMatch[1].trim().toUpperCase() });
      continue;
    }
  }

  // Must contain exactly one of each field
  if (
    taskMatches.length !== 1 ||
    planMatches.length !== 1 ||
    decMatches.length !== 1
  ) {
    return null;
  }

  // All fields must appear after the header
  if (
    taskMatches[0].index < headerIndex ||
    planMatches[0].index < headerIndex ||
    decMatches[0].index < headerIndex
  ) {
    return null;
  }

  const decision = decMatches[0].value;
  const validDecisions = ["APPROVED", "REVISION_REQUIRED", "REVOKED"];
  if (!validDecisions.includes(decision)) {
    return null;
  }

  return {
    taskId: taskMatches[0].value,
    planRevision: planMatches[0].value,
    decision,
  };
}

/**
 * Parses the canonical preflight block from a PR description.
 */
export function parsePrPreflightBlock(prBody) {
  if (!prBody || typeof prBody !== "string") {
    return {
      exists: false,
      fields: {},
      failures: ["PR description/body is empty or missing."],
    };
  }

  const failures = [];
  const fields = {};
  const lines = prBody.split("\n");

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    const match = trimmed.match(/^(?:-\s*)?\*{0,2}([^:*]+)\*{0,2}:\s*(.+)$/);
    if (!match) continue;

    const keyLower = match[1].trim().toLowerCase();
    const value = match[2].trim();

    if (keyLower === "task id" || keyLower === "task") {
      const cleanVal = value.replace(/[`*]/g, "").trim();
      if (fields.taskId && fields.taskId !== cleanVal) {
        failures.push(
          `Conflicting Task ID declarations in PR description: '${fields.taskId}' vs '${cleanVal}'.`,
        );
      } else {
        fields.taskId = cleanVal;
      }
    } else if (keyLower === "task reference" || keyLower === "task ref") {
      // Could be markdown link: [NEXORA-027](docs/tasks/active/...) or path
      const linkMatch = value.match(/\(([^)]+)\)/);
      const pathVal = linkMatch
        ? linkMatch[1]
        : value.replace(/[`*]/g, "").trim();
      if (fields.taskReference && fields.taskReference !== pathVal) {
        failures.push(
          `Conflicting Task Reference declarations in PR description.`,
        );
      } else {
        fields.taskReference = pathVal;
      }
    } else if (keyLower === "plan revision" || keyLower === "plan rev") {
      const cleanVal = value.replace(/[`*]/g, "").trim();
      if (fields.planRevision && fields.planRevision !== cleanVal) {
        failures.push(
          `Conflicting Plan revision declarations in PR description.`,
        );
      } else {
        fields.planRevision = cleanVal;
      }
    }
  }

  // Fallback: if taskReference was not declared via key-value line, check if a single canonical task link exists
  if (!fields.taskReference) {
    const linkMatches = prBody.match(
      /docs\/tasks\/active\/[A-Za-z0-9_-]+\.md/g,
    );
    if (linkMatches && linkMatches.length === 1) {
      fields.taskReference = linkMatches[0];
    }
  }

  return {
    exists: Boolean(
      fields.taskId || fields.taskReference || fields.planRevision,
    ),
    fields,
    failures,
  };
}

/**
 * Validates PR body binding to active task reference, plan revision, and filename matching.
 */
export function validatePrTaskBinding(prBody, rootDir) {
  const failures = [];
  if (!prBody || typeof prBody !== "string" || !prBody.trim()) {
    return {
      valid: false,
      failures: ["PR description/body is empty or missing."],
      tasks: [],
    };
  }

  const parsed = parsePrPreflightBlock(prBody);
  failures.push(...parsed.failures);

  // 1. Task ID must be present and not a placeholder
  if (!parsed.fields.taskId) {
    failures.push("PR description is missing required 'Task ID'.");
  } else if (isPlaceholderValue(parsed.fields.taskId)) {
    failures.push(
      `Task ID contains invalid placeholder value: '${parsed.fields.taskId}'.`,
    );
  }

  // 2. Task Reference must be present and canonical
  if (!parsed.fields.taskReference) {
    failures.push(
      "PR description must reference an active task file in 'docs/tasks/active/'.",
    );
  } else {
    const relPath = parsed.fields.taskReference;
    if (relPath.includes("://")) {
      failures.push(
        `Task reference cannot be a URL, must be in 'docs/tasks/active/', got: '${relPath}'.`,
      );
    } else if (
      relPath.includes("..") ||
      relPath.startsWith("/") ||
      relPath.startsWith("\\") ||
      /^[A-Za-z]:/.test(relPath)
    ) {
      failures.push(`Illegal path traversal in task reference: '${relPath}'.`);
    } else if (!relPath.startsWith("docs/tasks/active/")) {
      failures.push(
        `Task reference must be in 'docs/tasks/active/', got: '${relPath}'.`,
      );
    } else if (!relPath.endsWith(".md")) {
      failures.push(
        `Task reference must be a markdown file, got: '${relPath}'.`,
      );
    } else if (isPlaceholderValue(relPath)) {
      failures.push(
        `Task reference contains invalid placeholder value: '${relPath}'.`,
      );
    } else {
      const fullPath = resolve(rootDir, relPath);
      const activeDir = resolve(rootDir, "docs/tasks/active");
      const normFullPath = fullPath.replace(/\\/g, "/");
      const normActiveDir = activeDir.replace(/\\/g, "/");

      if (
        !normFullPath.startsWith(normActiveDir + "/") &&
        normFullPath !== normActiveDir
      ) {
        failures.push(
          `Illegal path traversal outside active tasks directory: '${relPath}'.`,
        );
      } else if (!existsSync(fullPath)) {
        failures.push(`Referenced task file does not exist: '${relPath}'.`);
      } else {
        // Match filename task ID
        const fileMatch = relPath.match(/(NEXORA-\d+)/);
        const fileTaskId = fileMatch ? fileMatch[1] : null;
        if (
          fileTaskId &&
          parsed.fields.taskId &&
          fileTaskId !== parsed.fields.taskId
        ) {
          failures.push(
            `PR Task ID mismatch: PR specifies '${parsed.fields.taskId}' but filename indicates '${fileTaskId}'.`,
          );
        }

        // Verify task file content
        try {
          const taskContent = readFileSync(fullPath, "utf8");
          const designRecord = parseStructuredDesignRecord(taskContent);
          if (!designRecord.exists) {
            failures.push(
              `Referenced task '${relPath}' is missing required '## Design Review & Reuse Decision' section.`,
            );
          } else {
            if (
              designRecord.fields.taskId &&
              parsed.fields.taskId &&
              designRecord.fields.taskId !== parsed.fields.taskId
            ) {
              failures.push(
                `Task ID mismatch: PR specifies '${parsed.fields.taskId}' but task design record specifies '${designRecord.fields.taskId}'.`,
              );
            }
            if (parsed.fields.planRevision) {
              if (
                designRecord.fields.planRevision &&
                parsed.fields.planRevision !== designRecord.fields.planRevision
              ) {
                failures.push(
                  `Plan revision mismatch: PR specifies '${parsed.fields.planRevision}' but task design record specifies '${designRecord.fields.planRevision}'.`,
                );
              }
            }
          }
        } catch (e) {
          failures.push(
            `Failed to read referenced task file '${relPath}': ${e.message}`,
          );
        }
      }
    }
  }

  // 3. Plan revision must be present and not a placeholder
  if (!parsed.fields.planRevision) {
    failures.push("PR description is missing required 'Plan revision'.");
  } else if (isPlaceholderValue(parsed.fields.planRevision)) {
    failures.push(
      `Plan revision contains invalid placeholder value: '${parsed.fields.planRevision}'.`,
    );
  }

  // 4. Reject ambiguous conflicting task references in PR body
  const allTaskMatches =
    prBody.match(/docs\/tasks\/[A-Za-z0-9_/.-]+\.md/g) || [];
  const uniqueTaskPaths = [...new Set(allTaskMatches)];
  if (uniqueTaskPaths.length > 1) {
    failures.push(
      `Multiple conflicting task references detected in PR description: ${uniqueTaskPaths.join(", ")}.`,
    );
  }

  const tasks =
    failures.length === 0 && parsed.fields.taskReference
      ? [
          {
            relPath: parsed.fields.taskReference,
            fullPath: resolve(rootDir, parsed.fields.taskReference),
            taskId: parsed.fields.taskId,
            planRevision: parsed.fields.planRevision,
          },
        ]
      : [];

  return {
    valid: failures.length === 0 && tasks.length > 0,
    failures,
    tasks,
    prFields: parsed.fields,
  };
}

/**
 * Validates GitHub-backed approval evidence in CI mode.
 */
export async function verifyGitHubApprovalEvidence({
  prNumber,
  repoOwner = "dinhphuquy2k1",
  repoName = "nexora",
  taskRecord,
  githubToken = process.env.GITHUB_TOKEN,
  isCi = false,
  fetchFn = fetch,
}) {
  const taskId = taskRecord?.fields?.taskId;
  const planRevision = taskRecord?.fields?.planRevision;
  const designDecisionRecorded = Boolean(
    taskRecord?.fields?.approvalStatus === "APPROVED",
  );

  if (!isCi) {
    return {
      designDecisionRecorded,
      approvalVerified: false,
      verificationMode: "local_static",
      policyExceptionGranted: false,
      message:
        "Local/static mode: Authenticated GitHub approval verification not performed.",
      verified: false,
    };
  }

  if (!githubToken) {
    return {
      designDecisionRecorded,
      approvalVerified: false,
      verificationMode: "github_ci",
      policyExceptionGranted: false,
      message: "CI mode requires GITHUB_TOKEN to verify approval provenance.",
      verified: false,
    };
  }

  if (!prNumber) {
    return {
      designDecisionRecorded,
      approvalVerified: false,
      verificationMode: "github_ci",
      policyExceptionGranted: false,
      message:
        "CI mode requires a valid PR number to verify approval provenance.",
      verified: false,
    };
  }

  const headers = {
    Authorization: `Bearer ${githubToken}`,
    Accept: "application/vnd.github+json",
    "User-Agent": "nexora-preflight-check",
  };

  try {
    async function fetchAllPages(endpoint) {
      const items = [];
      let page = 1;
      const maxPages = 5;

      while (page <= maxPages) {
        const separator = endpoint.includes("?") ? "&" : "?";
        const url = `https://api.github.com/repos/${repoOwner}/${repoName}/${endpoint}${separator}per_page=100&page=${page}`;
        const res = await fetchFn(url, {
          headers,
          signal: AbortSignal.timeout(10000),
        });

        if (!res.ok) {
          throw new Error(
            `GitHub API request to '${endpoint}' failed: HTTP ${res.status}`,
          );
        }

        const data = await res.json();
        if (!Array.isArray(data)) {
          throw new Error(
            `GitHub API returned non-array payload for '${endpoint}'.`,
          );
        }

        items.push(...data);
        if (data.length < 100) break;
        page++;
      }
      return items;
    }

    const [reviews, comments] = await Promise.all([
      fetchAllPages(`pulls/${prNumber}/reviews`),
      fetchAllPages(`issues/${prNumber}/comments`),
    ]);

    const formalDecisions = [];

    function parseTimestamp(rawDate, context) {
      if (!rawDate) {
        throw new Error(`Missing timestamp on ${context}.`);
      }
      const ts = new Date(rawDate).getTime();
      if (isNaN(ts) || ts <= 0) {
        throw new Error(
          `Invalid or unparseable timestamp '${rawDate}' on ${context}.`,
        );
      }
      return ts;
    }

    // 1. Process Source A: GitHub Reviews
    for (const review of reviews) {
      if (
        !review.user ||
        !AUTHORIZED_APPROVAL_AUTHORITIES.includes(review.user.login)
      ) {
        continue;
      }
      if (review.user.type === "Bot" || review.user.login.endsWith("[bot]")) {
        continue;
      }
      if (
        review.state === "DISMISSED" ||
        review.state === "PENDING" ||
        review.state === "COMMENTED"
      ) {
        continue;
      }

      if (review.state === "CHANGES_REQUESTED") {
        formalDecisions.push({
          source: "review",
          author: review.user.login,
          submittedAt: parseTimestamp(
            review.submitted_at,
            `review by @${review.user.login}`,
          ),
          decision: "REVISION_REQUIRED",
          state: review.state,
        });
        continue;
      }

      if (review.state === "APPROVED") {
        const decisionBlock = parseApprovalDecisionBlock(review.body);
        if (decisionBlock) {
          if (
            decisionBlock.taskId === taskId &&
            decisionBlock.planRevision === planRevision
          ) {
            formalDecisions.push({
              source: "review",
              author: review.user.login,
              submittedAt: parseTimestamp(
                review.submitted_at,
                `review by @${review.user.login}`,
              ),
              decision: decisionBlock.decision,
              state: review.state,
            });
          }
        }
        // Generic code review APPROVED without matching formal design decision does not grant approval
      }
    }

    // 2. Process Source B: Owner Comments
    for (const comment of comments) {
      if (
        !comment.user ||
        !AUTHORIZED_APPROVAL_AUTHORITIES.includes(comment.user.login)
      ) {
        continue;
      }
      if (comment.user.type === "Bot" || comment.user.login.endsWith("[bot]")) {
        continue;
      }

      const decisionBlock = parseApprovalDecisionBlock(comment.body);
      if (decisionBlock) {
        if (
          decisionBlock.taskId === taskId &&
          decisionBlock.planRevision === planRevision
        ) {
          formalDecisions.push({
            source: "comment",
            author: comment.user.login,
            submittedAt: parseTimestamp(
              comment.created_at,
              `comment by @${comment.user.login}`,
            ),
            decision: decisionBlock.decision,
            state: "COMMENT",
          });
        }
      }
    }

    if (formalDecisions.length === 0) {
      return {
        designDecisionRecorded,
        approvalVerified: false,
        verificationMode: "github_ci",
        policyExceptionGranted: false,
        message: `No authorized design approval found on PR #${prNumber} for task ${taskId} (plan revision ${planRevision}).`,
        verified: false,
      };
    }

    // Chronological order ascending
    formalDecisions.sort((a, b) => a.submittedAt - b.submittedAt);
    const latestDecision = formalDecisions[formalDecisions.length - 1];

    if (latestDecision.decision !== "APPROVED") {
      return {
        designDecisionRecorded,
        approvalVerified: false,
        verificationMode: "github_ci",
        policyExceptionGranted: false,
        message: `Latest design decision on PR #${prNumber} by @${latestDecision.author} is '${latestDecision.decision}' (not APPROVED).`,
        verified: false,
      };
    }

    return {
      designDecisionRecorded,
      approvalVerified: true,
      verificationMode: "github_ci",
      policyExceptionGranted: false,
      message: `Verified design approval by @${latestDecision.author} via ${latestDecision.source} for task ${taskId} (plan revision ${planRevision}).`,
      verified: true,
    };
  } catch (err) {
    return {
      designDecisionRecorded,
      approvalVerified: false,
      verificationMode: "github_ci",
      policyExceptionGranted: false,
      message: `GitHub approval verification failed (fail closed): ${err.message}`,
      verified: false,
    };
  }
}

/**
 * Validates .github/instructions/backend.instructions.md for valid applyTo frontmatter.
 */
export async function validateCopilotInstructions(rootDir) {
  const failures = [];
  const filePath = resolve(
    rootDir,
    ".github/instructions/backend.instructions.md",
  );

  try {
    const content = await readFile(filePath, "utf8");
    const frontmatterMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!frontmatterMatch) {
      failures.push(
        "backend.instructions.md is missing YAML frontmatter ('--- ... ---').",
      );
      return failures;
    }

    const frontmatter = frontmatterMatch[1];
    const applyToMatch = frontmatter.match(/applyTo:\s*["']?([^"'\r\n]+)["']?/);
    if (!applyToMatch || !applyToMatch[1].trim()) {
      failures.push(
        "backend.instructions.md frontmatter must contain a non-empty 'applyTo' glob pattern.",
      );
      return failures;
    }

    const applyToGlob = applyToMatch[1].trim();

    // Verify pattern covers API ts files and does not match web files
    const matchesApi =
      applyToGlob === "apps/api/src/**/*.ts" ||
      (applyToGlob.includes("apps/api/src") && applyToGlob.endsWith(".ts"));
    if (!matchesApi) {
      failures.push(
        `applyTo glob '${applyToGlob}' does not correctly match 'apps/api/src/**/*.ts'.`,
      );
    }
  } catch (err) {
    failures.push(`Failed to read backend.instructions.md: ${err.message}`);
  }

  return failures;
}

/**
 * Validates Agent Skills in .github/skills/ for portability, relative links, and frontmatter.
 */
export async function validateAgentSkills(rootDir) {
  const failures = [];
  const skillsDir = resolve(rootDir, ".github/skills");

  try {
    const entries = await readdir(skillsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const skillPath = resolve(skillsDir, entry.name, "SKILL.md");
        let content;
        try {
          content = await readFile(skillPath, "utf8");
        } catch {
          failures.push(
            `Skill directory '${entry.name}' is missing 'SKILL.md'.`,
          );
          continue;
        }

        // 1. Validate frontmatter
        const frontmatterMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
        if (!frontmatterMatch) {
          failures.push(
            `Skill '${entry.name}' SKILL.md missing YAML frontmatter.`,
          );
          continue;
        }
        const fm = frontmatterMatch[1];
        if (!fm.includes("name:") || !fm.includes("description:")) {
          failures.push(
            `Skill '${entry.name}' SKILL.md frontmatter must have 'name' and 'description'.`,
          );
        }

        // 2. Reject absolute local paths and file:/// URLs
        if (content.includes("file:///") || /\[[A-Za-z]:[\\/]/.test(content)) {
          failures.push(
            `Skill '${entry.name}' contains non-portable absolute local file paths or 'file:///' URIs.`,
          );
        }

        // 3. Verify all markdown links resolve to existing files on disk
        const linkRegex = /\[[^\]]+\]\(([^)]+)\)/g;
        let match;
        const skillDir = resolve(skillsDir, entry.name);
        while ((match = linkRegex.exec(content)) !== null) {
          const href = match[1].trim();
          if (
            href.startsWith("http://") ||
            href.startsWith("https://") ||
            href.startsWith("#")
          ) {
            continue;
          }
          const targetPath = resolve(skillDir, href);
          try {
            await access(targetPath);
          } catch {
            failures.push(
              `Skill '${entry.name}' has broken relative link '${href}' resolving to missing file '${targetPath}'.`,
            );
          }
        }
      }
    }
  } catch (err) {
    failures.push(`Failed to validate agent skills: ${err.message}`);
  }

  return failures;
}

/**
 * Validates skill effectiveness fixture definitions.
 */
export function validateSkillEffectivenessFixtures() {
  const failures = [];
  if (EXPECTED_SKILL_SCENARIOS.length < 10) {
    failures.push(
      `Expected at least 10 skill effectiveness fixture scenarios, found ${EXPECTED_SKILL_SCENARIOS.length}.`,
    );
  }

  const ids = new Set();
  for (const s of EXPECTED_SKILL_SCENARIOS) {
    if (!s.id || ids.has(s.id)) {
      failures.push(`Duplicate or missing scenario ID: '${s.id}'.`);
    }
    ids.add(s.id);

    if (!s.scenario || !s.expectedDecision || !s.rule) {
      failures.push(
        `Scenario '${s.id}' is missing required specification fields.`,
      );
    }
  }

  return {
    failures,
    agentBehavioralEvaluation: "NOT RUN",
  };
}

/**
 * Scans apps/api/src for duplicate validation guards.
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
 * Main execution runner.
 */
export async function runPreflightCheck(rootDir, options = {}) {
  console.log(
    "Running Nexora Preflight Policy, Governance & Duplication Check...\n",
  );

  const duplicateFailures = await scanDuplicateGuards(rootDir);
  const copilotFailures = await validateCopilotInstructions(rootDir);
  const skillFailures = await validateAgentSkills(rootDir);
  const fixtureResult = validateSkillEffectivenessFixtures();

  const taskFailures = [];

  const isCi =
    options.isCi !== undefined
      ? options.isCi
      : Boolean(
          process.env.CI === "true" || process.env.GITHUB_ACTIONS === "true",
        );

  const eventName =
    options.eventName ||
    process.env.GITHUB_EVENT_NAME ||
    (options.prBody ? "pull_request" : undefined);

  if (isCi && eventName === "pull_request") {
    // Mode A: GitHub pull_request CI mode
    console.log(
      "GitHub pull_request CI mode: verifying PR event and task binding...",
    );

    let event = options.eventPayload;
    if (!event && process.env.GITHUB_EVENT_PATH) {
      try {
        const raw = await readFile(process.env.GITHUB_EVENT_PATH, "utf8");
        event = JSON.parse(raw);
      } catch (err) {
        taskFailures.push(
          `Missing or invalid GITHUB_EVENT_PATH payload: ${err.message}`,
        );
      }
    }

    if (!event) {
      taskFailures.push(
        "Missing GitHub event payload in pull_request CI mode.",
      );
    } else {
      if (!event.pull_request) {
        taskFailures.push(
          "Event payload does not contain a 'pull_request' object.",
        );
      }

      const expectedRepo = options.expectedRepo || "dinhphuquy2k1/nexora";
      const actualRepo =
        event.repository?.full_name || process.env.GITHUB_REPOSITORY;
      if (actualRepo && actualRepo !== expectedRepo) {
        taskFailures.push(
          `Event repository mismatch: expected '${expectedRepo}', got '${actualRepo}'.`,
        );
      }

      const prNumber = options.prNumber || event.pull_request?.number;
      if (!prNumber || typeof prNumber !== "number" || prNumber <= 0) {
        taskFailures.push(
          "Missing or invalid PR number in pull_request event payload.",
        );
      }

      const prBody =
        options.prBody !== undefined
          ? options.prBody
          : event.pull_request?.body;
      if (!prBody || typeof prBody !== "string" || !prBody.trim()) {
        taskFailures.push(
          "PR description/body is empty or missing in pull_request event.",
        );
      } else {
        const binding = validatePrTaskBinding(prBody, rootDir);
        if (!binding.valid) {
          taskFailures.push(...binding.failures);
        } else {
          for (const task of binding.tasks) {
            try {
              const content = await readFile(task.fullPath, "utf8");
              const govFailures = validateTaskDesignGovernance(
                content,
                task.relPath,
                { mode: "implementation", isPrBinding: true },
              );
              for (const gf of govFailures) {
                taskFailures.push(`${task.relPath}: ${gf}`);
              }

              if (govFailures.length === 0) {
                const parsed = parseStructuredDesignRecord(content);
                const approvalCheck = await verifyGitHubApprovalEvidence({
                  prNumber,
                  taskRecord: parsed,
                  isCi: true,
                  fetchFn: options.fetchFn,
                  githubToken: options.githubToken,
                });
                if (!approvalCheck.approvalVerified) {
                  taskFailures.push(
                    `${task.relPath}: ${approvalCheck.message}`,
                  );
                } else {
                  console.log(`  ✓ ${approvalCheck.message}`);
                }
              }
            } catch (err) {
              taskFailures.push(
                `Failed to read referenced task '${task.relPath}': ${err.message}`,
              );
            }
          }
        }
      }
    }
  } else if (isCi && eventName === "push") {
    // Mode B: GitHub push to main CI mode
    console.log("GitHub push CI mode: scanning active tasks structurally...");
    const activeTasksDir = resolve(rootDir, "docs/tasks/active");
    try {
      const entries = await readdir(activeTasksDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isFile() && entry.name.endsWith(".md")) {
          const fullPath = resolve(activeTasksDir, entry.name);
          const content = await readFile(fullPath, "utf8");
          const failures = validateTaskDesignGovernance(content, fullPath, {
            mode: "structural",
            isPrBinding: false,
          });
          for (const f of failures) {
            taskFailures.push(`${entry.name}: ${f}`);
          }
        }
      }
    } catch (err) {
      taskFailures.push(
        `Failed to read active tasks directory: ${err.message}`,
      );
    }
  } else {
    // Mode C: Local invocation mode
    if (options.prBody) {
      console.log(
        "Local/static mode: checking PR-to-Task binding from provided PR body...",
      );
      const binding = validatePrTaskBinding(options.prBody, rootDir);
      if (!binding.valid) {
        taskFailures.push(...binding.failures);
      } else {
        for (const task of binding.tasks) {
          try {
            const content = await readFile(task.fullPath, "utf8");
            const govFailures = validateTaskDesignGovernance(
              content,
              task.relPath,
              { mode: "implementation", isPrBinding: true },
            );
            for (const gf of govFailures) {
              taskFailures.push(`${task.relPath}: ${gf}`);
            }
          } catch (err) {
            taskFailures.push(
              `Failed to read referenced task '${task.relPath}': ${err.message}`,
            );
          }
        }
        console.log(
          "  ℹ Local/static mode: PR-to-task binding validated structurally. Authenticated GitHub approval not performed.",
        );
      }
    } else {
      console.log(
        "Local/static mode: scanning active tasks in docs/tasks/active/...",
      );
      const activeTasksDir = resolve(rootDir, "docs/tasks/active");
      try {
        const entries = await readdir(activeTasksDir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isFile() && entry.name.endsWith(".md")) {
            const fullPath = resolve(activeTasksDir, entry.name);
            const content = await readFile(fullPath, "utf8");
            const failures = validateTaskDesignGovernance(content, fullPath, {
              mode: "structural",
              isPrBinding: false,
            });
            for (const f of failures) {
              taskFailures.push(`${entry.name}: ${f}`);
            }
          }
        }
        console.log(
          "  ℹ Local/static mode: active tasks scanned structurally. No PR approval claimed.",
        );
      } catch (err) {
        taskFailures.push(
          `Failed to read active tasks directory: ${err.message}`,
        );
      }
    }
  }

  const allFailures = [
    ...duplicateFailures,
    ...copilotFailures,
    ...skillFailures,
    ...fixtureResult.failures,
    ...taskFailures,
  ];

  console.log(
    `Agent behavioral evaluation: ${fixtureResult.agentBehavioralEvaluation}`,
  );

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
