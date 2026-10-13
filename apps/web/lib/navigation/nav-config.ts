export type NavStatus = "available" | "planned";

export type NavGroup = "Workspace" | "Logistics" | "System";

export type NavIconKey =
  | "overview"
  | "shipment"
  | "parcels"
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
}

export const NAVIGATION_ITEMS: readonly NavItem[] = [
  {
    id: "overview",
    label: "Tổng quan",
    href: "/",
    status: "available",
    group: "Workspace",
    iconKey: "overview",
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
    id: "parcels",
    label: "Kiện hàng lẻ",
    href: "/logistics/parcels",
    status: "available",
    group: "Logistics",
    iconKey: "parcels",
  },
  {
    id: "customers",
    label: "Khách hàng",
    href: null,
    status: "planned",
    group: "Workspace",
    iconKey: "customers",
  },
  {
    id: "system",
    label: "Trạng thái hệ thống",
    href: "/system",
    status: "available",
    group: "System",
    iconKey: "system",
  },
  {
    id: "settings",
    label: "Cài đặt",
    href: "/settings",
    status: "available",
    group: "System",
    iconKey: "settings",
  },
] as const;

export const GROUP_LABELS: Record<NavGroup, string> = {
  Workspace: "Không gian làm việc",
  Logistics: "Logistics",
  System: "Hệ thống",
};
