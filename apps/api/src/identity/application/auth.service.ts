import { HttpException, HttpStatus, Injectable } from "@nestjs/common";
import { randomBytes, createHash } from "node:crypto";
import { IdentityPort } from "./identity.port";
import { ProviderAuthenticationPort } from "./provider-auth.port";
import { normalizeUsername, isLoginPassword } from "../domain/credentials";
import { UserRole, UserStatus } from "../domain/user-policy";
import type {
  UserSummary,
  VerifiedProviderIdentity,
} from "../domain/identity.types";

interface RateLimitEntry {
  count: number;
  resetAt: number;
  pending: number;
}

const MAX_FAILURES = 5;
const WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// Generated once with @nexora/database hashPassword; no dummy database identity.
const DUMMY_SCRYPT_HASH =
  "$scrypt$N=16384,r=8,p=1$60656568160bc3feaa7de50936ab572a$97c1ccfd0e1b072a16606b9a06647d6db3c4c3c645cb859e603304c4e67651cbcae5926709af5bc4c8e76810cccf1e41db34f1a15cdc379fa6c6698f4a3e9f22";
const MAX_ENTRIES = 128;
// Small local-operator instance: burst 10, refill 1/sec, at most 4 concurrent Scrypt operations.
const GLOBAL_BURST = 10;
const REFILL_MS = 1000;
const MAX_CONCURRENT = 4;

@Injectable()
export class AuthService {
  private readonly rateLimits = new Map<string, RateLimitEntry>();

  private tokens = GLOBAL_BURST;
  private lastRefill: number;
  private pending = 0;

  private readonly providerPort?: ProviderAuthenticationPort;
  private readonly now: () => number;

  constructor(
    private readonly port: IdentityPort,
    providerPortOrNow?: ProviderAuthenticationPort | (() => number),
    now?: () => number,
  ) {
    if (typeof providerPortOrNow === "function") {
      this.providerPort = undefined;
      this.now = providerPortOrNow;
    } else {
      this.providerPort = providerPortOrNow;
      this.now = now ?? Date.now;
    }
    this.lastRefill = this.now();
  }

