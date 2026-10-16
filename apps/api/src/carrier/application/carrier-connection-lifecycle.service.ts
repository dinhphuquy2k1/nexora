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
type RecoveryOutcome = {
  kind: "COMMITTED" | "SUPERSEDED" | "JOINED";
  attempted: boolean;
};
type RecoveryBudget = { attempted: boolean; rechecks: number };
const MAX_RECOVERY_RECHECKS = 3;
/** Pure orchestration; HTTP/crypto/Prisma live behind infrastructure ports. */
export class CarrierConnectionLifecycleService {
  private readonly recoveries = new Map<string, Promise<RecoveryOutcome>>();
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
  ): Promise<RecoveryOutcome> {
    const id = snapshot.connection.id;
    const existing = this.recoveries.get(id);
    if (existing) return { ...(await existing), kind: "JOINED" };
    if (this.recoveries.size >= 128)
      throw new LifecycleFailure(LifecycleCode.RATE_LIMITED, 1000);
    const promise = this.performRecovery(userId, snapshot, correlationId);
    this.recoveries.set(id, promise);
    try {
      return await promise;
    } finally {
      if (this.recoveries.get(id) === promise) this.recoveries.delete(id);
    }
  }
  private async performRecovery(
    userId: string,
    initial: LifecycleSnapshot,
    correlationId: string,
  ): Promise<RecoveryOutcome> {
    const current = await this.store.read(userId, initial.connection.id);
    this.canRecover(current);
    // A claim is not proof of replacement. The caller must re-read token evidence.
    if (
      current.version !== initial.version ||
      current.generation !== initial.generation
    )
      return { kind: "SUPERSEDED", attempted: false };
    this.admission.admit(userId);
    let snapshot: LifecycleSnapshot;
    try {
      snapshot = await this.store.claim(
        userId,
        current.connection.id,
        current.version,
      );
    } catch (error) {
      if (
        error instanceof LifecycleFailure &&
        error.code === LifecycleCode.STALE
      )
        return { kind: "SUPERSEDED", attempted: false };
      throw error;
    }
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
      return { kind: "COMMITTED", attempted: true };
    } catch (error) {
      await this.handleRecoveryFailure(userId, snapshot, error);
      await this.auditFailure(
        userId,
        snapshot.connection.id,
        CarrierAuditType.RECOVERY,
        error,
        correlationId,
      );
      // Vault entry reserves the only password attempt: STALE can occur either
      // before decrypt or after provider acquisition. Never guess and log in twice.
      if (
        error instanceof LifecycleFailure &&
        error.code === LifecycleCode.STALE
      )
        return { kind: "SUPERSEDED", attempted: true };
      throw error;
    }
  }
  private canRecover(snapshot: LifecycleSnapshot) {
    if (snapshot.connection.status === ConnectionStatus.REAUTH_REQUIRED)
      throw new LifecycleFailure(LifecycleCode.REAUTH_REQUIRED);
  }
  private needsRecovery(
    snapshot: LifecycleSnapshot,
    rejectedRevision?: string | null,
  ) {
    return (
      !snapshot.hasToken ||
      !snapshot.tokenRevision ||
      (snapshot.expiresAt !== null &&
        snapshot.expiresAt.getTime() <= this.now()) ||
      (rejectedRevision !== undefined &&
        snapshot.tokenRevision === rejectedRevision)
    );
  }
  private async usableSnapshot(
    userId: string,
    initial: LifecycleSnapshot,
    budget: RecoveryBudget,
    correlationId: string,
    rejectedRevision?: string | null,
  ): Promise<LifecycleSnapshot> {
    let snapshot = initial;
    // Shared across both phases of one logical operation, not reset after rejection.
    for (let check = 0; check <= MAX_RECOVERY_RECHECKS; check++) {
      this.canRecover(snapshot);
      if (!this.needsRecovery(snapshot, rejectedRevision)) return snapshot;
      if (budget.attempted || budget.rechecks >= MAX_RECOVERY_RECHECKS)
        throw new LifecycleFailure(LifecycleCode.STALE);
      budget.rechecks++;
      const outcome = await this.recover(userId, snapshot, correlationId);
      budget.attempted ||= outcome.attempted;
      // COMMITTED, SUPERSEDED and JOINED all require current authorization/state.
      snapshot = await this.store.read(userId, snapshot.connection.id);
    }
    throw new LifecycleFailure(LifecycleCode.STALE);
  }
  async withToken<T>(
    userId: string,
    id: string,
    operation: (token: string) => Promise<T>,
    correlationId = randomUUID(),
  ): Promise<T> {
    const budget: RecoveryBudget = { attempted: false, rechecks: 0 };
    let snapshot = await this.usableSnapshot(
      userId,
      await this.store.read(userId, id),
      budget,
      correlationId,
    );
    try {
      return await this.credentials.useToken(userId, snapshot, operation);
    } catch (error) {
      if (
        budget.attempted ||
        !(error instanceof LifecycleFailure) ||
        error.code !== LifecycleCode.TOKEN_REJECTED
      )
        throw error;
      // Unknown expiry is not evidence of validity. Remember the rejected sealed
      // revision so a version-only claim cannot make the same token look fresh.
      const rejectedRevision = snapshot.tokenRevision;
      snapshot = await this.usableSnapshot(
        userId,
        await this.store.read(userId, id),
        budget,
        correlationId,
        rejectedRevision,
      );
      // Exactly one operation retry; a second rejection propagates unchanged.
      return this.credentials.useToken(userId, snapshot, operation);
    }
  }
}
