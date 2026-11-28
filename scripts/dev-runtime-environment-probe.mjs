import { readdirSync, readFileSync, readlinkSync } from "node:fs";
import { setTimeout as delay } from "node:timers/promises";
import {
  SHARED_RUNTIME_ENV,
  API_DEV_PASSTHROUGH_ENV,
  IDENTITY_ENV,
} from "./helpers/runtime-environment-contract.mjs";

const defaultFsOps = { readdirSync, readFileSync, readlinkSync };

function makeProbeError(code, message, diagnostic, { retryable = false } = {}) {
  const err = new Error(message);
  err.code = code;
  err.retryable = retryable;
  err.diagnostic = diagnostic;
  return err;
}

function readSocketListeners(portHex, fsOps) {
  const listeners = new Set();
  let tablesRead = 0;
  let lastErr;
  for (const table of ["tcp", "tcp6"]) {
    try {
      const content = fsOps.readFileSync(`/proc/net/${table}`, "utf8");
      tablesRead++;
      for (const line of content.trim().split("\n").slice(1)) {
        const fields = line.trim().split(/\s+/);
        if (
          fields.length >= 10 &&
          fields[1].split(":").at(-1) === portHex &&
          fields[3] === "0A"
        ) {
          listeners.add(fields[9]);
        }
      }
    } catch (err) {
      lastErr = err;
    }
  }
  if (tablesRead === 0 && lastErr) throw lastErr;
  return listeners;
}

function readProcessArgs(pid, fsOps) {
  return fsOps
    .readFileSync(`/proc/${pid}/cmdline`, "utf8")
    .split("\0")
    .filter(Boolean);
}

function isMatchingRuntimeProcess(args, kind) {
  const bin = args[0]?.split("/").at(-1);
  if (!bin || !bin.startsWith("node") || args.includes("--watch")) {
    return false;
  }
  const entry =
    kind === "api" ? "dist/main.js" : "apps/api/dist/worker/main.js";
  return args.some((arg) => arg === entry || arg.endsWith(`/${entry}`));
}

function pidOwnsAnyListener(pid, listeners, fsOps) {
  return fsOps.readdirSync(`/proc/${pid}/fd`).some((fd) => {
    try {
      const link = fsOps.readlinkSync(`/proc/${pid}/fd/${fd}`);
      const match = link.match(/^socket:\[(\d+)\]$/);
      return match ? listeners.has(match[1]) : false;
    } catch {
      return false;
    }
  });
}

