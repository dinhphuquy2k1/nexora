import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  browserStartupSummary,
  parseDevToolsPort,
  waitForBrowserDevTools,
} from "./browser-startup-diagnostics.mjs";

function makeFakeClock(stepMs = 10) {
  let time = 1000;
  return {
    now: () => time,
    sleep: async (ms) => {
      time += Math.max(ms, stepMs);
    },
  };
}

test("startup diagnostics expose only fixed hints and numeric status, never raw browser output", () => {
  const secret = "private-credential-and-url";
  const summary = browserStartupSummary(
    `FATAL pthread_create: Resource temporarily unavailable ${secret}`,
    { exitCode: 133, signalCode: "SIGTRAP" },
  );
  assert.deepEqual(summary.hints, ["RESOURCE_LIMIT", "CRASH"]);
  assert.equal(summary.exitCode, 133);
  assert.equal(summary.signal, "SIGTRAP");
  assert.equal(JSON.stringify(summary).includes(secret), false);
  assert.equal(
    browserStartupSummary(secret, { exitCode: secret, signalCode: secret })
      .signal,
    null,
  );
  assert.equal(browserStartupSummary(secret).exitCode, null);
});

test("parseDevToolsPort accepts only 1..65535 line-1 integers", () => {
  assert.equal(parseDevToolsPort("9222\n/devtools/browser/abc\n"), 9222);
  assert.equal(parseDevToolsPort(" 45123 \r\n"), 45123);
  for (const invalid of [
    "",
    "   \n",
    "0\n",
    "65536\n",
    "-1\n",
    "not-a-port\n",
    "9222abc\n",
  ]) {
    assert.equal(
      parseDevToolsPort(invalid),
      null,
      `Expected null for ${JSON.stringify(invalid)}`,
    );
  }
});

