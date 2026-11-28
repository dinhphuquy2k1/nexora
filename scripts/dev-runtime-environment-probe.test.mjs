import test from "node:test";
import assert from "node:assert/strict";
import {
  SHARED_RUNTIME_ENV,
  API_DEV_PASSTHROUGH_ENV,
  IDENTITY_ENV,
} from "./helpers/runtime-environment-contract.mjs";
import {
  verifyDevelopmentEnvironment,
  waitForDevelopmentEnvironment,
} from "./dev-runtime-environment-probe.mjs";

function makeExpectedEnv(kind = "api", overrides = {}) {
  const base = {};
  for (const key of SHARED_RUNTIME_ENV) base[key] = `val-${key}`;
  for (const key of API_DEV_PASSTHROUGH_ENV) base[key] = `val-${key}`;
  base.PORT = "4000";
  base.WEB_PORT = "127.0.0.1:3001";
  base.ALLOWED_ORIGINS = "http://127.0.0.1:3001";
  base.DATABASE_URL =
    kind === "api"
      ? "postgresql://nexora_app:secret-pass@postgres:5432/nexora"
      : "postgresql://nexora_sync:secret-pass@postgres:5432/nexora";
  if (kind === "sync-worker") {
    for (const key of IDENTITY_ENV) delete base[key];
  } else {
    base.IDENTITY_KEYRING_JSON =
      '{"1":"AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE="}';
    base.IDENTITY_ACTIVE_KEY_VERSION = "1";
  }
  return { ...base, ...overrides };
}

function makeEnvironBytes(envMap) {
  return (
    Object.entries(envMap)
      .map(([k, v]) => `${k}=${v}`)
      .join("\0") + "\0"
  );
}

function makeProcFs({
  tcp = "sl local_address rem_address st tx_queue rx_queue tr tm->when retrnsmt uid timeout inode\n 0: 00000000:0FA0 00000000:0000 0A 00000000:00000000 00:00000000 00000000 1001 0 9001 1 00000000 100 0 0 10 0\n",
  tcp6 = "sl local_address rem_address st tx_queue rx_queue tr tm->when retrnsmt uid timeout inode\n",
  procs = [],
}) {
  const procMap = new Map(procs.map((p) => [String(p.pid), p]));
  return {
    readdirSync(path) {
      if (path === "/proc") return [...procMap.keys(), "net", "self"];
      const m = path.match(/^\/proc\/(\d+)\/fd$/);
      if (m && procMap.has(m[1])) {
        return Object.keys(procMap.get(m[1]).fds ?? {});
      }
      const err = new Error(`ENOENT: ${path}`);
      err.code = "ENOENT";
      throw err;
    },
    readFileSync(path) {
      if (path === "/proc/net/tcp")
        return typeof tcp === "function" ? tcp() : tcp;
      if (path === "/proc/net/tcp6")
        return typeof tcp6 === "function" ? tcp6() : tcp6;
      const cm = path.match(/^\/proc\/(\d+)\/cmdline$/);
      if (cm && procMap.has(cm[1])) {
        const entry = procMap.get(cm[1]);
        const args =
          typeof entry.cmdline === "function" ? entry.cmdline() : entry.cmdline;
        return args.join("\0") + "\0";
      }
      const em = path.match(/^\/proc\/(\d+)\/environ$/);
      if (em && procMap.has(em[1])) {
        const entry = procMap.get(em[1]);
        const env = typeof entry.env === "function" ? entry.env() : entry.env;
        return makeEnvironBytes(env);
      }
      const err = new Error(`ENOENT: ${path}`);
      err.code = "ENOENT";
      throw err;
    },
    readlinkSync(path) {
      const lm = path.match(/^\/proc\/(\d+)\/fd\/(.+)$/);
      if (lm && procMap.has(lm[1])) {
        const fds = procMap.get(lm[1]).fds ?? {};
        if (Object.hasOwn(fds, lm[2])) return fds[lm[2]];
      }
      const err = new Error(`ENOENT: ${path}`);
      err.code = "ENOENT";
      throw err;
    },
  };
}

