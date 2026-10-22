/** Narrow Prisma/driver-adapter metadata recognition; never inspect or expose error.detail (PII). */
export function isOwnerPhoneConflict(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as {
    code?: string;
    meta?: {
      target?: unknown;
      driverAdapterError?: { cause?: { constraint?: unknown } };
    };
  };
  if (e.code !== "P2002") return false;
  function matches(target: unknown): boolean {
    if (target === "uq_customers_owner_phone") return true;
    if (Array.isArray(target))
      return (
        target.length === 2 &&
        ((target.includes("owner_user_id") &&
          target.includes("phone_normalized")) ||
          (target.includes("ownerUserId") && target.includes("phone")))
      );
    return (
      !!target &&
      typeof target === "object" &&
      (target as { index?: unknown }).index === "uq_customers_owner_phone"
    );
  }
  return (
    matches(e.meta?.target) ||
    matches(e.meta?.driverAdapterError?.cause?.constraint)
  );
}
