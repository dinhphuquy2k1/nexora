import { LifecycleCode, LifecycleFailure } from "../../domain/lifecycle";
import { ProviderBudget } from "./provider-budget";
import { UnishipHttpClient } from "./uniship-http.client";

/** Scheduling hint only, read after provider verification. Never identity evidence. */
export function tokenExpiry(token: string): Date | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3 || parts[1].length > 16384) return null;
    const payload: unknown = JSON.parse(
      Buffer.from(parts[1], "base64url").toString("utf8"),
    );
    if (!payload || typeof payload !== "object" || !("exp" in payload))
      return null;
    const exp = payload.exp;
    if (
      typeof exp !== "number" ||
      !Number.isSafeInteger(exp) ||
      exp <= 0 ||
      exp > 8640000000000
    )
      return null;
    return new Date(exp * 1000);
  } catch {
    return null;
  }
}
export class UnishipAdapter {
  constructor(
    private readonly client: UnishipHttpClient,
    private readonly budget = new ProviderBudget(),
  ) {}
  async acquire(username: string, password: string) {
    return this.budget.run(async () => {
      try {
        const login = await this.client.authenticate({ username, password });
        const verified = await this.client.verify(login.candidateToken);
        if (login.externalAccountId !== verified.externalAccountId)
          throw new LifecycleFailure(LifecycleCode.CANDIDATE_IDENTITY_MISMATCH);
        return {
          externalAccountId: verified.externalAccountId,
          token: login.candidateToken,
          expiresAt: tokenExpiry(login.candidateToken),
        };
      } catch (error) {
        if (error instanceof LifecycleFailure) throw error;
        // Only normalize our trusted transport's fixed safe fields; never retain provider bodies.
        const response = (
          error as { getResponse?: () => unknown }
        )?.getResponse?.();
        if (response && typeof response === "object" && "code" in response) {
          if (response.code === "AUTHENTICATION_FAILED")
            throw new LifecycleFailure(LifecycleCode.PROVIDER_AUTH_FAILED);
          if (response.code === LifecycleCode.TOKEN_REJECTED)
            throw new LifecycleFailure(LifecycleCode.TOKEN_REJECTED);
          if (response.code === LifecycleCode.RATE_LIMITED) {
            const delay =
              "retryAfterMs" in response &&
              typeof response.retryAfterMs === "number"
                ? response.retryAfterMs
                : 1000;
            throw new LifecycleFailure(LifecycleCode.RATE_LIMITED, delay);
          }
        }
        throw new LifecycleFailure(LifecycleCode.SERVICE_UNAVAILABLE);
      }
    });
  }
}
