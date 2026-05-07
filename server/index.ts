import { spawn, exec } from "node:child_process";
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import dotenv from 'dotenv';
import express from "express";
import compression from "compression";
import {parseFile} from 'music-metadata';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import rateLimit, { ipKeyGenerator } from "express-rate-limit";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const mediaDir = path.resolve(process.env.MEDIA_DIR ?? path.join(rootDir, 'media'));
const dataDir = path.resolve(process.env.DATA_DIR ?? path.join(rootDir, 'data'));
const stateFile = path.join(dataDir, 'state.json');
const usersFile = path.join(dataDir, 'users.json');
const invitesFile = path.join(dataDir, 'invites.json');
const distDir = path.join(rootDir, 'dist');
const port = Number(process.env.PORT ?? 3001);
const shareToken = process.env.SHARE_TOKEN;

// CRIT-3: Require ADMIN_SECRET - no defaults
const adminSecret = process.env.ADMIN_SECRET;
if (!adminSecret) {
  console.error('FATAL: ADMIN_SECRET environment variable is not set.');
  process.exit(1);
}
if (!shareToken) {
  console.error('FATAL: SHARE_TOKEN environment variable is not set.');
  process.exit(1);
}

const roomName = process.env.ROOM_NAME ?? 'StreamSync';
const maxPeers = Number(process.env.MAX_PEERS ?? 10);
const JWT_SECRET = process.env.JWT_SECRET ?? crypto.randomBytes(64).toString('hex');
const JWT_EXPIRY = process.env.JWT_EXPIRY ?? '24h';
const BCRYPT_ROUNDS = 12;

function ensureDataFile(file: string, defaultData: object) {
  if (!fs.existsSync(file)) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(defaultData));
  }
  return JSON.parse(fs.readFileSync(file, 'utf-8'));
}

interface User {
  id: string;
  username: string;
  passwordHash: string;
  role: 'admin' | 'member';
  createdAt: string;
  lastLogin: string;
}

declare module 'express-serve-static-core' {
  interface Request {
    user?: User;
    sessionToken?: string;
  }
}

interface SessionToken {
  userId: string;
  jti: string;
  iat: number;
  exp: number;
}

interface Invite {
  id: string;
  code: string;
  role: 'admin' | 'member';
  maxUses: number;
  usedCount: number;
  usedBy: string[];
  expiresAt?: string;
  createdAt: string;
  createdBy: string;
}

const users: User[] = ensureDataFile(usersFile, []).users || [];
const invites: Invite[] = ensureDataFile(invitesFile, []).invites || [];

function saveUsers() {
  fs.writeFileSync(usersFile, JSON.stringify({ users }, null, 2));
}

function saveInvites() {
  fs.writeFileSync(invitesFile, JSON.stringify({ invites }, null, 2));
}

// CRIT-2: Use bcrypt instead of SHA-256
async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// CRIT-1/5: Proper JWT session tokens
function generateSessionToken(user: User): string {
  return jwt.sign(
    {
      userId: user.id,
      username: user.username,
      role: user.role,
      jti: crypto.randomUUID(),
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRY }
  );
}

function verifySessionToken(token: string): SessionToken | null {
  try {
    return jwt.verify(token, JWT_SECRET) as SessionToken;
  } catch {
    return null;
  }
}

// HIGH-4/5: Use UUIDs and longer invite codes
function generateInviteCode(): string {
  return crypto.randomBytes(12).toString('base64url').replace(/[^a-zA-Z0-9]/g, '').slice(0, 16).toUpperCase();
}

// CRIT-4: Rate limiting middleware
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window
  message: { error: 'too many attempts, try again later' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const ip = ipKeyGenerator(req);
    return ip || 'unknown';
  },
});

const generalLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});

const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
});

function parseSize(sizeStr: string) {
  const match = sizeStr.match(/^(\d+)(KB|MB|GB)$/i);
  if (!match) return 100 * 1024 * 1024;
  const value = Number(match[1]);
  const unit = match[2].toUpperCase();
  const multipliers: Record<string, number> = { KB: 1024, MB: 1024 * 1024, GB: 1024 * 1024 * 1024 };
  return value * (multipliers[unit] || 1);
}

const maxUploadBytes = parseSize(process.env.MAX_UPLOAD_SIZE ?? '100MB');

const supportedExtensions = new Map<string, {kind: 'audio' | 'video'; mimeType: string}>([
  ['.mp3', {kind: 'audio', mimeType: 'audio/mpeg'}],
  ['.m4a', {kind: 'audio', mimeType: 'audio/mp4'}],
  ['.aac', {kind: 'audio', mimeType: 'audio/aac'}],
  ['.wav', {kind: 'audio', mimeType: 'audio/wav'}],
  ['.flac', {kind: 'audio', mimeType: 'audio/flac'}],
  ['.ogg', {kind: 'audio', mimeType: 'audio/ogg'}],
  ['.mp4', {kind: 'video', mimeType: 'video/mp4'}],
  ['.webm', {kind: 'video', mimeType: 'video/webm'}],
  ['.mov', {kind: 'video', mimeType: 'video/quicktime'}],
]);

interface ApiFile {
  id: string;
  name: string;
  title: string;
  artist?: string;
  album?: string;
  kind: 'audio' | 'video';
  mimeType: string;
  size: number;
  sizeLabel: string;
  duration?: number;
  durationLabel?: string;
  hasArtwork: boolean;
  modifiedAt: string;
}

interface QueueItem {
  id: string;
  fileId: string;
  addedAt: string;
}

interface PrivateState {
  likedIds: string[];
  queue: QueueItem[];
  updatedAt: string;
}

fs.mkdirSync(mediaDir, {recursive: true});
fs.mkdirSync(dataDir, {recursive: true});

const app = express();

app.disable('x-powered-by');
app.use(compression());

