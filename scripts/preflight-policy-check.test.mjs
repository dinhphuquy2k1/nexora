import { test } from "node:test";
import assert from "node:assert/strict";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import {
  checkDuplicateValidationGuards,
  parseStructuredDesignRecord,
  validateTaskDesignGovernance,
  parseApprovalDecisionBlock,
  parsePrPreflightBlock,
  validatePrTaskBinding,
  verifyGitHubApprovalEvidence,
  validateCopilotInstructions,
  validateAgentSkills,
  validateSkillEffectivenessFixtures,
  scanDuplicateGuards,
  EXPECTED_SKILL_SCENARIOS,
  runPreflightCheck,
  AUTHORIZED_APPROVAL_AUTHORITIES,
} from "./preflight-policy-check.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function createMockFetch({ reviews = [], comments = [], status = 200 } = {}) {
  return async (url) => {
    if (status !== 200) {
      return {
        ok: false,
        status,
        json: async () => ({ message: "API Error" }),
      };
    }
    if (url.includes("/reviews")) {
      return {
        ok: true,
        status: 200,
        json: async () => reviews,
      };
    }
    if (url.includes("/comments")) {
      return {
        ok: true,
        status: 200,
        json: async () => comments,
      };
    }
    return {
      ok: false,
      status: 404,
      json: async () => ({ message: "Not found" }),
    };
  };
}

// ============================================================================
// Duplicate Validation Guards
// ============================================================================

test("duplicate guards: pass on valid canonical module declarations and ignore test files", () => {
  const canonicalUuid = `
    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    export function isUuid(value: unknown): value is string { return true; }
  `;
  const failuresUuid = checkDuplicateValidationGuards(
    "apps/api/src/common/validation/uuid.ts",
    canonicalUuid,
  );
  assert.equal(failuresUuid.length, 0);

  const testFile = `const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;`;
  const failuresTest = checkDuplicateValidationGuards(
    "apps/api/test/sample.test.ts",
    testFile,
  );
  assert.equal(failuresTest.length, 0);
});

test("duplicate guards: negative tests prove reintroduction of duplicate logic fails", () => {
  const duplicateUuid = `const myUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;`;
  const failuresUuid = checkDuplicateValidationGuards(
    "apps/api/src/carrier/application/carrier.service.ts",
    duplicateUuid,
  );
  assert.equal(failuresUuid.length, 1);
  assert.match(failuresUuid[0], /Duplicate UUID regex pattern detected/);

  const duplicateHex = `const tokenRegex = /^[a-f0-9]{64}$/;`;
  const failuresHex = checkDuplicateValidationGuards(
    "apps/api/src/identity/presentation/auth.controller.ts",
    duplicateHex,
  );
  assert.equal(failuresHex.length, 1);
  assert.match(
    failuresHex[0],
    /Duplicate lowercase hex64 regex pattern detected/,
  );

  const duplicatePhone = `import { parsePhoneNumber } from "libphonenumber-js";`;
  const failuresPhone = checkDuplicateValidationGuards(
    "apps/api/src/customer/domain/customer.value-objects.ts",
    duplicatePhone,
  );
  assert.equal(failuresPhone.length, 1);
  assert.match(failuresPhone[0], /Direct libphonenumber-js import detected/);

  const duplicateCountry = `import { isValid } from "i18n-iso-countries";`;
  const failuresCountry = checkDuplicateValidationGuards(
    "apps/api/src/customer/domain/customer.value-objects.ts",
    duplicateCountry,
  );
  assert.equal(failuresCountry.length, 1);
  assert.match(failuresCountry[0], /Direct i18n-iso-countries import detected/);
});

test("duplicate guards: entire active apps/api/src tree is clean of unauthorized duplicates", async () => {
  const failures = await scanDuplicateGuards(root);
  assert.deepEqual(
    failures,
    [],
    `Expected 0 duplicate validation guard violations in current repository, got:\n${failures.join("\n")}`,
  );
});

// ============================================================================
// Structured Design Record Parser
// ============================================================================

test("structured design record parser: accurately extracts fields and rejects malformed records", () => {
  const validSection = `
## Design Review & Reuse Decision

- **Task ID**: NEXORA-027
- **Classification**: SIGNIFICANT
- **Plan revision**: rev-2026-10-21-v1
- **Reviewed baseline**: 42833752f76948aae7f1fad378291eedd288557b
- **Approval authority**: repository-owner
- **Approval status**: APPROVED
- **Approval evidence**: Owner architectural specification directive for PR #23
  `;
  const parsed = parseStructuredDesignRecord(validSection);
  assert.equal(parsed.exists, true);
  assert.equal(parsed.failures.length, 0);
  assert.equal(parsed.fields.taskId, "NEXORA-027");
  assert.equal(parsed.fields.approvalStatus, "APPROVED");

  const missingSection = parseStructuredDesignRecord("# Some other task");
  assert.equal(missingSection.exists, false);

  const duplicateStatus = `
## Design Review & Reuse Decision
- **Task ID**: NEXORA-027
- **Classification**: SIGNIFICANT
- **Plan revision**: rev-1
- **Reviewed baseline**: 42833752f76948aae7f1fad378291eedd288557b
- **Approval authority**: repository-owner
- **Approval status**: PENDING_REVIEW
- **Approval status**: APPROVED
- **Approval evidence**: Direct review directive
  `;
  const parsedDup = parseStructuredDesignRecord(duplicateStatus);
  assert.ok(
    parsedDup.failures.some((f) => f.includes("Duplicate Approval status")),
  );

  const placeholder = `
## Design Review & Reuse Decision
- **Task ID**: NEXORA-027
- **Classification**: SIGNIFICANT
- **Plan revision**: TODO
- **Reviewed baseline**: <sha>
- **Approval authority**: TBD
- **Approval status**: APPROVED
- **Approval evidence**: ...
  `;
  const parsedPlaceholder = parseStructuredDesignRecord(placeholder);
  assert.ok(
    parsedPlaceholder.failures.some((f) => f.includes("placeholder value")),
  );
});

