import {
  DeploymentProfile,
  loadDeploymentPolicy,
  normalizeAuthority,
} from "@nexora/shared";
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "0.0.0.0"]);
export function isAllowedHost(
  hostHeader: string | null | undefined,
  env: Readonly<Record<string, string | undefined>> = process.env,
): boolean {
  try {
    if (!hostHeader) return false;
    const authority = normalizeAuthority(hostHeader),
      policy = loadDeploymentPolicy(env);
    if (policy.profile === DeploymentProfile.PUBLIC_HTTPS)
      return policy.allowedHosts.includes(authority);
    const hostname = new URL(`https://${authority}`).hostname;
    if (LOCAL_HOSTS.has(hostname)) return true;
    return (env.ALLOWED_HOSTS?.split(",") ?? []).some((value) => {
      const configured = normalizeAuthority(value.trim());
      return (
        configured === authority ||
        (!value.includes(":") && configured === hostname)
      );
    });
  } catch {
    return false;
  }
}
