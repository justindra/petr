import { describe, expect, test } from 'bun:test';
import { isServerMode, isStaticMode } from './api';

describe('mode detection', () => {
  test('isStaticMode returns false when window.__PETR_DATA__ is absent', () => {
    // No window in bun:test by default; these should be false-safe.
    expect(isStaticMode()).toBe(false);
    expect(isServerMode()).toBe(false);
  });
});
