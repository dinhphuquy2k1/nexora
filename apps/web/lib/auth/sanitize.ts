const RETURN_ORIGIN = "https://nexora-return.invalid";

export function sanitizeReturnUrl(returnUrl?: string | null): string {
  if (
    !returnUrl ||
    !returnUrl.startsWith("/") ||
    returnUrl.startsWith("//") ||
    returnUrl.includes("\\") ||
    [...returnUrl].some(
      (char) =>
        char.charCodeAt(0) < 32 ||
        (char.charCodeAt(0) >= 127 && char.charCodeAt(0) <= 159),
    )
  )
    return "/";
  try {
    const parsed = new URL(returnUrl, RETURN_ORIGIN);
    if (
      parsed.origin !== RETURN_ORIGIN ||
      parsed.username ||
      parsed.password ||
      !parsed.pathname.startsWith("/") ||
      parsed.pathname.startsWith("//")
    )
      return "/";
    return parsed.pathname + parsed.search + parsed.hash;
  } catch {
    return "/";
  }
}
