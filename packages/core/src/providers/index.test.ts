import { describe, expect, test } from 'bun:test';
import { resolveModel } from './index';

describe('resolveModel', () => {
  test('returns a model instance for each supported provider', () => {
    for (const provider of ['anthropic', 'bedrock', 'openai', 'google'] as const) {
      const model = resolveModel({ provider, id: 'dummy' });
      expect(model).toBeDefined();
      expect(typeof model).toMatch(/^(object|string)$/);
    }
  });
});
