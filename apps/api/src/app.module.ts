import { Module } from "@nestjs/common";
import { loadConfig } from "./config";
import { HealthController } from "./health/presentation/health.controller";
import { HealthService } from "./health/application/health.service";
import { DatabaseAdapter } from "./health/infrastructure/database.adapter";
import { LocalStorage } from "./storage/infrastructure/local-storage";
import { FilesService } from "./storage/application/file-storage.port";
export const CONFIG = "CONFIG";
@Module({
  controllers: [HealthController],
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
  ],
})
export class AppModule {}
