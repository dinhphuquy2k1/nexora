import type {
  SyncCapability,
  SyncCapabilityResolver,
} from "../application/sync-capability.port";
import type { SyncProvider } from "../application/sync.port";
import { SyncConfigurationError } from "../domain/sync-policy";
import { SyncType, SyncStrategy } from "../domain/sync.constants";
import type { SyncDomainBinding } from "./sync-domain.binding";

export interface SyncCapabilityRegistration {
  readonly providerName: string;
  readonly type: SyncType;
  readonly provider: SyncProvider;
  readonly domain: SyncDomainBinding;
}
export interface BoundSyncCapability extends SyncCapability {
  readonly domain: SyncDomainBinding;
}
/** Explicit code registration only; no mutation, discovery, I/O or credentials. */
export class SyncCapabilityRegistry implements SyncCapabilityResolver {
  private readonly entries = new Map<
    string,
    Map<SyncType, Omit<BoundSyncCapability, "strategy">>
  >();
  constructor(registrations: readonly SyncCapabilityRegistration[]) {
    for (const registration of registrations) {
      const { providerName, type, provider, domain } = registration;
      if (
        typeof providerName !== "string" ||
        !providerName.length ||
        providerName.length > 32 ||
        !Object.values(SyncType).includes(type) ||
        !Number.isSafeInteger(domain.version) ||
        domain.version < 1 ||
        this.entries.get(providerName)?.has(type)
      )
        throw new SyncConfigurationError(
          "Invalid Sync capability registration",
        );
      const processor = Object.freeze({
        version: domain.version,
        supports: (candidate: SyncType) => domain.supports(candidate),
      });
      const entry = Object.freeze({ provider, processor, domain });
      let types = this.entries.get(providerName);
      if (!types) {
        types = new Map();
        this.entries.set(providerName, types);
      }
      types.set(type, entry);
    }
  }
  resolve(provider: string, type: SyncType): BoundSyncCapability | null {
    const entry = this.entries.get(provider)?.get(type);
    if (
      !entry ||
      entry.domain.version !== entry.processor.version ||
      !entry.processor.supports(type)
    )
      return null;
    const declaredStrategy = entry.provider.strategy(provider, type);
    const strategy = Object.values(SyncStrategy).find(
      (candidate) => candidate === declaredStrategy,
    );
    return strategy ? Object.freeze({ ...entry, strategy }) : null;
  }
}
