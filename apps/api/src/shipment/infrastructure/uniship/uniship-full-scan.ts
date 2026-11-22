import type { FullScanContract } from "../../../sync/application/sync.port";
import { SyncStrategy } from "../../../sync/domain/sync.constants";
import {
  canonicalPayload,
  payloadHash,
} from "../../../sync/domain/sync-policy";
import { UNISHIP_ROUTES } from "../../../carrier/infrastructure/uniship/uniship-routes";

interface UnishipScanDefinition {
  readonly endpoint: string;
  readonly ecommerce: string;
  readonly filters: readonly {
    readonly column: string;
    readonly value: number;
    readonly condition: string;
  }[];
  readonly q: string;
  readonly pageSize: number;
  readonly sourceKeyScheme: string;
  readonly strategy: (typeof SyncStrategy)[keyof typeof SyncStrategy];
  readonly version: string;
}

/** One owned immutable definition drives both wire query and dataset consistency token. */
export function defineUnishipFullScan<const Endpoint extends string>(
  input: UnishipScanDefinition & { readonly endpoint: Endpoint },
) {
  const definition = Object.freeze({
    endpoint: input.endpoint,
    ecommerce: input.ecommerce,
    filters: Object.freeze(
      input.filters.map(({ column, value, condition }) =>
        Object.freeze({ column, value, condition }),
      ),
    ),
    q: input.q,
    pageSize: input.pageSize,
    sourceKeyScheme: input.sourceKeyScheme,
    strategy: input.strategy,
    version: input.version,
  });
  // Static provider metadata only; computed once outside admission/page locks.
  const contract: FullScanContract = Object.freeze({
    sourceKeyScheme: definition.sourceKeyScheme,
    pageSize: definition.pageSize,
    scope: payloadHash(canonicalPayload(definition)),
  });
  return Object.freeze({
    definition,
    contract,
    request(page: number) {
      return {
        endpoint: definition.endpoint,
        query: new URLSearchParams({
          ecommerce: definition.ecommerce,
          filter: Buffer.from(
            JSON.stringify({ filter: definition.filters }),
          ).toString("base64"),
          page: String(page),
          rowsPerPage: String(definition.pageSize),
          q: definition.q,
        }),
      };
    },
  });
}

export const UNISHIP_SCAN = defineUnishipFullScan({
  endpoint: UNISHIP_ROUTES.SHIPMENTS,
  ecommerce: "true",
  filters: [{ column: "IsEcommerce", value: 1, condition: "equal" }],
  q: "",
  pageSize: 100,
  sourceKeyScheme: "uniship-parcel-v1",
  strategy: SyncStrategy.FULL,
  version: "UNISHIP_ECOMMERCE_V1",
});
export const UNISHIP_SCAN_DEFINITION = UNISHIP_SCAN.definition;
export const UNISHIP_FULL_SCAN = UNISHIP_SCAN.contract;
