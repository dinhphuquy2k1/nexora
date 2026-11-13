import { HttpException, HttpStatus } from "@nestjs/common";
import { GENERIC_ERROR_MESSAGE } from "../../common/http/error-messages";
import type { ShipmentError } from "../domain/shipment";
const errors: Record<
  ShipmentError["code"],
  { status: HttpStatus; message: string }
> = {
  VALIDATION_ERROR: {
    status: HttpStatus.BAD_REQUEST,
    message: GENERIC_ERROR_MESSAGE,
  },
  UNAUTHORIZED: {
    status: HttpStatus.UNAUTHORIZED,
    message: GENERIC_ERROR_MESSAGE,
  },
  NOT_FOUND: { status: HttpStatus.NOT_FOUND, message: GENERIC_ERROR_MESSAGE },
  CLAIM_FILTER_UNAVAILABLE: {
    status: HttpStatus.SERVICE_UNAVAILABLE,
    message: GENERIC_ERROR_MESSAGE,
  },
};
export function mapShipmentError(error: ShipmentError): HttpException {
  const { status, message } = errors[error.code];
  return new HttpException({ code: error.code, message }, status);
}
