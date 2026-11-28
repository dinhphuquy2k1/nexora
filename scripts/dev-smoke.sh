#!/bin/sh
export MSYS_NO_PATHCONV=1
set -eu
umask 077
cd "$(dirname "$0")/.."
project="nexora-dev-smoke-$$"
export COMPOSE_PROJECT_NAME="$project"
work=$(mktemp -d)
smoke_phase="START"
smoke_phase_start=$(date +%s)
set_phase(){ smoke_phase="$1"; smoke_phase_start=$(date +%s); }
cp packages/shared/src/index.ts "$work/shared.ts"
cp "apps/web/app/(workspace)/page.tsx" "$work/page.tsx"
cp package.json "$work/package.json"
compose(){
 if [ -n "${NEXORA_COMPOSE_OVERRIDE:-}" ]; then
  docker compose -f compose.yml -f compose.dev.yml -f "$NEXORA_COMPOSE_OVERRIDE" "$@"
 else
  docker compose -f compose.yml -f compose.dev.yml "$@"
 fi
}
cleanup(){
  status=$?
  trap - EXIT HUP INT TERM
  if [ "$status" -ne 0 ]; then
    phase_elapsed_ms=$(( ($(date +%s) - smoke_phase_start) * 1000 ))
    echo 'DEV_SMOKE_FAILED (private fixture and raw service logs withheld)' >&2
    ps_json=$(compose ps -a --format json 2>/dev/null || true)
    api_listener=$(compose exec -T api node --input-type=module -e 'import {readFileSync} from "node:fs"; const p=Number(process.env.PORT??4000).toString(16).toUpperCase().padStart(4,"0"); let ok=false; for(const t of ["tcp","tcp6"]){try{for(const l of readFileSync(`/proc/net/${t}`,"utf8").trim().split("\n").slice(1)){const f=l.trim().split(/\s+/); if(f[1]?.split(":").at(-1)===p&&f[3]==="0A")ok=true;}}catch{}} console.log(ok?"true":"false");' 2>/dev/null || echo 'null')
    health_json=$(compose exec -T web node --input-type=module -e 'const res={liveStatus:null,readyStatus:null,database:null,storage:null}; try{const l=await fetch("http://127.0.0.1:3000/api/health/live",{signal:AbortSignal.timeout(2000)}); res.liveStatus=l.status;}catch{} try{const r=await fetch("http://127.0.0.1:3000/api/health/ready",{signal:AbortSignal.timeout(2000)}); res.readyStatus=r.status; const b=await r.json().catch(()=>null); if(b&&typeof b.checks==="object"){if(typeof b.checks.database==="boolean")res.database=b.checks.database; if(typeof b.checks.storage==="boolean")res.storage=b.checks.storage;}}catch{} console.log(JSON.stringify(res));' 2>/dev/null || echo '{}')
    printf '%s' "$ps_json" | node --input-type=module -e 'import {readFileSync} from "node:fs"; import {formatDevSmokeFailure,summarizeComposeServices} from "./scripts/smoke-checks.mjs"; const [phase,elapsed,listener,healthRaw]=process.argv.slice(1); const ps=readFileSync(0,"utf8"); let h={}; try{h=JSON.parse(healthRaw);}catch{} const diag=formatDevSmokeFailure({phase,phaseElapsedMs:Number(elapsed),servicesSummary:summarizeComposeServices(ps),apiListenerPresent:listener==="true"?true:listener==="false"?false:null,liveStatus:h.liveStatus??null,readyChecks:{status:h.readyStatus??null,database:h.database??null,storage:h.storage??null}}); console.error("DEV_SMOKE_DIAGNOSTIC",JSON.stringify(diag));' "$smoke_phase" "$phase_elapsed_ms" "$api_listener" "$health_json" >&2 || true
    compose ps -a --format '{{.Service}} {{.State}} {{.Health}}' >&2 || true
  fi
  cp "$work/shared.ts" packages/shared/src/index.ts
  cp "$work/page.tsx" "apps/web/app/(workspace)/page.tsx"
  cp "$work/package.json" package.json
  compose down -v --remove-orphans >/dev/null || status=1
  rm -rf "$work"
  exit "$status"
}
trap cleanup EXIT
trap 'exit 129' HUP
trap 'exit 130' INT
trap 'exit 143' TERM
# Reuse the owned loopback allocation convention; never stop another listener.
dev_port=$(node --input-type=module -e 'import {createServer} from "node:net";const server=createServer();server.on("error",()=>process.exitCode=1);server.listen(0,"127.0.0.1",()=>{console.log(server.address().port);server.close();});')
export WEB_PORT="127.0.0.1:$dev_port" ALLOWED_ORIGINS=
export ALLOWED_HOSTS=localhost,127.0.0.1,nexora-dev.fixture
dev_origin="http://127.0.0.1:$dev_port"
IDENTITY_KEYRING_JSON=$(node -e 'console.log(JSON.stringify({1:require("node:crypto").randomBytes(32).toString("base64")}))')
export IDENTITY_KEYRING_JSON IDENTITY_ACTIVE_KEY_VERSION=1
# Synthetic runtime configuration only; live authorization remains closed.
export CARRIER_KEYRING_JSON='{"1":"AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE="}'
export CARRIER_ACTIVE_KEY_VERSION=1
export UNISHIP_API_URL=https://kh.uniship.vn
export UNISHIP_LIVE_AUTHORIZED=false
export UNISHIP_ACTIVATION_POLICY_JSON='{"ownerUserId":"11111111-1111-4111-8111-111111111111","externalAccountId":"1","loginIdentifier":"synthetic-dev","mode":"MANUAL_ONLY"}'
export UNISHIP_RECONCILIATION_POLICY_JSON='{"maxNewlyMissing":1,"maxMissingRatioBps":1,"maxObservedDropRatioBps":1}'
export SYNC_ENABLED=false SYNC_LEASE_SECONDS=120 SYNC_POLL_MS=250 SYNC_MAX_ATTEMPTS=7 SYNC_RESOLVED_RETENTION_DAYS=30
set_phase "BOOTSTRAP"
compose up -d --no-build --wait --wait-timeout 180
# Rebuilding shared dist with live watchers races the one-shot security assertion.
# Match quality-docker: stop writers (including sync-worker) before rebuilding, then require fresh health.
set_phase "DEPENDENCY_REBUILD"
compose stop api sync-worker web
compose run --rm --no-deps -T dependencies dependencies
compose up -d --no-build --wait --wait-timeout 180
# Inspect actual Turbo-launched HTTP listener and worker child, not container ENV.
# Reuse the service owner mapping: container root cannot ptrace another UID.
probe_runtime(){
for runtime_service in api sync-worker; do
  compose exec -T "$runtime_service" sh /workspace/scripts/dev-entrypoint.sh node --input-type=module -e 'import {waitForDevelopmentEnvironment} from "./scripts/dev-runtime-environment-probe.mjs"; try { console.log(JSON.stringify(await waitForDevelopmentEnvironment(process.argv[1], process.env, { onDiagnostic: (d) => console.error("DEV_ENV_PROBE_DIAGNOSTIC", JSON.stringify(d)) }))); } catch (err) { if (!err?.diagnostic) console.error("DEV_ENV_PROBE_DIAGNOSTIC", JSON.stringify({ kind: process.argv[1], reason: err?.code ?? "UNEXPECTED" })); throw err; }' "$runtime_service"
done
 }
