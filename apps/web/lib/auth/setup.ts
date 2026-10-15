/** Fragment-only transport. Clear even malformed fragments before any API call. */
export function takeSetupToken(
  location: Pick<Location, "hash" | "pathname" | "search">,
  history: Pick<History, "replaceState">,
): string | null {
  const fragment = location.hash;
  history.replaceState(null, "", location.pathname);
  const token = new URLSearchParams(fragment.replace(/^#/, "")).get("token");
  return token && /^[a-f0-9]{64}$/.test(token) ? token : null;
}
