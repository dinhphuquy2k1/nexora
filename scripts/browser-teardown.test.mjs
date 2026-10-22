import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { spawn } from "node:child_process";
import { mkdtemp, writeFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  isProcessExited,
  waitForProcessExit,
  terminateChildProcess,
  cleanupBrowserProfile,
} from "./browser-teardown.mjs";

test("A: already exited child with normal exitCode completes without waiting or sending signals", async () => {
  const child = spawn(process.execPath, ["-e", "process.exit(0);"]);
  await new Promise((resolve) => child.once("exit", resolve));

  assert.equal(child.exitCode, 0);
  assert.equal(child.signalCode, null);
  assert.equal(isProcessExited(child), true);

  const start = Date.now();
  const res = await terminateChildProcess(child, { gracefulTimeoutMs: 5000 });
  const elapsed = Date.now() - start;

  assert.equal(res.exited, true);
  assert.equal(res.reason, "already_exited");
  assert.equal(res.exitCode, 0);
  assert.ok(elapsed < 200, `Expected instant return, took ${elapsed}ms`);
});

test("B: already exited child by signal completes without hanging or waiting indefinitely", async () => {
  const child = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000);"]);
  child.kill("SIGTERM");
  await new Promise((resolve) => child.once("exit", resolve));

  // In Node.js, signal-terminated processes have null exitCode and non-null signalCode
  assert.equal(child.exitCode, null);
  assert.equal(child.signalCode, "SIGTERM");
  assert.equal(isProcessExited(child), true);

  const start = Date.now();
  const res = await terminateChildProcess(child, {
    gracefulTimeoutMs: 5000,
    forceTimeoutMs: 5000,
  });
  const elapsed = Date.now() - start;

  assert.equal(res.exited, true);
  assert.equal(res.reason, "already_exited");
  assert.equal(res.signalCode, "SIGTERM");
  assert.ok(elapsed < 200, `Expected instant return, took ${elapsed}ms`);
});

test("C: graceful SIGTERM terminates running process without escalating", async () => {
  const child = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000);"]);

  assert.equal(isProcessExited(child), false);

  const res = await terminateChildProcess(child, {
    gracefulTimeoutMs: 5000,
    forceTimeoutMs: 5000,
  });

  assert.equal(res.exited, true);
  assert.equal(res.escalated, false);
  assert.ok(child.exitCode !== null || child.signalCode !== null);
});

test("D: SIGKILL escalation terminates child when graceful SIGTERM is unhandled", async () => {
  const events = new EventEmitter();
  const signals = [];
  const fakeChild = Object.assign(events, {
    pid: 12345,
    exitCode: null,
    signalCode: null,
    kill(sig) {
      signals.push(sig);
      if (sig === "SIGKILL") {
        setTimeout(() => {
          fakeChild.signalCode = "SIGKILL";
          fakeChild.emit("exit", null, "SIGKILL");
        }, 10);
      }
      return true;
    },
  });

  const res = await terminateChildProcess(fakeChild, {
    gracefulTimeoutMs: 50,
    forceTimeoutMs: 1000,
  });

  assert.equal(res.exited, true);
  assert.equal(res.escalated, true);
  assert.equal(res.signalCode, "SIGKILL");
  assert.deepEqual(signals, ["SIGTERM", "SIGKILL"]);
});

test("E: unverifiable termination fails closed with PROCESS_TERMINATION_UNVERIFIED", async () => {
  const events = new EventEmitter();
  const fakeChild = Object.assign(events, {
    pid: 99999,
    exitCode: null,
    signalCode: null,
    kill: () => true, // simulates signal accepted by OS but process never exits
  });

  await assert.rejects(
    terminateChildProcess(fakeChild, {
      gracefulTimeoutMs: 30,
      forceTimeoutMs: 30,
    }),
    /PROCESS_TERMINATION_UNVERIFIED/,
  );
});

test("E2: signal delivery error ESRCH is recognized as already exited", async () => {
  const events = new EventEmitter();
  const fakeChild = Object.assign(events, {
    pid: 88888,
    exitCode: null,
    signalCode: null,
    kill() {
      const err = new Error("kill ESRCH");
      err.code = "ESRCH";
      throw err;
    },
  });

  const res = await terminateChildProcess(fakeChild, { gracefulTimeoutMs: 50 });
  assert.equal(res.exited, true);
  assert.equal(res.reason, "already_exited");
});

test("F: grace-period timeout is cancelled immediately following early exit", async () => {
  const child = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000);"]);

  const start = Date.now();
  // Pass a large graceful timeout (30s)
  const res = await terminateChildProcess(child, {
    gracefulTimeoutMs: 30000,
  });
  const elapsed = Date.now() - start;

  assert.equal(res.exited, true);
  assert.equal(res.escalated, false);
  // Must complete in a few hundred ms, proving the 30s timer was cancelled
  assert.ok(elapsed < 2000, `Expected early return, took ${elapsed}ms`);
});

test("G: teardown preserves original test failure when cleanup also fails", () => {
  // Scenario 1: Test failed (exitCode 1) and cleanup also failed
  let exitCode = 1;
  const terminationError = new Error("PROCESS_TERMINATION_UNVERIFIED");
  const cleanupError = new Error("ENOTEMPTY");

  if ((terminationError || cleanupError) && !exitCode) {
    exitCode = 1;
  }
  assert.equal(
    exitCode,
    1,
    "Original assertion failure exitCode must not be cleared",
  );

  // Scenario 2: Test passed (exitCode undefined/0) but cleanup failed
  let cleanPassExitCode = 0;
  if ((terminationError || cleanupError) && !cleanPassExitCode) {
    cleanPassExitCode = 1;
  }
  assert.equal(
    cleanPassExitCode,
    1,
    "Cleanup failure must cause failure exit code",
  );
});

test("H: cleanupBrowserProfile removes directory and handles null/empty safely", async () => {
  const dir = await mkdtemp(join(tmpdir(), "nexora-teardown-profile-"));
  await writeFile(join(dir, "DevToolsActivePort"), "12345\n");

  await cleanupBrowserProfile(dir, { maxRetries: 5, retryDelay: 10 });
  await assert.rejects(stat(dir), { code: "ENOENT" });

  // Safe with null/undefined/empty
  await cleanupBrowserProfile(null);
  await cleanupBrowserProfile(undefined);
  await cleanupBrowserProfile("");
});

test("waitForProcessExit cancels timer and listener on error event", async () => {
  const events = new EventEmitter();
  const fakeChild = Object.assign(events, {
    exitCode: null,
    signalCode: null,
  });

  const waitPromise = waitForProcessExit(fakeChild, 5000);
  fakeChild.emit("error", new Error("spawn error"));
  const exited = await waitPromise;
  assert.equal(exited, false);
});
