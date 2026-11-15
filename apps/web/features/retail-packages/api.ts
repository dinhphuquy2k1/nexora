import { createWorkspaceApiClient } from "../../lib/api/workspace-client.ts";
import { ShipmentApiError } from "./errors.ts";
import {
  readShipmentPage,
  readShipment,
  readShipmentHistory,
} from "./response.ts";
import type { ShipmentListQuery } from "./types.ts";
export function createShipmentApi(client = createWorkspaceApiClient()) {
  const result = (r: {
    response: Response;
    data?: unknown;
    error?: unknown;
  }) => {
    if (!r.response.ok) throw new ShipmentApiError(r.response.status, r.error);
    return r.data;
  };
  return {
    list: async (query: ShipmentListQuery, signal?: AbortSignal) =>
      readShipmentPage(
        result(
          await client.GET("/api/shipments", {
            params: {
              query: {
                ...(query.stage ? { stage: query.stage } : {}),
                ...(query.q ? { q: query.q } : {}),
                page: query.page,
                pageSize: query.pageSize,
              },
            },
            signal,
          }),
        ),
      ),
    get: async (id: string, signal?: AbortSignal) =>
      readShipment(
        result(
          await client.GET("/api/shipments/{id}", {
            params: { path: { id } },
            signal,
          }),
        ),
      ),
    history: async (
      id: string,
      query: { page: 1; pageSize: 100 },
      signal?: AbortSignal,
    ) =>
      readShipmentHistory(
        result(
          await client.GET("/api/shipments/{id}/history", {
            params: {
              path: { id },
              query: { page: query.page, pageSize: query.pageSize },
            },
            signal,
          }),
        ),
      ),
  };
}
export type ShipmentApi = ReturnType<typeof createShipmentApi>;
export const shipmentApi = createShipmentApi();
