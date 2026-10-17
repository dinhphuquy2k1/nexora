import { deploymentPresentation } from "../../lib/auth/deployment-presentation.ts";
import type { ReactNode } from "react";
import { ShellClient } from "./ShellClient.tsx";

interface AppShellProps {
  children: ReactNode;
  user?: { id: string; username: string };
}

export function AppShell({ children, user }: AppShellProps) {
  return (
    <ShellClient user={user} deployment={deploymentPresentation()}>
      {children}
    </ShellClient>
  );
}
