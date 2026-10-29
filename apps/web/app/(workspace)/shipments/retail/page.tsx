import { cookies } from "next/headers";
import { getCachedServerSession } from "../../../../lib/api/session.ts";
import { Suspense } from "react";
import { RetailPackageListPage } from "../../../../features/retail-packages/RetailPackageListPage.tsx";

/**
 * /shipments/retail — Retail Packages page.
 *
 * In production: passes an empty package list (no backend API yet).
 * The RetailPackageListPage renders an honest planned/empty state.
 *
 * In development/test environments, synthetic fixtures may be passed
 * directly by tests or via dev-only stubs.
 */
export default async function RetailPackagesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    for (const item of Array.isArray(value) ? value : [value])
      if (item !== undefined) params.append(key, item);
  }
  const session = await getCachedServerSession(
    (await cookies()).get("nexora_session")?.value,
  );
  // Parent layout owns redirect/unavailable rendering.
  if (session.status !== "authenticated") return null;

  return (
    <Suspense fallback={<p>Đang tải danh sách kiện lẻ…</p>}>
      {/*
       * Production: empty list — no real Shipment API exists yet.
       * Tests: pass SYNTHETIC_PACKAGES via the page component for visual verification.
       */}
      <RetailPackageListPage
        initialPackages={[]}
        availability="unavailable"
        initialSearch={"?" + params.toString()}
      />
    </Suspense>
  );
}
