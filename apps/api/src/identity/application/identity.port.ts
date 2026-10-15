import type { UserRole } from "../domain/user-policy";
import type {
  LocalLoginRecord,
  SessionSummary,
  UserSummary,
} from "../domain/identity.types";

export abstract class IdentityPort {
  abstract findUserByUsername(
    username: string,
  ): Promise<LocalLoginRecord | null>;
  abstract findUserById(id: string): Promise<UserSummary | null>;
  abstract findActiveRole(userId: string): Promise<UserRole | null>;
  abstract createSessionIfUnchanged(
    userId: string,
    verifiedHash: string,
    tokenHash: string,
    expiresAt: Date,
  ): Promise<UserSummary | null>;
  abstract createSession(
    userId: string,
    tokenHash: string,
    expiresAt: Date,
  ): Promise<SessionSummary>;
  abstract findSessionByTokenHash(
    tokenHash: string,
  ): Promise<{ session: SessionSummary; user: UserSummary } | null>;
  abstract deleteSessionByTokenHash(tokenHash: string): Promise<void>;
  abstract deleteExpiredSessions(): Promise<number>;
  abstract verifyPassword(
    password: string,
    passwordHash: string,
  ): Promise<boolean>;
}
