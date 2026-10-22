import type { CustomerPatch } from "./customer";
import { CustomerStatusVO } from "./customer-status.vo";
import { normalizeProfilePatch } from "./customer.value-objects";

/** V1 profile transitions depend on status and command only, never child state. */
export function changeCustomerProfile(
  currentStatus: unknown,
  input: CustomerPatch,
): CustomerPatch {
  CustomerStatusVO.from(currentStatus);
  return normalizeProfilePatch(input);
}
