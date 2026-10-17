import {
  DeploymentProfile,
  loadDeploymentPolicy,
  type DeploymentPolicy,
} from "@nexora/shared";
import { trustedProxies } from "./proxy-policy";
import { z } from "zod";
import { isAbsolute, resolve } from "node:path";
import { resolveAllowedOrigins } from "./identity/presentation/origin-policy";
const schema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  DATABASE_URL: z
    .string()
    .url()
    .refine((v) => {
      try {
        return ["postgresql:", "postgres:"].includes(new URL(v).protocol);
      } catch {
        return false;
      }
    }),
  STORAGE_ROOT: z.string().refine((v) => isAbsolute(v) && resolve(v) === v),
  API_DOCS_ENABLED: z.enum(["true", "false"]).default("false"),
  UNISHIP_API_URL: z.preprocess(
    (v) => (v === "" || v === undefined ? undefined : v),
    z
      .string()
      .url()
      .refine((v) => {
        try {
          const protocol = new URL(v).protocol;
          return protocol === "http:" || protocol === "https:";
        } catch {
          return false;
        }
      }, "UNISHIP_API_URL must use http: or https: protocol")
      .optional(),
  ),
  UNISHIP_LIVE_AUTHORIZED: z.enum(["true", "false"]).default("false"),
});
export type Config = z.infer<typeof schema> & {
  trustedOrigins: readonly string[];
  deployment: DeploymentPolicy;
  trustedProxies: string | string[];
};
export function loadConfig(env: NodeJS.ProcessEnv): Config {
  const result = schema.safeParse(env);
  if (!result.success)
    throw new Error(
      "Invalid configuration: " +
        result.error.issues.map((i) => i.path.join(".")).join(", "),
    );
  const deployment = loadDeploymentPolicy(env);
  if (
    deployment.profile === DeploymentProfile.PUBLIC_HTTPS &&
    result.data.API_DOCS_ENABLED === "true"
  )
    throw new Error("Invalid configuration: public API_DOCS_ENABLED");
  return {
    ...result.data,
    deployment,
    trustedProxies: trustedProxies(env, deployment),
    trustedOrigins: resolveAllowedOrigins(env),
  };
}
