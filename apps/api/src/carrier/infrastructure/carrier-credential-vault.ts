import {
  SecretCipher,
  type EncryptedSecret,
} from "../../common/crypto/secret-cipher";
import {
  CarrierCredentialPort,
  type LifecycleSnapshot,
  type SealedCandidate,
} from "../application/carrier-lifecycle.port";
import { SecurityAuditPort } from "../application/security-audit.port";
import { SecretType, CarrierProvider } from "../domain/carrier";
import { LifecycleCode, LifecycleFailure } from "../domain/lifecycle";
import {
  CarrierAuditType,
  CarrierAuditOutcome,
  CarrierAuditReason,
} from "../domain/security-audit";
import { UnishipAdapter } from "./uniship/uniship-adapter";
export interface AuthorizedCredentials {
  loginIdentifier: string | null;
  password?: EncryptedSecret;
  token?: EncryptedSecret;
}
/** Infrastructure-only reader reloads ACTIVE ownership, epoch/version and stored ciphertext. */
export interface AuthorizedCredentialReader {
  load(
    userId: string,
    snapshot: LifecycleSnapshot,
  ): Promise<AuthorizedCredentials>;
}
export class CarrierCredentialVault implements CarrierCredentialPort {
  constructor(
    private readonly reader: AuthorizedCredentialReader,
    private readonly cipher: SecretCipher,
    private readonly provider: UnishipAdapter,
    private readonly audit: SecurityAuditPort,
  ) {}
  private aad(userId: string, id: string, type: SecretType) {
    return `${id}:${userId}:${CarrierProvider.UNISHIP}:${type}`;
  }
  async acquireNew(
    userId: string,
    id: string,
    loginIdentifier: string,
    password: string,
  ): Promise<SealedCandidate> {
    const result = await this.provider.acquire(loginIdentifier, password);
    return {
      externalAccountId: result.externalAccountId,
      password: this.cipher.encrypt(
        "CARRIER_PASSWORD",
        this.aad(userId, id, SecretType.PASSWORD),
        password,
      ),
      token: this.cipher.encrypt(
        "CARRIER_TOKEN",
        this.aad(userId, id, SecretType.ACCESS_TOKEN),
        result.token,
      ),
      expiresAt: result.expiresAt,
    };
  }
  async acquireStored(
    userId: string,
    snapshot: LifecycleSnapshot,
    correlationId: string,
  ): Promise<SealedCandidate> {
    await this.reader.load(userId, snapshot);
    try {
      // This is its own committed insert, before decrypt. A later rollback must not remove it.
      await this.audit.append({
        eventType: CarrierAuditType.PASSWORD_DECRYPT,
        outcome: CarrierAuditOutcome.ALLOWED,
        reason: CarrierAuditReason.RECOVERY_REQUESTED,
        userId,
        connectionId: snapshot.connection.id,
        provider: CarrierProvider.UNISHIP,
        correlationId,
      });
    } catch {
      throw new LifecycleFailure(LifecycleCode.AUDIT_UNAVAILABLE);
    }
    const stored = await this.reader.load(userId, snapshot);
    if (!stored.password || !stored.loginIdentifier)
      throw new LifecycleFailure(LifecycleCode.REAUTH_REQUIRED);
    // JS strings cannot be zeroed. Keep references local to this invocation only.
    const password = this.cipher.decrypt(
      "CARRIER_PASSWORD",
      this.aad(userId, snapshot.connection.id, SecretType.PASSWORD),
      stored.password,
    );
    return this.acquireNew(
      userId,
      snapshot.connection.id,
      stored.loginIdentifier,
      password,
    );
  }

  async useToken<T>(
    userId: string,
    snapshot: LifecycleSnapshot,
    operation: (token: string) => Promise<T>,
  ): Promise<T> {
    const stored = await this.reader.load(userId, snapshot);
    if (!stored.token) throw new LifecycleFailure(LifecycleCode.TOKEN_REJECTED);
    const token = this.cipher.decrypt(
      "CARRIER_TOKEN",
      this.aad(userId, snapshot.connection.id, SecretType.ACCESS_TOKEN),
      stored.token,
    );
    return operation(token);
  }
}
