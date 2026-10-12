import type {
  LocalUserRecord,
  SessionSummary,
  UserSummary,
} from "../domain/identity.types";

export abstract class IdentityPort {
  abstract findUserByUsername(
    username: string,
  ): Promise<LocalUserRecord | null>;
  abstract findUserById(id: string): Promise<UserSummary | null>;
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
