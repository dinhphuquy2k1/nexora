/**
 * Server-side API configuration and validation.
 *
 * Owns the authoritative validation for API_INTERNAL_URL.
 * Reusable across Server Components and Next.js configuration.
 */

/**
 * Validates and normalizes an internal API upstream URL string.
 *
 * @param rawValue Raw environment variable value.
 * @returns Normalized origin string (e.g. "http://api:4000").
 * @throws Error if the value is missing, malformed, or contains credentials/path/query/hash.
 */
export function resolveApiInternalUrl(rawValue: string | undefined): string {
  if (!rawValue || !rawValue.trim()) {
    throw new Error(
      "API_INTERNAL_URL is required. Configure the Web API upstream (e.g. http://api:4000 in Docker).",
    );
  }

  const trimmed = rawValue.trim();
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new Error(
      `API_INTERNAL_URL is malformed: "${trimmed}". Must be a valid absolute URL (e.g. http://api:4000).`,
    );
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(
      `API_INTERNAL_URL must use HTTP or HTTPS protocol. Received: "${url.protocol}".`,
    );
  }

  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    (url.pathname !== "/" && url.pathname !== "")
  ) {
    throw new Error(
      "API_INTERNAL_URL must be an origin without credentials, path, query, or fragment.",
    );
  }

  return url.origin;
}

/**
 * Returns the validated internal API upstream base URL from process.env.API_INTERNAL_URL.
 */
export function getApiInternalUrl(): string {
  return resolveApiInternalUrl(process.env.API_INTERNAL_URL);
}
