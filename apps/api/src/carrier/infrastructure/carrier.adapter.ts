import {
  createDatabase,
  type PrismaClient,
  type Prisma,
} from "@nexora/database";
import { CarrierPort } from "../application/carrier.port";
import { CarrierError } from "../domain/carrier";
const metadata = {
  id: true,
  provider: true,
  externalAccountId: true,
  loginIdentifier: true,
  displayName: true,
  status: true,
  lastVerifiedAt: true,
  createdAt: true,
} as const;
export class CarrierAdapter implements CarrierPort {
  private instance?: PrismaClient;
  constructor(private readonly url: string) {}
  get client(): PrismaClient {
    return (this.instance ??= createDatabase(this.url));
  }
  private async active(tx: Prisma.TransactionClient, userId: string) {
    const rows = await tx.$queryRaw<
      Array<{ status: string }>
    >`SELECT status FROM users WHERE id=${userId}::uuid FOR UPDATE`;
    if (rows[0]?.status !== "ACTIVE") throw new CarrierError("UNAUTHORIZED");
  }
  async list(userId: string) {
    return this.client.$transaction(async (tx) => {
      await this.active(tx, userId);
      return tx.carrierConnection.findMany({
        where: { userId },
        select: metadata,
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      });
    });
  }
  async rename(userId: string, id: string, displayName: string) {
    return this.client.$transaction(async (tx) => {
      await this.active(tx, userId);
      const result = await tx.carrierConnection.updateMany({
        where: { id, userId },
        data: { displayName },
      });
      if (result.count !== 1) throw new CarrierError("NOT_FOUND");
      return await tx.carrierConnection.findUniqueOrThrow({
        where: { id },
        select: metadata,
      });
    });
  }
  async remove(userId: string, id: string) {
    await this.client.$transaction(async (tx) => {
      await this.active(tx, userId);
      const result = await tx.carrierConnection.deleteMany({
        where: { id, userId },
      });
      if (result.count !== 1) throw new CarrierError("NOT_FOUND");
    });
  }
  async onApplicationShutdown() {
    await this.instance?.$disconnect();
  }
}
