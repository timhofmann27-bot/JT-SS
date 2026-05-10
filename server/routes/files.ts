import { Router } from 'express';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { listFiles, findFile, readMetadata, mediaDir, dataDir, resolveMediaPath, supportedExtensions, maxUploadBytes, validateFileContent, invalidateFilesCache, auditLog, escapeXml } from '../utils.ts';
import { requireShareToken, generalLimiter, uploadLimiter } from '../middleware.ts';

const router = Router();

// GET /api/files
router.get('/api/files', requireShareToken, generalLimiter, async (_req, res, next) => {
  try {
    res.setHeader('cache-control', 'private, max-age=30');
    res.json({ files: await listFiles() });
  } catch (error) {
    next(error);
  }
});

// GET /api/stream/:id
router.get('/api/stream/:id', requireShareToken, generalLimiter, async (req, res, next) => {
  try {
    const file = await findFile(req.params.id);
    if (!file) {
      res.status(404).json({ error: 'not found' });
      return;
    }

    const stats = await fs.promises.stat(file.absolutePath);
    const range = req.headers.range;
    res.setHeader('accept-ranges', 'bytes');
    res.setHeader('content-type', file.mimeType);

    if (!range) {
      res.setHeader('content-length', stats.size);
      fs.createReadStream(file.absolutePath).pipe(res);
      return;
    }

    const match = /bytes=(\d*)-(\d*)/.exec(range);
    if (!match) {
      res.status(416).end();
      return;
    }

    const start = match[1] ? Number(match[1]) : 0;
    const end = match[2] ? Number(match[2]) : stats.size - 1;

    if (start >= stats.size || end >= stats.size || start > end) {
      res.status(416).setHeader('content-range', `bytes */${stats.size}`).end();
      return;
    }

    res.status(206);
    res.setHeader('content-range', `bytes ${start}-${end}/${stats.size}`);
    res.setHeader('content-length', end - start + 1);
    fs.createReadStream(file.absolutePath, { start, end }).pipe(res);
  } catch (error) {
    next(error);
  }
});

// GET /api/art/:id
router.get('/api/art/:id', requireShareToken, generalLimiter, async (req, res, next) => {
  try {
    const file = await findFile(req.params.id);
    if (!file) {
      res.status(404).end();
      return;
    }

    const parsed = await readMetadata(file.absolutePath);
    const picture = parsed?.common.picture?.[0];

    if (picture) {
      res.type(picture.format);
      res.setHeader('cache-control', 'private, max-age=86400');
      res.send(Buffer.from(picture.data));
      return;
    }

    // Generate fallback SVG cover art
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

    res.type('image/svg+xml');
    res.setHeader('cache-control', 'private, max-age=86400');
    res.send(`
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

// GET /api/cover/:id (alias for /api/art/:id)
router.get('/api/cover/:id', requireShareToken, generalLimiter, async (req, res, next) => {
  try {
    const file = await findFile(req.params.id);
    if (!file) { res.status(404).end(); return; }

    const parsed = await readMetadata(file.absolutePath);
    const picture = parsed?.common.picture?.[0];

    if (picture) {
      res.type(picture.format);
      res.setHeader('cache-control', 'private, max-age=86400');
      res.send(Buffer.from(picture.data));
      return;
    }

    const hash = crypto.createHash('sha256').update(file.name).digest('hex');
    const hueA = Number.parseInt(hash.slice(0, 2), 16);
    const hueB = Number.parseInt(hash.slice(2, 4), 16);
    const hueC = Number.parseInt(hash.slice(4, 6), 16);
    const initials = escapeXml(file.title.split(' ').filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'JT');

    res.type('image/svg+xml');
    res.setHeader('cache-control', 'private, max-age=86400');
    res.send(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${hueA},78%,62%)"/><stop offset="0.55" stop-color="hsl(${hueB},72%,56%)"/><stop offset="1" stop-color="hsl(${hueC},84%,68%)"/></linearGradient></defs><rect width="512" height="512" rx="64" fill="#0d1b2a"/><rect x="24" y="24" width="464" height="464" rx="52" fill="url(#g)"/><circle cx="394" cy="118" r="82" fill="rgba(0,212,255,0.28)"/><circle cx="124" cy="392" r="112" fill="rgba(0,212,255,0.18)"/><text x="52" y="292" fill="#0d1b2a" font-family="Arial,sans-serif" font-size="132" font-weight="900">${initials}</text><text x="58" y="350" fill="rgba(16,20,18,0.72)" font-family="Arial,sans-serif" font-size="38" font-weight="700">StreamSync</text></svg>`);
  } catch (error) {
    next(error);
  }
});

// GET /api/album-cover — iTunes cover art fetcher
const albumArtDir = path.join(dataDir, 'artwork');
try { fs.mkdirSync(albumArtDir, { recursive: true }); } catch { /* dir may already exist or not be writable */ }

