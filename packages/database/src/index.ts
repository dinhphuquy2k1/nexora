import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
export { PrismaClient, Prisma } from "@prisma/client";
export function createDatabase(url: string): PrismaClient {
  return new PrismaClient({
    adapter: new PrismaPg({
      connectionString: url,
      connectionTimeoutMillis: 3000,
    }),
  });
}
