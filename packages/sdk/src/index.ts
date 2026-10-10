import createClient from "openapi-fetch";
import type { paths } from "./generated/api";
export type { paths, components } from "./generated/api";
export const createNexoraClient = (baseUrl = "") =>
  createClient<paths>({ baseUrl });
