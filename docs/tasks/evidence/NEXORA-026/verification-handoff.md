# NEXORA-026 — Final verification handoff

Documentation Impact: REQUIRED. This is an execution procedure, not PASS evidence. Read [Testing](../../../operations/testing.md) and the [active task](../../active/NEXORA-026-multi-carrier-retail-ui.md). Implementation remains IMPLEMENTED; task VERIFICATION PENDING until mandatory gates have executed successfully. Final exact-head results belong in the PR description/handoff, not another commit naming its own future result.

## Prerequisites

Use an authorized disposable Linux host or WSL2 Linux checkout and dedicated Docker daemon, with no user workloads/volumes or production environment files. The canonical scripts use fixed nexora image tags and some PID-derived project names; a separate checkout alone does not isolate those images. Do not run against an operator's daemon. No public deployment or live Carrier access is needed.

Require Git, Node24.19.0, pnpm10.34.6, Docker Engine with Compose v2 supporting !reset/additional_contexts, Python3 with PTY, OpenSSL, curl and Chromium/Chrome (CHROME_BIN if needed). The managed verification environment used Docker28.4.0/Compose2.40.3. Use a non-root account for the browser harness. Ports127.0.0.1:3096/4096 must be free for retail smoke; use a free WEB_PORT and POSTGRES_PORT below. Container downloads require verified HTTPS access to registry.npmjs.org, binaries.prisma.sh (engine and checksum), configured Docker registries/CDNs and Debian repositories. Preserve the authorized proxy/CA configuration. A denied CONNECT403 requires an approved environment/policy change; do not disable TLS/checksum, replace the engine/client or alter database privileges.

Do not copy .env, credentials, production keyrings or database data into the checkout. In a corporate proxy environment, provision the normal trust bundle to every networked build/runtime stage using the existing build_ca secret support and an inspected Compose override. Do not assume NEXORA_COMPOSE_OVERRIDE applies to every script: quality/runtime/data support it; public-HTTPS/development do not. The commands below target a host with standard verified trust/egress and no override requirement.

## Exact source and independent frontend checks

Set REVIEW_SHA to the full final PR head from GitHub; the reviewed baseline was cd4ec61d3d6e7c4b1da61fa7ec0286cf8e33c3f4. Run in a fresh parent directory. Evidence stays outside Git. Do not use an old build output for a new production source tree.

```bash
export REVIEW_SHA=FULL_FINAL_PR_HEAD
mkdir nexora-pr22-verification
cd nexora-pr22-verification
git clone --branch feat/multi-carrier-retail-ui https://github.com/dinhphuquy2k1/nexora.git checkout
cd checkout
git checkout --detach "$REVIEW_SHA"
test "$(git rev-parse HEAD)" = "$REVIEW_SHA"
test -z "$(git status --porcelain)"
export EVIDENCE_DIR="$(cd .. && pwd)/evidence-$REVIEW_SHA"
mkdir -m 700 "$EVIDENCE_DIR"
date -u +%FT%TZ > "$EVIDENCE_DIR/started-utc.txt"
git rev-parse HEAD > "$EVIDENCE_DIR/source-sha.txt"
git status --porcelain > "$EVIDENCE_DIR/status-before.txt"
node --version > "$EVIDENCE_DIR/node.txt"
pnpm --version > "$EVIDENCE_DIR/pnpm.txt"
docker version --format '{{.Server.Version}}' > "$EVIDENCE_DIR/docker.txt"
docker compose version --short > "$EVIDENCE_DIR/compose.txt"
"${CHROME_BIN:-chromium}" --version > "$EVIDENCE_DIR/browser.txt"
```

Execute the following commands individually. For **each** command record UTC start/end, exact command, exit code, source SHA and status before/after; capture stdout/stderr in its named log. Stop dependent steps when a prerequisite fails and explicitly label them NOT RUN. Do not infer PASS from an empty log or from this procedure.

```bash
pnpm install --frozen-lockfile > "$EVIDENCE_DIR/install.log" 2>&1
pnpm --filter @nexora/database generate > "$EVIDENCE_DIR/prisma.log" 2>&1
pnpm --filter @nexora/web test > "$EVIDENCE_DIR/web-tests.log" 2>&1
pnpm --filter @nexora/web typecheck > "$EVIDENCE_DIR/web-typecheck.log" 2>&1
API_INTERNAL_URL=http://127.0.0.1:4096 pnpm --filter @nexora/web... build > "$EVIDENCE_DIR/web-build.log" 2>&1
pnpm lint > "$EVIDENCE_DIR/lint-boundaries.log" 2>&1
pnpm format:check > "$EVIDENCE_DIR/format.log" 2>&1
pnpm docs:check > "$EVIDENCE_DIR/docs.log" 2>&1
pnpm test:docs > "$EVIDENCE_DIR/test-docs.log" 2>&1
pnpm test:operations > "$EVIDENCE_DIR/test-operations.log" 2>&1
pnpm test:lint > "$EVIDENCE_DIR/test-lint.log" 2>&1
docker pull node:24.19.0-bookworm-slim > "$EVIDENCE_DIR/retail-image.log" 2>&1
node scripts/retail-ui-smoke.mjs "$EVIDENCE_DIR/retail" > "$EVIDENCE_DIR/retail.log" 2>&1
```

