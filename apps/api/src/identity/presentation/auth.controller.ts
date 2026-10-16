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
import {
  ApiExtraModels,
  getSchemaPath,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import type { Request, Response } from "express";
import { ApiErrorDto } from "../../http";
import { MfaService } from "../application/mfa.service";
import { AuthService } from "../application/auth.service";
import {
  MfaRequiredResponseDto,
  MfaVerifyRequestDto,
  MfaVerifyResponseDto,
  LoginRequestDto,
  LoginResponseDto,
  LogoutResponseDto,
  SessionResponseDto,
} from "./auth.dto";
import { extractSessionToken } from "./session.guard";
import { Public } from "./public.decorator";
import { OriginGuard } from "./origin.guard";
import type { UserSummary } from "../domain/identity.types";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

@ApiExtraModels(LoginResponseDto, MfaRequiredResponseDto)
@ApiTags("Authentication")
@Controller("auth")
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly mfa: MfaService,
  ) {}

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
    schema: {
      oneOf: [
        { $ref: getSchemaPath(LoginResponseDto) },
        { $ref: getSchemaPath(MfaRequiredResponseDto) },
      ],
    },
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
  ): Promise<LoginResponseDto | MfaRequiredResponseDto> {
    res.setHeader("Cache-Control", "no-store");
    const result = await this.authService.login(dto?.username, dto?.password);
    if ("mfaRequired" in result) {
      res.cookie("nexora_session", "", {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: false,
        maxAge: 0,
      });
      this.pendingCookie(res, result.challengeToken, 5 * 60 * 1000);
      return { mfaRequired: true };
    }

    this.setSessionCookie(res, result.token);

    return { user: result.user };
  }

  private pendingCookie(res: Response, token: string, maxAge: number) {
    res.cookie("nexora_mfa_token", token, {
      httpOnly: true,
      sameSite: "strict",
      path: "/api/auth/mfa",
      secure: false,
      maxAge,
    });
  }
  @Public()
  @UseGuards(OriginGuard)
  @Post("mfa/verify")
  @HttpCode(200)
  @ApiResponse({ status: 200, type: MfaVerifyResponseDto })
  @ApiResponse({ status: 400, type: ApiErrorDto })
  @ApiResponse({ status: 401, type: ApiErrorDto })
  @ApiResponse({ status: 403, type: ApiErrorDto })
  @ApiResponse({ status: 429, type: ApiErrorDto })
  async verifyMfa(
    @Req() req: Request,
    @Body() dto: MfaVerifyRequestDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<MfaVerifyResponseDto> {
    res.setHeader("Cache-Control", "no-store");
    const result = await this.mfa.verify(
      extractPendingToken(req.headers.cookie),
      dto,
    );
    this.setSessionCookie(res, result.token);
    this.pendingCookie(res, "", 0);
    return { user: result.user };
  }
  @Public()
  @UseGuards(OriginGuard)
  @Post("mfa/cancel")
  @HttpCode(200)
  @ApiResponse({ status: 200, type: LogoutResponseDto })
  @ApiResponse({ status: 403, type: ApiErrorDto })
  async cancelMfa(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<LogoutResponseDto> {
    res.setHeader("Cache-Control", "no-store");
    await this.mfa.cancel(extractPendingToken(req.headers.cookie));
    this.pendingCookie(res, "", 0);
    return { success: true };
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

export function extractPendingToken(cookie?: string): string | null {
  if (!cookie) return null;
  const matches = cookie
    .split(";")
    .map((p) => p.trim())
    .filter((p) => p.startsWith("nexora_mfa_token="));
  if (matches.length !== 1) return null;
  try {
    const value = decodeURIComponent(
      matches[0].slice("nexora_mfa_token=".length),
    );
    return /^[a-f0-9]{64}$/.test(value) ? value : null;
  } catch {
    return null;
  }
}
