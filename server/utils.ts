import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseFile } from 'music-metadata';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getDb } from './db.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
export const mediaDir = path.resolve(process.env.MEDIA_DIR ?? path.join(rootDir, 'media'));
export const dataDir = path.resolve(process.env.DATA_DIR ?? path.join(rootDir, 'data'));
export const distDir = path.join(rootDir, 'dist');
export const port = Number(process.env.PORT ?? 3001);
export const shareToken = process.env.SHARE_TOKEN as string;
export const adminSecret = process.env.ADMIN_SECRET as string;
export const roomName = process.env.ROOM_NAME ?? 'StreamSync';
export const maxPeers = Number(process.env.MAX_PEERS ?? 10);
export const JWT_SECRET = process.env.JWT_SECRET ?? crypto.randomBytes(64).toString('hex');
export const JWT_EXPIRY = process.env.JWT_EXPIRY ?? '24h';
export const BCRYPT_ROUNDS = 12;

// Types
export interface ApiFile {
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
  absolutePath?: string;
}

export interface User {
  id: string;
  username: string;
  passwordHash: string;
  role: 'admin' | 'member';
  createdAt: string;
  lastLogin: string;
}

export interface SessionToken {
  userId: string;
  jti: string;
  iat: number;
  exp: number;
}

export interface Invite {
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

export interface QueueItem {
  id: string;
  fileId: string;
  addedAt: string;
}

export interface PlayEntry {
  fileId: string;
  playedAt: string;
}

// Supported extensions
export const supportedExtensions = new Map<string, { kind: 'audio' | 'video'; mimeType: string }>([
  ['.mp3', { kind: 'audio', mimeType: 'audio/mpeg' }],
  ['.m4a', { kind: 'audio', mimeType: 'audio/mp4' }],
  ['.aac', { kind: 'audio', mimeType: 'audio/aac' }],
  ['.wav', { kind: 'audio', mimeType: 'audio/wav' }],
  ['.flac', { kind: 'audio', mimeType: 'audio/flac' }],
  ['.ogg', { kind: 'audio', mimeType: 'audio/ogg' }],
  ['.mp4', { kind: 'video', mimeType: 'video/mp4' }],
  ['.webm', { kind: 'video', mimeType: 'video/webm' }],
  ['.mov', { kind: 'video', mimeType: 'video/quicktime' }],
]);

// Parsing
export function parseSize(sizeStr: string): number {
  const match = sizeStr.match(/^(\d+)(KB|MB|GB)$/i);
  if (!match) return 100 * 1024 * 1024;
  const value = Number(match[1]);
  const unit = match[2].toUpperCase();
  const multipliers: Record<string, number> = { KB: 1024, MB: 1024 * 1024, GB: 1024 * 1024 * 1024 };
  return value * (multipliers[unit] || 1);
}

export const maxUploadBytes = parseSize(process.env.MAX_UPLOAD_SIZE ?? '100MB');

// Formatting
export function formatBytes(size: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = size;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

export function formatDuration(duration?: number): string | undefined {
  if (!duration || !Number.isFinite(duration)) return undefined;
  const minutes = Math.floor(duration / 60);
  const seconds = Math.floor(duration % 60).toString().padStart(2, '0');
  return `${minutes}:${seconds}`;
}

export function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Networking
export function publicHost(): string {
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

// Crypto / Auth
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateSessionToken(user: User): string {
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

export function verifySessionToken(token: string): SessionToken | null {
  try {
    return jwt.verify(token, JWT_SECRET) as SessionToken;
  } catch {
    return null;
  }
}

export function generateInviteCode(): string {
  return crypto.randomBytes(12).toString('base64url').replace(/[^a-zA-Z0-9]/g, '').slice(0, 16).toUpperCase();
}

// Audit logging
export function auditLog(action: string, details: Record<string, string>): void {
  const timestamp = new Date().toISOString();
  console.log(`[AUDIT] ${timestamp} ${action} ${JSON.stringify(details)}`);
}

// Path safety
export function safeFileName(value: string): string {
  const parsed = path.parse(value);
  const extension = parsed.ext.toLowerCase();
  const base = parsed.name.replace(/[^a-zA-Z0-9._ -]/g, '_').trim() || 'upload';
  if (!/^\.[a-zA-Z0-9]+$/.test(extension)) {
    throw new Error('invalid file extension');
  }
  return `${base}${extension}`;
}

export function resolveMediaPath(fileName: string): string {
  const safeName = safeFileName(fileName);
  const resolved = path.resolve(mediaDir, safeName);
  if (!resolved.startsWith(mediaDir + path.sep) && resolved !== mediaDir) {
    throw new Error('invalid media path');
  }
  return resolved;
}

// Magic bytes validation
const magicBytes: Record<string, Buffer[]> = {
  '.mp3': [Buffer.from([0xFF, 0xFB]), Buffer.from([0xFF, 0xF3]), Buffer.from([0xFF, 0xF2]), Buffer.from([0x49, 0x44, 0x33])],
  '.flac': [Buffer.from([0x66, 0x4C, 0x61, 0x43])],
  '.ogg': [Buffer.from([0x4F, 0x67, 0x67, 0x53])],
  '.wav': [Buffer.from([0x52, 0x49, 0x46, 0x46])],
  '.m4a': [Buffer.from([0x00, 0x00, 0x00, 0x1C, 0x66, 0x74, 0x79, 0x70])],
  '.mp4': [Buffer.from([0x00, 0x00, 0x00, 0x1C, 0x66, 0x74, 0x79, 0x70])],
  '.webm': [Buffer.from([0x1A, 0x45, 0xDF, 0xA3])],
  '.mov': [Buffer.from([0x00, 0x00, 0x00, 0x14, 0x66, 0x74, 0x79, 0x70])],
  '.aac': [Buffer.from([0xFF, 0xF1]), Buffer.from([0xFF, 0xF9])],
};

export async function validateFileContent(filePath: string, extension: string): Promise<boolean> {
  const expectedMagic = magicBytes[extension];
  if (!expectedMagic) return true;
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

// Metadata
export async function readMetadata(absolutePath: string) {
  try {
    return await parseFile(absolutePath, {
      duration: true,
      skipCovers: false,
    });
  } catch {
    return null;
  }
}

// File list cache
const metaCacheFile = path.join(dataDir, 'filecache.json');
let filesCache: { data: ApiFile[]; at: number; dirMtime: number } | null = null;
let rescanPending = false;

export function invalidateFilesCache(): void {
  filesCache = null;
  try { fs.unlinkSync(metaCacheFile); } catch {}
}

async function triggerBackgroundRescan(): Promise<void> {
  if (rescanPending) return;
  rescanPending = true;
  setTimeout(async () => {
    try { await listFiles(); } catch {}
    rescanPending = false;
  }, 100);
}

function loadMetaCache(): void {
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

function saveMetaCache(data: ApiFile[], dirMtime: number): void {
  try {
    fs.writeFileSync(metaCacheFile, JSON.stringify({ data, dirMtime }), 'utf8');
  } catch {}
}

// Initialize on load
loadMetaCache();

export async function listFiles(): Promise<ApiFile[]> {
  const now = Date.now();
  let dirStat: fs.Stats | null = null;
  try { dirStat = fs.statSync(mediaDir); } catch {}
  const dirMtime = dirStat ? Math.floor(dirStat.mtimeMs) : 0;

  if (filesCache) {
    if ((now - filesCache.at) < 600_000) return filesCache.data;
    if (dirMtime === filesCache.dirMtime && dirMtime > 0) {
      filesCache.at = now;
      return filesCache.data;
    }
    triggerBackgroundRescan();
    filesCache.at = now;
    return filesCache.data;
  }

  const entries = await fs.promises.readdir(mediaDir, { withFileTypes: true });
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

export async function findFile(id: string): Promise<(ApiFile & { absolutePath: string }) | null> {
  const files = await listFiles();
  const file = files.find((entry) => entry.id === id);
  if (!file) return null;
  return { ...file, absolutePath: path.join(mediaDir, file.name) };
}
