import {
  SyncCapabilityRegistry,
  type SyncCapabilityRegistration,
} from "./sync-capability.registry";

// One production declaration source for API and worker. No authorized handlers yet.
const registrations: readonly SyncCapabilityRegistration[] = Object.freeze([]);
export function createSyncRuntimeCapabilities(): SyncCapabilityRegistry {
  return new SyncCapabilityRegistry(registrations);
}
