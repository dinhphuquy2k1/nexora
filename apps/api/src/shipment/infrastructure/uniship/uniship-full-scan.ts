import type { FullScanContract } from "../../../sync/application/sync.port";
/** Static read scope: ecommerce=true, IsEcommerce=1, empty q, FULL, 100 rows. */
export const UNISHIP_FULL_SCAN = Object.freeze({
  sourceKeyScheme: "uniship-parcel-v1",
  pageSize: 100,
  scope: "UNISHIP_ECOMMERCE_V1",
} satisfies FullScanContract);