// ============================================================================
// Task Design Governance: Structural vs Implementation Modes
// ============================================================================

test("task governance: distinguishes structural validation from implementation approval enforcement", () => {
  const validReuseMatrix = `
| Component | Existing implementations | Domain owner | Reuse alternatives | Selected approach | Rationale | Risks | Verification |
| isUuid | customer.input.ts | Common | Extract | Extract | Simplicity | None | Unit tests |
  `;

  const pendingTask = `
# Task
Documentation Impact: REQUIRED
## Design Review & Reuse Decision
- **Task ID**: NEXORA-027
- **Classification**: BOUNDED
- **Plan revision**: rev-1
- **Reviewed baseline**: 42833752f76948aae7f1fad378291eedd288557b
- **Approval authority**: repository-owner
- **Approval status**: PENDING_REVIEW
- **Approval evidence**: Direct directive
${validReuseMatrix}
  `;

  // 1. Structural mode: PENDING_REVIEW passes if structurally sound
  const structuralPending = validateTaskDesignGovernance(
    pendingTask,
    "docs/tasks/active/NEXORA-027-test.md",
    { mode: "structural" },
  );
  assert.equal(
    structuralPending.length,
    0,
    `Expected PENDING_REVIEW to pass structural validation, got: ${structuralPending.join(", ")}`,
  );

  // 2. Structural mode: REVISION_REQUIRED passes if structurally sound
  const revisionTask = pendingTask.replace(
    "PENDING_REVIEW",
    "REVISION_REQUIRED",
  );
  const structuralRevision = validateTaskDesignGovernance(
    revisionTask,
    "docs/tasks/active/NEXORA-027-test.md",
    { mode: "structural" },
  );
  assert.equal(
    structuralRevision.length,
    0,
    `Expected REVISION_REQUIRED to pass structural validation, got: ${structuralRevision.join(", ")}`,
  );

  // 3. Structural mode: APPROVED passes
  const approvedTask = pendingTask.replace("PENDING_REVIEW", "APPROVED");
  const structuralApproved = validateTaskDesignGovernance(
    approvedTask,
    "docs/tasks/active/NEXORA-027-test.md",
    { mode: "structural" },
  );
  assert.equal(structuralApproved.length, 0);

  // 4. Implementation mode: PENDING_REVIEW must FAIL
  const implPending = validateTaskDesignGovernance(
    pendingTask,
    "docs/tasks/active/NEXORA-027-test.md",
    { mode: "implementation" },
  );
  assert.ok(
    implPending.some((f) => f.includes("Approval status is 'PENDING_REVIEW'")),
  );

  // 5. Implementation mode: REVISION_REQUIRED must FAIL
  const implRevision = validateTaskDesignGovernance(
    revisionTask,
    "docs/tasks/active/NEXORA-027-test.md",
    { mode: "implementation" },
  );
  assert.ok(
    implRevision.some((f) =>
      f.includes("Approval status is 'REVISION_REQUIRED'"),
    ),
  );

  // 6. Implementation mode: APPROVED passes task governance
  const implApproved = validateTaskDesignGovernance(
    approvedTask,
    "docs/tasks/active/NEXORA-027-test.md",
    { mode: "implementation" },
  );
  assert.equal(implApproved.length, 0);

  // 7. Structural failure (e.g. missing matrix) fails in both modes
  const missingMatrixTask = `
# Task
Documentation Impact: REQUIRED
## Design Review & Reuse Decision
- **Task ID**: NEXORA-027
- **Classification**: BOUNDED
- **Plan revision**: rev-1
- **Reviewed baseline**: 42833752f76948aae7f1fad378291eedd288557b
- **Approval authority**: repository-owner
- **Approval status**: APPROVED
- **Approval evidence**: Direct directive
Reuse alternatives were considered.
  `;
  const structMatrixFail = validateTaskDesignGovernance(
    missingMatrixTask,
    "docs/tasks/active/NEXORA-027-test.md",
    { mode: "structural" },
  );
  assert.ok(
    structMatrixFail.some((f) =>
      f.includes("Incomplete Reuse & Design Audit Matrix"),
    ),
  );
  const implMatrixFail = validateTaskDesignGovernance(
    missingMatrixTask,
    "docs/tasks/active/NEXORA-027-test.md",
    { mode: "implementation" },
  );
  assert.ok(
    implMatrixFail.some((f) =>
      f.includes("Incomplete Reuse & Design Audit Matrix"),
    ),
  );
});