// Security headers
app.use((request, response, next) => {
  response.setHeader('x-content-type-options', 'nosniff');
  response.setHeader('x-frame-options', 'DENY');
  response.setHeader('x-xss-protection', '0');
  response.setHeader('referrer-policy', 'strict-origin-when-cross-origin');
  response.setHeader('permissions-policy', 'camera=(), microphone=(), geolocation=()');
  response.setHeader('content-security-policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; media-src 'self' blob:; connect-src 'self' ws: wss:; font-src 'self'; frame-ancestors *;");
  response.setHeader('strict-transport-security', 'max-age=31536000; includeSubDomains');
  next();
});

app.use(express.json({limit: '64kb'}));

const eventClients = new Set<express.Response>();

// Token blacklist for logout (in-memory, clears on restart)
const tokenBlacklist = new Set<string>();

// HTTP request logging middleware
app.use((request, response, next) => {
  const start = Date.now();
  const method = request.method;
  const url = request.url;
  const ip = request.ip || request.socket.remoteAddress || 'unknown';

  response.on('finish', () => {
    const duration = Date.now() - start;
    const status = response.statusCode;
    const logLevel = status >= 500 ? 'ERROR' : status >= 400 ? 'WARN' : 'INFO';
    console.log(`[${logLevel}] ${method} ${url} ${status} ${duration}ms ${ip}`);
  });

  next();
});

// CORS configuration
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : ['http://localhost:3000', 'http://localhost:5173'];

app.use((request, response, next) => {
  const origin = request.header('origin');
  if (origin && allowedOrigins.includes(origin)) {
    response.setHeader('access-control-allow-origin', origin);
    response.setHeader('access-control-allow-credentials', 'true');
    response.setHeader('access-control-allow-methods', 'GET, POST, PUT, DELETE, OPTIONS');
    response.setHeader('access-control-allow-headers', 'content-type, x-share-token, x-auth-token');
    response.setHeader('access-control-max-age', '86400');
  }
  if (request.method === 'OPTIONS') {
    response.status(204).end();
    return;
  }
  next();
});

function getToken(request: express.Request) {
  const headerToken = request.header('x-share-token');
  const queryToken = typeof request.query.token === 'string' ? request.query.token : '';
  return headerToken || queryToken || '';
}

function requireShareToken(request: express.Request, response: express.Response, next: express.NextFunction) {
  const candidate = getToken(request);
  
  // Accept static SHARE_TOKEN (for direct API access)
  const expected = Buffer.from(shareToken);
  const actual = Buffer.from(candidate);
  if (actual.length === expected.length && crypto.timingSafeEqual(actual, expected)) {
    return next();
  }
  
  // Also accept JWT session token (for logged-in users)
  const session = verifySessionToken(candidate);
  if (session) {
    const user = users.find((u) => u.id === session.userId);
    if (user) {
      request.user = user;
      request.sessionToken = candidate;
      return next();
    }
  }
  
  response.status(401).json({error: 'unauthorized'});
}

// CRIT-5: JWT-based user auth middleware
function requireUserAuth(request: express.Request, response: express.Response, next: express.NextFunction) {
  const token = request.headers['x-auth-token'] as string;
  if (!token) {
    response.status(401).json({ error: 'auth required' });
    return;
  }
  const session = verifySessionToken(token);
  if (!session) {
    response.status(401).json({ error: 'invalid or expired token' });
    return;
  }
  const user = users.find((u) => u.id === session.userId);
  if (!user) {
    response.status(401).json({ error: 'user not found' });
    return;
  }
  request.user = user;
  request.sessionToken = token;
  next();
}

function requireAdmin(request: express.Request, response: express.Response, next: express.NextFunction) {
  const token = request.headers['x-auth-token'] as string;
  if (!token) {
    response.status(401).json({ error: 'auth required' });
    return;
  }
  const session = verifySessionToken(token);
  if (!session) {
    response.status(401).json({ error: 'invalid or expired token' });
    return;
  }
  const user = users.find((u) => u.id === session.userId);
  if (!user || user.role !== 'admin') {
    response.status(403).json({ error: 'admin required' });
    return;
  }
  request.user = user;
  request.sessionToken = token;
  next();
}

function publicHost() {
  const interfaces = os.networkInterfaces();
  for (const entries of Object.values(interfaces)) {
    for (const entry of entries ?? []) {
      if (entry.family === 'IPv4' && !entry.internal) {
        return `http://${entry.address}:${port}`;
      }
    }
  }
  return `http://localhost:${port}`;
}

function formatBytes(size: number) {
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = size;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function formatDuration(duration?: number) {
  if (!duration || !Number.isFinite(duration)) return undefined;
  const minutes = Math.floor(duration / 60);
  const seconds = Math.floor(duration % 60).toString().padStart(2, '0');
  return `${minutes}:${seconds}`;
}

async function readMetadata(absolutePath: string) {
  try {
    return await parseFile(absolutePath, {
      duration: true,
      skipCovers: false,
    });
  } catch {
    return null;
  }
}

async function readState(): Promise<PrivateState> {
  try {
    const raw = await fs.promises.readFile(stateFile, 'utf8');
    const parsed = JSON.parse(raw) as Partial<PrivateState>;

    return {
      likedIds: Array.isArray(parsed.likedIds) ? parsed.likedIds.filter((id) => typeof id === 'string') : [],
      queue: Array.isArray(parsed.queue)
        ? parsed.queue.filter((item): item is QueueItem => Boolean(item) && typeof item.id === 'string' && typeof item.fileId === 'string' && typeof item.addedAt === 'string')
        : [],
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date().toISOString(),
    };
  } catch {
    return {
      likedIds: [],
      queue: [],
      updatedAt: new Date().toISOString(),
    };
  }
}

let writeQueue: Promise<any> = Promise.resolve();

async function writeState(state: PrivateState) {
  const operation = async () => {
    const nextState = {
      ...state,
      likedIds: Array.from(new Set(state.likedIds)),
      updatedAt: new Date().toISOString(),
    };
    const tempFile = `${stateFile}.tmp`;
    await fs.promises.writeFile(tempFile, `${JSON.stringify(nextState, null, 2)}\n`, 'utf8');
    await fs.promises.rename(tempFile, stateFile);
    await broadcastState();
    return nextState;
  };

  const result = writeQueue.then(operation).catch(err => {
    console.error('State write error:', err instanceof Error ? err.message : String(err));
    throw err;
  });

  writeQueue = result.then(() => {}).catch(() => {});
  return result;
}

async function roomState(files?: ApiFile[]) {
  const availableFiles = files ?? await listFiles();
  const state = await readState();
  const fileMap = new Map(availableFiles.map((file) => [file.id, file]));

  return {
    likedIds: state.likedIds.filter((id) => fileMap.has(id)),
    queue: state.queue
      .filter((item) => fileMap.has(item.fileId))
      .map((item) => ({
        ...item,
        file: fileMap.get(item.fileId),
      })),
    playlists: [],
    updatedAt: state.updatedAt,
  };
}

async function broadcastState() {
  if (eventClients.size === 0) return;
  const payload = JSON.stringify(await roomState());

  for (const client of eventClients) {
    client.write(`event: state\n`);
    client.write(`data: ${payload}\n\n`);
  }
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// HIGH-2: Stricter path traversal protection
function safeFileName(value: string) {
  const parsed = path.parse(value);
  const extension = parsed.ext.toLowerCase();
  // Only allow alphanumeric, dots, hyphens, underscores, spaces
  const base = parsed.name.replace(/[^a-zA-Z0-9._ -]/g, '_').trim() || 'upload';
  // Validate extension is safe
  if (!/^\.[a-zA-Z0-9]+$/.test(extension)) {
    throw new Error('invalid file extension');
  }
  return `${base}${extension}`;
}

function resolveMediaPath(fileName: string) {
  const safeName = safeFileName(fileName);
  const resolved = path.resolve(mediaDir, safeName);

  // Double-check: resolved path must start with mediaDir
  if (!resolved.startsWith(mediaDir + path.sep) && resolved !== mediaDir) {
    throw new Error('invalid media path');
  }
  return resolved;
}

// HIGH-1: Magic bytes validation
const magicBytes: Record<string, Buffer[]> = {
  '.mp3': [Buffer.from([0xFF, 0xFB]), Buffer.from([0xFF, 0xF3]), Buffer.from([0xFF, 0xF2]), Buffer.from([0x49, 0x44, 0x33])], // ID3
  '.flac': [Buffer.from([0x66, 0x4C, 0x61, 0x43])], // "fLaC"
  '.ogg': [Buffer.from([0x4F, 0x67, 0x67, 0x53])], // "OggS"
  '.wav': [Buffer.from([0x52, 0x49, 0x46, 0x46])], // "RIFF"
  '.m4a': [Buffer.from([0x00, 0x00, 0x00, 0x1C, 0x66, 0x74, 0x79, 0x70])], // ftyp
  '.mp4': [Buffer.from([0x00, 0x00, 0x00, 0x1C, 0x66, 0x74, 0x79, 0x70])],
  '.webm': [Buffer.from([0x1A, 0x45, 0xDF, 0xA3])],
  '.mov': [Buffer.from([0x00, 0x00, 0x00, 0x14, 0x66, 0x74, 0x79, 0x70])],
  '.aac': [Buffer.from([0xFF, 0xF1]), Buffer.from([0xFF, 0xF9])],
};

async function validateFileContent(filePath: string, extension: string): Promise<boolean> {
  const expectedMagic = magicBytes[extension];
  if (!expectedMagic) return true; // No magic bytes defined, skip validation

  try {
    const fileHandle = await fs.promises.open(filePath, 'r');
    const buffer = Buffer.alloc(16);
    const { bytesRead } = await fileHandle.read(buffer, 0, 16, 0);
    await fileHandle.close();

    if (bytesRead < 4) return false;

    const header = buffer.slice(0, bytesRead);
    return expectedMagic.some((magic) => {
      if (magic.length > bytesRead) return false;
      for (let i = 0; i < magic.length; i++) {
        if (header[i] !== magic[i]) return false;
      }
      return true;
    });
  } catch {
    return false;
  }
}

// File list cache (persisted to disk, survives restarts)
const metaCacheFile = path.join(dataDir, 'filecache.json');
let filesCache: { data: ApiFile[]; at: number; dirMtime: number } | null = null;

function invalidateFilesCache() {
  filesCache = null;
  try { fs.unlinkSync(metaCacheFile); } catch {}
}

// Try loading cache from disk on startup
function loadMetaCache() {
  try {
    if (fs.existsSync(metaCacheFile)) {
      const raw = fs.readFileSync(metaCacheFile, 'utf8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed?.data) && typeof parsed?.dirMtime === 'number') {
        filesCache = { data: parsed.data, at: Date.now(), dirMtime: parsed.dirMtime };
        console.log(`[cache] Loaded ${filesCache.data.length} files from disk cache`);
      }
    }
  } catch { filesCache = null; }
}

function saveMetaCache(data: ApiFile[], dirMtime: number) {
  try {
    fs.writeFileSync(metaCacheFile, JSON.stringify({ data, dirMtime }), 'utf8');
  } catch {}
}

// Call on startup
loadMetaCache();

async function listFiles(): Promise<ApiFile[]> {
  const now = Date.now();

  // Check if directory changed since cache was written
  let dirStat: fs.Stats | null = null;
  try { dirStat = fs.statSync(mediaDir); } catch {}
  const dirMtime = dirStat ? Math.floor(dirStat.mtimeMs) : 0;

  // Use cache if: (a) in-memory cache fresh, OR (b) disk cache matches dir mtime
  if (filesCache) {
    // In-memory still fresh (< 5 min)
    if ((now - filesCache.at) < 300_000) return filesCache.data;
    // Disk cache still matches directory (no files added/removed)
    if (dirMtime === filesCache.dirMtime && dirMtime > 0) {
      filesCache.at = now;
      return filesCache.data;
    }
  }

  // Re-scan filesystem
  const entries = await fs.promises.readdir(mediaDir, {withFileTypes: true});
  const results: ApiFile[] = [];

  const fileEntries = entries.filter((entry) => entry.isFile());
  const BATCH = 10;
  for (let i = 0; i < fileEntries.length; i += BATCH) {
    const batch = fileEntries.slice(i, i + BATCH);
    const batchResults = await Promise.all(batch.map(async (entry) => {
      const extension = path.extname(entry.name).toLowerCase();
      const metadata = supportedExtensions.get(extension);
      if (!metadata) return null;

      const absolutePath = path.join(mediaDir, entry.name);
      const stats = await fs.promises.stat(absolutePath);
      const id = crypto.createHash('sha256').update(entry.name).digest('hex').slice(0, 16);

      const parsed = await readMetadata(absolutePath);
      const title = parsed?.common.title?.trim() || path.parse(entry.name).name.replace(/[_-]+/g, ' ');
      const duration = parsed?.format.duration;

      return {
        id,
        name: entry.name,
        title,
        artist: parsed?.common.artist,
        album: parsed?.common.album,
        kind: metadata.kind,
        mimeType: metadata.mimeType,
        size: stats.size,
        sizeLabel: formatBytes(stats.size),
        duration,
        durationLabel: formatDuration(duration),
        hasArtwork: Boolean(parsed?.common.picture?.length),
        modifiedAt: stats.mtime.toISOString(),
      };
    }));
    results.push(...batchResults.filter((r): r is NonNullable<typeof r> => Boolean(r)));
  }

  results.sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt));
  filesCache = { data: results, at: now, dirMtime };
  saveMetaCache(results, dirMtime);
  return results;
}

async function findFile(id: string) {
  const files = await listFiles();
  const file = files.find((entry) => entry.id === id);
  if (!file) return null;
  // Use path.join directly — file.name comes from trusted readdir, no sanitization needed
  return {...file, absolutePath: path.join(mediaDir, file.name)};
}

// MED-8: Audit logging
function auditLog(action: string, details: Record<string, string>) {
  const timestamp = new Date().toISOString();
  console.log(`[AUDIT] ${timestamp} ${action} ${JSON.stringify(details)}`);
}

// --- ROUTES ---

app.get('/api/status', requireShareToken, (_request, response) => {
  response.json({
    roomName,
    host: publicHost(),
    maxPeers,
    livePeers: eventClients.size,
  });
});

app.get('/api/files', requireShareToken, generalLimiter, async (_request, response, next) => {
  try {
    response.json({files: await listFiles()});
  } catch (error) {
    next(error);
  }
});

app.get('/api/state', requireShareToken, generalLimiter, async (_request, response, next) => {
  try {
    response.json(await roomState());
  } catch (error) {
    next(error);
  }
});

// HIGH-7: Fix SSE auth - accept token as query parameter
app.get('/api/events', async (request, response, next) => {
  try {
    // Accept token from header OR query parameter
    const headerToken = request.header('x-share-token');
    const queryToken = typeof request.query.token === 'string' ? request.query.token : '';
    const candidate = headerToken || queryToken;

    // Accept static SHARE_TOKEN
    const expected = Buffer.from(shareToken);
    const actual = Buffer.from(candidate);
    const staticOk = actual.length === expected.length && crypto.timingSafeEqual(actual, expected);

    // Also accept JWT session token
    const session = !staticOk ? verifySessionToken(candidate) : null;

    if (!staticOk && !(session && users.find((u) => u.id === session.userId))) {
      response.status(401).json({error: 'unauthorized'});
      return;
    }

    response.writeHead(200, {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
      'x-accel-buffering': 'no',
    });
    response.write(`event: state\n`);
    response.write(`data: ${JSON.stringify(await roomState())}\n\n`);
    eventClients.add(response);

    const keepAlive = setInterval(() => {
      response.write(`event: ping\n`);
      response.write(`data: ${Date.now()}\n\n`);
    }, 25000);

    request.on('close', () => {
      clearInterval(keepAlive);
      eventClients.delete(response);
    });
  } catch (error) {
    next(error);
  }
});

app.post('/api/likes/:id', requireShareToken, generalLimiter, async (request, response, next) => {
  try {
    const file = await findFile(request.params.id);
    if (!file) {
      response.status(404).json({error: 'not found'});
      return;
    }

    const liked = Boolean(request.body?.liked);
    const state = await readState();
    const likedIds = new Set(state.likedIds);

    if (liked) {
      likedIds.add(file.id);
    } else {
      likedIds.delete(file.id);
    }

    await writeState({...state, likedIds: Array.from(likedIds)});
    response.json(await roomState());
  } catch (error) {
    next(error);
  }
});

app.post('/api/queue', requireShareToken, generalLimiter, async (request, response, next) => {
  try {
    const fileId = typeof request.body?.fileId === 'string' ? request.body.fileId : '';
    const file = await findFile(fileId);
    if (!file) {
      response.status(404).json({error: 'not found'});
      return;
    }

    const state = await readState();
    state.queue.push({
      id: crypto.randomUUID(),
      fileId: file.id,
      addedAt: new Date().toISOString(),
    });

    await writeState(state);
    response.status(201).json(await roomState());
  } catch (error) {
    next(error);
  }
});

app.delete('/api/queue/:id', requireShareToken, generalLimiter, async (request, response, next) => {
  try {
    const state = await readState();
    await writeState({
      ...state,
      queue: state.queue.filter((item) => item.id !== request.params.id),
    });
    response.json(await roomState());
  } catch (error) {
    next(error);
  }
});

app.post('/api/queue/clear', requireShareToken, generalLimiter, async (_request, response, next) => {
  try {
    const state = await readState();
    await writeState({...state, queue: []});
    response.json(await roomState());
  } catch (error) {
    next(error);
  }
});

// CRIT-1/4: JWT tokens + rate limiting + input validation
app.post('/api/auth/login', authLimiter, async (request, response) => {
  const { username, password } = request.body;

  // MED-5: Input validation
  if (typeof username !== 'string' || typeof password !== 'string') {
    response.status(400).json({ error: 'username and password required' });
    return;
  }
  if (username.length < 1 || username.length > 64) {
    response.status(400).json({ error: 'invalid username length' });
    return;
  }
  if (password.length < 1) {
    response.status(400).json({ error: 'password required' });
    return;
  }

  const user = users.find((u) => u.username === username);
  if (!user) {
    auditLog('LOGIN_FAILED', { username, reason: 'user_not_found' });
    response.status(401).json({ error: 'invalid credentials' });
    return;
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    auditLog('LOGIN_FAILED', { username, reason: 'wrong_password' });
    response.status(401).json({ error: 'invalid credentials' });
    return;
  }

  user.lastLogin = new Date().toISOString();
  saveUsers();

  // CRIT-1: Return JWT token, never password
  const token = generateSessionToken(user);
  auditLog('LOGIN_SUCCESS', { username, userId: user.id });

  response.json({
    token,
    user: { id: user.id, username: user.username, role: user.role },
  });
});

// CRIT-1/4/6: JWT tokens + rate limiting + input validation + longer invite codes
app.post('/api/auth/register', authLimiter, async (request, response) => {
  const { username, password, inviteCode } = request.body;

  // MED-5: Input validation
  if (typeof username !== 'string' || typeof password !== 'string' || typeof inviteCode !== 'string') {
    response.status(400).json({ error: 'username, password and invite code required' });
    return;
  }
  if (username.length < 3 || username.length > 32) {
    response.status(400).json({ error: 'username must be 3-32 characters' });
    return;
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
    response.status(400).json({ error: 'username contains invalid characters' });
    return;
  }
  if (password.length < 8) {
    response.status(400).json({ error: 'password must be at least 8 characters' });
    return;
  }
  if (password.length > 128) {
    response.status(400).json({ error: 'password too long' });
    return;
  }

  const invite = invites.find((i) => i.code === inviteCode.toUpperCase() && i.usedCount < i.maxUses);
  if (!invite) {
    auditLog('REGISTER_FAILED', { username, reason: 'invalid_invite' });
    response.status(400).json({ error: 'invalid or expired invite code' });
    return;
  }

  // MED-6: Check invite expiration
  if (invite.expiresAt && new Date(invite.expiresAt) < new Date()) {
    auditLog('REGISTER_FAILED', { username, reason: 'expired_invite' });
    response.status(400).json({ error: 'invite code expired' });
    return;
  }

  if (users.find((u) => u.username === username)) {
    response.status(400).json({ error: 'username already taken' });
    return;
  }

  // CRIT-2: Use bcrypt
  const passwordHash = await hashPassword(password);

  const newUser: User = {
    id: crypto.randomUUID(), // HIGH-5: Use UUID
    username,
    passwordHash,
    role: invite.role,
    createdAt: new Date().toISOString(),
    lastLogin: new Date().toISOString(),
  };

  users.push(newUser);
  invite.usedCount += 1;
  invite.usedBy.push(username);
  saveUsers();
  saveInvites();

  // CRIT-1: Return JWT token
  const token = generateSessionToken(newUser);
  auditLog('REGISTER_SUCCESS', { username, userId: newUser.id });

  response.json({
    token,
    user: { id: newUser.id, username: newUser.username, role: newUser.role },
  });
});

app.get('/api/auth/me', requireUserAuth, (request, response) => {
  const user = request.user;
  if (!user) { response.status(401).json({ error: 'auth required' }); return; }
  response.json({ id: user.id, username: user.username, role: user.role });
});

app.post('/api/auth/logout', requireUserAuth, (request, response) => {
  // JWT tokens are stateless - client should delete token
  // For future: implement token blacklist in memory/Redis
  auditLog('LOGOUT', { userId: request.user?.id || 'unknown' });
  response.json({ ok: true });
});

// CRIT-4: Rate limit admin endpoints
app.post('/api/auth/invite', requireAdmin, uploadLimiter, (request, response) => {
  const { role = 'member', maxUses = 1, expiresInHours = 168 } = request.body; // MED-6: Default 7 day expiry
  const user = request.user;
  if (!user) { response.status(401).json({ error: 'auth required' }); return; }

  const newInvite: Invite = {
    id: crypto.randomUUID(), // HIGH-5: Use UUID
    code: generateInviteCode(), // HIGH-4: 16-char code
    role,
    maxUses,
    usedCount: 0,
    usedBy: [],
    expiresAt: new Date(Date.now() + expiresInHours * 3600000).toISOString(), // MED-6: Always set expiry
    createdAt: new Date().toISOString(),
    createdBy: user.username,
  };
  invites.push(newInvite);
  saveInvites();
  auditLog('INVITE_CREATED', { code: newInvite.code, role, createdBy: user.username });
  response.json(newInvite);
});

app.get('/api/auth/invites', requireAdmin, (_request, response) => {
  response.json(invites);
});

app.get('/api/auth/users', requireAdmin, (_request, response) => {
  response.json(users.map((u) => ({ id: u.id, username: u.username, role: u.role, createdAt: u.createdAt, lastLogin: u.lastLogin })));
});

app.delete('/api/auth/invite/:id', requireAdmin, (request, response) => {
  const id = request.params.id;
  const index = invites.findIndex((i) => i.id === id);
  if (index === -1) {
    response.status(404).json({ error: 'invite not found' });
    return;
  }
  invites.splice(index, 1);
  saveInvites();
  auditLog('INVITE_DELETED', { id, deletedBy: request.user?.username || 'unknown' });
  response.json({ ok: true });
});

app.post('/api/auth/admin-secret', authLimiter, async (request, response) => {
  const { secret } = request.body;
  if (typeof secret !== 'string') {
    response.status(400).json({ error: 'secret required' });
    return;
  }
  if (secret !== adminSecret) {
    auditLog('ADMIN_SECRET_FAILED', { ip: request.ip || 'unknown' });
    response.status(403).json({ error: 'invalid secret' });
    return;
  }
  if (users.length === 0) {
    const adminUser: User = {
      id: crypto.randomUUID(),
      username: 'admin',
      passwordHash: await hashPassword('admin'),
      role: 'admin',
      createdAt: new Date().toISOString(),
      lastLogin: new Date().toISOString(),
    };
    users.push(adminUser);
    saveUsers();
    auditLog('ADMIN_INITIALIZED', {});
  }
  response.json({ ok: true, message: 'admin initialized' });
});

// VULN-LOW-2: Remove app name from health endpoint
app.get('/api/health', (_request, response) => {
  response.json({ok: true});
});

app.get('/api/art/:id', requireShareToken, generalLimiter, async (request, response, next) => {
  try {
    const file = await findFile(request.params.id);
    if (!file) {
      response.status(404).end();
      return;
    }

    const parsed = await readMetadata(file.absolutePath);
    const picture = parsed?.common.picture?.[0];

    if (picture) {
      response.type(picture.format);
      response.setHeader('cache-control', 'private, max-age=86400');
      response.send(Buffer.from(picture.data));
      return;
    }

    const hash = crypto.createHash('sha256').update(file.name).digest('hex');
    const hueA = Number.parseInt(hash.slice(0, 2), 16);
    const hueB = Number.parseInt(hash.slice(2, 4), 16);
    const hueC = Number.parseInt(hash.slice(4, 6), 16);
    const initials = escapeXml(file.title
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('') || 'JT');

    response.type('image/svg+xml');
    response.setHeader('cache-control', 'private, max-age=86400');
    response.send(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="hsl(${hueA}, 78%, 62%)"/>
      <stop offset="0.55" stop-color="hsl(${hueB}, 72%, 56%)"/>
      <stop offset="1" stop-color="hsl(${hueC}, 84%, 68%)"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="64" fill="#0d1b2a"/>
  <rect x="24" y="24" width="464" height="464" rx="52" fill="url(#g)"/>
  <circle cx="394" cy="118" r="82" fill="rgba(0,212,255,0.28)"/>
  <circle cx="124" cy="392" r="112" fill="rgba(0,212,255,0.18)"/>
  <text x="52" y="292" fill="#0d1b2a" font-family="Arial, sans-serif" font-size="132" font-weight="900">${initials}</text>
  <text x="58" y="350" fill="rgba(16,20,18,0.72)" font-family="Arial, sans-serif" font-size="38" font-weight="700">StreamSync</text>
</svg>`);
  } catch (error) {
    next(error);
  }
});

// Alias: /api/cover/:id → same as /api/art/:id (client uses this path)
app.get('/api/cover/:id', requireShareToken, generalLimiter, async (request, response, next) => {
  try {
    const file = await findFile(request.params.id);
    if (!file) { response.status(404).end(); return; }

    const parsed = await readMetadata(file.absolutePath);
    const picture = parsed?.common.picture?.[0];

    if (picture) {
      response.type(picture.format);
      response.setHeader('cache-control', 'private, max-age=86400');
      response.send(Buffer.from(picture.data));
      return;
    }

    // No embedded art → generate fallback SVG
    const hash = crypto.createHash('sha256').update(file.name).digest('hex');
    const hueA = Number.parseInt(hash.slice(0, 2), 16);
    const hueB = Number.parseInt(hash.slice(2, 4), 16);
    const hueC = Number.parseInt(hash.slice(4, 6), 16);
    const initials = escapeXml(file.title.split(' ').filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'JT');

    response.type('image/svg+xml');
    response.setHeader('cache-control', 'private, max-age=86400');
    response.send(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${hueA},78%,62%)"/><stop offset="0.55" stop-color="hsl(${hueB},72%,56%)"/><stop offset="1" stop-color="hsl(${hueC},84%,68%)"/></linearGradient></defs><rect width="512" height="512" rx="64" fill="#0d1b2a"/><rect x="24" y="24" width="464" height="464" rx="52" fill="url(#g)"/><circle cx="394" cy="118" r="82" fill="rgba(0,212,255,0.28)"/><circle cx="124" cy="392" r="112" fill="rgba(0,212,255,0.18)"/><text x="52" y="292" fill="#0d1b2a" font-family="Arial,sans-serif" font-size="132" font-weight="900">${initials}</text><text x="58" y="350" fill="rgba(16,20,18,0.72)" font-family="Arial,sans-serif" font-size="38" font-weight="700">StreamSync</text></svg>`);
  } catch (error) {
    next(error);
  }
});

// iTunes Album Cover Fetcher (cached)
const albumArtDir = path.join(dataDir, 'artwork');
fs.mkdirSync(albumArtDir, { recursive: true });

app.get('/api/album-cover', requireShareToken, generalLimiter, async (request, response, next) => {
  try {
    const artist = typeof request.query.artist === 'string' ? request.query.artist.trim() : '';
    const album = typeof request.query.album === 'string' ? request.query.album.trim() : '';

    if (!artist || !album) {
      response.status(400).json({ error: 'artist and album required' });
      return;
    }

    const cacheKey = crypto.createHash('sha256').update(`${artist}|${album}`).digest('hex');
    const cachePath = path.join(albumArtDir, `${cacheKey}.jpg`);

    // Return cached if exists
    if (fs.existsSync(cachePath)) {
      response.type('image/jpeg');
      response.setHeader('cache-control', 'public, max-age=604800, immutable');
      response.sendFile(cachePath);
      return;
    }

    // Search iTunes API
    const searchTerm = encodeURIComponent(`${artist} ${album}`);
    const itunesUrl = `https://itunes.apple.com/search?term=${searchTerm}&entity=album&limit=1`;

    const itunesRes = await fetch(itunesUrl, {
      headers: { 'User-Agent': 'JT-MP3/1.0' },
      signal: AbortSignal.timeout(8000),
    });

    if (!itunesRes.ok) {
      response.status(502).json({ error: 'upstream error' });
      return;
    }

    const data = await itunesRes.json() as { resultCount: number; results: Array<{ artworkUrl100?: string }> };

    if (data.resultCount === 0 || !data.results[0]?.artworkUrl100) {
      response.status(404).json({ error: 'not found' });
      return;
    }

    // Upgrade 100x100 to 600x600
    const artUrl = data.results[0].artworkUrl100.replace(/100x100/, '600x600');

    const imageRes = await fetch(artUrl, {
      headers: { 'User-Agent': 'JT-MP3/1.0' },
      signal: AbortSignal.timeout(10000),
    });

    if (!imageRes.ok) {
      response.status(502).json({ error: 'image fetch failed' });
      return;
    }

    const buffer = Buffer.from(await imageRes.arrayBuffer());
    await fs.promises.writeFile(cachePath, buffer);

    response.type('image/jpeg');
    response.setHeader('cache-control', 'public, max-age=604800, immutable');
    response.send(buffer);
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      response.status(504).json({ error: 'upstream timeout' });
      return;
    }
    next(error);
  }
});

