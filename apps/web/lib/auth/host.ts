const ALLOWED_HOSTNAMES = new Set(["localhost", "127.0.0.1", "0.0.0.0"]);

export function isAllowedHost(hostHeader: string | null): boolean {
  if (!hostHeader) return false;
  const hostname = hostHeader.split(":")[0]?.toLowerCase();
  if (ALLOWED_HOSTNAMES.has(hostname)) {
    return true;
  }
  if (process.env.ALLOWED_HOSTS) {
    const custom = process.env.ALLOWED_HOSTS.split(",").map((h) =>
      h.trim().toLowerCase(),
    );
    if (
      custom.includes(hostname) ||
      custom.includes(hostHeader.toLowerCase())
    ) {
      return true;
    }
  }
  return false;
}
