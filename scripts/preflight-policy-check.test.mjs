import { test } from "node:test";
import assert from "node:assert/strict";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import {
  checkDuplicateValidationGuards,
  parseStructuredDesignRecord,
  validateTaskDesignGovernance,
  validatePrTaskBinding,
  verifyGitHubApprovalEvidence,
  validateCopilotInstructions,
  validateAgentSkills,
  validateSkillEffectivenessFixtures,
  scanDuplicateGuards,
  EXPECTED_SKILL_SCENARIOS,
  runPreflightCheck,
} from "./preflight-policy-check.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

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
  // Injected duplicate UUID regex
  const duplicateUuid = `const myUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;`;
  const failuresUuid = checkDuplicateValidationGuards(
    "apps/api/src/carrier/application/carrier.service.ts",
    duplicateUuid,
  );
  assert.equal(failuresUuid.length, 1);
  assert.match(failuresUuid[0], /Duplicate UUID regex pattern detected/);

  // Injected duplicate Hex64 regex
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

  // Injected duplicate phone parsing import
  const duplicatePhone = `import { parsePhoneNumber } from "libphonenumber-js";`;
  const failuresPhone = checkDuplicateValidationGuards(
    "apps/api/src/customer/domain/customer.value-objects.ts",
    duplicatePhone,
  );
  assert.equal(failuresPhone.length, 1);
  assert.match(failuresPhone[0], /Direct libphonenumber-js import detected/);

  // Injected duplicate country import
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

test("structured design record parser: accurately extracts fields and rejects malformed records", () => {
  const validSection = `
## Design Review & Reuse Decision

- **Task ID**: NEXORA-027
- **Classification**: SIGNIFICANT
- **Plan revision**: rev-2026-10-21-v1
- **Reviewed baseline**: 42833752f76948aae7f1fad378291eedd288557b
- **Approval authority**: repository-owner
- **Approval status**: APPROVED
- **Approval evidence**: https://github.com/dinhphuquy2k1/nexora/pull/23#issuecomment-PR23-OWNER-SPEC
  `;
  const parsed = parseStructuredDesignRecord(validSection);
  assert.equal(parsed.exists, true);
  assert.equal(parsed.failures.length, 0);
  assert.equal(parsed.fields.taskId, "NEXORA-027");
  assert.equal(parsed.fields.approvalStatus, "APPROVED");

  // Missing section entirely
  const missingSection = parseStructuredDesignRecord("# Some other task");
  assert.equal(missingSection.exists, false);

  // Duplicate approval status lines
  const duplicateStatus = `
## Design Review & Reuse Decision
- **Task ID**: NEXORA-027
- **Classification**: SIGNIFICANT
- **Plan revision**: rev-1
- **Reviewed baseline**: 42833752f76948aae7f1fad378291eedd288557b
- **Approval authority**: repository-owner
- **Approval status**: PENDING_REVIEW
- **Approval status**: APPROVED
- **Approval evidence**: https://evidence
  `;
  const parsedDup = parseStructuredDesignRecord(duplicateStatus);
  assert.ok(
    parsedDup.failures.some((f) => f.includes("Duplicate Approval status")),
  );

  // Placeholder values rejected
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

test("task governance: rejects PENDING_REVIEW, REVISION_REQUIRED, and loose Approved outside section", () => {
  const validReuseMatrix = `
| Component | Existing implementations | Domain owner | Reuse alternatives | Selected approach | Rationale | Risks | Verification |
| isUuid | customer.input.ts | Common | Extract | Extract | Simplicity | None | Unit tests |
  `;

  // PENDING_REVIEW must fail
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
- **Approval evidence**: https://evidence
${validReuseMatrix}
  `;
  const pendingFailures = validateTaskDesignGovernance(
    pendingTask,
    "docs/tasks/active/NEXORA-027-test.md",
  );
  assert.ok(
    pendingFailures.some((f) =>
      f.includes("Approval status is 'PENDING_REVIEW'"),
    ),
  );

  // REVISION_REQUIRED must fail
  const revisionTask = pendingTask.replace(
    "PENDING_REVIEW",
    "REVISION_REQUIRED",
  );
  const revisionFailures = validateTaskDesignGovernance(
    revisionTask,
    "docs/tasks/active/NEXORA-027-test.md",
  );
  assert.ok(
    revisionFailures.some((f) =>
      f.includes("Approval status is 'REVISION_REQUIRED'"),
    ),
  );

  // Text "Approved" outside designated section must not grant approval
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
- **Approval evidence**: https://evidence
${validReuseMatrix}
  `;
  const trickFailures = validateTaskDesignGovernance(
    trickTask,
    "docs/tasks/active/NEXORA-027-test.md",
  );
  assert.ok(
    trickFailures.some((f) =>
      f.includes("Approval status is 'PENDING_REVIEW'"),
    ),
  );

  // Missing matrix table columns fails
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
- **Approval evidence**: https://evidence
Reuse alternatives were considered.
  `;
  const matrixFailures = validateTaskDesignGovernance(
    missingMatrixTask,
    "docs/tasks/active/NEXORA-027-test.md",
  );
  assert.ok(
    matrixFailures.some((f) =>
      f.includes("Incomplete Reuse & Design Audit Matrix"),
    ),
  );
});

test("PR-to-task binding: validates canonical task reference and catches traversal/mismatches", () => {
  // Valid PR body
  const validPrBody = `
## Task Reference
- **Task**: [NEXORA-027](docs/tasks/active/NEXORA-027-customer-management-backend.md)
  `;
  const validBinding = validatePrTaskBinding(validPrBody, root);
  assert.equal(validBinding.valid, true);
  assert.equal(validBinding.tasks.length, 1);
  assert.equal(
    validBinding.tasks[0].relPath,
    "docs/tasks/active/NEXORA-027-customer-management-backend.md",
  );

  // Missing reference
  const missingBinding = validatePrTaskBinding("Just a pull request", root);
  assert.equal(missingBinding.valid, false);
  assert.ok(
    missingBinding.failures.some((f) =>
      f.includes("must reference an active task file"),
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

  // Non-active tasks path rejected
  const outsideBinding = validatePrTaskBinding(
    "docs/tasks/completed/NEXORA-001.md",
    root,
  );
  assert.equal(outsideBinding.valid, false);
});

test("GitHub CI approval verification: respects transitional PR #23 baseline and rejects unauthorized reviewers", async () => {
  // PR #23 transitional compatibility
  const transitional = await verifyGitHubApprovalEvidence({
    prNumber: 23,
    taskRecord: { fields: { taskId: "NEXORA-027", planRevision: "rev-1" } },
    isCi: true,
  });
  assert.equal(transitional.verified, true);
  assert.equal(transitional.mode, "ci_transitional");

  // Non-PR #23 in CI without token fails
  const missingToken = await verifyGitHubApprovalEvidence({
    prNumber: 99,
    taskRecord: { fields: { taskId: "NEXORA-099", planRevision: "rev-1" } },
    isCi: true,
    githubToken: "",
  });
  assert.equal(missingToken.verified, false);
});

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

test("runPreflightCheck: succeeds against current repository root", async () => {
  const result = await runPreflightCheck(root);
  assert.equal(result.success, true);
  assert.deepEqual(result.failures, []);
});
