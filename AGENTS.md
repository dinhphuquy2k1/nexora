# Nexora contributor instructions

Read `docs/ai/README.md` before making changes. Use the existing isolated checkout; do not create a worktree unless requested.
Preserve unrelated work. Docker is canonical; host tooling is optional. Pin exact versions and use frozen installs after lockfile generation.
Apps cannot import apps. Web cannot access database code. Only API infrastructure imports `@nexora/database`; controllers delegate to application services.
Nexora owns the shipment domain. Logistics provider integration requires official API authorization review; never invent shipment data or implement provider integrations prematurely.
Keep canonical docs synchronized with code. Record executed commands and PASS/FAIL/NOT RUN; distinguish implementation from verification. Never reset user volumes for tests.
