import type {
  AddressCreate,
  AddressFields,
  CustomerAddress,
  CustomerDetail,
  CustomerFields,
  CustomerPage,
  CustomerPatch,
  CustomerQuery,
} from "../domain/customer";
export abstract class CustomerPort {
  abstract list(owner: string, query: CustomerQuery): Promise<CustomerPage>;
  abstract create(
    owner: string,
    input: CustomerFields,
    address: AddressCreate,
  ): Promise<CustomerDetail>;
  abstract get(owner: string, id: string): Promise<CustomerDetail>;
  abstract update(
    owner: string,
    id: string,
    input: CustomerPatch,
  ): Promise<CustomerDetail>;
  abstract addAddress(
    owner: string,
    id: string,
    input: AddressCreate,
  ): Promise<CustomerAddress>;
  abstract updateAddress(
    owner: string,
    id: string,
    addressId: string,
    input: Partial<AddressFields>,
  ): Promise<CustomerAddress>;
  abstract removeAddress(
    owner: string,
    id: string,
    addressId: string,
  ): Promise<void>;
  abstract setDefault(
    owner: string,
    id: string,
    addressId: string,
  ): Promise<CustomerAddress>;
}
