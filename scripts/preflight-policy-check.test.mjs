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
// Task Design Governance & Grandfathering
// ============================================================================

test("task governance: rejects PENDING_REVIEW, REVISION_REQUIRED, and loose Approved outside section", () => {
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
  const pendingFailures = validateTaskDesignGovernance(
    pendingTask,
    "docs/tasks/active/NEXORA-027-test.md",
    { isPrBinding: true },
  );
  assert.ok(
    pendingFailures.some((f) =>
      f.includes("Approval status is 'PENDING_REVIEW'"),
    ),
  );

  const revisionTask = pendingTask.replace(
    "PENDING_REVIEW",
    "REVISION_REQUIRED",
  );
  const revisionFailures = validateTaskDesignGovernance(
    revisionTask,
    "docs/tasks/active/NEXORA-027-test.md",
    { isPrBinding: true },
  );
  assert.ok(
    revisionFailures.some((f) =>
      f.includes("Approval status is 'REVISION_REQUIRED'"),
    ),
  );

  const trickTask = `
# Task
Documentation Impact: REQUIRED
The design is Approved by the team.
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
  const trickFailures = validateTaskDesignGovernance(
    trickTask,
    "docs/tasks/active/NEXORA-027-test.md",
    { isPrBinding: true },
  );
  assert.ok(
    trickFailures.some((f) =>
      f.includes("Approval status is 'PENDING_REVIEW'"),
    ),
  );

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
  const matrixFailures = validateTaskDesignGovernance(
    missingMatrixTask,
    "docs/tasks/active/NEXORA-027-test.md",
    { isPrBinding: true },
  );
  assert.ok(
    matrixFailures.some((f) =>
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
    { isPrBinding: false },
  );
  assert.equal(untouchedOldTaskFailures.length, 0);

  // 3. Old active task referenced by a PR without design section FAILS (no < 27 bypass!)
  const prBoundOldTaskFailures = validateTaskDesignGovernance(
    "# Old Active Task\nDocumentation Impact: NONE\nNo design section",
    "docs/tasks/active/NEXORA-003-engineering-workflow.md",
    { isPrBinding: true },
  );
  assert.ok(
    prBoundOldTaskFailures.some((f) =>
      f.includes(
        "Missing required '## Design Review & Reuse Decision' section",
      ),
    ),
  );

  // 4. Old active task with unapproved PENDING_REVIEW amendment fails
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
    { isPrBinding: true },
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
    { isPrBinding: true },
  );
  assert.equal(approvedFailures.length, 0);
});

// ============================================================================
// Machine-readable Approval Decision Block Parser
// ============================================================================

test("parseApprovalDecisionBlock: parses machine-readable decision block and rejects prose or quotes", () => {
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

  // Markdown bullet format
  const bulletBlock = `
- **Task ID**: NEXORA-027
- **Plan revision**: rev-2026-10-21-reuse-v2
- **Decision**: APPROVED
  `;
  assert.deepEqual(parseApprovalDecisionBlock(bulletBlock), {
    taskId: "NEXORA-027",
    planRevision: "rev-2026-10-21-reuse-v2",
    decision: "APPROVED",
  });

  // Quoted comment rejected
  const quoted = `
> NEXORA DESIGN APPROVAL
> Task: NEXORA-027
> Plan revision: rev-2026-10-21-reuse-v2
> Decision: APPROVED
This is not ready yet.
  `;
  assert.equal(parseApprovalDecisionBlock(quoted), null);

  // Prose only rejected
  const prose =
    "This task NEXORA-027 is approved for revision rev-2026-10-21-reuse-v2.";
  assert.equal(parseApprovalDecisionBlock(prose), null);

  // Missing plan revision rejected
  const missingPlan = `
Task: NEXORA-027
Decision: APPROVED
  `;
  assert.equal(parseApprovalDecisionBlock(missingPlan), null);

  // Missing decision rejected
  const missingDecision = `
Task: NEXORA-027
Plan revision: rev-1
  `;
  assert.equal(parseApprovalDecisionBlock(missingDecision), null);
});

test("parsePrPreflightBlock: parses canonical PR fields and validates authorities", () => {
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

  assert.ok(AUTHORIZED_APPROVAL_AUTHORITIES.includes("dinhphuquy2k1"));
  assert.ok(AUTHORIZED_APPROVAL_AUTHORITIES.includes("repository-owner"));
});

// ============================================================================
// PR-to-Task & Plan Revision Binding
// ============================================================================

test("PR-to-task binding: validates canonical metadata block and rejects mismatches/traversals", () => {
  const validPrBody = `
## Pull Request Preflight

- **Task ID**: NEXORA-027
- **Task Reference**: docs/tasks/active/NEXORA-027-customer-management-backend.md
- **Plan revision**: rev-2026-10-21-reuse-v2
  `;
  const validBinding = validatePrTaskBinding(validPrBody, root);
  assert.equal(validBinding.valid, true);
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

  // Path traversal rejected
  const traversalBinding = validatePrTaskBinding(
    "docs/tasks/active/../../etc/passwd.md",
    root,
  );
  assert.equal(traversalBinding.valid, false);
  assert.ok(
    traversalBinding.failures.some((f) => f.includes("path traversal")),
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
Also see docs/tasks/active/NEXORA-003-engineering-workflow.md
    `,
    root,
  );
  assert.equal(conflictingBinding.valid, false);
  assert.ok(
    conflictingBinding.failures.some((f) =>
      f.includes("Multiple conflicting task references detected"),
    ),
  );
});

