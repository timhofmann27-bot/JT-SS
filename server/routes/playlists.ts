import { Router } from 'express';
import crypto from 'node:crypto';
import {
  getPlaylists, getPlaylist, getPlaylistTracks,
  createPlaylist, updatePlaylist, deletePlaylist,
  addPlaylistTrack, removePlaylistTrack, reorderPlaylistTracks,
} from '../db.ts';
import { findFile, listFiles } from '../utils.ts';
import { requireShareToken, generalLimiter } from '../middleware.ts';

const router = Router();

// GET /api/playlists
router.get('/api/playlists', requireShareToken, generalLimiter, async (_req, res) => {
  try {
    const playlists = getPlaylists();
    const result = playlists.map((p) => {
      const tracks = getPlaylistTracks(p.id);
      return {
        id: p.id,
        name: p.name,
        description: p.description,
        trackCount: tracks.length,
        createdAt: p.created_at,
        updatedAt: p.updated_at,
        createdBy: p.created_by,
      };
    });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'failed to fetch playlists' });
  }
});

// POST /api/playlists
router.post('/api/playlists', requireShareToken, generalLimiter, async (req, res) => {
  try {
    const { name, description } = req.body;
    if (typeof name !== 'string' || name.trim().length === 0) {
      res.status(400).json({ error: 'name required' });
      return;
    }
    const user = req.user;
    if (!user) { res.status(401).json({ error: 'auth required' }); return; }

    const playlist = createPlaylist(crypto.randomUUID(), name.trim(), description?.trim() || '', user.username);
    res.status(201).json({
      id: playlist.id,
      name: playlist.name,
      description: playlist.description,
      trackCount: 0,
      createdAt: playlist.created_at,
      updatedAt: playlist.updated_at,
      createdBy: playlist.created_by,
    });
  } catch (error) {
    res.status(500).json({ error: 'failed to create playlist' });
  }
});

// GET /api/playlists/:id
router.get('/api/playlists/:id', requireShareToken, generalLimiter, async (req, res) => {
  try {
    const playlist = getPlaylist(req.params.id);
    if (!playlist) {
      res.status(404).json({ error: 'playlist not found' });
      return;
    }

    const tracks = getPlaylistTracks(playlist.id);
    const files = await listFiles();
    const fileMap = new Map(files.map((f) => [f.id, f]));

    const tracksWithFiles = tracks.map((t) => ({
      fileId: t.file_id,
      position: t.position,
      file: fileMap.get(t.file_id) || null,
    }));

    res.json({
      id: playlist.id,
      name: playlist.name,
      description: playlist.description,
      trackCount: tracks.length,
      createdAt: playlist.created_at,
      updatedAt: playlist.updated_at,
      createdBy: playlist.created_by,
      tracks: tracksWithFiles,
    });
  } catch (error) {
    res.status(500).json({ error: 'failed to fetch playlist' });
  }
});

// PUT /api/playlists/:id
router.put('/api/playlists/:id', requireShareToken, generalLimiter, async (req, res) => {
  try {
    const { name, description } = req.body;
    const playlist = updatePlaylist(req.params.id, { name, description });
    if (!playlist) {
      res.status(404).json({ error: 'playlist not found' });
      return;
    }

    const tracks = getPlaylistTracks(playlist.id);
    res.json({
      id: playlist.id,
      name: playlist.name,
      description: playlist.description,
      trackCount: tracks.length,
      createdAt: playlist.created_at,
      updatedAt: playlist.updated_at,
      createdBy: playlist.created_by,
    });
  } catch (error) {
    res.status(500).json({ error: 'failed to update playlist' });
  }
});

// DELETE /api/playlists/:id
router.delete('/api/playlists/:id', requireShareToken, generalLimiter, async (req, res) => {
  try {
    const playlist = getPlaylist(req.params.id);
    if (!playlist) {
      res.status(404).json({ error: 'playlist not found' });
      return;
    }
    deletePlaylist(req.params.id);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: 'failed to delete playlist' });
  }
});

// POST /api/playlists/:id/tracks
router.post('/api/playlists/:id/tracks', requireShareToken, generalLimiter, async (req, res) => {
  try {
    const playlist = getPlaylist(req.params.id);
    if (!playlist) {
      res.status(404).json({ error: 'playlist not found' });
      return;
    }

    const { fileId } = req.body;
    if (typeof fileId !== 'string') {
      res.status(400).json({ error: 'fileId required' });
      return;
    }

    const file = await findFile(fileId);
    if (!file) {
      res.status(404).json({ error: 'file not found' });
      return;
    }

    addPlaylistTrack(req.params.id, file.id);

    const tracks = getPlaylistTracks(playlist.id);
    const files = await listFiles();
    const fileMap = new Map(files.map((f) => [f.id, f]));
    const tracksWithFiles = tracks.map((t) => ({
      fileId: t.file_id,
      position: t.position,
      file: fileMap.get(t.file_id) || null,
    }));

    res.status(201).json(tracksWithFiles);
  } catch (error) {
    res.status(500).json({ error: 'failed to add track' });
  }
});

// DELETE /api/playlists/:id/tracks/:fileId
router.delete('/api/playlists/:id/tracks/:fileId', requireShareToken, generalLimiter, async (req, res) => {
  try {
    const playlist = getPlaylist(req.params.id);
    if (!playlist) {
      res.status(404).json({ error: 'playlist not found' });
      return;
    }

    removePlaylistTrack(req.params.id, req.params.fileId);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: 'failed to remove track' });
  }
});

// POST /api/playlists/:id/reorder
router.post('/api/playlists/:id/reorder', requireShareToken, generalLimiter, async (req, res) => {
  try {
    const playlist = getPlaylist(req.params.id);
    if (!playlist) {
      res.status(404).json({ error: 'playlist not found' });
      return;
    }

    const { trackIds } = req.body;
    if (!Array.isArray(trackIds)) {
      res.status(400).json({ error: 'trackIds array required' });
      return;
    }

    reorderPlaylistTracks(req.params.id, trackIds);

    const tracks = getPlaylistTracks(playlist.id);
    const files = await listFiles();
    const fileMap = new Map(files.map((f) => [f.id, f]));
    const tracksWithFiles = tracks.map((t) => ({
      fileId: t.file_id,
      position: t.position,
      file: fileMap.get(t.file_id) || null,
    }));

    res.json(tracksWithFiles);
  } catch (error) {
    res.status(500).json({ error: 'failed to reorder tracks' });
  }
});

export default router;
