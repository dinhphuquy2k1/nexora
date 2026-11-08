import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { logWorkerFailure } from "../sync/infrastructure/worker-failure-log";
import { SyncWorkerModule } from "./sync-worker.module";
async function main() {
  const app = await NestFactory.createApplicationContext(SyncWorkerModule, {
    logger: false,
    abortOnError: false,
  });
  app.enableShutdownHooks(["SIGINT", "SIGTERM"]);
  console.log(JSON.stringify({ event: "sync_worker_started" }));
}
main().catch((error: unknown) => {
  logWorkerFailure("sync_worker_startup_failed", error);
  process.exitCode = 1;
});
