# petr

Prompt Evaluation & Testing Runner — a CLI for running LLM prompts against datasets and scoring the results, so you can verify prompt/model upgrades don't regress quality before shipping.

## Quick start

```bash
bun install
bun run build
cd packages/cli && bun link

petr init demo
cd demo
petr run petr.config.ts
petr review runs/<timestamp>
```

## Monorepo layout

- `packages/core` — `@petr/core`, programmatic API
- `packages/cli` — `@petr/cli`, the `petr` binary (oclif)
- `packages/ui` — `@petr/ui`, the review UI (Vite + React + Tailwind v4 + Catalyst)

## Development

```bash
bun run typecheck   # type-check all workspaces
bun run lint        # ESLint + typescript-eslint
bun run format:check
bun test            # unit + integration + e2e
```
