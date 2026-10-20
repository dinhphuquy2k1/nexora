import { Injectable, HttpException } from "@nestjs/common";
import { CustomerPort } from "./customer.port";
import { resolveCustomerOwner } from "./customer-owner";
import {
  addressInput,
  customerInput,
  listQuery,
  uuid,
  record,
  CustomerError,
  type AddressCreate,
  type CustomerFields,
} from "../domain/customer";
@Injectable()
export class CustomerService {
  constructor(private readonly port: CustomerPort) {}
  private async run<T>(
    actor: { id: string },
    action: (owner: string) => Promise<T>,
  ): Promise<T> {
    try {
      return await action(resolveCustomerOwner(actor));
    } catch (e) {
      if (!(e instanceof CustomerError)) throw e;
      const statuses = {
        VALIDATION_ERROR: 400,
        UNAUTHORIZED: 401,
        NOT_FOUND: 404,
        CUSTOMER_PHONE_EXISTS: 409,
      };
      throw new HttpException(
        { code: e.code, message: "Không thể thực hiện yêu cầu" },
        statuses[e.code],
      );
    }
  }
  list(actor: { id: string }, query: unknown) {
    return this.run(actor, (owner) => this.port.list(owner, listQuery(query)));
  }
  create(actor: { id: string }, input: unknown) {
    return this.run(actor, async (owner) => {
      const fields = customerInput(input) as CustomerFields;
      const body = input as Record<string, unknown>;
      const address = Object.hasOwn(body, "address")
        ? (addressInput(body.address, fields) as AddressCreate)
        : undefined;
      return { customer: await this.port.create(owner, fields, address) };
    });
  }
  get(actor: { id: string }, id: string) {
    return this.run(actor, async (owner) => ({
      customer: await this.port.get(owner, uuid(id)),
    }));
  }
  update(actor: { id: string }, id: string, input: unknown) {
    return this.run(actor, async (owner) => ({
      customer: await this.port.update(
        owner,
        uuid(id),
        customerInput(input, true),
      ),
    }));
  }
  addAddress(actor: { id: string }, id: string, input: unknown) {
    return this.run(actor, async (owner) => ({
      address: await this.port.addAddress(
        owner,
        uuid(id),
        addressInput(input) as AddressCreate,
      ),
    }));
  }
  updateAddress(
    actor: { id: string },
    id: string,
    addressId: string,
    input: unknown,
  ) {
    return this.run(actor, async (owner) => ({
      address: await this.port.updateAddress(
        owner,
        uuid(id),
        uuid(addressId),
        addressInput(input, undefined, true),
      ),
    }));
  }
  removeAddress(actor: { id: string }, id: string, addressId: string) {
    return this.run(actor, async (owner) => {
      await this.port.removeAddress(owner, uuid(id), uuid(addressId));
      return { success: true };
    });
  }
  setDefault(actor: { id: string }, id: string, input: unknown) {
    return this.run(actor, async (owner) => {
      const body = record(input, ["addressId"]);
      return {
        address: await this.port.setDefault(
          owner,
          uuid(id),
          uuid(body.addressId),
        ),
      };
    });
  }
}
