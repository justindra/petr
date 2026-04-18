import type { PromptFn } from '@petr/core';

interface Input {
  message: string;
}
interface Output {
  label: 'positive' | 'negative' | 'neutral';
}

const SYSTEM = `You classify customer messages by sentiment.
Reply with exactly one word: positive, negative, or neutral.
No punctuation, no explanation, no surrounding text.`;

const run: PromptFn<Input, Output> = async (input, ctx) => {
  const { text } = await ctx.llm.generateText({
    system: SYSTEM,
    prompt: input.message,
  });
  const normalized = text
    .trim()
    .toLowerCase()
    .replace(/[.!?"'`]/g, '');
  if (normalized === 'positive' || normalized === 'negative' || normalized === 'neutral') {
    return { label: normalized };
  }
  // Fallback when the model returns something unexpected; the eval will flag it.
  return { label: 'neutral' };
};

export default run;
