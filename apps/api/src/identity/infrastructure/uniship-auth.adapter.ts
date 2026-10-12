import { HttpException, HttpStatus, Injectable } from "@nestjs/common";
import { ProviderAuthenticationPort } from "../application/provider-auth.port";
import type { VerifiedProviderIdentity } from "../domain/identity.types";

export interface UnishipAuthAdapterOptions {
  apiUrl?: string;
  liveAuthorized?: boolean;
  isProduction?: boolean;
  timeoutMs?: number;
}

@Injectable()
export class UnishipAuthAdapter implements ProviderAuthenticationPort {
  private readonly apiUrl?: string;
  private readonly liveAuthorized: boolean;
  private readonly isProduction: boolean;
  private readonly timeoutMs: number;

  constructor(options: UnishipAuthAdapterOptions = {}) {
    this.apiUrl = options.apiUrl;
    this.liveAuthorized = options.liveAuthorized ?? false;
    this.isProduction = options.isProduction ?? false;
    this.timeoutMs = options.timeoutMs ?? 5000;
  }

  async authenticate(input: {
    username: string;
    password: string;
  }): Promise<VerifiedProviderIdentity> {
    if (!this.apiUrl) {
      throw new HttpException(
        {
          code: "SERVICE_UNAVAILABLE",
          message:
            "Dịch vụ xác thực nhà cung cấp chưa được cấu hình hoặc tạm thời không khả dụng.",
        },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    let targetUrl: URL;
    try {
      targetUrl = new URL("/client/api-token-auth/", this.apiUrl);
    } catch {
      throw new HttpException(
        {
          code: "SERVICE_UNAVAILABLE",
          message: "Cấu hình dịch vụ xác thực nhà cung cấp không hợp lệ.",
        },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    const isLoopback =
      targetUrl.hostname === "127.0.0.1" ||
      targetUrl.hostname === "localhost" ||
      targetUrl.hostname === "::1";

    if (this.isProduction && targetUrl.protocol !== "https:") {
      throw new HttpException(
        {
          code: "SERVICE_UNAVAILABLE",
          message:
            "Kết nối xác thực nhà cung cấp trong môi trường production bắt buộc phải sử dụng HTTPS.",
        },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    // Require explicit operational authorization before permitting external/live network requests
    if (!isLoopback && !this.liveAuthorized) {
      throw new HttpException(
        {
          code: "SERVICE_UNAVAILABLE",
          message: "Dịch vụ xác thực trực tiếp chưa được cấp phép vận hành.",
        },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    let response: Response;
    try {
      response = await fetch(targetUrl.toString(), {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json",
        },
        body: JSON.stringify({
          username: input.username,
          password: input.password,
          FirebaseToken: null,
        }),
        signal: AbortSignal.timeout(this.timeoutMs),
        redirect: "error",
      });
    } catch {
      throw new HttpException(
        {
          code: "SERVICE_UNAVAILABLE",
          message:
            "Dịch vụ xác thực tạm thời không khả dụng. Vui lòng thử lại sau.",
        },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    if (response.status === 400 || response.status === 401) {
      throw new HttpException(
        {
          code: "AUTHENTICATION_FAILED",
          message:
            "Thông tin đăng nhập không hợp lệ hoặc tài khoản chưa được cấp quyền truy cập.",
        },
        HttpStatus.UNAUTHORIZED,
      );
    }

    if (response.status !== 200) {
      throw new HttpException(
        {
          code: "SERVICE_UNAVAILABLE",
          message:
            "Dịch vụ xác thực tạm thời không khả dụng. Vui lòng thử lại sau.",
        },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new HttpException(
        {
          code: "SERVICE_UNAVAILABLE",
          message:
            "Dịch vụ xác thực tạm thời không khả dụng. Vui lòng thử lại sau.",
        },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    if (
      !payload ||
      typeof payload !== "object" ||
      !("userid" in payload) ||
      typeof (payload as { token?: unknown }).token !== "string"
    ) {
      throw new HttpException(
        {
          code: "SERVICE_UNAVAILABLE",
          message:
            "Dịch vụ xác thực tạm thời không khả dụng. Vui lòng thử lại sau.",
        },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    const rawUserId = (payload as { userid: unknown }).userid;
    if (rawUserId === null || rawUserId === undefined) {
      throw new HttpException(
        {
          code: "SERVICE_UNAVAILABLE",
          message:
            "Dịch vụ xác thực tạm thời không khả dụng. Vui lòng thử lại sau.",
        },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    const providerSubject = String(rawUserId).trim();
    if (providerSubject.length === 0 || providerSubject.length > 128) {
      throw new HttpException(
        {
          code: "SERVICE_UNAVAILABLE",
          message:
            "Dịch vụ xác thực tạm thời không khả dụng. Vui lòng thử lại sau.",
        },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    return {
      provider: "uniship",
      providerSubject,
    };
  }
}
