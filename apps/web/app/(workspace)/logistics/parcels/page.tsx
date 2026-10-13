import { Suspense } from "react";
import { cookies } from "next/headers";
import { getCachedServerSession } from "../../../../lib/api/session.ts";
import { ParcelView } from "../../../../features/parcels/components/ParcelView.tsx";
import { ParcelLoadingSkeleton } from "../../../../features/parcels/components/ParcelLoadingSkeleton.tsx";

export const dynamic = "force-dynamic";

export default async function ParcelsPage() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get("nexora_session")?.value;
  const result = await getCachedServerSession(sessionToken);

  if (result.status !== "authenticated") {
    return null;
  }

  return (
    <Suspense fallback={<ParcelLoadingSkeleton />}>
      <ParcelView />
    </Suspense>
  );
}
