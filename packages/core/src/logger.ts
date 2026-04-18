import type { Logger } from './types.js';

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

export const silentLogger: Logger = {
  info: () => {},
  warn: () => {},
  error: () => {},
  debug: () => {},
};