test("task governance grandfathering: completed tasks exempt, old active task with unapproved amendment fails, task ID < 27 cannot bypass PR governance", () => {
  // 1. Completed historical task is exempt
  const completedFailures = validateTaskDesignGovernance(
    "# Old Completed Task\nNo section here",
    "docs/tasks/completed/NEXORA-001-foundation.md",
  );
  assert.equal(completedFailures.length, 0);

  // 2. Old active task without design section in unrelated static scan is untouched
  const untouchedOldTaskFailures = validateTaskDesignGovernance(
    "# Old Active Task\nDocumentation Impact: NONE\nNo design section",
    "docs/tasks/active/NEXORA-003-engineering-workflow.md",
    { mode: "structural" },
  );
  assert.equal(untouchedOldTaskFailures.length, 0);

  // 3. Old active task referenced by a PR without design section FAILS (no < 27 bypass!)
  const prBoundOldTaskFailures = validateTaskDesignGovernance(
    "# Old Active Task\nDocumentation Impact: NONE\nNo design section",
    "docs/tasks/active/NEXORA-003-engineering-workflow.md",
    { mode: "implementation" },
  );
  assert.ok(
    prBoundOldTaskFailures.some((f) =>
      f.includes(
        "Missing required '## Design Review & Reuse Decision' section",
      ),
    ),
  );

  // 4. Old active task with unapproved PENDING_REVIEW amendment fails in implementation mode
  const validReuseMatrix = `
| Component | Existing implementations | Domain owner | Reuse alternatives | Selected approach | Rationale | Risks | Verification |
| isUuid | customer.input.ts | Common | Extract | Extract | Simplicity | None | Unit tests |
  `;
  const unapprovedOldAmendment = `
# Task NEXORA-012
Documentation Impact: REQUIRED
## Design Review & Reuse Decision
- **Task ID**: NEXORA-012
- **Classification**: BOUNDED
- **Plan revision**: rev-new
- **Reviewed baseline**: abc
- **Approval authority**: repository-owner
- **Approval status**: PENDING_REVIEW
- **Approval evidence**: Direct directive
${validReuseMatrix}
  `;
  const unapprovedFailures = validateTaskDesignGovernance(
    unapprovedOldAmendment,
    "docs/tasks/active/NEXORA-012-admin-staff-management.md",
    { mode: "implementation" },
  );
  assert.ok(
    unapprovedFailures.some((f) =>
      f.includes("Approval status is 'PENDING_REVIEW'"),
    ),
  );

  // 5. Old active task with properly approved revision PASSES
  const approvedOldAmendment = unapprovedOldAmendment.replace(
    "PENDING_REVIEW",
    "APPROVED",
  );
  const approvedFailures = validateTaskDesignGovernance(
    approvedOldAmendment,
    "docs/tasks/active/NEXORA-012-admin-staff-management.md",
    { mode: "implementation" },
  );
  assert.equal(approvedFailures.length, 0);
});

// ============================================================================
// Machine-readable Approval Decision Block Parser
// ============================================================================

