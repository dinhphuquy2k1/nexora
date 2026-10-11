import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  Post,
  Req,
  Res,
} from "@nestjs/common";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import type { Request, Response } from "express";
import { AuthService } from "../application/auth.service";
import {
  LoginRequestDto,
  LoginResponseDto,
  LogoutResponseDto,
  SessionResponseDto,
} from "./auth.dto";
import { extractSessionToken } from "./session.guard";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

@ApiTags("Authentication")
@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

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
    description: "Yêu cầu không hợp lệ hoặc thiếu thông tin",
  })
  @ApiResponse({
    status: 401,
    description: "Thông tin xác thực không chính xác",
  })
  @ApiResponse({
    status: 429,
    description: "Quá nhiều lần đăng nhập thất bại",
  })
  async login(
    @Body() dto: LoginRequestDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<LoginResponseDto> {
    const clientIp = req.ip || req.socket.remoteAddress || "127.0.0.1";
    const result = await this.authService.login(
      dto.username,
      dto.password,
      clientIp,
    );

    const isSecure = req.secure || req.headers["x-forwarded-proto"] === "https";

    res.cookie("nexora_session", result.token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: isSecure,
      maxAge: SEVEN_DAYS_MS,
    });

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
    description: "Chưa đăng nhập hoặc phiên đã hết hạn",
  })
  async getSession(@Req() req: Request): Promise<SessionResponseDto> {
    const token = extractSessionToken(req.headers.cookie);
    if (!token) {
      throw new HttpException(
        {
          code: "UNAUTHORIZED",
          message: "Chưa đăng nhập hoặc phiên làm việc đã hết hạn",
        },
        HttpStatus.UNAUTHORIZED,
      );
    }

    const user = await this.authService.validateSession(token);
    if (!user) {
      throw new HttpException(
        {
          code: "UNAUTHORIZED",
          message: "Phiên làm việc không hợp lệ hoặc đã hết hạn",
        },
        HttpStatus.UNAUTHORIZED,
      );
    }

    return {
      authenticated: true,
      user,
    };
  }

  @Post("logout")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Hủy bỏ phiên làm việc và xóa cookie" })
  @ApiResponse({
    status: 200,
    description: "Đăng xuất thành công",
    type: LogoutResponseDto,
  })
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<LogoutResponseDto> {
    const token = extractSessionToken(req.headers.cookie);
    if (token) {
      await this.authService.logout(token);
    }

    const isSecure = req.secure || req.headers["x-forwarded-proto"] === "https";

    res.cookie("nexora_session", "", {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: isSecure,
      maxAge: 0,
    });

    return { success: true };
  }
}
