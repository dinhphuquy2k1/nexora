import type {
  AddressFields,
  AddressCreate,
  CustomerAddress,
  CustomerFields,
} from "./customer";
import {
  normalizeAddressCreate,
  normalizeAddressPatch,
} from "./customer.value-objects";
export type CustomerAddressState = Omit<
  CustomerAddress,
  "id" | "createdAt" | "updatedAt"
> & { id: string | null; createdAt: Date | null; updatedAt: Date | null };
export type AddressWrite = AddressFields & { isDefault: boolean };
const copy = (state: CustomerAddressState): CustomerAddressState => ({
  ...state,
  createdAt: state.createdAt && new Date(state.createdAt),
  updatedAt: state.updatedAt && new Date(state.updatedAt),
});
/** Child entity. The aggregate alone retains references and chooses default policy. */
export class CustomerAddressEntity {
  readonly #state: CustomerAddressState;
  private constructor(state: CustomerAddressState) {
    this.#state = copy(state);
  }
  static create(
    input: AddressCreate,
    fallback: CustomerFields,
    isDefault: boolean,
  ): CustomerAddressEntity {
    return new CustomerAddressEntity({
      ...normalizeAddressCreate(input, fallback),
      id: null,
      createdAt: null,
      updatedAt: null,
      isDefault,
    });
  }
  static rehydrate(state: CustomerAddress): CustomerAddressEntity {
    return new CustomerAddressEntity(state);
  }
  get id(): string | null {
    return this.#state.id;
  }
  get isDefault(): boolean {
    return this.#state.isDefault;
  }
  fields(): AddressFields {
    const s = this.#state;
    return {
      label: s.label,
      recipientName: s.recipientName,
      recipientPhone: s.recipientPhone,
      countryCode: s.countryCode,
      addressText: s.addressText,
    };
  }
  snapshot(): CustomerAddressState {
    return copy(this.#state);
  }
  update(input: Partial<AddressFields>): {
    entity: CustomerAddressEntity;
    patch: Partial<AddressFields>;
  } {
    const patch = normalizeAddressPatch(input);
    return {
      entity: new CustomerAddressEntity({ ...this.#state, ...patch }),
      patch,
    };
  }
  withDefault(isDefault: boolean): CustomerAddressEntity {
    return new CustomerAddressEntity({ ...this.#state, isDefault });
  }
}
