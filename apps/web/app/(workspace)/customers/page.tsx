import { cookies } from "next/headers";
import { getCachedServerSession } from "../../../lib/api/session.ts";
import { Suspense } from "react";
import { CustomerListPage } from "../../../features/customers/CustomerListPage.tsx";
export default async function CustomersPage() {
  const session = await getCachedServerSession(
    (await cookies()).get("nexora_session")?.value,
  );
  if (session.status !== "authenticated") return null; // Parent layout owns redirect/unavailable rendering.
  return (
    <Suspense fallback={<p>Đang tải bộ lọc…</p>}>
      <CustomerListPage key={session.user.id} ownerId={session.user.id} />
    </Suspense>
  );
}
