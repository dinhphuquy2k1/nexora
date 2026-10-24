import type { components, paths } from "@nexora/sdk";
export type Customer = components["schemas"]["CustomerDetailDto"];
export type Summary = components["schemas"]["CustomerSummaryDto"];
export type Address = components["schemas"]["CustomerAddressDto"];
export type CustomerPage = components["schemas"]["CustomersResponseDto"];
export type Stats = components["schemas"]["CustomerStatsDto"];
export type Create = components["schemas"]["CreateCustomerDto"];
export type Patch = components["schemas"]["PatchCustomerDto"];
export type AddressCreate = components["schemas"]["AddressInputDto"];
export type AddressPatch = components["schemas"]["AddressPatchDto"];
export type Query = NonNullable<
  paths["/api/customers"]["get"]["parameters"]["query"]
> & { page: number; pageSize: number };
export type ProfileDraft = {
  name: string;
  phone: string;
  email: string;
  note: string;
  status?: Summary["status"];
};
export type AddressDraft = {
  label: string;
  recipientName: string;
  recipientPhone: string;
  countryCode: string;
  addressText: string;
};
