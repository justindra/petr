import type { LanguageModel, ModelMessage } from 'ai';

export interface DatasetRow<Input = unknown, Expected = unknown> {
  id: string;
  input: Input;
  expected?: Expected;
  tags?: string[];
}

export interface ModelConfig {
  provider: 'anthropic' | 'bedrock' | 'openai' | 'google';
  id: string;
  temperature?: number;
  maxTokens?: number;
  options?: Record<string, unknown>;
}

export interface EqualsEvalConfig {
  name: string;
  type: 'equals';
  field?: string;
  expected?: string;
}

export interface ContainsEvalConfig {
  name: string;
  type: 'contains';
  field?: string;
  expected?: string;
  caseInsensitive?: boolean;
}

export interface RegexEvalConfig {
  name: string;
  type: 'regex';
  field?: string;
  pattern: string;
  flags?: string;
}

export interface WithinNEvalConfig {
  name: string;
  type: 'withinN';
  field?: string;
  expected?: string;
  n: number;
}

export interface BooleanEvalConfig {
  name: string;
  type: 'boolean';
  field?: string;
  expected?: string;
}

export interface CustomEvalConfig {
  name: string;
  type: 'custom';
  file: string;
}

export type EvalConfig =
  | EqualsEvalConfig
  | ContainsEvalConfig
  | RegexEvalConfig
  | WithinNEvalConfig
  | BooleanEvalConfig
  | CustomEvalConfig;

export interface SuiteConfig {
  name: string;
  dataset: string;
  prompt: string;
  model: ModelConfig;
  evals: EvalConfig[];
  concurrency?: number;
  maxRetries?: number;
  out?: string;
}

export interface Logger {
  info(msg: string, meta?: Record<string, unknown>): void;
  warn(msg: string, meta?: Record<string, unknown>): void;
  error(msg: string, meta?: Record<string, unknown>): void;
  debug(msg: string, meta?: Record<string, unknown>): void;
}

export interface GenerateTextArgs {
  system?: string;
  prompt?: string;
  messages?: ModelMessage[];
  temperature?: number;
  maxTokens?: number;
}

export interface GenerateTextResult {
  text: string;
  usage: { inputTokens: number; outputTokens: number; totalTokens: number };
  finishReason?: string;
  messages: ModelMessage[];
}

export interface LLMContext {
  model: LanguageModel;
  generateText(args: GenerateTextArgs): Promise<GenerateTextResult>;
}

export interface RunContext {
  llm: LLMContext;
  row: DatasetRow;
  logger: Logger;
}

export type PromptFn<Input = unknown, Output = unknown> = (
  input: Input,
  ctx: RunContext,
) => Promise<Output>;

export interface EvalFnArgs<Output = unknown, Expected = unknown> {
  actual: Output;
  expected: Expected | undefined;
  row: DatasetRow;
  ctx: { llm: LLMContext; logger: Logger };
}

export interface EvalResult {
  name: string;
  pass: boolean;
  score?: number;
  detail?: string;
}

export type EvalFn<Output = unknown, Expected = unknown> = (
  args: EvalFnArgs<Output, Expected>,
) => Promise<EvalResult> | EvalResult;

export interface TranscriptEntry {
  role: string;
  content: unknown;
}

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

export interface RunManifest {
  name: string;
  runId: string;
  startedAt: string;
  endedAt: string;
  configHash: string;
  gitSha: string | null;
  model: ModelConfig;
  datasetPath: string;
  promptPath: string;
  rowCount: number;
  passCount: number;
  totalTokensIn: number;
  totalTokensOut: number;
  estimatedCostUsd: number | null;
}

export interface NotesEntry {
  rowId: string;
  text: string;
  tags?: string[];
  updatedAt: string;
}
