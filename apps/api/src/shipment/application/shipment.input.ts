import { parsePagination } from "@nexora/shared/validation";
import {
  LogisticsStage,
  type LogisticsStageCode,
} from "@nexora/shared/shipment";
import { isUuid } from "../../common/validation/uuid";
import { ShipmentError, invalid, shipmentRecord } from "../domain/shipment";
import type { ShipmentQuery } from "./shipment-read.port";
export function shipmentId(value: unknown): string {
  if (!isUuid(value)) invalid();
  return value.toLowerCase();
}
export function shipmentQuery(input: unknown, history = false): ShipmentQuery {
  const raw = shipmentRecord(
    input,
    history
      ? ["page", "pageSize"]
      : ["page", "pageSize", "q", "stage", "claim"],
  );
  const page = parsePagination(raw.page, raw.pageSize);
  if (!page) invalid();
  const query: ShipmentQuery = { page: page.page, pageSize: page.pageSize };
  if (Object.hasOwn(raw, "q")) {
    if (typeof raw.q !== "string" || raw.q.length > 256 || raw.q.includes("\0"))
      invalid();
    query.q = raw.q;
  }
  if (Object.hasOwn(raw, "stage")) {
    if (
      !Object.values(LogisticsStage).includes(raw.stage as LogisticsStageCode)
    )
      invalid();
    query.stage = raw.stage as LogisticsStageCode;
  }
  if (Object.hasOwn(raw, "claim")) {
    if (raw.claim !== "open") invalid();
    throw new ShipmentError("CLAIM_FILTER_UNAVAILABLE");
  }
  return query;
}
