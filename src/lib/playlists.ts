import { apiUrl } from './api';
import type { Playlist } from '../types';

export interface PlaylistTrack {
  fileId: string;
  position: number;
  file: any;
}

export interface PlaylistDetail extends Playlist {
  tracks: PlaylistTrack[];
}

export async function fetchPlaylists(headers: Record<string, string>): Promise<Playlist[]> {
  const res = await fetch(apiUrl('/api/playlists'), { headers });
  if (!res.ok) throw new Error('failed to load playlists');
  return res.json();
}

export async function createPlaylist(
  name: string,
  description: string,
  headers: Record<string, string>,
): Promise<Playlist> {
  const res = await fetch(apiUrl('/api/playlists'), {
    method: 'POST',
    headers: { ...headers, 'content-type': 'application/json' },
    body: JSON.stringify({ name: name.trim(), description: description.trim() }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'failed to create playlist');
  }
  return res.json();
}

export async function deletePlaylist(id: string, headers: Record<string, string>): Promise<void> {
  const res = await fetch(apiUrl(`/api/playlists/${id}`), { method: 'DELETE', headers });
  if (!res.ok) throw new Error('failed to delete playlist');
}

export async function renamePlaylist(
  id: string,
  updates: { name?: string; description?: string },
  headers: Record<string, string>,
): Promise<Playlist> {
  const res = await fetch(apiUrl(`/api/playlists/${id}`), {
    method: 'PUT',
    headers: { ...headers, 'content-type': 'application/json' },
    body: JSON.stringify(updates),
  });
  if (!res.ok) throw new Error('failed to update playlist');
  return res.json();
}

export async function addTrackToPlaylist(
  playlistId: string,
  fileId: string,
  headers: Record<string, string>,
): Promise<PlaylistTrack[]> {
  const res = await fetch(apiUrl(`/api/playlists/${playlistId}/tracks`), {
    method: 'POST',
    headers: { ...headers, 'content-type': 'application/json' },
    body: JSON.stringify({ fileId }),
  });
  if (!res.ok) throw new Error('failed to add track');
  return res.json();
}

export async function removeTrackFromPlaylist(
  playlistId: string,
  fileId: string,
  headers: Record<string, string>,
): Promise<void> {
  const res = await fetch(apiUrl(`/api/playlists/${playlistId}/tracks/${fileId}`), {
    method: 'DELETE',
    headers,
  });
  if (!res.ok) throw new Error('failed to remove track');
}
