import { describe, expect, test } from 'bun:test';
import { providerLabel, resolveModel } from './index.js';

describe('resolveModel', () => {
  test('returns a model instance for each supported provider', () => {
    for (const provider of ['anthropic', 'bedrock', 'openai', 'google'] as const) {
      const model = resolveModel({ provider, id: 'dummy' });
      expect(model).toBeDefined();
      expect(typeof model).toMatch(/^(object|string)$/);
    }
  });
});

describe('providerLabel', () => {
  test('joins provider and id', () => {
    expect(providerLabel({ provider: 'anthropic', id: 'claude-x' })).toBe('anthropic:claude-x');
  });
});
