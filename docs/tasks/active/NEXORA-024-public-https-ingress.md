# NEXORA-024 — Public HTTPS profile and ingress hardening

- **Task ID**: `NEXORA-024`
- **Status**: `VERIFICATION PENDING`
- **Implementation**: `IMPLEMENTED`
- **Verification**: `NOT VERIFIED`
- **Classification**: SIGNIFICANT
- **Branch**: `feat/public-https-ingress`
- **Baseline**: `6d6bd53024bc86480d069b00f3e5c281bd92690f`

## Preflight

Clean worktree, fetched main equals reviewed baseline. PR19 merged at baseline; no open PR found, Task024 unused. New branch from origin/main; do not modify PR19 or unrelated PR14. Preserve all nine migrations, completed dependency evidence and volumes. Uploaded request ends mid-final acceptance item; the preceding detailed requirements define scope.

## PLAN ISSUE — PUBLIC_INGRESS_TOPOLOGY

ADR-007 approves public security requirements but not environment, proxy or certificate operations. Owner approval required by the uploaded request section4 before committing production ingress choice. Proposed simplest dependency-free rate limiting: one maintained Linux VPS/dedicated host with Docker Compose, Nginx TLS ingress (standard limit_req, no plugin/Redis), operator-owned FQDN, Let's Encrypt HTTP-01 certificates via separate Certbot job/host systemd timer, no Docker socket. Only80 (ACME plus HTTPS redirect) and443 public; management SSH restricted by firewall. Nginx strips/overwrites forwarding headers; dedicated private networks with explicitly assigned proxy/Web addresses, API trusts only Web hop and known ingress hop, no blanket private-subnet trust. Operator must confirm non-overlapping subnets. Web/API/PG have no public ports. Standard HTTP/2/TLS1.2+; no plaintext auth fallback, no proxy dashboard. Certificate renewal requires a tested timer and safe Nginx reload, avoiding third-party rate-limit modules at cost of separate certificate operations.

Production domain/DNS, actual host/subnets/firewall/NTP are not yet supplied or verified. Secret custody: retain separate admin/runtime DB credential volumes and independently held Identity/Carrier keys/all old versions; mounted TLS private key read-only to ingress only. Stop writers for encrypted off-host backups of PG/files/credentials plus separately encrypted key/certificate custody; verify restore only in an owned disposable target. Rollback closes public ingress first, preserves volumes/keys/schema, uses compatible matching images and LOCAL only behind loopback. No public activation authorized by this proposal.

Alternative Caddy simplifies automatic TLS but standard distribution lacks the required rate-limit directive, adding a reviewed plugin/build or another boundary; external managed TLS adds provider-specific trust/operational dependencies. No selection is treated as approved until owner replies.

## Plan and interface preflight

1. Define NEXORA_DEPLOYMENT_PROFILE=LOCAL(default)|PUBLIC_HTTPS; PUBLIC_ORIGIN, explicit ALLOWED_HOSTS/ALLOWED_ORIGINS and TRUSTED_PROXY_CIDRS. Reject incomplete public config, wildcard/loopback authority, non-HTTPS origins, ambiguous ports/CIDRs and fallback. Shared pure policy only if genuinely consumed by both apps; no secrets or Prisma outside API infrastructure.
2. Test-first profile config, strict authority parsing, cookie options and forged-forwarding immunity; central cookie policy controls setting/clearing every session/MFA cookie with existing paths/TTL/SameSite.
3. Public startup gate before listen: actual registered SessionGuard/AdminBoundaryGuard/AdminGuard enforcement exercised using a real guard probe and metadata validation, plus restricted-role database enumeration of ACTIVE ADMIN enrollment and authenticated decryption under independent Identity keys. No fake MFA flag, public enrollment details, writes or session deletion. Local lazy crypto remains compatible.
4. Public exact Host and Origin validation; canonical setup URLs from configured origin; trusted proxy validation independent of eventual network assignment. Keep local behavior and same-origin proxy, private API/PG, safe logs and Origin mandatory.
5. After topology approval only: production ingress/network/rate-limit/certificate profile and dated ADR clarification. While waiting, isolated test-only TLS ingress is permitted and is not production approval. Real trusted test CA, Next/Nest/PG/Chromium MFA/onboarding, spoof/bypass/rate/network/persistence tests.
6. Canonical docs/runbooks: explicit implementation/test/production readiness distinctions; actual host timedatectl service+synchronization gates NOT VERIFIED without evidence; secure backup/restore/rollback and no public activation before all gates.
7. Targeted RED/GREEN then full existing canonical suite/all four Docker scripts plus new HTTPS harness. Genuine hosted CI if host Prisma blocked. Push new branch, reviewable PR when approved scope implemented and verified, exact final HEAD CI; no force/merge.

