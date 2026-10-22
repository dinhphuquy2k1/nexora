import {
  CustomerStatus,
  CustomerStatusLabelsVi,
  type CustomerStatusCode,
} from "@nexora/shared";
import type { components } from "@nexora/sdk";

type SdkStatus = components["schemas"]["CustomerSummaryDto"]["status"];
type SameStatus = [SdkStatus] extends [CustomerStatusCode]
  ? [CustomerStatusCode] extends [SdkStatus]
    ? true
    : false
  : false;
const agreement: SameStatus = true;
const label: components["schemas"]["CustomerSummaryDto"]["statusLabel"] =
  CustomerStatusLabelsVi[CustomerStatus.ACTIVE];
export const statusContract = { agreement, label };
