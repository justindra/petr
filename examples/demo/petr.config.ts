import { defineConfig } from '@petr-ai/core';

export default defineConfig({
  name: 'demo',
  dataset: './dataset.jsonl',
  prompt: './prompt.ts',
  evals: [{ name: 'label-match', type: 'equals', field: 'label' }],
  variants: [
    {
      // GitHub Copilot route. Requires GITHUB_COPILOT_TOKEN (a Copilot OAuth
      // token, not a PAT) in .env.
      name: 'copilot',
      model: {
        provider: 'copilot',
        id: 'claude-sonnet-4.6',
        temperature: 0,
      },
    },
    {
      // AWS Bedrock route. Requires AWS_PROFILE + AWS_REGION (or raw keys)
      // and the model enabled in your Bedrock catalog.
      name: 'bedrock',
      model: {
        provider: 'bedrock',
        id: 'us.anthropic.claude-haiku-4-5-20251001-v1:0',
        temperature: 0,
      },
    },
  ],
  concurrency: 4,
  maxRetries: 3,
});
