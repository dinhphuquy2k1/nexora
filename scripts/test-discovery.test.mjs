import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { spawnSync } from "node:child_process";
const guard = resolve("scripts/check-test-discovery.mjs");
test("discovery rejects empty/malformed patterns and propagates assertions; nested files execute once", async () => {
  const dir = await mkdtemp(join(tmpdir(), "nexora-discovery-"));
  const run = (args) => {
    const env = { ...process.env };
    delete env.NODE_TEST_CONTEXT;
    return spawnSync(process.execPath, args, {
      cwd: dir,
      encoding: "utf8",
      env,
    });
  };
  try {
    assert.notEqual(run([guard, "test/**/*.test.cjs"]).status, 0);
    assert.notEqual(run([guard, "test/*_/_.test.cjs"]).status, 0);
    await mkdir(join(dir, "test/nested"), { recursive: true });
    await mkdir(join(dir, "integration"));
    await writeFile(
      join(dir, "test/helper.cjs"),
      "throw Error('helper executed')",
    );
    await writeFile(
      join(dir, "integration/danger.test.cjs"),
      "throw Error('integration executed')",
    );
    await writeFile(
      join(dir, "test/nested/new.test.cjs"),
      "require('node:test')('discovered sentinel',()=>{});",
    );
    assert.equal(run([guard, "test/**/*.test.cjs"]).status, 0);
    assert.notEqual(
      run([guard, "test/**/*.test.cjs", "test/**/*.test.cjs"]).status,
      0,
    );
    const pass = run(["--test", "test/**/*.test.cjs"]);
    assert.equal(pass.status, 0, pass.stderr);
    assert.equal((pass.stdout.match(/discovered sentinel/g) || []).length, 1);
    await writeFile(
      join(dir, "test/nested/new.test.cjs"),
      "require('node:test')('actual failure',()=>{require('node:assert/strict').equal(1,2)});",
    );
    assert.notEqual(run(["--test", "test/**/*.test.cjs"]).status, 0);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("all baseline suites remain in exactly one intended discovery category", async () => {
  const { readFile, glob } = await import("node:fs/promises");
  const baseline = JSON.parse(
    await readFile(
      new URL("./fixtures/test-suite-baseline.json", import.meta.url),
      "utf8",
    ),
  );
  for (const [owner, expected] of Object.entries(baseline)) {
    const base =
      owner === "rootTooling"
        ? "."
        : owner === "apiIntegration"
          ? "apps/api"
          : owner.replace(/\/package.json$/, "");
    const pattern =
      owner === "rootTooling"
        ? "scripts/**/*.test.mjs"
        : owner === "apiIntegration"
          ? "integration/**/*.test.cjs"
          : `test/**/*.test.${base === "apps/api" ? "cjs" : "mjs"}`;
    const pkg = JSON.parse(await readFile(base + "/package.json", "utf8"));
    const script =
      pkg.scripts[owner === "apiIntegration" ? "test:integration" : "test"];
    const match = script.match(
      /check-test-discovery\.mjs "([^"]+)" && node --test "([^"]+)"/,
    );
    assert.ok(
      match,
      owner +
        ": package must guard exactly its native Node pattern using CMD-safe quotes",
    );
    assert.equal(match[1], pattern);
    assert.equal(match[2], pattern);
    const actual = [];
    for await (const p of glob(pattern, { cwd: base }))
      actual.push(p.replaceAll("\\", "/"));
    for (const p of expected)
      assert.ok(
        actual.includes(
          owner === "apiIntegration" ? p.replace(/^test\//, "integration/") : p,
        ),
        `${owner}: missing ${p}`,
      );
    assert.equal(new Set(actual).size, actual.length);
  }
});
