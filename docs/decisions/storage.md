# ADR-003 · Local source storage

Accepted: fixed canonical absolute root and opaque UUIDv4 IDs; API never accepts filesystem paths. Flat files use O_NOFOLLOW, O_EXCL, private permissions, bounded bytes and fsync. Root lstat/realpath rejects symlink and containment changes. Only the service account may mutate its dedicated volume; concurrent hostile local filesystem actors are outside this local-instance model. Provider interface permits future S3 without adding a service now.
Catalog tracks true source metadata; failures compensate blob writes. Crash orphan recovery and comprehensive XLSX limits are ingest work. Storage persistence relies on Docker named volumes; custom Backup/Restore subsystem has been retired per ADR-006.
