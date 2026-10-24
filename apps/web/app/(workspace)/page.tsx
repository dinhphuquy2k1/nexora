import { cookies } from "next/headers";
import Link from "next/link";
import { FOUNDATION_VERSION } from "@nexora/shared";
import { Panel } from "@nexora/ui";
import { getCachedServerSession } from "../../lib/api/session.ts";

export const dynamic = "force-dynamic";

export default async function Home() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get("nexora_session")?.value;
  const result = await getCachedServerSession(sessionToken);

  if (result.status !== "authenticated") {
    return null;
  }

  return (
    <>
      <div className="page-header">
        <p className="eyebrow">KHÔNG GIAN LÀM VIỆC</p>
        <h1>Tổng quan</h1>
        <p className="intro">
          Quản lý vận đơn, trạng thái nền tảng và kiện hàng.
        </p>
      </div>

      <div className="notice">
        Bản nền tảng v{FOUNDATION_VERSION} · Chức năng nghiệp vụ vận đơn đang
        được hoạch định (ADR-002).
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
