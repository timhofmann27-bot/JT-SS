import { Router } from 'express';
import { exec } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { mediaDir, invalidateFilesCache } from '../utils.ts';
import { requireShareToken, uploadLimiter } from '../middleware.ts';

const router = Router();

const ACE_API_KEY = process.env.ACE_MUSIC_API_KEY ?? '';
const ACE_API_URL = 'https://api.acemusic.ai/v1/chat/completions';

// POST /api/generate — AI music generation via ACE Music API
router.post('/api/generate', requireShareToken, uploadLimiter, async (req, res, next) => {
  try {
    if (!ACE_API_KEY) { res.status(503).json({ error: 'AI generation not configured' }); return; }

    const { prompt, lyrics, duration, language, instrumental, bpm, key, seed, sampleMode, title } = req.body;

    if (!prompt && !lyrics && !sampleMode) { res.status(400).json({ error: 'prompt or lyrics required' }); return; }

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
      signal: AbortSignal.timeout(120000),
    });

    if (!aceRes.ok) {
      const errText = await aceRes.text().catch(() => '');
      console.error('[ACE API] Status', aceRes.status, errText.slice(0, 200));
      res.status(502).json({ error: 'AI API error: ' + (errText.slice(0, 80) || 'unknown') });
      return;
    }

    const data = await aceRes.json() as any;
    const audios = data?.choices?.[0]?.message?.audio;
    if (!audios?.length) { res.status(500).json({ error: 'no audio generated' }); return; }

    const results: string[] = [];
    for (const a of audios) {
      const b64 = (a.audio_url?.url ?? '').split(',')[1];
      if (!b64) continue;
      const safeTitle = title
        ? title.replace(/[/\\\x00]/g, '_').replace(/^\.+/, '_').slice(0, 80)
        : `AI-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const filePath = path.join(mediaDir, `${safeTitle}.mp3`);
      await fs.promises.writeFile(filePath, Buffer.from(b64, 'base64'));
      if (title) {
        exec(`ffmpeg -i "${filePath}" -c copy -metadata title="${title.replace(/"/g, '\\"')}" -y "${filePath}.tmp.mp3" && mv "${filePath}.tmp.mp3" "${filePath}"`, (err) => {
          if (err) console.error('Failed to write ID3 title tag:', err.message);
        });
      }
      results.push(safeTitle);
    }

    invalidateFilesCache();
    res.json({ ok: true, count: results.length, titles: results });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      res.status(504).json({ error: 'generation timeout' });
      return;
    }
    next(error);
  }
});

export default router;