// HIGH-1/2/3: File upload with magic bytes validation + path traversal fix + size limit
app.post('/api/upload', requireShareToken, uploadLimiter, async (request, response, next) => {
  try {
    const originalName = typeof request.query.name === 'string' ? request.query.name : '';
    const extension = path.extname(originalName).toLowerCase();

    if (!supportedExtensions.has(extension)) {
      response.status(415).json({error: 'unsupported media type'});
      return;
    }

    const target = resolveMediaPath(originalName);
    const tempTarget = `${target}.tmp-${crypto.randomUUID()}`;
    const writeStream = fs.createWriteStream(tempTarget, {flags: 'wx'});

    let bytesReceived = 0;
    let aborted = false;

    request.on('data', (chunk) => {
      bytesReceived += chunk.length;
      if (bytesReceived > maxUploadBytes && !aborted) {
        aborted = true;
        writeStream.destroy();
        request.destroy();
        if (!response.headersSent) {
          response.status(413).json({error: 'file too large'});
        }
      }
    });

    request.pipe(writeStream);
    request.on('error', next);
    writeStream.on('error', (error: NodeJS.ErrnoException) => {
      if (error.code === 'EEXIST') {
        response.status(409).json({error: 'file already exists'});
        return;
      }
      next(error);
    });

    writeStream.on('finish', async () => {
      try {
        if (aborted || bytesReceived > maxUploadBytes) {
          await fs.promises.unlink(tempTarget).catch(() => {});
          return;
        }

        // HIGH-1: Validate file content matches extension
        const isValid = await validateFileContent(tempTarget, extension);
        if (!isValid) {
          await fs.promises.unlink(tempTarget).catch(() => {});
          auditLog('UPLOAD_REJECTED', { name: originalName, reason: 'invalid_content' });
          response.status(415).json({error: 'file content does not match extension'});
          return;
        }

        await fs.promises.rename(tempTarget, target);
        invalidateFilesCache();
        auditLog('UPLOAD_SUCCESS', { name: originalName, size: String(bytesReceived) });
        response.status(201).json({ok: true});
      } catch (err) {
        await fs.promises.unlink(tempTarget).catch(() => {});
        next(err);
      }
    });
  } catch (error) {
    next(error);
  }
});

