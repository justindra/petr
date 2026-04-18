import { bedrock } from '@ai-sdk/amazon-bedrock';
import { anthropic } from '@ai-sdk/anthropic';
import { google } from '@ai-sdk/google';
import { openai } from '@ai-sdk/openai';
import type { LanguageModel } from 'ai';
import type { ModelConfig } from '../types.js';
import { createCopilotModel } from './copilot.js';

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

export function providerLabel(cfg: ModelConfig): string {
  return `${cfg.provider}:${cfg.id}`;
}
