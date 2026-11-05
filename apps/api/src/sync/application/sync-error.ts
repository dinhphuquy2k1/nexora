import { HttpException } from "@nestjs/common";
import { GENERIC_ERROR_MESSAGE } from "../../common/http/error-messages";
import { SyncErrorCode as E, type SyncCode } from "../domain/sync.constants";
import type { SyncError } from "../domain/sync-policy";
const SYNC_ERROR_MAP: Record<SyncCode, { status: number; message: string }> = {
  [E.VALIDATION_ERROR]: { status: 400, message: GENERIC_ERROR_MESSAGE },
  [E.UNAUTHORIZED]: { status: 401, message: GENERIC_ERROR_MESSAGE },
  [E.NOT_FOUND]: { status: 404, message: GENERIC_ERROR_MESSAGE },
  [E.SYNC_UNAVAILABLE]: { status: 503, message: GENERIC_ERROR_MESSAGE },
  [E.SYNC_STALE]: { status: 409, message: GENERIC_ERROR_MESSAGE },
  [E.PROVIDER_RETRY]: { status: 503, message: GENERIC_ERROR_MESSAGE },
  [E.SOURCE_INVALID]: { status: 400, message: GENERIC_ERROR_MESSAGE },
  [E.SOURCE_CONFLICT]: { status: 409, message: GENERIC_ERROR_MESSAGE },
  [E.PROCESSOR_UNAVAILABLE]: { status: 503, message: GENERIC_ERROR_MESSAGE },
  [E.INTERNAL_ERROR]: { status: 500, message: GENERIC_ERROR_MESSAGE },
};
export function mapSyncError(error: SyncError) {
  const entry = SYNC_ERROR_MAP[error.code];
  return new HttpException(
    { code: error.code, message: entry.message },
    entry.status,
  );
}
