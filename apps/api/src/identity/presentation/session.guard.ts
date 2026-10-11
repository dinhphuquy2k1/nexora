import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from "@nestjs/common";
import type { Request } from "express";
import { AuthService } from "../application/auth.service";

export function extractSessionToken(cookieHeader?: string): string | null {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(/(?:^|;\s*)nexora_session=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const token = extractSessionToken(req.headers.cookie);

    if (!token) {
      throw new HttpException(
        {
          code: "UNAUTHORIZED",
          message: "Chưa đăng nhập hoặc phiên làm việc đã hết hạn",
        },
        HttpStatus.UNAUTHORIZED,
      );
    }

    const user = await this.authService.validateSession(token);
    if (!user) {
      throw new HttpException(
        {
          code: "UNAUTHORIZED",
          message: "Phiên làm việc không hợp lệ hoặc đã hết hạn",
        },
        HttpStatus.UNAUTHORIZED,
      );
    }

    (req as Request & { user: typeof user }).user = user;
    return true;
  }
}
