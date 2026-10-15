import {
  Body,
  Controller,
  Delete,
  Get,
  Patch,
  Param,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import { ApiResponse, ApiTags } from "@nestjs/swagger";
import type { Request, Response } from "express";
import { ApiErrorDto } from "../../http";
import { CarrierService } from "../application/carrier.service";
import { OriginGuard } from "../../identity/presentation/origin.guard";
import {
  CarriersDto,
  ConnectionsDto,
  ConnectionDto,
  RenameConnectionDto,
  ConnectionDeletedDto,
} from "./carrier.dto";
type AuthRequest = Request & { user: { id: string } };
@ApiTags("Carrier")
@ApiResponse({ status: 401, type: ApiErrorDto })
@Controller()
export class CarrierController {
  constructor(private readonly service: CarrierService) {}
  @Get("carriers")
  @ApiResponse({ status: 200, type: CarriersDto })
  providers(@Res({ passthrough: true }) res: Response) {
    res.setHeader("Cache-Control", "no-store");
    return this.service.providers();
  }
  @Get("carrier-connections")
  @ApiResponse({ status: 200, type: ConnectionsDto })
  list(@Req() req: AuthRequest, @Res({ passthrough: true }) res: Response) {
    res.setHeader("Cache-Control", "no-store");
    return this.service.list(req.user.id);
  }
  @Patch("carrier-connections/:id")
  @UseGuards(OriginGuard)
  @ApiResponse({ status: 200, type: ConnectionDto })
  @ApiResponse({ status: 400, type: ApiErrorDto })
  @ApiResponse({ status: 403, type: ApiErrorDto })
  @ApiResponse({ status: 404, type: ApiErrorDto })
  rename(
    @Req() req: AuthRequest,
    @Param("id") id: string,
    @Body() body: RenameConnectionDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    res.setHeader("Cache-Control", "no-store");
    return this.service.rename(req.user.id, id, body);
  }
  @Delete("carrier-connections/:id")
  @UseGuards(OriginGuard)
  @ApiResponse({ status: 200, type: ConnectionDeletedDto })
  @ApiResponse({ status: 400, type: ApiErrorDto })
  @ApiResponse({ status: 403, type: ApiErrorDto })
  @ApiResponse({ status: 404, type: ApiErrorDto })
  remove(
    @Req() req: AuthRequest,
    @Param("id") id: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    res.setHeader("Cache-Control", "no-store");
    return this.service.remove(req.user.id, id);
  }
}
