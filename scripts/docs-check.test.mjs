import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import {
  checkDocumentation,
  requiredEntryPoints,
  HISTORICAL_TASKS,
} from "./docs-check-lib.mjs";

const setupFixture = async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), "nexora-docs-check-"));

  // Create required entry points
  for (const entry of requiredEntryPoints) {
    const full = path.join(tmp, entry);
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, `# ${path.basename(entry, ".md")}\n`);
  }

  // Create minimal valid task directory structure
  await mkdir(path.join(tmp, "docs/tasks/active"), { recursive: true });
  await mkdir(path.join(tmp, "docs/tasks/completed"), { recursive: true });

  return tmp;
};

const validTaskContent = (
  status = "IN PROGRESS",
  verification = "VERIFIED",
) => `
# Task: FIX-001 — Fixture Task

- **Task ID**: FIX-001
- **Status**: ${status}
- **Implementation**: IMPLEMENTED
- **Verification**: ${verification}

## Documentation Impact

Documentation Impact: NONE

### Reason
- Internal test fixture without documentation changes.

## Evidence

| Claim | Evidence | Date | Result |
| :--- | :--- | :--- | :--- |
| Test claim passes | node --test | 2026-10-10 | PASS |
`;

test("valid relative link succeeds", async () => {
  const root = await setupFixture();
  try {
    const taskPath = path.join(root, "docs/tasks/active/FIX-001-valid.md");
    await writeFile(
      taskPath,
      validTaskContent() +
        "\nSee [overview](../../architecture/overview.md).\n",
    );
    const failures = await checkDocumentation(root);
    assert.deepEqual(failures, []);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("missing relative link is detected as failure", async () => {
  const root = await setupFixture();
  try {
    const taskPath = path.join(root, "docs/tasks/active/FIX-001-broken.md");
    await writeFile(
      taskPath,
      validTaskContent() +
        "\nSee [broken link](../../architecture/nonexistent.md).\n",
    );
    const failures = await checkDocumentation(root);
    assert.equal(failures.length, 1);
    assert.match(
      failures[0],
      /has unresolved link: \.\.\/\.\.\/architecture\/nonexistent\.md/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("invalid task status is rejected", async () => {
  const root = await setupFixture();
  try {
    const taskPath = path.join(root, "docs/tasks/active/FIX-001-bad-status.md");
    await writeFile(taskPath, validTaskContent("COMPLETED")); // COMPLETED is invalid in active/
    const failures = await checkDocumentation(root);
    assert.ok(
      failures.some((f) =>
        f.includes(
          "has invalid task status for directory docs/tasks/active: COMPLETED",
        ),
      ),
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("valid task status is accepted", async () => {
  const root = await setupFixture();
  try {
    const taskPath = path.join(
      root,
      "docs/tasks/active/FIX-001-good-status.md",
    );
    await writeFile(taskPath, validTaskContent("IN PROGRESS"));
    const failures = await checkDocumentation(root);
    assert.deepEqual(failures, []);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("missing required evidence for VERIFIED task is detected", async () => {
  const root = await setupFixture();
  try {
    const taskPath = path.join(
      root,
      "docs/tasks/active/FIX-001-no-evidence.md",
    );
    const contentWithoutEvidence = `
# Task: FIX-001 — No Evidence Task

- **Task ID**: FIX-001
- **Status**: IN PROGRESS
- **Verification**: VERIFIED

## Documentation Impact

Documentation Impact: NONE

### Reason
- Internal test fixture.
`;
    await writeFile(taskPath, contentWithoutEvidence);
    const failures = await checkDocumentation(root);
    assert.ok(
      failures.some((f) =>
        f.includes(
          "must contain exactly one canonical Evidence table under ## Evidence",
        ),
      ),
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("historical task compatibility allows legacy tasks without schema enforcement", async () => {
  const root = await setupFixture();
  try {
    const legacyPath = path.join(
      root,
      "docs/tasks/completed/NEXORA-001-foundation.md",
    );
    const legacyContent = `
# Task Evidence: NEXORA-001 — Bootstrap Foundation

- **Task ID**: NEXORA-001
- **Status**: Finished

## Custom Results
Legacy custom table without canonical headers.
`;
    await writeFile(legacyPath, legacyContent);
    const failures = await checkDocumentation(root, {
      historicalTasks: HISTORICAL_TASKS,
    });
    assert.deepEqual(failures, []);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
