import {
  Body,
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Req,
  Res,
  UseGuards,
  HttpCode,
} from "@nestjs/common";
import { ApiResponse, ApiTags } from "@nestjs/swagger";
import type { Request, Response } from "express";
import { ApiErrorDto } from "../../http";
import { UserManagementService } from "../application/user-management.service";
import { AdminGuard } from "./admin.guard";
import { OriginGuard } from "./origin.guard";
import { Public } from "./public.decorator";
import {
  CreateOperatorDto,
  SetupPasswordDto,
  OperatorCreatedDto,
  SetupLinkDto,
  SetupSuccessDto,
  StatusRequestDto,
  ManagedUserResponseDto,
  UserListDto,
} from "./user-management.dto";
type AuthRequest = Request & { user: { id: string } };

@ApiTags("Administration")
@UseGuards(AdminGuard)
@ApiResponse({ status: 401, type: ApiErrorDto })
@ApiResponse({ status: 403, type: ApiErrorDto })
@Controller("admin")
export class UserManagementController {
  constructor(private readonly service: UserManagementService) {}
  @Post("operators")
  @UseGuards(OriginGuard)
  @ApiResponse({ status: 201, type: OperatorCreatedDto })
  @ApiResponse({ status: 400, type: ApiErrorDto })
  @ApiResponse({ status: 409, type: ApiErrorDto })
  create(
    @Req() req: AuthRequest,
    @Body() dto: CreateOperatorDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    res.setHeader("Cache-Control", "no-store");
    return this.service.createOperator(
      req.user.id,
      dto,
      req.headers.origin ?? "",
    );
  }
  @Post("operators/:id/setup-link")
  @UseGuards(OriginGuard)
  @HttpCode(200)
  @ApiResponse({ status: 200, type: SetupLinkDto })
  @ApiResponse({ status: 400, type: ApiErrorDto })
  @ApiResponse({ status: 404, type: ApiErrorDto })
  reissue(
    @Req() req: AuthRequest,
    @Param("id") id: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    res.setHeader("Cache-Control", "no-store");
    return this.service.reissue(req.user.id, id, req.headers.origin ?? "");
  }
  @Get("users")
  @ApiResponse({ status: 200, type: UserListDto })
  list(@Req() req: AuthRequest, @Res({ passthrough: true }) res: Response) {
    res.setHeader("Cache-Control", "no-store");
    return this.service.listUsers(req.user.id);
  }
  @Patch("users/:id/status")
  @UseGuards(OriginGuard)
  @ApiResponse({ status: 200, type: ManagedUserResponseDto })
  @ApiResponse({ status: 400, type: ApiErrorDto })
  @ApiResponse({ status: 404, type: ApiErrorDto })
  @ApiResponse({ status: 409, type: ApiErrorDto })
  status(
    @Req() req: AuthRequest,
    @Param("id") id: string,
    @Body() dto: StatusRequestDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    res.setHeader("Cache-Control", "no-store");
    return this.service.setStatus(req.user.id, id, dto);
  }
}
@ApiTags("Authentication")
@Controller("auth")
export class SetupPasswordController {
  constructor(private readonly service: UserManagementService) {}
  @Public()
  @Post("setup-password")
  @UseGuards(OriginGuard)
  @HttpCode(200)
  @ApiResponse({ status: 200, type: SetupSuccessDto })
  @ApiResponse({ status: 400, type: ApiErrorDto })
  @ApiResponse({ status: 403, type: ApiErrorDto })
  @ApiResponse({ status: 429, type: ApiErrorDto })
  setup(
    @Body() dto: SetupPasswordDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    res.setHeader("Cache-Control", "no-store");
    return this.service.setupPassword(dto);
  }
}
