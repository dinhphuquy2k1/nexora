import { z } from "zod";
import { isAbsolute, resolve } from "node:path";
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
});
export type Config = z.infer<typeof schema>;
export function loadConfig(env: NodeJS.ProcessEnv): Config {
  const result = schema.safeParse(env);
  if (!result.success)
    throw new Error(
      "Invalid configuration: " +
        result.error.issues.map((i) => i.path.join(".")).join(", "),
    );
  return result.data;
}
