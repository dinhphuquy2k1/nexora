import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { selectPublicHttpsExperiment } from "./public-https-stress-plan.mjs";

const pr = (...names) => ({
  pull_request: { labels: names.map((name) => ({ name })) },
});
test("unarmed PRs and runtime label alone cannot schedule trials", () => {
  for (const event of [{}, pr(), pr("unrelated"), pr("https-stress-runtime")]) {
    assert.equal(
      selectPublicHttpsExperiment("pull_request", event).enabled,
      false,
    );
  }
  assert.equal(
    selectPublicHttpsExperiment("push", pr("https-stress")).enabled,
    false,
  );
});
test("armed PR exclusively selects fifteen HTTPS-only or ten runtime-first trials", () => {
  const only = selectPublicHttpsExperiment("pull_request", pr("https-stress"));
  const runtime = selectPublicHttpsExperiment(
    "pull_request",
    pr("https-stress", "https-stress-runtime"),
  );
  assert.equal(only.mode, "step8-only");
  assert.equal(runtime.mode, "runtime-then-https");
  for (const [plan, count] of [
    [only, 15],
    [runtime, 10],
  ]) {
    assert.equal(plan.enabled, true);
    assert.deepEqual(
      plan.matrix.trial,
      Array.from({ length: count }, (_, i) => i + 1),
    );
  }
});
test("dispatch input controls mode independently of labels and rejects arbitrary mode", () => {
  for (const [mode, count] of [
    ["step8-only", 15],
    ["runtime-then-https", 10],
  ]) {
    const plan = selectPublicHttpsExperiment("workflow_dispatch", {
      ...pr("https-stress-runtime"),
      inputs: { mode },
    });
    assert.equal(plan.mode, mode);
    assert.equal(plan.matrix.trial.length, count);
  }
  assert.throws(
    () =>
      selectPublicHttpsExperiment("workflow_dispatch", {
        inputs: { mode: "private\ninjected=true" },
      }),
    /^Error: Unsupported HTTPS experiment mode$/,
  );
});
test("workflow CLI emits only closed outputs, never arbitrary event or label values", async () => {
  const dir = await mkdtemp(join(tmpdir(), "https-plan-"));
  try {
    const event = join(dir, "event.json"),
      output = join(dir, "output");
    await writeFile(
      event,
      JSON.stringify(
        pr("https-stress", "https-stress-runtime", "private\ninjected=true"),
      ),
    );
    execFileSync(process.execPath, ["scripts/public-https-stress-plan.mjs"], {
      env: {
        ...process.env,
        GITHUB_EVENT_PATH: event,
        GITHUB_EVENT_NAME: "pull_request",
        GITHUB_OUTPUT: output,
      },
    });
    assert.equal(
      await readFile(output, "utf8"),
      'enabled=true\nmode=runtime-then-https\nmatrix={"trial":[1,2,3,4,5,6,7,8,9,10]}\n',
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("full label or dispatch selects Foundation exclusively and preserves fifteen trials", () => {
  for (const event of [
    pr("https-stress-full"),
    pr("https-stress", "https-stress-runtime", "https-stress-full"),
  ]) {
    const plan = selectPublicHttpsExperiment("pull_request", event);
    assert.equal(plan.enabled, true);
    assert.equal(plan.mode, "foundation");
    assert.equal(plan.matrix.trial.length, 15);
  }
  const plan = selectPublicHttpsExperiment("workflow_dispatch", {
    ...pr("https-stress"),
    inputs: { mode: "foundation" },
  });
  assert.equal(plan.mode, "foundation");
  assert.deepEqual(
    plan.matrix.trial,
    Array.from({ length: 15 }, (_, i) => i + 1),
  );
});
