import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  Inject,
  Optional,
} from "@nestjs/common";
import type { Request } from "express";

import { isAllowedOrigin, resolveAllowedOrigins } from "./origin-policy";
export { isAllowedOrigin } from "./origin-policy";

@Injectable()
export class OriginGuard implements CanActivate {
  private readonly allowedOrigins: readonly string[];
  constructor(
    @Optional()
    @Inject("CONFIG")
    config?: {
      trustedOrigins: readonly string[];
    },
  ) {
    this.allowedOrigins =
      config?.trustedOrigins ?? resolveAllowedOrigins(process.env);
  }
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const origin = req.headers.origin;

    if (!origin || !isAllowedOrigin(origin, this.allowedOrigins)) {
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
