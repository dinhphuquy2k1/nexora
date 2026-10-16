import { SecurityAuditPort } from "./security-audit.port";
import {
  CarrierAuditType,
  CarrierAuditOutcome,
  CarrierAuditReason,
} from "../domain/security-audit";
import { CarrierProvider } from "../domain/carrier";
import { randomUUID } from "node:crypto";
import { CryptoFailure } from "../../common/crypto/secret-cipher";
import { ConnectionStatus } from "../domain/carrier";
import { LifecycleCode, LifecycleFailure } from "../domain/lifecycle";
import {
  CarrierLifecyclePort,
  CarrierCredentialPort,
  type LifecycleSnapshot,
} from "./carrier-lifecycle.port";

export interface CarrierAdmission {
  admit(userId: string): void;
}
/** Pure orchestration; HTTP/crypto/Prisma live behind infrastructure ports. */
export class CarrierConnectionLifecycleService {
  private readonly recoveries = new Map<string, Promise<void>>();
  constructor(
    private readonly store: CarrierLifecyclePort,
    private readonly credentials: CarrierCredentialPort,
    private readonly admission: CarrierAdmission,
    private readonly audit: SecurityAuditPort,
    private readonly now: () => number = Date.now,
  ) {}
  async connect(
    userId: string,
    input: { loginIdentifier: string; password: string; displayName: string },
    correlationId = randomUUID(),
  ) {
    this.admission.admit(userId);
    const generation = await this.store.authorizeNew(userId);
    const id = randomUUID();
    try {
      const candidate = await this.credentials.acquireNew(
        userId,
        id,
        input.loginIdentifier,
        input.password,
      );
      return await this.store.create(
        userId,
        id,
        generation,
        input.loginIdentifier,
        input.displayName,
        candidate,
        correlationId,
      );
    } catch (error) {
      await this.auditFailure(
        userId,
        null,
        CarrierAuditType.CONNECT,
        error,
        correlationId,
      );
      throw error;
    }
  }
  private async auditFailure(
    userId: string,
    connectionId: string | null,
    eventType: CarrierAuditType,
    error: unknown,
    correlationId: string,
  ) {
    let reason: CarrierAuditReason = CarrierAuditReason.UNAVAILABLE;
    if (error instanceof LifecycleFailure) {
      if (error.code === LifecycleCode.DUPLICATE)
        reason = CarrierAuditReason.DUPLICATE_ACCOUNT;
      if (
        [
          LifecycleCode.IDENTITY_MISMATCH,
          LifecycleCode.CANDIDATE_IDENTITY_MISMATCH,
        ].some((code) => code === error.code)
      )
        reason = CarrierAuditReason.IDENTITY_MISMATCH;
      if (
        error.code === LifecycleCode.PROVIDER_AUTH_FAILED ||
        error.code === LifecycleCode.TOKEN_REJECTED
      )
        reason = CarrierAuditReason.INVALID_CREDENTIALS;
    }
    try {
      await this.audit.append({
        eventType,
        outcome: CarrierAuditOutcome.FAILURE,
        reason,
        userId,
        connectionId,
        provider: CarrierProvider.UNISHIP,
        correlationId,
      });
    } catch {
      throw new LifecycleFailure(LifecycleCode.AUDIT_UNAVAILABLE);
    }
  }

