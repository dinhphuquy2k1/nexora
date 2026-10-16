import { PrismaClient, createDatabase, verifyPassword } from "@nexora/database";
import { AuthLevel } from "../domain/session-assurance";
import { UserStatus, UserRole } from "../domain/user-policy";
import { IdentityPort } from "../application/identity.port";
import type {
  LocalLoginRecord,
  SessionSummary,
  UserSummary,
} from "../domain/identity.types";

export class IdentityDatabaseAdapter implements IdentityPort {
  private instance?: PrismaClient;

  constructor(private readonly url: string) {}

  get client(): PrismaClient {
    return (this.instance ??= createDatabase(this.url));
  }

  async findUserByUsername(username: string): Promise<LocalLoginRecord | null> {
    const user = await this.client.user.findUnique({
      where: { username },
      include: { credential: true },
    });
    if (!user) return null;
    return {
      id: user.id,
      username: user.username,
      passwordHash: user.credential?.passwordHash ?? null,
      role: user.role as UserRole,
      status: user.status as UserStatus,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  async findUserById(id: string): Promise<UserSummary | null> {
    const user = await this.client.user.findUnique({
      where: { id },
    });
    if (!user || user.status !== UserStatus.ACTIVE) return null;
    return {
      id: user.id,
      username: user.username,
    };
  }

  async findActiveRole(userId: string): Promise<UserRole | null> {
    const user = await this.client.user.findUnique({ where: { id: userId } });
    return user?.status === UserStatus.ACTIVE &&
      (user.role === UserRole.ADMIN || user.role === UserRole.OPERATOR)
      ? (user.role as UserRole)
      : null;
  }

  async createSessionIfUnchanged(
    userId: string,
    verifiedHash: string,
    tokenHash: string,
    expiresAt: Date,
  ): Promise<UserSummary | null> {
    return this.client.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<
        Array<{ id: string; username: string; role: string; status: string }>
      >`SELECT id,username,role,status FROM users WHERE id=${userId}::uuid FOR UPDATE`;
      const user = rows[0];
      if (
        !user ||
        user.status !== UserStatus.ACTIVE ||
        user.role !== UserRole.OPERATOR
      )
        return null;
      const credential = await tx.userCredential.findUnique({
        where: { userId },
      });
      if (!credential || credential.passwordHash !== verifiedHash) return null;
      await tx.session.create({ data: { userId, tokenHash, expiresAt } });
      return { id: user.id, username: user.username };
    });
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
      authLevel: session.authLevel as AuthLevel,
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

    if (!record || record.user.status !== UserStatus.ACTIVE) return null;

    return {
      session: {
        authLevel: record.authLevel as AuthLevel,
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
