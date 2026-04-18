import { createOpenAI } from '@ai-sdk/openai';
import type { LanguageModel } from 'ai';

// GitHub Copilot exposes an OpenAI-compatible endpoint at api.githubcopilot.com.
// Two quirks vs. vanilla OpenAI:
//   - Choices sometimes miss an `index` field; Vercel AI SDK's Zod schema rejects that.
//   - Claude responses occasionally arrive split across multiple choices — one with
//     text, another with tool_calls — and the SDK only reads choices[0].
// This fetch wrapper normalizes both before the SDK sees the response.
function createCopilotFetch(): typeof globalThis.fetch {
  // Cast: createOpenAI's type demands the full fetch interface (including preconnect),
  // but at runtime the SDK only invokes the function. The cast is safe.
  return (async (input: Parameters<typeof globalThis.fetch>[0], init?: Parameters<typeof globalThis.fetch>[1]) => {
    const response = await globalThis.fetch(input, init);
    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.includes('application/json')) return response;

    const body = await response.text();
    let json: Record<string, unknown>;
    try {
      json = JSON.parse(body);
    } catch {
      return new Response(body, response);
    }

    if (Array.isArray(json['choices'])) {
      const choices = (json['choices'] as unknown[]).map((c) =>
        c && typeof c === 'object' ? (c as Record<string, unknown>) : {},
      );
      json['choices'] = choices;

      for (const choice of choices) {
        const msg =
          choice['message'] && typeof choice['message'] === 'object'
            ? (choice['message'] as Record<string, unknown>)
            : undefined;
        const delta =
          choice['delta'] && typeof choice['delta'] === 'object'
            ? (choice['delta'] as Record<string, unknown>)
            : undefined;
        const normalized: Record<string, unknown> = {
          role:
            typeof msg?.['role'] === 'string'
              ? msg['role']
              : typeof delta?.['role'] === 'string'
                ? delta['role']
                : 'assistant',
          content:
            typeof msg?.['content'] === 'string'
              ? msg['content']
              : typeof choice['text'] === 'string'
                ? choice['text']
                : '',
        };
        if (msg?.['tool_calls']) normalized['tool_calls'] = msg['tool_calls'];
        else if (delta?.['tool_calls']) normalized['tool_calls'] = delta['tool_calls'];
        choice['message'] = normalized;
      }

      if (choices.length === 0) {
        choices.push({
          index: 0,
          finish_reason: 'stop',
          message: { role: 'assistant', content: '' },
        });
      }

      // Merge tool_calls from later choices into choice[0] — SDK only reads the first.
      if (choices.length > 1) {
        const firstMsg = choices[0]?.['message'] as Record<string, unknown> | undefined;
        if (firstMsg && !firstMsg['tool_calls']) {
          for (let i = 1; i < choices.length; i++) {
            const other = choices[i]?.['message'] as Record<string, unknown> | undefined;
            if (other?.['tool_calls']) {
              firstMsg['tool_calls'] = other['tool_calls'];
              choices.splice(i, 1);
              break;
            }
          }
        }
      }

      choices.forEach((choice, i: number) => {
        if (choice['index'] === undefined) choice['index'] = i;
      });
    }

    return new Response(JSON.stringify(json), {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  }) as typeof globalThis.fetch;
}

export function createCopilotModel(modelId: string): LanguageModel {
  const token = process.env['GITHUB_COPILOT_TOKEN'];
  if (!token) {
    throw new Error(
      'GITHUB_COPILOT_TOKEN is not set. Obtain one via a Copilot OAuth device flow ' +
        'and put it in your .env. Regular GitHub PATs do not work with api.githubcopilot.com.',
    );
  }
  const copilot = createOpenAI({
    baseURL: 'https://api.githubcopilot.com',
    apiKey: token,
    fetch: createCopilotFetch(),
    headers: {
      'Openai-Intent': 'conversation-edits',
    },
  });
  return copilot.chat(modelId);
}
