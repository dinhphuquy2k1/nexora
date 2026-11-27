import type { CarrierAuditType } from "../domain/security-audit";
import type { ConnectionMetadata, ConnectionStatus } from "../domain/carrier";
import type { EncryptedSecret } from "../../common/crypto/secret-cipher";

export interface LifecycleSnapshot {
  connection: ConnectionMetadata;
  generation: number;
  version: number;
  hasToken: boolean;
  /** Internal sealed-artifact revision; never plaintext-derived or public metadata. */
  tokenRevision: string | null;
  expiresAt: Date | null;
}
export interface SealedCandidate {
  externalAccountId: string;
  password: EncryptedSecret;
  token: EncryptedSecret;
  expiresAt: Date | null;
}
export abstract class CarrierLifecyclePort {
  abstract authorizeNew(userId: string): Promise<number>;
  abstract read(userId: string, id: string): Promise<LifecycleSnapshot>;
  abstract claim(
    userId: string,
    id: string,
    expectedVersion?: number,
  ): Promise<LifecycleSnapshot>;
  abstract create(
    userId: string,
    id: string,
    generation: number,
    loginIdentifier: string,
    displayName: string,
    candidate: SealedCandidate,
    correlationId: string,
  ): Promise<ConnectionMetadata>;
  abstract complete(
    userId: string,
    snapshot: LifecycleSnapshot,
    candidate: SealedCandidate,
    correlationId: string,
    eventType?: CarrierAuditType,
  ): Promise<ConnectionMetadata>;
  abstract fail(
    userId: string,
    snapshot: LifecycleSnapshot,
    status: ConnectionStatus,
  ): Promise<void>;
}
export interface CarrierCredentialExecution {
  readonly signal?: AbortSignal;
  readonly snapshot?: LifecycleSnapshot;
}
export abstract class CarrierCredentialPort {
  abstract acquireNew(
    userId: string,
    id: string,
    loginIdentifier: string,
    password: string,
    execution?: CarrierCredentialExecution,
  ): Promise<SealedCandidate>;
  abstract acquireStored(
    userId: string,
    snapshot: LifecycleSnapshot,
    correlationId: string,
    execution?: CarrierCredentialExecution,
  ): Promise<SealedCandidate>;
  abstract useToken<T>(
    userId: string,
    snapshot: LifecycleSnapshot,
    operation: (token: string, signal?: AbortSignal) => Promise<T>,
    signal?: AbortSignal,
  ): Promise<T>;
}
