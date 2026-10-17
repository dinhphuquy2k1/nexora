import type { DeploymentPolicy } from "@nexora/shared";
/** All setting and clearing paths use the same trusted policy; request headers are not inputs. */
export function cookieOptions(
  policy: Pick<DeploymentPolicy, "secureCookies">,
  kind: "session" | "pending",
  maxAge: number,
) {
  return {
    httpOnly: true,
    secure: policy.secureCookies,
    sameSite: kind === "session" ? ("lax" as const) : ("strict" as const),
    path: kind === "session" ? "/" : "/api/auth/mfa",
    maxAge,
  };
}
