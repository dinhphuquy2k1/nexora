export type ParcelColumnKey =
  | "trackingNumber"
  | "productName"
  | "status"
  | "weightKg"
  | "totalAmount"
  | "packageCount"
  | "itemCount"
  | "unitPrice"
  | "domesticShippingFee"
  | "declaredValue"
  | "insurance"
  | "inspection"
  | "woodenCrate"
  | "bubbleWrap"
  | "departureInboundDate"
  | "departureOutboundDate"
  | "destinationInboundDate"
  | "destinationOutboundDate";

export interface ParcelColumnDef {
  readonly id: ParcelColumnKey;
  readonly label: string;
  readonly defaultVisible: boolean;
  readonly isRequired?: boolean;
}

export const PARCEL_COLUMNS: readonly ParcelColumnDef[] = [
  {
    id: "trackingNumber",
    label: "Mã vận đơn",
    defaultVisible: true,
    isRequired: true,
  },
  {
    id: "productName",
    label: "Tên sản phẩm",
    defaultVisible: true,
  },
  {
    id: "status",
    label: "Trạng thái",
    defaultVisible: true,
  },
  {
    id: "weightKg",
    label: "Cân nặng (kg)",
    defaultVisible: true,
  },
  {
    id: "totalAmount",
    label: "Tổng tiền",
    defaultVisible: true,
  },
  {
    id: "packageCount",
    label: "Số kiện",
    defaultVisible: true,
  },
  {
    id: "itemCount",
    label: "Số sản phẩm",
    defaultVisible: true,
  },
  {
    id: "unitPrice",
    label: "Đơn giá",
    defaultVisible: false,
  },
  {
    id: "domesticShippingFee",
    label: "Ship nội địa",
    defaultVisible: false,
  },
  {
    id: "declaredValue",
    label: "Giá trị hàng",
    defaultVisible: false,
  },
  {
    id: "insurance",
    label: "Bảo hiểm",
    defaultVisible: false,
  },
  {
    id: "inspection",
    label: "Kiểm đếm",
    defaultVisible: false,
  },
  {
    id: "woodenCrate",
    label: "Đóng gỗ",
    defaultVisible: false,
  },
  {
    id: "bubbleWrap",
    label: "Bọt khí",
    defaultVisible: false,
  },
  {
    id: "departureInboundDate",
    label: "Ngày nhập kho gửi",
    defaultVisible: false,
  },
  {
    id: "departureOutboundDate",
    label: "Ngày xuất kho gửi",
    defaultVisible: false,
  },
  {
    id: "destinationInboundDate",
    label: "Ngày nhập kho nhận",
    defaultVisible: false,
  },
  {
    id: "destinationOutboundDate",
    label: "Ngày xuất kho nhận",
    defaultVisible: false,
  },
] as const;

export const COLUMN_KEY_SET = new Set<ParcelColumnKey>(
  PARCEL_COLUMNS.map((c) => c.id),
);

export const DEFAULT_VISIBLE_COLUMNS: readonly ParcelColumnKey[] =
  PARCEL_COLUMNS.filter((c) => c.defaultVisible).map((c) => c.id);

export const PARCELS_COLUMNS_STORAGE_KEY = "nexora.parcels.columns.v1";

/**
 * Pure parser for stored column preferences.
 * Safely handles null, invalid JSON, unknown keys, and preserves trackingNumber invariant.
 */
export function parseStoredColumns(
  raw: string | null | undefined,
): Set<ParcelColumnKey> {
  const fallback = new Set<ParcelColumnKey>(DEFAULT_VISIBLE_COLUMNS);
  if (!raw || typeof raw !== "string") {
    return fallback;
  }

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return fallback;
    }

    const validKeys = parsed.filter(
      (key): key is ParcelColumnKey =>
        typeof key === "string" && COLUMN_KEY_SET.has(key as ParcelColumnKey),
    );

    // Prevent zero-column configurations or missing required trackingNumber
    if (validKeys.length === 0) {
      return fallback;
    }

    const result = new Set<ParcelColumnKey>(validKeys);
    // Invariant: trackingNumber must always remain visible
    result.add("trackingNumber");

    return result;
  } catch {
    return fallback;
  }
}

/**
 * Serializes visible column preferences for localStorage.
 */
export function serializeColumns(keys: Set<ParcelColumnKey>): string {
  // Always include trackingNumber
  const safeKeys = new Set(keys);
  safeKeys.add("trackingNumber");
  return JSON.stringify(Array.from(safeKeys));
}

/**
 * Returns column definitions in original canonical order filtered by visibility.
 */
export function getOrderedVisibleColumns(
  visibleKeys: Set<ParcelColumnKey>,
): ParcelColumnDef[] {
  return PARCEL_COLUMNS.filter((col) => visibleKeys.has(col.id));
}
