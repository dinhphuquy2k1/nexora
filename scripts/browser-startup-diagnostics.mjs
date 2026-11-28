import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { isProcessExited } from "./browser-teardown.mjs";

// Startup-only, fixed vocabulary: never return raw Chromium stderr or environment.
export function browserStartupSummary(stderr, { exitCode, signalCode } = {}) {
  const hints = [
    ["CRASHPAD", /crashpad/i],
    ["SANDBOX", /no usable sandbox|sandbox_linux|no sandbox/i],
    ["DISK_FULL", /no space left|disk full/i],
    ["PERMISSION", /permission denied|EACCES/i],
    [
      "RESOURCE_LIMIT",
      /resource temporarily unavailable|pthread_create|cannot fork/i,
    ],
    ["PROFILE_LOCK", /ProcessSingleton|SingletonLock|profile.*in use/i],
    [
      "NAMESPACE_POLICY",
      /failed to move to new namespace|operation not permitted/i,
    ],
    ["DISPLAY", /missing X server|unable to open X display/i],
    [
      "SHARED_LIBRARY",
      /error while loading shared libraries|cannot open shared object/i,
    ],
    ["CRASH", /trace.breakpoint trap|SIGTRAP|check failed|FATAL/i],
    ["DEBUGGER_LISTENING", /DevTools listening/i],
  ]
    .filter(([, pattern]) => pattern.test(stderr))
    .map(([name]) => name);
  return {
    exitCode: Number.isInteger(exitCode) ? exitCode : null,
    signal: ["SIGTRAP", "SIGABRT", "SIGKILL", "SIGSEGV", "SIGTERM"].includes(
      signalCode,
    )
      ? signalCode
      : null,
    stderrBytes: Buffer.byteLength(stderr),
    hints,
  };
}

/** Parse DevToolsActivePort line 1 strictly; reject empty, 0, non-numeric, or out-of-range values. */
export function parseDevToolsPort(raw) {
  if (typeof raw !== "string") return null;
  const firstLine = raw.split(/\r?\n/)[0]?.trim() ?? "";
  if (!/^\d+$/.test(firstLine)) return null;
  const port = Number(firstLine);
  if (!Number.isSafeInteger(port) || port < 1 || port > 65535) return null;
  return port;
}

/**
 * Bounded wait for Chromium DevToolsActivePort readiness and page WebSocket target.
 * Fails immediately if Chromium exits early, never breaks on empty/partial DevToolsActivePort,
 * and emits only sanitized startup/phase diagnostics without raw stderr, URLs, or secrets.
 */
