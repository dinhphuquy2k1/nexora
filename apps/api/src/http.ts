import { Catch, HttpException } from "@nestjs/common";
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
@Catch()
class ErrorFilter implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    const status = error instanceof HttpException ? error.getStatus() : 500;
    const responseObj =
      error instanceof HttpException &&
      typeof error.getResponse() === "object" &&
      error.getResponse() !== null
        ? (error.getResponse() as Record<string, unknown>)
        : null;

    const defaultCode =
      status === 404
        ? "NOT_FOUND"
        : status === 400
          ? "VALIDATION_ERROR"
          : status === 401
            ? "UNAUTHORIZED"
            : status === 403
              ? "FORBIDDEN"
              : status === 429
                ? "TOO_MANY_REQUESTS"
                : "INTERNAL_ERROR";

    const defaultMessage =
      status === 404
        ? "Không tìm thấy endpoint"
        : status === 400
          ? "Yêu cầu không hợp lệ"
          : status === 401
            ? "Chưa đăng nhập hoặc phiên đã hết hạn"
            : status === 403
              ? "Không có quyền truy cập"
              : status === 429
                ? "Quá nhiều yêu cầu. Vui lòng thử lại sau."
                : "Lỗi hệ thống";

    const code =
      typeof responseObj?.code === "string" ? responseObj.code : defaultCode;
    const message =
      status === 404
        ? defaultMessage
        : typeof responseObj?.code === "string" &&
            typeof responseObj?.message === "string"
          ? responseObj.message
          : defaultMessage;

    res.status(status).json({
      code,
      message,
      requestId: res.locals.requestId,
    });
  }
}
export function configure(app: INestApplication) {
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
