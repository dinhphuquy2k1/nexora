import { createHash } from "node:crypto";
import { AuthLevel } from "../domain/session-assurance";
import { extractSessionToken } from "./session.guard";
import { UserRole } from "../domain/user-policy";
import {
  Injectable,
  HttpException,
  type CanActivate,
  type ExecutionContext,
} from "@nestjs/common";
import { IdentityPort } from "../application/identity.port";
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly port: IdentityPort) {}
  async canActivate(context: ExecutionContext) {
    const req = context
      .switchToHttp()
      .getRequest<{ user?: { id: string }; headers: { cookie?: string } }>();
    if (!req.user)
      throw new HttpException(
        { code: "UNAUTHORIZED", message: "Chưa đăng nhập" },
        401,
      );
    const token = extractSessionToken(req.headers.cookie);
    const session = token
      ? await this.port.findSessionByTokenHash(
          createHash("sha256").update(token).digest("hex"),
        )
      : null;
    if (
      !session ||
      session.user.id !== req.user.id ||
      session.session.expiresAt.getTime() <= Date.now()
    )
      throw new HttpException(
        {
          code: "UNAUTHORIZED",
          message: "Phiên làm việc không hợp lệ hoặc đã hết hạn",
        },
        401,
      );
    if (
      (await this.port.findActiveRole(req.user.id)) !== UserRole.ADMIN ||
      session.session.authLevel !== AuthLevel.MFA
    )
      throw new HttpException(
        { code: "FORBIDDEN", message: "Không có quyền quản trị" },
        403,
      );
    return true;
  }
}
