import {
  createDatabase,
  type PrismaClient,
  verifyPassword,
} from "@nexora/database";
import {
  SecretCipher,
  type EncryptedSecret,
} from "../../common/crypto/secret-cipher";
import { MfaPort, type MfaInput } from "../application/mfa.port";
import { AuthLevel } from "../domain/session-assurance";
import { UserRole, UserStatus } from "../domain/user-policy";
import { matchTotpStep, hashRecoveryCode } from "./totp";

type LockedUser = {
  id: string;
  username: string;
  role: string;
  status: string;
};
const aad = (userId: string) => `v1:${userId}:IDENTITY_TOTP`;
export class IdentityMfaAdapter implements MfaPort {
  private instance?: PrismaClient;
  constructor(
    private readonly url: string,
    private readonly cipher: SecretCipher,
    private readonly now: () => number = Date.now,
  ) {}
  get client(): PrismaClient {
    return (this.instance ??= createDatabase(this.url));
  }
  async issueChallenge(
    userId: string,
    verifiedHash: string,
    tokenHash: string,
    expiresAt: Date,
  ) {
    return this.client.$transaction(async (tx) => {
      const [user] = await tx.$queryRaw<
        LockedUser[]
      >`SELECT id,username,role,status FROM users WHERE id=${userId}::uuid FOR UPDATE`;
      const credential = await tx.userCredential.findUnique({
        where: { userId },
      });
      if (
        !user ||
        user.role !== UserRole.ADMIN ||
        user.status !== UserStatus.ACTIVE ||
        credential?.passwordHash !== verifiedHash
      )
        return null;
      if (!(await tx.userMfa.findUnique({ where: { userId } })))
        return "NOT_ENROLLED" as const;
      // Fixed expiry cannot become a fresh five minutes after arbitrary lock wait.
      if (expiresAt.getTime() <= this.now()) return null;
      await tx.mfaChallenge.deleteMany({
        where: {
          userId,
          OR: [
            { consumedAt: { not: null } },
            { expiresAt: { lte: new Date() } },
          ],
        },
      });
      const pending = await tx.mfaChallenge.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        select: { id: true },
      });
      if (pending.length >= 5)
        await tx.mfaChallenge.deleteMany({
          where: { id: { in: pending.slice(4).map((p) => p.id) } },
        });
      await tx.mfaChallenge.create({ data: { userId, tokenHash, expiresAt } });
      return { id: user.id, username: user.username };
    });
  }
  async challengeOwner(tokenHash: string) {
    const challenge = await this.client.mfaChallenge.findUnique({
      where: { tokenHash },
    });
    return challenge &&
      !challenge.consumedAt &&
      challenge.expiresAt.getTime() > this.now()
      ? challenge.userId
      : null;
  }
  async verify(
    userId: string,
    challengeHash: string,
    input: MfaInput,
    sessionHash: string,
    expiresAt: Date,
  ) {
    // Decrypt and HMAC outside locks; compare exact enrollment evidence again under user lock.
    const enrollment = await this.client.userMfa.findUnique({
      where: { userId },
    });
    if (!enrollment) return null;
    let step: number | null = null;
    const recoveryHash =
      input.type === "recovery" ? hashRecoveryCode(input.code) : null;
    if (input.type === "totp") {
      const plaintext = this.cipher.decrypt(
        "IDENTITY_TOTP",
        aad(userId),
        enrollment,
      );
      const secret = Buffer.from(plaintext, "base64");
      try {
        if (secret.length !== 20 || secret.toString("base64") !== plaintext)
          return null;
        step = matchTotpStep(secret, input.code, this.now());
      } finally {
        secret.fill(0);
      }
      if (step === null) return null;
    } else if (!recoveryHash) return null;
    return this.client
      .$transaction(async (tx) => {
        const [user] = await tx.$queryRaw<
          LockedUser[]
        >`SELECT id,username,role,status FROM users WHERE id=${userId}::uuid FOR UPDATE`;
        if (
          !user ||
          user.role !== UserRole.ADMIN ||
          user.status !== UserStatus.ACTIVE
        )
          return null;
        const current = await tx.userMfa.findUnique({ where: { userId } });
        if (
          !current ||
          ["ciphertext", "nonce", "authTag", "keyVersion"].some(
            (k) =>
              current[k as keyof typeof current] !==
              enrollment[k as keyof typeof enrollment],
          )
        )
          return null;
        const clock = await tx.$queryRaw<
          Array<{ now: Date }>
        >`SELECT clock_timestamp() AS now`;
        const now = clock[0].now.getTime();
        if (
          expiresAt.getTime() <= now ||
          (step !== null && Math.abs(step - Math.floor(now / 30000)) > 1)
        )
          return null;
        const consumed = await tx.$queryRaw<
          Array<{ id: string }>
        >`UPDATE mfa_challenges SET consumed_at=clock_timestamp() WHERE token_hash=${challengeHash} AND user_id=${userId}::uuid AND consumed_at IS NULL AND expires_at>clock_timestamp() RETURNING id`;
        if (consumed.length !== 1) return null;
        if (step !== null) {
          const advanced = await tx.userMfa.updateMany({
            where: { userId, lastUsedStep: { lt: BigInt(step) } },
            data: { lastUsedStep: BigInt(step) },
          });
          if (advanced.count !== 1) throw new ReplayFailure();
        } else {
          const used = await tx.mfaRecoveryCode.updateMany({
            where: { userId, codeHash: recoveryHash!, usedAt: null },
            data: { usedAt: new Date(now) },
          });
          if (used.count !== 1) throw new ReplayFailure();
        }
        await tx.session.create({
          data: {
            userId,
            tokenHash: sessionHash,
            expiresAt,
            authLevel: AuthLevel.MFA,
          },
        });
        return { id: user.id, username: user.username };
      })
      .catch((error) => {
        if (error instanceof ReplayFailure) return null;
        throw error;
      });
  }
  async cancel(tokenHash: string) {
    const challenge = await this.client.mfaChallenge.findUnique({
      where: { tokenHash },
      select: { userId: true },
    });
    if (!challenge) return;
    await this.client.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM users WHERE id=${challenge.userId}::uuid FOR UPDATE`;
      await tx.mfaChallenge.deleteMany({
        where: { tokenHash, userId: challenge.userId },
      });
    });
  }
  async enrollmentIdentity(username: string, password: string) {
    const user = await this.client.user.findUnique({
      where: { username },
      include: { credential: true, mfa: { select: { userId: true } } },
    });
    if (
      !user ||
      user.role !== UserRole.ADMIN ||
      user.status !== UserStatus.ACTIVE ||
      !user.credential ||
      user.mfa ||
      !(await verifyPassword(password, user.credential.passwordHash))
    )
      throw new Error("MFA_ENROLLMENT_FAILED");
    return {
      id: user.id,
      passwordHash: user.credential.passwordHash,
      username: user.username,
    };
  }
  async enroll(
    userId: string,
    verifiedHash: string,
    secret: Buffer,
    confirmedStep: number,
    recoveryHashes: string[],
  ) {
    const sealed: EncryptedSecret = this.cipher.encrypt(
      "IDENTITY_TOTP",
      aad(userId),
      secret.toString("base64"),
    );
    if (
      recoveryHashes.length !== 10 ||
      new Set(recoveryHashes).size !== 10 ||
      recoveryHashes.some((hash) => !/^[a-f0-9]{64}$/.test(hash))
    )
      throw new Error("MFA_ENROLLMENT_FAILED");
    await this.client.$transaction(async (tx) => {
      const [user] = await tx.$queryRaw<
        LockedUser[]
      >`SELECT id,role,status FROM users WHERE id=${userId}::uuid FOR UPDATE`;
      const credential = await tx.userCredential.findUnique({
        where: { userId },
      });
      const clock = await tx.$queryRaw<
        Array<{ now: Date }>
      >`SELECT clock_timestamp() AS now`;
      if (
        !user ||
        user.role !== UserRole.ADMIN ||
        user.status !== UserStatus.ACTIVE ||
        credential?.passwordHash !== verifiedHash ||
        !Number.isSafeInteger(confirmedStep) ||
        Math.abs(confirmedStep - Math.floor(clock[0].now.getTime() / 30000)) >
          1 ||
        (await tx.userMfa.findUnique({ where: { userId } }))
      )
        throw new Error("MFA_ENROLLMENT_FAILED");
      await tx.userMfa.create({
        data: { userId, ...sealed, lastUsedStep: BigInt(confirmedStep) },
      });
      await tx.mfaRecoveryCode.createMany({
        data: recoveryHashes.map((codeHash) => ({ userId, codeHash })),
      });
      await tx.session.deleteMany({ where: { userId } });
      await tx.mfaChallenge.deleteMany({ where: { userId } });
    });
  }
  async onApplicationShutdown() {
    await this.instance?.$disconnect();
  }
}
class ReplayFailure extends Error {}
