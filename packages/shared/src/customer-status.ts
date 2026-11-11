export const CustomerStatus = {
  ACTIVE: "ACTIVE",
  INACTIVE: "INACTIVE",
} as const;
export type CustomerStatusCode =
  (typeof CustomerStatus)[keyof typeof CustomerStatus];

const customerStatusValues: ReadonlySet<string> = new Set(
  Object.values(CustomerStatus),
);

export function isCustomerStatus(value: unknown): value is CustomerStatusCode {
  return typeof value === "string" && customerStatusValues.has(value);
}
