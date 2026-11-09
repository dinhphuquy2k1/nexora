import { sanitizeReturnUrl } from "../auth/sanitize.ts";

export type WorkspaceSessionExpiredListener = () => void;

interface SessionState {
  epoch: number;
  userId?: string;
  initialized: boolean;
}

let activeSession: SessionState = { epoch: 0, initialized: false };
let activeListener: WorkspaceSessionExpiredListener | null = null;
let redirecting = false;
let pendingExpirationEpoch: number | null = null;

export interface RegisterBoundaryOptions {
  userId?: string;
  forceNewSession?: boolean;
}

/**
 * Registers the active Workspace Auth Boundary handler (from ShellClient).
 *
 * Lifecycle policy:
 * - Increments session epoch when a new user session is initiated or explicitly forced.
 * - React Strict Mode effect remounts (setup -> cleanup -> setup with the same user)
 *   preserve the existing session epoch so valid in-flight requests are not falsely fenced out.
 * - If a legitimate expiration arrived during a transient unmount/remount gap,
 *   the pending expiration is immediately dispatched to the newly registered listener.
 */
export function registerWorkspaceAuthBoundary(
  listener: WorkspaceSessionExpiredListener,
  options?: RegisterBoundaryOptions,
): () => void {
  const isNewUser =
    activeSession.userId !== undefined &&
    options?.userId !== undefined &&
    options.userId !== activeSession.userId;
  const shouldBump =
    !activeSession.initialized || options?.forceNewSession || isNewUser;

  if (shouldBump) {
    activeSession = {
      epoch: activeSession.epoch + 1,
      userId: options?.userId,
      initialized: true,
    };
    redirecting = false;
    pendingExpirationEpoch = null;
  } else if (
    activeSession.userId === undefined &&
    options?.userId !== undefined
  ) {
    activeSession.userId = options.userId;
  }

  activeListener = listener;

  // Immediately dispatch expiration if buffered during mount/remount gap for this exact session
  if (pendingExpirationEpoch === activeSession.epoch) {
    pendingExpirationEpoch = null;
    redirecting = true;
    listener();
  }

  return () => {
    if (activeListener === listener) {
      activeListener = null;
      // Stale listener cannot be invoked after cleanup
    }
  };
}

export function getCurrentSessionEpoch(): number {
  if (!activeSession.initialized) {
    activeSession = {
      epoch: 1,
      userId: undefined,
      initialized: true,
    };
  }
  return activeSession.epoch;
}

/**
 * Explicitly starts a new session generation.
 * Useful for login transitions or programmatic session resets.
 */
export function startNewWorkspaceSession(userId?: string): number {
  activeSession = {
    epoch: activeSession.epoch + 1,
    userId,
    initialized: true,
  };
  activeListener = null;
  redirecting = false;
  pendingExpirationEpoch = null;
  return activeSession.epoch;
}

/**
 * Triggers session expiration navigation at the workspace boundary.
 *
 * Invariants:
 * 1. Fail-closed fencing: requestEpoch is strictly required. Any call with missing,
 *    non-numeric, non-positive, or stale epoch (requestEpoch !== activeSession.epoch) is rejected.
 * 2. Single-flight redirect: concurrent 401s trigger the handler exactly once per session.
 * 3. Mount/unmount gap safety: if no listener is currently active (e.g. during a Strict Mode
 *    remount transition), the expiration is buffered and processed as soon as the boundary mounts.
 */
export function notifyWorkspaceSessionExpired(requestEpoch: number): boolean {
  if (
    typeof requestEpoch !== "number" ||
    requestEpoch <= 0 ||
    requestEpoch !== activeSession.epoch
  ) {
    return false;
  }

  if (redirecting) {
    return false;
  }

  if (activeListener) {
    redirecting = true;
    activeListener();
    return true;
  }

  // Listener not yet registered or temporarily unmounted: buffer for current session
  if (pendingExpirationEpoch === activeSession.epoch) {
    return false;
  }
  pendingExpirationEpoch = requestEpoch;
  return true;
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
 * Test helper to reset internal coordinator state completely.
 */
export function resetWorkspaceAuthState(): void {
  activeSession = { epoch: 0, initialized: false };
  activeListener = null;
  redirecting = false;
  pendingExpirationEpoch = null;
}
