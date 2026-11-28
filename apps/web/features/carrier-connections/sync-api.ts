import { createWorkspaceApiClient } from "../../lib/api/workspace-client.ts";
import type { components } from "@nexora/sdk";
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
export type ConnectCarrierInput = components["schemas"]["ConnectCarrierDto"];
export type CarrierConnectionDto =
  components["schemas"]["CarrierConnectionDto"];

function syncErrorMessage(status: number, code?: string) {
  if (status === 401) return "Phiên đăng nhập đã hết hạn.";
  if (status === 403)
    return "Yêu cầu bị từ chối. Kiểm tra quyền truy cập hoặc nguồn gửi yêu cầu.";
  if (status === 404) return "Không tìm thấy kết nối hãng vận chuyển.";
  if (status === 429)
    return "Quá nhiều yêu cầu xác thực. Vui lòng chờ một lát rồi thử lại.";
  if (status === 400) {
    if (code === "CANNOT_CONNECT_CARRIER_ACCOUNT")
      return "Không thể kết nối tài khoản này. Kiểm tra thông tin đăng nhập, quyền kích hoạt hoặc xem tài khoản đã liên kết chưa.";
    if (code === "PROVIDER_AUTH_FAILED")
      return "Xác thực lại tài khoản hãng thất bại. Kiểm tra mật khẩu kết nối hoặc cấu hình kích hoạt.";
    return "Thông tin chưa hợp lệ. Kiểm tra lại các trường và giới hạn độ dài.";
  }
  return "Không thể tải hoặc lưu đồng bộ. Vui lòng thử lại.";
}

export class SyncApiError extends Error {
  status: number;
  code?: string;
  constructor(status: number, code?: string) {
    super(syncErrorMessage(status, code));
    this.status = status;
    if (code) this.code = code;
  }
}
export function createSyncApi(client = createWorkspaceApiClient()) {
  function result<T>(r: { response: Response; data?: T; error?: unknown }): T {
    if (!r.response.ok) {
      const errBody = r.error as { code?: unknown } | null | undefined;
      const code =
        errBody &&
        typeof errBody === "object" &&
        typeof errBody.code === "string"
          ? errBody.code
          : undefined;
      throw new SyncApiError(r.response.status, code);
    }
    if (!r.data) throw new SyncApiError(500);
    return r.data;
  }
  return {
    connections: async (signal: AbortSignal) =>
      result(await client.GET("/api/carrier-connections", { signal }))
        .connections,
    connect: async (body: ConnectCarrierInput) =>
      result(await client.POST("/api/carrier-connections", { body }))
        .connection,
    reconnect: async (id: string, password: string) =>
      result(
        await client.POST("/api/carrier-connections/{id}/reconnect", {
          params: { path: { id } },
          body: { password },
        }),
      ).connection,
    rename: async (id: string, displayName: string) =>
      result(
        await client.PATCH("/api/carrier-connections/{id}", {
          params: { path: { id } },
          body: { displayName },
        }),
      ).connection,
    remove: async (id: string) =>
      result(
        await client.DELETE("/api/carrier-connections/{id}", {
          params: { path: { id } },
        }),
      ),
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
