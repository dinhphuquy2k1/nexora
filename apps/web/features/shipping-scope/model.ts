import type { components } from "@nexora/sdk";

type Provider = components["schemas"]["CarrierProviderSummaryDto"];
export type Connection = Pick<
  components["schemas"]["CarrierConnectionDto"],
  "id" | "provider" | "displayName" | "status"
>;
export const CONNECTION_PRESENTATION: Record<
  Connection["status"],
  { label: string; needsAttention: boolean }
> = {
  CONNECTED: { label: "Đã kết nối", needsAttention: false },
  REAUTH_REQUIRED: { label: "Cần xác thực lại", needsAttention: true },
  ERROR: { label: "Lỗi kết nối", needsAttention: true },
};
export type CarrierGroup = Provider & { connections: Connection[] };
export type Scope =
  | { type: "all" }
  | { type: "provider"; provider: string }
  | { type: "connection"; provider: string; id: string };
export type ParsedScope = Scope | { type: "invalid" };

export function parseScope(params: URLSearchParams): ParsedScope {
  const providers = params.getAll("provider");
  const ids = params.getAll("connection");
  if (!providers.length && !ids.length) return { type: "all" };
  if (
    providers.length !== 1 ||
    !providers[0]?.trim() ||
    ids.length > 1 ||
    (ids.length && !ids[0]?.trim())
  )
    return { type: "invalid" };
  return ids.length
    ? { type: "connection", provider: providers[0]!, id: ids[0]! }
    : { type: "provider", provider: providers[0]! };
}

export function writeScope(
  params: URLSearchParams,
  scope: Scope,
): URLSearchParams {
  const next = new URLSearchParams(params);
  next.delete("provider");
  next.delete("connection");
  next.delete("page");
  if (scope.type !== "all") next.set("provider", scope.provider);
  if (scope.type === "connection") next.set("connection", scope.id);
  return next;
}

export function groupMetadata(
  providers: readonly Provider[],
  connections: readonly Connection[],
): CarrierGroup[] {
  const providerIds = new Set<string>();
  const connectionIds = new Set<string>();
  for (const p of providers) {
    if (
      !p ||
      typeof p.provider !== "string" ||
      !p.provider.trim() ||
      typeof p.displayName !== "string" ||
      !p.displayName.trim() ||
      providerIds.has(p.provider)
    )
      throw new Error("Invalid carrier metadata");
    providerIds.add(p.provider);
  }
  for (const c of connections) {
    if (
      !c ||
      typeof c.id !== "string" ||
      !c.id.trim() ||
      !providerIds.has(c.provider) ||
      typeof c.displayName !== "string" ||
      !c.displayName.trim() ||
      !Object.hasOwn(CONNECTION_PRESENTATION, c.status) ||
      connectionIds.has(c.id)
    )
      throw new Error("Invalid connection metadata");
    connectionIds.add(c.id);
  }
  return providers.map((p) => ({
    provider: p.provider,
    displayName: p.displayName,
    connections: connections
      .filter((c) => c.provider === p.provider)
      .map(({ id, provider, displayName, status }) => ({
        id,
        provider,
        displayName,
        status,
      })),
  }));
}

export function resolveScope(
  scope: ParsedScope,
  groups: readonly CarrierGroup[],
): { valid: boolean; label: string } {
  if (scope.type === "all") return { valid: true, label: "Tất cả hãng" };
  if (scope.type === "invalid")
    return { valid: false, label: "Chọn lại phạm vi" };
  const group = groups.find((g) => g.provider === scope.provider);
  if (!group) return { valid: false, label: "Phạm vi không khả dụng" };
  if (scope.type === "provider")
    return { valid: true, label: `${group.displayName} · Tất cả tài khoản` };
  const connection = group.connections.find((c) => c.id === scope.id);
  return connection
    ? { valid: true, label: `${group.displayName} · ${connection.displayName}` }
    : { valid: false, label: "Tài khoản không khả dụng" };
}

export function filterGroups(
  groups: readonly CarrierGroup[],
  query: string,
): CarrierGroup[] {
  const q = query.trim().toLocaleLowerCase("vi");
  return groups
    .map((g) => ({
      ...g,
      connections: `${g.displayName} ${g.provider}`
        .toLocaleLowerCase("vi")
        .includes(q)
        ? g.connections
        : g.connections.filter((c) =>
            c.displayName.toLocaleLowerCase("vi").includes(q),
          ),
    }))
    .filter(
      (g) =>
        g.connections.length ||
        `${g.displayName} ${g.provider}`.toLocaleLowerCase("vi").includes(q),
    );
}
