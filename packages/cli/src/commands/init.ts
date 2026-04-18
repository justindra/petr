import { Args, Command, Flags } from '@oclif/core';
import fs from 'node:fs/promises';
import path from 'node:path';

const CONFIG_TEMPLATE = `import { defineConfig } from '@petr/core';

export default defineConfig({
  name: 'demo',
  dataset: './dataset.jsonl',
  prompt: './prompt.ts',
  evals: [
    { name: 'label-match', type: 'equals', field: 'label' },
  ],
  variants: [
    // Add more variants to compare models or prompts against each other —
    // dataset + evals stay shared so the comparison is apples-to-apples.
    {
      name: 'main',
      model: {
        provider: 'anthropic',
        id: 'claude-haiku-4-5',
        temperature: 0,
      },
    },
  ],
  concurrency: 4,
  maxRetries: 3,
});
`;

const DATASET_TEMPLATE = `{"id":"r1","input":{"message":"thanks, that worked!"},"expected":{"label":"positive"}}
{"id":"r2","input":{"message":"it crashed again, useless."},"expected":{"label":"negative"}}
{"id":"r3","input":{"message":"meeting tomorrow at 3?"},"expected":{"label":"neutral"}}
`;

const PROMPT_TEMPLATE = `import type { PromptFn } from '@petr/core';

interface Input { message: string }
interface Output { label: 'positive' | 'negative' | 'neutral' }

const run: PromptFn<Input, Output> = async (input, ctx) => {
  const { text } = await ctx.llm.generateText({
    system: 'Classify the sentiment as "positive", "negative", or "neutral". Reply with only the label.',
    prompt: input.message,
  });
  const normalized = text.trim().toLowerCase();
  if (normalized === 'positive' || normalized === 'negative' || normalized === 'neutral') {
    return { label: normalized };
  }
  return { label: 'neutral' };
};

export default run;
`;

export default class Init extends Command {
  static override description = 'Scaffold a petr.config.ts, sample dataset, and sample prompt';

  static override args = {
    dir: Args.string({ description: 'Directory to scaffold into (default: current directory)' }),
  };

  static override flags = {
    force: Flags.boolean({ char: 'f', description: 'Overwrite existing files' }),
  };

  override async run(): Promise<void> {
    const { args, flags } = await this.parse(Init);
    const target = path.resolve(args.dir ?? '.');
    await fs.mkdir(target, { recursive: true });

    const files: Array<[string, string]> = [
      ['petr.config.ts', CONFIG_TEMPLATE],
      ['dataset.jsonl', DATASET_TEMPLATE],
      ['prompt.ts', PROMPT_TEMPLATE],
    ];

    for (const [name, content] of files) {
      const filePath = path.join(target, name);
      const exists = await fs
        .access(filePath)
        .then(() => true)
        .catch(() => false);
      if (exists && !flags.force) {
        this.warn(`skipping existing file: ${name} (use --force to overwrite)`);
        continue;
      }
      await fs.writeFile(filePath, content, 'utf8');
      this.log(`+ ${name}`);
    }

    this.log(
      `\nnext: cd ${path.relative(process.cwd(), target) || '.'} && petr run petr.config.ts`,
    );
  }
}
