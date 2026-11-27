import { z } from "zod";
/** Shared API/Worker subset; Worker never needs storage, origins or Identity keys. */
export const carrierRuntimeSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  UNISHIP_API_URL: z.preprocess(
    (value) => (value === "" || value === undefined ? undefined : value),
    z
      .string()
      .url()
      .refine((value) => {
        try {
          return ["http:", "https:"].includes(new URL(value).protocol);
        } catch {
          return false;
        }
      })
      .optional(),
  ),
  UNISHIP_LIVE_AUTHORIZED: z.enum(["true", "false"]).default("false"),
});
export function readCarrierRuntimeConfig(
  env: Readonly<Record<string, string | undefined>>,
) {
  const parsed = carrierRuntimeSchema.safeParse(env);
  if (!parsed.success) throw new Error("Invalid Carrier runtime configuration");
  return Object.freeze({
    apiUrl: parsed.data.UNISHIP_API_URL,
    liveAuthorized: parsed.data.UNISHIP_LIVE_AUTHORIZED === "true",
    isProduction: parsed.data.NODE_ENV === "production",
  });
}
