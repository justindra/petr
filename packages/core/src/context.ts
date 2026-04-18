import { generateText as aiGenerateText, type ModelMessage } from 'ai';
import { resolveModel } from './providers';
import type {
  GenerateTextArgs,
  GenerateTextResult,
  LLMContext,
  ModelConfig,
  TranscriptEntry,
} from './types';

/**
 * A per-row LLM session. `llm` is the model-bound surface passed into the
 * user's prompt; `getUsage` and `getTranscript` drain the accumulated state
 * after the prompt returns so the runner can attach it to the row result.
 */
export interface LLMSession {
  llm: LLMContext;
  getUsage(): { inputTokens: number; outputTokens: number; totalTokens: number };
  getTranscript(): TranscriptEntry[];
}

/**
 * Builds a fresh {@link LLMSession} for one row. Usage and transcript live in
 * the closure so each row's numbers stay isolated even when rows run in
 * parallel.
 *
 * Pass this (or a stub with the same shape) to {@link RunSuiteOptions.buildSession}
 * when embedding the runner programmatically.
 */
export function buildLLMContext(modelCfg: ModelConfig): LLMSession {
  const model = resolveModel(modelCfg);
  const usage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
  const transcript: TranscriptEntry[] = [];

  const llm: LLMContext = {
    model,
    async generateText(args: GenerateTextArgs): Promise<GenerateTextResult> {
      const callArgs = buildCallArgs(model, modelCfg, args);
      const response = await aiGenerateText(callArgs);
      const inTok = response.usage.inputTokens ?? 0;
      const outTok = response.usage.outputTokens ?? 0;
      usage.inputTokens += inTok;
      usage.outputTokens += outTok;
      usage.totalTokens = usage.inputTokens + usage.outputTokens;

      recordTranscript(transcript, args);
      transcript.push({ role: 'assistant', content: response.text });

      const messages = response.response?.messages ?? [];
      const result: GenerateTextResult = {
        text: response.text,
        usage: { inputTokens: inTok, outputTokens: outTok, totalTokens: inTok + outTok },
        messages,
      };
      if (response.finishReason) result.finishReason = response.finishReason;
      return result;
    },
  };

  return {
    llm,
    getUsage: () => ({ ...usage }),
    getTranscript: () => [...transcript],
  };
}

type AiGenerateTextArgs = Parameters<typeof aiGenerateText>[0];

function buildCallArgs(
  model: ReturnType<typeof resolveModel>,
  cfg: ModelConfig,
  args: GenerateTextArgs,
): AiGenerateTextArgs {
  const base: Record<string, unknown> = { model };
  const temperature = args.temperature ?? cfg.temperature;
  if (temperature !== undefined) base['temperature'] = temperature;
  const maxTokens = args.maxTokens ?? cfg.maxTokens;
  if (maxTokens !== undefined) base['maxOutputTokens'] = maxTokens;
  if (args.messages) base['messages'] = args.messages;
  else if (args.prompt !== undefined) {
    base['prompt'] = args.prompt;
    if (args.system !== undefined) base['system'] = args.system;
  } else if (args.system !== undefined) {
    base['system'] = args.system;
  }
  return base as AiGenerateTextArgs;
}

function recordTranscript(acc: TranscriptEntry[], args: GenerateTextArgs): void {
  if (args.system !== undefined) acc.push({ role: 'system', content: args.system });
  if (args.messages) {
    for (const m of args.messages as ModelMessage[]) {
      acc.push({ role: m.role, content: m.content });
    }
  } else if (args.prompt !== undefined) {
    acc.push({ role: 'user', content: args.prompt });
  }
}
