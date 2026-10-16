import { LifecycleCode, LifecycleFailure } from "../../domain/lifecycle";

/** Nexora admission policy, not a statement about the provider's quota. */
export class UserCarrierAdmission {
  private readonly windows = new Map<
    string,
    { start: number; count: number }
  >();
  constructor(private readonly now: () => number = Date.now) {}
  admit(userId: string): void {
    const now = this.now();
    for (const [key, value] of this.windows) {
      if (now - value.start >= 60000) this.windows.delete(key);
    }
    let window = this.windows.get(userId);
    if (!window) {
      if (this.windows.size >= 1024)
        throw new LifecycleFailure(LifecycleCode.RATE_LIMITED, 60000);
      window = { start: now, count: 0 };
      this.windows.set(userId, window);
    }
    if (window.count >= 5)
      throw new LifecycleFailure(
        LifecycleCode.RATE_LIMITED,
        60000 - (now - window.start),
      );
    window.count++;
  }
}

export class ProviderBudget {
  private active = 0;
  private failures = 0;
  private blockedUntil = 0;
  constructor(private readonly now: () => number = Date.now) {}
  async run<T>(operation: () => Promise<T>): Promise<T> {
    if (this.active >= 2 || this.now() < this.blockedUntil) {
      throw new LifecycleFailure(
        LifecycleCode.RATE_LIMITED,
        Math.max(1000, this.blockedUntil - this.now()),
      );
    }
    this.active++;
    try {
      const value = await operation();
      this.failures = 0;
      return value;
    } catch (error) {
      if (
        error instanceof LifecycleFailure &&
        [LifecycleCode.RATE_LIMITED, LifecycleCode.SERVICE_UNAVAILABLE].some(
          (code) => code === error.code,
        )
      ) {
        const delay = Math.max(
          Math.min(error.retryAfterMs, 300000),
          Math.min(60000, 1000 * 2 ** Math.min(this.failures++, 6)),
        );
        this.blockedUntil = Math.max(this.blockedUntil, this.now() + delay);
      }
      throw error;
    } finally {
      this.active--;
    }
  }
}
