export const CustomerStatus = {
  ACTIVE: "ACTIVE",
  INACTIVE: "INACTIVE",
} as const;
export type CustomerStatusCode =
  (typeof CustomerStatus)[keyof typeof CustomerStatus];
