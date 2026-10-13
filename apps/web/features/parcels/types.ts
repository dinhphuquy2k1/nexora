export type ParcelStatus =
  | "all"
  | "incoming_departure"
  | "received_departure"
  | "in_transit"
  | "received_destination"
  | "delivered"
  | "claim";

export interface StatusTabConfig {
  readonly key: ParcelStatus;
  readonly label: string;
}

export const STATUS_TABS: readonly StatusTabConfig[] = [
  { key: "all", label: "Tất cả" },
  { key: "incoming_departure", label: "Đang đến kho gửi" },
  { key: "received_departure", label: "Đã về kho gửi" },
  { key: "in_transit", label: "Đang về kho nhận" },
  { key: "received_destination", label: "Đã về kho nhận" },
  { key: "delivered", label: "Đã giao hàng" },
  { key: "claim", label: "Khiếu nại" },
] as const;

export interface ParcelItem {
  readonly id: string;
  readonly trackingNumber: string;
  readonly productName: string;
  readonly status: Exclude<ParcelStatus, "all">;
  readonly statusLabel: string;
  readonly departureInboundDate: string | null;
  readonly departureOutboundDate: string | null;
  readonly destinationInboundDate: string | null;
  readonly destinationOutboundDate: string | null;
  readonly weightKg: number;
  readonly unitPrice: number;
  readonly domesticShippingFee: number;
  readonly declaredValue: number;
  readonly packageCount: number;
  readonly itemCount: number;
  readonly hasInsurance: boolean;
  readonly hasInspection: boolean;
  readonly hasWoodenCrate: boolean;
  readonly hasBubbleWrap: boolean;
  readonly totalAmount: number;
  readonly note?: string;
}
