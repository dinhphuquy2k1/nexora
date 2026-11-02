import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { SyncWorkerModule } from "./sync-worker.module";
async function main() {
  const app = await NestFactory.createApplicationContext(SyncWorkerModule, {
    logger: false,
    abortOnError: false,
  });
  app.enableShutdownHooks(["SIGINT", "SIGTERM"]);
  console.log(JSON.stringify({ event: "sync_worker_started" }));
}
main().catch(() => {
  console.error(JSON.stringify({ event: "sync_worker_startup_failed" }));
  process.exitCode = 1;
});