export async function waitForBrowserDevTools({
  profileDir,
  child,
  timeoutMs = 20000,
  pollIntervalMs = 100,
  fetchTimeoutMs = 2000,
  targetsPath = "/json/list",
  readFileFn = readFile,
  fetchFn = fetch,
  now = Date.now,
  sleep = delay,
  getStartupStderr = () => "",
  onDiagnostic,
}) {
  if (typeof profileDir !== "string" || !profileDir) {
    throw new Error("BROWSER_PROFILE_DIR_REQUIRED");
  }
  const startedAt = now();
  const deadline = startedAt + timeoutMs;
  let attempts = 0;
  let lastPhase;
  let lastReason = "TIMEOUT";
  let lastErrorCode = null;
  let lastErrorName = null;
  let hasPortFile = false;
  let portValid = false;
  let targetsReached = false;
  let targetCount = 0;

  const fail = (phase, reason, code = reason, errorName = null) => {
    const diagnostic = {
      phase,
      reason,
      elapsedMs: Math.max(0, Math.round(now() - startedAt)),
      deadlineMs: timeoutMs,
      attempts,
      hasPortFile,
      portValid,
      targetsReached,
      targetCount,
      startup: browserStartupSummary(getStartupStderr(), child ?? {}),
    };
    onDiagnostic?.(diagnostic);
    const err = new Error(`Browser DevTools startup failed (${reason})`);
    err.code = code;
    if (errorName) err.name = errorName;
    err.diagnostic = diagnostic;
    throw err;
  };

  while (true) {
    if (isProcessExited(child)) {
      fail("PROCESS_CHECK", "BROWSER_EXITED", "BROWSER_EXITED");
    }
    attempts++;

    let rawPortFile;
    lastPhase = "PORT_FILE_READ";
    try {
      const content = await readFileFn(
        join(profileDir, "DevToolsActivePort"),
        "utf8",
      );
      rawPortFile = typeof content === "string" ? content : String(content);
      hasPortFile = true;
    } catch (err) {
      lastReason =
        err?.code === "ENOENT" ? "PORT_FILE_MISSING" : "PORT_FILE_READ_ERROR";
      lastErrorCode = null;
      lastErrorName = null;
    }

    if (rawPortFile !== undefined) {
      if (rawPortFile.trim().length === 0) {
        lastPhase = "PORT_FILE_READ";
        lastReason = "PORT_FILE_EMPTY_OR_INCOMPLETE";
        portValid = false;
        lastErrorCode = null;
        lastErrorName = null;
      } else {
        const port = parseDevToolsPort(rawPortFile);
        if (port === null) {
          lastPhase = "PORT_VALIDATION";
          lastReason = "INVALID_PORT";
          portValid = false;
          lastErrorCode = "INVALID_PORT";
          lastErrorName = null;
        } else {
          portValid = true;
          lastPhase = "TARGETS_FETCH";
          const remainingMs = Math.max(1, Math.round(deadline - now()));
          const reqTimeout = Math.max(1, Math.min(fetchTimeoutMs, remainingMs));
          try {
            const response = await fetchFn(
              `http://127.0.0.1:${port}${targetsPath}`,
              { signal: AbortSignal.timeout(reqTimeout) },
            );
            if (!response.ok) {
              if (response.status >= 400 && response.status < 500) {
                fail(
                  "TARGETS_FETCH",
                  "DEVTOOLS_HTTP_ERROR",
                  "DEVTOOLS_HTTP_ERROR",
                );
              }
              lastReason = "DEVTOOLS_HTTP_ERROR";
              lastErrorCode = "DEVTOOLS_HTTP_ERROR";
              lastErrorName = null;
            } else {
              const targets = await response.json();
              targetsReached = true;
              if (!Array.isArray(targets)) {
                lastPhase = "PAGE_TARGET_LOOKUP";
                lastReason = "DEVTOOLS_INVALID_JSON";
                targetCount = 0;
                lastErrorCode = "DEVTOOLS_INVALID_JSON";
                lastErrorName = null;
              } else {
                targetCount = targets.length;
                const pageTarget = targets.find(
                  (t) =>
                    t?.type === "page" &&
                    typeof t?.webSocketDebuggerUrl === "string" &&
                    (t.webSocketDebuggerUrl.startsWith("ws://") ||
                      t.webSocketDebuggerUrl.startsWith("wss://")),
                );
                if (pageTarget) {
                  if (isProcessExited(child)) {
                    fail("PROCESS_CHECK", "BROWSER_EXITED", "BROWSER_EXITED");
                  }
                  return {
                    port,
                    targets,
                    pageTarget,
                    wsUrl: pageTarget.webSocketDebuggerUrl,
                    elapsedMs: Math.max(0, Math.round(now() - startedAt)),
                    attempts,
                  };
                }
                lastPhase = "PAGE_TARGET_LOOKUP";
                lastReason = "PAGE_TARGET_NOT_READY";
                lastErrorCode = "PAGE_TARGET_NOT_READY";
                lastErrorName = null;
              }
            }
          } catch (err) {
            if (
              err?.code === "DEVTOOLS_HTTP_ERROR" ||
              err?.code === "BROWSER_EXITED"
            ) {
              throw err;
            }
            const errCode = err?.cause?.code ?? err?.code;
            if (err?.name === "TimeoutError" || err?.name === "AbortError") {
              lastReason = "DEVTOOLS_FETCH_TIMEOUT";
              lastErrorCode = "TIMEOUT";
              lastErrorName = "TimeoutError";
            } else if (errCode === "ECONNREFUSED") {
              lastReason = "DEVTOOLS_CONNECTION_REFUSED";
              lastErrorCode = "ECONNREFUSED";
              lastErrorName = null;
            } else if (targetsReached) {
              lastPhase = "PAGE_TARGET_LOOKUP";
              lastReason = "DEVTOOLS_INVALID_JSON";
              lastErrorCode = "DEVTOOLS_INVALID_JSON";
              lastErrorName = null;
            } else {
              lastReason = "DEVTOOLS_FETCH_ERROR";
              lastErrorCode = errCode ?? "DEVTOOLS_FETCH_ERROR";
              lastErrorName = null;
            }
          }
        }
      }
    }

    if (isProcessExited(child)) {
      fail("PROCESS_CHECK", "BROWSER_EXITED", "BROWSER_EXITED");
    }
    const waitMs = Math.min(pollIntervalMs, deadline - now());
    if (waitMs <= 0) break;
    await sleep(waitMs);
  }

  if (isProcessExited(child)) {
    fail("PROCESS_CHECK", "BROWSER_EXITED", "BROWSER_EXITED");
  }
  fail(lastPhase, lastReason, lastErrorCode ?? lastReason, lastErrorName);
}
