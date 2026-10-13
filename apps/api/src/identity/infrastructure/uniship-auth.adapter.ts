import { HttpException, HttpStatus, Injectable } from "@nestjs/common";
import { ProviderAuthenticationPort } from "../application/provider-auth.port";
import type { VerifiedProviderIdentity } from "../domain/identity.types";
import { IdentityProvider } from "../domain/provider-policy";

export interface UnishipAuthAdapterOptions {
  apiUrl?: string;
  liveAuthorized?: boolean;
  isProduction?: boolean;
  timeoutMs?: number;
}

function parseProviderIdentity(payload: unknown): VerifiedProviderIdentity {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new HttpException(
      {
        code: "SERVICE_UNAVAILABLE",
        message: "Phản hồi xác thực không hợp lệ.",
      },
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }

  const record = payload as Record<string, unknown>;

  // Token must be a non-empty string
  if (typeof record.token !== "string" || record.token.trim().length === 0) {
    throw new HttpException(
      {
        code: "SERVICE_UNAVAILABLE",
        message: "Phản hồi xác thực không hợp lệ.",
      },
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }

  // Nested user must be a non-null, non-array object
  const user = record.user;
  if (!user || typeof user !== "object" || Array.isArray(user)) {
    throw new HttpException(
      {
        code: "SERVICE_UNAVAILABLE",
        message: "Phản hồi xác thực không hợp lệ.",
      },
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }

  const userRecord = user as Record<string, unknown>;

  // Username must be a non-empty string
  if (
    typeof userRecord.username !== "string" ||
    userRecord.username.trim().length === 0
  ) {
    throw new HttpException(
      {
        code: "SERVICE_UNAVAILABLE",
        message: "Phản hồi xác thực không hợp lệ.",
      },
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }

  // If is_verified is explicitly false, reject with 401 AUTHENTICATION_FAILED
  if (userRecord.is_verified === false) {
    throw new HttpException(
      {
        code: "AUTHENTICATION_FAILED",
        message:
          "Thông tin đăng nhập không hợp lệ hoặc tài khoản chưa được cấp quyền truy cập.",
      },
      HttpStatus.UNAUTHORIZED,
    );
  }

  // If is_verified is provided, it must be a boolean
  if (
    userRecord.is_verified !== undefined &&
    typeof userRecord.is_verified !== "boolean"
  ) {
    throw new HttpException(
      {
        code: "SERVICE_UNAVAILABLE",
        message: "Phản hồi xác thực không hợp lệ.",
      },
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }

  // Validate userid: accept positive safe integer or valid decimal string
  const rawUserId = userRecord.userid;
  let normalizedSubject: string;

  if (typeof rawUserId === "number") {
    if (!Number.isSafeInteger(rawUserId) || rawUserId <= 0) {
      throw new HttpException(
        {
          code: "SERVICE_UNAVAILABLE",
          message: "Phản hồi xác thực không hợp lệ.",
        },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    normalizedSubject = String(rawUserId);
  } else if (typeof rawUserId === "string") {
    const trimmed = rawUserId.trim();
    if (trimmed.length === 0 || !/^[1-9]\d*$/.test(trimmed)) {
      throw new HttpException(
        {
          code: "SERVICE_UNAVAILABLE",
          message: "Phản hồi xác thực không hợp lệ.",
        },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    normalizedSubject = trimmed;
  } else {
    throw new HttpException(
      {
        code: "SERVICE_UNAVAILABLE",
        message: "Phản hồi xác thực không hợp lệ.",
      },
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }

  if (normalizedSubject.length > 128) {
    throw new HttpException(
      {
        code: "SERVICE_UNAVAILABLE",
        message: "Phản hồi xác thực không hợp lệ.",
      },
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }

  return {
    provider: IdentityProvider.UNISHIP,
    providerSubject: normalizedSubject,
  };
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
          message: "Phản hồi xác thực không hợp lệ.",
        },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    return parseProviderIdentity(payload);
  }
}