set_phase "INITIAL_RUNTIME_PROBE"
probe_runtime
set_phase "DEV_UNENROLLED_ADMIN_DENIAL"
printf '%s' 'DevSmokePass123!' | compose exec -T api sh /workspace/scripts/api-entrypoint.sh node scripts/user-create.mjs --username dev_smoke_user --password-stdin
# Explicit new security assertion: trusted provisioning alone never enables ADMIN login.
compose exec -T -e DEV_SMOKE_ORIGIN="$dev_origin" web node <<'JS'
(async()=>{const r=await fetch('http://127.0.0.1:3000/api/auth/login',{method:'POST',headers:{'content-type':'application/json',origin:process.env.DEV_SMOKE_ORIGIN},body:JSON.stringify({username:'dev_smoke_user',password:'DevSmokePass123!'})});const b=await r.json();if(r.status!==403||b.code!=='MFA_ENROLLMENT_REQUIRED'||r.headers.get('set-cookie'))throw Error('ADMIN enrollment gate failed');console.log('Dev unenrolled ADMIN password-only denial PASS');})().catch(()=>process.exitCode=1);
JS
# Keep the existing unenrolled fixture separate from actual enrolled ADMIN coverage.
set_phase "MFA_ENROLLMENT_AND_HTTP_SMOKE"
printf '%s' 'BrowserTestPass123!' | compose exec -T api sh /workspace/scripts/dev-entrypoint.sh sh /workspace/scripts/api-entrypoint.sh node apps/api/dist/cli/user-create.js --username browser_user --password-stdin
python3 scripts/mfa-enrollment-tty-smoke.py --development "$work/fixture.json"
node scripts/dev-mfa-http-smoke.mjs "$work/fixture.json" --origin-derived
node scripts/dev-mfa-http-smoke.mjs "$work/fixture.json"
set_phase "RESTART_RECOVERY"
compose restart api
compose up -d --no-build --wait --wait-timeout 180 api
probe_runtime
node scripts/dev-mfa-http-smoke.mjs "$work/fixture.json" --after-restart
# Compose ENV changes require recreation; verify prerequisites once then recreate only api with --no-deps so shared dist is not rewritten mid-watch.
export ALLOWED_ORIGINS="$dev_origin"
set_phase "RECREATE_API_PRECHECK"
compose ps -a --format json | node --input-type=module -e 'import {readFileSync} from "node:fs"; import {verifyDevSmokeDependenciesReady} from "./scripts/smoke-checks.mjs"; const res = verifyDevSmokeDependenciesReady(readFileSync(0, "utf8")); if (!res.ready) { console.error("DEV_SMOKE_DEPENDENCY_PRECHECK_FAILED", JSON.stringify(res)); process.exit(1); }'
set_phase "RECREATE_API_WITH_EXPLICIT_ORIGIN"
compose up -d --no-deps --no-build --force-recreate --wait --wait-timeout 180 api
set_phase "RECREATE_API_RUNTIME_PROBE"
probe_runtime
node scripts/dev-mfa-http-smoke.mjs "$work/fixture.json" --origin-explicit
set_phase "HMR_PROPAGATION"
# Preserve the original OPERATOR HMR/workspace/drift/data fixture and assertions.
compose exec -T postgres psql -U nexora -d nexora -v ON_ERROR_STOP=1 -c "UPDATE users SET role='OPERATOR' WHERE username='dev_smoke_user';" >/dev/null

