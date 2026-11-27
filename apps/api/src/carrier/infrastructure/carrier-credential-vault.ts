import {
  SecretCipher,
  type EncryptedSecret,
} from "../../common/crypto/secret-cipher";
import {
  CarrierCredentialPort,
  type LifecycleSnapshot,
  type SealedCandidate,
  type CarrierCredentialExecution,
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
export interface AuthorizedToken {
  readonly token?: EncryptedSecret;
}
export interface AuthorizedRecoveryPassword {
  readonly loginIdentifier: string | null;
  readonly password?: EncryptedSecret;
}
/** Infrastructure-only reader rechecks current scope separately for each purpose. */
export interface AuthorizedCredentialReader {
  authorizeRecovery(userId: string, snapshot: LifecycleSnapshot): Promise<void>;
  loadToken(
    userId: string,
    snapshot: LifecycleSnapshot,
  ): Promise<AuthorizedToken>;
  loadRecoveryPassword(
    userId: string,
    snapshot: LifecycleSnapshot,
  ): Promise<AuthorizedRecoveryPassword>;
}
export interface CarrierOutboundAuthority {
  context(
    userId: string,
    id: string,
    loginIdentifier: string | null,
    snapshot?: LifecycleSnapshot,
  ): import("./uniship/postgres-http-admission").UnishipHttpContext;
  verified(
    userId: string,
    id: string,
    loginIdentifier: string,
    externalAccountId: string,
    snapshot?: LifecycleSnapshot,
  ): void;
}
export class CarrierCredentialVault implements CarrierCredentialPort {
  constructor(
    private readonly reader: AuthorizedCredentialReader,
    private readonly cipher: SecretCipher,
    private readonly provider: UnishipAdapter,
    private readonly audit: SecurityAuditPort,
    private readonly outbound?: CarrierOutboundAuthority,
  ) {}
  private aad(userId: string, id: string, type: SecretType) {
    return `${id}:${userId}:${CarrierProvider.UNISHIP}:${type}`;
  }
  async authorizeReconnect(
    userId: string,
    snapshot: LifecycleSnapshot,
  ): Promise<void> {
    const identifier = snapshot.connection.loginIdentifier;
    if (!identifier) throw new LifecycleFailure(LifecycleCode.REAUTH_REQUIRED);
    this.outbound?.context(
      userId,
      snapshot.connection.id,
      identifier,
      snapshot,
    );
  }
  async acquireNew(
    userId: string,
    id: string,
    loginIdentifier: string,
    password: string,
    execution?: CarrierCredentialExecution,
  ): Promise<SealedCandidate> {
    execution?.signal?.throwIfAborted();
    const context = this.outbound?.context(
      userId,
      id,
      loginIdentifier,
      execution?.snapshot,
    );
    const result = await this.provider.acquire(loginIdentifier, password, {
      signal: execution?.signal,
      context,
    });
    execution?.signal?.throwIfAborted();
    this.outbound?.verified(
      userId,
      id,
      loginIdentifier,
      result.externalAccountId,
      execution?.snapshot,
    );
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
    execution?: CarrierCredentialExecution,
  ): Promise<SealedCandidate> {
    execution?.signal?.throwIfAborted();
    await this.reader.authorizeRecovery(userId, snapshot);
    execution?.signal?.throwIfAborted();
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
    execution?.signal?.throwIfAborted();
    const stored = await this.reader.loadRecoveryPassword(userId, snapshot);
    execution?.signal?.throwIfAborted();
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
      { signal: execution?.signal, snapshot },
    );
  }

  async useToken<T>(
    userId: string,
    snapshot: LifecycleSnapshot,
    operation: (token: string, signal?: AbortSignal) => Promise<T>,
    signal?: AbortSignal,
  ): Promise<T> {
    signal?.throwIfAborted();
    const stored = await this.reader.loadToken(userId, snapshot);
    signal?.throwIfAborted();
    if (!stored.token) throw new LifecycleFailure(LifecycleCode.TOKEN_REJECTED);
    const token = this.cipher.decrypt(
      "CARRIER_TOKEN",
      this.aad(userId, snapshot.connection.id, SecretType.ACCESS_TOKEN),
      stored.token,
    );
    signal?.throwIfAborted();
    return operation(token, signal);
  }
}
