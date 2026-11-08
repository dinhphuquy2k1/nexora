/** Bound to the caller's existing lifecycle transaction, never an independent commit. */
export interface SyncDisablementParticipant {
  disable(userId: string): Promise<void>;
  removeConnection(userId: string, connectionId: string): Promise<void>;
}
