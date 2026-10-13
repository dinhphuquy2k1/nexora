import {
  LayoutDashboard,
  Package,
  Boxes,
  Users,
  Activity,
  Settings,
  HelpCircle,
  type LucideIcon,
} from "lucide-react";
import type { NavIconKey } from "./navigation/nav-config.ts";

export const navIconRegistry: Record<NavIconKey, LucideIcon> = {
  overview: LayoutDashboard,
  shipment: Package,
  parcels: Boxes,
  customers: Users,
  system: Activity,
  settings: Settings,
};

export function getNavIcon(iconKey: NavIconKey): LucideIcon {
  return navIconRegistry[iconKey] ?? HelpCircle;
}
