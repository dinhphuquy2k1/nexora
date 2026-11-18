import { createHash, timingSafeEqual } from "node:crypto";
import { HttpException, HttpStatus, Injectable } from "@nestjs/common";
import { LifecycleCode, LifecycleFailure } from "../../domain/lifecycle";
import {
  UNISHIP_ROUTES,
  isUnishipReadRoute,
  type UnishipAuthRoute,
  type UnishipReadRoute,
} from "./uniship-routes";

export class UnishipResponseError extends Error {
  constructor() {
    super("UNISHIP_ENVELOPE_INVALID");
    this.name = "UnishipResponseError";
  }
}

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

  async authenticate(
    input: {
      username: string;
      password: string;
    },
    signal?: AbortSignal,
  ): Promise<UnishipLoginResult> {
    return this.post(
      UNISHIP_ROUTES.AUTH,
      {
        username: input.username,
        password: input.password,
        FirebaseToken: null,
      },
      undefined,
      signal,
    );
  }

  async verify(
    candidateToken: string,
    signal?: AbortSignal,
  ): Promise<UnishipLoginResult> {
    if (unsafeToken(candidateToken)) {
      throw this.unavailable();
    }
    const result = await this.post(
      UNISHIP_ROUTES.VERIFY,
      { token: candidateToken, FirebaseToken: null },
      candidateToken,
      signal,
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

  private retryAfter(response: Response): number {
    const raw = response.headers.get("retry-after");
    const seconds =
      raw && /^\d+$/.test(raw)
        ? Number(raw) * 1000
        : Date.parse(raw ?? "") - Date.now();
    return Number.isFinite(seconds) && seconds > 0
      ? Math.min(seconds, 300000)
      : 1000;
  }

  private async readText(
    response: Response,
    signal: AbortSignal,
    maxBytes: number,
  ): Promise<string> {
    const reader = response.body?.getReader();
    if (!reader) throw new UnishipResponseError();
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      while (true) {
        signal.throwIfAborted();
        const chunk = await reader.read();
        if (chunk.done) break;
        size += chunk.value.length;
        if (size > maxBytes) throw new UnishipResponseError();
        chunks.push(chunk.value);
      }
      return Buffer.concat(chunks).toString("utf8");
    } finally {
      await reader.cancel().catch(() => undefined);
      reader.releaseLock();
    }
  }

  /** Narrow data read; the same hard-close and token lifecycle still own access. */
  async getShipment(
    path: UnishipReadRoute,
    token: string,
    cancellation: AbortSignal,
    query = new URLSearchParams(),
  ): Promise<string> {
    if (!isUnishipReadRoute(path) || unsafeToken(token))
      throw new LifecycleFailure(LifecycleCode.SERVICE_UNAVAILABLE);
    let target: URL;
    try {
      target = this.target(path);
    } catch (error) {
      if (error instanceof HttpException)
        throw new LifecycleFailure(LifecycleCode.SERVICE_UNAVAILABLE);
      throw error;
    }
    target.search = query.toString();
    const signal = AbortSignal.any([
      cancellation,
      AbortSignal.timeout(this.timeoutMs),
    ]);
    let response: Response;
    try {
      response = await fetch(target, {
        method: "GET",
        headers: {
          accept: "application/json",
          authorization: `Bearer ${token}`,
        },
        signal,
        redirect: "error",
      });
    } catch {
      throw new LifecycleFailure(LifecycleCode.SERVICE_UNAVAILABLE);
    }
    if (response.status !== 200) {
      await response.body?.cancel();
      if (response.status === 401 || response.status === 403)
        throw new LifecycleFailure(LifecycleCode.TOKEN_REJECTED);
      if (response.status === 429)
        throw new LifecycleFailure(
          LifecycleCode.RATE_LIMITED,
          this.retryAfter(response),
        );
      if (response.status >= 500)
        throw new LifecycleFailure(LifecycleCode.SERVICE_UNAVAILABLE);
      throw new UnishipResponseError();
    }
    try {
      return await this.readText(response, signal, 8 * 1024 * 1024);
    } catch (error) {
      if (error instanceof UnishipResponseError) throw error;
      if (signal.aborted || error instanceof TypeError)
        throw new LifecycleFailure(LifecycleCode.SERVICE_UNAVAILABLE);
      throw error;
    }
  }

  private target(path: string): URL {
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

    return targetUrl;
  }

  private async post(
    path: UnishipAuthRoute,
    body: Record<string, unknown>,
    token?: string,
    cancellation?: AbortSignal,
  ): Promise<UnishipLoginResult> {
    const targetUrl = this.target(path);

    let response: Response;
    const timeout = AbortSignal.timeout(this.timeoutMs);
    const signal = cancellation
      ? AbortSignal.any([timeout, cancellation])
      : timeout;
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
      await response.body?.cancel();
      throw new HttpException(
        {
          code: "RATE_LIMITED",
          message: "Vui lòng thử lại sau.",
          retryAfterMs: this.retryAfter(response),
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
      payload = JSON.parse(await this.readText(response, signal, 65536));
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
