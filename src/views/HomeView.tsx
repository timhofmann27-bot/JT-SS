import React, { useRef } from 'react';
import { motion } from 'motion/react';
import {
  Heart,
  Play,
  Disc3,
  Upload,
  ListPlus,
  Share2,
  Trash2,
} from 'lucide-react';
import type { ApiFile, Album, Artist } from '../types';
import { useContextMenu, type ContextMenuItem } from '../components/ui';
import { useInfiniteScroll } from '../hooks/useInfiniteScroll';

const API_BASE = import.meta.env.VITE_API_BASE ?? '';

function apiUrl(path: string) {
  return `${API_BASE}${path}`;
}

function getCoverUrl(file: ApiFile | null, token?: string) {
  if (!file) return '/icon.svg';
  if (file.hasArtwork) return apiUrl(`/api/cover/${file.id}${token ? `?token=${token}` : ''}`);
  return '/icon.svg';
}

interface HomeViewProps {
  files: ApiFile[];
  filteredFiles: ApiFile[];
  currentFile: ApiFile | null;
  isPlaying: boolean;
  likedIds: Set<string>;
  onPlay: (f: ApiFile) => void;
  onLike: (f: ApiFile) => void;
  onOpenUpload: () => void;
  likedFiles: ApiFile[];
  albums: Album[];
  onAlbumSelect: (a: Album) => void;
  onArtistSelect: (a: Artist) => void;
  onPlayAlbum: (a: Album) => void;
  onAddToQueue: (f: ApiFile) => void;
}

export default function HomeView({
  files,
  filteredFiles,
  currentFile,
  isPlaying,
  likedIds,
  onPlay,
  onLike,
  onOpenUpload,
  likedFiles,
  albums,
  onAlbumSelect,
  onArtistSelect,
  onPlayAlbum,
  onAddToQueue,
}: HomeViewProps) {
  const { open: openCtx, menu: CtxMenu } = useContextMenu();
  const listContainerRef = useRef<HTMLDivElement>(null);

  const {
    visibleItems: visibleTracks,
    hasMore: hasMoreTracks,
    observerRef: trackObserverRef,
  } = useInfiniteScroll({ items: filteredFiles, pageSize: 20 });

  function handleTrackContext(e: React.MouseEvent, file: ApiFile) {
    const items: ContextMenuItem[] = [
      { icon: <Play className="h-4 w-4" />, label: 'Abspielen', onClick: () => onPlay(file) },
      { icon: <ListPlus className="h-4 w-4" />, label: 'Zu Warteschlange', onClick: () => onAddToQueue(file) },
      { divider: true, label: '', onClick: () => {} },
      { icon: <Heart className="h-4 w-4" />, label: likedIds.has(file.id) ? 'Aus Lieblingstiteln entfernen' : 'Zu Lieblingstiteln', onClick: () => onLike(file) },
      { divider: true, label: '', onClick: () => {} },
      { icon: <Share2 className="h-4 w-4" />, label: 'Teilen', onClick: () => {} },
      { icon: <Trash2 className="h-4 w-4" />, label: 'Entfernen', onClick: () => {}, danger: true },
    ];
    openCtx(e, items, file);
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="home-view">
      <div className="home-content">
        {files.length === 0 ? (
          <div className="home-empty">
            <div className="home-empty-icon">
              <Disc3 className="h-16 w-16" />
            </div>
            <h2 className="home-empty-title">Deine Musik wartet</h2>
            <p className="home-empty-text">Lade Musik hoch oder lege Dateien in den Medienordner.</p>
            <button onClick={onOpenUpload} className="home-upload-btn">
              <Upload className="h-5 w-5" />
              Dateien hochladen
            </button>
          </div>
        ) : (
          <>
            {likedFiles.length > 0 && (
              <div className="home-section">
                <div className="liked-hero-tile" onClick={() => {}}>
                  <div className="liked-hero-icon">
                    <Heart className="h-10 w-10" fill="white" />
                  </div>
                  <div className="liked-hero-text">
                    <span className="liked-hero-label">Playlist</span>
                    <span className="liked-hero-title">Lieblingstitel</span>
                    <span className="liked-hero-count">{likedFiles.length} Titel</span>
                  </div>
                  <button className="liked-hero-play" onClick={(e) => { e.stopPropagation(); likedFiles[0] && onPlay(likedFiles[0]); }}>
                    <Play className="h-6 w-6 fill-current" />
                  </button>
                </div>
              </div>
            )}

            {albums.length > 0 && (
              <div className="home-section">
                <div className="home-section-header">
                  <h2 className="home-section-title">Erstellte Playlists</h2>
                </div>
                <div className="home-scroll-row">
                  {albums.slice(0, 6).map((album) => (
                    <div key={album.id} className="home-card" onClick={() => onAlbumSelect(album)}>
                      <div className="home-card-cover">
                        <img src={getCoverUrl(album.tracks[0])} alt={album.name} className="home-card-img" />
                        <div className="home-card-play">
                          <div className="home-card-play-btn">
                            <Play className="h-5 w-5 fill-current" />
                          </div>
                        </div>
                      </div>
                      <p className="home-card-title">{album.name}</p>
                      <p className="home-card-subtitle">{album.artist || 'Unbekannt'}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="home-section">
              <div className="home-section-header">
                <h2 className="home-section-title">Zuletzt gespielt</h2>
              </div>
              <div className="home-scroll-row">
                {files.slice(0, 6).map((file) => (
                  <div key={file.id} className="home-card" onClick={() => onPlay(file)}>
                    <div className="home-card-cover">
                      <img src={getCoverUrl(file)} alt={file.title} className="home-card-img" />
                      <div className="home-card-play">
                        <div className="home-card-play-btn">
                          <Play className="h-5 w-5 fill-current" />
                        </div>
                      </div>
                    </div>
                    <p className="home-card-title">{file.title}</p>
                    <p className="home-card-subtitle">{file.artist || 'Unbekannt'}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="home-section">
              <div className="home-section-header">
                <h2 className="home-section-title">Alle Titel</h2>
              </div>
              <div className="home-track-list" ref={listContainerRef}>
                {visibleTracks.map((file, index) => (
                  <div key={file.id} className={`home-track-item ${currentFile?.id === file.id ? 'is-playing' : ''}`} onClick={() => onPlay(file)} onContextMenu={(e) => handleTrackContext(e, file)}>
                    <div className="home-track-index">
                      {currentFile?.id === file.id && isPlaying ? (
                        <div className="home-eq-bars">
                          <span /><span /><span />
                        </div>
                      ) : (
                        <span className="home-track-number retro-mono">{index + 1}</span>
                      )}
                    </div>
                    <img src={getCoverUrl(file)} alt="" className="home-track-cover" />
                    <div className="home-track-info">
                      <p className="home-track-title">{file.title}</p>
                      <p className="home-track-artist">{file.artist || 'Unbekannt'}</p>
                    </div>
                    <button className={`home-track-like ${likedIds.has(file.id) ? 'is-liked' : ''}`} onClick={(e) => { e.stopPropagation(); onLike(file); }}>
                      <Heart className={`h-5 w-5 ${likedIds.has(file.id) ? 'fill-current' : ''}`} />
                    </button>
                    <span className="home-track-duration">{file.durationLabel || '0:00'}</span>
                  </div>
                ))}
                {hasMoreTracks && (
                  <div ref={trackObserverRef} className="infinite-scroll-sentinel">
                    <div className="loading-spinner" />
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
      {CtxMenu}
    </motion.div>
  );
}
