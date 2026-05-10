import { Router } from 'express';
import crypto from 'node:crypto';
import { getDb, getLikes, getQueueItems, getPlayHistory, getPlaylists, getPlaylistTracks, setLiked, addToQueue, removeFromQueue, clearQueue, addPlayHistory } from '../db.ts';
import { findFile, listFiles, roomName, maxPeers, publicHost, shareToken } from '../utils.ts';
import { verifySessionToken } from '../utils.ts';
import { requireShareToken, generalLimiter } from '../middleware.ts';
import type { ApiFile, User } from '../utils.ts';

const router = Router();

// SSE clients
export const eventClients = new Set<import('express').Response>();

// Room state helper
async function roomState(files?: ApiFile[]) {
  const availableFiles = files ?? await listFiles();
  const fileMap = new Map(availableFiles.map((file) => [file.id, file]));
  const likedIds = getLikes();
  const queueItems = getQueueItems();
  const playHistory = getPlayHistory();

  const playlistRows = getPlaylists();
  const playlists = playlistRows.map((pl) => {
    const tracks = getPlaylistTracks(pl.id);
    return {
      id: pl.id,
      name: pl.name,
      description: pl.description,
      trackIds: tracks.map((t) => t.file_id),
      createdAt: pl.created_at,
      updatedAt: pl.updated_at,
      isPublic: false,
      createdBy: pl.created_by,
    };
  });

  return {
    likedIds: likedIds.filter((id) => fileMap.has(id)),
    queue: queueItems
      .filter((item) => fileMap.has(item.file_id))
      .map((item) => ({
        id: item.id,
        fileId: item.file_id,
        addedAt: item.added_at,
        file: fileMap.get(item.file_id),
      })),
    playlists,
    playHistory: playHistory
      .filter((e) => fileMap.has(e.file_id))
      .map((e) => ({ fileId: e.file_id, playedAt: e.played_at })),
    updatedAt: new Date().toISOString(),
  };
}

// Broadcast state to all SSE clients
export async function broadcastState(): Promise<void> {
  if (eventClients.size === 0) return;
  const payload = JSON.stringify(await roomState());

  for (const client of eventClients) {
    client.write(`event: state\n`);
    client.write(`data: ${payload}\n\n`);
  }
}

// GET /api/state
router.get('/api/state', requireShareToken, generalLimiter, async (_req, res, next) => {
  try {
    res.json(await roomState());
  } catch (error) {
    next(error);
  }
});

// GET /api/events (SSE)
router.get('/api/events', async (req, res, next) => {
  try {
    const headerToken = req.header('x-share-token');
    const queryToken = typeof req.query.token === 'string' ? req.query.token : '';
    const candidate = headerToken || queryToken;

    const expected = Buffer.from(shareToken);
    const actual = Buffer.from(candidate);
    const staticOk = actual.length === expected.length && crypto.timingSafeEqual(actual, expected);

    const session = !staticOk ? verifySessionToken(candidate) : null;
    const db = getDb();
    const user = session ? db.prepare('SELECT * FROM users WHERE id = ?').get(session.userId) as User | undefined : null;

    if (!staticOk && !(session && user)) {
      res.status(401).json({ error: 'unauthorized' });
      return;
    }

    res.writeHead(200, {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
      'x-accel-buffering': 'no',
    });
    res.write(`event: state\n`);
    res.write(`data: ${JSON.stringify(await roomState())}\n\n`);
    eventClients.add(res);

    const keepAlive = setInterval(() => {
      res.write(`event: ping\n`);
      res.write(`data: ${Date.now()}\n\n`);
    }, 25000);

    req.on('close', () => {
      clearInterval(keepAlive);
      eventClients.delete(res);
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/status
router.get('/api/status', requireShareToken, (_req, res) => {
  res.json({
    roomName,
    host: publicHost(),
    maxPeers,
    livePeers: eventClients.size,
  });
});

// POST /api/likes/:id
router.post('/api/likes/:id', requireShareToken, generalLimiter, async (req, res, next) => {
  try {
    const file = await findFile(req.params.id);
    if (!file) {
      res.status(404).json({ error: 'not found' });
      return;
    }

    const liked = Boolean(req.body?.liked);
    setLiked(file.id, liked);
    await broadcastState();
    res.json(await roomState());
  } catch (error) {
    next(error);
  }
});

// POST /api/queue
router.post('/api/queue', requireShareToken, generalLimiter, async (req, res, next) => {
  try {
    const fileId = typeof req.body?.fileId === 'string' ? req.body.fileId : '';
    const file = await findFile(fileId);
    if (!file) {
      res.status(404).json({ error: 'not found' });
      return;
    }

    const id = crypto.randomUUID();
    addToQueue(id, file.id, new Date().toISOString());
    await broadcastState();
    res.status(201).json(await roomState());
  } catch (error) {
    next(error);
  }
});

// DELETE /api/queue/:id
router.delete('/api/queue/:id', requireShareToken, generalLimiter, async (req, res, next) => {
  try {
    removeFromQueue(req.params.id);
    await broadcastState();
    res.json(await roomState());
  } catch (error) {
    next(error);
  }
});

// POST /api/queue/clear
router.post('/api/queue/clear', requireShareToken, generalLimiter, async (_req, res, next) => {
  try {
    clearQueue();
    await broadcastState();
    res.json(await roomState());
  } catch (error) {
    next(error);
  }
});

// POST /api/play-history
router.post('/api/play-history', requireShareToken, generalLimiter, async (req, res, next) => {
  try {
    const fileId = typeof req.body?.fileId === 'string' ? req.body.fileId : '';
    const file = await findFile(fileId);
    if (!file) {
      res.status(404).json({ error: 'not found' });
      return;
    }
    addPlayHistory(file.id, new Date().toISOString());
    await broadcastState();
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

export default router;
