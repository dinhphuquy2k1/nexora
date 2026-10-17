import { RuntimeDatabase } from "./common/infrastructure/runtime-database";
import { MfaPort } from "./identity/application/mfa.port";
import { MfaService } from "./identity/application/mfa.service";
import { IdentityMfaAdapter } from "./identity/infrastructure/mfa.adapter";
import { AdminBoundaryGuard } from "./identity/presentation/admin-boundary.guard";
import { CarrierLifecycleController } from "./carrier/presentation/carrier-lifecycle.controller";
import { CarrierConnectionLifecycleService } from "./carrier/application/carrier-connection-lifecycle.service";
import { CarrierLifecycleAdapter } from "./carrier/infrastructure/carrier-lifecycle.adapter";
import { PostgresSecurityAudit } from "./carrier/infrastructure/security-audit.adapter";
import { CarrierCredentialVault } from "./carrier/infrastructure/carrier-credential-vault";
import { UnishipHttpClient } from "./carrier/infrastructure/uniship/uniship-http.client";
import { UnishipAdapter } from "./carrier/infrastructure/uniship/uniship-adapter";
import { UserCarrierAdmission } from "./carrier/infrastructure/uniship/provider-budget";
import { EnvironmentKeyring } from "./common/crypto/environment-keyring";
import { SecretCipher } from "./common/crypto/secret-cipher";
import { CarrierPort } from "./carrier/application/carrier.port";
import { CarrierAdapter } from "./carrier/infrastructure/carrier.adapter";
import { CarrierController } from "./carrier/presentation/carrier.controller";
import { CarrierService } from "./carrier/application/carrier.service";
import {
  UserManagementController,
  SetupPasswordController,
} from "./identity/presentation/user-management.controller";
import { UserManagementPort } from "./identity/application/user-management.port";
import { UserManagementService } from "./identity/application/user-management.service";
import { UserManagementAdapter } from "./identity/infrastructure/user-management.adapter";
import { AdminGuard } from "./identity/presentation/admin.guard";
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
  controllers: [
    CarrierController,
    CarrierLifecycleController,
    HealthController,
    AuthController,
    UserManagementController,
    SetupPasswordController,
  ],
  providers: [
    {
      provide: RuntimeDatabase,
      inject: [CONFIG],
      useFactory: (c: ReturnType<typeof loadConfig>) =>
        new RuntimeDatabase(c.DATABASE_URL),
    },
    {
      provide: CarrierLifecycleAdapter,
      inject: [CONFIG, RuntimeDatabase],
      useFactory: (c: ReturnType<typeof loadConfig>, db: RuntimeDatabase) =>
        new CarrierLifecycleAdapter(c.DATABASE_URL, db),
    },
    {
      provide: PostgresSecurityAudit,
      inject: [CarrierLifecycleAdapter],
      useFactory: (store: CarrierLifecycleAdapter) =>
        new PostgresSecurityAudit(store.client),
    },
    {
      provide: CarrierConnectionLifecycleService,
      inject: [
        CarrierLifecycleAdapter,
        SecretCipher,
        PostgresSecurityAudit,
        CONFIG,
      ],
      useFactory: (
        store: CarrierLifecycleAdapter,
        cipher: SecretCipher,
        audit: PostgresSecurityAudit,
        c: ReturnType<typeof loadConfig>,
      ) =>
        new CarrierConnectionLifecycleService(
          store,
          new CarrierCredentialVault(
            store,
            cipher,
            new UnishipAdapter(
              new UnishipHttpClient({
                apiUrl: c.UNISHIP_API_URL,
                liveAuthorized: c.UNISHIP_LIVE_AUTHORIZED === "true",
                isProduction: c.NODE_ENV === "production",
              }),
            ),
            audit,
          ),
          new UserCarrierAdmission(),
          audit,
        ),
    },
    {
      provide: SecretCipher,
      useFactory: () => new SecretCipher(new EnvironmentKeyring(process.env)),
    },
    {
      provide: CarrierPort,
      inject: [CONFIG, RuntimeDatabase],
      useFactory: (c: ReturnType<typeof loadConfig>, db: RuntimeDatabase) =>
        new CarrierAdapter(c.DATABASE_URL, db),
    },
    {
      provide: CarrierService,
      inject: [CarrierPort],
      useFactory: (port: CarrierPort) => new CarrierService(port),
    },
    { provide: CONFIG, useFactory: () => loadConfig(process.env) },
    {
      provide: DatabaseAdapter,
      inject: [CONFIG, RuntimeDatabase],
      useFactory: (c: ReturnType<typeof loadConfig>, db: RuntimeDatabase) =>
        new DatabaseAdapter(c.DATABASE_URL, db),
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
      inject: [CONFIG, RuntimeDatabase],
      useFactory: (c: ReturnType<typeof loadConfig>, db: RuntimeDatabase) =>
        new IdentityDatabaseAdapter(c.DATABASE_URL, db),
    },
    {
      provide: AuthService,
      inject: [IdentityPort, MfaPort],
      useFactory: (port: IdentityPort, mfa: MfaPort) =>
        new AuthService(port, Date.now, mfa),
    },
    {
      provide: OriginGuard,
      inject: [CONFIG],
      useFactory: (c: ReturnType<typeof loadConfig>) => new OriginGuard(c),
    },
    {
      provide: UserManagementPort,
      inject: [CONFIG, RuntimeDatabase],
      useFactory: (c: ReturnType<typeof loadConfig>, db: RuntimeDatabase) =>
        new UserManagementAdapter(c.DATABASE_URL, db),
    },
    {
      provide: UserManagementService,
      inject: [UserManagementPort, AuthService, CONFIG],
      useFactory: (
        port: UserManagementPort,
        auth: AuthService,
        c: ReturnType<typeof loadConfig>,
      ) =>
        new UserManagementService(
          port,
          auth,
          c.trustedOrigins,
          c.deployment.publicOrigin,
        ),
    },
    {
      provide: MfaPort,
      inject: [CONFIG, RuntimeDatabase],
      useFactory: (c: ReturnType<typeof loadConfig>, db: RuntimeDatabase) =>
        new IdentityMfaAdapter(
          c.DATABASE_URL,
          new SecretCipher(new EnvironmentKeyring(process.env, "IDENTITY")),
          Date.now,
          db,
        ),
    },
    {
      provide: MfaService,
      inject: [MfaPort, AuthService],
      useFactory: (port: MfaPort, auth: AuthService) =>
        new MfaService(port, auth),
    },
    AdminGuard,
    AdminBoundaryGuard,
    SessionGuard,
    {
      provide: APP_GUARD,
      useExisting: SessionGuard,
    },
    { provide: APP_GUARD, useExisting: AdminBoundaryGuard },
  ],
  exports: [AuthService, SessionGuard, OriginGuard],
})
export class AppModule {}
