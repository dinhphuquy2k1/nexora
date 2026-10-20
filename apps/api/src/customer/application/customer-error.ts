import { HttpException, HttpStatus } from "@nestjs/common";
import { CustomerError } from "../domain/customer";

interface CustomerErrorMapping {
  readonly status: HttpStatus;
  readonly message: string;
}

export const CUSTOMER_ERROR_MAP = {
  VALIDATION_ERROR: {
    status: HttpStatus.BAD_REQUEST,
    message: "Không thể thực hiện yêu cầu",
  },
  UNAUTHORIZED: {
    status: HttpStatus.UNAUTHORIZED,
    message: "Không thể thực hiện yêu cầu",
  },
  NOT_FOUND: {
    status: HttpStatus.NOT_FOUND,
    message: "Không thể thực hiện yêu cầu",
  },
  CUSTOMER_PHONE_EXISTS: {
    status: HttpStatus.CONFLICT,
    message: "Không thể thực hiện yêu cầu",
  },
  LAST_CUSTOMER_ADDRESS: {
    status: HttpStatus.CONFLICT,
    message: "Không thể xóa địa chỉ cuối cùng của khách hàng.",
  },
  DEFAULT_ADDRESS_REASSIGN_REQUIRED: {
    status: HttpStatus.CONFLICT,
    message: "Cần chuyển địa chỉ mặc định trước khi xóa.",
  },
} as const satisfies Record<CustomerError["code"], CustomerErrorMapping>;

export function mapCustomerError(error: CustomerError): HttpException {
  const mapping = CUSTOMER_ERROR_MAP[error.code];
  return new HttpException(
    { code: error.code, message: mapping.message },
    mapping.status,
  );
}