test("parseApprovalDecisionBlock: strictly enforces mandatory header, single block, unique fields, and rejects prose/quotes/code blocks", () => {
  // 1. Valid canonical block
  const block = `
NEXORA DESIGN APPROVAL
Task: NEXORA-027
Plan revision: rev-2026-10-21-reuse-v2
Decision: APPROVED
  `;
  const parsed = parseApprovalDecisionBlock(block);
  assert.deepEqual(parsed, {
    taskId: "NEXORA-027",
    planRevision: "rev-2026-10-21-reuse-v2",
    decision: "APPROVED",
  });

  // 2. Valid CRLF formatting
  const crlfBlock =
    "NEXORA DESIGN APPROVAL\r\nTask: NEXORA-027\r\nPlan revision: rev-2026-10-21-reuse-v2\r\nDecision: APPROVED\r\n";
  assert.deepEqual(parseApprovalDecisionBlock(crlfBlock), {
    taskId: "NEXORA-027",
    planRevision: "rev-2026-10-21-reuse-v2",
    decision: "APPROVED",
  });

  // 3. Valid REVISION_REQUIRED and REVOKED
  const revReqBlock = `
NEXORA DESIGN APPROVAL
Task: NEXORA-027
Plan revision: rev-2026-10-21-reuse-v2
Decision: REVISION_REQUIRED
  `;
  assert.equal(
    parseApprovalDecisionBlock(revReqBlock)?.decision,
    "REVISION_REQUIRED",
  );

  const revokedBlock = `
NEXORA DESIGN APPROVAL
Task: NEXORA-027
Plan revision: rev-2026-10-21-reuse-v2
Decision: REVOKED
  `;
  assert.equal(parseApprovalDecisionBlock(revokedBlock)?.decision, "REVOKED");

  // 4. Missing header -> FAIL
  const missingHeader = `
Task: NEXORA-027
Plan revision: rev-2026-10-21-reuse-v2
Decision: APPROVED
  `;
  assert.equal(parseApprovalDecisionBlock(missingHeader), null);

  // 5. Wrong header -> FAIL
  const wrongHeader = `
DESIGN APPROVAL
Task: NEXORA-027
Plan revision: rev-2026-10-21-reuse-v2
Decision: APPROVED
  `;
  assert.equal(parseApprovalDecisionBlock(wrongHeader), null);

  // 6. Missing Task -> FAIL
  const missingTask = `
NEXORA DESIGN APPROVAL
Plan revision: rev-2026-10-21-reuse-v2
Decision: APPROVED
  `;
  assert.equal(parseApprovalDecisionBlock(missingTask), null);

  // 7. Missing Plan revision -> FAIL
  const missingPlan = `
NEXORA DESIGN APPROVAL
Task: NEXORA-027
Decision: APPROVED
  `;
  assert.equal(parseApprovalDecisionBlock(missingPlan), null);

  // 8. Missing Decision -> FAIL
  const missingDecision = `
NEXORA DESIGN APPROVAL
Task: NEXORA-027
Plan revision: rev-2026-10-21-reuse-v2
  `;
  assert.equal(parseApprovalDecisionBlock(missingDecision), null);

  // 9. Duplicate Task declaration -> FAIL
  const duplicateTask = `
NEXORA DESIGN APPROVAL
Task: NEXORA-027
Task: NEXORA-028
Plan revision: rev-2026-10-21-reuse-v2
Decision: APPROVED
  `;
  assert.equal(parseApprovalDecisionBlock(duplicateTask), null);

  // 10. Duplicate Plan revision -> FAIL
  const duplicatePlan = `
NEXORA DESIGN APPROVAL
Task: NEXORA-027
Plan revision: rev-1
Plan revision: rev-2
Decision: APPROVED
  `;
  assert.equal(parseApprovalDecisionBlock(duplicatePlan), null);

  // 11. Duplicate or conflicting Decision -> FAIL
  const duplicateDecision = `
NEXORA DESIGN APPROVAL
Task: NEXORA-027
Plan revision: rev-2026-10-21-reuse-v2
Decision: APPROVED
Decision: REVISION_REQUIRED
  `;
  assert.equal(parseApprovalDecisionBlock(duplicateDecision), null);

  // 12. Unknown Decision value -> FAIL
  const unknownDecision = `
NEXORA DESIGN APPROVAL
Task: NEXORA-027
Plan revision: rev-2026-10-21-reuse-v2
Decision: MAYBE_APPROVED
  `;
  assert.equal(parseApprovalDecisionBlock(unknownDecision), null);

  // 13. Quoted comment (lines starting with '>') -> FAIL
  const quoted = `
> NEXORA DESIGN APPROVAL
> Task: NEXORA-027
> Plan revision: rev-2026-10-21-reuse-v2
> Decision: APPROVED
This is not approved yet.
  `;
  assert.equal(parseApprovalDecisionBlock(quoted), null);

  // 14. Fenced code block (``` or ~~~) -> FAIL
  const fencedCode = `
Here is an example:
\`\`\`text
NEXORA DESIGN APPROVAL
Task: NEXORA-027
Plan revision: rev-2026-10-21-reuse-v2
Decision: APPROVED
\`\`\`
  `;
  assert.equal(parseApprovalDecisionBlock(fencedCode), null);

  // 15. Prose only -> FAIL
  const prose =
    "NEXORA DESIGN APPROVAL: Task NEXORA-027 plan revision rev-2026-10-21-reuse-v2 decision APPROVED.";
  assert.equal(parseApprovalDecisionBlock(prose), null);

  // 16. Multiple formal decision blocks -> FAIL
  const multipleBlocks = `
NEXORA DESIGN APPROVAL
Task: NEXORA-027
Plan revision: rev-2026-10-21-reuse-v2
Decision: APPROVED

NEXORA DESIGN APPROVAL
Task: NEXORA-028
Plan revision: rev-2026-10-21-reuse-v2
Decision: REVISION_REQUIRED
  `;
  assert.equal(parseApprovalDecisionBlock(multipleBlocks), null);
});

test("parsePrPreflightBlock: parses canonical PR fields and validates authorized logins", () => {
  const prBody = `
## Pull Request Preflight

- **Task ID**: NEXORA-027
- **Task Reference**: [NEXORA-027](docs/tasks/active/NEXORA-027-customer-management-backend.md)
- **Plan revision**: rev-2026-10-21-reuse-v2
  `;
  const parsed = parsePrPreflightBlock(prBody);
  assert.equal(parsed.exists, true);
  assert.equal(parsed.fields.taskId, "NEXORA-027");
  assert.equal(
    parsed.fields.taskReference,
    "docs/tasks/active/NEXORA-027-customer-management-backend.md",
  );
  assert.equal(parsed.fields.planRevision, "rev-2026-10-21-reuse-v2");

  // Authorized approvers must only contain real verified GitHub logins
  assert.ok(AUTHORIZED_APPROVAL_AUTHORITIES.includes("dinhphuquy2k1"));
  // repository-owner is a conceptual role, not a GitHub login
  assert.equal(
    AUTHORIZED_APPROVAL_AUTHORITIES.includes("repository-owner"),
    false,
  );
});

// ============================================================================
// PR-to-Task & Plan Revision Binding
// ============================================================================

