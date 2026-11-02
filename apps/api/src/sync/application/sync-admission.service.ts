import { z } from "zod";
import { SyncJobStatus } from "../domain/sync.constants";
import type { SyncJobFilters } from "./sync.port";
import { parsePagination } from "@nexora/shared";
import { HttpException } from "@nestjs/common";
import { isUuid } from "../../common/validation/uuid";
import { GENERIC_ERROR_MESSAGE } from "../../common/http/error-messages";
import { SyncPort } from "./sync.port";
import { SyncError } from "../domain/sync-policy";
import {
  SyncErrorCode as E,
  SyncType,
  SyncTrigger,
  type SyncCode,
} from "../domain/sync.constants";
const ERROR_MAP: Record<SyncCode, number> = {
  [E.VALIDATION_ERROR]: 400,
  [E.UNAUTHORIZED]: 401,
  [E.NOT_FOUND]: 404,
  [E.SYNC_UNAVAILABLE]: 503,
  [E.SYNC_STALE]: 409,
  [E.PROVIDER_RETRY]: 503,
  [E.SOURCE_INVALID]: 400,
  [E.SOURCE_CONFLICT]: 409,
  [E.PROCESSOR_UNAVAILABLE]: 503,
  [E.INTERNAL_ERROR]: 500,
};
export function strictSyncBody(value: unknown, keys: readonly string[]) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.keys(value).some((k) => !keys.includes(k))
  )
    throw new SyncError(E.VALIDATION_ERROR);
  return value as Record<string, unknown>;
}
export function syncType(value: unknown): SyncType {
  if (!Object.values(SyncType).some((v) => v === value))
    throw new SyncError(E.VALIDATION_ERROR);
  return value as SyncType;
}
export function syncPagination(query: Record<string, unknown>) {
  if (Object.keys(query).some((k) => k !== "page" && k !== "pageSize"))
    throw new SyncError(E.VALIDATION_ERROR);
  const parsed = parsePagination(query.page, query.pageSize);
  if (!parsed) throw new SyncError(E.VALIDATION_ERROR);
  return parsed;
}

export class SyncService {
  constructor(private readonly port: SyncPort) {}
  private async run<T>(userId: string, id: string, op: () => Promise<T>) {
    try {
      if (!isUuid(userId) || !isUuid(id))
        throw new SyncError(E.VALIDATION_ERROR);
      return await op();
    } catch (error) {
      if (error instanceof SyncError)
        throw new HttpException(
          { code: error.code, message: GENERIC_ERROR_MESSAGE },
          ERROR_MAP[error.code],
        );
      throw error;
    }
  }
  admit(userId: string, id: string, body: unknown) {
    return this.run(userId, id, () => {
      const b = strictSyncBody(body, ["syncType"]);
      return this.port.admit(
        userId,
        id,
        syncType(b.syncType),
        SyncTrigger.MANUAL,
      );
    });
  }
  jobs(userId: string, id: string, query: Record<string, unknown>) {
    return this.run(userId, id, async () => {
      const allowed = [
        "page",
        "pageSize",
        "syncType",
        "status",
        "from",
        "until",
      ];
      if (Object.keys(query).some((k) => !allowed.includes(k)))
        throw new SyncError(E.VALIDATION_ERROR);
      const { page, pageSize } = syncPagination({
        page: query.page,
        pageSize: query.pageSize,
      });
      const filters: SyncJobFilters = {};
      if (query.syncType !== undefined) filters.type = syncType(query.syncType);
      if (query.status !== undefined) {
        if (typeof query.status !== "string")
          throw new SyncError(E.VALIDATION_ERROR);
        filters.statuses = query.status.split(",");
        if (
          !filters.statuses.length ||
          filters.statuses.some(
            (v) => !Object.values(SyncJobStatus).some((s) => s === v),
          )
        )
          throw new SyncError(E.VALIDATION_ERROR);
      }
      for (const key of ["from", "until"] as const) {
        if (query[key] !== undefined) {
          const result = z.iso.datetime({ offset: true }).safeParse(query[key]);
          if (!result.success) throw new SyncError(E.VALIDATION_ERROR);
          filters[key] = new Date(result.data);
        }
      }
      if (filters.from && filters.until && filters.from > filters.until)
        throw new SyncError(E.VALIDATION_ERROR);
      return {
        ...(await this.port.jobs(userId, id, page, pageSize, filters)),
        page,
        pageSize,
      };
    });
  }
  job(userId: string, id: string, jobId: string) {
    return this.run(userId, id, () => {
      if (!isUuid(jobId)) throw new SyncError(E.VALIDATION_ERROR);
      return this.port.job(userId, id, jobId);
    });
  }
  issues(
    userId: string,
    id: string,
    jobId: string,
    query: Record<string, unknown>,
  ) {
    return this.run(userId, id, () => {
      if (!isUuid(jobId)) throw new SyncError(E.VALIDATION_ERROR);
      const { page, pageSize } = syncPagination(query);
      return this.port.issues(userId, id, jobId, page, pageSize);
    });
  }
  configs(userId: string, id: string) {
    return this.run(userId, id, () => this.port.configs(userId, id));
  }
  configure(userId: string, id: string, type: unknown, body: unknown) {
    return this.run(userId, id, () => {
      const b = strictSyncBody(body, ["enabled", "intervalMinutes"]);
      if (
        typeof b.enabled !== "boolean" ||
        typeof b.intervalMinutes !== "number" ||
        ![15, 30, 60, 120, 240].includes(b.intervalMinutes)
      )
        throw new SyncError(E.VALIDATION_ERROR);
      return this.port.configure(
        userId,
        id,
        syncType(type),
        b.enabled,
        b.intervalMinutes,
      );
    });
  }
}
