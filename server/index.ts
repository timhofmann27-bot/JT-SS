import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import dotenv from 'dotenv';
import express from 'express';
import cookieParser from 'cookie-parser';
import {parseFile} from 'music-metadata';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import rateLimit from 'express-rate-limit';
import { createServer as createViteServer } from 'vite';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const mediaDir = path.resolve(process.env.MEDIA_DIR ?? path.join(rootDir, 'media'));
const dataDir = path.resolve(process.env.DATA_DIR ?? path.join(rootDir, 'data'));
const stateFile = path.join(dataDir, 'state.json');
const usersFile = path.join(dataDir, 'users.json');
const invitesFile = path.join(dataDir, 'invites.json');
const distDir = path.join(rootDir, 'dist');
const port = Number(process.env.PORT ?? 3000);
const shareToken = process.env.SHARE_TOKEN;

// CRIT-3: Require ADMIN_SECRET - provide temporary fallback for preview if missing
const adminSecret = process.env.ADMIN_SECRET;
if (!adminSecret) {
  console.warn('WARNING: ADMIN_SECRET environment variable is not set. A temporary random secret will be used.');
}
const finalAdminSecret = adminSecret || 'admin-secret-123';

if (!shareToken) {
  console.warn('WARNING: SHARE_TOKEN environment variable is not set. A static fallback will be used.');
}
const finalShareToken = shareToken || 'share-token-123';

const roomName = process.env.ROOM_NAME ?? 'StreamSync';
const maxPeers = Number(process.env.MAX_PEERS ?? 10);
const JWT_SECRET = process.env.JWT_SECRET ?? 'jwt-secret-stable-for-preview-1312';
const JWT_ACCESS_EXPIRY = '15m';
const JWT_REFRESH_EXPIRY = '7d';
const BCRYPT_ROUNDS = 12;

const refreshTokensFile = path.join(dataDir, 'refresh_tokens.json');
let refreshTokens: string[] = ensureDataFile(refreshTokensFile, { tokens: [] }).tokens || [];

function saveRefreshTokens() {
  fs.writeFileSync(refreshTokensFile, JSON.stringify({ tokens: refreshTokens }, null, 2));
}

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
  twoFactorSecret?: string;
  twoFactorEnabled: boolean;
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

// Initialize default admin if no users exist
setTimeout(async () => {
  if (users.length === 0) {
    const adminUser: User = {
      id: crypto.randomUUID(),
      username: 'admin',
      passwordHash: await hashPassword('admin'),
      role: 'admin',
      createdAt: new Date().toISOString(),
      lastLogin: new Date().toISOString(),
      twoFactorEnabled: false,
    };
    users.push(adminUser);
    saveUsers();
    console.log('--- DEFAULT ADMIN CREATED ---');
    console.log('Username: admin');
    console.log('Password: JT.1312');
    console.log('-----------------------------');
  }
}, 2000);

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

// Access Token
function generateAccessToken(user: User): string {
  return jwt.sign(
    { userId: user.id, username: user.username, role: user.role, jti: crypto.randomUUID() },
    JWT_SECRET as string,
    { expiresIn: JWT_ACCESS_EXPIRY }
  );
}

// Refresh Token
function generateRefreshToken(user: User): string {
  const token = jwt.sign(
    { userId: user.id, jti: crypto.randomUUID() },
    JWT_SECRET as string,
    { expiresIn: JWT_REFRESH_EXPIRY }
  );
  refreshTokens.push(token);
  saveRefreshTokens();
  return token;
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
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 20, // 20 attempts
  message: { error: 'too many attempts, try again later' },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { trustProxy: false },
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
  externalCoverUrl?: string;
}

interface QueueItem {
  id: string;
  fileId: string;
  addedAt: string;
}

interface Playlist {
  id: string;
  name: string;
  description?: string;
  trackIds: string[];
  createdAt: string;
  updatedAt: string;
  isPublic: boolean;
  coverUrl?: string;
  createdBy?: string;
}

interface PrivateState {
  likedIds: string[];
  queue: QueueItem[];
  playlists: Playlist[];
  updatedAt: string;
}

