import { DeploymentProfile, loadDeploymentPolicy } from "@nexora/shared";

export interface DeploymentPresentation {
  badge: string;
  session: string;
  runtime: string;
}

/** Server-only caller passes presentation text, never the policy/environment. */
export function deploymentPresentation(
  env: Readonly<Record<string, string | undefined>> = process.env,
): DeploymentPresentation {
  const policy = loadDeploymentPolicy(env);
  return policy.profile === DeploymentProfile.PUBLIC_HTTPS
    ? {
        badge: "HTTPS",
        session: "Phiên làm việc HTTPS đang hoạt động",
        runtime: "Hệ thống vận hành qua kết nối HTTPS.",
      }
    : {
        badge: "Cục bộ",
        session: "Phiên làm việc cục bộ đang hoạt động",
        runtime: "Hệ thống vận hành trong môi trường máy chủ nội bộ.",
      };
}
