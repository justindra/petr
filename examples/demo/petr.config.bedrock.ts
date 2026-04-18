import { defineConfig } from '@petr/core';

export default defineConfig({
  // A distinct name so the two runs show up separately in `petr list`
  // and the compare artifacts are easy to distinguish.
  name: 'demo-bedrock',
  dataset: './dataset.jsonl',
  prompt: './prompt.ts',
  model: {
    // Bedrock's Claude models are exposed under Anthropic-style ids prefixed
    // with the region inference profile. Check `aws bedrock list-foundation-models`
    // for what's enabled in your account/region.
    provider: 'bedrock',
    id: 'us.anthropic.claude-haiku-4-5-20251001-v1:0',
    temperature: 0,
  },
  evals: [{ name: 'label-match', type: 'equals', field: 'label' }],
  concurrency: 4,
  maxRetries: 3,
});