// YouTube Download
const activeDownloads = new Map<string, { process: any; status: string; title: string; progress: number }>();

app.post('/api/download', requireShareToken, uploadLimiter, async (request, response) => {
  try {
    const { url } = request.body;
    if (!url || typeof url !== 'string') {
      response.status(400).json({ error: 'Keine URL angegeben' }); return;
    }

    const normalizedUrl = url.trim();
    const isYT = normalizedUrl.includes('youtube.com') || normalizedUrl.includes('youtu.be');
    const isMusic = normalizedUrl.includes('music.youtube.com');
    if (!isYT) {
      response.status(400).json({ error: 'Keine gueltige YouTube-URL. Bitte einen YouTube- oder YouTube-Music-Link einfuegen.' }); return;
    }

    // Detect playlist/album/artist URL
    const isPlaylist = normalizedUrl.includes('list=') || normalizedUrl.includes('/playlist');
    const isChannel = normalizedUrl.includes('/channel/') || normalizedUrl.includes('/@');

    const downloadId = crypto.randomUUID();
    activeDownloads.set(downloadId, {
      process: null,
      status: 'starting',
      title: isPlaylist ? 'Album/Playlist-Download...' : isChannel ? 'Channel-Download...' : 'Download laeuft...',
      progress: 0,
      error: ''
    });
    response.status(202).json({
      id: downloadId,
      status: 'starting',
      title: isPlaylist ? 'Album-Download gestartet' : isChannel ? 'Channel-Download gestartet' : 'Download gestartet',
      progress: 0
    });

    // Copy cookies to writable temp location (mounted file is read-only)
    const cookiesFile = '/tmp/yt_cookies_' + downloadId + '.txt';
    try { await fs.promises.copyFile('/tmp/youtube_cookies_src.txt', cookiesFile); } catch {}

    const args = [
      '-x', '--audio-format', 'mp3', '--audio-quality', '0',
      '--embed-metadata', '--embed-thumbnail',
      '--remote-components', 'ejs:github',
      '--cookies', cookiesFile,
      '--extractor-args', 'youtube:player_client=android,ios',
      '--download-archive', '/data/state/yt_archive.txt',
      '--no-playlist'
    ];

    if (isPlaylist || isChannel) {
      // Remove --no-playlist for album/playlist/channel downloads
      args.pop();
      args.push('--yes-playlist');
      if (!isChannel) args.push('--playlist-items', '1-50'); // Max 50 tracks per album
    }

    args.push('-o', mediaDir + '/%(title)s.%(ext)s', normalizedUrl);

    const proc = spawn('yt-dlp', args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, HOME: '/tmp' }
    });

    activeDownloads.get(downloadId)!.process = proc;
    let lastTitle = 'Download laeuft...';
    let errorText = '';
    let skippedCount = 0;
    let downloadedCount = 0;
    let totalTracks = 0;

    proc.stdout.on('data', (data: Buffer) => {
      const text = data.toString();
      const dl = activeDownloads.get(downloadId);
      if (!dl) return;

      // Capture total playlist size
      const totalMatch = text.match(/Downloading playlist: .+ \((\d+) videos?\)/);
      if (totalMatch) totalTracks = parseInt(totalMatch[1], 10);

      // Track completed files
      const doneMatch = text.match(/\[download\]\s+Destination:\s+.+\/(.+?)\.(?:webm|m4a|mp4|opus)/);
      if (doneMatch) {
        lastTitle = doneMatch[1];
        downloadedCount++;
      }

      // Skip detection
      if (text.includes('has already been recorded in archive')) {
        skippedCount++;
        dl.title = `${skippedCount} uebersprungen, ${downloadedCount} neu`;
      }

      // Track download completion (ExtractAudio means file is done)
      const extractMatch = text.match(/\[ExtractAudio\] Destination: .+\/(.+?)\.mp3/);
      if (extractMatch) {
        lastTitle = extractMatch[1];
      }

      // Calculate overall progress
      const perFileMatch = text.match(/([0-9.]+)%/);
      if (perFileMatch && totalTracks > 0) {
        // Combine: already-completed tracks + current track progress
        const fileProgress = Math.min(99, parseFloat(perFileMatch[1]));
        const base = (downloadedCount / Math.max(totalTracks, 1)) * 100;
        const current = (1 / Math.max(totalTracks, 1)) * fileProgress;
        dl.progress = Math.round(Math.min(99, base + current));
      } else if (perFileMatch) {
        // Single file download
        dl.progress = Math.min(99, parseFloat(perFileMatch[1]));
      }

      if (totalTracks > 0) {
        dl.title = `${lastTitle} (${downloadedCount + skippedCount}/${totalTracks})`;
      } else if (doneMatch) {
        dl.title = lastTitle;
      }

      dl.status = 'downloading';
    });

    proc.stderr.on('data', (data: Buffer) => {
      errorText += data.toString();
    });

    proc.on('close', (code) => {
      const dl = activeDownloads.get(downloadId);
      if (!dl) return;
      if (code === 0) {
        dl.status = 'done';
        dl.progress = 100;
        if (skippedCount > 0 && downloadedCount === 0) {
          dl.title = `Alle ${skippedCount} Titel bereits vorhanden`;
        } else if (skippedCount > 0) {
          dl.title = lastTitle + ` (${downloadedCount} neu, ${skippedCount} uebersprungen)`;
        } else {
          dl.title = lastTitle;
        }
        invalidateFilesCache();
      } else {
        dl.status = 'error';
        dl.progress = 0;
        // Extract meaningful error
        if (errorText.includes('Video unavailable')) dl.error = 'Video nicht verfuegbar (privat oder geloescht)';
        else if (errorText.includes('Private video')) dl.error = 'Video ist privat und kann nicht heruntergeladen werden';
        else if (errorText.includes('copyright')) dl.error = 'Urheberrechtlich geschuetzt — Download nicht moeglich';
        else if (errorText.includes('age restricted') || errorText.includes('age_limit')) dl.error = 'Altersbeschraenkt — mit Login erneut versuchen';
        else if (errorText.includes('HTTP Error 403')) dl.error = 'Zugriff verweigert (403). Video gesperrt.';
        else if (errorText.includes('HTTP Error 404') || errorText.includes('not found')) dl.error = 'Video/Playlist nicht gefunden (404)';
        else if (errorText.includes('This video is not available')) dl.error = 'Video in deinem Land nicht verfuegbar';
        else if (errorText.includes('Sign in') || errorText.includes('login required')) dl.error = 'Cookies abgelaufen — bitte neue YouTube-Cookies bereitstellen';
        else if (errorText.includes('Incomplete data') || errorText.includes('No video formats')) dl.error = 'Kein Audio-Format gefunden — Video eventuell geloescht';
        else dl.error = 'Download fehlgeschlagen. URL pruefen oder spaeter erneut versuchen.';
      }
      setTimeout(() => activeDownloads.delete(downloadId), 60000);
    });

    proc.on('error', (err) => {
      const dl = activeDownloads.get(downloadId);
      if (dl) { dl.status = 'error'; dl.progress = 0; dl.error = 'yt-dlp nicht verfuegbar. Bitte Admin informieren.'; }
    });
  } catch (err) { response.status(500).json({ error: 'Server-Fehler beim Download' }); }
});

