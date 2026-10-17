import type { ExecutionContext, INestApplication } from "@nestjs/common";
import { DeploymentProfile } from "@nexora/shared";
import type { Config } from "./config";
import { SessionGuard } from "./identity/presentation/session.guard";
import { AdminBoundaryGuard } from "./identity/presentation/admin-boundary.guard";
import { AdminGuard } from "./identity/presentation/admin.guard";
import { MfaPort } from "./identity/application/mfa.port";
import { IS_PUBLIC_KEY } from "./identity/presentation/public.decorator";
import { AuthLevel } from "./identity/domain/session-assurance";
import { UserRole } from "./identity/domain/user-policy";

/** Called after Nest initialization, before binding a listener. Unknown Nest registry shape fails closed. */
export async function verifyPublicStartup(
  app: INestApplication,
  config: Pick<Config, "deployment">,
) {
  if (config.deployment.profile !== DeploymentProfile.PUBLIC_HTTPS) return;
  const session = app.get(SessionGuard),
    boundary = app.get(AdminBoundaryGuard),
    admin = app.get(AdminGuard);
  const registry = (
    app as unknown as { config?: { getGlobalGuards?: () => unknown[] } }
  ).config?.getGlobalGuards?.();
  if (
    !registry?.includes(session) ||
    !registry.includes(boundary) ||
    registry.indexOf(session) > registry.indexOf(boundary)
  )
    throw new Error("PUBLIC_SECURITY_NOT_READY");
  // Probe the exact assertion invoked by this registered administrative guard, not a toggle.
  for (const [role, level] of [
    [UserRole.ADMIN, AuthLevel.PASSWORD],
    [UserRole.OPERATOR, AuthLevel.MFA],
  ]) {
    let denied = false;
    try {
      admin.assertAssurance(role, level);
    } catch {
      denied = true;
    }
    if (!denied) throw new Error("PUBLIC_SECURITY_NOT_READY");
  }
  if (!admin.assertAssurance(UserRole.ADMIN, AuthLevel.MFA))
    throw new Error("PUBLIC_SECURITY_NOT_READY");
  // Even a future Public admin handler must be rejected by both real global guards without a session.
  class Probe {}
  const handler = () => undefined;
  Reflect.defineMetadata(IS_PUBLIC_KEY, true, handler);
  const context = {
    getClass: () => Probe,
    getHandler: () => handler,
    switchToHttp: () => ({
      getRequest: () => ({ path: "/api/admin/__startup_probe", headers: {} }),
    }),
  } as unknown as ExecutionContext;
  for (const guard of [session, boundary]) {
    let denied = false;
    try {
      await guard.canActivate(context);
    } catch {
      denied = true;
    }
    if (!denied) throw new Error("PUBLIC_SECURITY_NOT_READY");
  }
  await app.get(MfaPort).assertPublicReady();
}
