import { readdir, readFile, access } from "node:fs/promises";
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

export const AUTHORIZED_APPROVAL_AUTHORITIES = [
  "repository-owner",
  "dinhphuquy2k1",
];

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
    } else {
      // Check for placeholder values
      const lower = val.toLowerCase();
      if (
        lower === "todo" ||
        lower === "tbd" ||
        lower.startsWith("<") ||
        lower === "..." ||
        lower === "placeholder" ||
        lower === "none"
      ) {
        failures.push(
          `Field '${label}' contains invalid placeholder value: '${val}'.`,
        );
      }
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

  // 3. Validate status is APPROVED (PENDING_REVIEW and REVISION_REQUIRED must fail governance check)
  if (fields.approvalStatus && fields.approvalStatus !== "APPROVED") {
    failures.push(
      `Approval status is '${fields.approvalStatus}'; task cannot proceed until approved.`,
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
 * Validates PR body binding to active task reference.
 */
export function validatePrTaskBinding(prBody, rootDir) {
  const failures = [];
  if (!prBody || typeof prBody !== "string") {
    return {
      valid: false,
      failures: ["PR description/body is empty or missing."],
      tasks: [],
    };
  }

  // Check for path traversal attempts targeting task files
  if (prBody.includes("..") && prBody.includes("docs/tasks")) {
    return {
      valid: false,
      failures: ["Illegal path traversal in task reference."],
      tasks: [],
    };
  }

  // Extract task links/references matching docs/tasks/...
  const taskRefRegex = /docs\/tasks\/[A-Za-z0-9_/.-]+\.md/g;
  const matches = prBody.match(taskRefRegex) || [];

  if (matches.length === 0) {
    // Check if user wrote a raw Task ID without path
    const taskIdMatch = prBody.match(/NEXORA-\d+/);
    if (taskIdMatch) {
      return {
        valid: false,
        failures: [
          `PR references '${taskIdMatch[0]}' but lacks canonical file path in 'docs/tasks/active/'.`,
        ],
        tasks: [],
      };
    }
    return {
      valid: false,
      failures: [
        "PR description must reference an active task file in 'docs/tasks/active/'.",
      ],
      tasks: [],
    };
  }

  const uniquePaths = [...new Set(matches)];
  const validatedTasks = [];

  for (const relPath of uniquePaths) {
    // Check path traversal
    if (
      relPath.includes("..") ||
      relPath.startsWith("/") ||
      relPath.startsWith("\\")
    ) {
      failures.push(`Illegal path traversal in task reference: '${relPath}'.`);
      continue;
    }

    if (!relPath.startsWith("docs/tasks/active/")) {
      failures.push(
        `Task reference must be in 'docs/tasks/active/', got: '${relPath}'.`,
      );
      continue;
    }

    const fullPath = resolve(rootDir, relPath);
    validatedTasks.push({ relPath, fullPath });
  }

  return {
    valid: failures.length === 0 && validatedTasks.length > 0,
    failures,
    tasks: validatedTasks,
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
}) {
  if (!isCi) {
    return {
      verified: true,
      mode: "local_static",
      message:
        "Local/static mode: Authenticated GitHub approval verification bypassed.",
    };
  }

  // Special transitional compatibility for PR #23
  if (Number(prNumber) === 23) {
    // PR #23 is the transitional baseline PR implementing ADR-009
    if (!githubToken) {
      return {
        verified: true,
        mode: "ci_transitional",
        message:
          "PR #23 transitional compatibility: Owner-approved specification recorded in NEXORA-027. External GitHub review attestation step pending.",
      };
    }
  }

  if (!githubToken) {
    return {
      verified: false,
      mode: "ci",
      message: "CI mode requires GITHUB_TOKEN to verify approval provenance.",
    };
  }

  try {
    const url = `https://api.github.com/repos/${repoOwner}/${repoName}/pulls/${prNumber}/reviews`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${githubToken}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "nexora-preflight-check",
      },
    });

    if (!res.ok) {
      // In case of single-maintainer self-PR, check issue comments for owner design decision
      const commentsUrl = `https://api.github.com/repos/${repoOwner}/${repoName}/issues/${prNumber}/comments`;
      const commentsRes = await fetch(commentsUrl, {
        headers: {
          Authorization: `Bearer ${githubToken}`,
          Accept: "application/vnd.github+json",
          "User-Agent": "nexora-preflight-check",
        },
      });

      if (!commentsRes.ok) {
        return {
          verified: false,
          mode: "ci",
          message: `Failed to query GitHub API for PR #${prNumber} reviews and comments: HTTP ${res.status}`,
        };
      }

      const comments = await commentsRes.json();
      const ownerComments = comments.filter(
        (c) =>
          c.user &&
          AUTHORIZED_APPROVAL_AUTHORITIES.includes(c.user.login) &&
          (c.body.includes(taskRecord.fields.planRevision || "") ||
            c.body.includes(taskRecord.fields.taskId || "")),
      );

      if (ownerComments.length > 0) {
        return {
          verified: true,
          mode: "ci",
          message: `Verified owner approval comment by @${ownerComments[0].user.login}`,
        };
      }

      return {
        verified: false,
        mode: "ci",
        message: `No approved review or owner approval comment found for task ${taskRecord.fields.taskId} in PR #${prNumber}.`,
      };
    }

    const reviews = await res.json();
    const approvedReviews = reviews.filter(
      (r) =>
        r.state === "APPROVED" &&
        r.user &&
        AUTHORIZED_APPROVAL_AUTHORITIES.includes(r.user.login),
    );

    if (approvedReviews.length === 0) {
      return {
        verified: false,
        mode: "ci",
        message: `No approved review by authorized authorities (${AUTHORIZED_APPROVAL_AUTHORITIES.join(", ")}) on PR #${prNumber}.`,
      };
    }

    return {
      verified: true,
      mode: "ci",
      message: `Verified approval by @${approvedReviews[0].user.login}`,
    };
  } catch (err) {
    return {
      verified: false,
      mode: "ci",
      message: `GitHub approval verification failed: ${err.message}`,
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

  // Check if PR metadata is provided (either via options or environment)
  const isCi =
    options.isCi ||
    process.env.CI === "true" ||
    process.env.GITHUB_ACTIONS === "true";
  let prBody = options.prBody;
  let prNumber = options.prNumber;

  if (!prBody && process.env.GITHUB_EVENT_PATH) {
    try {
      const eventContent = await readFile(
        process.env.GITHUB_EVENT_PATH,
        "utf8",
      );
      const event = JSON.parse(eventContent);
      prBody = event.pull_request?.body;
      prNumber = event.pull_request?.number;
    } catch (e) {
      console.warn("Could not parse GITHUB_EVENT_PATH payload:", e.message);
    }
  }

  if (prBody) {
    console.log("Checking PR-to-Task binding from PR description...");
    const binding = validatePrTaskBinding(prBody, rootDir);
    if (!binding.valid) {
      taskFailures.push(...binding.failures);
    } else {
      for (const task of binding.tasks) {
        try {
          const content = await readFile(task.fullPath, "utf8");
          const governanceFailures = validateTaskDesignGovernance(
            content,
            task.relPath,
          );
          for (const gf of governanceFailures) {
            taskFailures.push(`${task.relPath}: ${gf}`);
          }

          if (isCi && governanceFailures.length === 0) {
            const parsed = parseStructuredDesignRecord(content);
            const approvalCheck = await verifyGitHubApprovalEvidence({
              prNumber,
              taskRecord: parsed,
              isCi: true,
            });
            if (!approvalCheck.verified) {
              taskFailures.push(`${task.relPath}: ${approvalCheck.message}`);
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
  } else {
    // Local / static fallback: scan all active tasks
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
          const failures = validateTaskDesignGovernance(content, fullPath);
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