test("PR-to-task binding: validates canonical metadata block, allows ellipses in PR body, and restricts traversal checks to taskReference", () => {
  const validPrBody = `
## Pull Request Preflight

- **Task ID**: NEXORA-027
- **Task Reference**: docs/tasks/active/NEXORA-027-customer-management-backend.md
- **Plan revision**: rev-2026-10-21-reuse-v2

### Description
This PR addresses several key improvements...
More details follow below.
Referencing previous changes at ../../docs/other.md for context.
  `;
  const validBinding = validatePrTaskBinding(validPrBody, root);
  assert.equal(
    validBinding.valid,
    true,
    `Expected valid PR binding even with ellipses or unrelated ../ in prose, got: ${validBinding.failures.join(", ")}`,
  );
  assert.equal(validBinding.tasks.length, 1);
  assert.equal(
    validBinding.tasks[0].relPath,
    "docs/tasks/active/NEXORA-027-customer-management-backend.md",
  );
  assert.equal(validBinding.tasks[0].taskId, "NEXORA-027");
  assert.equal(validBinding.tasks[0].planRevision, "rev-2026-10-21-reuse-v2");

  // Empty PR body
  const emptyBinding = validatePrTaskBinding("", root);
  assert.equal(emptyBinding.valid, false);
  assert.ok(emptyBinding.failures.some((f) => f.includes("empty or missing")));

  // Missing Task ID
  const noTaskIdPr = `
- **Task Reference**: docs/tasks/active/NEXORA-027-customer-management-backend.md
- **Plan revision**: rev-2026-10-21-reuse-v2
  `;
  const noTaskIdBinding = validatePrTaskBinding(noTaskIdPr, root);
  assert.equal(noTaskIdBinding.valid, false);
  assert.ok(
    noTaskIdBinding.failures.some((f) =>
      f.includes("missing required 'Task ID'"),
    ),
  );

  // Missing Plan revision
  const noPlanRevPr = `
- **Task ID**: NEXORA-027
- **Task Reference**: docs/tasks/active/NEXORA-027-customer-management-backend.md
  `;
  const noPlanRevBinding = validatePrTaskBinding(noPlanRevPr, root);
  assert.equal(noPlanRevBinding.valid, false);
  assert.ok(
    noPlanRevBinding.failures.some((f) =>
      f.includes("missing required 'Plan revision'"),
    ),
  );

  // Filename Task ID mismatch
  const filenameMismatchPr = `
- **Task ID**: NEXORA-099
- **Task Reference**: docs/tasks/active/NEXORA-027-customer-management-backend.md
- **Plan revision**: rev-2026-10-21-reuse-v2
  `;
  const filenameMismatchBinding = validatePrTaskBinding(
    filenameMismatchPr,
    root,
  );
  assert.equal(filenameMismatchBinding.valid, false);
  assert.ok(
    filenameMismatchBinding.failures.some((f) =>
      f.includes("PR Task ID mismatch"),
    ),
  );

  // Plan revision mismatch against task record
  const planMismatchPr = `
- **Task ID**: NEXORA-027
- **Task Reference**: docs/tasks/active/NEXORA-027-customer-management-backend.md
- **Plan revision**: rev-nonexistent-revision
  `;
  const planMismatchBinding = validatePrTaskBinding(planMismatchPr, root);
  assert.equal(planMismatchBinding.valid, false);
  assert.ok(
    planMismatchBinding.failures.some((f) =>
      f.includes("Plan revision mismatch"),
    ),
  );

  // Task reference containing path traversal rejected
  const traversalBinding = validatePrTaskBinding(
    `
- **Task ID**: NEXORA-027
- **Task Reference**: docs/tasks/active/../../etc/passwd.md
- **Plan revision**: rev-2026-10-21-reuse-v2
    `,
    root,
  );
  assert.equal(traversalBinding.valid, false);
  assert.ok(
    traversalBinding.failures.some((f) => f.includes("path traversal")),
  );

  // Absolute path in task reference rejected
  const absoluteBinding = validatePrTaskBinding(
    `
- **Task ID**: NEXORA-027
- **Task Reference**: /docs/tasks/active/NEXORA-027-customer-management-backend.md
- **Plan revision**: rev-2026-10-21-reuse-v2
    `,
    root,
  );
  assert.equal(absoluteBinding.valid, false);
  assert.ok(absoluteBinding.failures.some((f) => f.includes("path traversal")));

  // External URL in task reference rejected
  const urlBinding = validatePrTaskBinding(
    `
- **Task ID**: NEXORA-027
- **Task Reference**: https://example.com/fake-task.md
- **Plan revision**: rev-2026-10-21-reuse-v2
    `,
    root,
  );
  assert.equal(urlBinding.valid, false);
  assert.ok(
    urlBinding.failures.some((f) =>
      f.includes("must be in 'docs/tasks/active/'"),
    ),
  );

  // Pointing to completed directory rejected
  const completedBinding = validatePrTaskBinding(
    `
- **Task ID**: NEXORA-001
- **Task Reference**: docs/tasks/completed/NEXORA-001-foundation.md
- **Plan revision**: rev-1
    `,
    root,
  );
  assert.equal(completedBinding.valid, false);
  assert.ok(
    completedBinding.failures.some((f) =>
      f.includes("must be in 'docs/tasks/active/'"),
    ),
  );

  // Non-existent task file rejected
  const nonExistentBinding = validatePrTaskBinding(
    `
- **Task ID**: NEXORA-999
- **Task Reference**: docs/tasks/active/NEXORA-999-ghost.md
- **Plan revision**: rev-1
    `,
    root,
  );
  assert.equal(nonExistentBinding.valid, false);
  assert.ok(
    nonExistentBinding.failures.some((f) => f.includes("does not exist")),
  );

  // Conflicting multiple task references rejected
  const conflictingBinding = validatePrTaskBinding(
    `
- **Task ID**: NEXORA-027
- **Task Reference**: docs/tasks/active/NEXORA-027-customer-management-backend.md
- **Plan revision**: rev-2026-10-21-reuse-v2
- **Task Reference**: docs/tasks/active/NEXORA-003-engineering-workflow.md
    `,
    root,
  );
  assert.equal(conflictingBinding.valid, false);
  assert.ok(
    conflictingBinding.failures.some((f) =>
      f.includes("Conflicting Task Reference declarations"),
    ),
  );

  // Valid Markdown link pointing to canonical task passes
  const markdownLinkBinding = validatePrTaskBinding(
    `
- **Task ID**: NEXORA-027
- **Task Reference**: [NEXORA-027](docs/tasks/active/NEXORA-027-customer-management-backend.md)
- **Plan revision**: rev-2026-10-21-reuse-v2
    `,
    root,
  );
  assert.equal(markdownLinkBinding.valid, true);
  assert.equal(markdownLinkBinding.tasks.length, 1);
  assert.equal(
    markdownLinkBinding.tasks[0].relPath,
    "docs/tasks/active/NEXORA-027-customer-management-backend.md",
  );
});

