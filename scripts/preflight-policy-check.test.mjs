import { test } from "node:test";
import assert from "node:assert/strict";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import {
  checkDuplicateValidationGuards,
  validateTaskDesignGovernance,
  scanDuplicateGuards,
  EXPECTED_SKILL_SCENARIOS,
  runPreflightCheck,
} from "./preflight-policy-check.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

test("duplicate guards: pass on valid canonical module declarations and ignore test files", () => {
  // Canonical uuid file should not trigger a failure on itself
  const canonicalUuid = `
    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    export function isUuid(value: unknown): value is string { return true; }
  `;
  const failuresUuid = checkDuplicateValidationGuards(
    "apps/api/src/common/validation/uuid.ts",
    canonicalUuid,
  );
  assert.equal(failuresUuid.length, 0);

  // Test files with regex patterns should be ignored
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

test("task governance: validates valid task markdown and rejects malformed tasks", () => {
  const validTask = `
# Task
Classification: SIGNIFICANT
## Documentation Impact
Documentation Impact: REQUIRED
### Changed facts
- Facts
### Canonical owners
- docs/architecture/backend.md
### Documentation verification
- pnpm docs:check
## Mandatory Reuse & Design Audit
| Field | Value |
| Reuse alternatives | Reuse |
## Owner-approved scope
Approved by owner.
## Tactical DDD
Aggregate Root and invariants.
  `;
  const validFailures = validateTaskDesignGovernance(
    validTask,
    "docs/tasks/active/TEST-001.md",
  );
  assert.equal(validFailures.length, 0);

  // Missing classification
  const missingClass = `
## Documentation Impact
Documentation Impact: REQUIRED
## Reuse Alternatives
  `;
  const failures1 = validateTaskDesignGovernance(
    missingClass,
    "docs/tasks/active/TEST-002.md",
  );
  assert.ok(failures1.some((f) => f.includes("Task Classification")));

  // Missing reuse audit
  const missingReuse = `
Classification: BOUNDED
## Documentation Impact
Documentation Impact: NONE
Approved by owner.
  `;
  const failures2 = validateTaskDesignGovernance(
    missingReuse,
    "docs/tasks/active/TEST-003.md",
  );
  assert.ok(failures2.some((f) => f.includes("Reuse & Design Audit")));

  // Missing approval evidence
  const missingApproval = `
Classification: BOUNDED
## Documentation Impact
Documentation Impact: NONE
## Reuse alternatives
Reuse common.
  `;
  const failures3 = validateTaskDesignGovernance(
    missingApproval,
    "docs/tasks/active/TEST-004.md",
  );
  assert.ok(failures3.some((f) => f.includes("approval evidence")));
});

test("skill effectiveness fixtures: all 10 representative scenarios define expected policy decisions", () => {
  assert.equal(EXPECTED_SKILL_SCENARIOS.length, 10);
  const ids = EXPECTED_SKILL_SCENARIOS.map((s) => s.id);
  assert.ok(ids.includes("uuid-reuse"));
  assert.ok(ids.includes("phone-reuse"));
  assert.ok(ids.includes("country-reuse"));
  assert.ok(ids.includes("shared-status-web"));
  assert.ok(ids.includes("customer-default-address"));
  assert.ok(ids.includes("active-user-lock"));
  assert.ok(ids.includes("doc-only-change"));
  assert.ok(ids.includes("significant-domain"));
  assert.ok(ids.includes("approved-design-handed"));
  assert.ok(ids.includes("unexpected-conflict"));

  for (const s of EXPECTED_SKILL_SCENARIOS) {
    assert.ok(s.expectedDecision.length > 0);
    assert.ok(s.rule.length > 0);
  }
});

test("runPreflightCheck: succeeds against current repository root", async () => {
  const result = await runPreflightCheck(root);
  assert.equal(result.success, true);
  assert.deepEqual(result.failures, []);
});
