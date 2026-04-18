import { bedrock } from '@ai-sdk/amazon-bedrock';
import { anthropic } from '@ai-sdk/anthropic';
import { google } from '@ai-sdk/google';
import { openai } from '@ai-sdk/openai';
import type { LanguageModel } from 'ai';
import type { ModelConfig } from '../types';
import { createCopilotModel } from './copilot';

/**
 * Builds the Vercel AI SDK {@link LanguageModel} for a {@link ModelConfig}.
 *
 * Credentials come from provider-specific env vars (`ANTHROPIC_API_KEY`,
 * `OPENAI_API_KEY`, AWS creds for Bedrock, `GITHUB_COPILOT_TOKEN` for Copilot
 * — see README for the full table). Model construction is lazy; this call
 * doesn't hit the network.
 */
export function resolveModel(cfg: ModelConfig): LanguageModel {
  switch (cfg.provider) {
    case 'anthropic':
      return anthropic(cfg.id);
    case 'bedrock':
      return bedrock(cfg.id);
    case 'openai':
      return openai(cfg.id);
    case 'google':
      return google(cfg.id);
    case 'copilot':
      return createCopilotModel(cfg.id);
  }
}
