import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdtemp,
  mkdir,
  writeFile,
  readFile,
  copyFile,
  rm,
} from "node:fs/promises";
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

test("evidence path policy blocks generated task media and runtime outputs, not source assets", async () => {
  const { checkEvidencePaths } = await import("./docs-check-lib.mjs");
  assert.deepEqual(
    checkEvidencePaths([
      "docs/tasks/active/FIX-001.md",
      "docs/tasks/design-reviews/FIX-001-v1.md",
      "docs/tasks/evidence/FIX-001/reference.json",
      "apps/web/public/logo.png",
      "docs/architecture/assets/approved-reference.png",
    ]),
    [],
  );
  for (const file of [
    "docs/tasks/evidence/FIX-001/nested/capture.PNG",
    "docs/tasks/active/debug.webp",
    "docs/tasks/evidence/FIX-001/video.webm",
    "docs/tasks/evidence/FIX-001/debug.log",
    "artifacts/account/admin.json",
    "artifacts/account/capture.png",
  ]) {
    assert.equal(checkEvidencePaths([file]).length, 1, file);
  }
});

test("real Git index rejects force-added evidence and accepts staged removal/source assets", async () => {
  const { execFileSync } = await import("node:child_process");
  const { checkTrackedEvidence } = await import("./docs-check-lib.mjs");
  const root = await setupFixture();
  const git = (...args) =>
    execFileSync("git", ["-C", root, ...args], { encoding: "utf8" });
  try {
    await assert.rejects(checkTrackedEvidence(root));
    git("init", "-q");
    await writeFile(
      path.join(root, ".gitignore"),
      await readFile(new URL("../.gitignore", import.meta.url), "utf8"),
    );
    const capture = "docs/tasks/evidence/FIX-001/nested/capture file.png";
    for (const file of [
      capture,
      "artifacts/account/admin.json",
      "docs/tasks/evidence/FIX-001/reference.json",
      "apps/web/public/logo.png",
      "docs/architecture/assets/approved-reference.png",
    ]) {
      await mkdir(path.dirname(path.join(root, file)), { recursive: true });
      await writeFile(path.join(root, file), "synthetic fixture");
    }
    for (const file of [capture, "artifacts/account/admin.json"]) {
      assert.equal(git("check-ignore", "--no-index", file).trim(), file);
    }
    await writeFile(
      path.join(root, "docs/tasks/active/FIX-001-task.md"),
      validTaskContent(),
    );
    await mkdir(path.join(root, "docs/tasks/design-reviews"), {
      recursive: true,
    });
    await writeFile(
      path.join(root, "docs/tasks/design-reviews/FIX-001-v1.md"),
      "# Immutable fixture plan\n",
    );
    for (const extension of [
      "PNG",
      "jpg",
      "jpeg",
      "webp",
      "gif",
      "mp4",
      "webm",
      "log",
    ]) {
      const file = `docs/tasks/evidence/FIX-001/nested/capture.${extension}`;
      assert.equal(git("check-ignore", "--no-index", file).trim(), file);
    }
    const sources = [
      "docs/tasks/active/FIX-001-task.md",
      "docs/tasks/design-reviews/FIX-001-v1.md",
      "docs/tasks/evidence/FIX-001/reference.json",
      "apps/web/public/logo.png",
      "docs/architecture/assets/approved-reference.png",
      "docs/ai/PROJECT_RULES.md",
    ];
    git("add", ...sources);
    assert.deepEqual(await checkTrackedEvidence(root), []);
    git("add", "--force", capture, "artifacts/account/admin.json");
    assert.equal((await checkTrackedEvidence(root)).length, 2);
    git("rm", "--cached", "--force", capture, "artifacts/account/admin.json");
    assert.deepEqual(await checkTrackedEvidence(root), []);
    assert.ok(git("ls-files").includes("reference.json"));
    assert.ok(git("ls-files").includes("logo.png"));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("actual docs CLI fails nonzero for tracked evidence and passes after staged removal", async () => {
  const { execFileSync, spawnSync } = await import("node:child_process");
  const root = await setupFixture();
  const git = (...args) =>
    execFileSync("git", ["-C", root, ...args], { encoding: "utf8" });
  try {
    git("init", "-q");
    await mkdir(path.join(root, "scripts"));
    for (const name of ["docs-check.mjs", "docs-check-lib.mjs"]) {
      await copyFile(
        new URL(name, import.meta.url),
        path.join(root, "scripts", name),
      );
    }
    const capture = "docs/tasks/evidence/FIX-001/capture.png";
    await mkdir(path.dirname(path.join(root, capture)), { recursive: true });
    await writeFile(path.join(root, capture), "synthetic fixture");
    git("add", "--force", capture);
    const run = () =>
      spawnSync(process.execPath, [path.join(root, "scripts/docs-check.mjs")], {
        cwd: root,
        encoding: "utf8",
      });
    const rejected = run();
    assert.equal(rejected.status, 1);
    assert.match(rejected.stderr, /Generated evidence must not be tracked/);
    git("rm", "--cached", "--force", capture);
    const accepted = run();
    assert.equal(accepted.status, 0, accepted.stderr);
    assert.match(accepted.stdout, /relative links are valid/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("linked worktree policy reads its real index and fails closed when metadata is unreachable", async () => {
  const { execFileSync } = await import("node:child_process");
  const { checkTrackedEvidence } = await import("./docs-check-lib.mjs");
  const root = await setupFixture();
  const git = (...args) =>
    execFileSync("git", ["-C", root, ...args], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  const linked = path.join(root, "linked");
  try {
    git("init", "-q");
    git("add", "README.md");
    git(
      "-c",
      "user.name=Evidence fixture",
      "-c",
      "user.email=fixture@example.invalid",
      "-c",
      "commit.gpgsign=false",
      "commit",
      "-qm",
      "synthetic fixture",
    );
    git("worktree", "add", "--detach", linked, "HEAD");
    const pointer = await readFile(path.join(linked, ".git"), "utf8");
    assert.match(pointer, /^gitdir:/);
    const capture = "docs/tasks/evidence/FIX-001/capture.png";
    await mkdir(path.dirname(path.join(linked, capture)), { recursive: true });
    await writeFile(path.join(linked, capture), "synthetic fixture");
    execFileSync("git", ["-C", linked, "add", "--force", capture]);
    assert.equal((await checkTrackedEvidence(linked)).length, 1);
    await writeFile(
      path.join(linked, ".git"),
      `gitdir: ${path.join(root, "unreachable-metadata")}\n`,
    );
    await assert.rejects(
      checkTrackedEvidence(linked),
      /readable checkout metadata/,
    );
    await writeFile(path.join(linked, ".git"), pointer);
    assert.equal((await checkTrackedEvidence(linked)).length, 1);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
