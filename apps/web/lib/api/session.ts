import { cache } from "react";
import { getApiInternalUrl } from "./config.ts";

export interface SessionUser {
  id: string;
  username: string;
}

export type ServerSessionResult =
  | { status: "authenticated"; user: SessionUser }
  | { status: "unauthenticated" }
  | { status: "unavailable"; reason: string };

/**
 * Validates a session cookie against the backend session endpoint.
 *
 * Distinguishes:
 * - authenticated (HTTP 200)
 * - unauthenticated (HTTP 401 or no cookie)
 * - unavailable (HTTP 5xx, network error, or DNS failure)
 *
 * Does not throw network errors. Never catches framework redirect signals.
 */
export async function verifyServerSession(
  cookieValue: string | undefined,
): Promise<ServerSessionResult> {
  if (!cookieValue) {
    return { status: "unauthenticated" };
  }

  let apiUrl: string;
  try {
    apiUrl = getApiInternalUrl();
  } catch (err) {
    return {
      status: "unavailable",
      reason: err instanceof Error ? err.message : "Configuration error",
    };
  }

  const controller = new AbortController();
  const deadline = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(`${apiUrl}/api/auth/session`, {
      headers: {
        cookie: `nexora_session=${cookieValue}`,
      },
      cache: "no-store",
      signal: controller.signal,
    });

    if (res.status === 200) {
      const data: unknown = await res.json().catch(() => null);
      if (
        !data ||
        typeof data !== "object" ||
        !("authenticated" in data) ||
        data.authenticated !== true ||
        !("user" in data) ||
        !data.user ||
        typeof data.user !== "object" ||
        !("id" in data.user) ||
        typeof data.user.id !== "string" ||
        !data.user.id.trim() ||
        !("username" in data.user) ||
        typeof data.user.username !== "string" ||
        !data.user.username.trim()
      ) {
        return { status: "unavailable", reason: "Invalid session response" };
      }
      return {
        status: "authenticated",
        user: { id: data.user.id, username: data.user.username },
      };
    }

    if (res.status === 401) {
      return { status: "unauthenticated" };
    }

    return {
      status: "unavailable",
      reason: `Upstream error HTTP ${res.status}`,
    };
  } catch (err) {
    return {
      status: "unavailable",
      reason:
        err instanceof Error ? err.message : "Network or DNS connection failed",
    };
  } finally {
    clearTimeout(deadline);
  }
}

/**
 * Request-memoized session verification for Server Components and Layouts.
 * Prevents duplicate network round-trips when both layout and page verify the session.
 */
export const getCachedServerSession = cache(
  async (cookieValue: string | undefined): Promise<ServerSessionResult> => {
    return verifyServerSession(cookieValue);
  },
);
