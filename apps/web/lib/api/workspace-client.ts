import { createNexoraClient, type Middleware } from "@nexora/sdk";
import {
  getCurrentSessionEpoch,
  notifyWorkspaceSessionExpired,
} from "./workspace-auth.ts";

/**
 * Creates an authenticated Workspace API client using the shared @nexora/sdk.
 *
 * Attaches a response observer middleware that intercepts HTTP 401 responses:
 * - Clones the response non-destructively so downstream callers still receive full error bodies and request IDs.
 * - Confirms that error code is strictly "UNAUTHORIZED".
 * - Fences against stale in-flight requests from prior sessions using session epochs.
 * - Fails closed: if no valid request epoch is bound, session expiration cannot be triggered.
 * - Triggers single-flight session-expired handling at the Workspace boundary.
 */
export function createWorkspaceApiClient(baseUrl = "") {
  const client = createNexoraClient(baseUrl);
  const requestEpochs = new Map<string, number>();

  const authMiddleware: Middleware = {
    onRequest({ id }) {
      const currentEpoch = getCurrentSessionEpoch();
      if (currentEpoch > 0) {
        requestEpochs.set(id, currentEpoch);
      }
      return undefined;
    },
    async onResponse({ id, response }) {
      const epoch = requestEpochs.get(id);
      requestEpochs.delete(id);

      // Fail-closed: require valid recorded epoch
      if (typeof epoch !== "number" || epoch <= 0) {
        return undefined;
      }

      if (response.status === 401) {
        try {
          const clone = response.clone();
          const body = (await clone.json()) as { code?: string } | null;
          if (
            body &&
            typeof body === "object" &&
            body.code === "UNAUTHORIZED"
          ) {
            notifyWorkspaceSessionExpired(epoch);
          }
        } catch {
          // Malformed or non-JSON response body: do not infer session expiration
        }
      }
      return undefined;
    },
    onError({ id }) {
      requestEpochs.delete(id);
      return undefined;
    },
  };

  client.use(authMiddleware);
  return client;
}
