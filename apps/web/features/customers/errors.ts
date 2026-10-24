export class CustomerApiError extends Error {
  status: number;
  code: string;
  requestId?: string;
  constructor(status: number, body: unknown) {
    super("Không thể hoàn tất yêu cầu.");
    this.status = status;
    const b = body as Record<string, unknown> | null;
    this.code = typeof b?.code === "string" ? b.code : "";
    if (
      typeof b?.requestId === "string" &&
      /^[A-Za-z0-9-]{1,100}$/.test(b.requestId)
    )
      this.requestId = b.requestId;
  }
}
export function customerError(error: unknown): {
  message: string;
  field?: string;
  unauthenticated?: boolean;
  notFound?: boolean;
  requestId?: string;
} {
  if (!(error instanceof CustomerApiError))
    return {
      message:
        "Không kết nối được hoặc phản hồi không hợp lệ. Vui lòng tải lại trước khi thử lại thao tác.",
    };
  const base = { requestId: error.requestId };
  if (error.status === 401)
    return {
      ...base,
      message: "Phiên đăng nhập đã hết hạn.",
      unauthenticated: true,
    };
  if (error.status === 404)
    return {
      ...base,
      message: "Không tìm thấy khách hàng hoặc địa chỉ.",
      notFound: true,
    };
  if (error.status === 403)
    return {
      ...base,
      message:
        "Yêu cầu bị từ chối. Kiểm tra quyền truy cập hoặc nguồn gửi yêu cầu.",
    };
  if (error.status === 409) {
    switch (error.code) {
      case "CUSTOMER_PHONE_EXISTS":
        return {
          ...base,
          message: "Số điện thoại đã được sử dụng cho khách hàng khác.",
          field: "phone",
        };
      case "LAST_CUSTOMER_ADDRESS":
        return { ...base, message: "Không thể xóa địa chỉ cuối cùng." };
      case "DEFAULT_ADDRESS_REASSIGN_REQUIRED":
        return {
          ...base,
          message: "Cần chuyển địa chỉ mặc định trước khi xóa.",
        };
      default:
        return { ...base, message: "Dữ liệu đã thay đổi. Vui lòng tải lại." };
    }
  }
  if (error.status === 400)
    return {
      ...base,
      message: "Thông tin chưa hợp lệ. Kiểm tra các trường và giới hạn độ dài.",
    };
  return {
    ...base,
    message:
      "Dịch vụ tạm thời không khả dụng. Vui lòng tải lại trước khi thử lại thao tác.",
  };
}
