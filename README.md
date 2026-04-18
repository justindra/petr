# petr

Prompt Evaluation & Testing Runner — a CLI for running LLM prompts against datasets and scoring the results, so you can verify prompt/model upgrades don't regress quality before shipping.

## Try the demo

The included `examples/demo` is a sentiment-classification suite you can run against a real LLM in under a minute.

```bash
git clone https://github.com/justindra/petr
cd petr
bun install
bun run build

cd examples/demo
cp .env.example .env   # then paste your ANTHROPIC_API_KEY into .env
../../packages/cli/bin/run.js run petr.config.ts
../../packages/cli/bin/run.js review runs/<timestamp>
```

`petr run` auto-loads `.env` (and `.env.local`) from the config's directory, so credentials stay out of your shell history and out of git.

## Monorepo layout

- `packages/core` — `@petr/core`, programmatic API (config loader, dataset reader, evals, providers, runner, output writers, review server)
- `packages/cli` — `@petr/cli`, the `petr` binary (oclif)
- `packages/ui` — `@petr/ui`, the review UI (Vite + React 19 + Tailwind v4 + Catalyst)
- `examples/demo` — a working end-to-end example

## Provider configuration

`petr` uses the [Vercel AI SDK](https://ai-sdk.dev) under the hood, so any of these work out of the box:

| `model.provider` in config | Env var(s) |
| --- | --- |
| `anthropic` | `ANTHROPIC_API_KEY` |
| `openai` | `OPENAI_API_KEY` |
| `google` | `GOOGLE_GENERATIVE_AI_API_KEY` |
| `bedrock` | `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION` |
| `copilot` | `GITHUB_COPILOT_TOKEN` (Copilot OAuth token, **not** a PAT) |

The `copilot` provider talks to `api.githubcopilot.com`, the same OpenAI-compatible endpoint VS Code Copilot Chat uses. Model IDs follow Copilot's naming (`claude-sonnet-4.6`, `gpt-5`, etc. — see [supported models](https://docs.github.com/en/copilot/reference/ai-models/supported-models)). Note this route is not officially documented for third-party use; GitHub could change it at any time.

## Development

```bash
bun run typecheck   # type-check all workspaces
bun run lint        # ESLint + typescript-eslint
bun run format:check
bun test            # unit + integration + e2e
```
