import type { ManagedUser, UserSummary } from "../domain/identity.types";
import type { UserStatus } from "../domain/user-policy";
export abstract class UserManagementPort {
  abstract createOperator(
    actorId: string,
    username: string,
    tokenHash: string,
    expiresAt: Date,
  ): Promise<UserSummary>;
  abstract reissue(
    actorId: string,
    userId: string,
    tokenHash: string,
    expiresAt: Date,
  ): Promise<void>;
  abstract consume(tokenHash: string, passwordHash: string): Promise<void>;
  abstract setStatus(
    actorId: string,
    userId: string,
    status: UserStatus,
  ): Promise<ManagedUser>;
  abstract listUsers(actorId: string): Promise<ManagedUser[]>;
  abstract hashPassword(password: string): Promise<string>;
}
