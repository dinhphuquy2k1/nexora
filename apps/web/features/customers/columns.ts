/** The one header/body/Skeleton sizing contract. Widths include cell gutters and 32px actions. */
export const customerColumns = [
  { key: "detail", label: "CHI TIẾT", width: 80 },
  { key: "code", label: "MÃ KHÁCH HÀNG", width: 144 },
  { key: "name", label: "HỌ VÀ TÊN", width: undefined, minimum: 200 },
  { key: "phone", label: "SỐ ĐIỆN THOẠI", width: 152 },
  { key: "email", label: "EMAIL", width: 200 },
  { key: "addresses", label: "SỐ ĐỊA CHỈ", width: 104 },
  { key: "status", label: "TRẠNG THÁI", width: 156 },
  { key: "created", label: "NGÀY TẠO", width: 128 },
  { key: "actions", label: "THAO TÁC", width: 104 },
] as const;
export const customerTableMinWidth =
  Math.ceil(
    customerColumns.reduce((total, c) => total + (c.width ?? c.minimum), 0) / 8,
  ) * 8;
