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

  try {
    const res = await fetch(`${apiUrl}/api/auth/session`, {
      headers: {
        cookie: `nexora_session=${cookieValue}`,
      },
      cache: "no-store",
    });

    if (res.status === 200) {
      const data = (await res.json().catch(() => null)) as {
        user?: SessionUser;
      } | null;
      return {
        status: "authenticated",
        user: data?.user ?? { id: "", username: "" },
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
  }
}
