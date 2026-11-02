import type {
  SyncProvider,
  SyncDomainProcessor,
} from "../application/sync.port";
import { SyncError } from "../domain/sync-policy";
import { SyncErrorCode } from "../domain/sync.constants";
/** No authorized data endpoint/schema/domain command exists at this baseline. */
export const unavailableProvider: SyncProvider = {
  strategy: () => null,
  async fetch() {
    throw new SyncError(SyncErrorCode.SYNC_UNAVAILABLE);
  },
};
export const unavailableProcessor: SyncDomainProcessor = {
  version: 1,
  supports: () => false,
  async apply() {
    throw new SyncError(SyncErrorCode.PROCESSOR_UNAVAILABLE);
  },
};
