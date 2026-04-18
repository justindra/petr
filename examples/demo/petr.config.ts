import { defineConfig } from '@petr/core';

export default defineConfig({
  name: 'demo',
  dataset: './dataset.jsonl',
  prompt: './prompt.ts',
  model: {
    provider: 'anthropic',
    id: 'claude-haiku-4-5',
    temperature: 0,
  },
  evals: [{ name: 'label-match', type: 'equals', field: 'label' }],
  concurrency: 4,
  maxRetries: 3,
});
