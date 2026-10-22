import { CustomerStatusLabelsVi } from "@nexora/shared";
import type { CustomerSummary, CustomerDetail } from "../domain/customer";
import type { CustomerPage } from "../application/customer.input";

type Presented<T> = T & { statusLabel: string };
export function presentCustomer(row: CustomerDetail): Presented<CustomerDetail>;
export function presentCustomer(
  row: CustomerSummary,
): Presented<CustomerSummary>;
export function presentCustomer(
  row: CustomerSummary | CustomerDetail,
): Presented<CustomerSummary> {
  const { id, code, name, phone, email, note, status, createdAt, updatedAt } =
    row;
  return {
    id,
    code,
    name,
    phone,
    email,
    note,
    status,
    createdAt,
    updatedAt,
    statusLabel: CustomerStatusLabelsVi[status],
    ...("addresses" in row ? { addresses: row.addresses } : {}),
  };
}
export function presentCustomerPage(page: CustomerPage) {
  return {
    ...page,
    customers: page.customers.map((row) => presentCustomer(row)),
  };
}