// Delete a file from the media library
app.delete('/api/files/:id', requireShareToken, generalLimiter, async (request, response, next) => {
  try {
    const file = await findFile(request.params.id);
    if (!file) { response.status(404).json({ error: 'not found' }); return; }

    // Remove from disk
    await fs.promises.unlink(file.absolutePath).catch(() => {});

    // Remove from likedIds & queue in state
    const state = await readState();
    const nextState = {
      likedIds: state.likedIds.filter((id) => id !== request.params.id),
      queue: state.queue.filter((item) => item.fileId !== request.params.id),
      playlists: [],
      updatedAt: new Date().toISOString(),
    };
    await writeState(nextState);
    invalidateFilesCache();

    response.json({ ok: true, state: await roomState() });
  } catch (error) {
    next(error);
  }
});

app.get('/api/download/:id', requireShareToken, (request, response) => {
  const dl = activeDownloads.get(request.params.id);
  if (!dl) response.json({ status: 'done', title: 'Fertig', progress: 100 });
  else response.json({ id: request.params.id, status: dl.status, title: dl.title, progress: Math.round(dl.progress), error: (dl as any).error || '' });
});

// AI Music Generation via ACE Music API
const ACE_API_KEY = process.env.ACE_MUSIC_API_KEY ?? '';
const ACE_API_URL = 'https://api.acemusic.ai/v1/chat/completions';

