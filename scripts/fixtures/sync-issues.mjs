// Synthetic GET-only API for the existing Carrier CDP fixture. No production imports.
export const issueJobId = (n) =>
  "22222222-2222-4222-8222-" + String(n).padStart(12, "0");
export const issueSourceId = (n) =>
  "33333333-3333-4333-8333-" + String(n).padStart(12, "0");
export function syncIssueResponse(req, res) {
  const url = new URL(req.url, "http://localhost");
  const match =
    /^\/api\/carrier-connections\/11111111-1111-4111-8111-111111111111\/sync-jobs\/22222222-2222-4222-8222-(\d{12})$/.exec(
      url.pathname,
    );
  if (req.method !== "GET" || !match) return false;
  const n = Number(match[1]),
    page = Number(url.searchParams.get("page")),
    size = Number(url.searchParams.get("pageSize"));
  res.setHeader("content-type", "application/json");
  if (size !== 10 || !Number.isInteger(page) || page < 1) {
    res.writeHead(400);
    res.end("{}");
    return true;
  }
  if (n >= 4 && n <= 6) {
    res.writeHead({ 4: 403, 5: 404, 6: 401 }[n]);
    res.end(
      JSON.stringify({
        code: "SYNTHETIC_DENIAL",
        message: "PRIVATE_PROVIDER_RESPONSE",
      }),
    );
    return true;
  }
  const issueTotal = n === 2 ? 0 : n === 1 ? 11 : 1;
  const send = () =>
    res.end(
      JSON.stringify({
        job: { id: issueJobId(n) },
        issues: Array.from(
          {
            length: Math.max(0, Math.min(size, issueTotal - (page - 1) * size)),
          },
          (_, i) => ({
            id: issueSourceId((page - 1) * size + i + 1),
            sourceId: issueSourceId(n === 3 ? 99 : (page - 1) * size + i + 1),
            sourceVersion: 2,
            processorVersion: 1,
            outcome: "NEEDS_REVIEW",
            errorCode: "SOURCE_CONFLICT",
            payload: "PRIVATE_RAW_PAYLOAD",
            token: "PRIVATE_TOKEN",
          }),
        ),
        issueTotal,
      }),
    );
  if (n === 3) setTimeout(send, 600);
  else send();
  return true;
}
