import { clearTimeout, setTimeout } from "node:timers";
import { rm } from "node:fs/promises";

/**
 * Check whether a child process has already terminated.
 * In Node.js, child.exitCode is null when the process exited due to a signal,
 * but child.signalCode will be non-null (e.g. 'SIGTERM', 'SIGKILL').
 */
export function isProcessExited(child) {
  if (!child) return true;
  return child.exitCode !== null || child.signalCode !== null;
}

/**
 * Bounded wait for process exit event with immediate timer cancellation.
 * Ensures no unresolved event listener or uncancelled timer leaks into the event loop.
 */
export function waitForProcessExit(child, timeoutMs) {
  if (isProcessExited(child)) {
    return Promise.resolve(true);
  }

  return new Promise((resolve) => {
    let timer = null;

    const cleanup = () => {
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
      child.removeListener("exit", onExit);
      child.removeListener("error", onError);
    };

    const onExit = () => {
      cleanup();
      resolve(true);
    };

    const onError = () => {
      cleanup();
      resolve(false);
    };

    child.once("exit", onExit);
    child.once("error", onError);

    // Re-check synchronously after adding listeners to prevent missing an exit event
    if (isProcessExited(child)) {
      cleanup();
      resolve(true);
      return;
    }

    if (timeoutMs > 0 && Number.isFinite(timeoutMs)) {
      timer = setTimeout(() => {
        timer = null;
        cleanup();
        resolve(false);
      }, timeoutMs);
    }
  });
}

/**
 * Safely terminate a child process:
 * 1. Recognizes already-exited processes (by normal exit or signal).
 * 2. Attempts graceful SIGTERM with a bounded wait.
 * 3. Cancels grace timers immediately on exit.
 * 4. Escalates to SIGKILL only if necessary, with a bounded wait.
 * 5. Fails closed with PROCESS_TERMINATION_UNVERIFIED if termination cannot be confirmed.
 */
export async function terminateChildProcess(
  child,
  { gracefulTimeoutMs = 3000, forceTimeoutMs = 2000 } = {},
) {
  if (!child) {
    return { exited: true, reason: "no_child" };
  }

  if (isProcessExited(child)) {
    return {
      exited: true,
      reason: "already_exited",
      exitCode: child.exitCode,
      signalCode: child.signalCode,
    };
  }

  // Graceful termination attempt
  try {
    child.kill("SIGTERM");
  } catch (err) {
    if (err.code === "ESRCH") {
      return {
        exited: true,
        reason: "already_exited",
        exitCode: child.exitCode,
        signalCode: child.signalCode,
      };
    }
    throw err;
  }

  const gracefulExited = await waitForProcessExit(child, gracefulTimeoutMs);
  if (gracefulExited) {
    return {
      exited: true,
      escalated: false,
      exitCode: child.exitCode,
      signalCode: child.signalCode,
    };
  }

  if (isProcessExited(child)) {
    return {
      exited: true,
      escalated: false,
      exitCode: child.exitCode,
      signalCode: child.signalCode,
    };
  }

  // Forced termination escalation
  try {
    child.kill("SIGKILL");
  } catch (err) {
    if (err.code === "ESRCH") {
      return {
        exited: true,
        reason: "already_exited",
        exitCode: child.exitCode,
        signalCode: child.signalCode,
      };
    }
    throw err;
  }

  const forceExited = await waitForProcessExit(child, forceTimeoutMs);
  if (forceExited) {
    return {
      exited: true,
      escalated: true,
      exitCode: child.exitCode,
      signalCode: child.signalCode,
    };
  }

  throw Object.assign(new Error("PROCESS_TERMINATION_UNVERIFIED"), {
    pid: child.pid,
    exitCode: child.exitCode,
    signalCode: child.signalCode,
  });
}

/**
 * Remove temporary browser profile directory with bounded retries.
 */
export async function cleanupBrowserProfile(
  profilePath,
  { maxRetries = 10, retryDelay = 100 } = {},
) {
  if (!profilePath) return;
  await rm(profilePath, {
    recursive: true,
    force: true,
    maxRetries,
    retryDelay,
  });
}
