import { createHash, timingSafeEqual } from "node:crypto";
import { HttpException, HttpStatus, Injectable } from "@nestjs/common";

export interface UnishipLoginResult {
  externalAccountId: string;
  candidateToken: string;
}

export interface UnishipHttpClientOptions {
  apiUrl?: string;
  liveAuthorized?: boolean;
  isProduction?: boolean;
  timeoutMs?: number;
}

function unsafeToken(value: string): boolean {
  return (
    value.length === 0 ||
    value.length > 16384 ||
    Array.from(value).some(
      (character) =>
        character.charCodeAt(0) <= 32 || character.charCodeAt(0) === 127,
    )
  );
}

export function parseProviderIdentity(payload: unknown): UnishipLoginResult {
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
  if (typeof record.token !== "string" || unsafeToken(record.token)) {
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

  // Owner amendment: username/email/is_verified are not identity or authorization evidence.

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
    externalAccountId: normalizedSubject,
    candidateToken: record.token,
  };
}

// Official permission, credential retention and automated re-login terms remain UNVERIFIED.
// Runtime opt-in alone cannot open live traffic in this mock-only implementation.
const UNISHIP_LIVE_CONTRACT_VERIFIED: boolean = false;

@Injectable()
export class UnishipHttpClient {
  private readonly apiUrl?: string;
  private readonly liveAuthorized: boolean;
  private readonly isProduction: boolean;
  private readonly timeoutMs: number;

  constructor(options: UnishipHttpClientOptions = {}) {
    this.apiUrl = options.apiUrl;
    this.liveAuthorized = options.liveAuthorized ?? false;
    this.isProduction = options.isProduction ?? false;
    this.timeoutMs = options.timeoutMs ?? 5000;
  }

  async authenticate(input: {
    username: string;
    password: string;
  }): Promise<UnishipLoginResult> {
    return this.post("/client/api-token-auth/", {
      username: input.username,
      password: input.password,
      FirebaseToken: null,
    });
  }

  async verify(candidateToken: string): Promise<UnishipLoginResult> {
    if (unsafeToken(candidateToken)) {
      throw this.unavailable();
    }
    const result = await this.post(
      "/client/api-token-verify/",
      { token: candidateToken, FirebaseToken: null },
      candidateToken,
    );
    // Hashes have fixed length, so comparison does not expose token prefixes/lengths.
    const digest = (value: string) =>
      createHash("sha256").update(value).digest();
    if (
      !timingSafeEqual(digest(candidateToken), digest(result.candidateToken))
    ) {
      throw new HttpException(
        {
          code: "TOKEN_REJECTED",
          message: "Không thể xác minh token nhà cung cấp.",
        },
        HttpStatus.UNAUTHORIZED,
      );
    }
    return result;
  }

  private unavailable(): HttpException {
    return new HttpException(
      {
        code: "SERVICE_UNAVAILABLE",
        message: "Dịch vụ xác thực tạm thời không khả dụng.",
      },
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }

  private async post(
    path: string,
    body: Record<string, unknown>,
    token?: string,
  ): Promise<UnishipLoginResult> {
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
      const configured = new URL(this.apiUrl);
      if (
        configured.username ||
        configured.password ||
        configured.search ||
        configured.hash ||
        !["http:", "https:"].includes(configured.protocol)
      ) {
        throw this.unavailable();
      }
      targetUrl = new URL(path, configured);
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
      targetUrl.hostname === "[::1]";

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

    if (!isLoopback && targetUrl.protocol !== "https:")
      throw this.unavailable();

    // Require explicit operational authorization before permitting external/live network requests
    if (
      !isLoopback &&
      (!this.liveAuthorized || !UNISHIP_LIVE_CONTRACT_VERIFIED)
    ) {
      throw new HttpException(
        {
          code: "SERVICE_UNAVAILABLE",
          message: "Dịch vụ xác thực trực tiếp chưa được cấp phép vận hành.",
        },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    let response: Response;
    const signal = AbortSignal.timeout(this.timeoutMs);
    try {
      response = await fetch(targetUrl.toString(), {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json",
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
        signal,
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

    if (response.status === 429) {
      const raw = response.headers.get("retry-after");
      const seconds =
        raw && /^\d+$/.test(raw)
          ? Number(raw) * 1000
          : Date.parse(raw ?? "") - Date.now();
      await response.body?.cancel();
      throw new HttpException(
        {
          code: "RATE_LIMITED",
          message: "Vui lòng thử lại sau.",
          retryAfterMs:
            Number.isFinite(seconds) && seconds > 0
              ? Math.min(seconds, 300000)
              : 1000,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    if (response.status === 400 || response.status === 401) {
      await response.body?.cancel();
      throw new HttpException(
        {
          code: token ? "TOKEN_REJECTED" : "AUTHENTICATION_FAILED",
          message:
            "Thông tin đăng nhập không hợp lệ hoặc tài khoản chưa được cấp quyền truy cập.",
        },
        HttpStatus.UNAUTHORIZED,
      );
    }

    if (response.status !== 200) {
      await response.body?.cancel();
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
      const reader = response.body?.getReader();
      if (!reader) throw this.unavailable();
      const chunks: Uint8Array[] = [];
      let size = 0;
      try {
        while (true) {
          signal.throwIfAborted();
          const chunk = await reader.read();
          if (chunk.done) break;
          size += chunk.value.length;
          if (size > 65536) throw this.unavailable();
          chunks.push(chunk.value);
        }
        payload = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      } finally {
        await reader.cancel().catch(() => undefined);
        reader.releaseLock();
      }
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
