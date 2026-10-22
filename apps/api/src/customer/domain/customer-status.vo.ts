import {
  CustomerStatus,
  type CustomerStatusCode,
} from "@nexora/shared/customer-status";
import { invalid } from "./customer";

export class CustomerStatusVO {
  private constructor(readonly value: CustomerStatusCode) {
    Object.freeze(this);
  }
  static from(value: unknown): CustomerStatusVO {
    if (!Object.values(CustomerStatus).includes(value as CustomerStatusCode))
      invalid();
    return new CustomerStatusVO(value as CustomerStatusCode);
  }
  static initial(): CustomerStatusVO {
    return CustomerStatusVO.from(CustomerStatus.ACTIVE);
  }
  equals(other: CustomerStatusVO): boolean {
    return this.value === other.value;
  }
}
