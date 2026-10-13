import { cookies } from "next/headers";
import { getCachedServerSession } from "../../../lib/api/session.ts";
import { SystemClient } from "./SystemClient.tsx";

export const dynamic = "force-dynamic";

export default async function System() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get("nexora_session")?.value;
  const result = await getCachedServerSession(sessionToken);

  if (result.status !== "authenticated") {
    return null;
  }

  return <SystemClient />;
}
