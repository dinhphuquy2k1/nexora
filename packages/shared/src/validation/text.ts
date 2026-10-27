/** Trimmed bounded text; caller owns requiredness and error mapping. */
export function normalizeBoundedText(
  value: unknown,
  maximum: number,
  required = true,
): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if ((required && !normalized) || normalized.length > maximum) return null;
  return normalized;
}

/** Preserve raw-input length limits before trimming (e.g. phone fields). */
export function normalizeRawBoundedText(
  value: unknown,
  maximum: number,
  required = true,
): string | null {
  if (typeof value !== "string" || value.length > maximum) return null;
  return normalizeBoundedText(value, maximum, required);
}
