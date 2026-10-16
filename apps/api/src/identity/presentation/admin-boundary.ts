import type { ExecutionContext } from "@nestjs/common";
import { PATH_METADATA } from "@nestjs/common/constants";
/** Central namespace boundary uses registered Nest controller/handler paths,
 * not request headers or per-controller opt-in. Public cannot exempt admin APIs. */
export function isAdminBoundary(context: ExecutionContext): boolean {
  const request = context
    .switchToHttp()
    .getRequest<{ path?: string; url?: string }>();
  const rawPath = request.path ?? request.url?.split("?")[0] ?? "";
  try {
    if (/^\/api\/admin(?:\/|$)/i.test(decodeURIComponent(rawPath))) return true;
  } catch {
    /* Registered route metadata still applies. */
  }
  const controller: string | string[] =
    Reflect.getMetadata(PATH_METADATA, context.getClass()) ?? "";
  const handler: string | string[] =
    Reflect.getMetadata(PATH_METADATA, context.getHandler()) ?? "";
  return [controller]
    .flat()
    .some((c) =>
      [handler]
        .flat()
        .some((h) =>
          /^admin(?:\/|$)/i.test(
            [c, h].filter(Boolean).join("/").replace(/^\/+/, ""),
          ),
        ),
    );
}
