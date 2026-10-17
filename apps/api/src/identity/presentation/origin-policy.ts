import {
  DeploymentProfile,
  loadDeploymentPolicy,
  normalizeOrigin,
} from "@nexora/shared";
/** WEB_PORT is a Docker host binding, not necessarily a bare port number. */
export function resolveAllowedOrigins(
  env: NodeJS.ProcessEnv,
): readonly string[] {
  const policy = loadDeploymentPolicy(env);
  if (policy.profile === DeploymentProfile.PUBLIC_HTTPS)
    return policy.allowedOrigins;
  if (env.ALLOWED_ORIGINS?.trim()) {
    try {
      return [
        ...new Set(
          env.ALLOWED_ORIGINS.split(",").map((value) =>
            normalizeOrigin(value.trim()),
          ),
        ),
      ];
    } catch {
      throw new Error("Invalid configuration: ALLOWED_ORIGINS");
    }
  }
  const match = /^(?:(?:127\.0\.0\.1|localhost):)?([0-9]+)$/.exec(
    env.WEB_PORT || "127.0.0.1:3001",
  );
  const port = match ? Number(match[1]) : 0;
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error("Invalid configuration: WEB_PORT");
  return [
    normalizeOrigin(`http://127.0.0.1:${port}`),
    normalizeOrigin(`http://localhost:${port}`),
  ];
}

export function isAllowedOrigin(
  origin?: string,
  allowed = resolveAllowedOrigins(process.env),
): boolean {
  if (!origin) return false;
  try {
    return allowed.includes(normalizeOrigin(origin));
  } catch {
    return false;
  }
}
