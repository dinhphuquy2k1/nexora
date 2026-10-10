export interface DatabaseHealth {
  isReady(): Promise<boolean>;
}
export interface StorageHealth {
  isReady(): Promise<boolean>;
}
export class HealthService {
  constructor(
    private readonly database: DatabaseHealth,
    private readonly storage: StorageHealth,
  ) {}
  live() {
    return { status: "ok" as const };
  }
  async ready() {
    const [database, storage] = await Promise.all([
      this.database.isReady(),
      this.storage.isReady(),
    ]);
    return {
      status: database && storage ? ("ok" as const) : ("unavailable" as const),
      checks: { database, storage },
    };
  }
}
