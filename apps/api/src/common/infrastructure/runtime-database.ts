import { createDatabase, type PrismaClient } from "@nexora/database";

/** One restricted runtime pool per API process; independent CLI clients own theirs. */
export class RuntimeDatabase {
  private instance?: PrismaClient;
  private closing?: Promise<void>;
  constructor(
    private readonly url: string,
    private readonly factory: (url: string) => PrismaClient = createDatabase,
  ) {}
  get client(): PrismaClient {
    return (this.instance ??= this.factory(this.url));
  }
  async onApplicationShutdown(): Promise<void> {
    if (this.instance) {
      this.closing ??= this.instance.$disconnect();
      await this.closing;
    }
  }
}
