import { Controller, Get, Inject, Res } from "@nestjs/common";
import {
  ApiOkResponse,
  ApiProperty,
  ApiServiceUnavailableResponse,
} from "@nestjs/swagger";
import type { Response } from "express";
import { HealthService } from "../application/health.service";
import { Public } from "../../identity/presentation/public.decorator";
class LiveDto {
  @ApiProperty({ enum: ["ok"] }) status!: string;
}
class ChecksDto {
  @ApiProperty() database!: boolean;
  @ApiProperty() storage!: boolean;
}
class ReadyDto {
  @ApiProperty({ enum: ["ok", "unavailable"] }) status!: string;
  @ApiProperty({ type: ChecksDto }) checks!: ChecksDto;
}
class ReadyErrorDto extends ReadyDto {
  @ApiProperty() code!: string;
  @ApiProperty() message!: string;
  @ApiProperty() requestId!: string;
}
@Controller("health")
export class HealthController {
  constructor(@Inject(HealthService) private readonly health: HealthService) {}
  @Public()
  @Get("live")
  @ApiOkResponse({ type: LiveDto })
  live() {
    return this.health.live();
  }
  @Public()
  @Get("ready")
  @ApiOkResponse({ type: ReadyDto })
  @ApiServiceUnavailableResponse({ type: ReadyErrorDto })
  async ready(@Res({ passthrough: true }) response: Response) {
    const result = await this.health.ready();
    response.status(result.status === "ok" ? 200 : 503);
    return result.status === "ok"
      ? result
      : {
          ...result,
          code: "NOT_READY",
          message: "Dịch vụ chưa sẵn sàng",
          requestId: response.locals.requestId,
        };
  }
}
