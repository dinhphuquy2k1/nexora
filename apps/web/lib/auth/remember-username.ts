export const REMEMBERED_USERNAME_KEY = "nexora_remembered_username";
type PreferenceStorage = () => Pick<
  Storage,
  "getItem" | "setItem" | "removeItem"
>;
export function readRememberedUsername(storage: PreferenceStorage): string {
  try {
    const value = storage().getItem(REMEMBERED_USERNAME_KEY);
    return value && value.length <= 50 ? value.trim() : "";
  } catch {
    return "";
  }
}
export function writeRememberedUsername(
  storage: PreferenceStorage,
  username: string,
  remember: boolean,
): void {
  try {
    const value = username.trim();
    if (remember && value.length > 0 && value.length <= 50)
      storage().setItem(REMEMBERED_USERNAME_KEY, value);
    else storage().removeItem(REMEMBERED_USERNAME_KEY);
  } catch {
    /* Preference availability never changes session authentication. */
  }
}
