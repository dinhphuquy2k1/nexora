import { HttpException, HttpStatus, Injectable } from "@nestjs/common";
import { randomBytes, createHash } from "node:crypto";
import { IdentityPort } from "./identity.port";
import type { UserSummary } from "../domain/identity.types";

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const MAX_FAILURES = 5;
const WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

@Injectable()
export class AuthService {
  private readonly rateLimits = new Map<string, RateLimitEntry>();

  constructor(private readonly port: IdentityPort) {}

  private checkRateLimit(key: string): void {
    const now = Date.now();
    const entry = this.rateLimits.get(key);
    if (!entry) return;

    if (now > entry.resetAt) {
      this.rateLimits.delete(key);
      return;
    }

    if (entry.count >= MAX_FAILURES) {
      throw new HttpException(
        {
          code: "TOO_MANY_REQUESTS",
          message:
            "Quá nhiều lần đăng nhập không thành công. Vui lòng thử lại sau 5 phút.",
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private recordFailure(key: string): void {
    const now = Date.now();
    const entry = this.rateLimits.get(key);
    if (!entry || now > entry.resetAt) {
      this.rateLimits.set(key, { count: 1, resetAt: now + WINDOW_MS });
    } else {
      entry.count += 1;
    }
  }

  private clearRateLimit(key: string): void {
    this.rateLimits.delete(key);
  }

  async login(
    username: string,
    password: string,
    clientIp = "unknown",
  ): Promise<{ user: UserSummary; token: string; expiresAt: Date }> {
    if (!username || !password) {
      throw new HttpException(
        {
          code: "VALIDATION_ERROR",
          message: "Tên đăng nhập và mật khẩu là bắt buộc",
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    const rateLimitKey = `${clientIp}:${username.toLowerCase()}`;
    this.checkRateLimit(rateLimitKey);

    const userRecord = await this.port.findUserByUsername(username);
    if (!userRecord || !userRecord.isActive) {
      this.recordFailure(rateLimitKey);
      throw new HttpException(
        {
          code: "UNAUTHORIZED",
          message: "Tên đăng nhập hoặc mật khẩu không chính xác",
        },
        HttpStatus.UNAUTHORIZED,
      );
    }

    const passwordMatches = await this.port.verifyPassword(
      password,
      userRecord.passwordHash,
    );
    if (!passwordMatches) {
      this.recordFailure(rateLimitKey);
      throw new HttpException(
        {
          code: "UNAUTHORIZED",
          message: "Tên đăng nhập hoặc mật khẩu không chính xác",
        },
        HttpStatus.UNAUTHORIZED,
      );
    }

    // Success: clear failures
    this.clearRateLimit(rateLimitKey);

    // Generate cryptographically secure opaque token
    const token = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

    await this.port.createSession(userRecord.id, tokenHash, expiresAt);

    return {
      user: {
        id: userRecord.id,
        username: userRecord.username,
      },
      token,
      expiresAt,
    };
  }

  async validateSession(token: string): Promise<UserSummary | null> {
    if (!token || typeof token !== "string" || token.length !== 64) {
      return null;
    }

    const tokenHash = createHash("sha256").update(token).digest("hex");
    const result = await this.port.findSessionByTokenHash(tokenHash);

    if (!result) return null;

    if (result.session.expiresAt.getTime() < Date.now()) {
      // Invalidate expired session in background
      void this.port.deleteSessionByTokenHash(tokenHash);
      return null;
    }

    return result.user;
  }

  async logout(token: string): Promise<void> {
    if (!token || typeof token !== "string") return;
    const tokenHash = createHash("sha256").update(token).digest("hex");
    await this.port.deleteSessionByTokenHash(tokenHash);
  }
}
