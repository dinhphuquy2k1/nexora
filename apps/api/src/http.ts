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
    const code =
      status === 404
        ? "NOT_FOUND"
        : status === 400
          ? "VALIDATION_ERROR"
          : "INTERNAL_ERROR";
    res.status(status).json({
      code,
      message:
        status === 404
          ? "Không tìm thấy endpoint"
          : status === 400
            ? "Yêu cầu không hợp lệ"
            : "Lỗi hệ thống",
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
