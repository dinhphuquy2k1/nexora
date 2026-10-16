import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import { AuthService } from "../application/auth.service";
import { isAdminBoundary } from "./admin-boundary";
import { IS_PUBLIC_KEY } from "./public.decorator";

export function extractSessionToken(cookieHeader?: string): string | null {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(/(?:^|;\s*)nexora_session=([^;]+)/);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return null;
  }
}

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    private readonly authService: AuthService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic && !isAdminBoundary(context)) {
      return true;
    }

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
