export const CustomerStatus = {
  ACTIVE: "ACTIVE",
  INACTIVE: "INACTIVE",
} as const;
export type CustomerStatus =
  (typeof CustomerStatus)[keyof typeof CustomerStatus];
export class CustomerError extends Error {
  constructor(
    readonly code:
      | "VALIDATION_ERROR"
      | "UNAUTHORIZED"
      | "NOT_FOUND"
      | "CUSTOMER_PHONE_EXISTS"
      | "LAST_CUSTOMER_ADDRESS"
      | "DEFAULT_ADDRESS_REASSIGN_REQUIRED",
  ) {
    super(code);
  }
}
export function invalid(): never {
  throw new CustomerError("VALIDATION_ERROR");
}
export interface CustomerFields {
  name: string;
  phone: string;
  email?: string | null;
  note?: string | null;
}
export type CustomerPatch = Partial<CustomerFields> & {
  status?: CustomerStatus;
};
export type CustomerCreate = CustomerFields & { address: AddressCreate };
export interface AddressFields {
  label: string | null;
  recipientName: string;
  recipientPhone: string;
  countryCode: string;
  addressText: string;
}
export interface AddressCreate {
  addressText: string;
  label?: string | null;
  countryCode?: string;
  recipientName?: string;
  recipientPhone?: string;
}
export function assertAddressDeletion(count: number, isDefault: boolean): void {
  if (count <= 1) throw new CustomerError("LAST_CUSTOMER_ADDRESS");
  if (isDefault) throw new CustomerError("DEFAULT_ADDRESS_REASSIGN_REQUIRED");
}
export interface CustomerSummary extends CustomerFields {
  id: string;
  code: string;
  status: CustomerStatus;
  createdAt: Date;
  updatedAt: Date;
  email: string | null;
  note: string | null;
}
export interface CustomerAddress extends AddressFields {
  id: string;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}
export interface CustomerDetail extends CustomerSummary {
  addresses: CustomerAddress[];
}
