import { CustomerStatusVO } from "./customer-status.vo";
import { changeCustomerProfile } from "./customer-profile.policy";
import {
  CustomerError,
  type CustomerStatusCode,
  assertAddressDeletion,
  invalid,
  type CustomerDetail,
  type CustomerFields,
  type CustomerPatch,
  type AddressFields,
  type AddressCreate,
} from "./customer";
import {
  CustomerAddressEntity,
  type CustomerAddressState,
  type AddressWrite,
} from "./customer-address.entity";
import { normalizeCustomerFields } from "./customer.value-objects";
export type CustomerIdentity = Pick<
  CustomerDetail,
  "id" | "code" | "createdAt" | "updatedAt"
> & { ownerUserId: string; createdByUserId: string };
export type CustomerSnapshot = CustomerDetail & {
  ownerUserId: string;
  createdByUserId: string;
};
export interface CustomerAggregateState {
  identity: CustomerIdentity | null;
  profile: CustomerFields;
  status: CustomerStatusCode;
  addresses: CustomerAddressState[];
}
const copyIdentity = (
  identity: CustomerIdentity | null,
): CustomerIdentity | null =>
  identity && {
    ...identity,
    createdAt: new Date(identity.createdAt),
    updatedAt: new Date(identity.updatedAt),
  };
export class CustomerAggregate {
  readonly #identity: CustomerIdentity | null;
  #profile: CustomerFields;
  #status: CustomerStatusVO;
  #addresses: CustomerAddressEntity[];
  private constructor(
    identity: CustomerIdentity | null,
    profile: CustomerFields,
    status: CustomerStatusVO,
    addresses: CustomerAddressEntity[],
  ) {
    this.#identity = copyIdentity(identity);
    this.#profile = { ...profile };
    this.#status = status;
    this.#addresses = [...addresses];
  }
  static create(
    fields: CustomerFields,
    initialAddress: AddressCreate,
  ): CustomerAggregate {
    const customer = new CustomerAggregate(
      null,
      normalizeCustomerFields(fields),
      CustomerStatusVO.initial(),
      [],
    );
    customer.addAddress(initialAddress);
    return customer;
  }
  /** Hydrate historical cardinality as-is. Only explicit operations repair it. */
  static rehydrate(
    row: Omit<CustomerSnapshot, "status"> & { status: unknown },
  ): CustomerAggregate {
    const {
      id,
      code,
      ownerUserId,
      createdByUserId,
      createdAt,
      updatedAt,
      name,
      phone,
      email,
      note,
      status,
      addresses,
    } = row;
    return new CustomerAggregate(
      { id, code, ownerUserId, createdByUserId, createdAt, updatedAt },
      { name, phone, email, note },
      CustomerStatusVO.from(status),
      addresses.map((a) => CustomerAddressEntity.rehydrate(a)),
    );
  }
  snapshot(): CustomerAggregateState {
    return {
      identity: copyIdentity(this.#identity),
      profile: { ...this.#profile },
      status: this.#status.value,
      addresses: this.#addresses.map((a) => a.snapshot()),
    };
  }
  creation(): {
    fields: CustomerFields;
    address: AddressFields;
    status: CustomerStatusCode;
    isDefault: true;
  } {
    if (
      this.#identity ||
      this.#addresses.length !== 1 ||
      !this.#addresses[0].isDefault
    )
      invalid();
    return {
      fields: { ...this.#profile },
      address: this.#addresses[0].fields(),
      status: this.#status.value,
      isDefault: true,
    };
  }
  updateProfile(input: CustomerPatch): CustomerPatch {
    const patch = changeCustomerProfile(this.#status.value, input);
    const { status, ...fields } = patch;
    this.#profile = { ...this.#profile, ...fields };
    if (status !== undefined) this.#status = CustomerStatusVO.from(status);
    return { ...patch };
  }
  addAddress(input: AddressCreate): AddressWrite {
    const entity = CustomerAddressEntity.create(
      input,
      this.#profile,
      !this.#addresses.some((a) => a.isDefault),
    );
    this.#addresses.push(entity);
    return { ...entity.fields(), isDefault: entity.isDefault };
  }
  private address(id: string): CustomerAddressEntity {
    const entity = this.#addresses.find((a) => a.id === id);
    if (!entity) throw new CustomerError("NOT_FOUND");
    return entity;
  }
  updateAddress(
    id: string,
    input: Partial<AddressFields>,
  ): Partial<AddressFields> {
    const entity = this.address(id),
      result = entity.update(input);
    this.#addresses[this.#addresses.indexOf(entity)] = result.entity;
    return { ...result.patch };
  }
  removeAddress(id: string): void {
    const entity = this.address(id);
    assertAddressDeletion(this.#addresses.length, entity.isDefault);
    this.#addresses = this.#addresses.filter((a) => a !== entity);
  }
  setDefaultAddress(id: string): boolean {
    const selected = this.address(id);
    if (selected.isDefault) return false;
    this.#addresses = this.#addresses.map((a) => a.withDefault(a === selected));
    return true;
  }
}