test("Case 1: empty DevToolsActivePort retries boundedly until valid port appears", async () => {
  const dir = await mkdtemp(join(tmpdir(), "nexora-bsd-empty-"));
  const { now, sleep } = makeFakeClock();
  try {
    await writeFile(join(dir, "DevToolsActivePort"), "");
    let polls = 0;
    const result = await waitForBrowserDevTools({
      profileDir: dir,
      child: { exitCode: null, signalCode: null },
      timeoutMs: 1000,
      pollIntervalMs: 50,
      now,
      sleep,
      readFileFn: async (p, enc) => {
        polls++;
        if (polls === 3) {
          await writeFile(
            join(dir, "DevToolsActivePort"),
            "41234\n/devtools/browser/1\n",
          );
        }
        return (await import("node:fs/promises")).readFile(p, enc);
      },
      fetchFn: async (url) => {
        assert.equal(url, "http://127.0.0.1:41234/json/list");
        return {
          ok: true,
          status: 200,
          json: async () => [
            {
              type: "page",
              webSocketDebuggerUrl: "ws://127.0.0.1:41234/devtools/page/1",
            },
          ],
        };
      },
    });
    assert.equal(result.port, 41234);
    assert.equal(result.wsUrl, "ws://127.0.0.1:41234/devtools/page/1");
    assert.ok(result.attempts >= 3);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("Case 2: missing port file -> empty write -> empty targets -> page target appears succeeds", async () => {
  const { now, sleep } = makeFakeClock();
  let tick = 0;
  const result = await waitForBrowserDevTools({
    profileDir: "/virtual-profile",
    child: { exitCode: null, signalCode: null },
    timeoutMs: 1000,
    pollIntervalMs: 50,
    targetsPath: "/json",
    now,
    sleep,
    readFileFn: async () => {
      tick++;
      if (tick === 1) {
        const e = new Error("ENOENT");
        e.code = "ENOENT";
        throw e;
      }
      if (tick === 2) return "";
      return "39001\n/devtools/browser/id\n";
    },
    fetchFn: async (url) => {
      assert.equal(url, "http://127.0.0.1:39001/json");
      if (tick === 3) {
        return { ok: true, status: 200, json: async () => [] };
      }
      return {
        ok: true,
        status: 200,
        json: async () => [
          {
            type: "background_page",
            webSocketDebuggerUrl: "ws://127.0.0.1:39001/bg",
          },
          {
            type: "page",
            webSocketDebuggerUrl: "ws://127.0.0.1:39001/devtools/page/ok",
          },
        ],
      };
    },
  });
  assert.equal(result.port, 39001);
  assert.equal(result.wsUrl, "ws://127.0.0.1:39001/devtools/page/ok");
  assert.equal(result.attempts, 4);
});

test("Case 3: invalid port values fail cleanly with INVALID_PORT without calling fetch", async () => {
  for (const content of ["0\n", "not-a-port\n", "70000\n"]) {
    const { now, sleep } = makeFakeClock();
    let fetchCalls = 0;
    let diag;
    await assert.rejects(
      () =>
        waitForBrowserDevTools({
          profileDir: "/virtual-profile",
          child: { exitCode: null, signalCode: null },
          timeoutMs: 150,
          pollIntervalMs: 50,
          now,
          sleep,
          readFileFn: async () => content,
          fetchFn: async () => {
            fetchCalls++;
            throw new Error("should not call fetch");
          },
          onDiagnostic: (d) => {
            diag = d;
          },
        }),
      (err) => err.code === "INVALID_PORT",
    );
    assert.equal(fetchCalls, 0);
    assert.equal(diag.reason, "INVALID_PORT");
    assert.equal(diag.portValid, false);
    assert.equal(diag.hasPortFile, true);
  }
});

test("Case 4: early Chromium exit fails immediately without polling to deadline and surfaces hints", async () => {
  const { now, sleep } = makeFakeClock();
  const secret = "sensitive-profile-path-or-cookie";
  let sleepCalls = 0;
  let diag;
  await assert.rejects(
    () =>
      waitForBrowserDevTools({
        profileDir: "/virtual-profile",
        child: { exitCode: 133, signalCode: null },
        timeoutMs: 20000,
        pollIntervalMs: 100,
        now,
        sleep: async (ms) => {
          sleepCalls++;
          await sleep(ms);
        },
        readFileFn: async () => "45678\n",
        fetchFn: async () => {
          throw new Error("should not fetch after exit");
        },
        getStartupStderr: () => `FATAL pthread_create: Cannot fork ${secret}`,
        onDiagnostic: (d) => {
          diag = d;
        },
      }),
    (err) => err.code === "BROWSER_EXITED",
  );
  assert.equal(sleepCalls, 0);
  assert.equal(diag.reason, "BROWSER_EXITED");
  assert.equal(diag.startup.exitCode, 133);
  assert.deepEqual(diag.startup.hints, ["RESOURCE_LIMIT", "CRASH"]);
  assert.equal(JSON.stringify(diag).includes(secret), false);
});

test("Case 5: valid port + HTTP ECONNREFUSED retries boundedly then fails cleanly at deadline", async () => {
  const { now, sleep } = makeFakeClock();
  let fetchCalls = 0;
  let diag;
  await assert.rejects(
    () =>
      waitForBrowserDevTools({
        profileDir: "/virtual-profile",
        child: { exitCode: null, signalCode: null },
        timeoutMs: 200,
        pollIntervalMs: 50,
        now,
        sleep,
        readFileFn: async () => "42001\n",
        fetchFn: async () => {
          fetchCalls++;
          const err = new Error("connect ECONNREFUSED 127.0.0.1:42001");
          err.code = "ECONNREFUSED";
          throw err;
        },
        onDiagnostic: (d) => {
          diag = d;
        },
      }),
    (err) => err.code === "ECONNREFUSED",
  );
  assert.ok(fetchCalls >= 2);
  assert.equal(diag.portValid, true);
  assert.equal(diag.targetsReached, false);
  assert.equal(diag.reason, "DEVTOOLS_CONNECTION_REFUSED");
});

test("Case 6: valid port + /json timeout fails cleanly with TimeoutError and TIMEOUT code", async () => {
  const { now, sleep } = makeFakeClock();
  let observedSignal;
  let diag;
  await assert.rejects(
    () =>
      waitForBrowserDevTools({
        profileDir: "/virtual-profile",
        child: { exitCode: null, signalCode: null },
        timeoutMs: 120,
        pollIntervalMs: 50,
        fetchTimeoutMs: 50,
        now,
        sleep,
        readFileFn: async () => "42002\n",
        fetchFn: async (_url, { signal }) => {
          observedSignal = signal;
          const err = new Error("The operation timed out");
          err.name = "TimeoutError";
          throw err;
        },
        onDiagnostic: (d) => {
          diag = d;
        },
      }),
    (err) => err.name === "TimeoutError" && err.code === "TIMEOUT",
  );
  assert.ok(observedSignal instanceof AbortSignal);
  assert.equal(diag.reason, "DEVTOOLS_FETCH_TIMEOUT");
});

test("Case 7: valid port + 200 JSON without page target fails with PAGE_TARGET_NOT_READY", async () => {
  const { now, sleep } = makeFakeClock();
  let diag;
  await assert.rejects(
    () =>
      waitForBrowserDevTools({
        profileDir: "/virtual-profile",
        child: { exitCode: null, signalCode: null },
        timeoutMs: 120,
        pollIntervalMs: 50,
        now,
        sleep,
        readFileFn: async () => "42003\n",
        fetchFn: async () => ({
          ok: true,
          status: 200,
          json: async () => [
            {
              type: "service_worker",
              webSocketDebuggerUrl: "ws://127.0.0.1:42003/sw",
            },
          ],
        }),
        onDiagnostic: (d) => {
          diag = d;
        },
      }),
    (err) => err.code === "PAGE_TARGET_NOT_READY",
  );
  assert.equal(diag.targetsReached, true);
  assert.equal(diag.targetCount, 1);
  assert.equal(diag.reason, "PAGE_TARGET_NOT_READY");
});

test("Case 8: sanitized diagnostics never leak raw DevToolsActivePort contents, URLs, stderr, or tokens", async () => {
  const { now, sleep } = makeFakeClock();
  const secretToken = "token=top-secret-bearer-value";
  const secretProfile = `/tmp/secret-profile-${secretToken}`;
  let diag;
  let caught;
  try {
    await waitForBrowserDevTools({
      profileDir: secretProfile,
      child: { exitCode: 1, signalCode: null },
      timeoutMs: 200,
      pollIntervalMs: 50,
      now,
      sleep,
      getStartupStderr: () =>
        `ERROR: ${secretToken} https://internal.example/secret`,
      onDiagnostic: (d) => {
        diag = d;
      },
    });
  } catch (err) {
    caught = err;
  }
  assert.ok(caught);
  const serialized = JSON.stringify({ message: caught.message, diag });
  assert.equal(serialized.includes(secretToken), false);
  assert.equal(serialized.includes("internal.example"), false);
  assert.equal(serialized.includes(secretProfile), false);
});
