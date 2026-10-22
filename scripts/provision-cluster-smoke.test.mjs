import { clearTimeout } from "node:timers";
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, readFile, chmod, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, delimiter } from "node:path";
import { spawn } from "node:child_process";
import { pathToFileURL } from "node:url";
const source = await readFile(
  new URL("./provision-cluster-smoke.mjs", import.meta.url),
  "utf8",
);
async function fixture(mode = "normal", suite, signal) {
  const dir = await mkdtemp(join(tmpdir(), "nexora-cluster-fixture-"));
  try {
    const docker = join(dir, "docker");
    await writeFile(
      docker,
      await readFile(new URL("./fixtures/cluster/docker.cjs", import.meta.url)),
    );
    await chmod(docker, 0o755);
    const state = join(dir, "state.json");
    await writeFile(
      state,
      JSON.stringify({
        containers: {},
        network: null,
        calls: [],
        suites: 0,
        tcp: 0,
        socket: 0,
      }),
    );
    const launcher = join(dir, "launcher.mjs");
    await writeFile(
      launcher,
      source
        .replace(
          "./docker-command.mjs",
          new URL("./docker-command.mjs", import.meta.url).href,
        )
        .replace("performance.now() + 30000", "performance.now() + 1000")
        .replace("Math.min(200,", "Math.min(10,"),
    );
    const env = {
      ...process.env,
      PATH: dir + delimiter + process.env.PATH,
      FIXTURE_STATE: state,
      FIXTURE_MODE: mode,
    };
    delete env.NODE_TEST_CONTEXT;
    const p = spawn(
      process.execPath,
      [launcher, ...(suite ? [`--suite=${suite}`] : [])],
      { env },
    );
    let output = "";
    p.stdout.on("data", (c) => (output += c));
    p.stderr.on("data", (c) => (output += c));
    const timer = setTimeout(() => p.kill("SIGKILL"), 15000);
    const done = new Promise((resolve, reject) => {
      p.on("error", reject);
      p.on("close", (code, signal) => resolve({ code, signal }));
    });
    if (signal) {
      let reached = false;
      for (let i = 0; i < 700; i++) {
        try {
          if (JSON.parse(await readFile(state)).suites) {
            reached = true;
            break;
          }
        } catch {
          /* fixture state may be between writes */
        }
        await new Promise((r) => setTimeout(r, 10));
      }
      if (!reached) {
        p.kill("SIGKILL");
        throw Error("fixture suite did not start");
      }
      p.kill(signal);
    }
    const result = await done;
    clearTimeout(timer);
    return { ...result, output, state: JSON.parse(await readFile(state)) };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
function clean(s) {
  assert.deepEqual(s.containers, {});
  assert.equal(s.network, null);
  assert.ok(s.calls.every((c) => !c.includes("prune")));
}
test("cluster normal/selectors/TCP-only temporary startup", async () => {
  for (const [suite, count] of [
    [undefined, 2],
    ["provision", 1],
    ["customer-sql", 1],
  ]) {
    const r = await fixture("normal", suite);
    assert.equal(r.code, 0, r.output);
    assert.equal(r.state.suites, count);
    clean(r.state);
    assert.equal(r.state.socket, 0);
    assert.match(r.output, /Actual disposable cluster tests PASS/);
  }
  const r = await fixture("temporary");
  assert.equal(r.code, 0, r.output);
  assert.ok(r.state.tcp >= 3);
  clean(r.state);
});
test("cluster timeout never stamps or runs SQL; stopped/partial/ownership startup fails", async () => {
  const r = await fixture("tcp-timeout");
  assert.notEqual(r.code, 0);
  assert.match(r.output, /TCP_READINESS_TIMEOUT/);
  assert.equal(r.state.stamped, undefined);
  assert.equal(r.state.suites, 0);
  clean(r.state);
  for (const mode of [
    "startup-fail",
    "ownership-fail",
    "partial-create",
    "partial-node-create",
  ]) {
    const r = await fixture(mode);
    assert.notEqual(r.code, 0, r.output);
    assert.doesNotMatch(r.output, /Actual disposable cluster tests PASS/);
    clean(r.state);
  }
});
test("suite failures and separate container exit survive cleanup; diagnostics redact SQL/URLs", async () => {
  for (const mode of ["suite-fail", "suite-status-fail", "redaction"]) {
    const r = await fixture(mode);
    assert.notEqual(r.code, 0);
    assert.match(r.output, /SUITE_FAILED/);
    assert.doesNotMatch(r.output, /SELECT password|postgresql:\/\/secret/);
    clean(r.state);
  }
});
test("cleanup removal/inspect/malformed failures cannot PASS and preserve original failures", async () => {
  for (const mode of ["rm-fail", "inspect-fail", "malformed", "both-fail"]) {
    const r = await fixture(mode);
    assert.notEqual(r.code, 0);
    assert.match(r.output, /CLEANUP_FAILED/);
    assert.doesNotMatch(r.output, /Actual disposable cluster tests PASS/);
    if (mode === "both-fail") assert.match(r.output, /SUITE_FAILED/);
    if (["rm-fail", "both-fail"].includes(mode)) {
      assert.ok(Object.keys(r.state.containers).length);
      assert.ok(r.state.calls.filter((c) => c[0] === "rm").length >= 2);
    }
  }
});
test("SIGINT/SIGTERM cleanup and unowned partial name cannot authorize deletion", async () => {
  for (const [signal, code] of [
    ["SIGTERM", 143],
    ["SIGINT", 130],
  ]) {
    const r = await fixture("signal", undefined, signal);
    assert.equal(r.code, code, r.output);
    clean(r.state);
    assert.doesNotMatch(r.output, /Actual disposable cluster tests PASS/);
  }
  const r = await fixture("unowned-create");
  assert.notEqual(r.code, 0);
  assert.ok(Object.keys(r.state.containers).length);
  assert.ok(r.state.calls.every((c) => c[0] !== "rm"));
});
test("exact absence/idempotence and unverifiable state retain tracking", async () => {
  const dir = await mkdtemp(join(tmpdir(), "nexora-cluster-classification-"));
  try {
    const file = join(dir, "library.mjs");
    await writeFile(
      file,
      source.replace(
        "./docker-command.mjs",
        new URL("./docker-command.mjs", import.meta.url).href,
      ) +
        "\nexport {owned,pending,remove,cleanup,suiteFailure}; export function setCommand(fn){command=fn;}\n",
    );
    const m = await import(pathToFileURL(file));
    const id = "a".repeat(64);
    for (const diagnostic of [
      "permission denied",
      "Cannot connect to Docker daemon",
      "timeout",
      "No such object: other-id",
    ]) {
      m.owned.container.add(id);
      let i = 0;
      m.setCommand(async () =>
        i++ === 0
          ? { code: 1, stderr: "remove failed" }
          : { code: 1, stderr: diagnostic },
      );
      assert.match(await m.remove("container", id), /unable-to-verify/);
      assert.ok(m.owned.container.has(id));
      m.owned.container.clear();
    }
    m.owned.container.add(id);
    let calls = 0;
    m.setCommand(async () =>
      ++calls === 1
        ? { code: 1, stderr: "already missing" }
        : { code: 1, stderr: "Error: No such object: " + id },
    );
    assert.deepEqual(await m.cleanup(), []);
    assert.deepEqual(await m.cleanup(), []);
    assert.equal(calls, 2);
    for (const response of ["{}", "[null]", "not-json"]) {
      m.owned.container.add(id);
      let i = 0;
      m.setCommand(async () =>
        ++i === 1 ? { code: 0 } : { code: 0, stdout: response },
      );
      assert.ok(await m.remove("container", id));
      assert.ok(m.owned.container.has(id));
      m.owned.container.clear();
    }
    m.pending.push(["container", "unknown-name"]);
    m.setCommand(async () => ({ code: 1, stderr: "daemon unavailable" }));
    assert.ok((await m.cleanup()).length);
    assert.equal(m.pending.length, 1);
    m.setCommand(async () => ({
      code: 1,
      stderr: "Error: No such object: unknown-name",
    }));
    assert.deepEqual(await m.cleanup(), []);
    assert.equal(m.pending.length, 0);
    const e = m.suiteFailure("customer-sql", {
      code: 17,
      stdout: "AssertionError SELECT password FROM users",
      stderr: "code: '42501' secret",
    });
    assert.match(e.message, /attach_exit=17/);
    assert.match(e.message, /AssertionError/);
    assert.match(e.message, /42501/);
    assert.doesNotMatch(e.message, /SELECT password|secret/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