function inspectDevelopmentEnvironment(
  kind,
  expected = process.env,
  fsOps = defaultFsOps,
) {
  if (!["api", "sync-worker"].includes(kind)) {
    throw makeProbeError(
      "DEV_ENV_PROBE_KIND",
      "DEV_ENV_PROBE_KIND",
      {
        kind: typeof kind === "string" ? kind.slice(0, 32) : "invalid",
        phase: "VALIDATE_KIND",
        reason: "INVALID_KIND",
      },
      { retryable: false },
    );
  }

  const port = Number(expected.PORT ?? 4000)
    .toString(16)
    .toUpperCase()
    .padStart(4, "0");
  const listeners =
    kind === "api" ? readSocketListeners(port, fsOps) : new Set();

  const candidates = [];
  let matchingCmdlineCount = 0;
  let exitedDuringScan = false;

  for (const pid of fsOps
    .readdirSync("/proc")
    .filter((value) => /^\d+$/.test(value))) {
    let args;
    try {
      args = readProcessArgs(pid, fsOps);
    } catch {
      continue;
    }
    if (!isMatchingRuntimeProcess(args, kind)) continue;
    matchingCmdlineCount++;
    if (kind === "api") {
      try {
        if (!pidOwnsAnyListener(pid, listeners, fsOps)) continue;
      } catch {
        exitedDuringScan = true;
        continue;
      }
    }
    candidates.push({ pid, args });
  }

  if (candidates.length !== 1) {
    const reason =
      candidates.length > 1
        ? "MULTIPLE_MATCHING_PROCESSES"
        : exitedDuringScan
          ? "PROCESS_EXITED_DURING_DISCOVERY"
          : kind === "api" && matchingCmdlineCount > 0
            ? "LISTENER_NOT_READY"
            : "NO_MATCHING_PROCESS";
    throw makeProbeError(
      "DEV_ENV_ACTUAL_PROCESS_NOT_UNIQUE",
      "DEV_ENV_ACTUAL_PROCESS_NOT_UNIQUE",
      {
        kind,
        phase: "DISCOVERY",
        reason,
        candidateCount: candidates.length,
        matchingCmdlineCount,
        listenerCount: listeners.size,
      },
      { retryable: true },
    );
  }

  const target = candidates[0];
  let rawEnviron;
  try {
    rawEnviron = fsOps.readFileSync(`/proc/${target.pid}/environ`, "utf8");
  } catch {
    throw makeProbeError(
      "DEV_ENV_ACTUAL_PROCESS_NOT_UNIQUE",
      "DEV_ENV_ACTUAL_PROCESS_NOT_UNIQUE",
      {
        kind,
        phase: "READ_ENVIRON",
        reason: "PROCESS_EXITED_DURING_DISCOVERY",
        candidateCount: 0,
        matchingCmdlineCount,
        listenerCount: listeners.size,
      },
      { retryable: true },
    );
  }

  // Re-verify process cmdline and socket ownership after reading /environ to reject mid-restart snapshots.
  try {
    const postArgs = readProcessArgs(target.pid, fsOps);
    if (
      !isMatchingRuntimeProcess(postArgs, kind) ||
      postArgs.length !== target.args.length ||
      postArgs.some((arg, idx) => arg !== target.args[idx])
    ) {
      throw makeProbeError(
        "DEV_ENV_ACTUAL_PROCESS_NOT_UNIQUE",
        "DEV_ENV_ACTUAL_PROCESS_NOT_UNIQUE",
        {
          kind,
          phase: "POST_VERIFY",
          reason: "PROCESS_IDENTITY_CHANGED",
          candidateCount: 0,
          matchingCmdlineCount,
          listenerCount: listeners.size,
        },
        { retryable: true },
      );
    }
    if (kind === "api") {
      const postListeners = readSocketListeners(port, fsOps);
      if (!pidOwnsAnyListener(target.pid, postListeners, fsOps)) {
        throw makeProbeError(
          "DEV_ENV_ACTUAL_PROCESS_NOT_UNIQUE",
          "DEV_ENV_ACTUAL_PROCESS_NOT_UNIQUE",
          {
            kind,
            phase: "POST_VERIFY",
            reason: "LISTENER_NOT_READY",
            candidateCount: 0,
            matchingCmdlineCount,
            listenerCount: postListeners.size,
          },
          { retryable: true },
        );
      }
    }
  } catch (err) {
    if (err?.code === "DEV_ENV_ACTUAL_PROCESS_NOT_UNIQUE") throw err;
    throw makeProbeError(
      "DEV_ENV_ACTUAL_PROCESS_NOT_UNIQUE",
      "DEV_ENV_ACTUAL_PROCESS_NOT_UNIQUE",
      {
        kind,
        phase: "POST_VERIFY",
        reason: "PROCESS_EXITED_DURING_DISCOVERY",
        candidateCount: 0,
        matchingCmdlineCount,
        listenerCount: listeners.size,
      },
      { retryable: true },
    );
  }

  const env = Object.fromEntries(
    rawEnviron
      .split("\0")
      .filter(Boolean)
      .map((entry) => {
        const offset = entry.indexOf("=");
        return [entry.slice(0, offset), entry.slice(offset + 1)];
      }),
  );

  const keys = kind === "api" ? API_DEV_PASSTHROUGH_ENV : SHARED_RUNTIME_ENV;
  const mismatched = keys.filter(
    (key) => expected[key] === undefined || env[key] !== expected[key],
  );
  if (mismatched.length) {
    throw makeProbeError(
      "DEV_ENV_PROPAGATION_MISMATCH",
      "DEV_ENV_PROPAGATION_MISMATCH:" + mismatched.join(","),
      {
        kind,
        phase: "VALIDATE_ENV",
        reason: "PROPAGATION_MISMATCH",
        mismatchedCount: mismatched.length,
        candidateCount: 1,
        listenerCount: listeners.size,
      },
      { retryable: false },
    );
  }

  if (
    kind === "sync-worker" &&
    IDENTITY_ENV.some((key) => env[key] !== undefined)
  ) {
    throw makeProbeError(
      "DEV_ENV_WORKER_IDENTITY_EXPOSURE",
      "DEV_ENV_WORKER_IDENTITY_EXPOSURE",
      {
        kind,
        phase: "VALIDATE_ENV",
        reason: "WORKER_IDENTITY_EXPOSURE",
        candidateCount: 1,
        listenerCount: listeners.size,
      },
      { retryable: false },
    );
  }

  if (kind === "api" && IDENTITY_ENV.some((key) => !env[key])) {
    throw makeProbeError(
      "DEV_ENV_API_IDENTITY_MISSING",
      "DEV_ENV_API_IDENTITY_MISSING",
      {
        kind,
        phase: "VALIDATE_ENV",
        reason: "API_IDENTITY_MISSING",
        candidateCount: 1,
        listenerCount: listeners.size,
      },
      { retryable: false },
    );
  }

  let roleMatches = false;
  try {
    roleMatches =
      new URL(env.DATABASE_URL).username ===
      (kind === "api" ? "nexora_app" : "nexora_sync");
  } catch {
    /* Never include URL in diagnostics. */
  }
  if (!roleMatches) {
    throw makeProbeError(
      "DEV_ENV_DATABASE_ROLE",
      "DEV_ENV_DATABASE_ROLE",
      {
        kind,
        phase: "VALIDATE_DB_ROLE",
        reason: "DATABASE_ROLE_MISMATCH",
        candidateCount: 1,
        listenerCount: listeners.size,
      },
      { retryable: false },
    );
  }

  return {
    actualProcess: true,
    runtimeEnvironmentEqual: true,
    workerIdentityAbsent: kind === "sync-worker",
  };
}

