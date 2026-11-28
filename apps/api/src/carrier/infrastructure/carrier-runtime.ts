import { CarrierConnectionLifecycleService } from "../application/carrier-connection-lifecycle.service";
import type { LifecycleSnapshot } from "../application/carrier-lifecycle.port";
import { SecretCipher } from "../../common/crypto/secret-cipher";
import { EnvironmentKeyring } from "../../common/crypto/environment-keyring";
import { CarrierLifecycleAdapter } from "./carrier-lifecycle.adapter";
import { WorkerCarrierStore } from "./worker-carrier-store";
import { CarrierCredentialVault } from "./carrier-credential-vault";
import { PostgresSecurityAudit } from "./security-audit.adapter";
import { PostgresProviderBudget } from "./uniship/postgres-provider-budget";
import {
  PostgresHttpAdmission,
  type UnishipHttpContext,
} from "./uniship/postgres-http-admission";
import { UnishipHttpClient } from "./uniship/uniship-http.client";
import { UnishipAdapter } from "./uniship/uniship-adapter";
import { UserCarrierAdmission } from "./uniship/provider-budget";
import type { readCarrierRuntimeConfig } from "./carrier-runtime.config";
export interface CarrierRuntimeScope {
  readonly userId: string;
  readonly id: string;
  readonly loginIdentifier: string | null;
  readonly snapshot?: LifecycleSnapshot;
  readonly verifiedAccount?: string;
}
/** Explicit per-process construction; no controllers/API application boot in Worker. */
export function createCarrierRuntime(
  url: string,
  authority: "api" | "worker",
  env: Readonly<Record<string, string | undefined>>,
  config: ReturnType<typeof readCarrierRuntimeConfig>,
  authorize: (scope: CarrierRuntimeScope) => void,
  activationConfigured = false,
) {
  const store =
    authority === "worker"
      ? new WorkerCarrierStore(url)
      : new CarrierLifecycleAdapter(url);
  const keyring = new EnvironmentKeyring(env, "CARRIER"),
    cipher = new SecretCipher(keyring);
  const audit = new PostgresSecurityAudit(store.client, true),
    budget = new PostgresProviderBudget(url),
    admission = new PostgresHttpAdmission(url, authority);
  const client = new UnishipHttpClient({
    ...config,
    admission,
    activationConfigured,
  });
  const context = (
    userId: string,
    id: string,
    loginIdentifier: string | null,
    snapshot?: LifecycleSnapshot,
  ): UnishipHttpContext => {
    authorize({ userId, id, loginIdentifier, snapshot });
    return {
      ownerUserId: userId,
      connectionId: snapshot ? id : null,
      ...(store instanceof WorkerCarrierStore
        ? { execution: store.execution() }
        : {}),
    };
  };
  const vault = new CarrierCredentialVault(
    store,
    cipher,
    new UnishipAdapter(client, budget),
    audit,
    {
      context,
      verified: (userId, id, loginIdentifier, verifiedAccount, snapshot) =>
        authorize({ userId, id, loginIdentifier, verifiedAccount, snapshot }),
    },
  );
  const lifecycle = new CarrierConnectionLifecycleService(
    store,
    vault,
    new UserCarrierAdmission(),
    audit,
  );
  let shutdown: Promise<void> | undefined;
  return {
    store,
    client,
    lifecycle,
    audit,
    budget,
    admission,
    context,
    keyReady: () => {
      try {
        const version = keyring.activeVersion();
        keyring.key(version);
        return true;
      } catch {
        return false;
      }
    },
    onApplicationShutdown(): Promise<void> {
      return (shutdown ??= (async () => {
        await Promise.allSettled([
          lifecycle.onApplicationShutdown(),
          budget.onApplicationShutdown(),
          admission.onApplicationShutdown(),
        ]);
        await store.onApplicationShutdown();
      })());
    },
  };
}
export type CarrierRuntime = ReturnType<typeof createCarrierRuntime>;
