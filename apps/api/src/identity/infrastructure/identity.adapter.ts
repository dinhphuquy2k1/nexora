import { PrismaClient, createDatabase, verifyPassword } from "@nexora/database";
import { IdentityPort } from "../application/identity.port";
import type {
  LocalUserRecord,
  SessionSummary,
  UserSummary,
} from "../domain/identity.types";

export class IdentityDatabaseAdapter implements IdentityPort {
  private instance?: PrismaClient;

  constructor(private readonly url: string) {}

  get client(): PrismaClient {
    return (this.instance ??= createDatabase(this.url));
  }

  async findUserByUsername(username: string): Promise<LocalUserRecord | null> {
    const user = await this.client.localUser.findUnique({
      where: { username },
    });
    if (!user) return null;
    return {
      id: user.id,
      username: user.username,
      passwordHash: user.passwordHash,
      isActive: user.isActive,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  async findUserById(id: string): Promise<UserSummary | null> {
    const user = await this.client.localUser.findUnique({
      where: { id },
    });
    if (!user || !user.isActive) return null;
    return {
      id: user.id,
      username: user.username,
    };
  }

  async createSession(
    userId: string,
    tokenHash: string,
    expiresAt: Date,
  ): Promise<SessionSummary> {
    const session = await this.client.session.create({
      data: {
        userId,
        tokenHash,
        expiresAt,
      },
    });
    return {
      id: session.id,
      userId: session.userId,
      expiresAt: session.expiresAt,
      createdAt: session.createdAt,
    };
  }

  async findSessionByTokenHash(
    tokenHash: string,
  ): Promise<{ session: SessionSummary; user: UserSummary } | null> {
    const record = await this.client.session.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!record || !record.user.isActive) return null;

    return {
      session: {
        id: record.id,
        userId: record.userId,
        expiresAt: record.expiresAt,
        createdAt: record.createdAt,
      },
      user: {
        id: record.user.id,
        username: record.user.username,
      },
    };
  }

  async deleteSessionByTokenHash(tokenHash: string): Promise<void> {
    await this.client.session.deleteMany({ where: { tokenHash } });
  }

  async deleteExpiredSessions(): Promise<number> {
    const result = await this.client.session.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    });
    return result.count;
  }

  async verifyPassword(
    password: string,
    passwordHash: string,
  ): Promise<boolean> {
    return verifyPassword(password, passwordHash);
  }

  async onApplicationShutdown() {
    await this.instance?.$disconnect();
  }
}