## Acceptance and boundaries

All request section22 prerequisites required for full completion; actual DNS/TLS/firewall/NTP host evidence cannot be inferred from CI. Preserve local compatibility, ADMIN+MFA, five-minute scoped challenges, separate cancellation/logout, hashed single-use24h setup links, CLI enrollment, database grants, Carrier encryption/live closure and all data. No schema/migration, provider live, shipment/UI/admin-carrier/reset scope.

## Documentation Impact

Documentation Impact: REQUIRED

### Changed facts

Explicit profile, cookie/security configuration, public startup readiness, canonical URLs, ingress decision/release gates and operations.

### Canonical owners

- docs/decisions/multi-carrier-architecture.md (dated approved clarification only)
- docs/decisions/authentication.md
- docs/architecture/runtime.md
- docs/architecture/backend.md
- docs/architecture/frontend.md
- docs/architecture/api-contract.md
- docs/operations/configuration.md
- docs/operations/deployment.md
- docs/operations/setup.md
- docs/operations/testing.md

### Documentation verification

pnpm docs:check, test:docs, format:check, contracts:check; actual canonical and HTTPS evidence recorded separately from production host readiness.

## Evidence

| Claim     | Evidence                                                                                              | Date       | Result |
| :-------- | :---------------------------------------------------------------------------------------------------- | :--------- | :----- |
| Preflight | git fetch origin main; baseline6d6bd53; PR19 merged; clean worktree; Task024 unused; no open PR found | 2026-10-17 | PASS   |

## Owner decision — 2026-10-17

Owner explicitly approved Nginx + Certbot proposal in chat. Domain/DNS/host answer: not yet available. Implement parameterized approved ingress and disposable HTTPS harness; do not activate public deployment or claim production DNS/certificate/firewall/NTP verification. This is no longer an unresolved proxy selection. Actual deployment topology values and host evidence remain release gates.

## Local test-first and implementation evidence — 2026-10-17

Owner-approved ingress choice implemented; actual host/domain not supplied. Public release prerequisites remain open and this task cannot be COMPLETED on CI alone. A draft PR is needed to execute genuine hosted Prisma/PostgreSQL/HTTPS canonical checks before any ready-to-review claim.

| Claim                           | Evidence                                                                                                                                                                                                                                     | Date       | Result |
| :------------------------------ | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------- | :----- |
| Profile RED                     | node --test apps/api/test/public-profile.test.cjs at baseline: invalid/incomplete PUBLIC_HTTPS did not throw                                                                                                                                 | 2026-10-17 | FAIL   |
| Cookie/Host RED                 | New controller/profile and Web host tests before respective edits fail Secure/profile authority expectations                                                                                                                                 | 2026-10-17 | FAIL   |
| Startup RED                     | node --test apps/api/test/public-startup.test.cjs before implementation: missing public-startup module                                                                                                                                       | 2026-10-17 | FAIL   |
| Targeted GREEN                  | Profile/config, all7 cookie set/clear operations, canonical setup URL, real Nest trusted/untrusted HTTP attribution, startup guard/readiness unit probes and Web Host matrix:6 PASS after emitted-JS compilation; not full build/DB evidence | 2026-10-17 | PASS   |
| Host units                      | pnpm --filter @nexora/api test:133 PASS; pnpm --filter @nexora/web test:43 PASS; emitted-JS API units only                                                                                                                                   | 2026-10-17 | PASS   |
| Local static/contracts          | Pinned pnpm10.34.6 install --frozen-lockfile; lint/boundaries; test:lint50; Web typecheck; docs:check; test:docs6; test:operations3; contracts:check; format:check and git diff --check PASS                                                 | 2026-10-17 | PASS   |
| Genuine Prisma blocker          | prisma generate --config prisma.config.ts with synthetic generation-only URL fails binaries.prisma.sh schema-engine checksum HTTP403; API full build lacks genuine generated types. No fake client/engine/history or checksum bypass         | 2026-10-17 | FAIL   |
| Official ingress image versions | Authenticated public Docker Registry tag-list lookup confirmed nginx1.30.6-alpine and certbot/certbot:v5.8.0; actual image execution remains CI-required                                                                                     | 2026-10-17 | PASS   |