  private throttled(): never {
    throw new HttpException(
      {
        code: "TOO_MANY_REQUESTS",
        message: "Quá nhiều yêu cầu đăng nhập. Vui lòng thử lại sau.",
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }

  private admit(username: string): RateLimitEntry {
    const now = this.now();
    for (const [key, entry] of this.rateLimits) {
      if (entry.pending === 0 && now >= entry.resetAt)
        this.rateLimits.delete(key);
    }
    let entry = this.rateLimits.get(username);
    if (entry && entry.count + entry.pending >= MAX_FAILURES) this.throttled();
    this.tokens = Math.min(
      GLOBAL_BURST,
      this.tokens + Math.max(0, now - this.lastRefill) / REFILL_MS,
    );
    this.lastRefill = now;
    if (this.tokens < 1 || this.pending >= MAX_CONCURRENT) this.throttled();
    if (!entry && this.rateLimits.size >= MAX_ENTRIES) {
      // Map insertion order is admission age. Pending entries cannot be evicted.
      const candidate = [...this.rateLimits].find(
        ([, value]) => value.pending === 0 && value.count < MAX_FAILURES,
      );
      if (!candidate) this.throttled();
      this.rateLimits.delete(candidate[0]);
    }
    if (!entry) {
      entry = { count: 0, pending: 0, resetAt: now + WINDOW_MS };
      this.rateLimits.set(username, entry);
    }
    this.tokens -= 1;
    this.pending += 1;
    entry.pending += 1;
    return entry;
  }

  async login(
    usernameInput: unknown,
    password: unknown,
  ): Promise<{ user: UserSummary; token: string; expiresAt: Date }> {
    const username = normalizeUsername(usernameInput);
    if (!username || !isLoginPassword(password)) {
      throw new HttpException(
        {
          code: "VALIDATION_ERROR",
          message: "Tên đăng nhập hoặc mật khẩu không hợp lệ",
        },
        HttpStatus.BAD_REQUEST,
      );
    }
    const entry = this.admit(username);
    try {
      const userRecord = await this.port.findUserByUsername(username);
      const eligible =
        userRecord?.role === UserRole.ADMIN &&
        userRecord.status === UserStatus.ACTIVE &&
        !!userRecord.passwordHash;
      const matches = await this.port.verifyPassword(
        password,
        eligible ? userRecord.passwordHash! : DUMMY_SCRYPT_HASH,
      );
      if (!eligible || !matches) {
        if (this.now() >= entry.resetAt) {
          entry.count = 0;
          entry.resetAt = this.now() + WINDOW_MS;
        }
        entry.count += 1;
        throw new HttpException(
          {
            code: "UNAUTHORIZED",
            message: "Tên đăng nhập hoặc mật khẩu không chính xác",
          },
          HttpStatus.UNAUTHORIZED,
        );
      }
      const token = randomBytes(32).toString("hex");
      const tokenHash = createHash("sha256").update(token).digest("hex");
      const expiresAt = new Date(this.now() + SESSION_TTL_MS);
      await this.port.createSession(userRecord.id, tokenHash, expiresAt);
      entry.count = 0;
      return {
        user: { id: userRecord.id, username: userRecord.username },
        token,
        expiresAt,
      };
    } finally {
      this.pending -= 1;
      entry.pending -= 1;
      if (entry.pending === 0 && entry.count === 0)
        this.rateLimits.delete(username);
    }
  }

  async validateSession(token: string): Promise<UserSummary | null> {
    if (!token || typeof token !== "string" || token.length !== 64) {
      return null;
    }

    const tokenHash = createHash("sha256").update(token).digest("hex");
    const result = await this.port.findSessionByTokenHash(tokenHash);

    if (!result) return null;

    if (result.session.expiresAt.getTime() < Date.now()) {
      // Best-effort expired session invalidation with safe error handling to prevent unhandled rejections
      void this.port.deleteSessionByTokenHash(tokenHash).catch(() => {
        // Silently swallow cleanup error; expired session is already treated as null
      });
      return null;
    }

    return result.user;
  }

  async logout(token: string): Promise<void> {
    if (!token || typeof token !== "string") return;
    const tokenHash = createHash("sha256").update(token).digest("hex");
    await this.port.deleteSessionByTokenHash(tokenHash);
  }

  async authenticateExternalIdentity(
    verified: VerifiedProviderIdentity,
  ): Promise<{ user: UserSummary; token: string; expiresAt: Date }> {
    if (
      !verified ||
      typeof verified !== "object" ||
      verified.provider !== "uniship" ||
      typeof verified.providerSubject !== "string" ||
      verified.providerSubject.trim().length === 0 ||
      verified.providerSubject.length > 128 ||
      verified.providerSubject !== verified.providerSubject.trim()
    ) {
      throw new HttpException(
        {
          code: "AUTHENTICATION_FAILED",
          message:
            "Thông tin đăng nhập không hợp lệ hoặc tài khoản chưa được cấp quyền truy cập.",
        },
        HttpStatus.UNAUTHORIZED,
      );
    }

    const identity = await this.port.findExternalIdentity(
      verified.provider,
      verified.providerSubject,
    );

    if (
      !identity ||
      identity.user.role !== UserRole.OPERATOR ||
      identity.user.status !== UserStatus.ACTIVE
    ) {
      throw new HttpException(
        {
          code: "AUTHENTICATION_FAILED",
          message:
            "Thông tin đăng nhập không hợp lệ hoặc tài khoản chưa được cấp quyền truy cập.",
        },
        HttpStatus.UNAUTHORIZED,
      );
    }

    const token = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const expiresAt = new Date(this.now() + SESSION_TTL_MS);

    await this.port.createSession(identity.user.id, tokenHash, expiresAt);

    return {
      user: { id: identity.user.id, username: identity.user.username },
      token,
      expiresAt,
    };
  }

  async loginWithProvider(
    usernameInput: unknown,
    password: unknown,
  ): Promise<{ user: UserSummary; token: string; expiresAt: Date }> {
    const username = normalizeUsername(usernameInput);
    if (!username || !isLoginPassword(password)) {
      throw new HttpException(
        {
          code: "VALIDATION_ERROR",
          message: "Tên đăng nhập hoặc mật khẩu không hợp lệ",
        },
        HttpStatus.BAD_REQUEST,
      );
    }
    const rateLimitKey = `provider:${username}`;
    const entry = this.admit(rateLimitKey);
    try {
      if (!this.providerPort) {
        throw new HttpException(
          {
            code: "SERVICE_UNAVAILABLE",
            message:
              "Dịch vụ xác thực nhà cung cấp chưa được cấu hình hoặc tạm thời không khả dụng.",
          },
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      }

      let verified: VerifiedProviderIdentity;
      try {
        verified = await this.providerPort.authenticate({ username, password });
      } catch (err) {
        if (
          err instanceof HttpException &&
          err.getStatus() === HttpStatus.UNAUTHORIZED
        ) {
          if (this.now() >= entry.resetAt) {
            entry.count = 0;
            entry.resetAt = this.now() + WINDOW_MS;
          }
          entry.count += 1;
        }
        throw err;
      }

      try {
        const result = await this.authenticateExternalIdentity(verified);
        entry.count = 0;
        return result;
      } catch (err) {
        if (
          err instanceof HttpException &&
          err.getStatus() === HttpStatus.UNAUTHORIZED
        ) {
          if (this.now() >= entry.resetAt) {
            entry.count = 0;
            entry.resetAt = this.now() + WINDOW_MS;
          }
          entry.count += 1;
        }
        throw err;
      }
    } finally {
      this.pending -= 1;
      entry.pending -= 1;
      if (entry.pending === 0 && entry.count === 0) {
        this.rateLimits.delete(rateLimitKey);
      }
    }
  }
}
