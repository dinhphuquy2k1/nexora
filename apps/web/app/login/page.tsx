import { Suspense } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { PRODUCT_NAME } from "@nexora/shared";
import { LoginForm } from "./LoginForm.tsx";
import styles from "./login.module.css";
import { sanitizeReturnUrl } from "../../lib/auth/sanitize.ts";

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

  if (sessionCookie?.value) {
    const apiUrl = process.env.API_INTERNAL_URL ?? "http://api:4000";
    try {
      const res = await fetch(`${apiUrl}/api/auth/session`, {
        headers: {
          cookie: `nexora_session=${sessionCookie.value}`,
        },
        cache: "no-store",
      });
      if (res.ok) {
        const resolvedParams = searchParams ? await searchParams : undefined;
        const returnUrl = sanitizeReturnUrl(resolvedParams?.from);
        redirect(returnUrl);
      }
    } catch {
      // Stale or invalid session -> do not redirect, render login page
    }
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
