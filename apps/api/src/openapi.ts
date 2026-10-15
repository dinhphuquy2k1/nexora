import { CarrierController } from "./carrier/presentation/carrier.controller";
import { CarrierService } from "./carrier/application/carrier.service";
import { IdentityPort } from "./identity/application/identity.port";
import {
  UserManagementController,
  SetupPasswordController,
} from "./identity/presentation/user-management.controller";
import { UserManagementService } from "./identity/application/user-management.service";
import { AdminGuard } from "./identity/presentation/admin.guard";
import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Module } from "@nestjs/common";
import { HealthController } from "./health/presentation/health.controller";
import { HealthService } from "./health/application/health.service";
import { AuthController } from "./identity/presentation/auth.controller";
import { AuthService } from "./identity/application/auth.service";
// Documentation-only module: no listener, database, storage or operational endpoint.
@Module({
  controllers: [
    CarrierController,
    HealthController,
    AuthController,
    UserManagementController,
    SetupPasswordController,
  ],
  providers: [
    { provide: CarrierService, useValue: {} },
    { provide: IdentityPort, useValue: {} },
    { provide: HealthService, useValue: {} },
    { provide: AuthService, useValue: {} },
    { provide: UserManagementService, useValue: {} },
    { provide: AdminGuard, useValue: {} },
  ],
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
