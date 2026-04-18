import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import dotenv from 'dotenv';
import express from 'express';
import {parseFile} from 'music-metadata';

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
const adminSecret = process.env.ADMIN_SECRET ?? 'admin123';
if (!shareToken) {
  console.error('FATAL: SHARE_TOKEN environment variable is not set.');
  process.exit(1);
}
const roomName = process.env.ROOM_NAME ?? 'StreamSync';
const MAX_UPLOAD_SIZE = Number(process.env.MAX_UPLOAD_SIZE ?? '100MB');

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

function hashPassword(password: string) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

function generateCode(length = 8) {
  return crypto.randomBytes(length).toString('hex').slice(0, length).toUpperCase();
}

function requireUserAuth(request: express.Request, response: express.Response, next: express.NextFunction) {
  const token = request.headers['x-auth-token'] as string;
  if (!token) {
    response.status(401).json({ error: 'auth required' });
    return;
  }
  const user = users.find((u) => u.passwordHash === hashPassword(token));
  if (!user) {
    response.status(401).json({ error: 'invalid token' });
    return;
  }
  request.headers['x-user'] = user;
  next();
}

function requireAdmin(request: express.Request, response: express.Response, next: express.NextFunction) {
  const token = request.headers['x-auth-token'] as string;
  if (!token) {
    response.status(401).json({ error: 'auth required' });
    return;
  }
  const user = users.find((u) => u.passwordHash === hashPassword(token));
  if (!user || user.role !== 'admin') {
    response.status(403).json({ error: 'admin required' });
    return;
  }
  request.headers['x-user'] = user;
  next();
}

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
app.use((request, response, next) => {
  response.setHeader('x-content-type-options', 'nosniff');
  response.setHeader('referrer-policy', 'no-referrer');
  response.setHeader('permissions-policy', 'camera=(), microphone=(), geolocation=()');
  next();
});
app.use(express.json({limit: '64kb'}));

const eventClients = new Set<express.Response>();

function getToken(request: express.Request) {
  const headerToken = request.header('x-share-token');
  return headerToken || '';
}

function requireShareToken(request: express.Request, response: express.Response, next: express.NextFunction) {
  const candidate = getToken(request);
  const expected = Buffer.from(shareToken);
  const actual = Buffer.from(candidate);

  if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) {
    response.status(401).json({error: 'unauthorized'});
    return;
  }

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
    console.error('State write error:', err);
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

function safeFileName(value: string) {
  const parsed = path.parse(value);
  const extension = parsed.ext.toLowerCase();
  const base = parsed.name.replace(/[^a-zA-Z0-9._ -]/g, '_').trim() || 'upload';
  return `${base}${extension}`;
}

function resolveMediaPath(fileName: string) {
  const safeName = safeFileName(fileName);
  const resolved = path.resolve(mediaDir, safeName);

  if (!resolved.startsWith(`${mediaDir}${path.sep}`)) {
    throw new Error('Invalid media path');
  }
  return resolved;
}

