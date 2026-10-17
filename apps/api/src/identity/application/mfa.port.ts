import type { UserSummary } from "../domain/identity.types";
export type MfaInput = { type: "totp" | "recovery"; code: string };
export abstract class MfaPort {
  abstract assertPublicReady(): Promise<void>;
  abstract issueChallenge(
    userId: string,
    verifiedHash: string,
    tokenHash: string,
    expiresAt: Date,
  ): Promise<UserSummary | "NOT_ENROLLED" | null>;
  abstract challengeOwner(tokenHash: string): Promise<string | null>;
  abstract verify(
    userId: string,
    challengeHash: string,
    input: MfaInput,
    sessionHash: string,
    expiresAt: Date,
  ): Promise<UserSummary | null>;
  abstract cancel(tokenHash: string): Promise<void>;
}