function makeClock(step = 20) {
  let time = 1000;
  return {
    now: () => time,
    sleep: async (ms) => {
      time += Math.max(ms, step);
    },
  };
}

test("Case 1: transient 0 -> 1 process discovery transitions cleanly to PASS within deadline", async () => {
  const expected = makeExpectedEnv("api");
  const { now, sleep } = makeClock();
  let poll = 0;
  const fsOps = makeProcFs({
    procs: [
      {
        pid: 42,
        cmdline: () => {
          poll++;
          // Poll 1: no child yet; Poll 2: node dist/main.js running without socket; Poll 3: healthy
          return poll === 1
            ? ["/bin/sh", "-c", "sleep"]
            : ["/usr/local/bin/node", "/workspace/apps/api/dist/main.js"];
        },
        fds: { 10: "socket:[9001]" },
        env: expected,
      },
    ],
  });
  // Wrap fds check so poll 2 has no listener socket yet
  const origReaddir = fsOps.readdirSync;
  fsOps.readdirSync = (p) => {
    if (p === "/proc/42/fd" && poll < 3) return [];
    return origReaddir(p);
  };
  const result = await waitForDevelopmentEnvironment("api", expected, {
    timeoutMs: 1000,
    pollIntervalMs: 50,
    fsOps,
    now,
    sleep,
  });
  assert.equal(result.actualProcess, true);
  assert.equal(result.runtimeEnvironmentEqual, true);
  assert.equal(result.attempts, 3);
});

test("Case 2: PID disappearing mid-/environ read or identity shifting post-environ retries cleanly to PASS", async () => {
  const expected = makeExpectedEnv("api");
  const { now, sleep } = makeClock();
  let phase = 1;
  let readEnvironCount = 0;
  const fsOps = {
    readdirSync(p) {
      if (p === "/proc") return phase === 1 ? ["101"] : ["102"];
      if (p === "/proc/101/fd" || p === "/proc/102/fd") return ["10"];
      throw Object.assign(new Error("ENOENT"), { code: "ENOENT" });
    },
    readFileSync(p) {
      if (p === "/proc/net/tcp") {
        return "sl local_address rem_address st tx_queue rx_queue tr tm->when retrnsmt uid timeout inode\n 0: 00000000:0FA0 00000000:0000 0A 00 00 00 1001 0 9001\n";
      }
      if (p === "/proc/net/tcp6") return "sl\n";
      if (p === "/proc/101/cmdline")
        return "/usr/local/bin/node\0dist/main.js\0";
      if (p === "/proc/101/environ") {
        readEnvironCount++;
        phase = 2;
        const err = new Error("ESRCH");
        err.code = "ESRCH";
        throw err;
      }
      if (p === "/proc/102/cmdline")
        return "/usr/local/bin/node\0dist/main.js\0";
      if (p === "/proc/102/environ") return makeEnvironBytes(expected);
      throw Object.assign(new Error("ENOENT"), { code: "ENOENT" });
    },
    readlinkSync(p) {
      if (p === "/proc/101/fd/10" || p === "/proc/102/fd/10")
        return "socket:[9001]";
      throw Object.assign(new Error("ENOENT"), { code: "ENOENT" });
    },
  };
  const result = await waitForDevelopmentEnvironment("api", expected, {
    timeoutMs: 1000,
    pollIntervalMs: 50,
    fsOps,
    now,
    sleep,
  });
  assert.equal(readEnvironCount, 1);
  assert.equal(result.attempts, 2);
  assert.equal(result.actualProcess, true);
});

test("Case 3: persistent 0 candidates fail at deadline with DEV_ENV_ACTUAL_PROCESS_NOT_UNIQUE and sanitized diagnostic", async () => {
  const expected = makeExpectedEnv("api");
  const { now, sleep } = makeClock();
  let diag;
  await assert.rejects(
    () =>
      waitForDevelopmentEnvironment("api", expected, {
        timeoutMs: 120,
        pollIntervalMs: 50,
        fsOps: makeProcFs({ procs: [] }),
        now,
        sleep,
        onDiagnostic: (d) => {
          diag = d;
        },
      }),
    (err) => err.message === "DEV_ENV_ACTUAL_PROCESS_NOT_UNIQUE",
  );
  assert.equal(diag.kind, "api");
  assert.equal(diag.candidateCount, 0);
  assert.equal(diag.deadlineReached, true);
});

