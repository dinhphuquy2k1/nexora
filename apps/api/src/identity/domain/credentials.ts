export const MAX_PASSWORD_LENGTH = 1024;

export function normalizeUsername(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const username = value.trim();
  return username.length >= 3 && username.length <= 50 ? username : null;
}

export function isLoginPassword(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= MAX_PASSWORD_LENGTH
  );
}