compose run --rm --no-deps -T api node -e "const f=require('fs');const p='packages/shared/src/index.ts';f.writeFileSync(p,f.readFileSync(p,'utf8').replace('Nexora','Nexora workspace propagation'));const q='apps/web/app/(workspace)/page.tsx';f.writeFileSync(q,f.readFileSync(q,'utf8').replace('Quản lý vận đơn,','HMR source verified,'));"
compose exec -T -e DEV_SMOKE_ORIGIN="$dev_origin" web node <<'JS'
(async()=>{
  let cookie = '';
  for(let i=0;i<30;i++){
    try{
      const lr=await fetch('http://127.0.0.1:3000/api/auth/login',{
        method:'POST',
        headers:{'content-type':'application/json',origin:process.env.DEV_SMOKE_ORIGIN},
        body:JSON.stringify({username:'dev_smoke_user',password:'DevSmokePass123!'})
      });
      if(lr.ok){
        cookie=lr.headers.get('set-cookie')?.split(';')[0]||'';
        if(/^nexora_session=[a-f0-9]{64}$/.test(cookie))break;
      }
    }catch{}
    await new Promise(r=>setTimeout(r,1000));
  }
  for(let i=0;i<60;i++){
    try{
      const r=await fetch('http://127.0.0.1:3000',{headers:{cookie}});
      const s=await r.text();
      if(r.ok&&s.includes('Nexora workspace propagation')&&s.includes('HMR source verified')){
        console.log('Web HMR + shared workspace propagation PASS');
        return;
      }
    }catch{}
    await new Promise(r=>setTimeout(r,1000));
  }
  process.exitCode=1;
})();
JS
set_phase "DATA_PERSISTENCE"
compose exec -T postgres psql -U nexora -d nexora -v ON_ERROR_STOP=1 <<'SQL'
INSERT INTO stored_files (id,sha256,"sizeBytes") VALUES ('11111111-1111-4111-8111-111111111111',repeat('a',64),1);
SQL
compose stop api web
compose run --rm --no-deps -T api node -e "const f=require('fs');const p=JSON.parse(f.readFileSync('package.json'));p.devDependencies['left-pad']='1.3.0';f.writeFileSync('package.json',JSON.stringify(p,null,2)+'\n')"
compose rm -f api web dependencies
if compose up -d --no-build api web > "$work/drift.log" 2>&1; then echo 'Frozen drift failed to block startup' >&2; exit 1; fi
compose logs dependencies >> "$work/drift.log"
grep -q ERR_PNPM_OUTDATED_LOCKFILE "$work/drift.log"
compose exec -T postgres psql -U nexora -d nexora -Atqc "SELECT count(*) FROM stored_files WHERE id='11111111-1111-4111-8111-111111111111'" | grep -qx 1
cp "$work/package.json" package.json
cp "$work/shared.ts" packages/shared/src/index.ts
cp "$work/page.tsx" "apps/web/app/(workspace)/page.tsx"
compose up -d --no-build --wait --wait-timeout 180
echo 'Dev frozen install/HMR/workspace/drift/data preservation PASS'