Ingress config and test harness are verification-first with explicit executable assertions; their presence is not runtime PASS. New HTTPS harness uses real signed SAN leaf/CA, strict Node trust/name and HTTP2 checks plus Chromium's narrowly pinned disposable leaf SPKI. No global TLS-validation disable. It exercises private container bindings/mounts/networks, actual ADMIN MFA and PASSWORD denial/recovery replay/cancel, HTTPS setup/reissue/disabled/expired/replayed token rules, privacy, forged headers/ingress429, file/Carrier preservation, real logical dump/isolated restore and restarted HTTPS session. All four previous Docker scripts remain required. Production DNS/cert issuance/renewal/firewall/NTP/production restore are NOT VERIFIED.

## Ingress review before final verification

Added explicit verification for TOTP success over real HTTPS as well as recovery, and for HSTS/nosniff on ingress429. Nginx add_header inheritance requires security-header inclusion in the error location as well as the server. Normalize slashes and match sensitive URI aliases case-insensitively, with optional trailing slash, to prevent routing-equivalent rate-limit bypass; real HTTPS regression bursts cover trailing/case/double/encoded slash aliases while forged XFF varies. Public startup negative probes have deadlines and require actual startup_failed output, never treating a timeout/config-command failure as expected rejection. These infrastructure assertions remain CI-required, not inspection-only PASS.

## First hosted execution and correction