  async reconnect(
    userId: string,
    id: string,
    password: string,
    correlationId = randomUUID(),
  ) {
    // Ownership before rate admission/provider requests; a foreign UUID stays 404.
    await this.store.read(userId, id);
    this.admission.admit(userId);
    const snapshot = await this.store.claim(userId, id);
    try {
      const identifier = snapshot.connection.loginIdentifier;
      if (!identifier)
        throw new LifecycleFailure(LifecycleCode.REAUTH_REQUIRED);
      const candidate = await this.credentials.acquireNew(
        userId,
        id,
        identifier,
        password,
      );
      this.identity(snapshot, candidate.externalAccountId);
      return await this.store.complete(
        userId,
        snapshot,
        candidate,
        correlationId,
      );
    } catch (error) {
      await this.handleReconnectFailure(userId, snapshot, error);
      await this.auditFailure(
        userId,
        id,
        CarrierAuditType.RECONNECT,
        error,
        correlationId,
      );
      throw error;
    }
  }
  private identity(snapshot: LifecycleSnapshot, verifiedId: string) {
    if (snapshot.connection.externalAccountId !== verifiedId)
      throw new LifecycleFailure(LifecycleCode.IDENTITY_MISMATCH);
  }
  private async handleReconnectFailure(
    userId: string,
    snapshot: LifecycleSnapshot,
    error: unknown,
  ) {
    // A failed candidate says nothing about the stored credentials. Only a
    // verified different account invalidates this connection's identity.
    if (
      error instanceof LifecycleFailure &&
      error.code === LifecycleCode.IDENTITY_MISMATCH
    )
      await this.store.fail(userId, snapshot, ConnectionStatus.REAUTH_REQUIRED);
  }
  private async handleRecoveryFailure(
    userId: string,
    snapshot: LifecycleSnapshot,
    error: unknown,
  ) {
    if (error instanceof CryptoFailure) return;
    const manual =
      snapshot.connection.status === ConnectionStatus.REAUTH_REQUIRED ||
      (error instanceof LifecycleFailure &&
        [
          LifecycleCode.IDENTITY_MISMATCH,
          LifecycleCode.CANDIDATE_IDENTITY_MISMATCH,
          LifecycleCode.PROVIDER_AUTH_FAILED,
          LifecycleCode.TOKEN_REJECTED,
          LifecycleCode.REAUTH_REQUIRED,
        ].some((code) => code === error.code));
    // Failure writes are conditional; they never resurrect deleted/disabled/stale rows.
    await this.store.fail(
      userId,
      snapshot,
      manual ? ConnectionStatus.REAUTH_REQUIRED : ConnectionStatus.ERROR,
    );
  }
  private async recover(
    userId: string,
    snapshot: LifecycleSnapshot,
    correlationId: string,
  ): Promise<void> {
    const id = snapshot.connection.id;
    const existing = this.recoveries.get(id);
    if (existing) return existing;
    if (this.recoveries.size >= 128)
      throw new LifecycleFailure(LifecycleCode.RATE_LIMITED, 1000);
    const promise = this.performRecovery(userId, snapshot, correlationId);
    this.recoveries.set(id, promise);
    try {
      await promise;
    } finally {
      if (this.recoveries.get(id) === promise) this.recoveries.delete(id);
    }
  }
  private async performRecovery(
    userId: string,
    initial: LifecycleSnapshot,
    correlationId: string,
  ): Promise<void> {
    const current = await this.store.read(userId, initial.connection.id);
    this.canRecover(current);
    // A newer manual reconnect/recovery wins; reuse its state rather than overwrite it.
    if (current.version !== initial.version) return;
    this.admission.admit(userId);
    const snapshot = await this.store.claim(
      userId,
      current.connection.id,
      current.version,
    );
    try {
      const candidate = await this.credentials.acquireStored(
        userId,
        snapshot,
        correlationId,
      );
      this.identity(snapshot, candidate.externalAccountId);
      await this.store.complete(
        userId,
        snapshot,
        candidate,
        correlationId,
        CarrierAuditType.RECOVERY,
      );
    } catch (error) {
      await this.handleRecoveryFailure(userId, snapshot, error);
      await this.auditFailure(
        userId,
        snapshot.connection.id,
        CarrierAuditType.RECOVERY,
        error,
        correlationId,
      );
      throw error;
    }
  }
  private canRecover(snapshot: LifecycleSnapshot) {
    if (snapshot.connection.status === ConnectionStatus.REAUTH_REQUIRED)
      throw new LifecycleFailure(LifecycleCode.REAUTH_REQUIRED);
  }
  async withToken<T>(
    userId: string,
    id: string,
    operation: (token: string) => Promise<T>,
    correlationId = randomUUID(),
  ): Promise<T> {
    let snapshot = await this.store.read(userId, id);
    this.canRecover(snapshot);
    let recovered = false;
    if (
      !snapshot.hasToken ||
      (snapshot.expiresAt !== null &&
        snapshot.expiresAt.getTime() <= this.now())
    ) {
      await this.recover(userId, snapshot, correlationId);
      snapshot = await this.store.read(userId, id);
      this.canRecover(snapshot);
      recovered = true;
    }
    try {
      return await this.credentials.useToken(userId, snapshot, operation);
    } catch (error) {
      if (
        recovered ||
        !(error instanceof LifecycleFailure) ||
        error.code !== LifecycleCode.TOKEN_REJECTED
      )
        throw error;
      await this.recover(userId, snapshot, correlationId);
      snapshot = await this.store.read(userId, id);
      this.canRecover(snapshot);
      return this.credentials.useToken(userId, snapshot, operation);
    }
  }
}
