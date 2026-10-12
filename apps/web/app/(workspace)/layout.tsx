import type { ReactNode } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { AppShell } from "../../components/app-shell/AppShell.tsx";
import { verifyServerSession } from "../../lib/api/session.ts";
import { sanitizeReturnUrl } from "../../lib/auth/sanitize.ts";
import styles from "./workspace-layout.module.css";

interface WorkspaceLayoutProps {
  children: ReactNode;
}

export default async function WorkspaceLayout({
  children,
}: WorkspaceLayoutProps) {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get("nexora_session")?.value;

  const result = await verifyServerSession(sessionToken);

  if (result.status === "unauthenticated") {
    const headerList = await headers();
    const currentPath = headerList.get("x-pathname") || "/";
    const returnPath = sanitizeReturnUrl(currentPath);
    const redirectTarget =
      returnPath && returnPath !== "/"
        ? `/login?from=${encodeURIComponent(returnPath)}`
        : "/login";
    redirect(redirectTarget);
  }

  if (result.status === "unavailable") {
    return (
      <main className={styles.unavailableContainer} role="alert">
        <div className={styles.unavailableCard}>
          <div className={styles.warningIcon} aria-hidden="true">
            !
          </div>
          <h1 className={styles.unavailableTitle}>Dịch vụ không khả dụng</h1>
          <p className={styles.unavailableMessage}>
            Không thể xác thực phiên làm việc do hệ thống máy chủ tạm thời không
            phản hồi. Vui lòng thử lại sau.
          </p>
        </div>
      </main>
    );
  }

  return <AppShell user={result.user}>{children}</AppShell>;
}
