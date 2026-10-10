import type { ReactNode } from "react";
import { ShellClient } from "./ShellClient.tsx";

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  return <ShellClient>{children}</ShellClient>;
}
