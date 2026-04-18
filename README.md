# petr

Prompt Evaluation & Testing Runner — a CLI for running LLM prompts against datasets and scoring the results, so you can verify prompt/model upgrades don't regress quality before shipping.

## Try the demo

The included `examples/demo` is a sentiment-classification suite you can run against a real LLM in under a minute. It ships two configs over the same dataset and prompt so you can also try `petr compare`.

```bash
git clone https://github.com/justindra/petr
cd petr
bun install
bun run build

# Put the CLI on your PATH (one-time):
cd packages/cli && bun link && cd ../..

cd examples/demo
cp .env.example .env   # fill in the creds for whichever provider(s) you want

petr run petr.config.ts                                     # GitHub Copilot
petr run petr.config.bedrock.ts                             # AWS Bedrock
petr compare petr.config.ts petr.config.bedrock.ts          # side-by-side
petr review runs/<timestamp>                                # open the UI
```

`petr run` auto-loads `.env` (and `.env.local`) from the config's directory, so credentials stay out of your shell history and out of git.

## Monorepo layout

- `packages/core` — `@petr/core`, programmatic API (config loader, dataset reader, evals, providers, runner, output writers, review server)
- `packages/cli` — `@petr/cli`, the `petr` binary (oclif)
- `packages/ui` — `@petr/ui`, the review UI (Vite + React 19 + Tailwind v4 + Catalyst)
- `examples/demo` — a working end-to-end example

## Provider configuration

`petr` uses the [Vercel AI SDK](https://ai-sdk.dev) under the hood, so any of these work out of the box:

| `model.provider` in config | Env var(s)                                                  |
| -------------------------- | ----------------------------------------------------------- |
| `anthropic`                | `ANTHROPIC_API_KEY`                                         |
| `openai`                   | `OPENAI_API_KEY`                                            |
| `google`                   | `GOOGLE_GENERATIVE_AI_API_KEY`                              |
| `bedrock`                  | `AWS_REGION` + either `AWS_PROFILE` or raw keys (see below) |
| `copilot`                  | `GITHUB_COPILOT_TOKEN` (Copilot OAuth token, **not** a PAT) |

The `copilot` provider talks to `api.githubcopilot.com`, the same OpenAI-compatible endpoint VS Code Copilot Chat uses. Model IDs follow Copilot's naming (`claude-sonnet-4.6`, `gpt-5`, etc. — see [supported models](https://docs.github.com/en/copilot/reference/ai-models/supported-models)). Note this route is not officially documented for third-party use; GitHub could change it at any time.

The `bedrock` provider uses the standard AWS SDK credential chain, so any of the usual options work — in order of preference:

1. **`AWS_PROFILE=my-profile`** (recommended) — reads `~/.aws/credentials` / `~/.aws/config`. Works with SSO (`aws sso login --profile my-profile`) or long-lived keys under a profile. You still need `AWS_REGION` since Bedrock is regional.
2. **Raw keys** — `AWS_ACCESS_KEY_ID` + `AWS_SECRET_ACCESS_KEY` (+ `AWS_SESSION_TOKEN` for temp creds) + `AWS_REGION`.
3. **Instance/task roles** — EC2 IMDS or ECS container creds; nothing extra to set.

Model IDs follow the Bedrock catalog (e.g. `us.anthropic.claude-haiku-4-5-20251001-v1:0`). Enable models in the Bedrock console first; `aws bedrock list-foundation-models` shows what's available in your account/region.

## Development

```bash
bun run build              # bun build for JS + tsc --emitDeclarationOnly for .d.ts
bun run typecheck          # tsc --noEmit across every workspace (includes test files)
bun run lint               # ESLint + typescript-eslint
bun run format:check       # Prettier
```

### Tests

```bash
bun test                   # everything in one pass (default)
bun run test:unit          # co-located *.test.ts files under packages/*/src
bun run test:integration   # packages/core/test/integration
bun run test:e2e           # packages/cli/test/e2e (spawns the real bin)
bun run test:watch         # watch mode across the whole repo
```

Unit tests live next to their source (`foo.ts` + `foo.test.ts`). Integration and e2e tests live in `packages/*/test/`. `bun test` is a Jest-compatible runner, so `describe` / `test` / `expect` all work.
