import { CustomerStatus, type CustomerStatusCode } from "./customer-status";

export const CustomerStatusLabelsVi = {
  [CustomerStatus.ACTIVE]: "Đang hoạt động",
  [CustomerStatus.INACTIVE]: "Ngừng hoạt động",
} as const satisfies Record<CustomerStatusCode, string>;
