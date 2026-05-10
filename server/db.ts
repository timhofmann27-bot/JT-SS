import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const dataDir = path.resolve(process.env.DATA_DIR ?? path.join(rootDir, 'data'));

const DB_PATH = path.join(dataDir, 'streamsync.db');

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) throw new Error('Database not initialized. Call initDb() first.');
  return db;
}

export function initDb(): Database.Database {
  if (db) return db;

  fs.mkdirSync(dataDir, { recursive: true });

  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // Create tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'member',
      created_at TEXT NOT NULL,
      last_login TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS invites (
      id TEXT PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      role TEXT NOT NULL DEFAULT 'member',
      max_uses INTEGER NOT NULL DEFAULT 1,
      used_count INTEGER NOT NULL DEFAULT 0,
      expires_at TEXT,
      created_at TEXT NOT NULL,
      created_by TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS invite_uses (
      invite_id TEXT NOT NULL,
      username TEXT NOT NULL,
      PRIMARY KEY (invite_id, username),
      FOREIGN KEY (invite_id) REFERENCES invites(id)
    );

    CREATE TABLE IF NOT EXISTS likes (
      file_id TEXT PRIMARY KEY
    );

    CREATE TABLE IF NOT EXISTS queue (
      id TEXT PRIMARY KEY,
      file_id TEXT NOT NULL,
      added_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS play_history (
      file_id TEXT NOT NULL,
      played_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS playlists (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      created_by TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS playlist_tracks (
      playlist_id TEXT NOT NULL,
      file_id TEXT NOT NULL,
      position INTEGER NOT NULL,
      PRIMARY KEY (playlist_id, file_id),
      FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE
    );
  `);

  return db;
}

// Migrate existing JSON data on first start
export function migrateFromJson(): void {
  const d = getDb();

  // Migrate users
  const usersFile = path.join(dataDir, 'users.json');
  if (fs.existsSync(usersFile)) {
    const userCount = d.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
    if (userCount.count === 0) {
      try {
        const raw = JSON.parse(fs.readFileSync(usersFile, 'utf-8'));
        const users = raw.users || [];
        const insert = d.prepare(
          'INSERT OR IGNORE INTO users (id, username, password_hash, role, created_at, last_login) VALUES (?, ?, ?, ?, ?, ?)'
        );
        const tx = d.transaction(() => {
          for (const u of users) {
            insert.run(u.id, u.username, u.passwordHash, u.role, u.createdAt, u.lastLogin);
          }
        });
        tx();
        console.log(`[db] Migrated ${users.length} users from users.json`);
      } catch (err) {
        console.error('[db] Failed to migrate users.json:', err);
      }
    }
  }

  // Migrate invites
  const invitesFile = path.join(dataDir, 'invites.json');
  if (fs.existsSync(invitesFile)) {
    const inviteCount = d.prepare('SELECT COUNT(*) as count FROM invites').get() as { count: number };
    if (inviteCount.count === 0) {
      try {
        const raw = JSON.parse(fs.readFileSync(invitesFile, 'utf-8'));
        const invites = raw.invites || [];
        const insertInvite = d.prepare(
          'INSERT OR IGNORE INTO invites (id, code, role, max_uses, used_count, expires_at, created_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
        );
        const insertUse = d.prepare(
          'INSERT OR IGNORE INTO invite_uses (invite_id, username) VALUES (?, ?)'
        );
        const tx = d.transaction(() => {
          for (const inv of invites) {
            insertInvite.run(inv.id, inv.code, inv.role, inv.maxUses, inv.usedCount, inv.expiresAt || null, inv.createdAt, inv.createdBy);
            for (const username of (inv.usedBy || [])) {
              insertUse.run(inv.id, username);
            }
          }
        });
        tx();
        console.log(`[db] Migrated ${invites.length} invites from invites.json`);
      } catch (err) {
        console.error('[db] Failed to migrate invites.json:', err);
      }
    }
  }

  // Migrate state (likes, queue, play_history)
  const stateFile = path.join(dataDir, 'state.json');
  if (fs.existsSync(stateFile)) {
    const likesCount = d.prepare('SELECT COUNT(*) as count FROM likes').get() as { count: number };
    if (likesCount.count === 0) {
      try {
        const state = JSON.parse(fs.readFileSync(stateFile, 'utf-8'));
        const insertLike = d.prepare('INSERT OR IGNORE INTO likes (file_id) VALUES (?)');
        const insertQueue = d.prepare('INSERT OR IGNORE INTO queue (id, file_id, added_at) VALUES (?, ?, ?)');
        const insertHistory = d.prepare('INSERT OR IGNORE INTO play_history (file_id, played_at) VALUES (?, ?)');
        const tx = d.transaction(() => {
          for (const id of (state.likedIds || [])) {
            insertLike.run(id);
          }
          for (const item of (state.queue || [])) {
            insertQueue.run(item.id, item.fileId, item.addedAt);
          }
          for (const entry of (state.playHistory || [])) {
            insertHistory.run(entry.fileId, entry.playedAt);
          }
        });
        tx();
        console.log(`[db] Migrated state from state.json (${(state.likedIds || []).length} likes, ${(state.queue || []).length} queue items, ${(state.playHistory || []).length} history entries)`);
      } catch (err) {
        console.error('[db] Failed to migrate state.json:', err);
      }
    }
  }
}

// Helper: get all likes
export function getLikes(): string[] {
  return getDb().prepare('SELECT file_id FROM likes').all().map((r: any) => r.file_id);
}

// Helper: get queue items
export function getQueueItems(): Array<{ id: string; file_id: string; added_at: string }> {
  return getDb().prepare('SELECT * FROM queue ORDER BY added_at ASC').all() as any[];
}

// Helper: get play history
export function getPlayHistory(): Array<{ file_id: string; played_at: string }> {
  return getDb().prepare('SELECT file_id, played_at FROM play_history ORDER BY played_at DESC LIMIT 100').all() as any[];
}

// Helper: likes operations
export function setLiked(fileId: string, liked: boolean): void {
  if (liked) {
    getDb().prepare('INSERT OR IGNORE INTO likes (file_id) VALUES (?)').run(fileId);
  } else {
    getDb().prepare('DELETE FROM likes WHERE file_id = ?').run(fileId);
  }
}

// Helper: queue operations
export function addToQueue(id: string, fileId: string, addedAt: string): void {
  getDb().prepare('INSERT INTO queue (id, file_id, added_at) VALUES (?, ?, ?)').run(id, fileId, addedAt);
}

export function removeFromQueue(id: string): void {
  getDb().prepare('DELETE FROM queue WHERE id = ?').run(id);
}

export function clearQueue(): void {
  getDb().prepare('DELETE FROM queue').run();
}

// Helper: play history operations
export function addPlayHistory(fileId: string, playedAt: string): void {
  getDb().prepare('DELETE FROM play_history WHERE file_id = ?').run(fileId);
  getDb().prepare('INSERT INTO play_history (file_id, played_at) VALUES (?, ?)').run(fileId, playedAt);
  // Keep only last 100
  getDb().prepare(`
    DELETE FROM play_history WHERE file_id NOT IN (
      SELECT file_id FROM play_history ORDER BY played_at DESC LIMIT 100
    )
  `).run();
}

// Playlist helpers
export interface PlaylistRow {
  id: string;
  name: string;
  description: string;
  created_at: string;
  updated_at: string;
  created_by: string;
}

export interface PlaylistTrackRow {
  playlist_id: string;
  file_id: string;
  position: number;
}

export function getPlaylists(): PlaylistRow[] {
  return getDb().prepare('SELECT * FROM playlists ORDER BY updated_at DESC').all() as PlaylistRow[];
}

export function getPlaylist(id: string): PlaylistRow | undefined {
  return getDb().prepare('SELECT * FROM playlists WHERE id = ?').get(id) as PlaylistRow | undefined;
}

export function createPlaylist(id: string, name: string, description: string, createdBy: string): PlaylistRow {
  const now = new Date().toISOString();
  getDb().prepare('INSERT INTO playlists (id, name, description, created_at, updated_at, created_by) VALUES (?, ?, ?, ?, ?, ?)')
    .run(id, name, description, now, now, createdBy);
  return getPlaylist(id)!;
}

export function updatePlaylist(id: string, updates: { name?: string; description?: string }): PlaylistRow | undefined {
  const playlist = getPlaylist(id);
  if (!playlist) return undefined;
  const now = new Date().toISOString();
  const name = updates.name ?? playlist.name;
  const description = updates.description ?? playlist.description;
  getDb().prepare('UPDATE playlists SET name = ?, description = ?, updated_at = ? WHERE id = ?')
    .run(name, description, now, id);
  return getPlaylist(id);
}

export function deletePlaylist(id: string): void {
  getDb().prepare('DELETE FROM playlists WHERE id = ?').run(id);
}

export function getPlaylistTracks(playlistId: string): PlaylistTrackRow[] {
  return getDb().prepare('SELECT * FROM playlist_tracks WHERE playlist_id = ? ORDER BY position ASC').all(playlistId) as PlaylistTrackRow[];
}

export function addPlaylistTrack(playlistId: string, fileId: string): void {
  const maxPos = getDb().prepare('SELECT MAX(position) as maxPos FROM playlist_tracks WHERE playlist_id = ?').get(playlistId) as { maxPos: number | null };
  const nextPos = (maxPos?.maxPos ?? -1) + 1;
  getDb().prepare('INSERT OR IGNORE INTO playlist_tracks (playlist_id, file_id, position) VALUES (?, ?, ?)')
    .run(playlistId, fileId, nextPos);
}

export function removePlaylistTrack(playlistId: string, fileId: string): void {
  getDb().prepare('DELETE FROM playlist_tracks WHERE playlist_id = ? AND file_id = ?').run(playlistId, fileId);
}

export function reorderPlaylistTracks(playlistId: string, trackIds: string[]): void {
  const update = getDb().prepare('UPDATE playlist_tracks SET position = ? WHERE playlist_id = ? AND file_id = ?');
  const tx = getDb().transaction(() => {
    for (let i = 0; i < trackIds.length; i++) {
      update.run(i, playlistId, trackIds[i]);
    }
  });
  tx();
  // Update playlist timestamp
  getDb().prepare('UPDATE playlists SET updated_at = ? WHERE id = ?').run(new Date().toISOString(), playlistId);
}
