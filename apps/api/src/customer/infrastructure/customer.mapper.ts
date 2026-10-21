import {
  CustomerAggregate,
  type CustomerSnapshot,
} from "../domain/customer.aggregate";
import type { CustomerStatus } from "../domain/customer";
/** Persistence primitives only; DB CHECK owns the stored status vocabulary. */
export function hydrateCustomer(
  row: Omit<CustomerSnapshot, "status"> & { status: string },
): CustomerAggregate {
  return CustomerAggregate.rehydrate({
    ...row,
    status: row.status as CustomerStatus,
  });
}
