import { Panel } from "@nexora/ui";
import { FOUNDATION_VERSION } from "@nexora/shared";
export default function Settings() {
  return (
    <>
      <p className="eyebrow">THIẾT LẬP</p>
      <h1>Cài đặt</h1>
      <Panel title="Ứng dụng">
        <dl>
          <dt>Phiên bản</dt>
          <dd>{FOUNDATION_VERSION}</dd>
          <dt>Ngôn ngữ</dt>
          <dd>Tiếng Việt</dd>
          <dt>Chế độ</dt>
          <dd>Cục bộ, một máy</dd>
        </dl>
      </Panel>
      <Panel title="Tính năng sẽ bổ sung">
        <p>
          Quản lý kiện hàng, khách hàng, mã vận đơn và tích hợp đối tác vận
          chuyển: <strong>Chưa triển khai</strong>.
        </p>
        <p>
          Khóa kết nối và phiên làm việc sẽ được quản lý an toàn phía server.
          Không có kết nối đối tác không chặn trạng thái sẵn sàng.
        </p>
      </Panel>
      <div className="notice">
        Chưa có đăng nhập hay phân quyền. Không đưa bản này lên Internet.
      </div>
    </>
  );
}
