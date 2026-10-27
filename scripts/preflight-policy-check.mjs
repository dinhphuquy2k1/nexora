import { readdir, readFile, access } from "node:fs/promises";
import { readFileSync, lstatSync, realpathSync } from "node:fs";
import { createHash } from "node:crypto";
import {
  resolve,
  dirname,
  relative,
  isAbsolute,
  basename,
  sep,
} from "node:path";
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
  const sectionMatches = [
    ...content.matchAll(/^## Design Review & Reuse Decision\r?$/gm),
  ];
  const sectionIndex = sectionMatches[0]?.index ?? -1;
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
    "design snapshot": "designSnapshot",
    "design sha-256": "designDigest",
    "reviewed baseline": "reviewedBaseline",
    "approval authority": "approvalAuthority",
    "approval status": "approvalStatus",
    "approval evidence": "approvalEvidence",
  };

  const statusMatches = [];

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    // Match lines like "- **Key**: Value" or "Key: Value" or "**Key**: Value"
    const match = trimmed.match(/^(?:-\s*)?\*{0,2}([^:*]+)\*{0,2}:\s*(.*)$/);
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

  for (const key of duplicateKeys) {
    if (key !== "approvalStatus")
      failures.push(`Duplicate ${key} declarations in Design Review section.`);
  }
  if (sectionMatches.length !== 1)
    failures.push("Duplicate Design Review section.");
  for (const key of ["designSnapshot", "designDigest"]) {
    if (fields[key]) fields[key] = fields[key].replace(/^`([^`]+)`$/, "$1");
  }
  if (fields.designDigest && !isDesignDigest(fields.designDigest))
    failures.push("Invalid Design SHA-256 format.");
  if (Boolean(fields.designSnapshot) !== Boolean(fields.designDigest))
    failures.push(
      "Design Snapshot and Design SHA-256 must be declared together.",
    );

  // Required fields
  const required = [
    ["taskId", "Task ID"],
    ["classification", "Classification"],
    ["planRevision", "Plan revision"],
    ["reviewedBaseline", "Reviewed baseline"],
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
 * Validates task markdown content for plan-first governance and reuse audit.
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
  const parsed = options.taskRecord ?? parseStructuredDesignRecord(taskContent);
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

  // 3. Plan-first implementation requires a valid snapshot, never owner approval.
  if (mode === "implementation") {
    if (!fields.designSnapshot || !isDesignDigest(fields.designDigest))
      failures.push(
        "Implementation requires Design Snapshot and valid Design SHA-256.",
      );
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
 * Design SHA-256: <computed lowercase digest>
 * Decision: <APPROVED | REVISION_REQUIRED | REVOKED>
 */
export function parseApprovalDecisionBlock(text) {
  if (typeof text !== "string") return null;
  const match = text
    .replace(/\r\n/g, "\n")
    .trim()
    .match(
      /^NEXORA DESIGN APPROVAL\nTask: ([A-Z]+-\d+)\nPlan revision: ([A-Za-z0-9][A-Za-z0-9_.-]*)\nDesign SHA-256: ([0-9a-f]{64})\nDecision: (APPROVED|REVISION_REQUIRED|REVOKED)$/,
    );
  if (!match) return null;
  return {
    taskId: match[1],
    planRevision: match[2],
    designDigest: match[3],
    decision: match[4],
  };
}

/**
 * Parses the canonical preflight block from a PR description.
 */
export function parsePrPreflightBlock(prBody) {
  if (typeof prBody !== "string" || !prBody.trim())
    return {
      exists: false,
      fields: {},
      failures: ["PR description/body is empty or missing."],
    };
  const fields = {},
    failures = [];
  const keys = {
    "task id": "taskId",
    task: "taskId",
    "task reference": "taskReference",
    "task ref": "taskReference",
    "plan revision": "planRevision",
    "plan rev": "planRevision",
    "design snapshot": "designSnapshot",
    "design sha-256": "designDigest",
  };
  for (const line of prBody.split(/\r?\n/)) {
    const match = line
      .trim()
      .match(/^(?:-\s*)?\*{0,2}([^:*]+)\*{0,2}:\s*(.*)$/);
    if (!match) continue;
    const name = match[1].trim(),
      key = keys[name.toLowerCase()];
    if (!key) continue;
    let value = match[2].trim().replace(/^`([^`]+)`$/, "$1");
    if (["taskReference", "designSnapshot"].includes(key)) {
      const link = value.match(/^\[[^\]]+\]\(([^)]+)\)$/);
      if (link) value = link[1];
    }
    if (Object.hasOwn(fields, key))
      failures.push(
        `Conflicting ${name} declarations in PR description (duplicate metadata).`,
      );
    else fields[key] = value;
  }
  return { exists: Object.keys(fields).length > 0, fields, failures };
}

const isDesignDigest = (value) =>
  typeof value === "string" && /^[0-9a-f]{64}$/.test(value);
