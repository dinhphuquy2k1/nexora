"use client";

import { createNexoraClient } from "@nexora/sdk";
import { loginOutcome } from "../../lib/auth/login-outcome.ts";
import { useState, useId, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { User, Lock, Eye, EyeOff, ArrowRight } from "lucide-react";
import { sanitizeReturnUrl } from "../../lib/auth/sanitize.ts";
import styles from "./login.module.css";

export function LoginForm() {
  const searchParams = useSearchParams();
  const rawFrom = searchParams.get("from");
  const returnUrl = sanitizeReturnUrl(rawFrom);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const usernameId = useId();
  const passwordId = useId();

  const [mfaRequired, setMfaRequired] = useState(false);
  const [mode, setMode] = useState<"totp" | "recovery">("totp");
  const [code, setCode] = useState("");
  const codeId = useId();
  const client = createNexoraClient();
  const cancelMfa = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const { response } = await client.POST("/api/auth/mfa/cancel");
      if (!response.ok) throw new Error();
      setMfaRequired(false);
      setCode("");
      setPassword("");
    } catch {
      setErrorMessage("Chưa thể hủy phiên chờ. Vui lòng thử lại.");
    } finally {
      setIsLoading(false);
    }
  };
  const verifyMfa = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    const candidate = mode === "recovery" ? code.trim().toUpperCase() : code;
    if (
      !(
        mode === "totp" ? /^[0-9]{6}$/ : /^[0-9A-F]{8}(?:-[0-9A-F]{8}){3}$/
      ).test(candidate)
    ) {
      setErrorMessage(
        mode === "totp"
          ? "Nhập đúng 6 chữ số xác thực."
          : "Nhập mã khôi phục gồm 4 nhóm, mỗi nhóm 8 ký tự.",
      );
      return;
    }
    setIsLoading(true);
    try {
      const { response, data } = await client.POST("/api/auth/mfa/verify", {
        body: { type: mode, code: candidate },
      });
      if (response.ok && loginOutcome(data) === "session") {
        setCode("");
        window.location.href = returnUrl;
        return;
      }
      setErrorMessage(
        response.status === 429
          ? "Quá nhiều yêu cầu xác thực. Vui lòng thử lại sau."
          : response.status === 401
            ? "Mã hoặc phiên chờ không hợp lệ hoặc đã hết hạn. Thử mã khác hoặc quay lại đăng nhập."
            : "Không thể xác thực. Vui lòng thử lại.",
      );
      setCode("");
    } catch {
      setErrorMessage("Không thể kết nối đến dịch vụ. Vui lòng thử lại.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setErrorMessage("Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu.");
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const { response, data, error } = await client.POST("/api/auth/login", {
        body: { username: username.trim(), password },
      });
      if (response.ok) {
        const outcome = loginOutcome(data);
        setPassword("");
        setShowPassword(false);
        if (outcome === "mfa") {
          setMfaRequired(true);
          setCode("");
          setMode("totp");
          return;
        }
        if (outcome === "session") {
          window.location.href = returnUrl;
          return;
        }
        setErrorMessage("Phản hồi đăng nhập không hợp lệ. Vui lòng thử lại.");
        return;
      }
      if (
        response.status === 403 &&
        error?.code === "MFA_ENROLLMENT_REQUIRED"
      ) {
        setPassword("");
        setErrorMessage(
          "Tài khoản cần thiết lập MFA. Liên hệ người vận hành để chạy pnpm mfa:enroll tại máy chủ.",
        );
        return;
      }

      if (response.status === 401) {
        setErrorMessage("Tên đăng nhập hoặc mật khẩu không chính xác.");
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

  if (mfaRequired)
    return (
      <form
        className={styles.form}
        onSubmit={verifyMfa}
        noValidate
        aria-busy={isLoading}
      >
        <p>Xác thực hai bước để hoàn tất đăng nhập.</p>
        {errorMessage && (
          <div className={styles.errorBanner} role="alert">
            {errorMessage}
          </div>
        )}
        <div className={styles.fieldGroup}>
          <label htmlFor={codeId} className={styles.label}>
            {mode === "totp" ? "Mã xác thực 6 chữ số" : "Mã khôi phục một lần"}
          </label>
          <input
            key={mode}
            id={codeId}
            name="mfa-code"
            type="text"
            autoFocus
            inputMode={mode === "totp" ? "numeric" : "text"}
            autoComplete="one-time-code"
            spellCheck={false}
            autoCapitalize="characters"
            maxLength={mode === "totp" ? 6 : 35}
            className={styles.input}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            disabled={isLoading}
            aria-describedby={`${codeId}-help`}
          />
          <p id={`${codeId}-help`}>
            {mode === "totp"
              ? "Lấy mã từ ứng dụng xác thực của bạn."
              : "Mỗi mã khôi phục chỉ sử dụng được một lần."}
          </p>
        </div>
        <button type="submit" className={styles.submitBtn} disabled={isLoading}>
          {isLoading ? "Đang xác thực..." : "Xác thực"}
        </button>
        <button
          type="button"
          className={styles.modeToggleLink}
          disabled={isLoading}
          onClick={() => {
            setMode(mode === "totp" ? "recovery" : "totp");
            setCode("");
            setErrorMessage(null);
          }}
        >
          {mode === "totp" ? "Dùng mã khôi phục" : "Dùng ứng dụng xác thực"}
        </button>
        <button
          type="button"
          className={styles.modeToggleLink}
          disabled={isLoading}
          onClick={cancelMfa}
        >
          Hủy và quay lại đăng nhập
        </button>
      </form>
    );

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
              placeholder="Nhập tên đăng nhập Nexora"
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
    </>
  );
}