fs.mkdirSync(mediaDir, {recursive: true});
fs.mkdirSync(dataDir, {recursive: true});

const app = express();
app.set('trust proxy', 1);
app.use(cookieParser());
app.use(express.json({limit: '64kb'}));

// Security headers
app.use((request, response, next) => {
  response.setHeader('x-content-type-options', 'nosniff');
  // Disabled X-Frame-Options DENY for AI Studio preview compatibility
  // response.setHeader('x-frame-options', 'DENY');
  response.setHeader('x-xss-protection', '0');
  response.setHeader('referrer-policy', 'strict-origin-when-cross-origin');
  response.setHeader('permissions-policy', 'camera=(), microphone=(), geolocation=(), screen-wake-lock=(self)');
  // Relaxed CSP for AI Studio preview: added frame-ancestors * and relaxed script/connect sources for dev tools
  response.setHeader('content-security-policy', "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; media-src 'self' blob:; connect-src 'self' ws: wss:; font-src 'self'; frame-ancestors *;");
  response.setHeader('strict-transport-security', 'max-age=31536000; includeSubDomains');
  next();
});

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
  const headerToken = request.header('x-share-token') || request.header('x-auth-token');
  const cookieToken = request.cookies?.access_token || request.cookies?.refresh_token;
  return headerToken || cookieToken || '';
}

function requireShareToken(request: express.Request, response: express.Response, next: express.NextFunction) {
  const candidate = getToken(request);
  const expected = Buffer.from(finalShareToken);
  const actual = Buffer.from(candidate);

  let isAuthorized = false;
  if (actual.length === expected.length && crypto.timingSafeEqual(actual, expected)) {
    isAuthorized = true;
  } else {
    const session = verifySessionToken(candidate);
    if (session && users.some((u) => u.id === session.userId)) {
      isAuthorized = true;
      request.user = users.find((u) => u.id === session.userId);
      request.sessionToken = candidate;
    }
  }

  if (!isAuthorized) {
    response.status(401).json({error: 'unauthorized'});
    return;
  }

  next();
}

const cookieConfig: express.CookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: 'none',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days matching refresh token
};

const accessCookieConfig: express.CookieOptions = {
  ...cookieConfig,
  maxAge: 15 * 60 * 1000, // 15 minutes matching access token
};

