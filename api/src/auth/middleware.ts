import type { Context, MiddlewareHandler } from 'hono';
import { requireApiBearerToken } from '../config/index.js';
import type { AppConfig } from '../config/index.js';
import { readSession } from './session.js';

export function apiAuthMiddleware(config: AppConfig): MiddlewareHandler {
  return async (c, next) => {
    if (config.apiAuthMode === 'none') {
      await next();
      return;
    }

    if (config.apiAuthMode === 'session') {
      if (!readSession(c, config)) return writeAuthError(c, 'Missing or invalid session');
      await next();
      return;
    }

    const authorization = c.req.header('authorization');
    if (authorization !== `Bearer ${requireApiBearerToken(config)}`) {
      return writeAuthError(c, 'Missing or invalid bearer token');
    }

    await next();
  };
}

function writeAuthError(c: Context, message: string) {
  return c.json({ error: 'unauthorized', message }, 401);
}
