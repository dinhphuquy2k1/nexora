import { deploymentPresentation } from "../../../lib/auth/deployment-presentation.ts";
import { cookies } from "next/headers";
import { Panel } from "@nexora/ui";
import { FOUNDATION_VERSION } from "@nexora/shared";
import { getCachedServerSession } from "../../../lib/api/session.ts";

export const dynamic = "force-dynamic";

export default async function Settings() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get("nexora_session")?.value;
  const result = await getCachedServerSession(sessionToken);

  if (result.status !== "authenticated") {
    return null;
  }

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
          <dd>{deploymentPresentation().badge}, một máy</dd>
        </dl>
      </Panel>
      <Panel title="Tính năng sẽ bổ sung">
        <p>
          Quản lý kiện hàng, khách hàng, mã vận đơn và tích hợp đối tác vận
          chuyển: <strong>Chưa triển khai</strong>.
        </p>
        <p>
          Khóa kết nối và phiên làm việc được quản lý an toàn phía server. Không
          có kết nối đối tác không chặn trạng thái sẵn sàng.
        </p>
      </Panel>
      <div className="notice">
        Đăng nhập Nexora độc lập với tài khoản vận chuyển. Quản trị viên cần xác
        thực hai bước.
      </div>
    </>
  );
}
