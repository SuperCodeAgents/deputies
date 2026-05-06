import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Context } from 'hono';
import type { AppConfig } from '../config/index.js';

export const sessionCookieName = 'dev_deputies_session';

const sessionMaxAgeSeconds = 7 * 24 * 60 * 60;

export type AuthSession = {
  sub: string;
  username: string;
  exp: number;
};

export function createSessionCookie(input: { username: string; secret: string; secure: boolean; now?: Date }): string {
  const now = input.now ?? new Date();
  const session: AuthSession = {
    sub: input.username,
    username: input.username,
    exp: Math.floor(now.getTime() / 1000) + sessionMaxAgeSeconds,
  };
  return `${sessionCookieName}=${signSession(session, input.secret)}; Path=/; Max-Age=${sessionMaxAgeSeconds}; HttpOnly; SameSite=Lax${input.secure ? '; Secure' : ''}`;
}

export function clearSessionCookie(config: AppConfig): string {
  return `${sessionCookieName}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax${config.authCookieSecure ? '; Secure' : ''}`;
}

export function readSession(c: Context, config: AppConfig): AuthSession | null {
  if (!config.authSessionSecret) return null;
  const token = parseCookies(c.req.header('cookie') ?? '')[sessionCookieName];
  if (!token) return null;
  return verifySession(token, config.authSessionSecret);
}

export function signSession(session: AuthSession, secret: string): string {
  const payload = Buffer.from(JSON.stringify(session)).toString('base64url');
  const signature = createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

export function verifySession(token: string, secret: string, now: Date = new Date()): AuthSession | null {
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return null;
  const expected = createHmac('sha256', secret).update(payload).digest('base64url');
  if (!safeEqual(signature, expected)) return null;

  const parsed = parseSessionPayload(payload);
  if (!parsed) return null;
  if (parsed.exp <= Math.floor(now.getTime() / 1000)) return null;
  return parsed;
}

function parseSessionPayload(payload: string): AuthSession | null {
  try {
    const value = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as unknown;
    if (!value || typeof value !== 'object') return null;
    const candidate = value as Partial<AuthSession>;
    if (typeof candidate.sub !== 'string' || typeof candidate.username !== 'string' || typeof candidate.exp !== 'number') return null;
    return { sub: candidate.sub, username: candidate.username, exp: candidate.exp };
  } catch {
    return null;
  }
}

function parseCookies(header: string): Record<string, string> {
  const cookies: Record<string, string> = {};
  for (const part of header.split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (!name || !rest.length) continue;
    cookies[name] = rest.join('=');
  }
  return cookies;
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
