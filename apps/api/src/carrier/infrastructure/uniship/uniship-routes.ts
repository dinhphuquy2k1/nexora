export const UNISHIP_ROUTES = {
  AUTH: "/client/api-token-auth/",
  VERIFY: "/client/api-token-verify/",
  SHIPMENTS: "/client/api/transition/",
  WAREHOUSES: "/client/api/chinaStores/",
} as const;

const UNISHIP_READ_ROUTES = [
  UNISHIP_ROUTES.SHIPMENTS,
  UNISHIP_ROUTES.WAREHOUSES,
] as const;

export type UnishipReadRoute = (typeof UNISHIP_READ_ROUTES)[number];

export type UnishipAuthRoute =
  | typeof UNISHIP_ROUTES.AUTH
  | typeof UNISHIP_ROUTES.VERIFY;

export function isUnishipReadRoute(path: unknown): path is UnishipReadRoute {
  return (
    typeof path === "string" &&
    UNISHIP_READ_ROUTES.some((allowed) => allowed === path)
  );
}
