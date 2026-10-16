import { HttpException } from "@nestjs/common";
import { createHash, randomBytes } from "node:crypto";
import { AuthService } from "./auth.service";
import { MfaPort, type MfaInput } from "./mfa.port";

export const mfaHash = (token: string) =>
  createHash("sha256").update(token).digest("hex");
export class MfaService {
  constructor(
    private readonly port: MfaPort,
    private readonly auth: AuthService,
    private readonly now: () => number = Date.now,
  ) {}
  private denied(): never {
    throw new HttpException(
      {
        code: "MFA_VERIFICATION_FAILED",
        message:
          "Mã xác thực hoặc phiên chờ không hợp lệ. Thử lại hoặc đăng nhập lại.",
      },
      401,
    );
  }
  async verify(token: string | null, body: unknown) {
    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body) ||
      Object.keys(body).sort().join(",") !== "code,type"
    )
      throw new HttpException(
        { code: "VALIDATION_ERROR", message: "Yêu cầu xác thực không hợp lệ" },
        400,
      );
    const input = body as MfaInput;
    if (
      !(input.type === "totp" || input.type === "recovery") ||
      typeof input.code !== "string" ||
      !(
        input.type === "totp"
          ? /^[0-9]{6}$/
          : /^[0-9A-Fa-f]{8}(?:-[0-9A-Fa-f]{8}){3}$/
      ).test(input.code)
    )
      throw new HttpException(
        { code: "VALIDATION_ERROR", message: "Mã xác thực không hợp lệ" },
        400,
      );
    if (!token || !/^[a-f0-9]{64}$/.test(token)) this.denied();
    const hash = mfaHash(token);
    const owner = await this.port.challengeOwner(hash);
    if (!owner) this.denied();
    return this.auth.withAdmission(`mfa:${owner}`, async () => {
      const sessionToken = randomBytes(32).toString("hex");
      const user = await this.port.verify(
        owner,
        hash,
        input,
        mfaHash(sessionToken),
        new Date(this.now() + 7 * 24 * 60 * 60 * 1000),
      );
      if (!user) this.denied();
      return { user, token: sessionToken };
    });
  }
  async cancel(token: string | null) {
    if (token && /^[a-f0-9]{64}$/.test(token))
      await this.port.cancel(mfaHash(token));
  }
}
