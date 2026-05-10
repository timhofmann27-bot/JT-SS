import { Router } from 'express';
import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { mediaDir, invalidateFilesCache } from '../utils.ts';
import { requireShareToken, uploadLimiter } from '../middleware.ts';

const router = Router();

// YouTube Download state
const activeDownloads = new Map<string, {
  process: any;
  status: string;
  title: string;
  progress: number;
  error?: string;
  totalTracks?: number;
  downloadedCount?: number;
}>();

// POST /api/download
router.post('/api/download', requireShareToken, uploadLimiter, async (req, res) => {
  try {
    const { url } = req.body;
    if (!url || typeof url !== 'string') {
      res.status(400).json({ error: 'Keine URL angegeben' }); return;
    }

    const normalizedUrl = url.trim();
    const isYT = normalizedUrl.includes('youtube.com') || normalizedUrl.includes('youtu.be');
    const isMusic = normalizedUrl.includes('music.youtube.com');
    if (!isYT) {
      res.status(400).json({ error: 'Keine gueltige YouTube-URL. Bitte einen YouTube- oder YouTube-Music-Link einfuegen.' }); return;
    }

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
    res.status(202).json({
      id: downloadId,
      status: 'starting',
      title: isPlaylist ? 'Album-Download gestartet' : isChannel ? 'Channel-Download gestartet' : 'Download gestartet',
      progress: 0
    });

    const cookiesFile = '/tmp/yt_cookies_' + downloadId + '.txt';
    try {
      const srcData = await fs.promises.readFile('/tmp/youtube_cookies_src.txt');
      await fs.promises.writeFile(cookiesFile, srcData, { mode: 0o644 });
    } catch {}

    const hasCookies = fs.existsSync(cookiesFile);
    const args = [
      '--js-runtimes', 'node',
      '--remote-components', 'ejs:github',
      '-x', '--audio-format', 'mp3', '--audio-quality', '0',
      '--embed-metadata', '--embed-thumbnail',
      '--download-archive', '/data/state/yt_archive.txt',
      '--no-playlist'
    ];

    if (hasCookies) {
      args.push('--cookies', cookiesFile);
      args.push('--extractor-args', 'youtube:player_client=web,tv');
    } else {
      args.push('--extractor-args', 'youtube:player_client=android,ios,web');
    }

    if (isPlaylist || isChannel) {
      const noPlaylistIdx = args.indexOf('--no-playlist');
      if (noPlaylistIdx !== -1) args.splice(noPlaylistIdx, 1);
      args.push('--yes-playlist');
      if (!isChannel) args.push('--playlist-items', '1-50');
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

      const totalMatch = text.match(/Downloading playlist: .+ \((\d+) videos?\)/);
      if (totalMatch) {
        totalTracks = parseInt(totalMatch[1], 10);
        dl.totalTracks = totalTracks;
      }

      const doneMatch = text.match(/\[download\]\s+Destination:\s+.+\/(.+?)\.(?:webm|m4a|mp4|opus)/);
      if (doneMatch) {
        lastTitle = doneMatch[1];
        downloadedCount++;
        dl.downloadedCount = downloadedCount;
      }

      if (text.includes('has already been recorded in archive')) {
        skippedCount++;
        dl.title = `${skippedCount} uebersprungen, ${downloadedCount} neu`;
      }

      const extractMatch = text.match(/\[ExtractAudio\] Destination: .+\/(.+?)\.mp3/);
      if (extractMatch) {
        lastTitle = extractMatch[1];
      }

      const perFileMatch = text.match(/([0-9.]+)%/);
      if (perFileMatch && totalTracks > 0) {
        const fileProgress = Math.min(99, parseFloat(perFileMatch[1]));
        const base = (downloadedCount / Math.max(totalTracks, 1)) * 100;
        const current = (1 / Math.max(totalTracks, 1)) * fileProgress;
        dl.progress = Math.round(Math.min(99, base + current));
      } else if (perFileMatch) {
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
      const text = data.toString();
      errorText += text;
      console.error('[yt-dlp]', text.trim());
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
        if (errorText.includes('Video unavailable')) dl.error = 'Video nicht verfuegbar (privat oder geloescht)';
        else if (errorText.includes('Private video')) dl.error = 'Video ist privat und kann nicht heruntergeladen werden';
        else if (errorText.includes('copyright')) dl.error = 'Urheberrechtlich geschuetzt — Download nicht moeglich';
        else if (errorText.includes('age restricted') || errorText.includes('age_limit')) dl.error = 'Altersbeschraenkt — mit Login erneut versuchen';
        else if (errorText.includes('HTTP Error 403')) dl.error = 'Zugriff verweigert (403). Video gesperrt.';
        else if (errorText.includes('HTTP Error 404') || errorText.includes('not found')) dl.error = 'Video/Playlist nicht gefunden (404)';
        else if (errorText.includes('This video is not available')) dl.error = 'Video in deinem Land nicht verfuegbar';
        else if (errorText.includes('Sign in') || errorText.includes('login required')) dl.error = 'Cookies abgelaufen — bitte neue YouTube-Cookies bereitstellen';
        else if (errorText.includes('Incomplete data') || errorText.includes('No video formats')) dl.error = 'Kein Audio-Format gefunden — Video eventuell geloescht';
        else {
          const detail = errorText.slice(-200).replace(/\n/g, ' ').trim();
          console.error('[yt-dlp FAIL] exit=' + code + ' err=' + detail);
          dl.error = 'Download fehlgeschlagen: ' + (detail || 'Unbekannter Fehler');
        }
      }
      setTimeout(() => activeDownloads.delete(downloadId), 60000);
    });

    proc.on('error', (err) => {
      const dl = activeDownloads.get(downloadId);
      if (dl) { dl.status = 'error'; dl.progress = 0; dl.error = 'yt-dlp nicht verfuegbar. Bitte Admin informieren.'; }
    });
  } catch (err) { res.status(500).json({ error: 'Server-Fehler beim Download' }); }
});

// GET /api/download/:id
router.get('/api/download/:id', requireShareToken, (req, res) => {
  const dl = activeDownloads.get(req.params.id);
  if (!dl) res.json({ status: 'done', title: 'Fertig', progress: 100 });
  else res.json({
    id: req.params.id,
    status: dl.status,
    title: dl.title,
    progress: Math.round(dl.progress),
    error: dl.error || '',
    totalTracks: dl.totalTracks || 0,
    downloadedCount: dl.downloadedCount || 0
  });
});

// DELETE /api/download/:id
router.delete('/api/download/:id', requireShareToken, (req, res) => {
  const dl = activeDownloads.get(req.params.id);
  if (!dl) { res.json({ ok: true }); return; }
  try { dl.process?.kill('SIGTERM'); } catch {}
  activeDownloads.delete(req.params.id);
  res.json({ ok: true });
});

export default router;