[Foundation39002569382](https://github.com/dinhphuquy2k1/nexora/actions/runs/39002569382), sourcef7162f2abc201a07ad7e36e878a82fa60f5184c3, job117308399391: FAIL at new HTTPS orchestration, before TLS/browser assertions. Genuine frozen/quality/typecheck/build/contracts/migration tests passed,133 API units/43 Web/50 lint-rule and63 PostgreSQL integrations passed (including real registered public guard/read-only enrollment/key gate); complete existing runtime/CLI/TTY/browser smoke PASS. New HTTPS local bootstrap/CLI and encrypted Carrier/file fixture seeded successfully; waiting on db-runtime as the root --wait target incorrectly treated its successful exit0 as an unhealthy service. Correct the orchestration to wait for PostgreSQL health then explicitly run migrate and db-runtime one-offs; no migration/grant/security assertion weakened. Data/dev checks beyond the failed step were NOT RUN. Updated complete-source CI remains mandatory.

| Claim                               | Evidence                                                                                                                                            | Date       | Result |
| :---------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------- | :--------- | :----- |
| Genuine source quality and database | Same source/run: full quality/build/types/contracts and63 actual PostgreSQL tests PASS, including new public enrollment/key/runtime-role guard gate | 2026-10-17 | PASS   |
| LOCAL compatibility                 | Same source/run: complete runtime-smoke.sh with provisioning/TTY/browser/cancel/logout/restart security PASS                                        | 2026-10-17 | PASS   |
| HTTPS first orchestration           | Same run: bootstrap/fixture PASS, db-runtime exit0 rejected by root compose --wait target; TLS/public browser/data/dev not reached                  | 2026-10-17 | FAIL   |

## Second hosted execution: narrow the fixture failure

Run39003320320, source8879f3d199958c45532036e5825a0ac1baec971f, job117310612111: full quality/63 PG and LOCAL runtime again PASS. New HTTPS harness now completes private PG health, genuine migration and runtime role provisioning, then exits before positive ingress/browser. Captured one-off gate logs were not emitted, so the exact subsequent gate failure is not claimed from inspection. Add fixed stage labels and secret-free error categories. Hypothesis: binding a child certificate directory beneath the empty read-only named certificate volume fails mountpoint creation before entrypoint, so the expected TLS-custody diagnostic never appears. Override the entire /etc/letsencrypt root with the owned fixture's correctly shaped live/FQDN directory; production named-volume custody remains unchanged. Verify again; no skipped assertion or production behavior workaround.

| Claim                                 | Evidence                                                                                                                                 | Date       | Result |
| :------------------------------------ | :--------------------------------------------------------------------------------------------------------------------------------------- | :--------- | :----- |
| Corrected private dependency sequence | Same run: PostgreSQL health, genuine9-migration no-drift deploy and explicit restricted runtime provision one-offs complete successfully | 2026-10-17 | PASS   |
| Second HTTPS attempt                  | Same run stops during subsequent gate preparation before positive TLS/browser; no later data/dev verification claimed                    | 2026-10-17 | FAIL   |

## Third execution and explicit debug re-plan

Run39004085634 at9cea90f97bcfd3f1bf11a201d3fac242a55c43c8 (job117312857184): quality/63 PostgreSQL and LOCAL runtime PASS again. The corrected fixture now reaches and passes actual unenrolled ADMIN rejection, invalid Identity custody rejection and missing TLS custody rejection. Positive public API starts and stays healthy with real enrollment/key gates. Web process starts but its public healthcheck remains unhealthy; TLS ingress correctly refuses to activate while Web is unhealthy. No HTTPS/browser PASS is claimed.

Paused edits and re-evaluated the boundary after three full attempts. Reproduced the precise new failure with a real Node24 local HTTP server: fetch supplied Host=nexora.example.test:443 but server received127.0.0.1:<port>; raw node:http sent the intended public Host. Thus the healthcheck was being rejected by the strict public allowlist, not a reason to weaken it. New raw-HTTP public-healthcheck helper is shipped in Web's existing lib artifact tree, tested against a real listener and rejection/outage, and invoked by public Compose only. LOCAL healthcheck remains unchanged. This is test-first health transport correction, not an allowlist bypass or fake success.

| Claim                           | Evidence                                                                                                                                     | Date       | Result |
| :------------------------------ | :------------------------------------------------------------------------------------------------------------------------------------------- | :--------- | :----- |
| Actual public pre-listen gates  | Same run: fixed labels confirm unenrolled ADMIN, invalid Identity key and missing TLS certificate custody all rejected; positive API healthy | 2026-10-17 | PASS   |
| Public Web health transport RED | Same run fails Web health before ingress; independent real Node24 server confirms fetch overwrites Host, raw HTTP preserves it               | 2026-10-17 | FAIL   |

Full updated-source CI and the not-yet-executed HTTPS/browser/data/dev assertions remain required. No production gates closed from this diagnosis.

## Remaining verification-first ingress assertions

Add forced TLS1.2/HTTP2 checks and explicit forward-secret AEAD TLS1.2 suites. Replace the disposable certificate/key, validate Nginx config/reload, then require a fresh trusted-CA handshake with the new certificate fingerprint and the same valid application session. Production Certbot renewal remains NOT VERIFIED. Quiesce API/Web/ingress before file archiving, since readiness itself writes temporary storage probes; a network-disabled read-only helper archives the stopped API volumes. Verify file restoration separately and preserve all prior encrypted-data/session/credential assertions. New assertions remain pending actual CI execution.

## Fourth execution: public TLS/browser boundary reached

Run39005340957 at9765608c66569fb40829e764bfcb1bd4c2e57929 (job117316545581): full genuine quality/63 PG and complete LOCAL runtime PASS. All three negative startup gates PASS; positive API and Web are healthy, with the corrected raw-HTTP public Host health probe. Strict CA/name, forced TLS1.2, HTTP2, actual private container inspection, Host/Origin/forwarding rejection and real Chromium ADMIN recovery login/Secure cookies pass before the next step fails.

The owned raw SQL PASSWORD-session fixture omitted sessions.id. Historical migration requires this UUID with no database default (Prisma uuid() is client-side), so psql fails before the actual PASSWORD-session denial request. Add gen_random_uuid() only to this disposable fixture, with fixed secret-free SQL failure category and a narrower stage label. Review of the remaining sequence also caught navigation to the deliberately revoked original setup URL after reissue; navigate the reissued URL while retaining the explicit revoked-link rejection test. No schema/history/authorization relaxation. Remaining HTTPS/reload/restore/data/dev checks are not claimed PASS; full updated-source CI required.

## Fifth source execution and unchanged-head retry

Run39006000474 atcd8763d37d04314cfe005e4440230567cb3bdbc9 first attempt (job117318500036) passes genuine quality/PG and LOCAL proxy/CLI tests but fails before browser navigation: unchanged Chromium launch does not produce DevToolsActivePort within10 seconds. One unchanged-head retry is justified to separate startup infrastructure from application assertions; it does not weaken timeout/assertions. Retry job117319827070 passes the entire existing LOCAL browser/runtime and all quality/PG checks, so launch failure does not recur.

The retry reaches HTTPS PASSWORD-only ADMIN denial, new pending Secure cookie despite spoofed headers, consumed recovery replay rejection, real TOTP success, logout/cancel, canonical setup reissue, revoked/disabled/expired token rejection and logout invalidation. It then fails a setup privacy assertion after matching HTTP401, before setup password submission. The coarse diagnostic does not identify the exact assertion; do not claim an observed header value from these logs. Source inspection identifies Next /setup and Nginx both add Referrer-Policy. Independent real HTTP reproduction confirms Node combines duplicate no-referrer fields as no-referrer, no-referrer, which cannot satisfy the existing single-policy assertion. Make ingress authoritative with proxy_hide_header Referrer-Policy while retaining Next's LOCAL header; require exactly one raw field and keep exact no-referrer assertion. Add narrow fragment/referrer/SSR/submission/login stage labels. Full HTTPS execution remains necessary to validate this hypothesis and later reload/restore/data/dev checks.

## Sixth execution: correct browser-stage attribution

Run39007138720 ate9f1f9c10fdd20416b171fd498f71a2d47f58495 (job117321792413): quality/63 PG and full LOCAL runtime PASS; public startup/TLS/private-network/Origin checks again pass. Browser timeout is labelled REMOTE_OPERATOR_LOGIN_AND_STORAGE_PRIVACY, but source review catches that this new diagnostic label was accidentally also inserted before initial ADMIN login. Logs contain no later admin201/setup400 sequence, so this run does not prove the Referrer-Policy fix or OPERATOR failure. Correct the label and split ADMIN password/pending/mode/proof stages. The asynchronous recovery-mode click was followed immediately by typing into an input that may still have TOTP maxLength6; explicitly wait for the actual enabled recovery input maxLength35 before entering the fixture code. Preserve native browser input/proof, original deadlines and all assertions. Capture only whitelisted route labels and integer browser HTTP statuses on failure, never URLs/payloads/codes. A timeout now reports the existing fixed REQUEST_TIMEOUT category. Full updated-source execution remains required; no retry-until-green or skipped assertion.

## Seventh execution: HTTPS and certificate reload verified, restore query correction

Run39007780855 at4c4da2e07e8c31d8698dc2b80e232f483be23fb5 (job117323667726): genuine quality/63 PG and complete LOCAL runtime PASS. The entire HTTPS browser/Node harness now PASS, including single raw no-referrer header, remote setup completion/no auto-login/OPERATOR login, replay/privacy, all URI-alias ingress429 cases and actual private exposure checks. API/Web/ingress secret-log scan PASS. Disposable leaf replacement and safe Nginx reload serve the expected new fingerprint while preserving the CA-validated OPERATOR session. Original file/catalog and encrypted Carrier read checks PASS.

Writers stop, network-disabled read-only file archive and real logical dump/isolated database restore execute. The subsequent comparison query fails: user_mfa uses physical totp_secret_ciphertext, while ciphertext is only the Prisma field name. Historical schema and existing data-smoke both confirm the mapping. Correct this one test query column only; do not modify schema/migration or weaken comparison. File extraction/restart/final credential continuity and later data/dev smoke remain required at the updated source.

| Claim                                     | Evidence                                                                                                                                                                                                   | Date       | Result |
| :---------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------- | :----- |
| Real public HTTPS application and ingress | Same run/job, complete public-https-browser.mjs PASS: strict TLS CA/name, TLS1.2/HTTP2, native browser MFA/onboarding/privacy, negative Host/Origin/forwarding, private network/ports and Nginx429 aliases | 2026-10-17 | PASS   |
| Disposable TLS reload                     | Same run: nginx -t/reload plus fresh strict-CA session probe requires new certificate fingerprint and HTTP200                                                                                              | 2026-10-17 | PASS   |
| Restore comparison query                  | Same run: logical restore succeeds but user_mfa ciphertext SQL column is invalid; remaining restart/data/dev not reached                                                                                   | 2026-10-17 | FAIL   |
