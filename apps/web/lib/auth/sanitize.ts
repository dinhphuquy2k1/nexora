export function sanitizeReturnUrl(returnUrl?: string | null): string {
  if (!returnUrl) return "/";
  if (
    !returnUrl.startsWith("/") ||
    returnUrl.startsWith("//") ||
    returnUrl.includes("\\")
  ) {
    return "/";
  }
  return returnUrl;
}
