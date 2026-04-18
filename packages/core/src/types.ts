import type { LanguageModel, ModelMessage } from 'ai';

/**
 * A single evaluation case. `input` is passed to the user's prompt function;
 * `expected` is available to evals for comparison. `id` uniquely identifies
 * the row across runs — when absent from the JSONL, it's derived from a
 * content hash of `input` + `expected`.
 */
export interface DatasetRow<Input = unknown, Expected = unknown> {
  id: string;
  input: Input;
  expected?: Expected;
  tags?: string[];
}

/** Provider + model selection. Providers map to env vars for credentials. */
export interface ModelConfig {
  /**
   * Which adapter to use. `copilot` hits `api.githubcopilot.com` (unofficial,
   * requires a Copilot OAuth token — not a GitHub PAT).
   */
  provider: 'anthropic' | 'bedrock' | 'openai' | 'google' | 'copilot';
  /** Provider-specific model id (e.g. `claude-sonnet-4.6`, `gpt-4o-mini`). */
  id: string;
  temperature?: number;
  maxTokens?: number;
  /** Reserved for future provider-specific options; currently unused. */
  options?: Record<string, unknown>;
}

/**
 * Deep-equality comparison between a field of the prompt output and a value
 * resolved from the row. By default compares `actual[field]` to
 * `row.expected[field]`; override via `expected` (see eval semantics).
 */
export interface EqualsEvalConfig {
  name: string;
  type: 'equals';
  /** Dot-path into the prompt's output. Omit to compare the whole output. */
  field?: string;
  /**
   * Where to source the expected value. `row.*` / `input.*` resolve dot-paths
   * against the dataset row; any other value is treated as a literal; omit to
   * use `row.expected[field]`.
   */
  expected?: string;
}

/** Substring check. `expected` follows the same resolution rules as `EqualsEvalConfig`. */
export interface ContainsEvalConfig {
  name: string;
  type: 'contains';
  field?: string;
  expected?: string;
  caseInsensitive?: boolean;
}

/** Regex test against `actual[field]` (or whole output when `field` is omitted). */
export interface RegexEvalConfig {
  name: string;
  type: 'regex';
  field?: string;
  pattern: string;
  flags?: string;
}

/**
 * Numeric tolerance: passes when `|actual - expected| <= n`. Useful for
 * scored outputs where exact matches are too strict.
 */
export interface WithinNEvalConfig {
  name: string;
  type: 'withinN';
  field?: string;
  expected?: string;
  /** Inclusive tolerance. */
  n: number;
}

/**
 * Boolean comparison with permissive coercion — `true/yes/y/1` and
 * `false/no/n/0` all work, case-insensitive.
 */
export interface BooleanEvalConfig {
  name: string;
  type: 'boolean';
  field?: string;
  expected?: string;
}

/**
 * Delegates to a user-written eval in a TS/JS file with a default-exported
 * {@link EvalFn}. The path is resolved relative to the config file's directory.
 */
export interface CustomEvalConfig {
  name: string;
  type: 'custom';
  file: string;
}

/** Discriminated union of all built-in and custom eval shapes. */
export type EvalConfig =
  | EqualsEvalConfig
  | ContainsEvalConfig
  | RegexEvalConfig
  | WithinNEvalConfig
  | BooleanEvalConfig
  | CustomEvalConfig;

/** The top-level config passed to {@link defineConfig}. */
export interface SuiteConfig {
  /** Human-readable suite name; used in run ids and report headers. */
  name: string;
  /** Path to a JSONL dataset, relative to the config file. */
  dataset: string;
  /** Path to a TS/JS file exporting a {@link PromptFn} as default. */
  prompt: string;
  model: ModelConfig;
  evals: EvalConfig[];
  /** Max rows in flight at once. Default: 4. */
  concurrency?: number;
  /** Retries per row on transient errors, with exponential backoff. Default: 3. */
  maxRetries?: number;
  /** Default output directory. CLI flag `--out` overrides this. */
  out?: string;
}

/** Minimal logger interface the runner and user prompts use. */
export interface Logger {
  info(msg: string, meta?: Record<string, unknown>): void;
  warn(msg: string, meta?: Record<string, unknown>): void;
  error(msg: string, meta?: Record<string, unknown>): void;
  /** Only emits when `process.env.DEBUG` is set. */
  debug(msg: string, meta?: Record<string, unknown>): void;
}

