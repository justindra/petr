import { defineConfig } from '@petr/core';

export default defineConfig({
  name: 'demo',
  dataset: './dataset.jsonl',
  prompt: './prompt.ts',
  model: {
    // Using GitHub Copilot's OpenAI-compatible endpoint; any Copilot-supported
    // model works here (claude-haiku-4.5, claude-sonnet-4.6, gpt-4o, …).
    // See https://docs.github.com/en/copilot/reference/ai-models/supported-models.
    // Requires GITHUB_COPILOT_TOKEN in .env (a Copilot OAuth token, NOT a PAT).
    provider: 'copilot',
    id: 'claude-sonnet-4.6',
    temperature: 0,
  },
  evals: [{ name: 'label-match', type: 'equals', field: 'label' }],
  concurrency: 4,
  maxRetries: 3,
});
