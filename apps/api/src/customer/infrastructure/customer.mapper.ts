import {
  CustomerAggregate,
  type CustomerSnapshot,
} from "../domain/customer.aggregate";
/** Persisted status is validated by Domain; no fallback for corrupt storage. */
export function hydrateCustomer(
  row: Omit<CustomerSnapshot, "status"> & { status: string },
): CustomerAggregate {
  return CustomerAggregate.rehydrate(row);
}
