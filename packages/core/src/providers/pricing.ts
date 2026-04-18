import type { ModelConfig } from '../types';

/** USD price per million tokens, as published by each provider. */
export interface Pricing {
  inputPerMillion: number;
  outputPerMillion: number;
}

// Rates are the published on-demand list prices at the time of writing.
// They drift over time — update when they change, or when adding new models.
const TABLE: Record<string, Pricing> = {
  'anthropic:claude-opus-4-7': { inputPerMillion: 15, outputPerMillion: 75 },
  'anthropic:claude-sonnet-4-6': { inputPerMillion: 3, outputPerMillion: 15 },
  'anthropic:claude-haiku-4-5': { inputPerMillion: 1, outputPerMillion: 5 },
  'anthropic:claude-3-5-sonnet-20241022': { inputPerMillion: 3, outputPerMillion: 15 },
  'openai:gpt-4o': { inputPerMillion: 2.5, outputPerMillion: 10 },
  'openai:gpt-4o-mini': { inputPerMillion: 0.15, outputPerMillion: 0.6 },
  'google:gemini-1.5-pro': { inputPerMillion: 1.25, outputPerMillion: 5 },
};

/**
 * Estimates the total USD cost for a run. Returns `null` when the model isn't
 * in the pricing table — we'd rather not show a wrong number than make one up.
 *
 * Cost estimation ignores `copilot` models since that route bills against the
 * user's Copilot subscription, not per-token.
 */
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