// ============================================================================
// GitHub CI Approval Verification: Identity & Review States
// ============================================================================

test("verifyGitHubApprovalEvidence: enforces authorized real GitHub logins and rejects role names", async () => {
  const taskRecord = {
    fields: {
      taskId: "NEXORA-027",
      planRevision: "rev-2026-10-21-reuse-v2",
      approvalStatus: "APPROVED",
    },
  };

  const validCommentBody = `NEXORA DESIGN APPROVAL\nTask: NEXORA-027\nPlan revision: rev-2026-10-21-reuse-v2\nDecision: APPROVED`;

  // 1. dinhphuquy2k1 + valid owner approval -> PASS
  const validResult = await verifyGitHubApprovalEvidence({
    prNumber: 23,
    taskRecord,
    isCi: true,
    githubToken: "mock-token",
    fetchFn: createMockFetch({
      reviews: [],
      comments: [
        {
          user: { login: "dinhphuquy2k1", type: "User" },
          created_at: "2026-10-21T12:00:00Z",
          body: validCommentBody,
        },
      ],
    }),
  });
  assert.equal(validResult.approvalVerified, true);
  assert.match(
    validResult.message,
    /Verified design approval by @dinhphuquy2k1/,
  );

  // 2. Username "repository-owner" + valid block -> FAIL (role name is not an account)
  const roleNameResult = await verifyGitHubApprovalEvidence({
    prNumber: 23,
    taskRecord,
    isCi: true,
    githubToken: "mock-token",
    fetchFn: createMockFetch({
      reviews: [],
      comments: [
        {
          user: { login: "repository-owner", type: "User" },
          created_at: "2026-10-21T12:00:00Z",
          body: validCommentBody,
        },
      ],
    }),
  });
  assert.equal(roleNameResult.approvalVerified, false);

  // 3. Unknown GitHub username -> FAIL
  const unknownUserResult = await verifyGitHubApprovalEvidence({
    prNumber: 23,
    taskRecord,
    isCi: true,
    githubToken: "mock-token",
    fetchFn: createMockFetch({
      reviews: [],
      comments: [
        {
          user: { login: "random-unauthorized-user", type: "User" },
          created_at: "2026-10-21T12:00:00Z",
          body: validCommentBody,
        },
      ],
    }),
  });
  assert.equal(unknownUserResult.approvalVerified, false);

  // 4. Bot username -> FAIL
  const botResult = await verifyGitHubApprovalEvidence({
    prNumber: 23,
    taskRecord,
    isCi: true,
    githubToken: "mock-token",
    fetchFn: createMockFetch({
      reviews: [],
      comments: [
        {
          user: { login: "dinhphuquy2k1[bot]", type: "Bot" },
          created_at: "2026-10-21T12:00:00Z",
          body: validCommentBody,
        },
      ],
    }),
  });
  assert.equal(botResult.approvalVerified, false);

  // 5. Unauthorized reviewer with state APPROVED -> FAIL
  const unauthorizedReviewerResult = await verifyGitHubApprovalEvidence({
    prNumber: 23,
    taskRecord,
    isCi: true,
    githubToken: "mock-token",
    fetchFn: createMockFetch({
      reviews: [
        {
          user: { login: "unauthorized-contributor", type: "User" },
          state: "APPROVED",
          submitted_at: "2026-10-21T12:00:00Z",
          body: validCommentBody,
        },
      ],
      comments: [],
    }),
  });
  assert.equal(unauthorizedReviewerResult.approvalVerified, false);
});

