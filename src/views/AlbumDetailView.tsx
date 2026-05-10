import React from 'react';
import { motion } from 'motion/react';
import {
  Play,
  ChevronLeft,
  Download,
  Heart,
  Trash2,
} from 'lucide-react';
import type { ApiFile, Album } from '../types';
import { hueFromString } from '../lib/format';
import { coverUrl, apiUrl } from '../lib/api';
import { TrackRow } from '../components/ui';


interface AlbumDetailViewProps {
  album: Album;
  currentFile: ApiFile | null;
  isPlaying: boolean;
  likedIds?: Set<string>;
  onPlay: (f: ApiFile) => void;
  onLike: (f: ApiFile) => void;
  onBack: () => void;
  onDelete: (f: ApiFile) => void;
  onDeleteAlbum: (a: Album) => void;
  onAddToQueue: (f: ApiFile) => void;
  token?: string;
  cachedFileIds?: Set<string>;
}

export default function AlbumDetailView({
  album,
  currentFile,
  isPlaying,
  likedIds,
  onPlay,
  onLike,
  onBack,
  onDelete,
  onDeleteAlbum,
  onAddToQueue,
  token,
  cachedFileIds,
}: AlbumDetailViewProps) {
  const hue = hueFromString(album.name);
  const totalSeconds = album.tracks.reduce((s, t) => s + (t.duration ?? 0), 0);
  const totalMinutes = Math.floor(totalSeconds / 60);

  // Build Spotify-style meta line: "Album • Artist • 2024 • 6 Titel, 24 Min."
  const metaParts: string[] = ['Album'];
  if (album.artist) metaParts.push(album.artist);
  if (album.year) metaParts.push(String(album.year));
  metaParts.push(`${album.trackCount} Titel, ${totalMinutes} Min.`);
  const metaLine = metaParts.join(' \u2022 ');

  const downloadAlbum = () => {
    album.tracks.forEach((track, i) => {
      setTimeout(() => {
        const url = apiUrl(`/api/stream/${track.id}?token=${encodeURIComponent(token ?? '')}`);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${track.title || 'track'}.mp3`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }, i * 400);
    });
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className="detail-hero" style={{ background: `linear-gradient(180deg, ${hue}CC 0%, ${hue}40 50%, var(--color-bg) 100%)` }}>
        <button onClick={onBack} className="detail-back-btn">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="detail-hero-cover">
          <img src={coverUrl(album.tracks[0], { token, artist: album.tracks[0]?.artist, album: album.tracks[0]?.album })} alt={album.name} />
        </div>
        <div className="detail-hero-info">
          <p className="detail-hero-type">Album</p>
          <h1 className="detail-hero-title">{album.name}</h1>
          <p className="detail-hero-meta">{metaLine}</p>
          <div className="detail-hero-actions">
            <button onClick={() => album.tracks[0] && onPlay(album.tracks[0])} className="detail-play-btn">
              <Play className="h-6 w-6 fill-current" />
            </button>
            <button onClick={downloadAlbum} className="detail-download-btn" title="Album herunterladen">
              <Download className="h-5 w-5" />
            </button>
            <button onClick={() => onDeleteAlbum(album)} className="detail-download-btn" title="Album loeschen" style={{ color: 'var(--color-danger)' }}>
              <Trash2 className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      <div className="detail-content">
        <div className="home-track-list">
          {album.tracks.map((file, index) => (
            <TrackRow
              key={file.id}
              file={file}
              index={index}
              liked={likedIds?.has(file.id) ?? false}
              currentId={currentFile?.id ?? null}
              isPlaying={isPlaying}
              token={token}
              onPlay={onPlay}
              onToggleLike={onLike}
              onAddToQueue={onAddToQueue}
              swipeToQueue
              isOffline={cachedFileIds?.has(file.id) ?? false}
            />
          ))}
        </div>
      </div>
    </motion.div>
  );
}