router.get('/api/album-cover', requireShareToken, generalLimiter, async (req, res, next) => {
  try {
    const artist = typeof req.query.artist === 'string' ? req.query.artist.trim() : '';
    const album = typeof req.query.album === 'string' ? req.query.album.trim() : '';

    if (!artist || !album) {
      res.status(400).json({ error: 'artist and album required' });
      return;
    }

    const cacheKey = crypto.createHash('sha256').update(`${artist}|${album}`).digest('hex');
    const cachePath = path.join(albumArtDir, `${cacheKey}.jpg`);

    if (fs.existsSync(cachePath)) {
      res.type('image/jpeg');
      res.setHeader('cache-control', 'public, max-age=604800, immutable');
      res.sendFile(cachePath);
      return;
    }

    const searchTerm = encodeURIComponent(`${artist} ${album}`);
    const itunesUrl = `https://itunes.apple.com/search?term=${searchTerm}&entity=album&limit=1`;

    const itunesRes = await fetch(itunesUrl, {
      headers: { 'User-Agent': 'JT-MP3/1.0' },
      signal: AbortSignal.timeout(8000),
    });

    if (!itunesRes.ok) {
      res.status(502).json({ error: 'upstream error' });
      return;
    }

    const data = await itunesRes.json() as { resultCount: number; results: Array<{ artworkUrl100?: string }> };
    if (data.resultCount === 0 || !data.results[0]?.artworkUrl100) {
      res.status(404).json({ error: 'not found' });
      return;
    }

    const artUrl = data.results[0].artworkUrl100.replace(/100x100/, '600x600');
    const imageRes = await fetch(artUrl, {
      headers: { 'User-Agent': 'JT-MP3/1.0' },
      signal: AbortSignal.timeout(10000),
    });

    if (!imageRes.ok) {
      res.status(502).json({ error: 'image fetch failed' });
      return;
    }

    const buffer = Buffer.from(await imageRes.arrayBuffer());
    await fs.promises.writeFile(cachePath, buffer);

    res.type('image/jpeg');
    res.setHeader('cache-control', 'public, max-age=604800, immutable');
    res.send(buffer);
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      res.status(504).json({ error: 'upstream timeout' });
      return;
    }
    next(error);
  }
});

// POST /api/upload
router.post('/api/upload', requireShareToken, uploadLimiter, async (req, res, next) => {
  try {
    const originalName = typeof req.query.name === 'string' ? req.query.name : '';
    const extension = path.extname(originalName).toLowerCase();

    if (!supportedExtensions.has(extension)) {
      res.status(415).json({ error: 'unsupported media type' });
      return;
    }

    const target = resolveMediaPath(originalName);
    const tempTarget = `${target}.tmp-${crypto.randomUUID()}`;
    const writeStream = fs.createWriteStream(tempTarget, { flags: 'wx' });

    let bytesReceived = 0;
    let aborted = false;

    req.on('data', (chunk) => {
      bytesReceived += chunk.length;
      if (bytesReceived > maxUploadBytes && !aborted) {
        aborted = true;
        writeStream.destroy();
        req.destroy();
        if (!res.headersSent) {
          res.status(413).json({ error: 'file too large' });
        }
      }
    });

    req.pipe(writeStream);
    req.on('error', next);
    writeStream.on('error', (error: NodeJS.ErrnoException) => {
      if (error.code === 'EEXIST') {
        res.status(409).json({ error: 'file already exists' });
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

        const isValid = await validateFileContent(tempTarget, extension);
        if (!isValid) {
          await fs.promises.unlink(tempTarget).catch(() => {});
          auditLog('UPLOAD_REJECTED', { name: originalName, reason: 'invalid_content' });
          res.status(415).json({ error: 'file content does not match extension' });
          return;
        }

        await fs.promises.rename(tempTarget, target);
        invalidateFilesCache();
        auditLog('UPLOAD_SUCCESS', { name: originalName, size: String(bytesReceived) });
        res.status(201).json({ ok: true });
      } catch (err) {
        await fs.promises.unlink(tempTarget).catch(() => {});
        next(err);
      }
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/files/:id
router.delete('/api/files/:id', requireShareToken, generalLimiter, async (req, res, next) => {
  try {
    const file = await findFile(req.params.id);
    if (!file) { res.status(404).json({ error: 'not found' }); return; }

    await fs.promises.unlink(file.absolutePath).catch(() => {});

    // Remove from likes & queue in DB
    const { getDb } = await import('../db.ts');
    const db = getDb();
    db.prepare('DELETE FROM likes WHERE file_id = ?').run(req.params.id);
    db.prepare('DELETE FROM queue WHERE file_id = ?').run(req.params.id);

    invalidateFilesCache();
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

export default router;
