import type { ModelConfig } from '../types.js';

export interface Pricing {
  inputPerMillion: number;
  outputPerMillion: number;
}

const TABLE: Record<string, Pricing> = {
  'anthropic:claude-opus-4-7': { inputPerMillion: 15, outputPerMillion: 75 },
  'anthropic:claude-sonnet-4-6': { inputPerMillion: 3, outputPerMillion: 15 },
  'anthropic:claude-haiku-4-5': { inputPerMillion: 1, outputPerMillion: 5 },
  'anthropic:claude-3-5-sonnet-20241022': { inputPerMillion: 3, outputPerMillion: 15 },
  'openai:gpt-4o': { inputPerMillion: 2.5, outputPerMillion: 10 },
  'openai:gpt-4o-mini': { inputPerMillion: 0.15, outputPerMillion: 0.6 },
  'google:gemini-1.5-pro': { inputPerMillion: 1.25, outputPerMillion: 5 },
};

export function estimateCostUsd(
  model: ModelConfig,
  tokensIn: number,
  tokensOut: number,
): number | null {
  const key = `${model.provider}:${model.id}`;
  const entry = TABLE[key];
  if (!entry) return null;
  return (tokensIn * entry.inputPerMillion + tokensOut * entry.outputPerMillion) / 1_000_000;
}
