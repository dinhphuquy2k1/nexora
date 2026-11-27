import { SyncTrigger } from "../domain/sync.constants";
import { isUuid } from "../../common/validation/uuid";
import { CarrierProvider } from "../../carrier/domain/carrier";
import {
  reconciliationPolicy,
  type ShipmentReconciliationPolicy,
} from "../../shipment/domain/shipment-reconciliation";
export const UnishipActivationMode = {
  MANUAL_ONLY: "MANUAL_ONLY",
  AUTOMATIC: "AUTOMATIC",
} as const;
export interface UnishipActivationPolicy {
  readonly ownerUserId: string;
  readonly externalAccountId: string;
  readonly loginIdentifier: string;
  readonly connectionId?: string;
  readonly mode: (typeof UnishipActivationMode)[keyof typeof UnishipActivationMode];
}
export interface UnishipActivationContext {
  readonly ownerUserId: string;
  readonly connectionId: string;
  readonly provider: string;
  readonly externalAccountId: string;
  readonly loginIdentifier: string | null;
}
function invalid(): never {
  throw new Error("Invalid Uniship Sync configuration");
}
function json(raw: string): unknown {
  if (raw.length > 4096) invalid();
  try {
    return JSON.parse(raw);
  } catch {
    invalid();
  }
}
function activation(
  raw: string | undefined,
): UnishipActivationPolicy | undefined {
  if (!raw?.trim()) return undefined;
  const value = json(raw);
  if (!value || typeof value !== "object" || Array.isArray(value)) invalid();
  const p = value as Record<string, unknown>;
  const allowed = [
    "ownerUserId",
    "externalAccountId",
    "loginIdentifier",
    "mode",
    "connectionId",
  ];
  if (
    Object.keys(p).some((k) => !allowed.includes(k)) ||
    !isUuid(p.ownerUserId) ||
    typeof p.externalAccountId !== "string" ||
    !/^[1-9]\d{0,127}$/.test(p.externalAccountId) ||
    typeof p.loginIdentifier !== "string" ||
    !p.loginIdentifier ||
    p.loginIdentifier.length > 128 ||
    p.loginIdentifier.trim() !== p.loginIdentifier ||
    !Object.values(UnishipActivationMode).some((mode) => mode === p.mode) ||
    ("connectionId" in p && !isUuid(p.connectionId))
  )
    invalid();
  return Object.freeze({
    ownerUserId: p.ownerUserId.toLowerCase(),
    externalAccountId: p.externalAccountId,
    loginIdentifier: p.loginIdentifier,
    mode: p.mode as UnishipActivationPolicy["mode"],
    ...("connectionId" in p
      ? { connectionId: (p.connectionId as string).toLowerCase() }
      : {}),
  });
}
export function readUnishipSyncConfig(
  env: Readonly<Record<string, string | undefined>>,
) {
  const raw = env.UNISHIP_RECONCILIATION_POLICY_JSON;
  let reconciliation: ShipmentReconciliationPolicy | undefined;
  if (raw?.trim()) {
    reconciliation = reconciliationPolicy(json(raw));
    if (!reconciliation) invalid();
  }
  return Object.freeze({
    activation: activation(env.UNISHIP_ACTIVATION_POLICY_JSON),
    reconciliation,
  });
}
export function allowsUnishipActivation(
  policy: UnishipActivationPolicy | undefined,
  context: UnishipActivationContext,
  trigger: string,
  intervalMinutes?: number,
) {
  if (
    !policy ||
    context.provider !== CarrierProvider.UNISHIP ||
    context.ownerUserId !== policy.ownerUserId ||
    context.externalAccountId !== policy.externalAccountId ||
    context.loginIdentifier !== policy.loginIdentifier ||
    (policy.connectionId !== undefined &&
      context.connectionId !== policy.connectionId)
  )
    return false;
  if (trigger === SyncTrigger.MANUAL) return true;
  return (
    trigger === SyncTrigger.AUTO &&
    policy.mode === UnishipActivationMode.AUTOMATIC &&
    intervalMinutes !== undefined &&
    intervalMinutes >= 60
  );
}