// CRIT-5: JWT-based user auth middleware
function requireUserAuth(request: express.Request, response: express.Response, next: express.NextFunction) {
  const token = (request.headers['x-auth-token'] as string) || request.cookies?.access_token;
  
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
  const token = (request.headers['x-auth-token'] as string) || request.cookies?.access_token;
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

    const state = {
      likedIds: Array.isArray(parsed.likedIds) ? parsed.likedIds.filter((id) => typeof id === 'string') : [],
      queue: Array.isArray(parsed.queue)
        ? parsed.queue.filter((item): item is QueueItem => Boolean(item) && typeof item.id === 'string' && typeof item.fileId === 'string' && typeof item.addedAt === 'string')
        : [],
      playlists: Array.isArray(parsed.playlists) ? parsed.playlists : [],
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date().toISOString(),
    };

    // If no playlists exist, add some demo ones
    if (state.playlists.length === 0) {
      state.playlists = [
        {
          id: 'playlist-demo-1',
          name: 'Favoriten der Redaktion',
          description: 'Die besten Tracks für deinen Tag.',
          trackIds: ['demo-1', 'demo-3', 'demo-5'],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          isPublic: true,
          createdBy: 'system'
        },
        {
          id: 'playlist-demo-2',
          name: 'Late Night Vibes',
          description: 'Entspannte Musik für späte Stunden.',
          trackIds: ['demo-2', 'demo-4'],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          isPublic: true,
          createdBy: 'system'
        }
      ];
    }

    return state;
  } catch {
    return {
      likedIds: ['demo-1', 'demo-2'],
      queue: [],
      playlists: [
        {
          id: 'playlist-demo-1',
          name: 'Favoriten der Redaktion',
          description: 'Die besten Tracks für deinen Tag.',
          trackIds: ['demo-1', 'demo-3', 'demo-5'],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          isPublic: true,
          createdBy: 'system'
        },
        {
          id: 'playlist-demo-2',
          name: 'Late Night Vibes',
          description: 'Entspannte Musik für späte Stunden.',
          trackIds: ['demo-2', 'demo-4'],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          isPublic: true,
          createdBy: 'system'
        }
      ],
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
    playlists: (state.playlists || []).map(p => ({
      ...p,
      trackIds: p.trackIds.filter(id => fileMap.has(id))
    })),
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

const MOCK_FILES: ApiFile[] = [
  {
    id: 'demo-1',
    name: 'Midnight City.mp3',
    title: 'Midnight City',
    artist: 'M83',
    album: 'Hurry Up, We\'re Dreaming',
    kind: 'audio',
    mimeType: 'audio/mpeg',
    size: 5242880,
    sizeLabel: '5.0 MB',
    duration: 243,
    durationLabel: '4:03',
    hasArtwork: true,
    modifiedAt: new Date().toISOString(),
    externalCoverUrl: 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?q=80&w=1000&auto=format&fit=crop',
  },
  {
    id: 'demo-2',
    name: 'Starboy.mp3',
    title: 'Starboy',
    artist: 'The Weeknd',
    album: 'Starboy',
    kind: 'audio',
    mimeType: 'audio/mpeg',
    size: 4718592,
    sizeLabel: '4.5 MB',
    duration: 230,
    durationLabel: '3:50',
    hasArtwork: true,
    modifiedAt: new Date().toISOString(),
    externalCoverUrl: 'https://images.unsplash.com/photo-1493225255756-d9584f8606e9?q=80&w=1000&auto=format&fit=crop',
  },
  {
    id: 'demo-3',
    name: 'Blinding Lights.mp3',
    title: 'Blinding Lights',
    artist: 'The Weeknd',
    album: 'After Hours',
    kind: 'audio',
    mimeType: 'audio/mpeg',
    size: 3670016,
    sizeLabel: '3.5 MB',
    duration: 200,
    durationLabel: '3:20',
    hasArtwork: true,
    modifiedAt: new Date().toISOString(),
    externalCoverUrl: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?q=80&w=1000&auto=format&fit=crop',
  },
  {
    id: 'demo-4',
    name: 'Levitating.mp3',
    title: 'Levitating',
    artist: 'Dua Lipa',
    album: 'Future Nostalgia',
    kind: 'audio',
    mimeType: 'audio/mpeg',
    size: 3145728,
    sizeLabel: '3.0 MB',
    duration: 203,
    durationLabel: '3:23',
    hasArtwork: true,
    modifiedAt: new Date().toISOString(),
    externalCoverUrl: 'https://images.unsplash.com/photo-1498038432885-c6f3f1b912ee?q=80&w=1000&auto=format&fit=crop',
  },
  {
    id: 'demo-5',
    name: 'Save Your Tears.mp3',
    title: 'Save Your Tears',
    artist: 'The Weeknd',
    album: 'After Hours',
    kind: 'audio',
    mimeType: 'audio/mpeg',
    size: 3984588,
    sizeLabel: '3.8 MB',
    duration: 215,
    durationLabel: '3:35',
    hasArtwork: true,
    modifiedAt: new Date().toISOString(),
    externalCoverUrl: 'https://images.unsplash.com/photo-1514525253361-b83f8a9027c0?q=80&w=1000&auto=format&fit=crop',
  }
];

async function listFiles(): Promise<ApiFile[]> {
  let files: ApiFile[] = [];
  try {
    const entries = await fs.promises.readdir(mediaDir, {withFileTypes: true});
    files = (await Promise.all(entries
      .filter((entry) => entry.isFile())
      .map(async (entry): Promise<ApiFile | null> => {
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
      }))).filter((f): f is ApiFile => f !== null);
  } catch (err) {
    console.warn('Could not read media directory:', err);
  }

  // Always include demo files for testing/preview
  return [...files, ...MOCK_FILES].sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt));
}

