import type { PromptFn } from '@petr/core';

interface Input {
  message: string;
}
interface Output {
  label: 'positive' | 'negative' | 'neutral';
}

// Non-LLM demo prompt — classifies deterministically so the example runs
// without API credentials. Replace the body with a `ctx.llm.generateText` call
// in a real project.
const run: PromptFn<Input, Output> = async (input) => {
  const msg = input.message.toLowerCase();
  if (msg.includes('thanks') || msg.includes('worked')) return { label: 'positive' };
  if (msg.includes('crash') || msg.includes('useless')) return { label: 'negative' };
  return { label: 'neutral' };
};

export default run;