/** Options passed to `ctx.llm.generateText` — a model-free subset of the Vercel AI SDK. */
export interface GenerateTextArgs {
  system?: string;
  prompt?: string;
  messages?: ModelMessage[];
  /** Overrides `model.temperature` for this single call. */
  temperature?: number;
  /** Overrides `model.maxTokens` for this single call. */
  maxTokens?: number;
}

/** Result returned to prompt code from `ctx.llm.generateText`. */
export interface GenerateTextResult {
  text: string;
  usage: { inputTokens: number; outputTokens: number; totalTokens: number };
  finishReason?: string;
  messages: ModelMessage[];
}

/**
 * The model-bound LLM surface a prompt sees. `generateText` forwards to the
 * Vercel AI SDK with the suite's model pre-applied, so prompts never touch
 * provider keys or base URLs directly. `model` is the raw language-model
 * handle for power users who want to call the SDK themselves.
 */
export interface LLMContext {
  model: LanguageModel;
  generateText(args: GenerateTextArgs): Promise<GenerateTextResult>;
}

/** Context object passed as the second argument to every {@link PromptFn}. */
export interface RunContext {
  llm: LLMContext;
  row: DatasetRow;
  logger: Logger;
}

/**
 * Signature of a user-written prompt file. The default export must match this.
 *
 * Whatever you return becomes the `actual` value that evals see.
 *
 * @example
 * ```ts
 * const run: PromptFn<{ message: string }, { label: string }> = async (input, ctx) => {
 *   const { text } = await ctx.llm.generateText({ prompt: input.message });
 *   return { label: text.trim() };
 * };
 * export default run;
 * ```
 */
export type PromptFn<Input = unknown, Output = unknown> = (
  input: Input,
  ctx: RunContext,
) => Promise<Output>;

/** Arguments passed to a custom eval function. */
export interface EvalFnArgs<Output = unknown, Expected = unknown> {
  /** Whatever the prompt returned for this row. */
  actual: Output;
  /** `row.expected` verbatim — the custom eval can dig in as it pleases. */
  expected: Expected | undefined;
  row: DatasetRow;
  ctx: { llm: LLMContext; logger: Logger };
}

/** A single eval's verdict on a single row. */
export interface EvalResult {
  name: string;
  pass: boolean;
  /** Optional numeric score (0–1 range by convention, but not enforced). */
  score?: number;
  /** Short human-readable note attached to the row in reports. */
  detail?: string;
}

/**
 * Signature of a custom eval — default-exported from the file pointed to by
 * {@link CustomEvalConfig.file}.
 */
export type EvalFn<Output = unknown, Expected = unknown> = (
  args: EvalFnArgs<Output, Expected>,
) => Promise<EvalResult> | EvalResult;

/** One entry in a row's captured conversation history (system/user/assistant/...). */
export interface TranscriptEntry {
  role: string;
  content: unknown;
}

/**
 * The final per-row record written to `results.json`. Retries don't appear
 * here — only the outcome of the final attempt. `pass` is true only when the
 * row ran without error AND every eval passed.
 */
export interface RowResult {
  id: string;
  input: unknown;
  expected: unknown;
  output: unknown;
  error: string | null;
  evals: EvalResult[];
  pass: boolean;
  latencyMs: number;
  tokensIn: number;
  tokensOut: number;
  transcript: TranscriptEntry[];
}

/**
 * Run-level metadata written to `manifest.json`. Intended for reproducibility
 * and cross-run analysis — not for the happy-path results themselves (those
 * live in `results.csv` / `results.json`).
 */
export interface RunManifest {
  name: string;
  runId: string;
  startedAt: string;
  endedAt: string;
  /** SHA-256 prefix of the serialized config — shifts when any config field changes. */
  configHash: string;
  gitSha: string | null;
  model: ModelConfig;
  /** Relative to the config's baseDir, when possible. */
  datasetPath: string;
  /** Relative to the config's baseDir, when possible. */
  promptPath: string;
  rowCount: number;
  passCount: number;
  totalTokensIn: number;
  totalTokensOut: number;
  /** Null when the model is not in the pricing table. */
  estimatedCostUsd: number | null;
}

/** A reviewer note attached to a dataset row, persisted to a JSONL sidecar. */
export interface NotesEntry {
  rowId: string;
  text: string;
  tags?: string[];
  updatedAt: string;
}
