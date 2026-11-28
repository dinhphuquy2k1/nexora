/** Confirmed reconnect only; never retain credentials, provider bodies or a cause. */
export class CarrierPartialEditError extends Error {
  readonly reconnectSucceeded = true;
  constructor(
    readonly renameOutcome: "rejected" | "unknown",
    readonly sessionExpired = false,
  ) {
    super(
      "Mật khẩu kết nối đã được cập nhật, nhưng chưa xác nhận lưu tên gợi nhớ thành công.",
    );
  }
}