/** Read only the real server/worker process, never the exec shell or watch supervisor. */
export function verifyDevelopmentEnvironment(
  kind,
  expected = process.env,
  { fsOps = defaultFsOps } = {},
) {
  try {
    return inspectDevelopmentEnvironment(kind, expected, fsOps);
  } catch (err) {
    if (err?.diagnostic) {
      err.diagnostic = {
        ...err.diagnostic,
        attempts: 1,
        elapsedMs: 0,
        deadlineReached: false,
      };
    }
    throw err;
  }
}

/** Bounded readiness wrapper retrying only transient watch-restart/discovery gaps. */
export async function waitForDevelopmentEnvironment(
  kind,
  expected = process.env,
  {
    timeoutMs = 15000,
    pollIntervalMs = 150,
    fsOps = defaultFsOps,
    now = Date.now,
    sleep = delay,
    onDiagnostic,
  } = {},
) {
  const startedAt = now();
  const deadline = startedAt + timeoutMs;
  let attempts = 0;

  while (true) {
    attempts++;
    try {
      const result = inspectDevelopmentEnvironment(kind, expected, fsOps);
      return {
        ...result,
        kind,
        attempts,
        elapsedMs: Math.max(0, Math.round(now() - startedAt)),
      };
    } catch (err) {
      const elapsedMs = Math.max(0, Math.round(now() - startedAt));
      if (!err?.retryable) {
        const diagnostic = {
          ...(err?.diagnostic ?? {}),
          attempts,
          elapsedMs,
          deadlineReached: false,
        };
        if (err && typeof err === "object") err.diagnostic = diagnostic;
        onDiagnostic?.(diagnostic);
        throw err;
      }

      const waitMs = Math.min(pollIntervalMs, deadline - now());
      if (waitMs <= 0) {
        const diagnostic = {
          ...(err?.diagnostic ?? {}),
          attempts,
          elapsedMs,
          deadlineReached: true,
        };
        if (err && typeof err === "object") err.diagnostic = diagnostic;
        onDiagnostic?.(diagnostic);
        throw err;
      }
      await sleep(waitMs);
    }
  }
}
