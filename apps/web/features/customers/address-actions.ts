import type { Address } from "./types.ts";
export async function deleteCustomerAddress(
  api: {
    setDefault: (id: string, addressId: string) => Promise<unknown>;
    remove: (id: string, addressId: string) => Promise<unknown>;
  },
  id: string,
  target: Pick<Address, "id" | "isDefault">,
  count: number,
  replacement?: string,
) {
  if (count <= 1) return { kind: "last" as const };
  let committed = false;
  try {
    if (target.isDefault) {
      if (!replacement || replacement === target.id)
        return { kind: "replacement" as const };
      await api.setDefault(id, replacement);
      committed = true;
    }
    await api.remove(id, target.id);
    return { kind: "deleted" as const };
  } catch (error) {
    return {
      kind: committed ? ("partial" as const) : ("failed" as const),
      error,
    };
  }
}
