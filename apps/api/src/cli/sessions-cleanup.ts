import { RuntimeDatabase } from "../common/infrastructure/runtime-database";
import { deleteExpiredSessionBatch } from "../identity/infrastructure/session-maintenance";

export async function main(args = process.argv.slice(2)): Promise<void> {
  if (args.length || !process.env.DATABASE_URL)
    throw new Error("SESSION_CLEANUP_FAILED");
  const db = new RuntimeDatabase(process.env.DATABASE_URL);
  try {
    // Hard per-invocation bound; repeat explicitly if more expired rows remain.
    let deleted = 0;
    let batches = 0;
    for (; batches < 20; ) {
      const count = await deleteExpiredSessionBatch(db.client);
      batches++;
      deleted += count;
      if (count < 500) break;
    }
    console.log(
      JSON.stringify({
        event: "expired_sessions_cleanup",
        deleted,
        batches,
        capped: batches === 20,
      }),
    );
  } finally {
    await db.onApplicationShutdown();
  }
}
if (require.main === module)
  main().catch(() => {
    console.error("SESSION_CLEANUP_FAILED");
    process.exitCode = 1;
  });