test("verifyGitHubApprovalEvidence: enforces actual review state and chronological decision evaluation", async () => {
  const taskRecord = {
    fields: {
      taskId: "NEXORA-027",
      planRevision: "rev-2026-10-21-reuse-v2",
      approvalStatus: "APPROVED",
    },
  };

  const validBody = `NEXORA DESIGN APPROVAL\nTask: NEXORA-027\nPlan revision: rev-2026-10-21-reuse-v2\nDecision: APPROVED`;

  // 1. Authorized review with state APPROVED -> PASS
  const passReview = await verifyGitHubApprovalEvidence({
    prNumber: 23,
    taskRecord,
    isCi: true,
    githubToken: "mock-token",
    fetchFn: createMockFetch({
      reviews: [
        {
          user: { login: "dinhphuquy2k1", type: "User" },
          state: "APPROVED",
          submitted_at: "2026-10-21T12:00:00Z",
          body: validBody,
        },
      ],
      comments: [],
    }),
  });
  assert.equal(passReview.approvalVerified, true);
  assert.match(passReview.message, /via review/);

  // 2. Review with state COMMENTED + body Decision: APPROVED -> FAIL (COMMENTED cannot grant approval)
  const failCommented = await verifyGitHubApprovalEvidence({
    prNumber: 23,
    taskRecord,
    isCi: true,
    githubToken: "mock-token",
    fetchFn: createMockFetch({
      reviews: [
        {
          user: { login: "dinhphuquy2k1", type: "User" },
          state: "COMMENTED",
          submitted_at: "2026-10-21T12:00:00Z",
          body: validBody,
        },
      ],
      comments: [],
    }),
  });
  assert.equal(failCommented.approvalVerified, false);

  // 3. Review with state CHANGES_REQUESTED + body Decision: APPROVED -> FAIL
  const failChangesReq = await verifyGitHubApprovalEvidence({
    prNumber: 23,
    taskRecord,
    isCi: true,
    githubToken: "mock-token",
    fetchFn: createMockFetch({
      reviews: [
        {
          user: { login: "dinhphuquy2k1", type: "User" },
          state: "CHANGES_REQUESTED",
          submitted_at: "2026-10-21T12:00:00Z",
          body: validBody,
        },
      ],
      comments: [],
    }),
  });
  assert.equal(failChangesReq.approvalVerified, false);

  // 4. Review with state DISMISSED -> FAIL
  const failDismissed = await verifyGitHubApprovalEvidence({
    prNumber: 23,
    taskRecord,
    isCi: true,
    githubToken: "mock-token",
    fetchFn: createMockFetch({
      reviews: [
        {
          user: { login: "dinhphuquy2k1", type: "User" },
          state: "DISMISSED",
          submitted_at: "2026-10-21T12:00:00Z",
          body: validBody,
        },
      ],
      comments: [],
    }),
  });
  assert.equal(failDismissed.approvalVerified, false);

  // 5. Review with state PENDING -> FAIL
  const failPending = await verifyGitHubApprovalEvidence({
    prNumber: 23,
    taskRecord,
    isCi: true,
    githubToken: "mock-token",
    fetchFn: createMockFetch({
      reviews: [
        {
          user: { login: "dinhphuquy2k1", type: "User" },
          state: "PENDING",
          submitted_at: "2026-10-21T12:00:00Z",
          body: validBody,
        },
      ],
      comments: [],
    }),
  });
  assert.equal(failPending.approvalVerified, false);

  // 6. Generic APPROVED code review without formal block ("LGTM") -> FAIL as design evidence
  const failGeneric = await verifyGitHubApprovalEvidence({
    prNumber: 23,
    taskRecord,
    isCi: true,
    githubToken: "mock-token",
    fetchFn: createMockFetch({
      reviews: [
        {
          user: { login: "dinhphuquy2k1", type: "User" },
          state: "APPROVED",
          submitted_at: "2026-10-21T12:00:00Z",
          body: "LGTM! Approved to merge.",
        },
      ],
      comments: [],
    }),
  });
  assert.equal(failGeneric.approvalVerified, false);

  // 7. Empty reviews + valid owner issue comment -> PASS
  const passOwnerComment = await verifyGitHubApprovalEvidence({
    prNumber: 23,
    taskRecord,
    isCi: true,
    githubToken: "mock-token",
    fetchFn: createMockFetch({
      reviews: [],
      comments: [
        {
          user: { login: "dinhphuquy2k1", type: "User" },
          created_at: "2026-10-21T12:00:00Z",
          body: validBody,
        },
      ],
    }),
  });
  assert.equal(passOwnerComment.approvalVerified, true);
  assert.match(passOwnerComment.message, /via comment/);

  // 8. Older APPROVED + later authoritative REVISION_REQUIRED -> FAIL
  const failSuperseded = await verifyGitHubApprovalEvidence({
    prNumber: 23,
    taskRecord,
    isCi: true,
    githubToken: "mock-token",
    fetchFn: createMockFetch({
      reviews: [],
      comments: [
        {
          user: { login: "dinhphuquy2k1", type: "User" },
          created_at: "2026-10-21T10:00:00Z",
          body: validBody,
        },
        {
          user: { login: "dinhphuquy2k1", type: "User" },
          created_at: "2026-10-21T14:00:00Z",
          body: `NEXORA DESIGN APPROVAL\nTask: NEXORA-027\nPlan revision: rev-2026-10-21-reuse-v2\nDecision: REVISION_REQUIRED`,
        },
      ],
    }),
  });
  assert.equal(failSuperseded.approvalVerified, false);
  assert.match(failSuperseded.message, /REVISION_REQUIRED/);

  // 9. Later authorized APPROVED restores approval -> PASS
  const passRestored = await verifyGitHubApprovalEvidence({
    prNumber: 23,
    taskRecord,
    isCi: true,
    githubToken: "mock-token",
    fetchFn: createMockFetch({
      reviews: [],
      comments: [
        {
          user: { login: "dinhphuquy2k1", type: "User" },
          created_at: "2026-10-21T10:00:00Z",
          body: validBody,
        },
        {
          user: { login: "dinhphuquy2k1", type: "User" },
          created_at: "2026-10-21T12:00:00Z",
          body: `NEXORA DESIGN APPROVAL\nTask: NEXORA-027\nPlan revision: rev-2026-10-21-reuse-v2\nDecision: REVISION_REQUIRED`,
        },
        {
          user: { login: "dinhphuquy2k1", type: "User" },
          created_at: "2026-10-21T16:00:00Z",
          body: validBody,
        },
      ],
    }),
  });
  assert.equal(passRestored.approvalVerified, true);

  // 10. Missing / invalid timestamp fails closed
  const failInvalidTimestamp = await verifyGitHubApprovalEvidence({
    prNumber: 23,
    taskRecord,
    isCi: true,
    githubToken: "mock-token",
    fetchFn: createMockFetch({
      reviews: [],
      comments: [
        {
          user: { login: "dinhphuquy2k1", type: "User" },
          created_at: "invalid-date",
          body: validBody,
        },
      ],
    }),
  });
  assert.equal(failInvalidTimestamp.approvalVerified, false);
  assert.match(failInvalidTimestamp.message, /timestamp/i);
});

