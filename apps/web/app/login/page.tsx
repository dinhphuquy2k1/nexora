import { Suspense } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { PRODUCT_NAME } from "@nexora/shared";
import { LoginForm } from "./LoginForm.tsx";
import styles from "./login.module.css";
import { sanitizeReturnUrl } from "../../lib/auth/sanitize.ts";
import { verifyServerSession } from "../../lib/api/session.ts";

export const metadata = {
  title: `Đăng nhập · ${PRODUCT_NAME}`,
  description: "Đăng nhập không gian quản lý vận đơn Nexora",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<{ from?: string }>;
}) {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("nexora_session");

  let shouldRedirect = false;
  let returnUrl = "/";
  let serviceUnavailable = false;

  if (sessionCookie?.value) {
    const sessionResult = await verifyServerSession(sessionCookie.value);
    if (sessionResult.status === "authenticated") {
      const resolvedParams = searchParams ? await searchParams : undefined;
      returnUrl = sanitizeReturnUrl(resolvedParams?.from);
      shouldRedirect = true;
    } else if (sessionResult.status === "unavailable") {
      serviceUnavailable = true;
    }
  }

  // Next.js redirect must be called outside try/catch to avoid intercepting NEXT_REDIRECT signals.
  if (shouldRedirect) {
    redirect(returnUrl);
  }
  return (
    <main className={styles.container}>
      <section className={styles.card} aria-labelledby="login-heading">
        {/* Monogram Brand Mark */}
        <div className={styles.logoMonogram} aria-hidden="true">
          <span className={styles.logoLetter}>N</span>
          <span className={styles.logoDot} />
        </div>

        {/* Heading & Subtitle */}
        <h1 id="login-heading" className={styles.heading}>
          Đăng nhập {PRODUCT_NAME}
        </h1>
        <p className={styles.subtitle}>Truy cập không gian quản lý vận đơn</p>

        {serviceUnavailable && (
          <div role="alert" className={styles.errorBanner}>
            Không thể kiểm tra phiên đăng nhập do dịch vụ backend tạm thời không
            khả dụng. Vui lòng thử lại sau.
          </div>
        )}

        {/* Suspense Boundary for useSearchParams */}
        <Suspense
          fallback={
            <div style={{ minHeight: "180px" }}>Đang tải biểu mẫu...</div>
          }
        >
          <LoginForm />
        </Suspense>
      </section>
    </main>
  );
}
