import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { loadConfig } from "./config";
import { HealthController } from "./health/presentation/health.controller";
import { HealthService } from "./health/application/health.service";
import { DatabaseAdapter } from "./health/infrastructure/database.adapter";
import { LocalStorage } from "./storage/infrastructure/local-storage";
import { FilesService } from "./storage/application/file-storage.port";
import { AuthController } from "./identity/presentation/auth.controller";
import { AuthService } from "./identity/application/auth.service";
import { IdentityPort } from "./identity/application/identity.port";
import { IdentityDatabaseAdapter } from "./identity/infrastructure/identity.adapter";
import { SessionGuard } from "./identity/presentation/session.guard";
import { OriginGuard } from "./identity/presentation/origin.guard";

export const CONFIG = "CONFIG";

@Module({
  controllers: [HealthController, AuthController],
  providers: [
    { provide: CONFIG, useFactory: () => loadConfig(process.env) },
    {
      provide: DatabaseAdapter,
      inject: [CONFIG],
      useFactory: (c: ReturnType<typeof loadConfig>) =>
        new DatabaseAdapter(c.DATABASE_URL),
    },
    {
      provide: LocalStorage,
      inject: [CONFIG],
      useFactory: (c: ReturnType<typeof loadConfig>) =>
        new LocalStorage(c.STORAGE_ROOT),
    },
    {
      provide: HealthService,
      inject: [DatabaseAdapter, LocalStorage],
      useFactory: (db: DatabaseAdapter, s: LocalStorage) =>
        new HealthService(db, s),
    },
    {
      provide: FilesService,
      inject: [LocalStorage, DatabaseAdapter],
      useFactory: (s: LocalStorage, db: DatabaseAdapter) =>
        new FilesService(s, db),
    },
    {
      provide: IdentityPort,
      inject: [CONFIG],
      useFactory: (c: ReturnType<typeof loadConfig>) =>
        new IdentityDatabaseAdapter(c.DATABASE_URL),
    },
    {
      provide: AuthService,
      inject: [IdentityPort],
      useFactory: (port: IdentityPort) => new AuthService(port),
    },
    OriginGuard,
    SessionGuard,
    {
      provide: APP_GUARD,
      useClass: SessionGuard,
    },
  ],
  exports: [AuthService, SessionGuard, OriginGuard],
})
export class AppModule {}
