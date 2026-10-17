import { isIP } from "node:net";
import { DeploymentProfile, type DeploymentPolicy } from "@nexora/shared";
export function trustedProxies(
  env: NodeJS.ProcessEnv,
  deployment: DeploymentPolicy,
): string | string[] {
  if (deployment.profile === DeploymentProfile.LOCAL)
    return "loopback, linklocal, uniquelocal";
  const values = env.TRUSTED_PROXY_CIDRS?.split(",").map((value) =>
    value.trim(),
  );
  if (
    !values?.length ||
    values.some((value) => {
      const [address, prefix, ...extra] = value.split("/");
      const family = isIP(address),
        max = family === 4 ? 32 : 128;
      return (
        !family ||
        extra.length > 0 ||
        !prefix ||
        !/^[1-9][0-9]*$/.test(prefix) ||
        Number(prefix) > max ||
        Number(prefix) < (family === 4 ? 24 : 64)
      );
    })
  )
    throw new Error("Invalid configuration: TRUSTED_PROXY_CIDRS");
  return values;
}
