import { Prisma } from "@nexora/database";
import { SyncConfigurationError, SyncError } from "../domain/sync-policy";
import { SyncErrorCode } from "../domain/sync.constants";
const PRISMA_CODES = new Set([
  "P1000",
  "P1001",
  "P1002",
  "P1003",
  "P1008",
  "P1010",
  "P1011",
  "P1017",
  "P2002",
  "P2003",
  "P2010",
  "P2024",
  "P2025",
  "P2028",
  "P2034",
]);
const NODE_CODES = new Set([
  "ECONNREFUSED",
  "ECONNRESET",
  "ETIMEDOUT",
  "EAI_AGAIN",
  "ENOTFOUND",
  "ENOSPC",
  "EACCES",
  "EPERM",
]);
const DATABASE_CODES = new Set([
  "42P01",
  "42501",
  "55P03",
  "40P01",
  "40001",
  "53300",
  "53100",
]);
type FailureEvent = "sync_worker_startup_failed" | "sync_worker_cycle_failed";
function diagnostic(error: unknown): { errorType: string; errorCode?: string } {
  try {
    if (error instanceof SyncConfigurationError)
      return { errorType: "CONFIGURATION_ERROR" };
    // Snapshot accessor-backed properties once; validate and emit the same value.
    if (error instanceof SyncError) {
      const code = error.code;
      if (Object.values(SyncErrorCode).includes(code))
        return { errorType: "SYNC_ERROR", errorCode: code };
      return { errorType: "UNKNOWN_ERROR" };
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      const code = error.code;
      if (PRISMA_CODES.has(code))
        return { errorType: "PrismaClientKnownRequestError", errorCode: code };
      return { errorType: "UNKNOWN_ERROR" };
    }
    if (error instanceof Prisma.PrismaClientInitializationError) {
      const code = error.errorCode;
      if (typeof code === "string" && PRISMA_CODES.has(code))
        return {
          errorType: "PrismaClientInitializationError",
          errorCode: code,
        };
      return { errorType: "UNKNOWN_ERROR" };
    }
    if (error instanceof Error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (typeof code === "string") {
        if (NODE_CODES.has(code))
          return { errorType: "NODE_ERROR", errorCode: code };
        if (DATABASE_CODES.has(code))
          return { errorType: "DATABASE_ERROR", errorCode: code };
      }
    }
  } catch {
    /* Hostile getters/unknown throwables cannot break failure logging. */
  }
  return { errorType: "UNKNOWN_ERROR" };
}
/** Closed projection only: never serialize the throwable, name, message, stack or meta. */
export function logWorkerFailure(event: FailureEvent, error: unknown) {
  console.error(
    JSON.stringify({
      event,
      code: SyncErrorCode.INTERNAL_ERROR,
      ...diagnostic(error),
    }),
  );
}