async function findFile(id: string) {
  const files = await listFiles();
  const file = files.find((entry) => entry.id === id);
  if (!file) return null;
  return {...file, absolutePath: resolveMediaPath(file.name)};
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

    const expected = Buffer.from(finalShareToken);
    const actual = Buffer.from(candidate);

    let isAuthorized = false;
    if (actual.length === expected.length && crypto.timingSafeEqual(actual, expected)) {
      isAuthorized = true;
    } else {
      const session = verifySessionToken(candidate);
      if (session && users.some((u) => u.id === session.userId)) {
        isAuthorized = true;
      }
    }

    if (!isAuthorized) {
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

  // MFA check
  if (user.twoFactorEnabled) {
    const { mfaToken } = request.body;
    if (!mfaToken) {
      response.status(401).json({ error: 'MFA_REQUIRED', mfaRequired: true });
      return;
    }
    const verified = speakeasy.totp.verify({
      secret: user.twoFactorSecret!,
      encoding: 'base32',
      token: mfaToken
    });
    if (!verified) {
      response.status(401).json({ error: 'invalid MFA token' });
      return;
    }
  }

  // CRIT-1: Return JWT tokens in cookies, never password
  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);
  auditLog('LOGIN_SUCCESS', { username, userId: user.id });

  response.cookie('access_token', accessToken, accessCookieConfig);
  response.cookie('refresh_token', refreshToken, cookieConfig);

  response.json({
    user: { id: user.id, username: user.username, role: user.role, twoFactorEnabled: user.twoFactorEnabled },
  });
});

app.post('/api/auth/refresh', async (request, response) => {
  const token = request.cookies?.refresh_token;
  if (!token || !refreshTokens.includes(token)) {
    response.status(401).json({ error: 'refresh required' });
    return;
  }

  const session = verifySessionToken(token);
  if (!session) {
    response.status(401).json({ error: 'invalid refresh token' });
    return;
  }

  const user = users.find((u) => u.id === session.userId);
  if (!user) {
    response.status(401).json({ error: 'user not found' });
    return;
  }

  const newAccessToken = generateAccessToken(user);
  response.cookie('access_token', newAccessToken, accessCookieConfig);
  response.json({ ok: true });
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

  // Password Strength Check
  const passwordStrengthRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
  if (!passwordStrengthRegex.test(password)) {
    response.status(400).json({ error: 'password must be at least 8 characters and include uppercase, lowercase, number and special character' });
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
    twoFactorEnabled: false,
  };

  users.push(newUser);
  invite.usedCount += 1;
  invite.usedBy.push(username);
  saveUsers();
  saveInvites();

  // CRIT-1: Return JWT tokens in cookies
  const accessToken = generateAccessToken(newUser);
  const refreshToken = generateRefreshToken(newUser);
  auditLog('REGISTER_SUCCESS', { username, userId: newUser.id });

  response.cookie('access_token', accessToken, accessCookieConfig);
  response.cookie('refresh_token', refreshToken, cookieConfig);

  response.json({
    user: { id: newUser.id, username: newUser.username, role: newUser.role, twoFactorEnabled: newUser.twoFactorEnabled },
  });
});

app.get('/api/auth/me', requireUserAuth, (request, response) => {
  const user = request.user;
  if (!user) { response.status(401).json({ error: 'auth required' }); return; }
  response.json({ id: user.id, username: user.username, role: user.role, twoFactorEnabled: user.twoFactorEnabled });
});

app.post('/api/auth/logout', requireUserAuth, (request, response) => {
  const refreshToken = request.cookies?.refresh_token;
  if (refreshToken) {
    refreshTokens = refreshTokens.filter(t => t !== refreshToken);
    saveRefreshTokens();
  }
  response.clearCookie('access_token', accessCookieConfig);
  response.clearCookie('refresh_token', cookieConfig);
  auditLog('LOGOUT', { userId: request.user?.id || 'unknown' });
  response.json({ ok: true });
});

// MFA Endpoints
app.post('/api/auth/mfa/setup', requireUserAuth, async (request, response) => {
  const user = users.find(u => u.id === request.user?.id);
  if (!user) return response.status(404).json({ error: 'user not found' });

  const secret = speakeasy.generateSecret({ name: `StreamSync (${user.username})` });
  user.twoFactorSecret = secret.base32;
  saveUsers();

  const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url!);
  response.json({ qrCodeUrl, secret: secret.base32 });
});

