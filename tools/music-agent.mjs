#!/usr/bin/env node
/**
 * JT-MP3 Musik-Agent
 * 
 * Taggt Musikdateien mit korrekten ID3-Metadaten, lädt von YouTube runter.
 * Schreibt getaggte Dateien via docker cp zurück in den Container.
 * 
 * Usage:
 *   node tools/music-agent.mjs fix       – Fehlende Metadaten reparieren
 *   node tools/music-agent.mjs list      – Status aller Dateien anzeigen
 *   node tools/music-agent.mjs dl <URL>  – YouTube-Video runterladen
 */

import { execSync, spawnSync } from 'node:child_process';
import { readdirSync, existsSync, unlinkSync } from 'node:fs';
import { join, parse } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const PROJECT_DIR = join(__dirname, '..');
const MEDIA_DIR = join(PROJECT_DIR, 'data', 'media');
const CONTAINER = 'jt-ss-app';
const CONTAINER_MEDIA = '/data/media';
const YT_DLP = join(process.env.HOME, '.local', 'bin', 'yt-dlp');

// ── Helpers ─────────────────────────────────────────────

function sh(cmd, silent = false) {
  return execSync(cmd, { encoding: 'utf-8', stdio: silent ? 'pipe' : 'inherit' });
}

function ffprobe(filePath) {
  try {
    const raw = execSync(`ffprobe -v quiet -show_entries format_tags=title,artist,album -of json "${filePath}"`, { encoding: 'utf-8', stdio: 'pipe' });
    const data = JSON.parse(raw);
    const tags = data?.format?.tags || {};
    return { title: tags.title || '', artist: tags.artist || '', album: tags.album || '' };
  } catch { return { title: '', artist: '', album: '' }; }
}

/** Parse artist & title from filename */
function parseFilenameMeta(filename) {
  const base = parse(filename).name;
  const cleaned = base
    .replace(/[\s_]*[\[\(]?(Official\s*(Video|Audio|Music Video|Lyric Video|Visualizer|Visual))[\]\)]?/gi, '')
    .replace(/[\[\(]?(Audio|Streaming|Remastered\s*\d*|HD|HQ|Lyrics|Prod\.?\s*\S*)[\]\)]?/gi, '')
    .replace(/_+/g, ' ')
    .trim();
  const normalized = cleaned
    .replace(/\s*[-–—:]\s*/g, ' - ')
    .replace(/\s+\|\s+/g, ' - ')
    .replace(/\s{2,}/g, ' - ');
  const parts = normalized.split(' - ');
  if (parts.length === 2 && parts[0].length > 0 && parts[1].length > 0) {
    return { artist: parts[0].trim(), title: parts[1].trim() };
  }
  return { title: cleaned || base };
}

function audioFiles() {
  const exts = ['.mp3', '.m4a', '.opus', '.ogg', '.flac', '.wav', '.aac', '.wma', '.webm'];
  return readdirSync(MEDIA_DIR)
    .filter(f => exts.includes(parse(f).ext.toLowerCase()))
    .sort();
}

/** Tag a file: read from host, tag to /tmp, push into container */
function tagFile(filename, { title, artist, album }) {
  const hostPath = join(MEDIA_DIR, filename);
  const ext = parse(filename).ext;
  const tmpFile = `/tmp/jt-tag-${Date.now().toString(36)}${ext}`;

  // Build ffmpeg args
  const args = ['-i', hostPath, '-c:a', 'copy', '-id3v2_version', '3', '-y'];
  if (title) args.push('-metadata', `title=${title}`);
  if (artist) args.push('-metadata', `artist=${artist}`);
  if (album) args.push('-metadata', `album=${album}`);
  args.push(tmpFile);

  const result = spawnSync('ffmpeg', args, { encoding: 'utf-8', stdio: 'pipe' });
  if (result.status !== 0) {
    try { unlinkSync(tmpFile); } catch {}
    return false;
  }

  // Push into container
  try {
    execSync(`docker cp "${tmpFile}" "${CONTAINER}:${CONTAINER_MEDIA}/${filename}"`, { encoding: 'utf-8', stdio: 'pipe' });
    try { unlinkSync(tmpFile); } catch {}
    return true;
  } catch (e) {
    try { unlinkSync(tmpFile); } catch {}
    return false;
  }
}