app.post('/api/generate', requireShareToken, uploadLimiter, async (request, response, next) => {
  try {
    if (!ACE_API_KEY) { response.status(503).json({ error: 'AI generation not configured' }); return; }

    const { prompt, lyrics, duration, language, instrumental, bpm, key, seed, sampleMode, title } = request.body;

    if (!prompt && !lyrics && !sampleMode) { response.status(400).json({ error: 'prompt or lyrics required' }); return; }

    const audioConfig: any = { vocal_language: language ?? 'de', format: 'mp3' };
    if (duration) audioConfig.duration = parseInt(duration, 10);
    if (bpm) audioConfig.bpm = parseInt(bpm, 10);
    if (key) audioConfig.key_scale = key;
    if (seed) audioConfig.seed = parseInt(seed, 10);
    if (instrumental) audioConfig.instrumental = true;

    const payload: any = {
      model: 'ace-step-1.5',
      messages: [{ role: 'user', content: prompt || 'Generate music' }],
      extra_body: { task_type: 'text2music', audio_config: audioConfig },
    };
    if (lyrics) payload.messages[0].content = `${prompt}\n\nLyrics:\n${lyrics}`;
    if (sampleMode) payload.extra_body.task_type = 'sample';

    const aceRes = await fetch(ACE_API_URL, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${ACE_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(60000),
    });

    if (!aceRes.ok) { response.status(502).json({ error: 'AI API error' }); return; }

    const data = await aceRes.json() as any;
    const audios = data?.choices?.[0]?.message?.audio;
    if (!audios?.length) { response.status(500).json({ error: 'no audio generated' }); return; }

    const results: string[] = [];
    for (const a of audios) {
      const b64 = (a.audio_url?.url ?? '').split(',')[1];
      if (!b64) continue;
      const safeTitle = title
        ? title.replace(/[/\\\x00]/g, '_').replace(/^\.+/, '_').slice(0, 80)
        : `AI-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const filePath = path.join(mediaDir, `${safeTitle}.mp3`);
      await fs.promises.writeFile(filePath, Buffer.from(b64, 'base64'));
      // Write ID3 title tag if custom title was provided
      if (title) {
        exec(`ffmpeg -i "${filePath}" -c copy -metadata title="${title.replace(/"/g, '\\"')}" -y "${filePath}.tmp.mp3" && mv "${filePath}.tmp.mp3" "${filePath}"`, (err) => {
          if (err) console.error('Failed to write ID3 title tag:', err.message);
        });
      }
      results.push(safeTitle);
    }

    invalidateFilesCache();
    response.json({ ok: true, count: results.length, titles: results });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      response.status(504).json({ error: 'generation timeout' });
      return;
    }
    next(error);
  }
});

