# Agent Rules

- Always read and follow `INSTRUCTIONS.md` before planning or changing code.
- If repository documents conflict, prioritize `INSTRUCTIONS.md`.
- Keep all non-i18n project text in English.
- Use `pnpm` for dependency and script management.
- Keep repository formatting aligned with `prettier.config.cjs`.
- Browser-facing workflow pages must read workflow data through repo-scoped REST endpoints and must not import backend workflow services directly for those reads.
- Run `pnpm fmt` after editing files that Prettier manages.
- Keep `pnpm fmt:check` green before finishing.
- Run `pnpm lint` after meaningful code changes.
- Run `pnpm build` before finishing structural or integration work when feasible.