test("Case 4: persistent 2 matching processes fail closed with candidateCount === 2", async () => {
  const expected = makeExpectedEnv("sync-worker");
  const { now, sleep } = makeClock();
  let diag;
  const fsOps = makeProcFs({
    procs: [
      {
        pid: 11,
        cmdline: ["/usr/local/bin/node", "apps/api/dist/worker/main.js"],
        env: expected,
      },
      {
        pid: 12,
        cmdline: ["/usr/local/bin/node", "apps/api/dist/worker/main.js"],
        env: expected,
      },
    ],
  });
  await assert.rejects(
    () =>
      waitForDevelopmentEnvironment("sync-worker", expected, {
        timeoutMs: 120,
        pollIntervalMs: 50,
        fsOps,
        now,
        sleep,
        onDiagnostic: (d) => {
          diag = d;
        },
      }),
    (err) => err.message === "DEV_ENV_ACTUAL_PROCESS_NOT_UNIQUE",
  );
  assert.equal(diag.candidateCount, 2);
  assert.equal(diag.deadlineReached, true);
  assert.throws(
    () => verifyDevelopmentEnvironment("sync-worker", expected, { fsOps }),
    /DEV_ENV_ACTUAL_PROCESS_NOT_UNIQUE/,
  );
});

test("Case 5: DEV_ENV_PROPAGATION_MISMATCH fails immediately without retry", async () => {
  const expected = makeExpectedEnv("api");
  const procEnv = makeExpectedEnv("api", {
    ALLOWED_ORIGINS: "https://wrong.example",
  });
  const { now, sleep } = makeClock();
  let sleepCalls = 0;
  let diag;
  const fsOps = makeProcFs({
    procs: [
      {
        pid: 21,
        cmdline: ["node", "dist/main.js"],
        fds: { 3: "socket:[9001]" },
        env: procEnv,
      },
    ],
  });
  await assert.rejects(
    () =>
      waitForDevelopmentEnvironment("api", expected, {
        timeoutMs: 5000,
        pollIntervalMs: 50,
        fsOps,
        now,
        sleep: async (ms) => {
          sleepCalls++;
          await sleep(ms);
        },
        onDiagnostic: (d) => {
          diag = d;
        },
      }),
    (err) =>
      err.message.startsWith("DEV_ENV_PROPAGATION_MISMATCH:ALLOWED_ORIGINS"),
  );
  assert.equal(sleepCalls, 0);
  assert.equal(diag.attempts, 1);
  assert.equal(diag.deadlineReached, false);
});

test("Case 6: DEV_ENV_WORKER_IDENTITY_EXPOSURE fails immediately without retry", async () => {
  const expected = makeExpectedEnv("sync-worker");
  const procEnv = makeExpectedEnv("sync-worker", {
    IDENTITY_KEYRING_JSON: "leaked",
  });
  const { now, sleep } = makeClock();
  let sleepCalls = 0;
  let diag;
  const fsOps = makeProcFs({
    procs: [
      {
        pid: 31,
        cmdline: ["node", "apps/api/dist/worker/main.js"],
        env: procEnv,
      },
    ],
  });
  await assert.rejects(
    () =>
      waitForDevelopmentEnvironment("sync-worker", expected, {
        timeoutMs: 5000,
        fsOps,
        now,
        sleep: async (ms) => {
          sleepCalls++;
          await sleep(ms);
        },
        onDiagnostic: (d) => {
          diag = d;
        },
      }),
    /DEV_ENV_WORKER_IDENTITY_EXPOSURE/,
  );
  assert.equal(sleepCalls, 0);
  assert.equal(diag.attempts, 1);
});

