import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from "@nestjs/common";
import type { Request } from "express";

export function isAllowedOrigin(origin?: string): boolean {
  if (!origin) return false;
  try {
    const parsed = new URL(origin);
    const hostname = parsed.hostname;
    if (hostname === "localhost" || hostname === "127.0.0.1") {
      return true;
    }
    if (process.env.ALLOWED_ORIGINS) {
      const allowed = process.env.ALLOWED_ORIGINS.split(",").map((s) =>
        s.trim(),
      );
      if (allowed.includes(origin)) return true;
    }
    return false;
  } catch {
    return false;
  }
}

@Injectable()
export class OriginGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const origin = req.headers.origin;

    if (!origin || !isAllowedOrigin(origin)) {
      throw new HttpException(
        {
          code: "FORBIDDEN",
          message: "Origin không hợp lệ hoặc không được phép",
        },
        HttpStatus.FORBIDDEN,
      );
    }

    return true;
  }
}
