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
type RecoveryFlight = {
  promise: Promise<RecoveryOutcome>;
  controller: AbortController;
  waiters: number;
  settled: boolean;
};
type RecoveryBudget = { attempted: boolean; rechecks: number };
const MAX_RECOVERY_RECHECKS = 3;
/** Pure orchestration; HTTP/crypto/Prisma live behind infrastructure ports. */
export class CarrierConnectionLifecycleService {
  private readonly recoveries = new Map<string, RecoveryFlight>();
  private readonly flights = new Set<RecoveryFlight>();
  private stopping = false;
  private readonly shutdown = new AbortController();
  private readonly operations = new Set<Promise<unknown>>();
  private tracked<T>(
    signal: AbortSignal | undefined,
    operation: (signal: AbortSignal) => Promise<T>,
  ): Promise<T> {
    if (this.stopping)
      return Promise.reject(
        new LifecycleFailure(LifecycleCode.SERVICE_UNAVAILABLE),
      );
    const cancellation = AbortSignal.any([
      this.shutdown.signal,
      ...(signal ? [signal] : []),
    ]);
    const work = operation(cancellation);
    this.operations.add(work);
    void work.then(
      () => this.operations.delete(work),
      () => this.operations.delete(work),
    );
    return work;
  }
  connect(
    userId: string,
    input: { loginIdentifier: string; password: string; displayName: string },
    correlationId = randomUUID(),
  ) {
    return this.tracked(undefined, (signal) =>
      this.performConnect(userId, input, correlationId, signal),
    );
  }
  reconnect(
    userId: string,
    id: string,
    password: string,
    correlationId = randomUUID(),
  ) {
    return this.tracked(undefined, (signal) =>
      this.performReconnect(userId, id, password, correlationId, signal),
    );
  }
  withToken<T>(
    userId: string,
    id: string,
    operation: (token: string, signal?: AbortSignal) => Promise<T>,
    correlationId = randomUUID(),
    signal?: AbortSignal,
  ): Promise<T> {
    return this.tracked(signal, (cancellation) =>
      this.performWithToken(
        userId,
        id,
        (token) => {
          cancellation.throwIfAborted();
          return operation(token, cancellation);
        },
        correlationId,
        cancellation,
      ),
    );
  }
  constructor(
    private readonly store: CarrierLifecyclePort,
    private readonly credentials: CarrierCredentialPort,
    private readonly admission: CarrierAdmission,
    private readonly audit: SecurityAuditPort,
    private readonly now: () => number = Date.now,
  ) {}
  private async performConnect(
    userId: string,
    input: { loginIdentifier: string; password: string; displayName: string },
    correlationId: string,
    signal: AbortSignal,
  ) {
    signal.throwIfAborted();
    this.admission.admit(userId);
    const generation = await this.store.authorizeNew(userId);
    const id = randomUUID();
    try {
      const candidate = await this.credentials.acquireNew(
        userId,
        id,
        input.loginIdentifier,
        input.password,
        { signal },
      );
      signal.throwIfAborted();
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

  private async performReconnect(
    userId: string,
    id: string,
    password: string,
    correlationId: string,
    signal: AbortSignal,
  ) {
    signal.throwIfAborted();
    // Ownership before rate admission/provider requests; a foreign UUID stays 404.
    const initial = await this.store.read(userId, id);
    this.admission.admit(userId);
    try {
      await this.credentials.authorizeReconnect(userId, initial);
    } catch (error) {
      await this.auditFailure(
        userId,
        id,
        CarrierAuditType.RECONNECT,
        error,
        correlationId,
      );
      throw error;
    }
    signal.throwIfAborted();
    const snapshot = await this.store.claimReconnect(userId, id, initial);
    try {
      const identifier = snapshot.connection.loginIdentifier;
      if (!identifier)
        throw new LifecycleFailure(LifecycleCode.REAUTH_REQUIRED);
      const candidate = await this.credentials.acquireNew(
        userId,
        id,
        identifier,
        password,
        { snapshot, signal },
      );
      signal.throwIfAborted();
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
    signal?: AbortSignal,
  ): Promise<RecoveryOutcome> {
    signal?.throwIfAborted();
    if (this.stopping)
      throw new LifecycleFailure(LifecycleCode.SERVICE_UNAVAILABLE);
    const id = snapshot.connection.id;
    let entry = this.recoveries.get(id),
      joined = !!entry;
    if (entry?.controller.signal.aborted) {
      this.recoveries.delete(id);
      entry = undefined;
      joined = false;
    }
    if (!entry) {
      if (this.flights.size >= 128)
        throw new LifecycleFailure(LifecycleCode.RATE_LIMITED, 1000);
      const controller = new AbortController();
      const flight: RecoveryFlight = {
        controller,
        waiters: 0,
        settled: false,
        promise: this.performRecovery(
          userId,
          snapshot,
          correlationId,
          controller.signal,
        ),
      };
      entry = flight;
      this.recoveries.set(id, flight);
      this.flights.add(flight);
      const cleanup = () => {
        flight.settled = true;
        this.flights.delete(flight);
        if (this.recoveries.get(id) === flight) this.recoveries.delete(id);
      };
      void flight.promise.then(cleanup, cleanup);
    }
    const flight = entry;
    flight.waiters++;
    let released = false,
      removeAbort = () => {};
    const release = () => {
      if (released) return;
      released = true;
      flight.waiters--;
      if (!flight.waiters && !flight.settled) flight.controller.abort();
    };
    try {
      const cancelled = new Promise<never>((_resolve, reject) => {
        if (!signal) return;
        const onAbort = () => {
          release();
          reject(signal.reason);
        };
        signal.addEventListener("abort", onAbort, { once: true });
        removeAbort = () => signal.removeEventListener("abort", onAbort);
        if (signal.aborted) onAbort();
      });
      const result = await Promise.race([flight.promise, cancelled]);
      return joined ? { ...result, kind: "JOINED" } : result;
    } finally {
      removeAbort();
      release();
    }
  }
  async onApplicationShutdown(): Promise<void> {
    this.stopping = true;
    this.shutdown.abort(
      new LifecycleFailure(LifecycleCode.SERVICE_UNAVAILABLE),
    );
    for (const flight of this.flights) flight.controller.abort();
    await Promise.allSettled([...this.flights].map((flight) => flight.promise));
    await Promise.allSettled([...this.operations]);
  }
  private async performRecovery(
    userId: string,
    initial: LifecycleSnapshot,
    correlationId: string,
    signal?: AbortSignal,
  ): Promise<RecoveryOutcome> {
    signal?.throwIfAborted();
    const current = await this.store.read(userId, initial.connection.id);
    signal?.throwIfAborted();
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
      signal?.throwIfAborted();
      const candidate = await this.credentials.acquireStored(
        userId,
        snapshot,
        correlationId,
        { signal, snapshot },
      );
      signal?.throwIfAborted();
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
      if (signal?.aborted) {
        await this.auditFailure(
          userId,
          snapshot.connection.id,
          CarrierAuditType.RECOVERY,
          error,
          correlationId,
        );
        throw signal.reason;
      }
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
    signal?: AbortSignal,
  ): Promise<LifecycleSnapshot> {
    const unusableRevision =
      rejectedRevision !== undefined
        ? rejectedRevision
        : this.needsRecovery(initial)
          ? initial.tokenRevision
          : undefined;
    let snapshot = initial;
    // Shared across both phases of one logical operation, not reset after rejection.
    for (let check = 0; check <= MAX_RECOVERY_RECHECKS; check++) {
      signal?.throwIfAborted();
      this.canRecover(snapshot);
      if (!this.needsRecovery(snapshot, unusableRevision)) return snapshot;
      if (budget.attempted || budget.rechecks >= MAX_RECOVERY_RECHECKS)
        throw new LifecycleFailure(LifecycleCode.STALE);
      budget.rechecks++;
      const outcome = await this.recover(
        userId,
        snapshot,
        correlationId,
        signal,
      );
      budget.attempted ||= outcome.attempted;
      // COMMITTED, SUPERSEDED and JOINED all require current authorization/state.
      snapshot = await this.store.read(userId, snapshot.connection.id);
    }
    throw new LifecycleFailure(LifecycleCode.STALE);
  }
  private async performWithToken<T>(
    userId: string,
    id: string,
    operation: (token: string, signal?: AbortSignal) => Promise<T>,
    correlationId = randomUUID(),
    signal?: AbortSignal,
  ): Promise<T> {
    signal?.throwIfAborted();
    const budget: RecoveryBudget = { attempted: false, rechecks: 0 };
    let snapshot = await this.usableSnapshot(
      userId,
      await this.store.read(userId, id),
      budget,
      correlationId,
      undefined,
      signal,
    );
    try {
      signal?.throwIfAborted();
      const result = await this.credentials.useToken(
        userId,
        snapshot,
        operation,
        signal,
      );
      signal?.throwIfAborted();
      return result;
    } catch (error) {
      signal?.throwIfAborted();
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
        signal,
      );
      // Exactly one operation retry; a second rejection propagates unchanged.
      signal?.throwIfAborted();
      const result = await this.credentials.useToken(
        userId,
        snapshot,
        operation,
        signal,
      );
      signal?.throwIfAborted();
      return result;
    }
  }
}
