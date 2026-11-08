import { sanitizeReturnUrl } from "../auth/sanitize.ts";

export type WorkspaceSessionExpiredListener = () => void;

interface SessionState {
  epoch: number;
  userId?: string;
}

let activeSession: SessionState = { epoch: 0 };
let activeListener: WorkspaceSessionExpiredListener | null = null;
let redirecting = false;

/**
 * Registers the active Workspace Auth Boundary handler (from ShellClient).
 * Increments the session epoch to fence against stale in-flight requests from prior sessions.
 */
export function registerWorkspaceAuthBoundary(
  listener: WorkspaceSessionExpiredListener,
  session?: { userId?: string },
): () => void {
  activeSession = {
    epoch: activeSession.epoch + 1,
    userId: session?.userId,
  };
  activeListener = listener;
  redirecting = false;

  return () => {
    if (activeListener === listener) {
      activeListener = null;
      redirecting = false;
    }
  };
}

export function getCurrentSessionEpoch(): number {
  return activeSession.epoch;
}

/**
 * Triggers session expiration navigation at the workspace boundary.
 *
 * Invariants:
 * 1. Stale requests (where requestEpoch !== currentSession.epoch) are discarded.
 * 2. Single-flight redirect: if multiple 401s arrive concurrently, only the first triggers the handler.
 */
export function notifyWorkspaceSessionExpired(requestEpoch?: number): boolean {
  if (requestEpoch !== undefined && requestEpoch !== activeSession.epoch) {
    return false;
  }

  if (redirecting) {
    return false;
  }
  redirecting = true;

  if (activeListener) {
    activeListener();
    return true;
  }
  return false;
}

/**
 * Computes a safe login redirect target using the existing sanitizeReturnUrl utility.
 * Preserves query strings (e.g. /customers?page=2) while rejecting open redirects.
 */
export function computeSafeLoginRedirect(currentPath?: string): string {
  const safeFrom = sanitizeReturnUrl(currentPath);
  return safeFrom && safeFrom !== "/"
    ? `/login?from=${encodeURIComponent(safeFrom)}`
    : "/login";
}

/**
 * Test helper to reset internal coordinator state.
 */
export function resetWorkspaceAuthState(): void {
  activeSession = { epoch: 0 };
  activeListener = null;
  redirecting = false;
}