// ── Commands ────────────────────────────────────────────

function cmdList() {
  const files = audioFiles();
  let ok = 0, missing = 0;
  console.log(`\n📋 ${files.length} Dateien in ${MEDIA_DIR}\n`);
  for (const f of files) {
    const meta = ffprobe(join(MEDIA_DIR, f));
    const parsed = parseFilenameMeta(f);
    if (meta.title || meta.artist) {
      ok++;
      console.log(`  ✅ ${meta.artist || '???'} — ${meta.title || f}`);
    } else {
      missing++;
      const label = parsed.artist ? `${parsed.artist} — ${parsed.title}` : parsed.title;
      console.log(`  ❌ ${label}  [aus Dateiname]`);
    }
  }
  console.log(`\n  ${ok} mit Tags, ${missing} ohne Tags\n`);
}

function cmdFix() {
  const files = audioFiles();
  let fixed = 0, skipped = 0, failed = 0;
  console.log('\n🔧 Repariere Metadaten...\n');
  for (const f of files) {
    const meta = ffprobe(join(MEDIA_DIR, f));
    if (meta.title && meta.artist) { skipped++; continue; }
    
    const parsed = parseFilenameMeta(f);
    const title = meta.title || parsed.title;
    const artist = meta.artist || parsed.artist || '';
    
    if (!artist && !title) { skipped++; continue; }
    
    const label = `${artist || '(kein Artist)'} — ${title}`;
    process.stdout.write(`  🏷️  ${label.slice(0, 60)} ... `);
    
    if (tagFile(f, { title, artist })) {
      console.log('✅');
      fixed++;
    } else {
      console.log('❌');
      failed++;
    }
  }
  console.log(`\n  ✅ ${fixed} repariert  ⏭️ ${skipped} übersprungen  ❌ ${failed} Fehler\n`);
}

async function cmdDownload(url) {
  if (!existsSync(YT_DLP)) {
    console.error('❌ yt-dlp nicht gefunden.');
    console.error('   curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o ~/.local/bin/yt-dlp && chmod +x ~/.local/bin/yt-dlp');
    process.exit(1);
  }
  console.log(`\n📥 Lade herunter: ${url}\n`);
  
  const info = execSync(`${YT_DLP} --print '%(title)s|%(uploader)s' --no-playlist "${url}"`, { encoding: 'utf-8', stdio: 'pipe' }).trim();
  const [videoTitle, uploader] = info.split('|');
  console.log(`   Video: ${videoTitle}`);
  console.log(`   Artist: ${uploader}\n`);
  console.log('   ⏳ Downloade & konvertiere...');
  
  try {
    execSync(`${YT_DLP} -x --audio-format mp3 --audio-quality 0 -o "${MEDIA_DIR}/%(uploader)s - %(title)s.%(ext)s" --no-playlist --embed-thumbnail --embed-metadata "${url}"`, { encoding: 'utf-8', stdio: 'inherit' });
    console.log('\n   ✅ Fertig! Jetzt mit `fix` die Tags prüfen.\n');
  } catch (e) {
    console.error(`\n   ❌ Download fehlgeschlagen\n`);
  }
}

// ── Main ────────────────────────────────────────────────

const cmd = process.argv[2];
const arg = process.argv[3];

if (!cmd || cmd === 'help' || cmd === '--help') {
  console.log(`
🎵 JT-MP3 Musik-Agent

  fix        Fehlende ID3-Tags aus Dateinamen reparieren
  list       Status aller Dateien anzeigen
  dl <URL>   YouTube-Video runterladen & taggen
  help       Diese Hilfe
`);
  process.exit(0);
}

switch (cmd) {
  case 'list': cmdList(); break;
  case 'fix': cmdFix(); break;
  case 'dl':
    if (!arg) { console.error('❌ YouTube-URL angeben'); process.exit(1); }
    cmdDownload(arg);
    break;
  default:
    console.error(`❌ Unbekannt: ${cmd}`);
    process.exit(1);
}
