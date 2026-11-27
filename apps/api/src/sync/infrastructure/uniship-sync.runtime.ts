import type { SyncCapabilityRegistry } from "./sync-capability.registry";
import type { SyncRuntimePolicy } from "./sync-runtime-policy";
import { createSyncRuntimeCapabilities } from "./sync-runtime-capabilities";
import { loadSyncConfig, SyncConfigurationError } from "../domain/sync-policy";
import { readUnishipSyncConfig } from "./uniship-sync.config";
import { createUnishipRuntimePolicy } from "./uniship-runtime-policy";
import { readCarrierRuntimeConfig } from "../../carrier/infrastructure/carrier-runtime.config";
import {
  createCarrierRuntime,
  type CarrierRuntime,
  type CarrierRuntimeScope,
} from "../../carrier/infrastructure/carrier-runtime";
import { WorkerCarrierStore } from "../../carrier/infrastructure/worker-carrier-store";
import {
  LifecycleCode,
  LifecycleFailure,
} from "../../carrier/domain/lifecycle";
import { UnishipShipmentProvider } from "../../shipment/infrastructure/uniship/uniship-shipment.provider";
import { UnishipShipmentProcessor } from "../../shipment/infrastructure/uniship/uniship-shipment.processor";
import { createShipmentSyncBinding } from "../../shipment/infrastructure/shipment-sync-domain.binding";
export class UnishipSyncRuntime {
  readonly carrier: CarrierRuntime;
  readonly capabilities: SyncCapabilityRegistry;
  readonly eligibility: SyncRuntimePolicy;
  constructor(
    url: string,
    env: Readonly<Record<string, string | undefined>>,
    authority: "api" | "worker",
  ) {
    if (authority === "worker") {
      try {
        if (new URL(url).username !== "nexora_sync") throw new Error();
      } catch {
        throw new SyncConfigurationError("Invalid Worker database custody");
      }
    }
    const config = readCarrierRuntimeConfig(env),
      sync = loadSyncConfig(env),
      settings = readUnishipSyncConfig(env);
    const authorize = (scope: CarrierRuntimeScope) => {
      if (!this.carrier.client.operationallyAvailable())
        throw new LifecycleFailure(LifecycleCode.SERVICE_UNAVAILABLE);
      const policy = settings.activation;
      // Legacy loopback Carrier fixtures remain independent of Sync activation; live targets never bypass the gate.
      if (!policy) return;
      if (
        scope.userId !== policy.ownerUserId ||
        scope.loginIdentifier !== policy.loginIdentifier ||
        (policy.connectionId !== undefined &&
          scope.id !== policy.connectionId) ||
        (scope.snapshot &&
          scope.snapshot.connection.externalAccountId !==
            policy.externalAccountId)
      )
        throw new LifecycleFailure(LifecycleCode.SERVICE_UNAVAILABLE);
      if (
        scope.verifiedAccount !== undefined &&
        scope.verifiedAccount !== policy.externalAccountId
      )
        throw new LifecycleFailure(LifecycleCode.CANDIDATE_IDENTITY_MISMATCH);
    };
    this.carrier = createCarrierRuntime(url, authority, env, config, authorize);
    const ready =
      sync.enabled &&
      settings.activation !== undefined &&
      this.carrier.client.operationallyAvailable() &&
      this.carrier.keyReady();
    this.eligibility = createUnishipRuntimePolicy(settings.activation, ready);
    const carrier = this.carrier;
    const provider = new UnishipShipmentProvider(
      carrier.client,
      carrier.lifecycle,
      carrier.store,
      undefined,
      (job, snapshot) =>
        carrier.context(
          job.owner_user_id,
          snapshot.connection.id,
          snapshot.connection.loginIdentifier,
          snapshot,
        ),
    );
    const workerStore =
      carrier.store instanceof WorkerCarrierStore ? carrier.store : null;
    const boundProvider = workerStore
      ? {
          fullScan: provider.fullScan,
          strategy: provider.strategy.bind(provider),
          fetch: (
            job: Parameters<typeof provider.fetch>[0],
            signal: AbortSignal,
          ) => workerStore.withJob(job, () => provider.fetch(job, signal)),
        }
      : provider;
    this.capabilities = createSyncRuntimeCapabilities({
      provider: boundProvider,
      domain: createShipmentSyncBinding(
        new UnishipShipmentProcessor(1),
        settings.reconciliation,
      ),
      enabled: ready,
    });
  }
  async onApplicationShutdown() {
    await this.carrier.onApplicationShutdown();
  }
}
