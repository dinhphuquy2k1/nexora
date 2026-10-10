# Project rules

Correctness, maintainability, extensibility, simplicity, then performance. KISS/YAGNI; no speculative queues, caches, vector DBs or services.
One owner for each documented fact: architecture owns boundaries, operations owns commands/config, domains owns business invariants, ADR owns decisions, task owns evidence.
Documentation Impact is REQUIRED for foundation changes. Update the owner in the same task. Never claim workflow success from a YAML file, port or PID.
Domain/application/presentation are Prisma-free; infrastructure consumes the database package. Nexora owns the Shipment domain. Future external logistics provider integration requires official authorization and feasibility review before implementation. Only real cross-package constants go into shared.
