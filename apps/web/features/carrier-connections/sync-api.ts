import { createNexoraClient, type components } from "@nexora/sdk";
export const JOB_ISSUE_PAGE_SIZE = 10;
export type SyncJobDetail = components["schemas"]["SyncJobDetailResponseDto"];
export type JobDetailReader = (
  jobId: string,
  page: number,
  signal: AbortSignal,
) => Promise<SyncJobDetail>;
export type SyncJobResponse = components["schemas"]["SyncJobDto"];
export type SyncConfigResponse = components["schemas"]["SyncConfigDto"];
export type SyncType = SyncConfigResponse["syncType"];
export class SyncApiError extends Error {
  constructor(readonly status: number) {
    super(
      status === 401
        ? "Phiên đăng nhập đã hết hạn."
        : "Không thể tải hoặc lưu đồng bộ. Vui lòng thử lại.",
    );
  }
}
export function createSyncApi(client = createNexoraClient()) {
  function result<T>(r: { response: Response; data?: T }): T {
    if (!r.response.ok) throw new SyncApiError(r.response.status);
    if (!r.data) throw new SyncApiError(500);
    return r.data;
  }
  return {
    connections: async (signal: AbortSignal) =>
      result(await client.GET("/api/carrier-connections", { signal }))
        .connections,
    configs: async (id: string, signal: AbortSignal) =>
      result(
        await client.GET("/api/carrier-connections/{id}/sync-configs", {
          params: { path: { id } },
          signal,
        }),
      ).configs,
    jobs: async (
      id: string,
      page: number,
      signal: AbortSignal,
      filters: {
        syncType?: SyncType;
        status?: string;
        from?: string;
        until?: string;
      } = {},
    ) =>
      result(
        await client.GET("/api/carrier-connections/{id}/sync-jobs", {
          params: { path: { id }, query: { page, pageSize: 4, ...filters } },
          signal,
        }),
      ),
    jobDetail: async (
      id: string,
      jobId: string,
      page: number,
      signal: AbortSignal,
    ) =>
      result(
        await client.GET("/api/carrier-connections/{id}/sync-jobs/{jobId}", {
          params: {
            path: { id, jobId },
            query: { page, pageSize: JOB_ISSUE_PAGE_SIZE },
          },
          signal,
        }),
      ),
    admit: async (id: string, syncType: SyncType) =>
      result(
        await client.POST("/api/carrier-connections/{id}/sync-jobs", {
          params: { path: { id } },
          body: { syncType },
        }),
      ).job,
    configure: async (
      id: string,
      type: SyncType,
      enabled: boolean,
      intervalMinutes: SyncConfigResponse["intervalMinutes"],
    ) =>
      result(
        await client.PATCH(
          "/api/carrier-connections/{id}/sync-configs/{type}",
          {
            params: { path: { id, type } },
            body: { enabled, intervalMinutes },
          },
        ),
      ).config,
  };
}
