import type { RuntimeDatabase } from "../../common/infrastructure/runtime-database";
import { PrismaClient, createDatabase } from "@nexora/database";
import type {
  StoredBlob,
  FileCatalog,
} from "../../storage/application/file-storage.port";
export class DatabaseAdapter implements FileCatalog {
  private instance?: PrismaClient;
  constructor(
    private readonly url: string,
    private readonly runtime?: RuntimeDatabase,
  ) {}
  get client(): PrismaClient {
    return this.runtime?.client ?? (this.instance ??= createDatabase(this.url));
  }
  async isReady(): Promise<boolean> {
    try {
      await this.client.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }
  async register(blob: StoredBlob): Promise<void> {
    await this.client.storedFile.create({ data: blob });
  }
  async has(id: string): Promise<boolean> {
    return (await this.client.storedFile.count({ where: { id } })) > 0;
  }
  async onApplicationShutdown() {
    await this.instance?.$disconnect();
  }
}
