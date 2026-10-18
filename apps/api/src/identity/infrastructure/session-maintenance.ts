import type { PrismaClient } from "@nexora/database";

/** One short transaction, DB clock only; no FOR UPDATE privilege or new grants. */
export async function deleteExpiredSessionBatch(
  db: PrismaClient,
  batchSize = 500,
): Promise<number> {
  if (!Number.isSafeInteger(batchSize) || batchSize < 1 || batchSize > 1000)
    throw new Error("INVALID_SESSION_BATCH_SIZE");
  return db.$transaction(
    async (tx) => {
      await tx.$executeRaw`SET LOCAL statement_timeout = '3s'`;
      await tx.$executeRaw`SET LOCAL lock_timeout = '1s'`;
      return tx.$executeRaw`DELETE FROM sessions WHERE id IN (
      SELECT id FROM sessions WHERE expires_at <= statement_timestamp()
      ORDER BY expires_at,id LIMIT ${batchSize}
    ) AND expires_at <= statement_timestamp()`;
    },
    { timeout: 5000 },
  );
}
