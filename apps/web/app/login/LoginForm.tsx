"use client";

import { useState, useId, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { User, Lock, Eye, EyeOff, ArrowRight } from "lucide-react";
import { sanitizeReturnUrl } from "../../lib/auth/sanitize.ts";
import styles from "./login.module.css";

export function LoginForm() {
  const searchParams = useSearchParams();
  const rawFrom = searchParams.get("from");
  const mode = searchParams.get("mode");
  const isAdminMode = mode === "admin";
  const returnUrl = sanitizeReturnUrl(rawFrom);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const usernameId = useId();
  const passwordId = useId();

  const endpoint = isAdminMode ? "/api/auth/login" : "/api/auth/provider/login";

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setErrorMessage("Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu.");
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: username.trim(),
          password,
        }),
      });

      if (response.ok) {
        // Full navigation to ensure session cookie is picked up across Next.js layout and client state
        window.location.href = returnUrl;
        return;
      }

      if (response.status === 401) {
        if (isAdminMode) {
          setErrorMessage("Tên đăng nhập hoặc mật khẩu không chính xác.");
        } else {
          setErrorMessage(
            "Thông tin đăng nhập không hợp lệ hoặc tài khoản chưa được cấp quyền truy cập.",
          );
        }
      } else if (response.status === 429) {
        setErrorMessage("Quá nhiều yêu cầu đăng nhập. Vui lòng thử lại sau.");
      } else {
        setErrorMessage("Không thể kết nối đến dịch vụ. Vui lòng thử lại sau.");
      }
    } catch {
      setErrorMessage("Không thể kết nối đến dịch vụ. Vui lòng thử lại sau.");
    } finally {
      setIsLoading(false);
    }
  };

  const switchModeHref = isAdminMode
    ? rawFrom
      ? `/login?from=${encodeURIComponent(rawFrom)}`
      : "/login"
    : rawFrom
      ? `/login?mode=admin&from=${encodeURIComponent(rawFrom)}`
      : "/login?mode=admin";

  return (
    <>
      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        {errorMessage && (
          <div className={styles.errorBanner} role="alert" aria-live="polite">
            {errorMessage}
          </div>
        )}

        <div className={styles.fieldGroup}>
          <label htmlFor={usernameId} className={styles.label}>
            Tên đăng nhập
          </label>
          <div className={styles.inputWrapper}>
            <span className={styles.inputIcon} aria-hidden="true">
              <User size={18} />
            </span>
            <input
              id={usernameId}
              name="username"
              type="text"
              required
              autoComplete="username"
              autoFocus
              className={styles.input}
              placeholder={
                isAdminMode
                  ? "Nhập tên đăng nhập quản trị"
                  : "Nhập tên đăng nhập nhân viên"
              }
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={isLoading}
            />
          </div>
        </div>

        <div className={styles.fieldGroup}>
          <label htmlFor={passwordId} className={styles.label}>
            Mật khẩu
          </label>
          <div className={styles.inputWrapper}>
            <span className={styles.inputIcon} aria-hidden="true">
              <Lock size={18} />
            </span>
            <input
              id={passwordId}
              name="password"
              type={showPassword ? "text" : "password"}
              required
              autoComplete="current-password"
              className={`${styles.input} ${styles.inputPassword}`}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
            />
            <button
              type="button"
              className={styles.togglePasswordBtn}
              onClick={() => setShowPassword((prev) => !prev)}
              aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
              title={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
              disabled={isLoading}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        <button type="submit" className={styles.submitBtn} disabled={isLoading}>
          {isLoading ? (
            "Đang xử lý..."
          ) : (
            <>
              Đăng nhập <ArrowRight size={16} aria-hidden="true" />
            </>
          )}
        </button>
      </form>
      <div className={styles.modeFooter}>
        <a href={switchModeHref} className={styles.modeToggleLink}>
          {isAdminMode
            ? "Đăng nhập nhân viên"
            : "Đăng nhập Quản trị viên (ADMIN)"}
        </a>
      </div>
    </>
  );
}
