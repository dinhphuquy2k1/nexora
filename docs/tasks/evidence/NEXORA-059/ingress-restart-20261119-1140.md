# NEXORA-059 — ingress restart hypothesis: existing E3 evidence

## Scope and method

Read-only Phase1 follow-up on HEAD `458a6baadfd049679957eb08acb05b49f3509285`. No new CI dispatch, rerun, label, runtime execution or diagnostics/code modification. Existing local ZIP-derived environment.json/failure.json reused; no artifacts re-downloaded. E3 run44455913317 attempt1: failing trials3/8/13 and PASS controls1/2/7. Ordinary Foundation44454184736 attempt1 is separate, outside the E3 denominator. Source checkpoint900950ea652054e940560cfbca52df2f5b4ac693; actual checkout95c09918aafae781855eb9833a906b2949b87d3d for all seven samples. All times UTC; filename uses Asia/Ho_Chi_Minh.

Attempted `gh run view 44455913317 --job 135330813031 --log`: exit0 but zero bytes, so not treated as evidence. Used GitHub workflow-job-log API through connector fallback for all seven job IDs. Only fixed Compose lifecycle lines, safe fixture markers and nginx configuration diagnostics retained; container names replaced with `[ingress container]`. No header/cookie/token/IP/MAC/container ID or raw log archive committed. Existing artifact hashes/provenance remain in [E3 evidence](e3-20261119-1105.md).

## Verdict: (c) KHÔNG phải khởi động lại

For these four failed samples, the ingress/start in the failure window is the **initial start of the main ingress container**, not an observed automatic restart of that container. The earlier ingress start → die → destroy belongs to the deliberate missing-TLS one-off, followed by create → start for the main service. No main-ingress die/kill/restart occurs between main create/start and browser failure in retained events; kill/stop/die/destroy occurs after failure during cleanup. Thus the proposed nginx-exit/unless-stopped-restart sequence is not observed and does not explain this particular start event. This is not proof that ingress never restarts in other runs, nor attribution of the actual network actor.

## Code evidence and observation limits

- [Missing-TLS one-off and main start](../../../../scripts/public-https-smoke.sh): lines109–116 execute `run --rm --no-deps ... ingress`, require TLS rejection, then `up ... ingress`, then browser. The shell publishes `Missing TLS custody rejection PASS` between the two container lifecycles in each failed log.
- `scripts/public-https-smoke.sh:46` prints only last40 service-log lines on failure; line47 then tears down the owned fixture. Lines118–122 keep successful main-browser server logs private and emit only the secret-log check PASS. PASS absence of public nginx lines means NOT RETAINED, not no nginx errors.
- `scripts/public-https-smoke.sh:132–137` explicitly tests nginx reload and then stops ingress; lines151–156 explicitly start ingress, then restart api/web/ingress. PASS control restart events after main-browser PASS match these fixture operations, not an unexpected browser-stage restart.
- `scripts/public-https-diagnostics.mjs:566–582` already allows **die, kill, oom, restart, stop, destroy and all three health_status values**. No allowlist omission of die. Lines638–647 retain only Type/Action/service/atUTC: **no exit code, container identity or one-off flag**. Mapping one-off versus main relies on create/destroy order, Compose output, TLS marker and source sequence, not retained IDs.
- `scripts/public-https-diagnostics.mjs:639–642` is a200-event rolling buffer. `environment.json` is the final whole-step snapshot, not an uncapped complete history. All retained ingress events are listed below, separately for environment.json and failure.json. Failed samples retain both creates and starts around the TLS/main transition, including the interval before failure. PASS final buffers have already evicted the TLS/main-browser lifecycle: their retained start counts are lower bounds for step8, never complete counts.
- `docker/public/nginx.conf.template:2` is `error_log /dev/stderr crit;`: emerg/alert/crit may be logged, ordinary error/notice-level startup/signal lines are suppressed. `docker/public/ingress-entrypoint.sh:7–9` performs envsubst, nginx -t, exec nginx; it does not print an entrypoint-start marker. Zero worker-start or entrypoint messages cannot count process starts.
- `compose.public.yml:35–55` has restart unless-stopped and no ingress healthcheck; this configuration alone does not demonstrate a restart. Compose output Healthy is not proof of an ingress healthcheck.

