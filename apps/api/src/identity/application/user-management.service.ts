import { HttpException, HttpStatus, Injectable } from "@nestjs/common";
import { randomBytes, createHash } from "node:crypto";
import { UserManagementPort } from "./user-management.port";
import { AuthService } from "./auth.service";
import { IdentityError } from "../domain/identity-error";
import { normalizeUsername, isLoginPassword } from "../domain/credentials";
import { UserStatus } from "../domain/user-policy";

const hashToken = (token: string) =>
  createHash("sha256").update(token).digest("hex");
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;

export interface IdentityErrorMapping {
  readonly status: HttpStatus;
  readonly message: string;
}

export const IDENTITY_ERROR_MAP: Record<string, IdentityErrorMapping> = {
  NOT_FOUND: {
    status: HttpStatus.NOT_FOUND,
    message: "Không thể thực hiện yêu cầu",
  },
  FORBIDDEN: {
    status: HttpStatus.FORBIDDEN,
    message: "Không thể thực hiện yêu cầu",
  },
  LAST_ACTIVE_ADMIN: {
    status: HttpStatus.CONFLICT,
    message: "Không thể vô hiệu hóa quản trị viên hoạt động cuối cùng",
  },
  USERNAME_EXISTS: {
    status: HttpStatus.CONFLICT,
    message: "Tên đăng nhập đã tồn tại",
  },
  OPERATOR_ALREADY_CONFIGURED: {
    status: HttpStatus.BAD_REQUEST,
    message: "Tài khoản đã thiết lập mật khẩu",
  },
  INVALID_OR_EXPIRED_SETUP_TOKEN: {
    status: HttpStatus.BAD_REQUEST,
    message: "Liên kết thiết lập không hợp lệ hoặc đã hết hạn",
  },
};

export const DEFAULT_IDENTITY_ERROR: IdentityErrorMapping = {
  status: HttpStatus.BAD_REQUEST,
  message: "Không thể thực hiện yêu cầu",
};

export function mapIdentityError(error: IdentityError): HttpException {
  const mapping = IDENTITY_ERROR_MAP[error.code] ?? DEFAULT_IDENTITY_ERROR;
  return new HttpException(
    {
      code: error.code,
      message: mapping.message,
    },
    mapping.status,
  );
}

@Injectable()
export class UserManagementService {
  constructor(
    private readonly port: UserManagementPort,
    private readonly auth: AuthService,
    private readonly trustedOrigins: readonly string[],
  ) {}
  private validation(): never {
    throw new HttpException(
      { code: "VALIDATION_ERROR", message: "Yêu cầu không hợp lệ" },
      400,
    );
  }
  private async mapped<T>(action: () => Promise<T>): Promise<T> {
    try {
      return await action();
    } catch (error) {
      if (!(error instanceof IdentityError)) throw error;
      throw mapIdentityError(error);
    }
  }
  private link(origin: string) {
    if (!this.trustedOrigins.includes(origin))
      throw new HttpException(
        { code: "FORBIDDEN", message: "Origin không hợp lệ" },
        403,
      );
    const token = randomBytes(32).toString("hex");
    const url = new URL("/setup", origin);
    url.hash = "token=" + token;
    return {
      tokenHash: hashToken(token),
      setupUrl: url.toString(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    };
  }
  async createOperator(actorId: string, input: unknown, origin: string) {
    if (
      !input ||
      typeof input !== "object" ||
      Array.isArray(input) ||
      Object.keys(input).some((k) => k !== "username")
    )
      this.validation();
    const username = normalizeUsername(
      (input as { username?: unknown }).username,
    );
    if (!username) this.validation();
    const link = this.link(origin);
    const user = await this.mapped(() =>
      this.port.createOperator(
        actorId,
        username,
        link.tokenHash,
        link.expiresAt,
      ),
    );
    return { user, setupUrl: link.setupUrl, expiresAt: link.expiresAt };
  }
  async reissue(actorId: string, id: string, origin: string) {
    if (!uuid.test(id)) this.validation();
    const link = this.link(origin);
    await this.mapped(() =>
      this.port.reissue(actorId, id, link.tokenHash, link.expiresAt),
    );
    return { setupUrl: link.setupUrl, expiresAt: link.expiresAt };
  }
  async setupPassword(input: unknown) {
    if (
      !input ||
      typeof input !== "object" ||
      Array.isArray(input) ||
      Object.keys(input).some((k) => !["token", "password"].includes(k))
    )
      this.validation();
    const { token, password } = input as {
      token?: unknown;
      password?: unknown;
    };
    if (
      typeof token !== "string" ||
      !/^[a-f0-9]{64}$/.test(token) ||
      !isLoginPassword(password) ||
      password.length < 8
    )
      this.validation();
    const tokenHash = hashToken(token);
    return this.auth.withAdmission("setup:" + tokenHash, async () => {
      // The port hashes before consume starts any transaction or acquires locks.
      const passwordHash = await this.port.hashPassword(password);
      await this.mapped(() => this.port.consume(tokenHash, passwordHash));
      return { success: true };
    });
  }
  async setStatus(actorId: string, id: string, input: unknown) {
    if (
      !uuid.test(id) ||
      !input ||
      typeof input !== "object" ||
      Array.isArray(input) ||
      Object.keys(input).length !== 1
    )
      this.validation();
    const status = (input as { status?: unknown }).status;
    if (status !== UserStatus.ACTIVE && status !== UserStatus.DISABLED)
      this.validation();
    return {
      user: await this.mapped(() => this.port.setStatus(actorId, id, status)),
    };
  }
  async listUsers(actorId: string) {
    return { users: await this.mapped(() => this.port.listUsers(actorId)) };
  }
}
