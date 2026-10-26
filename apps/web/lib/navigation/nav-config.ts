export type WorkspaceVariant = "standard" | "wide";

export type NavStatus = "available" | "planned";

export type NavGroup = "Workspace" | "System";

export type NavIconKey =
  | "overview"
  | "shipment"
  | "customers"
  | "system"
  | "settings";

export interface NavItem {
  readonly id: string;
  readonly label: string;
  readonly href: string | null;
  readonly status: NavStatus;
  readonly group: NavGroup;
  readonly iconKey: NavIconKey;
  readonly contentVariant?: WorkspaceVariant;
}

export const NAVIGATION_ITEMS: readonly NavItem[] = [
  {
    id: "overview",
    label: "Tổng quan",
    href: "/",
    status: "available",
    group: "Workspace",
    iconKey: "overview",
    contentVariant: "standard",
  },
  {
    id: "shipment",
    label: "Vận đơn",
    href: null,
    status: "planned",
    group: "Workspace",
    iconKey: "shipment",
  },
  {
    id: "customers",
    label: "Khách hàng",
    href: "/customers",
    status: "available",
    group: "Workspace",
    iconKey: "customers",
    contentVariant: "wide",
  },
  {
    id: "system",
    label: "Trạng thái hệ thống",
    href: "/system",
    status: "available",
    group: "System",
    iconKey: "system",
    contentVariant: "standard",
  },
  {
    id: "settings",
    label: "Cài đặt",
    href: "/settings",
    status: "available",
    group: "System",
    iconKey: "settings",
    contentVariant: "standard",
  },
] as const;

export const GROUP_LABELS: Record<NavGroup, string> = {
  Workspace: "Không gian làm việc",
  System: "Hệ thống",
};