## Sample comparison

| Sample / job                                                                                                            | Result | Retained ingress starts in final200                          | Starts during main browser                                                                         | die / exit code                       | nginx errors / signals                                 | Timing                                                                                                       |
| ----------------------------------------------------------------------------------------------------------------------- | ------ | ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- | ------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| E3 trial 3 / [135330812855](https://github.com/dinhphuquy2k1/nexora/actions/runs/44455913317/job/135330812855)          | FAIL8  | 2 (TLS one-off + main initial)                               | main initial start precedes browser; no subsequent start before failure                            | 2 retained die; ExitCode NOT RETAINED | none in retained ingress tail;2 nginx -t success lines | main start 2026-11-19T04:19:25.592Z; failure 2026-11-19T04:19:27.577Z; cleanup kill 2026-11-19T04:19:33.076Z |
| E3 trial 8 / [135330813031](https://github.com/dinhphuquy2k1/nexora/actions/runs/44455913317/job/135330813031)          | FAIL8  | 2 (TLS one-off + main initial)                               | main initial start precedes browser; no subsequent start before failure                            | 2 retained die; ExitCode NOT RETAINED | none in retained ingress tail;2 nginx -t success lines | main start 2026-11-19T04:19:30.800Z; failure 2026-11-19T04:19:32.696Z; cleanup kill 2026-11-19T04:19:38.198Z |
| E3 trial 13 / [135330812888](https://github.com/dinhphuquy2k1/nexora/actions/runs/44455913317/job/135330812888)         | FAIL8  | 2 (TLS one-off + main initial)                               | main initial start precedes browser; no subsequent start before failure                            | 2 retained die; ExitCode NOT RETAINED | none in retained ingress tail;2 nginx -t success lines | main start 2026-11-19T04:19:22.372Z; failure 2026-11-19T04:19:24.272Z; cleanup kill 2026-11-19T04:19:29.771Z |
| E3 trial 1 / [135330812821](https://github.com/dinhphuquy2k1/nexora/actions/runs/44455913317/job/135330812821)          | PASS   | 2 (later restore + explicit restart; earlier starts evicted) | one initial start in Compose log; main-browser Docker interval evicted, extra restart not excluded | 2 retained die; ExitCode NOT RETAINED | server log private; no nginx error lines retained      | retained starts are after main-browser PASS; see ordered log markers below                                   |
| E3 trial 2 / [135330812782](https://github.com/dinhphuquy2k1/nexora/actions/runs/44455913317/job/135330812782)          | PASS   | 2 (later restore + explicit restart; earlier starts evicted) | one initial start in Compose log; main-browser Docker interval evicted, extra restart not excluded | 2 retained die; ExitCode NOT RETAINED | server log private; no nginx error lines retained      | retained starts are after main-browser PASS; see ordered log markers below                                   |
| E3 trial 7 / [135330812837](https://github.com/dinhphuquy2k1/nexora/actions/runs/44455913317/job/135330812837)          | PASS   | 2 (later restore + explicit restart; earlier starts evicted) | one initial start in Compose log; main-browser Docker interval evicted, extra restart not excluded | 2 retained die; ExitCode NOT RETAINED | server log private; no nginx error lines retained      | retained starts are after main-browser PASS; see ordered log markers below                                   |
| Ordinary Foundation / [135325095085](https://github.com/dinhphuquy2k1/nexora/actions/runs/44454184736/job/135325095085) | FAIL8  | 2 (TLS one-off + main initial)                               | main initial start precedes browser; no subsequent start before failure                            | 2 retained die; ExitCode NOT RETAINED | none in retained ingress tail;2 nginx -t success lines | main start 2026-11-19T04:03:51.771Z; failure 2026-11-19T04:04:03.232Z; cleanup kill 2026-11-19T04:04:03.452Z |

All seven preexisting snapshots: OBSERVED0containers (including0 nexora-ci running). Four failed final buffers have2 ingress starts (one-off plus main); PASS buffers have2 later starts only. Counts are not directly comparable because PASS scripts run longer and evict early events. Complete step8 counts for PASS are NOT AVAILABLE; Compose logs show three main-service starts over the whole fixture (initial, restore, explicit restart), plus the intended one-off whose early events are evicted.

### Request-relative timing

- Trial13: main start04:19:22.372Z; OPERATOR_CREATE04:19:24.252Z–04:19:24.272Z (ERR_NETWORK_CHANGED); no intervening ingress die/start; cleanup kill04:19:29.771Z.
- Trial8: main start04:19:30.800Z; OPERATOR_CREATE04:19:32.673Z–04:19:32.695Z (ERR_NETWORK_CHANGED); no intervening ingress die/start; cleanup kill04:19:38.198Z.
- Trial3: main start04:19:25.592Z; failure04:19:27.577Z, CHECK_FAILED with no retained failed request/script. Do not recast this as confirmed NETWORK_CHANGED. Cleanup kill04:19:33.076Z.
- Ordinary: main start04:03:51.771Z; Next Script failures04:03:52.987Z–04:03:53.010Z; browser failure04:04:03.232Z. Cleanup kill04:04:03.452Z. No ingress die/start in between.

## E3 trial 3 — job 135330812855

Artifact ID14498552318, `sha256:46faf04b5722243234a9fc1a1de80aa1fc1c13b03b1e7afdce2d7eb34e40a632`. Final Docker observer STOPPED, reason `null`, dropped209. These dropped counts are global rolling-buffer evictions, not evidence of missing a specific ingress event.

### All retained ingress events — environment.json

| UTC                      | Type      | Action  | Service |
| ------------------------ | --------- | ------- | ------- |
| 2026-11-19T04:19:10.842Z | container | create  | ingress |
| 2026-11-19T04:19:10.845Z | container | other   | ingress |
| 2026-11-19T04:19:10.916Z | container | start   | ingress |
| 2026-11-19T04:19:10.958Z | container | die     | ingress |
| 2026-11-19T04:19:10.960Z | container | destroy | ingress |
| 2026-11-19T04:19:11.082Z | container | create  | ingress |
| 2026-11-19T04:19:25.592Z | container | start   | ingress |
| 2026-11-19T04:19:33.076Z | container | kill    | ingress |
| 2026-11-19T04:19:33.202Z | container | stop    | ingress |
| 2026-11-19T04:19:33.203Z | container | die     | ingress |
| 2026-11-19T04:19:33.205Z | container | destroy | ingress |

### All retained ingress events — failure.json environment (already ±5s projected)

| UTC                      | Type      | Action | Service |
| ------------------------ | --------- | ------ | ------- |
| 2026-11-19T04:19:25.592Z | container | start  | ingress |

### Safe log excerpts

GitHub timestamps below are log emission/collection times. Nginx tail lines are emitted by cleanup; they do not timestamp the original nginx startup. No qualifying emerg/alert/crit/error/exited/signal line found in the retained ingress log. Worker-process-start count0 and entrypoint-marker count0 are non-diagnostic under current logging.

```text
2026-11-19T04:19:10.9641963Z Missing TLS custody rejection PASS
2026-11-19T04:19:11.0783496Z  Container [ingress container]  Creating
2026-11-19T04:19:11.0833432Z  Container [ingress container]  Created
2026-11-19T04:19:25.5029193Z  Container [ingress container]  Starting
2026-11-19T04:19:25.5929699Z  Container [ingress container]  Started
2026-11-19T04:19:25.5932360Z  Container [ingress container]  Waiting
2026-11-19T04:19:26.0948129Z  Container [ingress container]  Healthy
2026-11-19T04:19:27.5779682Z PUBLIC_HTTPS_SMOKE_FAILED
2026-11-19T04:19:27.5780164Z Step: CANONICAL_HTTPS_REMOTE_OPERATOR_SETUP
2026-11-19T04:19:33.0005970Z ingress-1  | nginx: the configuration file /etc/nginx/nginx.conf syntax is ok
2026-11-19T04:19:33.0006383Z ingress-1  | nginx: configuration file /etc/nginx/nginx.conf test is successful
```

## E3 trial 8 — job 135330813031

Artifact ID14497988327, `sha256:5ef2d874983f879d249eda15eceab5168e2b4f4dd72ec26511793ac2b5cf2c6e`. Final Docker observer STOPPED, reason `null`, dropped209. These dropped counts are global rolling-buffer evictions, not evidence of missing a specific ingress event.

### All retained ingress events — environment.json

| UTC                      | Type      | Action  | Service |
| ------------------------ | --------- | ------- | ------- |
| 2026-11-19T04:19:15.982Z | container | create  | ingress |
| 2026-11-19T04:19:15.985Z | container | other   | ingress |
| 2026-11-19T04:19:16.074Z | container | start   | ingress |
| 2026-11-19T04:19:16.115Z | container | die     | ingress |
| 2026-11-19T04:19:16.116Z | container | destroy | ingress |
| 2026-11-19T04:19:16.239Z | container | create  | ingress |
| 2026-11-19T04:19:30.800Z | container | start   | ingress |
| 2026-11-19T04:19:38.198Z | container | kill    | ingress |
| 2026-11-19T04:19:38.320Z | container | stop    | ingress |
| 2026-11-19T04:19:38.321Z | container | die     | ingress |
| 2026-11-19T04:19:38.323Z | container | destroy | ingress |

### All retained ingress events — failure.json environment (already ±5s projected)

| UTC                      | Type      | Action | Service |
| ------------------------ | --------- | ------ | ------- |
| 2026-11-19T04:19:30.800Z | container | start  | ingress |

### Safe log excerpts

GitHub timestamps below are log emission/collection times. Nginx tail lines are emitted by cleanup; they do not timestamp the original nginx startup. No qualifying emerg/alert/crit/error/exited/signal line found in the retained ingress log. Worker-process-start count0 and entrypoint-marker count0 are non-diagnostic under current logging.

```text
2026-11-19T04:19:16.1207687Z Missing TLS custody rejection PASS
2026-11-19T04:19:16.2352416Z  Container [ingress container]  Creating
2026-11-19T04:19:16.2399822Z  Container [ingress container]  Created
2026-11-19T04:19:30.7030609Z  Container [ingress container]  Starting
2026-11-19T04:19:30.8006435Z  Container [ingress container]  Started
2026-11-19T04:19:30.8007107Z  Container [ingress container]  Waiting
2026-11-19T04:19:31.3026183Z  Container [ingress container]  Healthy
2026-11-19T04:19:32.6970300Z PUBLIC_HTTPS_SMOKE_FAILED
2026-11-19T04:19:32.6970791Z Step: CANONICAL_HTTPS_REMOTE_OPERATOR_SETUP
2026-11-19T04:19:38.1184201Z ingress-1  | nginx: the configuration file /etc/nginx/nginx.conf syntax is ok
2026-11-19T04:19:38.1184789Z ingress-1  | nginx: configuration file /etc/nginx/nginx.conf test is successful
```

## E3 trial 13 — job 135330812888

Artifact ID14498577329, `sha256:2701b7baf0230e1898df0abd6cec038137162a8e60612a0413e36315621be3c2`. Final Docker observer STOPPED, reason `null`, dropped206. These dropped counts are global rolling-buffer evictions, not evidence of missing a specific ingress event.

### All retained ingress events — environment.json

| UTC                      | Type      | Action  | Service |
| ------------------------ | --------- | ------- | ------- |
| 2026-11-19T04:19:07.577Z | container | create  | ingress |
| 2026-11-19T04:19:07.579Z | container | other   | ingress |
| 2026-11-19T04:19:07.656Z | container | start   | ingress |
| 2026-11-19T04:19:07.705Z | container | die     | ingress |
| 2026-11-19T04:19:07.706Z | container | destroy | ingress |
| 2026-11-19T04:19:07.832Z | container | create  | ingress |
| 2026-11-19T04:19:22.372Z | container | start   | ingress |
| 2026-11-19T04:19:29.771Z | container | kill    | ingress |
| 2026-11-19T04:19:29.893Z | container | stop    | ingress |
| 2026-11-19T04:19:29.894Z | container | die     | ingress |
| 2026-11-19T04:19:29.896Z | container | destroy | ingress |

### All retained ingress events — failure.json environment (already ±5s projected)

| UTC                      | Type      | Action | Service |
| ------------------------ | --------- | ------ | ------- |
| 2026-11-19T04:19:22.372Z | container | start  | ingress |

### Safe log excerpts

GitHub timestamps below are log emission/collection times. Nginx tail lines are emitted by cleanup; they do not timestamp the original nginx startup. No qualifying emerg/alert/crit/error/exited/signal line found in the retained ingress log. Worker-process-start count0 and entrypoint-marker count0 are non-diagnostic under current logging.

```text
2026-11-19T04:19:07.7107819Z Missing TLS custody rejection PASS
2026-11-19T04:19:07.8277285Z  Container [ingress container]  Creating
2026-11-19T04:19:07.8331245Z  Container [ingress container]  Created
2026-11-19T04:19:22.2797489Z  Container [ingress container]  Starting
2026-11-19T04:19:22.3731933Z  Container [ingress container]  Started
2026-11-19T04:19:22.3734494Z  Container [ingress container]  Waiting
2026-11-19T04:19:22.8754123Z  Container [ingress container]  Healthy
2026-11-19T04:19:24.2726698Z PUBLIC_HTTPS_SMOKE_FAILED
2026-11-19T04:19:24.2727181Z Step: CANONICAL_HTTPS_REMOTE_OPERATOR_SETUP
2026-11-19T04:19:29.6932991Z ingress-1  | nginx: the configuration file /etc/nginx/nginx.conf syntax is ok
2026-11-19T04:19:29.6934435Z ingress-1  | nginx: configuration file /etc/nginx/nginx.conf test is successful
```

## E3 trial 1 — job 135330812821

Artifact ID14498248773, `sha256:f0deec095f26124f01241f2b34c1bf1a94d06cf92d4f4a0edc94dc88c812a9a6`. Final Docker observer STOPPED, reason `null`, dropped433. These dropped counts are global rolling-buffer evictions, not evidence of missing a specific ingress event.

### All retained ingress events — environment.json

| UTC                      | Type      | Action  | Service |
| ------------------------ | --------- | ------- | ------- |
| 2026-11-19T04:20:15.372Z | container | start   | ingress |
| 2026-11-19T04:20:16.473Z | container | kill    | ingress |
| 2026-11-19T04:20:16.609Z | container | stop    | ingress |
| 2026-11-19T04:20:16.610Z | container | die     | ingress |
| 2026-11-19T04:20:16.759Z | container | start   | ingress |
| 2026-11-19T04:20:16.759Z | container | restart | ingress |
| 2026-11-19T04:20:23.994Z | container | kill    | ingress |
| 2026-11-19T04:20:24.125Z | container | stop    | ingress |
| 2026-11-19T04:20:24.126Z | container | die     | ingress |
| 2026-11-19T04:20:24.128Z | container | destroy | ingress |

### Safe log excerpts

GitHub timestamps below are log emission/collection times. Nginx tail lines are emitted by cleanup; they do not timestamp the original nginx startup. No qualifying emerg/alert/crit/error/exited/signal line found in the retained ingress log. Worker-process-start count0 and entrypoint-marker count0 are non-diagnostic under current logging.

```text
2026-11-19T04:19:39.7155619Z Missing TLS custody rejection PASS
2026-11-19T04:19:39.8400546Z  Container [ingress container]  Creating
2026-11-19T04:19:39.8456150Z  Container [ingress container]  Created
2026-11-19T04:19:54.3122473Z  Container [ingress container]  Starting
2026-11-19T04:19:54.4080376Z  Container [ingress container]  Started
2026-11-19T04:19:54.4081252Z  Container [ingress container]  Waiting
2026-11-19T04:19:54.9104258Z  Container [ingress container]  Healthy
2026-11-19T04:19:58.4542725Z HTTPS API/Web/ingress secret-log privacy PASS
2026-11-19T04:19:59.3888306Z Disposable certificate replacement and safe Nginx reload preserve session PASS
2026-11-19T04:19:59.4665846Z  Container [ingress container]  Stopping
2026-11-19T04:19:59.6031749Z  Container [ingress container]  Stopped
2026-11-19T04:20:15.2810411Z  Container [ingress container]  Starting
2026-11-19T04:20:15.3733194Z  Container [ingress container]  Started
2026-11-19T04:20:15.3734305Z  Container [ingress container]  Waiting
2026-11-19T04:20:15.8758196Z  Container [ingress container]  Healthy
2026-11-19T04:20:16.4648977Z  Container [ingress container]  Restarting
2026-11-19T04:20:16.7606027Z  Container [ingress container]  Started
2026-11-19T04:20:16.8789028Z  Container [ingress container]  Running
2026-11-19T04:20:22.7237262Z  Container [ingress container]  Waiting
2026-11-19T04:20:23.2258525Z  Container [ingress container]  Healthy
2026-11-19T04:20:23.9056484Z Disposable HTTPS MFA/onboarding/ingress, isolated backup-restore and restart PASS; production DNS/certificate/firewall/NTP NOT VERIFIED
```

## E3 trial 2 — job 135330812782

Artifact ID14498567833, `sha256:6c0a0027ab3192b04d4968ed41925d5a69fdd2f6b43e8d462c70e6a6f963b148`. Final Docker observer STOPPED, reason `null`, dropped427. These dropped counts are global rolling-buffer evictions, not evidence of missing a specific ingress event.

### All retained ingress events — environment.json

| UTC                      | Type      | Action  | Service |
| ------------------------ | --------- | ------- | ------- |
| 2026-11-19T04:19:36.077Z | container | start   | ingress |
| 2026-11-19T04:19:37.123Z | container | kill    | ingress |
| 2026-11-19T04:19:37.243Z | container | stop    | ingress |
| 2026-11-19T04:19:37.245Z | container | die     | ingress |
| 2026-11-19T04:19:37.376Z | container | start   | ingress |
| 2026-11-19T04:19:37.376Z | container | restart | ingress |
| 2026-11-19T04:19:44.532Z | container | kill    | ingress |
| 2026-11-19T04:19:44.665Z | container | stop    | ingress |
| 2026-11-19T04:19:44.666Z | container | die     | ingress |
| 2026-11-19T04:19:44.668Z | container | destroy | ingress |

### Safe log excerpts

GitHub timestamps below are log emission/collection times. Nginx tail lines are emitted by cleanup; they do not timestamp the original nginx startup. No qualifying emerg/alert/crit/error/exited/signal line found in the retained ingress log. Worker-process-start count0 and entrypoint-marker count0 are non-diagnostic under current logging.

```text
2026-11-19T04:19:01.9432376Z Missing TLS custody rejection PASS
2026-11-19T04:19:02.0580563Z  Container [ingress container]  Creating
2026-11-19T04:19:02.0640555Z  Container [ingress container]  Created
2026-11-19T04:19:16.4851517Z  Container [ingress container]  Starting
2026-11-19T04:19:16.5743790Z  Container [ingress container]  Started
2026-11-19T04:19:16.5744336Z  Container [ingress container]  Waiting
2026-11-19T04:19:17.0777210Z  Container [ingress container]  Healthy
2026-11-19T04:19:19.5091047Z HTTPS API/Web/ingress secret-log privacy PASS
2026-11-19T04:19:20.3259945Z Disposable certificate replacement and safe Nginx reload preserve session PASS
2026-11-19T04:19:20.3941499Z  Container [ingress container]  Stopping
2026-11-19T04:19:20.5412784Z  Container [ingress container]  Stopped
2026-11-19T04:19:35.9935444Z  Container [ingress container]  Starting
2026-11-19T04:19:36.0775430Z  Container [ingress container]  Started
2026-11-19T04:19:36.0775812Z  Container [ingress container]  Waiting
2026-11-19T04:19:36.5796923Z  Container [ingress container]  Healthy
2026-11-19T04:19:37.1158152Z  Container [ingress container]  Restarting
2026-11-19T04:19:37.3771955Z  Container [ingress container]  Started
2026-11-19T04:19:37.5152560Z  Container [ingress container]  Running
2026-11-19T04:19:43.3456625Z  Container [ingress container]  Waiting
2026-11-19T04:19:43.8472318Z  Container [ingress container]  Healthy
2026-11-19T04:19:44.4579486Z Disposable HTTPS MFA/onboarding/ingress, isolated backup-restore and restart PASS; production DNS/certificate/firewall/NTP NOT VERIFIED
```

## E3 trial 7 — job 135330812837

Artifact ID14498797687, `sha256:766d6493d6309d3ceb366a2819f7360d4d6981500c4a45e37b3e92a1008a2f66`. Final Docker observer STOPPED, reason `null`, dropped427. These dropped counts are global rolling-buffer evictions, not evidence of missing a specific ingress event.

### All retained ingress events — environment.json

| UTC                      | Type      | Action  | Service |
| ------------------------ | --------- | ------- | ------- |
| 2026-11-19T04:19:40.292Z | container | start   | ingress |
| 2026-11-19T04:19:41.360Z | container | kill    | ingress |
| 2026-11-19T04:19:41.500Z | container | stop    | ingress |
| 2026-11-19T04:19:41.501Z | container | die     | ingress |
| 2026-11-19T04:19:41.640Z | container | start   | ingress |
| 2026-11-19T04:19:41.640Z | container | restart | ingress |
| 2026-11-19T04:19:48.845Z | container | kill    | ingress |
| 2026-11-19T04:19:48.971Z | container | stop    | ingress |
| 2026-11-19T04:19:48.972Z | container | die     | ingress |
| 2026-11-19T04:19:48.974Z | container | destroy | ingress |

### Safe log excerpts

GitHub timestamps below are log emission/collection times. Nginx tail lines are emitted by cleanup; they do not timestamp the original nginx startup. No qualifying emerg/alert/crit/error/exited/signal line found in the retained ingress log. Worker-process-start count0 and entrypoint-marker count0 are non-diagnostic under current logging.

```text
2026-11-19T04:19:05.8504770Z Missing TLS custody rejection PASS
2026-11-19T04:19:05.9717122Z  Container [ingress container]  Creating
2026-11-19T04:19:05.9767754Z  Container [ingress container]  Created
2026-11-19T04:19:20.4682915Z  Container [ingress container]  Starting
2026-11-19T04:19:20.5618862Z  Container [ingress container]  Started
2026-11-19T04:19:20.5621530Z  Container [ingress container]  Waiting
2026-11-19T04:19:21.0658450Z  Container [ingress container]  Healthy
2026-11-19T04:19:23.5909932Z HTTPS API/Web/ingress secret-log privacy PASS
2026-11-19T04:19:24.3954290Z Disposable certificate replacement and safe Nginx reload preserve session PASS
2026-11-19T04:19:24.4686362Z  Container [ingress container]  Stopping
2026-11-19T04:19:24.6186462Z  Container [ingress container]  Stopped
2026-11-19T04:19:40.2009114Z  Container [ingress container]  Starting
2026-11-19T04:19:40.2929591Z  Container [ingress container]  Started
2026-11-19T04:19:40.2931218Z  Container [ingress container]  Waiting
2026-11-19T04:19:40.7942448Z  Container [ingress container]  Healthy
2026-11-19T04:19:41.3513739Z  Container [ingress container]  Restarting
2026-11-19T04:19:41.6411987Z  Container [ingress container]  Started
2026-11-19T04:19:41.7790894Z  Container [ingress container]  Running
2026-11-19T04:19:47.6251780Z  Container [ingress container]  Waiting
2026-11-19T04:19:48.1269352Z  Container [ingress container]  Healthy
2026-11-19T04:19:48.7648820Z Disposable HTTPS MFA/onboarding/ingress, isolated backup-restore and restart PASS; production DNS/certificate/firewall/NTP NOT VERIFIED
```

## Ordinary Foundation — job 135325095085

Artifact ID14498295005, `sha256:70a60996d684a38a0827bff8175f570441e15a93c28c3fa9ec6f936d5f1de190`. Final Docker observer STOPPED, reason `null`, dropped215. These dropped counts are global rolling-buffer evictions, not evidence of missing a specific ingress event.

### All retained ingress events — environment.json

| UTC                      | Type      | Action  | Service |
| ------------------------ | --------- | ------- | ------- |
| 2026-11-19T04:03:36.969Z | container | create  | ingress |
| 2026-11-19T04:03:36.972Z | container | other   | ingress |
| 2026-11-19T04:03:37.053Z | container | start   | ingress |
| 2026-11-19T04:03:37.096Z | container | die     | ingress |
| 2026-11-19T04:03:37.097Z | container | destroy | ingress |
| 2026-11-19T04:03:37.226Z | container | create  | ingress |
| 2026-11-19T04:03:51.771Z | container | start   | ingress |
| 2026-11-19T04:04:03.452Z | container | kill    | ingress |
| 2026-11-19T04:04:03.584Z | container | stop    | ingress |
| 2026-11-19T04:04:03.585Z | container | die     | ingress |
| 2026-11-19T04:04:03.586Z | container | destroy | ingress |

### All retained ingress events — failure.json environment (already ±5s projected)

| UTC                      | Type      | Action | Service |
| ------------------------ | --------- | ------ | ------- |
| 2026-11-19T04:03:51.771Z | container | start  | ingress |

### Safe log excerpts

GitHub timestamps below are log emission/collection times. Nginx tail lines are emitted by cleanup; they do not timestamp the original nginx startup. No qualifying emerg/alert/crit/error/exited/signal line found in the retained ingress log. Worker-process-start count0 and entrypoint-marker count0 are non-diagnostic under current logging.

```text
2026-11-19T04:03:37.1023069Z Missing TLS custody rejection PASS
2026-11-19T04:03:37.2211604Z  Container [ingress container]  Creating
2026-11-19T04:03:37.2268249Z  Container [ingress container]  Created
2026-11-19T04:03:51.6789591Z  Container [ingress container]  Starting
2026-11-19T04:03:51.7724467Z  Container [ingress container]  Started
2026-11-19T04:03:51.7724804Z  Container [ingress container]  Waiting
2026-11-19T04:03:52.2757683Z  Container [ingress container]  Healthy
2026-11-19T04:04:03.2330169Z PUBLIC_HTTPS_SMOKE_FAILED
2026-11-19T04:04:03.2330406Z Step: ADMIN_BROWSER_INTERACTIVE_LOGIN
2026-11-19T04:04:03.3682216Z ingress-1  | nginx: the configuration file /etc/nginx/nginx.conf syntax is ok
2026-11-19T04:04:03.3682840Z ingress-1  | nginx: configuration file /etc/nginx/nginx.conf test is successful
```

## Additional diagnostics — proposal only, not implemented

No extra diagnostics are required to distinguish the observed main initial start from the deliberate one-off in these samples. Existing data does **not** retain a numeric exit code for either container, and cannot prove the absence of every suppressed nginx error or unretained early PASS event. Do not invent a reason for an unexpected nginx exit: none is observed. The one-off is expected to reject TLS custody by source and PASS marker; its hidden TLS gate text is not quoted as if read from CI.

If owner wants stronger future confirmation, the smallest proposed addition is a read-only snapshot of the **main** ingress immediately after browser completion/failure and before cleanup: only RestartCount, State.ExitCode, State.OOMKilled (three values; fixed service identity, no raw inspect or IDs). This tests automatic restarts of the main container; an exit code from a running container is not a historical nginx crash reason. No action allowlist expansion is needed: die/kill/oom/restart/health_status are present already. If complete lifecycle counts are also required, separately propose a capped ingress-only event buffer retaining the current projected fields so normal post-browser churn does not evict the startup interval. Log-level changes/full nginx logs are not proposed because they may expose request data.

Owner approval is required before any diagnostics modification or new execution under this request’s §3. Nothing above has been implemented or run. No new hypothesis-fixing code, CI trial, workflow edit or snapshot revision.

## Verification

Documentation-only evidence extension within existing v3 Phase1 plan. Existing projected archives reused; source/order inspected at458a6ba. Evidence privacy review excludes full container names/IDs, IP/MAC, auth request IDs and raw access JSON. Checks and final handoff are recorded in active task059. This evidence does not turn final-head hosted checks green.