test("Case 7: DEV_ENV_API_IDENTITY_MISSING fails immediately without retry", async () => {
  const expected = makeExpectedEnv("api");
  const procEnv = makeExpectedEnv("api");
  delete procEnv.IDENTITY_KEYRING_JSON;
  delete expected.IDENTITY_KEYRING_JSON;
  // Make API_DEV_PASSTHROUGH_ENV check pass? Note IDENTITY_KEYRING_JSON IS in API_DEV_PASSTHROUGH_ENV unless empty string!
  expected.IDENTITY_KEYRING_JSON = "";
  procEnv.IDENTITY_KEYRING_JSON = "";
  const { now } = makeClock();
  let sleepCalls = 0;
  const fsOps = makeProcFs({
    procs: [
      {
        pid: 41,
        cmdline: ["node", "dist/main.js"],
        fds: { 3: "socket:[9001]" },
        env: procEnv,
      },
    ],
  });
  await assert.rejects(
    () =>
      waitForDevelopmentEnvironment("api", expected, {
        timeoutMs: 5000,
        fsOps,
        now,
        sleep: async () => {
          sleepCalls++;
        },
      }),
    /DEV_ENV_API_IDENTITY_MISSING/,
  );
  assert.equal(sleepCalls, 0);
});

test("Case 8: DEV_ENV_DATABASE_ROLE fails immediately without retry or exposing DATABASE_URL", async () => {
  const expected = makeExpectedEnv("api", {
    DATABASE_URL:
      "postgresql://nexora_sync:secret-password@postgres:5432/nexora",
  });
  const { now } = makeClock();
  let sleepCalls = 0;
  let diag;
  const fsOps = makeProcFs({
    procs: [
      {
        pid: 51,
        cmdline: ["node", "dist/main.js"],
        fds: { 3: "socket:[9001]" },
        env: expected,
      },
    ],
  });
  await assert.rejects(
    () =>
      waitForDevelopmentEnvironment("api", expected, {
        timeoutMs: 5000,
        fsOps,
        now,
        sleep: async () => {
          sleepCalls++;
        },
        onDiagnostic: (d) => {
          diag = d;
        },
      }),
    (err) => err.message === "DEV_ENV_DATABASE_ROLE",
  );
  assert.equal(sleepCalls, 0);
  assert.equal(diag.attempts, 1);
  assert.equal(JSON.stringify(diag).includes("secret-password"), false);
});

test("Case 9: --watch supervisor is ignored and does not trigger false failure alongside real child", async () => {
  const expected = makeExpectedEnv("api");
  const fsOps = makeProcFs({
    procs: [
      {
        pid: 61,
        cmdline: ["node", "--watch", "dist/main.js"],
        fds: { 3: "socket:[9001]" },
        env: expected,
      },
      {
        pid: 62,
        cmdline: ["node", "dist/main.js"],
        fds: { 4: "socket:[9001]" },
        env: expected,
      },
    ],
  });
  const res = verifyDevelopmentEnvironment("api", expected, { fsOps });
  assert.equal(res.actualProcess, true);

  const watchOnlyFs = makeProcFs({
    procs: [
      {
        pid: 61,
        cmdline: ["node", "--watch", "dist/main.js"],
        fds: { 3: "socket:[9001]" },
        env: expected,
      },
    ],
  });
  assert.throws(
    () => verifyDevelopmentEnvironment("api", expected, { fsOps: watchOnlyFs }),
    (err) =>
      err.message === "DEV_ENV_ACTUAL_PROCESS_NOT_UNIQUE" &&
      err.diagnostic.candidateCount === 0 &&
      err.diagnostic.matchingCmdlineCount === 0,
  );
});

