# NEXORA-064 Design Snapshot (v3) - Final PR 63 review remediation

Task ID: NEXORA-064
Classification: SIGNIFICANT
Documentation Impact: REQUIRED
Plan revision: rev-2026-11-27-design-system-refinement-v3
Reviewed baseline: 28b9f5e09e5e110e7e88bdf61d65182172026292
Branch: refactor/design-system-refinement (PR #63)

This delta supersedes only the affected decisions in v2; all other v2 requirements remain in force. Preserve 36/40/48px controls, 12px tables, 44.5px nominal Customer rows, 26px detail link, compact preset typography, authentication sizing, palette and all business contracts.

## Reuse and design audit

- **Component:** card and compact drawer headings, existing RetailColumnPicker TextInput and Search, existing static and CDP checks.
- **Existing implementations:** tokens.css; customers, retail-packages and carrier-connections CSS reuse control line height for headings; RetailColumnPicker.tsx uses a compact input; customer-control-checks.mjs, customer-read-races.mjs, pager-filter-browser-checks.mjs and control-sizes.test.mjs own checks.
- **Owner:** Web theme, owning feature CSS, shared UI and existing test harnesses.
- **Alternatives:** reuse control line height versus independent heading role; preserve 11px input versus inherit default; new framework versus existing probes.
- **Selected approach:** independent card heading size and line-height tokens (14/600/20); shared 14px search input with token-driven accessory; exact three presets; rendered standard segmented fixture; independent overrides, native textarea rows and minimum, same-viewport Customer row parity.
- **Rationale:** equal values do not imply equal semantics; preserve density and exercise rendered controls without new dependencies.
- **Risks:** heading cascade, narrow popover geometry, textarea native sizing, fixture-specific wrapping.
- **Verification:** static contract checks, actual heading isolation, column picker browser geometry and typography, textarea and row parity checks, existing quality and Foundation CI.

## Scope and verification

No API, SDK, database, dependency, authorization, business behavior or palette change. Keep historical snapshots and evidence immutable. Extend existing harnesses; restore modified DOM attributes and inline tokens in finally blocks. Check rows 1/2/3/6 in all three variants, enforce three-line resize floor for rows >= 3, compare loaded fixture and loading skeleton in the same desktop viewport. Preserve existing geometry assertions. Require exact three compact presets and actual standard segmented buttons. Verify card heading line height is isolated from control overrides. Update canonical design/testing documentation and task/PR metadata. Run targeted tests and Foundation on the new HEAD; distinguish unavailable local execution, hosted results and manual visual review. No owner approval gate; no merge.
