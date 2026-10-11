import Link from "next/link";
import { Panel } from "@nexora/ui";

export default function Home() {
  return (
    <>
      <div style={{ marginBottom: "20px" }}>
        <p className="eyebrow">KHÔNG GIAN LÀM VIỆC</p>
        <h1>Tổng quan</h1>
        <p className="intro">Quản lý vận đơn và trạng thái nền tảng.</p>
      </div>

      <div className="notice">
        Bản nền tảng v0.1.0 · Chức năng nghiệp vụ vận đơn đang được hoạch định
        (ADR-002).
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
          <p>
            Đồng bộ có điều kiện với hệ thống đối tác khi có ủy quyền API chính
            thức.
          </p>
          <span className="muted">Chưa triển khai</span>
        </Panel>
      </div>

      <Panel title="Kiểm tra kết nối và trạng thái vận hành">
        <p>
          Xem trạng thái các dịch vụ API, cơ sở dữ liệu và nơi lưu trữ tệp cục
          bộ trước khi bắt đầu.
        </p>
        <Link className="button" href="/system">
          Xem trạng thái hệ thống →
        </Link>
      </Panel>
    </>
  );
}