test("Case 10: sanitized diagnostics never contain cmdlines, DATABASE_URL, keys, or raw env values", async () => {
  const secretPass = "super-secret-db-pass-999";
  const secretKey = "top-secret-keyring-material";
  const secretOrigin = "https://private-origin-marker.local";
  const expected = makeExpectedEnv("api", {
    DATABASE_URL: `postgresql://nexora_sync:${secretPass}@postgres:5432/nexora`,
    IDENTITY_KEYRING_JSON: secretKey,
    ALLOWED_ORIGINS: secretOrigin,
  });
  const { now, sleep } = makeClock();
  let capturedDiag;
  let caughtErr;
  try {
    await waitForDevelopmentEnvironment("api", expected, {
      timeoutMs: 60,
      pollIntervalMs: 30,
      fsOps: makeProcFs({
        procs: [
          {
            pid: 71,
            cmdline: ["node", "/secret-arg/dist/main.js", "--secret-flag"],
            fds: {},
            env: expected,
          },
        ],
      }),
      now,
      sleep,
      onDiagnostic: (d) => {
        capturedDiag = d;
      },
    });
  } catch (err) {
    caughtErr = err;
  }
  assert.ok(caughtErr);
  const blob = JSON.stringify({
    message: caughtErr.message,
    diag: capturedDiag,
  });
  for (const forbidden of [
    secretPass,
    secretKey,
    secretOrigin,
    "/secret-arg",
    "--secret-flag",
    "postgresql://",
  ]) {
    assert.equal(
      blob.includes(forbidden),
      false,
      `Diagnostic leaked ${forbidden}`,
    );
  }
});

test("Case 2b: post-/environ cmdline or listener mutation triggers retry and passes once stabilized", async () => {
  const expected = makeExpectedEnv("api");
  const { now, sleep } = makeClock();
  let cmdChecks = 0;
  let listenerOwned = false;
  const fsOps = {
    readdirSync(p) {
      if (p === "/proc") return ["201"];
      if (p === "/proc/201/fd") return listenerOwned ? ["10"] : [];
      throw Object.assign(new Error("ENOENT"), { code: "ENOENT" });
    },
    readFileSync(p) {
      if (p === "/proc/net/tcp") {
        return "sl local_address rem_address st tx_queue rx_queue tr tm->when retrnsmt uid timeout inode\n 0: 00000000:0FA0 00000000:0000 0A 00 00 00 1001 0 9001\n";
      }
      if (p === "/proc/net/tcp6") return "sl\n";
      if (p === "/proc/201/cmdline") {
        cmdChecks++;
        if (cmdChecks === 1) {
          listenerOwned = true;
          return "/usr/local/bin/node\0dist/main.js\0";
        }
        if (cmdChecks === 2) {
          // Mutated cmdline right after /environ on poll 1; poll 2 stabilizes cleanly
          return "/usr/local/bin/node\0--watch\0dist/main.js\0";
        }
        return "/usr/local/bin/node\0dist/main.js\0";
      }
      if (p === "/proc/201/environ") return makeEnvironBytes(expected);
      throw Object.assign(new Error("ENOENT"), { code: "ENOENT" });
    },
    readlinkSync(p) {
      if (p === "/proc/201/fd/10") return "socket:[9001]";
      throw Object.assign(new Error("ENOENT"), { code: "ENOENT" });
    },
  };
  const result = await waitForDevelopmentEnvironment("api", expected, {
    timeoutMs: 1000,
    pollIntervalMs: 50,
    fsOps,
    now,
    sleep,
  });
  assert.equal(result.attempts, 2);
  assert.equal(result.actualProcess, true);
});

test("Case 8b: DEV_ENV_PROBE_KIND fails immediately without retry", async () => {
  const { now } = makeClock();
  let sleepCalls = 0;
  let diag;
  await assert.rejects(
    () =>
      waitForDevelopmentEnvironment("web", makeExpectedEnv("api"), {
        timeoutMs: 5000,
        now,
        sleep: async () => {
          sleepCalls++;
        },
        onDiagnostic: (d) => {
          diag = d;
        },
      }),
    (err) => err.code === "DEV_ENV_PROBE_KIND",
  );
  assert.equal(sleepCalls, 0);
  assert.equal(diag.attempts, 1);
  assert.equal(diag.deadlineReached, false);
});
