import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import type { Request, Response } from "express";
import { ApiErrorDto } from "../../http";
import { AuthService } from "../application/auth.service";
import {
  LoginRequestDto,
  LoginResponseDto,
  LogoutResponseDto,
  ProviderLoginRequestDto,
  SessionResponseDto,
} from "./auth.dto";
import { extractSessionToken } from "./session.guard";
import { Public } from "./public.decorator";
import { OriginGuard } from "./origin.guard";
import type { UserSummary } from "../domain/identity.types";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

@ApiTags("Authentication")
@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  private setSessionCookie(res: Response, token: string): void {
    res.cookie("nexora_session", token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: false, // Canonical loopback HTTP deployment; forwarded headers are not a policy input.
      maxAge: SEVEN_DAYS_MS,
    });
  }

  @Public()
  @UseGuards(OriginGuard)
  @Post("login")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Xác thực danh tính và thiết lập phiên làm việc" })
  @ApiResponse({
    status: 200,
    description: "Đăng nhập thành công",
    type: LoginResponseDto,
  })
  @ApiResponse({
    status: 400,
    type: ApiErrorDto,
    description: "Yêu cầu không hợp lệ hoặc thiếu thông tin",
  })
  @ApiResponse({
    status: 401,
    type: ApiErrorDto,
    description: "Thông tin xác thực không chính xác",
  })
  @ApiResponse({
    status: 403,
    type: ApiErrorDto,
    description: "Origin không hợp lệ hoặc không được phép",
  })
  @ApiResponse({
    status: 429,
    type: ApiErrorDto,
    description: "Quá nhiều lần đăng nhập thất bại",
  })
  async login(
    @Body() dto: LoginRequestDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<LoginResponseDto> {
    const result = await this.authService.login(dto?.username, dto?.password);

    this.setSessionCookie(res, result.token);

    return { user: result.user };
  }

  @Public()
  @UseGuards(OriginGuard)
  @Post("provider/login")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Xác thực tài khoản nhà cung cấp và thiết lập phiên làm việc",
  })
  @ApiResponse({
    status: 200,
    description: "Đăng nhập thành công",
    type: LoginResponseDto,
  })
  @ApiResponse({
    status: 400,
    type: ApiErrorDto,
    description: "Yêu cầu không hợp lệ hoặc thiếu thông tin",
  })
  @ApiResponse({
    status: 401,
    type: ApiErrorDto,
    description:
      "Thông tin đăng nhập không hợp lệ hoặc tài khoản chưa được cấp quyền truy cập",
  })
  @ApiResponse({
    status: 403,
    type: ApiErrorDto,
    description: "Origin không hợp lệ hoặc không được phép",
  })
  @ApiResponse({
    status: 429,
    type: ApiErrorDto,
    description: "Quá nhiều lần đăng nhập thất bại",
  })
  @ApiResponse({
    status: 503,
    type: ApiErrorDto,
    description: "Dịch vụ xác thực nhà cung cấp tạm thời không khả dụng",
  })
  async loginProvider(
    @Body() dto: ProviderLoginRequestDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<LoginResponseDto> {
    const result = await this.authService.loginWithProvider(
      dto?.username,
      dto?.password,
    );

    this.setSessionCookie(res, result.token);

    return { user: result.user };
  }

  @Get("session")
  @ApiOperation({ summary: "Kiểm tra phiên làm việc hiện tại" })
  @ApiResponse({
    status: 200,
    description: "Phiên làm việc hợp lệ",
    type: SessionResponseDto,
  })
  @ApiResponse({
    status: 401,
    type: ApiErrorDto,
    description: "Chưa đăng nhập hoặc phiên đã hết hạn",
  })
  async getSession(@Req() req: Request): Promise<SessionResponseDto> {
    const user = (req as Request & { user: UserSummary }).user;
    return {
      authenticated: true,
      user,
    };
  }

  @Public()
  @UseGuards(OriginGuard)
  @Post("logout")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Hủy bỏ phiên làm việc và xóa cookie" })
  @ApiResponse({
    status: 200,
    description: "Đăng xuất thành công",
    type: LogoutResponseDto,
  })
  @ApiResponse({
    status: 403,
    type: ApiErrorDto,
    description: "Origin không hợp lệ hoặc không được phép",
  })
  @ApiResponse({
    status: 500,
    description: "Không thể thu hồi phiên do lỗi hệ thống",
    type: ApiErrorDto,
  })
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<LogoutResponseDto> {
    const token = extractSessionToken(req.headers.cookie);
    if (token) {
      await this.authService.logout(token);
    }

    res.cookie("nexora_session", "", {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: false, // Canonical loopback HTTP deployment; forwarded headers are not a policy input.
      maxAge: 0,
    });

    return { success: true };
  }
}
