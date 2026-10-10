# Implementation workflow

Inspect → route docs → classify/plan → define interfaces and acceptance → implement → synchronize docs → execute checks → review boundaries and evidence → report.
Behavior changes need meaningful tests; runtime changes need functional requests and failure checks. Diagnose before retrying. Keep secrets out of files/logs and retain TLS, signature and checksum verification.
No Git worktree by default: each cloud task already has an isolated checkout. Do not push to upstream, publish images, deploy or delete user data unless explicitly requested.
