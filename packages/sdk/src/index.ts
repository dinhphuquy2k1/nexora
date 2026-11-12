import createClient, { type Middleware } from "openapi-fetch";
import type { paths } from "./generated/api";
export type { paths, components } from "./generated/api";
export type { Middleware };
export const createNexoraClient = (baseUrl = "") =>
  createClient<paths>({ baseUrl });
export type NexoraClient = ReturnType<typeof createNexoraClient>;
