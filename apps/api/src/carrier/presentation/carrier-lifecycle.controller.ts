import { GENERIC_ERROR_MESSAGE } from "../../common/http/error-messages";
import {
  Body,
  Controller,
  Post,
  Param,
  Req,
  Res,
  UseGuards,
  HttpCode,
  HttpException,
} from "@nestjs/common";
import { ApiResponse, ApiTags } from "@nestjs/swagger";
import type { Request, Response } from "express";
import { ApiErrorDto } from "../../http";
import { OriginGuard } from "../../identity/presentation/origin.guard";
import { CarrierProvider } from "../domain/carrier";
import { LifecycleCode, LifecycleFailure } from "../domain/lifecycle";
import { CarrierConnectionLifecycleService } from "../application/carrier-connection-lifecycle.service";
import {
  ConnectCarrierDto,
  ReconnectCarrierDto,
  ConnectionDto,
} from "./carrier.dto";
type AuthRequest = Request & { user: { id: string } };
function invalid(): never {
  throw new HttpException(
    { code: "VALIDATION_ERROR", message: "Yêu cầu không hợp lệ" },
    400,
  );
}
function payload(input: unknown, keys: string[]): Record<string, unknown> {
  if (
    !input ||
    typeof input !== "object" ||
    Array.isArray(input) ||
    Object.keys(input).length !== keys.length ||
    keys.some((key) => !Object.hasOwn(input, key))
  )
    invalid();
  return input as Record<string, unknown>;
}
function text(value: unknown, max: number, trim: boolean): string {
  if (
    typeof value !== "string" ||
    value.length < 1 ||
    value.length > max ||
    (trim && !value.trim())
  )
    invalid();
  return trim ? value.trim() : value;
}
@ApiTags("Carrier")
@ApiResponse({ status: 400, type: ApiErrorDto })
@ApiResponse({ status: 401, type: ApiErrorDto })
@ApiResponse({ status: 403, type: ApiErrorDto })
@ApiResponse({ status: 429, type: ApiErrorDto })
@ApiResponse({ status: 503, type: ApiErrorDto })
@Controller("carrier-connections")
@UseGuards(OriginGuard)
export class CarrierLifecycleController {
  constructor(private readonly service: CarrierConnectionLifecycleService) {}
  private async mapped<T>(
    operation: () => Promise<T>,
    connect: boolean,
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (!(error instanceof LifecycleFailure)) {
        throw new HttpException(
          {
            code: "SERVICE_UNAVAILABLE",
            message: GENERIC_ERROR_MESSAGE,
          },
          503,
        );
      }
      const auth = [
        LifecycleCode.PROVIDER_AUTH_FAILED,
        LifecycleCode.TOKEN_REJECTED,
        LifecycleCode.IDENTITY_MISMATCH,
        LifecycleCode.CANDIDATE_IDENTITY_MISMATCH,
        LifecycleCode.REAUTH_REQUIRED,
      ].some((code) => code === error.code);
      if (connect && (auth || error.code === LifecycleCode.DUPLICATE))
        throw new HttpException(
          {
            code: "CANNOT_CONNECT_CARRIER_ACCOUNT",
            message: "Không thể kết nối tài khoản này",
          },
          400,
        );
      let status = 503,
        code: string = "SERVICE_UNAVAILABLE";
      if (auth) {
        status = 401;
        code = "PROVIDER_AUTH_FAILED";
      }
      if (error.code === LifecycleCode.UNAUTHORIZED) {
        status = 401;
        code = "UNAUTHORIZED";
      }
      if (error.code === LifecycleCode.NOT_FOUND) {
        status = 404;
        code = "NOT_FOUND";
      }
      if (error.code === LifecycleCode.RATE_LIMITED) {
        status = 429;
        code = "RATE_LIMITED";
      }
      throw new HttpException({ code, message: GENERIC_ERROR_MESSAGE }, status);
    }
  }
  @Post()
  @ApiResponse({ status: 201, type: ConnectionDto })
  async connect(
    @Req() req: AuthRequest,
    @Body() body: ConnectCarrierDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    res.setHeader("Cache-Control", "no-store");
    const data = payload(body, [
      "provider",
      "loginIdentifier",
      "password",
      "displayName",
    ]);
    if (data.provider !== CarrierProvider.UNISHIP) invalid();
    const input = {
      loginIdentifier: text(data.loginIdentifier, 128, true),
      password: text(data.password, 1024, false),
      displayName: text(data.displayName, 100, true),
    };
    return {
      connection: await this.mapped(
        () => this.service.connect(req.user.id, input, res.locals.requestId),
        true,
      ),
    };
  }
  @Post(":id/reconnect")
  @HttpCode(200)
  @ApiResponse({ status: 200, type: ConnectionDto })
  @ApiResponse({ status: 404, type: ApiErrorDto })
  async reconnect(
    @Req() req: AuthRequest,
    @Param("id") id: string,
    @Body() body: ReconnectCarrierDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    res.setHeader("Cache-Control", "no-store");
    if (
      !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(
        id,
      )
    )
      invalid();
    const data = payload(body, ["password"]),
      password = text(data.password, 1024, false);
    return {
      connection: await this.mapped(
        () =>
          this.service.reconnect(
            req.user.id,
            id.toLowerCase(),
            password,
            res.locals.requestId,
          ),
        false,
      ),
    };
  }
}