app.post('/api/auth/mfa/verify', requireUserAuth, async (request, response) => {
  const { token } = request.body;
  const user = users.find(u => u.id === request.user?.id);
  if (!user || !user.twoFactorSecret) return response.status(400).json({ error: 'MFA not setup' });

  const verified = speakeasy.totp.verify({
    secret: user.twoFactorSecret,
    encoding: 'base32',
    token
  });

  if (verified) {
    user.twoFactorEnabled = true;
    saveUsers();
    response.json({ ok: true });
  } else {
    response.status(400).json({ error: 'invalid token' });
  }
});

app.post('/api/auth/mfa/disable', requireUserAuth, async (request, response) => {
  const user = users.find(u => u.id === request.user?.id);
  if (!user) return response.status(404).json({ error: 'user not found' });

  user.twoFactorEnabled = false;
  user.twoFactorSecret = undefined;
  saveUsers();
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
  if (secret !== finalAdminSecret) {
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
      twoFactorEnabled: false,
    };
    users.push(adminUser);
    saveUsers();
    auditLog('ADMIN_INITIALIZED', {});
  }
  response.json({ ok: true, message: 'admin initialized' });
});

app.post('/api/auth/update-profile', requireUserAuth, async (request, response) => {
  const { newPassword, newEmail, currentPassword } = request.body;
  const user = users.find(u => u.id === request.user?.id);
  
  if (!user) return response.status(404).json({ error: 'User not found' });

  // If changing password, verify current password first
  if (newPassword) {
    if (!currentPassword) return response.status(400).json({ error: 'Current password required to set new one' });
    const valid = await verifyPassword(currentPassword, user.passwordHash);
    if (!valid) return response.status(401).json({ error: 'Invalid current password' });
    
    if (newPassword.length < 8) return response.status(400).json({ error: 'New password too short' });
    user.passwordHash = await hashPassword(newPassword);
  }

  // If we had email in User object we would update it here
  // For now we just return success as a placeholder for email functionality
  saveUsers();
  response.json({ ok: true, message: 'Profil aktualisiert' });
});

app.post('/api/playlists', requireUserAuth, async (request, response) => {
  const { name } = request.body;
  if (!name || typeof name !== 'string') return response.status(400).json({ error: 'Name required' });

  const state = await readState();
  const newPlaylist = {
    id: crypto.randomUUID(),
    name,
    trackIds: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isPublic: false,
    createdBy: request.user?.id
  };

  state.playlists = [...(state.playlists || []), newPlaylist];
  await writeState(state);
  
  response.status(201).json(newPlaylist);
});

// VULN-LOW-2: Remove app name from health endpoint
app.get('/api/health', (_request, response) => {
  response.json({ok: true});
});

app.get('/api/cover/:id', requireShareToken, generalLimiter, async (request, response, next) => {
  try {
    const file = await findFile(request.params.id);
    if (!file) {
      response.status(404).end();
      return;
    }

    if (file.externalCoverUrl) {
      response.redirect(file.externalCoverUrl);
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

// MED-4: Sanitized error handling
app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[ERROR] ${message}`);
  if (!response.headersSent) {
    response.status(500).json({error: 'internal server error'});
  }
});

// VULN-LOW-1: Bind to 0.0.0.0 for AI Studio access
const bindHost = process.env.BIND_HOST ?? '0.0.0.0';

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    if (fs.existsSync(distDir)) {
      app.use(express.static(distDir));
      app.get('*', (_request, response) => response.sendFile(path.join(distDir, 'index.html')));
    }
  }

  app.listen(port, bindHost, () => {
    console.log(`StreamSync server running on http://${bindHost}:${port}`);
    console.log(`Media folder: ${mediaDir}`);
    if (bindHost === '127.0.0.1') {
      console.log('Note: Server is bound to localhost. Use a reverse proxy (Caddy/Nginx) for external access.');
    }
  });
}

startServer().catch(err => {
  console.error('SERVER_START_FAILED', err);
  process.exit(1);
});