// ============================================================================
// GitHub CI Approval Verification
// ============================================================================

test("verifyGitHubApprovalEvidence: independently checks reviews and comments, enforces decision block and authority", async () => {
  const taskRecord = {
    fields: {
      taskId: "NEXORA-027",
      planRevision: "rev-2026-10-21-reuse-v2",
      approvalStatus: "APPROVED",
    },
  };

  // 1. Reviews API HTTP 200 with empty list, but valid owner comment -> PASS
  const mockOwnerComment = [
    {
      user: { login: "dinhphuquy2k1", type: "User" },
      created_at: "2026-10-21T12:00:00Z",
      body: `NEXORA DESIGN APPROVAL\nTask: NEXORA-027\nPlan revision: rev-2026-10-21-reuse-v2\nDecision: APPROVED`,
    },
  ];
  const passCommentResult = await verifyGitHubApprovalEvidence({
    prNumber: 23,
    taskRecord,
    isCi: true,
    githubToken: "mock-token",
    fetchFn: createMockFetch({ reviews: [], comments: mockOwnerComment }),
  });
  assert.equal(passCommentResult.approvalVerified, true);
  assert.equal(passCommentResult.verified, true);
  assert.match(
    passCommentResult.message,
    /Verified design approval by @dinhphuquy2k1/,
  );

  // 2. Reviews API HTTP 200 with empty list, and no owner comment -> FAIL
  const noApprovalResult = await verifyGitHubApprovalEvidence({
    prNumber: 23,
    taskRecord,
    isCi: true,
    githubToken: "mock-token",
    fetchFn: createMockFetch({ reviews: [], comments: [] }),
  });
  assert.equal(noApprovalResult.approvalVerified, false);
  assert.equal(noApprovalResult.verified, false);
  assert.match(noApprovalResult.message, /No authorized design approval found/);

  // 3. Approved review with explicit matching design decision -> PASS
  const mockApprovedReview = [
    {
      user: { login: "repository-owner", type: "User" },
      state: "APPROVED",
      submitted_at: "2026-10-21T12:00:00Z",
      body: `NEXORA DESIGN APPROVAL\nTask: NEXORA-027\nPlan revision: rev-2026-10-21-reuse-v2\nDecision: APPROVED`,
    },
  ];
  const passReviewResult = await verifyGitHubApprovalEvidence({
    prNumber: 23,
    taskRecord,
    isCi: true,
    githubToken: "mock-token",
    fetchFn: createMockFetch({ reviews: mockApprovedReview, comments: [] }),
  });
  assert.equal(passReviewResult.approvalVerified, true);

  // 4. Generic approved code review without plan reference ("LGTM") -> FAIL as design evidence
  const mockGenericReview = [
    {
      user: { login: "repository-owner", type: "User" },
      state: "APPROVED",
      submitted_at: "2026-10-21T12:00:00Z",
      body: "LGTM, looks good to merge!",
    },
  ];
  const failGenericResult = await verifyGitHubApprovalEvidence({
    prNumber: 23,
    taskRecord,
    isCi: true,
    githubToken: "mock-token",
    fetchFn: createMockFetch({ reviews: mockGenericReview, comments: [] }),
  });
  assert.equal(failGenericResult.approvalVerified, false);

  // 5. Comment by unauthorized account -> FAIL
  const mockUnauthorizedComment = [
    {
      user: { login: "random-user", type: "User" },
      created_at: "2026-10-21T12:00:00Z",
      body: `Task: NEXORA-027\nPlan revision: rev-2026-10-21-reuse-v2\nDecision: APPROVED`,
    },
  ];
  const failUnauthorizedResult = await verifyGitHubApprovalEvidence({
    prNumber: 23,
    taskRecord,
    isCi: true,
    githubToken: "mock-token",
    fetchFn: createMockFetch({
      reviews: [],
      comments: mockUnauthorizedComment,
    }),
  });
  assert.equal(failUnauthorizedResult.approvalVerified, false);

  // 6. Bot comment mentioning approval -> FAIL
  const mockBotComment = [
    {
      user: { login: "github-actions[bot]", type: "Bot" },
      created_at: "2026-10-21T12:00:00Z",
      body: `Task: NEXORA-027\nPlan revision: rev-2026-10-21-reuse-v2\nDecision: APPROVED`,
    },
  ];
  const failBotResult = await verifyGitHubApprovalEvidence({
    prNumber: 23,
    taskRecord,
    isCi: true,
    githubToken: "mock-token",
    fetchFn: createMockFetch({ reviews: [], comments: mockBotComment }),
  });
  assert.equal(failBotResult.approvalVerified, false);

  // 7. Owner comment mentioning only Task ID -> FAIL
  const mockTaskOnlyComment = [
    {
      user: { login: "dinhphuquy2k1", type: "User" },
      created_at: "2026-10-21T12:00:00Z",
      body: `Task: NEXORA-027\nDecision: APPROVED`,
    },
  ];
  const failTaskOnly = await verifyGitHubApprovalEvidence({
    prNumber: 23,
    taskRecord,
    isCi: true,
    githubToken: "mock-token",
    fetchFn: createMockFetch({ reviews: [], comments: mockTaskOnlyComment }),
  });
  assert.equal(failTaskOnly.approvalVerified, false);

  // 8. Owner comment mentioning only Plan revision -> FAIL
  const mockRevOnlyComment = [
    {
      user: { login: "dinhphuquy2k1", type: "User" },
      created_at: "2026-10-21T12:00:00Z",
      body: `Plan revision: rev-2026-10-21-reuse-v2\nDecision: APPROVED`,
    },
  ];
  const failRevOnly = await verifyGitHubApprovalEvidence({
    prNumber: 23,
    taskRecord,
    isCi: true,
    githubToken: "mock-token",
    fetchFn: createMockFetch({ reviews: [], comments: mockRevOnlyComment }),
  });
  assert.equal(failRevOnly.approvalVerified, false);

  // 9. Owner comment without explicit APPROVED decision (e.g. REVISION_REQUIRED) -> FAIL
  const mockRevisionReqComment = [
    {
      user: { login: "dinhphuquy2k1", type: "User" },
      created_at: "2026-10-21T12:00:00Z",
      body: `Task: NEXORA-027\nPlan revision: rev-2026-10-21-reuse-v2\nDecision: REVISION_REQUIRED`,
    },
  ];
  const failRevisionReq = await verifyGitHubApprovalEvidence({
    prNumber: 23,
    taskRecord,
    isCi: true,
    githubToken: "mock-token",
    fetchFn: createMockFetch({ reviews: [], comments: mockRevisionReqComment }),
  });
  assert.equal(failRevisionReq.approvalVerified, false);
  assert.match(failRevisionReq.message, /REVISION_REQUIRED/);

  // 10. Approval for another Task ID -> FAIL
  const mockOtherTaskComment = [
    {
      user: { login: "dinhphuquy2k1", type: "User" },
      created_at: "2026-10-21T12:00:00Z",
      body: `Task: NEXORA-099\nPlan revision: rev-2026-10-21-reuse-v2\nDecision: APPROVED`,
    },
  ];
  const failOtherTask = await verifyGitHubApprovalEvidence({
    prNumber: 23,
    taskRecord,
    isCi: true,
    githubToken: "mock-token",
    fetchFn: createMockFetch({ reviews: [], comments: mockOtherTaskComment }),
  });
  assert.equal(failOtherTask.approvalVerified, false);

  // 11. Approval for another Plan revision -> FAIL
  const mockOtherRevComment = [
    {
      user: { login: "dinhphuquy2k1", type: "User" },
      created_at: "2026-10-21T12:00:00Z",
      body: `Task: NEXORA-027\nPlan revision: rev-older-revision\nDecision: APPROVED`,
    },
  ];
  const failOtherRev = await verifyGitHubApprovalEvidence({
    prNumber: 23,
    taskRecord,
    isCi: true,
    githubToken: "mock-token",
    fetchFn: createMockFetch({ reviews: [], comments: mockOtherRevComment }),
  });
  assert.equal(failOtherRev.approvalVerified, false);

  // 12. Later authoritative REVISION_REQUIRED supersedes older APPROVED -> FAIL
  const mockSuperseded = [
    {
      user: { login: "dinhphuquy2k1", type: "User" },
      created_at: "2026-10-21T10:00:00Z",
      body: `Task: NEXORA-027\nPlan revision: rev-2026-10-21-reuse-v2\nDecision: APPROVED`,
    },
    {
      user: { login: "dinhphuquy2k1", type: "User" },
      created_at: "2026-10-21T14:00:00Z",
      body: `Task: NEXORA-027\nPlan revision: rev-2026-10-21-reuse-v2\nDecision: REVISION_REQUIRED`,
    },
  ];
  const failSuperseded = await verifyGitHubApprovalEvidence({
    prNumber: 23,
    taskRecord,
    isCi: true,
    githubToken: "mock-token",
    fetchFn: createMockFetch({ reviews: [], comments: mockSuperseded }),
  });
  assert.equal(failSuperseded.approvalVerified, false);
  assert.match(failSuperseded.message, /REVISION_REQUIRED/);

  // 13. Dismissed review is not valid evidence -> FAIL
  const mockDismissedReview = [
    {
      user: { login: "dinhphuquy2k1", type: "User" },
      state: "DISMISSED",
      submitted_at: "2026-10-21T12:00:00Z",
      body: `Task: NEXORA-027\nPlan revision: rev-2026-10-21-reuse-v2\nDecision: APPROVED`,
    },
  ];
  const failDismissed = await verifyGitHubApprovalEvidence({
    prNumber: 23,
    taskRecord,
    isCi: true,
    githubToken: "mock-token",
    fetchFn: createMockFetch({ reviews: mockDismissedReview, comments: [] }),
  });
  assert.equal(failDismissed.approvalVerified, false);

  // 14. Missing token in PR CI -> FAIL
  const failNoToken = await verifyGitHubApprovalEvidence({
    prNumber: 23,
    taskRecord,
    isCi: true,
    githubToken: "",
  });
  assert.equal(failNoToken.approvalVerified, false);
  assert.match(failNoToken.message, /requires GITHUB_TOKEN/);

  // 15. GitHub API 500 error fails closed -> FAIL
  const failApiError = await verifyGitHubApprovalEvidence({
    prNumber: 23,
    taskRecord,
    isCi: true,
    githubToken: "mock-token",
    fetchFn: createMockFetch({ status: 500 }),
  });
  assert.equal(failApiError.approvalVerified, false);
  assert.match(failApiError.message, /fail closed/);

  // 16. Local mode returns approvalVerified: false without claiming approval
  const localModeResult = await verifyGitHubApprovalEvidence({
    prNumber: 23,
    taskRecord,
    isCi: false,
  });
  assert.equal(localModeResult.approvalVerified, false);
  assert.equal(localModeResult.verificationMode, "local_static");
});

// ============================================================================
// Execution Context & CI Event Isolation (runPreflightCheck)
// ============================================================================

test("runPreflightCheck: PR CI mode fails closed on missing body, missing payload, or wrong repo", async () => {
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
