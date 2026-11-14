export class ShipmentApiError extends Error {
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
export function shipmentError(error: unknown) {
  if (error instanceof ShipmentApiError) {
    if (error.status === 401)
      return {
        message: "Phiên đăng nhập đã hết hạn.",
        denied: true,
        notFound: false,
      };
    if (error.status === 403)
      return {
        message: "Yêu cầu bị từ chối. Kiểm tra quyền truy cập.",
        denied: true,
        notFound: false,
      };
    if (error.status === 404)
      return {
        message: "Không tìm thấy kiện hàng.",
        denied: false,
        notFound: true,
      };
  }
  return {
    message: "Không thể tải dữ liệu kiện hàng. Vui lòng thử lại.",
    denied: false,
    notFound: false,
  };
}
