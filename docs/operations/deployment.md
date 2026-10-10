# Deployment scope

IMPLEMENTED target: local, single machine, loopback web exposure only. No login/session/RBAC, public TLS, remote access policy, managed key storage, scaling, rollout/rollback or public production topology has been selected. Do not expose this foundation on the Internet.
Distribution template pins application tags 0.1.0, but those images are NOT PUBLISHED; `--prebuilt` cannot be promised to users. Task only builds local images. Registry publication, signed release/digests and a verified Windows/macOS distribution are future explicit release tasks.
Local database uses persistent generated credentials, not shared committed passwords. Volume snapshot/backup is separate from image build. Restart must not rotate credentials or remove data. CI runtime smoke is evidence for local release semantics, not proof of production hosting readiness.
