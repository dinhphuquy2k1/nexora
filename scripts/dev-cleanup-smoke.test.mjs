import { clearTimeout } from "node:timers";
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, readFile, chmod, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, delimiter } from "node:path";
import { spawn } from "node:child_process";
async function fixture(mode, signal) {
  const dir = await mkdtemp(join(tmpdir(), "nexora-maintenance-fixture-"));
  try {
    const source = (
      await readFile(
        new URL("./dev-cleanup-smoke.mjs", import.meta.url),
        "utf8",
      )
    ).replace(
      'resolve(dirname(fileURLToPath(import.meta.url)), "..")',
      JSON.stringify(resolve(".")),
    );
    await writeFile(join(dir, "launcher.mjs"), source);
    await writeFile(
      join(dir, "docker-command.mjs"),
      (
        await readFile(new URL("./docker-command.mjs", import.meta.url), "utf8")
      ).replace("timeout = 120000", "timeout = 1000"),
    );
    await writeFile(
      join(dir, "docker"),
      await readFile(
        new URL("./fixtures/cluster/cleanup-docker.cjs", import.meta.url),
      ),
    );
    await chmod(join(dir, "docker"), 0o755);
    const state = join(dir, "state");
    await writeFile(
      state,
      JSON.stringify({ container: null, calls: [], count: 4 }),
    );
    const p = spawn(process.execPath, [join(dir, "launcher.mjs")], {
      env: {
        ...process.env,
        PATH: dir + delimiter + process.env.PATH,
        FIXTURE_STATE: state,
        FIXTURE_MODE: mode,
      },
    });
    let output = "";
    p.stdout.on("data", (c) => (output += c));
    p.stderr.on("data", (c) => (output += c));
    const timer = setTimeout(() => p.kill("SIGKILL"), 15000);
    const done = new Promise((r) => p.on("close", (code) => r(code)));
    if (signal) {
      let ready = false;
      for (let i = 0; i < 500; i++) {
        try {
          if (JSON.parse(await readFile(state)).waiting) {
            ready = true;
            break;
          }
        } catch {
          /* fixture state may be between writes */
        }
        await new Promise((r) => setTimeout(r, 10));
      }
      if (!ready) {
        p.kill("SIGKILL");
        throw Error("signal fixture not ready");
      }
      p.kill(signal);
    }
    const code = await done;
    clearTimeout(timer);
    return { code, output, state: JSON.parse(await readFile(state)) };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
test("maintenance positive dry-run/guards/delete and partial create/timeout cleanup", async () => {
  const positive = await fixture("normal");
  assert.equal(positive.code, 0, positive.output);
  assert.equal(positive.state.count, 3);
  assert.equal(positive.state.container, null);
  assert.match(positive.output, /Actual psql cleanup.*PASS/);
  for (const mode of ["partial", "create-timeout", "sql-fail"]) {
    const r = await fixture(mode);
    assert.notEqual(r.code, 0);
    assert.equal(r.state.container, null);
    assert.doesNotMatch(r.output, /Actual psql cleanup.*PASS|sensitive SQL/);
  }
});
test("maintenance SIGINT/SIGTERM and cleanup unverifiability cannot PASS", async () => {
  for (const [sig, code] of [
    ["SIGINT", 130],
    ["SIGTERM", 143],
  ]) {
    const r = await fixture("signal", sig);
    assert.equal(r.code, code, r.output);
    assert.equal(r.state.container, null);
    assert.doesNotMatch(r.output, /Actual psql cleanup.*PASS/);
  }
  for (const mode of ["rm-fail", "inspect-fail", "absence-unverified"]) {
    const r = await fixture(mode);
    assert.notEqual(r.code, 0);
    assert.match(r.output, /CLEANUP_UNVERIFIED/);
    assert.doesNotMatch(r.output, /Actual psql cleanup.*PASS/);
    if (mode === "inspect-fail")
      assert.ok(r.state.calls.every((c) => c[0] !== "rm"));
  }
});
