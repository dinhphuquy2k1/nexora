/** Fail closed on contradictory or malformed successful authentication payloads. */
export function loginOutcome(body: unknown): "mfa" | "session" | "invalid" {
  if (!body || typeof body !== "object") return "invalid";
  if ("mfaRequired" in body)
    return body.mfaRequired === true && !("user" in body) ? "mfa" : "invalid";
  if (
    "user" in body &&
    body.user &&
    typeof body.user === "object" &&
    "id" in body.user &&
    typeof body.user.id === "string" &&
    body.user.id.trim() &&
    "username" in body.user &&
    typeof body.user.username === "string" &&
    body.user.username.trim()
  )
    return "session";
  return "invalid";
}