Leave NEXORA_RETAIL_REVIEW_CASE unset for all12 groups. Retail summary.json must say FRONTEND_FIXTURE_ONLY, source SHA unchanged, dirtyBefore/dirtyAfter false, cleanup PASS. Preserve font-evidence.json and screenshots: local WOFF2 byte equality/custom Inter Vietnamese glyph usage, controls/dialog, stable trigger, drawer keyboard/navigation, selector history/search/list-only scrolling, invalid scope and redirect query assertions. No fixture proves actual Nest/PostgreSQL authorization or successful credential/MFA login.

## Canonical real-backend verification

Run sequentially on the dedicated daemon. Do not set \*\_NO_BUILD flags or weaken assertions. Confirm selected loopback ports are free; change the two example port numbers if needed. Quality has no volume cleanup; this block cleans only its freshly created project. The other four scripts own their own disposable projects and traps. Never replace the guarded cleanup with a global prune/down/reset.

```bash
set -eu
export WEB_PORT=127.0.0.1:39991
export POSTGRES_PORT=39992
export CI=true
export COMPOSE_PROJECT_NAME="nexora-pr22-quality-$(node -p 'require("node:crypto").randomUUID()')"
for resource in container volume network; do
  test -z "$(docker "$resource" ls -q --filter "label=com.docker.compose.project=$COMPOSE_PROJECT_NAME")" || exit 1
done
quality_status=0
sh scripts/quality-docker.sh > "$EVIDENCE_DIR/quality-docker.log" 2>&1 || quality_status=$?
printf '%s\n' "$quality_status" > "$EVIDENCE_DIR/quality-docker.exit"
docker compose -f compose.yml -f compose.dev.yml down -v --remove-orphans > "$EVIDENCE_DIR/quality-cleanup.log" 2>&1
# Continue only if actual quality, integration and migration assertions passed.
test "$quality_status" -eq 0 || exit 1
sh scripts/runtime-smoke.sh > "$EVIDENCE_DIR/runtime.log" 2>&1
sh scripts/public-https-smoke.sh > "$EVIDENCE_DIR/public-https.log" 2>&1
sh scripts/data-smoke.sh > "$EVIDENCE_DIR/data.log" 2>&1
sh scripts/dev-smoke.sh > "$EVIDENCE_DIR/dev.log" 2>&1
git diff --check > "$EVIDENCE_DIR/diff-check.log"
git status --porcelain > "$EVIDENCE_DIR/status-after.txt"
test -z "$(git status --porcelain)"
date -u +%FT%TZ > "$EVIDENCE_DIR/finished-utc.txt"
```

The listed scripts are the canonical entrypoints at this branch, not scripts copied from another PR. Quality executes unit/docs/operations/contracts/build, real Nest/PostgreSQL integration and genuine migrations. Inspect carrier-foundation, identity and mfa integration outputs for actual owner/foreign-owner/ADMIN and OPERATOR/MFA/session assertions. Runtime additionally drives CLI/PTY and real Chromium login/onboarding/logout. Disposable HTTPS uses local test certificates/keys and loopback ingress; it does not establish production DNS, trusted public issuance/renewal, firewall/NAT/IPv6, NTP, admin enrollment/key custody or real off-host encrypted backup/restore/rollback readiness.

Additional retail login-return acceptance remains a real-backend browser gate: with disposable CLI-provisioned OPERATOR and CLI-enrolled ADMIN, navigate to `/shipments/retail?provider=uniship&connection=11111111-1111-4111-8111-111111111111&q=review&page=3`, once with no session and once after actual session revocation. Verify the full sanitized return URL through password login and ADMIN MFA, no workspace/session before MFA, then the exact original retail query. A missing/non-owned connection must stay invalid after login, never broaden. Retain the existing hostile external/protocol-relative/backslash return-URL tests. Capture only URL/status/assertion summaries; never passwords, OTPs, recovery/setup tokens, cookies or key material. Canonical generic login tests and fixture redirect tests alone do not establish this complete real-backend scoped-return matrix.

## Handoff and cleanup evidence

Publish a table with every command's exit code/result and environment, exact SHA/status/timestamps and which assertions really ran. Separate frontend fixture from real backend. Keep prior FAILs and NOT RUNs; do not re-label them. Inspect logs privately before sharing because harnesses may handle synthetic credentials. Attach only sanitized results/font/screenshots and checksums. Record final GitHub Foundation run, required step execution and actual checkout merge/head from its logs; an unavailable/failed job is never PASS. Update PR description after verification without another SHA-only documentation commit. Do not approve, resolve review threads, merge or deploy as part of this procedure.
