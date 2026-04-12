## Context

This change captures proposal "Bootstrap pnpm Next.js App Router starter" as OpenSpec change `next-starter-a1-p1-bootstrap-pnpm-next-js-app-router-starter`.
Implementation starts only after human approval and is claimed by the next
available coding-review worker from the shared pool.

## Goals / Non-Goals

**Goals:**
- Initialize the empty `ugit` repository as a full-TypeScript Next.js App Router app with a minimal Hello World page, `@/` imports, harness-aligned ESLint/Prettier/Vitest configuration, root `INSTRUCTIONS.md`/`AGENTS.md`/`TODO.md`, required package scripts and dependencies, and passing `pnpm fmt`, `pnpm lint`, `pnpm test`, and `pnpm build`.
- Preserve a reviewable OpenSpec contract before coding starts.
- Keep the proposal logical enough that any pooled worker can execute it.
- Reuse a managed worktree from `/home/kamiyoru/work/ts/ugit/.meow-team-worktrees/meow-N` for cache-friendly execution.

**Non-Goals:**
- Bind this proposal to a specific branch or worker slot before approval.
- Expand scope beyond the approved proposal without human feedback.
- Merge sibling proposals into a single coding pass without replanning.

## Decisions

- Store the proposal as a dedicated OpenSpec change before coding begins.
- Let the pooled coding-review runtime allocate execution branches and worktrees after approval.
- Use planner output as the starting point for reviewer validation and follow-up tasks.
- Prefer incremental implementation that can be requeued after machine review feedback.
- Keep the canonical request/PR title as `feat: Bootstrap pnpm Next.js App Router starter`.
- Keep slash-delimited roadmap/topic scope in conventional-title metadata `feat` instead of `branchPrefix` or OpenSpec change paths.

## Conventional Title

- Canonical request/PR title: `feat: Bootstrap pnpm Next.js App Router starter`
- Conventional title metadata: `feat`
- Slash-delimited roadmap/topic scope stays in conventional-title metadata and does not alter `branchPrefix` or OpenSpec change paths.


## Risks / Trade-offs

- [Proposal drift] -> Compare implementation against the approved OpenSpec artifacts before coding.
- [Sibling proposal overlap] -> Send cross-proposal changes back to request-group replanning.
- [Reusable worktree residue] -> Reset the managed worktree before each proposal run.
- [Validation gaps] -> Require reviewer findings and task completion before treating work as complete.

Planner deliverable reference: Proposal: `bootstrap-next-app-router-starter` Why a single proposal: The requested work is tightly coupled. The app scaffold, TypeScript/alias setup, lint/format/test configuration, repo instructions, TODO tracking, and validation all form one bootstrap surface. Splitting them would create unnecessary sequencing and review overhead in an otherwise empty repository. Implementation objective: Initialize `ugit` in place as a minimal full-TypeScript Next.js App Router project managed by `pnpm`, with a Hello World homepage, deterministic root tooling, and repository instructions that mirror the reference harness conventions. Expected implementation shape: - Root bootstrap files: `package.json`, `pnpm-lock.yaml`, `.gitignore`, `tsconfig.json`, `next-env.d.ts`, and a minimal `next.config.ts` only if needed. - App Router files: `app/layout.tsx`, `app/page.tsx`, `app/globals.css`. - Pure helper and test: `lib/hello.ts`, `lib/hello.test.ts`. - Tooling configs: `eslint.config.mjs`, `prettier.config.cjs`, `vitest.config.ts`. - Repo guidance: `INSTRUCTIONS.md`, `AGENTS.md`, `TODO.md`. Detailed design notes for the coder: - `app/layout.tsx` should export `metadata` with a reasonable title and description, import `app/globals.css`, and provide the root HTML shell. - `app/page.tsx` should render a visible `Hello World` heading and short subtitle using data from `lib/hello.ts` through `@/lib/hello`. - `lib/hello.ts` should stay pure and deterministic, suitable for Vitest node execution without DOM dependencies. - `tsconfig.json` should keep the project fully TypeScript-based, strict enough for a starter, and define `@/*` to `./*`. - `eslint.config.mjs` should use flat config, spread `eslint-config-next/core-web-vitals` and `eslint-config-next/typescript`, and ignore at least `node_modules/**`, `.next/**`, `out/**`, `build/**`, `.pnpm-store/**`, plus local generated directories if any are added. - `prettier.config.cjs` should match the exact option block from the request. The scripts should format Markdown and the repo source files, including exactly `.js`, `.mjs`, `.cjs`, `.ts`, and `.tsx`. - `vitest.config.ts` should set `environment: "node"`, `include: ["**/*.test.ts"]`, and alias `@` to the repo root. - `INSTRUCTIONS.md` should stay short and define the starter purpose plus the four non-negotiable rules. - `AGENTS.md` should model the requested rule set, explicitly pointing agents to `INSTRUCTIONS.md`, `pnpm`, `prettier.config.cjs`, and the validation commands. - `TODO.md` should use the exact requested front matter shape and include at least one actionable starter item scoped by functionality, not only file path. - `package.json` should include the required scripts and modern compatible versions of `next`, `react`, `react-dom`, `typescript`, `eslint`, `eslint-config-next`, `prettier`, `vitest`, `@types/node`, `@types/react`, and `@types/react-dom`. Validation contract: The coding lane should iterate until all required commands pass: - `pnpm fmt` - `pnpm lint` - `pnpm test` - `pnpm build` Scope boundaries: - No Tailwind. - No Jest. - No React Testing Library. - No Pages Router. - No extra frameworks or product features beyond the starter. - Do not delete or replace unrelated existing repository content. Assumptions and approval risks: - The repo is effectively empty, so the safest path is clean bootstrap-in-place rather than adapting partial legacy code. - Dependency major versions should stay close to the reference harness conventions unless environment compatibility forces a small adjustment. - Approval should cover the expectation that the coder may add standard Next.js support files required to make the requested scripts and validation succeed. Pool coordination: No coder or reviewer lane should start until the owner approves this proposal.
