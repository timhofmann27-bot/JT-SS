import type { Request, Response, NextFunction } from 'express';
import crypto from 'node:crypto';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { verifySessionToken, shareToken } from './utils.ts';
import { getDb } from './db.ts';

// Extend Express Request
declare module 'express-serve-static-core' {
  interface Request {
    user?: import('./utils.ts').User;
    sessionToken?: string;
  }
}

// CRIT-3: Rate limiting middleware
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'too many attempts, try again later' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const ip = ipKeyGenerator(req);
    return ip || 'unknown';
  },
});

export const generalLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});

export const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
});

// Security headers
export function securityHeaders(_req: Request, res: Response, next: NextFunction): void {
  res.setHeader('x-content-type-options', 'nosniff');
  res.setHeader('x-frame-options', 'DENY');
  res.setHeader('x-xss-protection', '0');
  res.setHeader('referrer-policy', 'strict-origin-when-cross-origin');
  res.setHeader('permissions-policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('content-security-policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; media-src 'self' blob:; connect-src 'self' ws: wss:; font-src 'self'; frame-ancestors *;");
  res.setHeader('strict-transport-security', 'max-age=31536000; includeSubDomains');
  next();
}

// CORS configuration
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : ['http://localhost:3000', 'http://localhost:5173'];

export function corsMiddleware(req: Request, res: Response, next: NextFunction): void {
  const origin = req.header('origin');
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('access-control-allow-origin', origin);
    res.setHeader('access-control-allow-credentials', 'true');
    res.setHeader('access-control-allow-methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('access-control-allow-headers', 'content-type, x-share-token, x-auth-token');
    res.setHeader('access-control-max-age', '86400');
  }
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  next();
}

// HTTP request logging
export function httpRequestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();
  const method = req.method;
  const url = req.url;
  const ip = req.ip || req.socket.remoteAddress || 'unknown';

  res.on('finish', () => {
    const duration = Date.now() - start;
    const status = res.statusCode;
    const logLevel = status >= 500 ? 'ERROR' : status >= 400 ? 'WARN' : 'INFO';
    console.log(`[${logLevel}] ${method} ${url} ${status} ${duration}ms ${ip}`);
  });

  next();
}

// Token extraction
function getToken(req: Request): string {
  const headerToken = req.header('x-share-token');
  const queryToken = typeof req.query.token === 'string' ? req.query.token : '';
  return headerToken || queryToken || '';
}

// Share token middleware
export function requireShareToken(req: Request, res: Response, next: NextFunction): void {
  const candidate = getToken(req);

  // Accept static SHARE_TOKEN
  const expected = Buffer.from(shareToken);
  const actual = Buffer.from(candidate);
  if (actual.length === expected.length && crypto.timingSafeEqual(actual, expected)) {
    return next();
  }

  // Also accept JWT session token
  const session = verifySessionToken(candidate);
  if (session) {
    const db = getDb();
    const row = db.prepare('SELECT id, username, password_hash as passwordHash, role, created_at as createdAt, last_login as lastLogin FROM users WHERE id = ?').get(session.userId) as any;
    if (row) {
      req.user = row;
      req.sessionToken = candidate;
      return next();
    }
  }

  res.status(401).json({ error: 'unauthorized' });
}

// User auth middleware (JWT)
export function requireUserAuth(req: Request, res: Response, next: NextFunction): void {
  const token = req.headers['x-auth-token'] as string;
  if (!token) {
    res.status(401).json({ error: 'auth required' });
    return;
  }
  const session = verifySessionToken(token);
  if (!session) {
    res.status(401).json({ error: 'invalid or expired token' });
    return;
  }
  const db = getDb();
  const row = db.prepare('SELECT id, username, password_hash as passwordHash, role, created_at as createdAt, last_login as lastLogin FROM users WHERE id = ?').get(session.userId) as any;
  if (!row) {
    res.status(401).json({ error: 'user not found' });
    return;
  }
  req.user = row;
  req.sessionToken = token;
  next();
}

// Admin auth middleware
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const token = req.headers['x-auth-token'] as string;
  if (!token) {
    res.status(401).json({ error: 'auth required' });
    return;
  }
  const session = verifySessionToken(token);
  if (!session) {
    res.status(401).json({ error: 'invalid or expired token' });
    return;
  }
  const db = getDb();
  const row = db.prepare('SELECT id, username, password_hash as passwordHash, role, created_at as createdAt, last_login as lastLogin FROM users WHERE id = ?').get(session.userId) as any;
  if (!row || row.role !== 'admin') {
    res.status(403).json({ error: 'admin required' });
    return;
  }
  req.user = row;
  req.sessionToken = token;
  next();
}

// Token blacklist for logout (in-memory, clears on restart)
export const tokenBlacklist = new Set<string>();
