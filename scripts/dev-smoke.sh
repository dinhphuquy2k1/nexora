#!/bin/sh
export MSYS_NO_PATHCONV=1
set -eu
cd "$(dirname "$0")/.."
project="nexora-dev-smoke-$$"
export COMPOSE_PROJECT_NAME="$project"
work=$(mktemp -d)
cp packages/shared/src/index.ts "$work/shared.ts"
cp "apps/web/app/(workspace)/page.tsx" "$work/page.tsx"
cp package.json "$work/package.json"
cleanup(){
  status=$?; if [ "$status" -ne 0 ]; then docker compose -f compose.yml -f compose.dev.yml logs --no-color --tail 60 >&2; fi;  cp "$work/shared.ts" packages/shared/src/index.ts; cp "$work/page.tsx" "apps/web/app/(workspace)/page.tsx"; cp "$work/package.json" package.json; docker compose -f compose.yml -f compose.dev.yml down -v --remove-orphans >/dev/null; rm -rf "$work"; }
trap cleanup EXIT HUP INT TERM
compose(){ docker compose -f compose.yml -f compose.dev.yml "$@"; }
compose up -d --no-build --wait --wait-timeout 180
compose run --rm --no-deps -T dependencies dependencies
printf '%s' 'DevSmokePass123!' | compose exec -T api sh /workspace/scripts/api-entrypoint.sh node scripts/user-create.mjs --username dev_smoke_user --password-stdin
# Explicit new security assertion: trusted provisioning alone never enables ADMIN login.
compose exec -T web node <<'JS'
(async()=>{const r=await fetch('http://127.0.0.1:3000/api/auth/login',{method:'POST',headers:{'content-type':'application/json',origin:'http://127.0.0.1:3001'},body:JSON.stringify({username:'dev_smoke_user',password:'DevSmokePass123!'})});const b=await r.json();if(r.status!==403||b.code!=='MFA_ENROLLMENT_REQUIRED'||r.headers.get('set-cookie'))throw Error('ADMIN enrollment gate failed');console.log('Dev unenrolled ADMIN password-only denial PASS');})().catch(()=>process.exitCode=1);
JS
# This owned disposable fixture tests unchanged OPERATOR HMR; real ADMIN MFA
# enrollment/browser/restart is exercised separately by runtime-smoke.sh.
compose exec -T postgres psql -U nexora -d nexora -v ON_ERROR_STOP=1 -c "UPDATE users SET role='OPERATOR' WHERE username='dev_smoke_user';" >/dev/null

compose run --rm --no-deps -T api node -e "const f=require('fs');const p='packages/shared/src/index.ts';f.writeFileSync(p,f.readFileSync(p,'utf8').replace('Nexora','Nexora workspace propagation'));const q='apps/web/app/(workspace)/page.tsx';f.writeFileSync(q,f.readFileSync(q,'utf8').replace('Quản lý vận đơn,','HMR source verified,'));"
compose exec -T web node <<'JS'
(async()=>{
  let cookie = '';
  for(let i=0;i<30;i++){
    try{
      const lr=await fetch('http://127.0.0.1:3000/api/auth/login',{
        method:'POST',
        headers:{'content-type':'application/json',origin:'http://127.0.0.1:3001'},
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
