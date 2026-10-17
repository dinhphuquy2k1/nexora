/** Pure, server-side deployment policy shared by API and Web. Never contains secrets. */
export const DeploymentProfile = {
  LOCAL: "LOCAL",
  PUBLIC_HTTPS: "PUBLIC_HTTPS",
} as const;
export type DeploymentProfile =
  (typeof DeploymentProfile)[keyof typeof DeploymentProfile];
type Environment = Readonly<Record<string, string | undefined>>;
export interface DeploymentPolicy {
  profile: DeploymentProfile;
  secureCookies: boolean;
  publicOrigin?: string;
  allowedHosts: readonly string[];
  allowedOrigins: readonly string[];
}
function invalid(field: string): never {
  throw new Error(`Invalid configuration: ${field}`);
}
export function normalizeAuthority(value: string): string {
  if (!value || value.length > 253 || !/^[a-zA-Z0-9.\-[\]:]+$/.test(value))
    throw new Error("Invalid authority");
  const match = /^(\[[0-9a-fA-F:]+\]|[a-zA-Z0-9.-]+)(?::([0-9]+))?$/.exec(
    value,
  );
  if (!match) throw new Error("Invalid authority");
  if (
    match[2] &&
    (!/^[1-9][0-9]{0,4}$/.test(match[2]) || Number(match[2]) > 65535)
  )
    throw new Error("Invalid port");
  const url = new URL(`https://${value}`);
  const hostname = url.hostname.toLowerCase();
  if (
    !hostname.startsWith("[") &&
    (!hostname
      .split(".")
      .every((label) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label)) ||
      hostname.endsWith("."))
  )
    throw new Error("Invalid hostname");
  // URL parsing must not reinterpret abbreviated/hexadecimal IPv4 or other authorities.
  if (hostname !== match[1].toLowerCase())
    throw new Error("Ambiguous authority");
  return url.host;
}
export function normalizeOrigin(value: string): string {
  const match = /^(https?):\/\/([^/?#\\@\s]+)$/i.exec(value);
  if (!match) throw new Error("Invalid Origin");
  normalizeAuthority(match[2]);
  const url = new URL(`${match[1].toLowerCase()}://${match[2]}`);
  return url.origin;
}
function entries(raw: string | undefined, field: string): string[] {
  if (!raw?.trim()) return invalid(field);
  const values = raw.split(",").map((value) => value.trim());
  if (values.some((value) => !value)) return invalid(field);
  return values;
}
function publicAuthority(value: string): string {
  const authority = normalizeAuthority(value),
    hostname = new URL(`https://${authority}`).hostname;
  // Public mode is explicitly DNS/FQDN-based. IP literals/private and local shortcuts are not ingress names.
  if (
    !hostname.includes(".") ||
    !/[a-z]/i.test(hostname) ||
    hostname.startsWith("[") ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local")
  )
    throw new Error("Public FQDN required");
  return authority;
}
export function loadDeploymentPolicy(env: Environment): DeploymentPolicy {
  const profile = env.NEXORA_DEPLOYMENT_PROFILE ?? DeploymentProfile.LOCAL;
  if (
    profile !== DeploymentProfile.LOCAL &&
    profile !== DeploymentProfile.PUBLIC_HTTPS
  )
    return invalid("NEXORA_DEPLOYMENT_PROFILE");
  if (profile === DeploymentProfile.LOCAL)
    return {
      profile,
      secureCookies: false,
      allowedHosts: [],
      allowedOrigins: [],
    };
  try {
    const publicOrigin = normalizeOrigin(env.PUBLIC_ORIGIN ?? "");
    if (!publicOrigin.startsWith("https://")) return invalid("PUBLIC_ORIGIN");
    publicAuthority(new URL(publicOrigin).host);
    const allowedHosts = [
      ...new Set(
        entries(env.ALLOWED_HOSTS, "ALLOWED_HOSTS").map(publicAuthority),
      ),
    ];
    const allowedOrigins = [
      ...new Set(
        entries(env.ALLOWED_ORIGINS, "ALLOWED_ORIGINS").map((value) => {
          const origin = normalizeOrigin(value);
          if (
            !origin.startsWith("https://") ||
            !allowedHosts.includes(publicAuthority(new URL(origin).host))
          )
            return invalid("ALLOWED_ORIGINS");
          return origin;
        }),
      ),
    ];
    if (!allowedOrigins.includes(publicOrigin)) return invalid("PUBLIC_ORIGIN");
    return {
      profile,
      secureCookies: true,
      publicOrigin,
      allowedHosts,
      allowedOrigins,
    };
  } catch {
    return invalid("PUBLIC_HTTPS Host/Origin policy");
  }
}
