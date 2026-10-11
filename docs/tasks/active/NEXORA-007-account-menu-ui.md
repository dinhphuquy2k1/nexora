# Task: NEXORA-007 — AccountMenu Integration & Header UX Cleanup

- **Task ID**: `NEXORA-007`
- **Status**: `VERIFICATION PENDING`
- **Implementation**: `IMPLEMENTED`
- **Verification**: `PARTIALLY VERIFIED`

---

## 1. Provenance & Starting Baseline

- **Repository**: `https://github.com/dinhphuquy2k1/nexora`
- **Starting Main SHA**: `51d6cf938096fbb52c2c9dbe989a5015b6d76bb9` (HEAD of `feat/management-ui-polish` synced)
- **Working Branch**: `feat/account-menu-ui`
- **Task Classification**: `BOUNDED`

---

## 2. Objective & Scope

Refine the Nexora Header interface by replacing the temporary Settings gear link and legacy workspace presentation with a reusable, accessible `AccountMenu` component reserving future user account and authentication functionality:

1. **AccountMenu Component**: Implement a neutral, accessible user account disclosure component (`apps/web/components/app-shell/AccountMenu.tsx`) featuring a generic User icon, compact chevron, and truthful unavailable status ("Chức năng tài khoản và đăng nhập sẽ được triển khai trong phiên bản sau.").
2. **Header Composition**: Simplify the Header right section to exclusively house `AccountMenu`. Remove the redundant Settings navigation link (preserving the Sidebar Settings item as the sole canonical navigation control).
3. **Notification Control Decision**: Hide the unbacked `NotificationMenu` trigger from the Header until real backend notification services are implemented.
4. **Product & Security Boundaries**: Do NOT implement login forms, session management, fake user identities, mock accounts, or authentication API routes. Keep security and single-node runtime notes in `/settings`.
5. **Accessibility**: Ensure native button semantics, `aria-expanded`, `aria-controls`, outside dismissal, and Escape key dismissal with focus restoration to trigger via `useDismissable`.

---

## 3. Documentation Impact

Documentation Impact: REQUIRED

### Changed facts

- Header composition updated to house neutral `AccountMenu` exclusively on the right side.
- Redundant Header Settings navigation removed, establishing Sidebar as sole primary navigation owner for `/settings`.
- Unbacked `NotificationMenu` hidden from default Header layout.
- AccountMenu documents truthful unavailable state without fabricating authenticated user profiles or authentication infrastructure.

### Canonical owners

- `docs/architecture/frontend.md`

### Documentation verification

- `pnpm docs:check`

---

## 4. Evidence

| Claim                                                           | Evidence                                                                                           | Date       | Result |
| :-------------------------------------------------------------- | :------------------------------------------------------------------------------------------------- | :--------- | :----- |
| Starting baseline confirmed on branch `feat/account-menu-ui`    | `git rev-parse HEAD` (`51d6cf9`)                                                                   | 2026-10-11 | PASS   |
| Navigation contract and resolver unit tests pass                | `pnpm --filter @nexora/web test` (6 tests passing)                                                 | 2026-10-11 | PASS   |
| Web application TypeScript typecheck passes with 0 errors       | `pnpm --filter @nexora/web typecheck` (`tsc --noEmit`)                                             | 2026-10-11 | PASS   |
| Monorepo tests and Next.js production build pass                | `pnpm test` (all 6 tasks pass, Next.js build succeeds)                                             | 2026-10-11 | PASS   |
| Architecture boundaries and ESLint pass                         | `pnpm lint` (`boundaries.mjs` + `eslint .`)                                                        | 2026-10-11 | PASS   |
| Prettier code and document formatting passes                    | `pnpm format:check`                                                                                | 2026-10-11 | PASS   |
| Documentation governance, links, and task schema pass           | `pnpm docs:check`                                                                                  | 2026-10-11 | PASS   |
| Interactive browser verification (1440×900, 1280×800, 1024×768) | Chrome subagent: `scrollWidth <= clientWidth`, 0 overflow, disclosure & focus restoration verified | 2026-10-11 | PASS   |