// ============================================================================
// Execution Context & CI Event Isolation (runPreflightCheck)
// ============================================================================

test("runPreflightCheck: PR CI mode fails closed on missing body, missing payload, or wrong repo; push and local modes use structural validation", async () => {
  // 1. Missing PR body in pull_request CI mode fails
  const missingBodyResult = await runPreflightCheck(root, {
    isCi: true,
    eventName: "pull_request",
    eventPayload: {
      pull_request: { number: 23, body: "" },
      repository: { full_name: "dinhphuquy2k1/nexora" },
    },
  });
  assert.equal(missingBodyResult.success, false);
  assert.ok(
    missingBodyResult.failures.some((f) =>
      f.includes("PR description/body is empty or missing"),
    ),
  );

  // 2. Missing event payload fails
  const missingPayloadResult = await runPreflightCheck(root, {
    isCi: true,
    eventName: "pull_request",
    eventPayload: null,
  });
  assert.equal(missingPayloadResult.success, false);
  assert.ok(
    missingPayloadResult.failures.some((f) =>
      f.includes("Missing GitHub event payload"),
    ),
  );

  // 3. Repository mismatch fails
  const repoMismatchResult = await runPreflightCheck(root, {
    isCi: true,
    eventName: "pull_request",
    eventPayload: {
      pull_request: {
        number: 23,
        body: "- **Task ID**: NEXORA-027\n- **Task Reference**: docs/tasks/active/NEXORA-027-customer-management-backend.md\n- **Plan revision**: rev-2026-10-21-reuse-v2",
      },
      repository: { full_name: "attacker/malicious-repo" },
    },
  });
  assert.equal(repoMismatchResult.success, false);
  assert.ok(
    repoMismatchResult.failures.some((f) =>
      f.includes("Event repository mismatch"),
    ),
  );

  // 4. Missing PR number fails
  const noPrNumberResult = await runPreflightCheck(root, {
    isCi: true,
    eventName: "pull_request",
    eventPayload: {
      pull_request: {
        body: "- **Task ID**: NEXORA-027\n- **Task Reference**: docs/tasks/active/NEXORA-027-customer-management-backend.md\n- **Plan revision**: rev-2026-10-21-reuse-v2",
      },
      repository: { full_name: "dinhphuquy2k1/nexora" },
    },
  });
  assert.equal(noPrNumberResult.success, false);
  assert.ok(
    noPrNumberResult.failures.some((f) =>
      f.includes("Missing or invalid PR number"),
    ),
  );

  // 5. Valid PR CI run with mocked owner approval succeeds
  const mockApprovedFetch = createMockFetch({
    comments: [
      {
        user: { login: "dinhphuquy2k1", type: "User" },
        created_at: "2026-10-21T12:00:00Z",
        body: `NEXORA DESIGN APPROVAL\nTask: NEXORA-027\nPlan revision: rev-2026-10-21-reuse-v2\nDecision: APPROVED`,
      },
    ],
  });
  const validCiResult = await runPreflightCheck(root, {
    isCi: true,
    eventName: "pull_request",
    eventPayload: {
      pull_request: {
        number: 23,
        body: `
## Pull Request Preflight
- **Task ID**: NEXORA-027
- **Task Reference**: docs/tasks/active/NEXORA-027-customer-management-backend.md
- **Plan revision**: rev-2026-10-21-reuse-v2
        `,
      },
      repository: { full_name: "dinhphuquy2k1/nexora" },
    },
    githubToken: "mock-token",
    fetchFn: mockApprovedFetch,
  });
  assert.equal(validCiResult.success, true);
  assert.deepEqual(validCiResult.failures, []);

  // 6. Push to main CI mode succeeds with static checks without PR body
  const pushMainResult = await runPreflightCheck(root, {
    isCi: true,
    eventName: "push",
  });
  assert.equal(pushMainResult.success, true);
  assert.deepEqual(pushMainResult.failures, []);

  // 7. Local mode succeeds without claiming GitHub approval
  const localResult = await runPreflightCheck(root, {
    isCi: false,
  });
  assert.equal(localResult.success, true);
  assert.deepEqual(localResult.failures, []);
});

// ============================================================================
// Copilot Instructions, Agent Skills & Scenarios
// ============================================================================

test("copilot instructions: backend.instructions.md has valid applyTo matching API ts files", async () => {
  const failures = await validateCopilotInstructions(root);
  assert.deepEqual(failures, []);
});

test("agent skills: portable relative links and metadata valid in .github/skills/", async () => {
  const failures = await validateAgentSkills(root);
  assert.deepEqual(failures, []);
});

test("skill scenario fixtures validate expected decisions", () => {
  const fixtureResult = validateSkillEffectivenessFixtures();
  assert.deepEqual(fixtureResult.failures, []);
  assert.equal(fixtureResult.agentBehavioralEvaluation, "NOT RUN");

  assert.equal(EXPECTED_SKILL_SCENARIOS.length, 10);
  const ids = EXPECTED_SKILL_SCENARIOS.map((s) => s.id);
  assert.equal(new Set(ids).size, 10);
});
