import type { Request, Response, NextFunction } from 'express';

const level = process.env.NODE_ENV === 'production' ? 'info' : 'debug';

export const logger = {
  level,
  info: (...args: unknown[]) => console.log('[info]', ...args),
  debug: (...args: unknown[]) => level === 'debug' && console.debug('[debug]', ...args),
  warn: (...args: unknown[]) => console.warn('[warn]', ...args),
  error: (...args: unknown[]) => console.error('[error]', ...args),
};

export function httpLogger(req: Request, res: Response, next: NextFunction) {
  if (req.url === '/api/health') { next(); return; }
  const start = Date.now();
  res.on('finish', () => {
    logger.info(req.method, req.url, res.statusCode, `${Date.now() - start}ms`);
  });
  next();
}