export function computeDesignDigest(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

/** Checked repository files only; reject symlinks before reading through canonical paths. */
function readGovernedMarkdown(rootDir, ref, directory) {
  if (typeof ref !== "string" || !ref)
    throw Error("Missing governed Markdown path.");
  if (/^[A-Za-z][A-Za-z0-9+.-]*:/.test(ref))
    throw Error(`Reference must be in '${directory}/', not a URL: '${ref}'.`);
  if (
    isAbsolute(ref) ||
    ref.includes("\\") ||
    ref.split("/").some((part) => part === ".." || part === "." || !part)
  )
    throw Error(`Illegal path traversal in reference: '${ref}'.`);
  if (
    !ref.startsWith(directory + "/") ||
    ref.slice(directory.length + 1).includes("/")
  )
    throw Error(`Reference must be in '${directory}/': '${ref}'.`);
  if (!/^[A-Z]+-\d+-[A-Za-z0-9_.-]+\.md$/.test(basename(ref)))
    throw Error(`Invalid task/snapshot filename: '${ref}'.`);
  const root = realpathSync(rootDir);
  let path = root;
  for (const component of ref.split("/")) {
    path = resolve(path, component);
    const stat = lstatSync(path);
    if (stat.isSymbolicLink())
      throw Error(`Symlink in governed path: '${ref}'.`);
    if (path !== resolve(root, ref) && !stat.isDirectory())
      throw Error(`Non-directory path component: '${ref}'.`);
  }
  if (!lstatSync(path).isFile())
    throw Error(`Reference must be a regular Markdown file: '${ref}'.`);
  const physical = realpathSync(path),
    approved = realpathSync(resolve(root, directory));
  const rel = relative(approved, physical);
  if (!rel || rel === ".." || rel.startsWith(".." + sep) || isAbsolute(rel))
    throw Error(`Physical target outside '${directory}': '${ref}'.`);
  return { fullPath: physical, bytes: readFileSync(physical) };
}

function bindSnapshot(rootDir, fields, prFields) {
  const snapshot = readGovernedMarkdown(
    rootDir,
    fields.designSnapshot,
    "docs/tasks/design-reviews",
  );
  const computed = computeDesignDigest(snapshot.bytes);
  if (!isDesignDigest(fields.designDigest) || fields.designDigest !== computed)
    throw Error("Task Design SHA-256 mismatch or invalid format.");
  if (
    prFields.designSnapshot !== fields.designSnapshot ||
    prFields.designDigest !== computed
  )
    throw Error("PR Design Snapshot / Design SHA-256 mismatch.");
  const metadata = parsePrPreflightBlock(snapshot.bytes.toString("utf8"));
  if (
    metadata.failures.length ||
    metadata.fields.taskId !== fields.taskId ||
    metadata.fields.planRevision !== fields.planRevision
  )
    throw Error(
      "Snapshot Task ID / Plan revision mismatch or duplicate metadata.",
    );
  if (
    basename(fields.designSnapshot).match(/^([A-Z]+-\d+)-/)?.[1] !==
    fields.taskId
  )
    throw Error("Snapshot filename Task ID mismatch.");
  return computed;
}

export function validatePrTaskBinding(prBody, rootDir) {
  const parsed = parsePrPreflightBlock(prBody),
    failures = [...parsed.failures],
    tasks = [];
  for (const [key, label] of [
    ["taskId", "Task ID"],
    ["taskReference", "Task Reference"],
    ["planRevision", "Plan revision"],
    ["designSnapshot", "Design Snapshot"],
    ["designDigest", "Design SHA-256"],
  ]) {
    if (!parsed.fields[key])
      failures.push(`PR description is missing required '${label}'.`);
    else if (isPlaceholderValue(parsed.fields[key]))
      failures.push(`Invalid placeholder '${label}'.`);
  }
  if (parsed.fields.taskId && !/^[A-Z]+-\d+$/.test(parsed.fields.taskId))
    failures.push("Invalid Task ID format.");
  if (
    parsed.fields.planRevision &&
    !/^[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(parsed.fields.planRevision)
  )
    failures.push("Invalid Plan revision format.");
  if (parsed.fields.taskReference) {
    try {
      const file = readGovernedMarkdown(
        rootDir,
        parsed.fields.taskReference,
        "docs/tasks/active",
      );
      const filenameTask = basename(parsed.fields.taskReference).match(
        /^([A-Z]+-\d+)-/,
      )?.[1];
      if (filenameTask !== parsed.fields.taskId)
        failures.push("PR Task ID mismatch with filename.");
      const taskContent = file.bytes.toString("utf8"),
        taskRecord = parseStructuredDesignRecord(taskContent);
      failures.push(...taskRecord.failures);
      if (taskRecord.fields.taskId !== parsed.fields.taskId)
        failures.push("Task ID mismatch with task design record.");
      if (taskRecord.fields.planRevision !== parsed.fields.planRevision)
        failures.push("Plan revision mismatch with task design record.");
      const designDigest = bindSnapshot(
        rootDir,
        taskRecord.fields,
        parsed.fields,
      );
      tasks.push({
        relPath: parsed.fields.taskReference,
        fullPath: file.fullPath,
        taskId: parsed.fields.taskId,
        planRevision: parsed.fields.planRevision,
        taskContent,
        taskRecord,
        designDigest,
      });
    } catch (error) {
      failures.push(
        error.code === "ENOENT"
          ? `Referenced task/snapshot file does not exist: ${error.path}`
          : error.message,
      );
    }
  }
  return {
    valid: failures.length === 0 && tasks.length === 1,
    failures,
    tasks: failures.length ? [] : tasks,
    prFields: parsed.fields,
  };
}

/**
 * Historical GitHub approval verification helper (not called by PR preflight).
 */
export async function verifyGitHubApprovalEvidence({
  prNumber,
  repoOwner = "dinhphuquy2k1",
  repoName = "nexora",
  taskRecord,
  designDigest,
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

  if (
    !isDesignDigest(designDigest) ||
    taskRecord?.fields?.designDigest !== designDigest
  ) {
    return {
      designDecisionRecorded,
      approvalVerified: false,
      verified: false,
      verificationMode: "github_ci",
      policyExceptionGranted: false,
      message: "Missing or mismatched computed Design SHA-256.",
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
      if (page > maxPages)
        throw new Error("GitHub approval pagination exceeded safe limit.");
      return items;
    }

    const [reviews, comments] = await Promise.all([
      fetchAllPages(`pulls/${prNumber}/reviews`),
      fetchAllPages(`issues/${prNumber}/comments`),
    ]);

    const formalDecisions = [];

    function parseTimestamp(rawDate, context) {
      if (
        typeof rawDate !== "string" ||
        !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(rawDate)
      )
        throw Error(`Missing or invalid timestamp on ${context}.`);
      const ts = Date.parse(rawDate);
      if (
        !Number.isFinite(ts) ||
        new Date(ts).toISOString().slice(0, 19) !== rawDate.slice(0, 19)
      )
        throw Error(`Invalid timestamp on ${context}.`);
      return ts;
    }
    function addDecision(item, source) {
      if (
        !AUTHORIZED_APPROVAL_AUTHORITIES.includes(item.user?.login) ||
        item.user?.type !== "User" ||
        item.user.login.endsWith("[bot]")
      )
        return;
      if (
        source === "review" &&
        !["APPROVED", "CHANGES_REQUESTED"].includes(item.state)
      )
        return;
      const block = parseApprovalDecisionBlock(item.body);
      if (
        !block ||
        block.taskId !== taskId ||
        block.planRevision !== planRevision ||
        block.designDigest !== designDigest
      )
        return;
      const created = parseTimestamp(
        source === "comment" ? item.created_at : item.submitted_at,
        source,
      );
      const updated =
        item.updated_at === undefined
          ? created
          : parseTimestamp(item.updated_at, source + " edit");
      if (updated < created)
        throw Error("Invalid timestamp ordering: edit precedes creation.");
      formalDecisions.push({
        source,
        author: item.user.login,
        submittedAt: updated,
        decision:
          source === "review" && item.state === "CHANGES_REQUESTED"
            ? "REVISION_REQUIRED"
            : block.decision,
      });
    }
    for (const review of reviews) addDecision(review, "review");
    for (const comment of comments) addDecision(comment, "comment");

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

    const latestTies = formalDecisions.filter(
      (item) => item.submittedAt === latestDecision.submittedAt,
    );
    if (new Set(latestTies.map((item) => item.decision)).size > 1)
      throw Error("Ambiguous timestamp ordering of latest design decisions.");
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
function validateStructuralTaskFile(rootDir, ref) {
  const file = readGovernedMarkdown(rootDir, ref, "docs/tasks/active");
  const content = file.bytes.toString("utf8"),
    record = parseStructuredDesignRecord(content);
  const failures = validateTaskDesignGovernance(content, ref, {
    mode: "structural",
    taskRecord: record,
  });
  if (record.fields.designSnapshot) {
    try {
      bindSnapshot(rootDir, record.fields, record.fields);
    } catch (error) {
      failures.push(error.message);
    }
  }
  return failures;
}

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

    const hasExplicitEventPayload = Object.hasOwn(options, "eventPayload");
    let event = hasExplicitEventPayload ? options.eventPayload : undefined;
    if (!hasExplicitEventPayload && process.env.GITHUB_EVENT_PATH) {
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
              const content = task.taskContent;
              const govFailures = validateTaskDesignGovernance(
                content,
                task.relPath,
                {
                  mode: "implementation",
                  isPrBinding: true,
                  taskRecord: task.taskRecord,
                },
              );
              for (const gf of govFailures) {
                taskFailures.push(`${task.relPath}: ${gf}`);
              }

              // Plan, reuse and immutable snapshot binding are sufficient.
              // No GitHub owner approval/comment is required for implementation.
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
          const failures = validateStructuralTaskFile(
            rootDir,
            "docs/tasks/active/" + entry.name,
          );
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
            const content = task.taskContent;
            const govFailures = validateTaskDesignGovernance(
              content,
              task.relPath,
              { mode: "structural", taskRecord: task.taskRecord },
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
            const failures = validateStructuralTaskFile(
              rootDir,
              "docs/tasks/active/" + entry.name,
            );
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
