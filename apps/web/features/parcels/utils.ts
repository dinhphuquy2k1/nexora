import type { ParcelStatus } from "./types.ts";

export function formatVnd(amount: number): string {
  return new Intl.NumberFormat("vi-VN").format(amount) + " ₫";
}

export function formatWeight(kg: number): string {
  return `${kg
    .toFixed(2)
    .replace(/\.00$/, "")
    .replace(/(\.[1-9])0$/, "$1")} kg`;
}

export function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  return dateStr;
}

export type StatusToneKey =
  | "toneIncomingDeparture"
  | "toneReceivedDeparture"
  | "toneInTransit"
  | "toneReceivedDestination"
  | "toneDelivered"
  | "toneClaim";

export function getStatusToneKey(
  status: Exclude<ParcelStatus, "all">,
): StatusToneKey {
  switch (status) {
    case "incoming_departure":
      return "toneIncomingDeparture";
    case "received_departure":
      return "toneReceivedDeparture";
    case "in_transit":
      return "toneInTransit";
    case "received_destination":
      return "toneReceivedDestination";
    case "delivered":
      return "toneDelivered";
    case "claim":
      return "toneClaim";
    default:
      return "toneIncomingDeparture";
  }
}
