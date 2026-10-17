import { loadDeploymentPolicy } from "@nexora/shared";
import { trustedProxies } from "./proxy-policy";
import { Catch, HttpException, HttpStatus } from "@nestjs/common";
import type {
  ArgumentsHost,
  ExceptionFilter,
  INestApplication,
} from "@nestjs/common";
import { ApiProperty, DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { randomUUID } from "node:crypto";
import type { Request, Response, NextFunction } from "express";
export class ApiErrorDto {
  @ApiProperty() code!: string;
  @ApiProperty() message!: string;
  @ApiProperty() requestId!: string;
}
interface HttpErrorDefinition {
  readonly code: string;
  readonly message: string;
}

const HTTP_ERROR_DEFAULTS: Readonly<
  Partial<Record<number, HttpErrorDefinition>>
> = {
  [HttpStatus.BAD_REQUEST]: {
    code: "VALIDATION_ERROR",
    message: "Yêu cầu không hợp lệ",
  },
  [HttpStatus.UNAUTHORIZED]: {
    code: "UNAUTHORIZED",
    message: "Chưa đăng nhập hoặc phiên đã hết hạn",
  },
  [HttpStatus.FORBIDDEN]: {
    code: "FORBIDDEN",
    message: "Không có quyền truy cập",
  },
  [HttpStatus.NOT_FOUND]: {
    code: "NOT_FOUND",
    message: "Không tìm thấy endpoint",
  },
  [HttpStatus.TOO_MANY_REQUESTS]: {
    code: "TOO_MANY_REQUESTS",
    message: "Quá nhiều yêu cầu. Vui lòng thử lại sau.",
  },
};

const INTERNAL_ERROR_DEFAULT: HttpErrorDefinition = {
  code: "INTERNAL_ERROR",
  message: "Lỗi hệ thống",
};

@Catch()
class ErrorFilter implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    const status =
      error instanceof HttpException
        ? error.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    const responseObj =
      error instanceof HttpException &&
      typeof error.getResponse() === "object" &&
      error.getResponse() !== null
        ? (error.getResponse() as Record<string, unknown>)
        : null;

    const defaults = HTTP_ERROR_DEFAULTS[status] ?? INTERNAL_ERROR_DEFAULT;
    const hasCustomCode = typeof responseObj?.code === "string";
    const code = hasCustomCode ? responseObj.code : defaults.code;
    const message =
      status !== HttpStatus.NOT_FOUND &&
      hasCustomCode &&
      typeof responseObj?.message === "string"
        ? responseObj.message
        : defaults.message;

    res.status(status).json({
      code,
      message,
      requestId: res.locals.requestId,
    });
  }
}
export function configure(app: INestApplication) {
  const httpAdapter = app.getHttpAdapter();
  if (typeof httpAdapter?.getInstance === "function") {
    const instance = httpAdapter.getInstance();
    if (typeof instance?.set === "function") {
      instance.set(
        "trust proxy",
        trustedProxies(process.env, loadDeploymentPolicy(process.env)),
      );
    }
  }
  app.setGlobalPrefix("api");
  app.useGlobalFilters(new ErrorFilter());
  app.use((_req: Request, res: Response, next: NextFunction) => {
    const requestId = randomUUID();
    res.locals.requestId = requestId;
    res.setHeader("x-request-id", requestId);
    res.setHeader("cache-control", "no-store");
    const started = Date.now();
    res.on("finish", () => {
      console.log(
        JSON.stringify({
          level: "info",
          event: "http",
          requestId,
          status: res.statusCode,
          durationMs: Date.now() - started,
        }),
      );
    });
    next();
  });
  // No request headers, paths, bodies or error strings are logged: credentials and sensitive content are excluded by construction.
  app.enableShutdownHooks();
}
export function document(app: INestApplication) {
  return SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle("Nexora foundation")
      .setVersion("0.1.0")
      .build(),
    { extraModels: [ApiErrorDto] },
  );
}