async function listFiles(): Promise<ApiFile[]> {
  const entries = await fs.promises.readdir(mediaDir, {withFileTypes: true});
  const files = await Promise.all(entries
    .filter((entry) => entry.isFile())
    .map(async (entry) => {
      const extension = path.extname(entry.name).toLowerCase();
      const metadata = supportedExtensions.get(extension);
      if (!metadata) return null;

      const absolutePath = path.join(mediaDir, entry.name);
      const stats = await fs.promises.stat(absolutePath);
      const id = Buffer.from(entry.name, 'utf8').toString('base64url');

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

  return files
    .filter((file): file is NonNullable<typeof file> => Boolean(file))
    .sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt));
}

async function findFile(id: string) {
  const files = await listFiles();
  const file = files.find((entry) => entry.id === id);
  if (!file) return null;
  return {...file, absolutePath: resolveMediaPath(file.name)};
}

app.get('/api/status', requireShareToken, (_request, response) => {
  response.json({
    roomName,
    host: publicHost(),
    maxPeers,
    livePeers: eventClients.size,
  });
});

app.get('/api/files', requireShareToken, async (_request, response, next) => {
  try {
    response.json({files: await listFiles()});
  } catch (error) {
    next(error);
  }
});

app.get('/api/state', requireShareToken, async (_request, response, next) => {
  try {
    response.json(await roomState());
  } catch (error) {
    next(error);
  }
});

app.get('/api/events', requireShareToken, async (request, response, next) => {
  try {
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

app.post('/api/likes/:id', requireShareToken, async (request, response, next) => {
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

app.post('/api/queue', requireShareToken, async (request, response, next) => {
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

app.delete('/api/queue/:id', requireShareToken, async (request, response, next) => {
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

app.post('/api/queue/clear', requireShareToken, async (_request, response, next) => {
  try {
    const state = await readState();
    await writeState({...state, queue: []});
    response.json(await roomState());
  } catch (error) {
    next(error);
  }
});

app.post('/api/auth/login', (request, response) => {
  const { username, password } = request.body;
  const passwordHash = hashPassword(password);
  const user = users.find((u) => u.username === username && u.passwordHash === passwordHash);
  if (!user) {
    response.status(401).json({ error: 'invalid credentials' });
    return;
  }
  user.lastLogin = new Date().toISOString();
  saveUsers();
  response.json({
    token: password,
    user: { id: user.id, username: user.username, role: user.role },
  });
});

app.post('/api/auth/register', (request, response) => {
  const { username, password, inviteCode } = request.body;
  if (!username || !password || !inviteCode) {
    response.status(400).json({ error: 'username, password and invite code required' });
    return;
  }
  const invite = invites.find((i) => i.code === inviteCode.toUpperCase() && i.usedCount < i.maxUses);
  if (!invite) {
    response.status(400).json({ error: 'invalid or expired invite code' });
    return;
  }
  if (users.find((u) => u.username === username)) {
    response.status(400).json({ error: 'username already taken' });
    return;
  }
  const newUser: User = {
    id: generateCode(4),
    username,
    passwordHash: hashPassword(password),
    role: invite.role,
    createdAt: new Date().toISOString(),
    lastLogin: new Date().toISOString(),
  };
  users.push(newUser);
  invite.usedCount += 1;
  invite.usedBy.push(username);
  saveUsers();
  saveInvites();
  response.json({ token: password, user: { id: newUser.id, username: newUser.username, role: newUser.role } });
});

app.get('/api/auth/me', requireShareToken, (request, response) => {
  const user = request.headers['x-user'] as User;
  response.json({ id: user.id, username: user.username, role: user.role });
});

app.post('/api/auth/invite', requireAdmin, (request, response) => {
  const { role = 'member', maxUses = 1, expiresInHours } = request.body;
  const user = request.headers['x-user'] as User;
  const newInvite: Invite = {
    id: generateCode(4),
    code: generateCode(6),
    role,
    maxUses,
    usedCount: 0,
    usedBy: [],
    expiresAt: expiresInHours ? new Date(Date.now() + expiresInHours * 3600000).toISOString() : undefined,
    createdAt: new Date().toISOString(),
    createdBy: user.username,
  };
  invites.push(newInvite);
  saveInvites();
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
  response.json({ ok: true });
});

app.post('/api/auth/admin-secret', (request, response) => {
  const { secret } = request.body;
  if (secret !== adminSecret) {
    response.status(403).json({ error: 'invalid secret' });
    return;
  }
  if (users.length === 0) {
    const adminUser: User = {
      id: generateCode(4),
      username: 'admin',
      passwordHash: hashPassword('admin'),
      role: 'admin',
      createdAt: new Date().toISOString(),
      lastLogin: new Date().toISOString(),
    };
    users.push(adminUser);
    saveUsers();
  }
  response.json({ ok: true, message: 'admin initialized' });
});

app.get('/api/health', (_request, response) => {
  response.json({ok: true, name: 'StreamSync'});
});

app.get('/api/art/:id', requireShareToken, async (request, response, next) => {
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

app.post('/api/upload', requireShareToken, async (request, response, next) => {
  try {
    const originalName = typeof request.query.name === 'string' ? request.query.name : '';
    const extension = path.extname(originalName).toLowerCase();

    if (!supportedExtensions.has(extension)) {
      response.status(415).json({error: 'unsupported media type'});
      return;
    }

    const target = resolveMediaPath(originalName);
    const tempTarget = `${target}.tmp-${crypto.randomBytes(4).toString('hex')}`;
    const writeStream = fs.createWriteStream(tempTarget, {flags: 'wx'});

    let bytesReceived = 0;
    request.on('data', (chunk) => {
      bytesReceived += chunk.length;
      if (bytesReceived > maxUploadBytes) {
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
        if (bytesReceived <= maxUploadBytes) {
          await fs.promises.rename(tempTarget, target);
          response.status(201).json({ok: true});
        } else {
          await fs.promises.unlink(tempTarget).catch(() => {});
        }
      } catch (err) {
        next(err);
      }
    });
  } catch (error) {
    next(error);
  }
});

app.get('/api/stream/:id', requireShareToken, async (request, response, next) => {
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

app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
  console.error(error);
  if (!response.headersSent) {
    response.status(500).json({error: 'internal server error'});
  }
});

app.listen(port, '0.0.0.0', () => {
  console.log(`StreamSync server running on ${publicHost()}`);
  console.log(`Media folder: ${mediaDir}`);
});
