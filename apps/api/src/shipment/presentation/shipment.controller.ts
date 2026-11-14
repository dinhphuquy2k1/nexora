import { Controller, Get, Param, Query, Req } from "@nestjs/common";
import { ApiResponse, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import { ApiErrorDto } from "../../http";
import { ShipmentService } from "../application/shipment.service";
import {
  ShipmentQueryDto,
  ShipmentHistoryQueryDto,
  ShipmentPageDto,
  ShipmentResponseDto,
  ShipmentHistoryPageDto,
} from "./shipment.dto";
type ActorRequest = Request & { user: { id: string } };
@ApiTags("Shipments")
@ApiResponse({ status: 400, type: ApiErrorDto })
@ApiResponse({ status: 401, type: ApiErrorDto })
@ApiResponse({ status: 500, type: ApiErrorDto })
@Controller("shipments")
export class ShipmentController {
  constructor(private readonly service: ShipmentService) {}
  @Get()
  @ApiResponse({ status: 200, type: ShipmentPageDto })
  @ApiResponse({
    status: 422,
    type: ApiErrorDto,
    description:
      "CLAIM_FILTER_UNAVAILABLE: provider claim semantics are not verified",
  })
  list(@Req() req: ActorRequest, @Query() query: ShipmentQueryDto) {
    return this.service.list(req.user, query);
  }
  @Get(":id/history")
  @ApiResponse({ status: 200, type: ShipmentHistoryPageDto })
  @ApiResponse({ status: 404, type: ApiErrorDto })
  history(
    @Req() req: ActorRequest,
    @Param("id") id: string,
    @Query() query: ShipmentHistoryQueryDto,
  ) {
    return this.service.history(req.user, id, query);
  }
  @Get(":id")
  @ApiResponse({ status: 200, type: ShipmentResponseDto })
  @ApiResponse({ status: 404, type: ApiErrorDto })
  get(@Req() req: ActorRequest, @Param("id") id: string) {
    return this.service.get(req.user, id);
  }
}
