import type { Logger } from './types';

/**
 * Basic console logger. Each line is prefixed with `[prefix]` when provided;
 * structured metadata is JSON-stringified and appended. `debug` only emits
 * when `process.env.DEBUG` is set, so everyday runs stay quiet.
 */
export function consoleLogger(prefix?: string): Logger {
  const tag = prefix ? `[${prefix}] ` : '';
  const fmt = (msg: string, meta?: Record<string, unknown>): string =>
    meta && Object.keys(meta).length > 0 ? `${tag}${msg} ${JSON.stringify(meta)}` : `${tag}${msg}`;
  return {
    info: (msg, meta) => console.log(fmt(msg, meta)),
    warn: (msg, meta) => console.warn(fmt(msg, meta)),
    error: (msg, meta) => console.error(fmt(msg, meta)),
    debug: (msg, meta) => {
      if (process.env['DEBUG']) console.log(fmt(msg, meta));
    },
  };
}

/** Drops every log. Pass this to {@link runSuite} in tests to keep stdout clean. */
export const silentLogger: Logger = {
  info: () => {},
  warn: () => {},
  error: () => {},
  debug: () => {},
};
