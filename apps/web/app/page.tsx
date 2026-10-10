import Link from "next/link";
import { Panel } from "@nexora/ui";
export default function Home() {
  return (
    <>
      <p className="eyebrow">KHÔNG GIAN LÀM VIỆC</p>
      <h1>
        Quản lý vận đơn,
        <br />
        từ dữ liệu gốc.
      </h1>
      <p className="intro">
        Nền tảng quản lý kiện hàng, mã vận đơn và trạng thái vận chuyển độc lập.
      </p>
      <div className="notice">
        Bản nền tảng · Chức năng nghiệp vụ vận đơn chưa triển khai.
      </div>
      <div className="grid">
        <Panel title="01 · Khách hàng & Vận đơn">
          <p>
            Nhập thủ công hoặc import Excel danh sách kiện hàng và khách hàng.
          </p>
          <span className="muted">Chưa triển khai</span>
        </Panel>
        <Panel title="02 · Theo dõi & Lịch sử">
          <p>
            Tra cứu mã vận đơn, lịch sử trạng thái, cân nặng và cước ước tính.
          </p>
          <span className="muted">Chưa triển khai</span>
        </Panel>
        <Panel title="03 · Đồng bộ nhà vận chuyển">
          <p>Đồng bộ có điều kiện với hệ thống đối tác khi có ủy quyền API.</p>
          <span className="muted">Chưa triển khai</span>
        </Panel>
      </div>
      <Panel title="Kiểm tra kết nối">
        <p>
          Xem trạng thái dịch vụ, cơ sở dữ liệu và nơi lưu file trước khi bắt
          đầu.
        </p>
        <Link className="button" href="/system">
          Xem trạng thái hệ thống →
        </Link>
      </Panel>
    </>
  );
}
