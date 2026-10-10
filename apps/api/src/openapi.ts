import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Module } from "@nestjs/common";
import { HealthController } from "./health/presentation/health.controller";
import { HealthService } from "./health/application/health.service";
// Documentation-only module: no listener, database, storage or operational endpoint.
@Module({
  controllers: [HealthController],
  providers: [{ provide: HealthService, useValue: {} }],
})
class ContractModule {}
import { configure, document } from "./http";
async function generate() {
  const app = await NestFactory.create(ContractModule, { logger: false });
  configure(app);
  await app.init();
  const dir = resolve(__dirname, "../openapi");
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
  await writeFile(
    resolve(dir, "openapi.json"),
    JSON.stringify(document(app), null, 2) + "\n",
  );
  await app.close();
}
generate().catch(() => {
  process.exitCode = 1;
});