app.get('/api/stream/:id', requireShareToken, generalLimiter, async (request, response, next) => {
  try {
    const file = await findFile(request.params.id);
    if (!file) {
      response.status(404).json({error: 'not found'});
      return;
    }

    const stats = await fs.promises.stat(file.absolutePath);
    const range = request.headers.range;
    response.setHeader('accept-ranges', 'bytes');
    response.setHeader('content-type', file.mimeType);

    if (!range) {
      response.setHeader('content-length', stats.size);
      fs.createReadStream(file.absolutePath).pipe(response);
      return;
    }

    const match = /bytes=(\d*)-(\d*)/.exec(range);
    if (!match) {
      response.status(416).end();
      return;
    }

    const start = match[1] ? Number(match[1]) : 0;
    const end = match[2] ? Number(match[2]) : stats.size - 1;

    if (start >= stats.size || end >= stats.size || start > end) {
      response.status(416).setHeader('content-range', `bytes */${stats.size}`).end();
      return;
    }

    response.status(206);
    response.setHeader('content-range', `bytes ${start}-${end}/${stats.size}`);
    response.setHeader('content-length', end - start + 1);
    fs.createReadStream(file.absolutePath, {start, end}).pipe(response);
  } catch (error) {
    next(error);
  }
});

if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get('*', (_request, response) => response.sendFile(path.join(distDir, 'index.html')));
}

// MED-4: Sanitized error handling
app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[ERROR] ${message}`);
  if (!response.headersSent) {
    response.status(500).json({error: 'internal server error'});
  }
});

// VULN-LOW-1: Bind to localhost only (use reverse proxy for external access)
const bindHost = process.env.BIND_HOST ?? '127.0.0.1';
app.listen(port, bindHost, () => {
  console.log(`StreamSync server running on http://${bindHost}:${port}`);
  console.log(`Media folder: ${mediaDir}`);
  if (bindHost === '127.0.0.1') {
    console.log('Note: Server is bound to localhost. Use a reverse proxy (Caddy/Nginx) for external access.');
  }
});
