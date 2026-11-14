import { cookies } from "next/headers";
import { getCachedServerSession } from "../../../../lib/api/session.ts";
import { Suspense } from "react";
import { RetailPackageListPage } from "../../../../features/retail-packages/RetailPackageListPage.tsx";

/** Protected read-only Retail presentation; the feature owns browser GET state. */
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
      <RetailPackageListPage initialSearch={"?" + params.toString()} />
    </Suspense>
  );
}
