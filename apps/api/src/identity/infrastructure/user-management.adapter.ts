import { ConnectionStatus } from "../../carrier/domain/carrier";
import {
  createDatabase,
  hashPassword,
  type Prisma,
  type PrismaClient,
} from "@nexora/database";
import { UserManagementPort } from "../application/user-management.port";
import { IdentityError } from "../domain/identity-error";
import type { ManagedUser } from "../domain/identity.types";
import { UserRole, UserStatus } from "../domain/user-policy";

type LockedUser = {
  id: string;
  username: string;
  role: string;
  status: string;
  created_at: Date;
  updated_at: Date;
};
export class UserManagementAdapter implements UserManagementPort {
  private instance?: PrismaClient;
  constructor(private readonly url: string) {}
  get client(): PrismaClient {
    return (this.instance ??= createDatabase(this.url));
  }
  hashPassword(password: string) {
    return hashPassword(password);
  }
  private async lockUsers(
    tx: Prisma.TransactionClient,
    actorId: string,
    targetId: string,
  ) {
    // Immutable UUID order is shared by reissue and status changes; token writes
    // always follow the target user lock. No token-row-first transactions.
    const rows = await tx.$queryRaw<
      LockedUser[]
    >`SELECT id,username,role,status,created_at,updated_at FROM users WHERE id IN (${actorId}::uuid,${targetId}::uuid) ORDER BY id FOR UPDATE`;
    const actor = rows.find((u) => u.id === actorId);
    if (
      !actor ||
      actor.role !== UserRole.ADMIN ||
      actor.status !== UserStatus.ACTIVE
    )
      throw new IdentityError("FORBIDDEN");
    const target = rows.find((u) => u.id === targetId);
    if (!target) throw new IdentityError("NOT_FOUND");
    return target;
  }
  async createOperator(
    actorId: string,
    username: string,
    tokenHash: string,
    expiresAt: Date,
  ) {
    try {
      return await this.client.$transaction(async (tx) => {
        await this.lockUsers(tx, actorId, actorId);
        const user = await tx.user.create({
          data: {
            username,
            role: UserRole.OPERATOR,
            status: UserStatus.ACTIVE,
          },
        });
        await tx.operatorSetupToken.create({
          data: { userId: user.id, issuedBy: actorId, tokenHash, expiresAt },
        });
        return { id: user.id, username: user.username };
      });
    } catch (error) {
      if ((error as { code?: string }).code === "P2002")
        throw new IdentityError("USERNAME_EXISTS");
      throw error;
    }
  }
  async reissue(
    actorId: string,
    userId: string,
    tokenHash: string,
    expiresAt: Date,
  ) {
    await this.client.$transaction(async (tx) => {
      const user = await this.lockUsers(tx, actorId, userId);
      if (user.role !== UserRole.OPERATOR || user.status !== UserStatus.ACTIVE)
        throw new IdentityError("NOT_FOUND");
      if (await tx.userCredential.findUnique({ where: { userId } }))
        throw new IdentityError("OPERATOR_ALREADY_CONFIGURED");
      await tx.operatorSetupToken.updateMany({
        where: { userId, consumedAt: null },
        data: { consumedAt: new Date() },
      });
      await tx.operatorSetupToken.create({
        data: { userId, issuedBy: actorId, tokenHash, expiresAt },
      });
    });
  }
  async consume(tokenHash: string, passwordHash: string) {
    const token = await this.client.operatorSetupToken.findUnique({
      where: { tokenHash },
    });
    if (!token || token.consumedAt || token.expiresAt <= new Date())
      throw new IdentityError("INVALID_OR_EXPIRED_SETUP_TOKEN");
    await this.client.$transaction(async (tx) => {
      const users = await tx.$queryRaw<
        LockedUser[]
      >`SELECT id,role,status FROM users WHERE id=${token.userId}::uuid FOR UPDATE`;
      const user = users[0];
      if (
        !user ||
        user.role !== UserRole.OPERATOR ||
        user.status !== UserStatus.ACTIVE
      )
        throw new IdentityError("INVALID_OR_EXPIRED_SETUP_TOKEN");
      const consumed = await tx.$queryRaw<
        Array<{ id: string }>
      >`UPDATE operator_setup_tokens SET consumed_at=clock_timestamp() WHERE token_hash=${tokenHash} AND user_id=${user.id}::uuid AND consumed_at IS NULL AND expires_at>clock_timestamp() RETURNING id`;
      if (consumed.length !== 1)
        throw new IdentityError("INVALID_OR_EXPIRED_SETUP_TOKEN");
      if (await tx.userCredential.findUnique({ where: { userId: user.id } }))
        throw new IdentityError("OPERATOR_ALREADY_CONFIGURED");
      await tx.userCredential.create({
        data: { userId: user.id, passwordHash },
      });
    });
  }
  async setStatus(
    actorId: string,
    userId: string,
    status: UserStatus,
  ): Promise<ManagedUser> {
    return this.client.$transaction(async (tx) => {
      // Acquired BEFORE any user lock. All active-admin reductions use this key.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('nexora_active_admin_invariant'))`;
      const user = await this.lockUsers(tx, actorId, userId);
      if (
        user.role === UserRole.ADMIN &&
        user.status === UserStatus.ACTIVE &&
        status === UserStatus.DISABLED &&
        (await tx.user.count({
          where: { role: UserRole.ADMIN, status: UserStatus.ACTIVE },
        })) <= 1
      )
        throw new IdentityError("LAST_ACTIVE_ADMIN");
      const updated = await tx.user.update({
        where: { id: userId },
        data: { status },
      });
      if (status === UserStatus.DISABLED) {
        await tx.session.deleteMany({ where: { userId } });
        await tx.operatorSetupToken.updateMany({
          where: { userId, consumedAt: null },
          data: { consumedAt: new Date() },
        });
        // User lock precedes the Carrier epoch and children. Reactivation never restores it.
        await tx.carrierUserState.upsert({
          where: { userId },
          create: { userId, generation: 1 },
          update: { generation: { increment: 1 } },
        });
        // User lock is held before touching Carrier children, shared with all writers.
        await tx.carrierConnectionSecret.deleteMany({
          where: { connection: { userId } },
        });
        await tx.carrierConnection.updateMany({
          where: { userId },
          data: {
            status: ConnectionStatus.REAUTH_REQUIRED,
            lifecycleVersion: { increment: 1 },
          },
        });
      }
      return {
        id: updated.id,
        username: updated.username,
        role: updated.role as UserRole,
        status: updated.status as UserStatus,
        hasPassword: !!(await tx.userCredential.findUnique({
          where: { userId },
        })),
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
      };
    });
  }
  async listUsers(actorId: string): Promise<ManagedUser[]> {
    return this.client.$transaction(async (tx) => {
      await this.lockUsers(tx, actorId, actorId);
      const users = await tx.user.findMany({
        include: { credential: { select: { userId: true } } },
        orderBy: { username: "asc" },
      });
      return users.map((u) => ({
        id: u.id,
        username: u.username,
        role: u.role as UserRole,
        status: u.status as UserStatus,
        hasPassword: !!u.credential,
        createdAt: u.createdAt,
        updatedAt: u.updatedAt,
      }));
    });
  }
  async onApplicationShutdown() {
    await this.instance?.$disconnect();
  }
}
