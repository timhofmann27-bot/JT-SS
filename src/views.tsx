import React from 'react';
import { motion } from 'motion/react';
import {
  Play,
  Heart,
  ListMusic,
  Plus,
  MoreHorizontal,
  Disc,
  User,
  Lock,
  Copy,
  Globe,
  Music,
  UserPlus,
} from 'lucide-react';
import type { ApiFile, Album, ChartItem, UserProfile, SharedRoom } from './types';
  Music,
  TrendingUp,
  BarChart3,
  Clock,
  Settings,
  Sliders,
  Timer,
  MonitorSpeaker,
  Volume2,
  Flame,
  ChevronRight,
  X,
  CheckCircle2,
  Clock8,
} from 'lucide-react';
import type { Album, Artist, Playlist, ChartItem, ApiFile, UserSettings } from './types';

const coverUrl = (file: ApiFile | undefined) => {
  if (!file) return '/icon.svg';
  return file.hasArtwork ? `/api/art/${file.id}` : '/icon.svg';
};

const formatTime = (seconds: number) => {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${mins}:${secs}`;
};

const formatDuration = (seconds: number) => {
  if (seconds < 60) return formatTime(seconds);
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
};

export function AlbumsView({ albums, onPlayAlbum, onSelectAlbum }: {
  albums: Album[];
  onPlayAlbum: (album: Album) => void;
  onSelectAlbum: (album: Album | null) => void;
}) {
  return (
    <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-black">Alben</h2>
        <p className="text-sm font-bold text-muted">{albums.length} Alben</p>
      </div>

      {albums.length === 0 ? (
        <div className="empty-state">
          <Disc className="h-11 w-11 text-mint" />
          <h3 className="text-xl font-black">Keine Alben</h3>
          <p className="max-w-sm text-sm leading-6 text-muted">Fuege Musik mit Album-Informationen hinzu.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {albums.map((album) => (
            <motion.div
              key={album.id}
              className="group cursor-pointer"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onSelectAlbum(album)}
            >
              <div className="cover-wrap">
                <img src={coverUrl(album.tracks[0])} alt={album.name} className="cover-art" />
                <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={(e) => { e.stopPropagation(); onPlayAlbum(album); }} className="play-button h-12 w-12">
                    <Play className="h-6 w-6 fill-current" />
                  </button>
                </div>
              </div>
              <p className="mt-2 truncate text-sm font-bold">{album.name}</p>
              <p className="truncate text-xs text-muted">{album.trackCount} Tracks</p>
            </motion.div>
          ))}
        </div>
      )}
    </motion.section>
  );
}

export function ArtistsView({ artists, onPlayArtist, onSelectArtist }: {
  artists: Artist[];
  onPlayArtist: (artist: Artist) => void;
  onSelectArtist: (artist: Artist | null) => void;
}) {
  return (
    <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-black">Kuenstler</h2>
        <p className="text-sm font-bold text-muted">{artists.length} Kuenstler</p>
      </div>

      {artists.length === 0 ? (
        <div className="empty-state">
          <User className="h-11 w-11 text-mint" />
          <h3 className="text-xl font-black">Keine Kuenstler</h3>
          <p className="max-w-sm text-sm leading-6 text-muted">Fuege Musik mit Kuenstler-Informationen hinzu.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {artists.map((artist) => (
            <motion.div
              key={artist.id}
              className="group cursor-pointer"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onSelectArtist(artist)}
            >
              <div className="cover-wrap">
                <img src={coverUrl(artist.topTracks[0])} alt={artist.name} className="cover-art" />
                <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={(e) => { e.stopPropagation(); onPlayArtist(artist); }} className="play-button h-12 w-12">
                    <Play className="h-6 w-6 fill-current" />
                  </button>
                </div>
              </div>
              <p className="mt-2 truncate text-sm font-bold">{artist.name}</p>
              <p className="truncate text-xs text-muted">{artist.albums.length} Alben</p>
            </motion.div>
          ))}
        </div>
      )}
    </motion.section>
  );
}

export function PlaylistsView({ playlists, files, onPlayPlaylist, onCreatePlaylist, onDeletePlaylist, showCreate, newPlaylistName, setNewPlaylistName, onConfirmCreate, onCancel }: {
  playlists: Playlist[];
  files: ApiFile[];
  onPlayPlaylist: (playlist: Playlist) => void;
  onCreatePlaylist: () => void;
  onDeletePlaylist: (id: string) => void;
  showCreate: boolean;
  newPlaylistName: string;
  setNewPlaylistName: (name: string) => void;
  onConfirmCreate: () => void;
  onCancel: () => void;
}) {
  return (
    <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-black">Playlists</h2>
        <button onClick={onCreatePlaylist} className="icon-button bg-mint text-night">
          <Plus className="h-5 w-5" />
        </button>
      </div>

      {showCreate && (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="surface p-4">
          <h3 className="font-black mb-3">Neue Playlist</h3>
          <input
            type="text"
            value={newPlaylistName}
            onChange={(e) => setNewPlaylistName(e.target.value)}
            placeholder="Playlist Name"
            className="touch-input mb-3"
            autoFocus
          />
          <div className="flex gap-2">
            <button onClick={onConfirmCreate} className="primary-button flex-1">
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Erstellen
            </button>
            <button onClick={onCancel} className="icon-button">
              <X className="h-5 w-5" />
            </button>
          </div>
        </motion.div>
      )}

      {playlists.length === 0 && !showCreate ? (
        <div className="empty-state">
          <ListMusic className="h-11 w-11 text-mint" />
          <h3 className="text-xl font-black">Keine Playlists</h3>
          <p className="max-w-sm text-sm leading-6 text-muted">Erstelle deine erste Playlist.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {playlists.map((playlist) => (
            <motion.div
              key={playlist.id}
              className="track-row"
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
            >
              <button onClick={() => onPlayPlaylist(playlist)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                <div className="cover-wrap flex h-14 w-14 shrink-0 items-center justify-center bg-soft">
                  <Music className="h-6 w-6 text-muted" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-bold">{playlist.name}</p>
                  <p className="mt-1 truncate text-xs font-bold text-muted">{playlist.trackIds.length} Tracks</p>
                </div>
              </button>
              <button onClick={() => onDeletePlaylist(playlist.id)} className="track-play">
                <MoreHorizontal className="h-4 w-4" />
              </button>
            </motion.div>
          ))}
        </div>
      )}
    </motion.section>
  );
}

export function DiscoverView({ files, likedIds, onPlay, onLike }: {
  files: ApiFile[];
  likedIds: Set<string>;
  onPlay: (file: ApiFile) => void;
  onLike: (file: ApiFile) => void;
}) {
  const likedFiles = files.filter((f) => likedIds.has(f.id));
  const recentlyAdded = [...files].slice(0, 10);
  const recommendations = files.filter((f) => !likedIds.has(f.id)).slice(0, 10);

  return (
    <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} className="space-y-6">
      <div className="surface p-5">
        <div className="flex items-center gap-2 mb-4">
          <Flame className="h-5 w-5 text-mint" />
          <h2 className="text-xl font-black">Fuer dich</h2>
        </div>
        <p className="text-sm text-muted">Basierend auf deinem Geschmack</p>
      </div>

      {recommendations.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-black">Empfohlen</h3>
          <div className="space-y-2">
            {recommendations.map((file) => (
              <motion.div key={file.id} className="track-row" whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
                <button onClick={() => onPlay(file)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                  <img src={coverUrl(file)} alt="" className="h-12 w-12 rounded-lg object-cover" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold">{file.title}</p>
                    <p className="truncate text-xs text-muted">{file.artist}</p>
                  </div>
                </button>
                <button onClick={() => onLike(file)} className={`track-play ${likedIds.has(file.id) ? 'is-liked' : ''}`}>
                  <Heart className="h-4 w-4" />
                </button>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {likedFiles.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-black">Deine Favoriten</h3>
          <div className="space-y-2">
            {likedFiles.slice(0, 5).map((file) => (
              <motion.div key={file.id} className="track-row" whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
                <button onClick={() => onPlay(file)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                  <img src={coverUrl(file)} alt="" className="h-12 w-12 rounded-lg object-cover" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold">{file.title}</p>
                    <p className="truncate text-xs text-muted">{file.artist}</p>
                  </div>
                </button>
                <button onClick={() => onLike(file)} className="track-play is-liked">
                  <Heart className="h-4 w-4" />
                </button>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </motion.section>
  );
}

export function ChartsView({ charts, onPlay }: {
  charts: ChartItem[];
  onPlay: (file: ApiFile) => void;
}) {
  return (
    <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-mint" />
          <h2 className="text-2xl font-black">Charts</h2>
        </div>
      </div>

      {charts.length === 0 ? (
        <div className="empty-state">
          <TrendingUp className="h-11 w-11 text-mint" />
          <h3 className="text-xl font-black">Keine Charts</h3>
          <p className="max-w-sm text-sm leading-6 text-muted">Fuege Musik hinzu um Charts zu sehen.</p>
        </div>
      ) : (
        <div className="surface p-4">
          <div className="space-y-2">
            {charts.slice(0, 20).map((item) => (
              <motion.div
                key={item.file.id}
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-soft/50 cursor-pointer"
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                onClick={() => onPlay(item.file)}
              >
                <span className={`w-8 text-center font-black ${item.rank <= 3 ? 'text-mint' : 'text-muted'}`}>
                  #{item.rank}
                </span>
                <img src={coverUrl(item.file)} alt="" className="h-12 w-12 rounded-lg object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">{item.file.title}</p>
                  <p className="truncate text-xs text-muted">{item.file.artist}</p>
                </div>
                <span className="text-xs text-muted">{item.plays} plays</span>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </motion.section>
  );
}

export function SettingsView({ settings, sleepTimer, onUpdateSettings, onStartSleepTimer, onCancelSleepTimer }: {
  settings: UserSettings;
  sleepTimer: number;
  onUpdateSettings: (settings: Partial<UserSettings>) => void;
  onStartSleepTimer: (minutes: number) => void;
  onCancelSleepTimer: () => void;
}) {
  const timerOptions = [5, 10, 15, 30, 45, 60, 90];

  return (
    <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} className="space-y-4">
      <h2 className="text-2xl font-black">Einstellungen</h2>

      <div className="surface p-5 space-y-4">
        <h3 className="font-black flex items-center gap-2">
          <MonitorSpeaker className="h-4 w-4" />
          Audio
        </h3>

        <div className="space-y-3">
          <label className="block">
            <p className="text-sm font-bold text-muted mb-2">Qualitaet</p>
            <select
              value={settings.audioQuality}
              onChange={(e) => onUpdateSettings({ audioQuality: e.target.value as UserSettings['audioQuality'] })}
              className="touch-input"
            >
              <option value="low">Low (128kbps)</option>
              <option value="normal">Normal (256kbps)</option>
              <option value="high">High (320kbps)</option>
              <option value="lossless">Lossless (FLAC)</option>
            </select>
          </label>

          <label className="flex items-center justify-between">
            <span className="text-sm font-bold">Normalisieren</span>
            <input
              type="checkbox"
              checked={settings.normalize}
              onChange={(e) => onUpdateSettings({ normalize: e.target.checked })}
              className="h-5 w-5 accent-mint"
            />
          </label>

          <label className="flex items-center justify-between">
            <span className="text-sm font-bold">Autoplay</span>
            <input
              type="checkbox"
              checked={settings.autoplay}
              onChange={(e) => onUpdateSettings({ autoplay: e.target.checked })}
              className="h-5 w-5 accent-mint"
            />
          </label>
        </div>
      </div>

      <div className="surface p-5 space-y-4">
        <h3 className="font-black flex items-center gap-2">
          <Timer className="h-4 w-4" />
          Sleep Timer
        </h3>

        {sleepTimer > 0 ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock8 className="h-5 w-5 text-mint" />
              <span className="font-black">{formatDuration(sleepTimer)}</span>
            </div>
            <button onClick={onCancelSleepTimer} className="icon-button text-coral border-coral">
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {timerOptions.map((mins) => (
              <button
                key={mins}
                onClick={() => onStartSleepTimer(mins)}
                className="px-3 py-2 rounded-lg bg-soft text-sm font-bold"
              >
                {mins}m
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="surface p-5">
        <h3 className="font-black flex items-center gap-2">
          <Sliders className="h-4 w-4" />
          Wiedergabe
        </h3>

        <div className="mt-3 space-y-3">
          <label className="block">
            <p className="text-sm font-bold text-muted mb-2">Crossfade</p>
            <input
              type="range"
              min="0"
              max="12"
              value={settings.crossfade}
              onChange={(e) => onUpdateSettings({ crossfade: Number(e.target.value) })}
              className="seek-slider"
            />
            <p className="text-xs text-muted">{settings.crossfade === 0 ? 'Aus' : `${settings.crossfade}s`}</p>
          </label>
        </div>
      </div>
    </motion.section>
  );
}

function trackMeta(file: ApiFile) {
  const artist = file.artist?.trim();
  const album = file.album?.trim();
  const type = file.kind === 'audio' ? 'Audio' : 'Video';
  const duration = file.durationLabel ? `${file.durationLabel} - ` : '';

  if (artist && album) return `${artist} - ${album} - ${duration}${file.sizeLabel}`;
  if (artist) return `${artist} - ${duration}${file.sizeLabel}`;
  return `${type} - ${duration}${file.sizeLabel}`;
}

export function ShareView({ userProfile, shareCode, files, onGenerateCode, onTogglePublic, onCopyLink }: {
  userProfile: UserProfile | null;
  shareCode: string;
  files: ApiFile[];
  onGenerateCode: () => void;
  onTogglePublic: () => void;
  onCopyLink: () => void;
}) {
  const isPublic = userProfile?.isPublic ?? false;
  const topTracks = userProfile?.topTracks?.map((id) => files.find((f) => f.id === id)).filter(Boolean) || [];

  return (
    <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} className="space-y-4">
      <h2 className="text-2xl font-black">Musik teilen</h2>

      <div className="surface p-5">
        {!shareCode ? (
          <div className="text-center">
            <p className="text-muted mb-4">Erstelle einen öffentlichen Link, damit andere deine Musik sehen und hören können.</p>
            <button onClick={onGenerateCode} className="primary-button">
              <Globe className="h-5 w-5 mr-2" />
              Oeffentliches Profil erstellen
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="cover-wrap h-16 w-16">
                  <img src={coverUrl(files[0])} alt="" className="cover-art" />
                </div>
                <div>
                  <p className="font-black">{userProfile?.displayName || 'Mein Profil'}</p>
                  <p className="text-sm text-muted">#{shareCode}</p>
                </div>
              </div>
              <button
                onClick={onTogglePublic}
                className={`icon-button ${isPublic ? 'bg-mint text-night' : ''}`}
              >
                {isPublic ? <Globe className="h-5 w-5" /> : <Lock className="h-5 w-5" />}
              </button>
            </div>

            {isPublic && (
              <>
                <div className="mt-4">
                  <label className="text-sm font-bold text-muted mb-2 block">Dein Link</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      readOnly
                      value={`${typeof window !== 'undefined' ? window.location.origin : ''}/p/${shareCode}`}
                      className="touch-input flex-1"
                    />
                    <button onClick={onCopyLink} className="icon-button">
                      <Copy className="h-5 w-5" />
                    </button>
                  </div>
                </div>

                <div className="mt-4 p-3 rounded-lg bg-soft/50">
                  <p className="text-sm text-muted">Teile diesen Link - jeder kann deine Musik sehen und streamen:</p>
                  <p className="font-mono text-mint mt-1">{typeof window !== 'undefined' ? window.location.origin : ''}/p/{shareCode}</p>
                </div>
              </>
            )}

            {topTracks.length > 0 && (
              <div className="mt-4">
                <h3 className="font-bold text-sm text-muted mb-2">Deine Top Tracks</h3>
                <div className="space-y-2">
                  {topTracks.slice(0, 5).map((file: ApiFile | boolean) => file && (
                    <div key={file.id} className="flex items-center gap-2">
                      <img src={coverUrl(file)} alt="" className="h-8 w-8 rounded" />
                      <p className="truncate text-sm">{file.title}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="surface p-5">
        <h3 className="font-black mb-3">Was andere sehen</h3>
        <ul className="space-y-2 text-sm text-muted">
          <li className="flex items-center gap-2">
            <User className="h-4 w-4" />
            Dein Profil-Name
          </li>
          <li className="flex items-center gap-2">
            <Music className="h-4 w-4" />
            Deine Top 10 Tracks
          </li>
          <li className="flex items-center gap-2">
            <Heart className="h-4 w-4" />
            Anzahl Likes
          </li>
        </ul>
      </div>
    </motion.section>
  );
}

export function PublicRoomsView({ sharedRooms, files, onPlay }: {
  sharedRooms: SharedRoom[];
  files: ApiFile[];
  onPlay: (file: ApiFile) => void;
}) {
  return (
    <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} className="space-y-4">
      <div className="flex items-center gap-2">
        <Globe className="h-5 w-5 text-mint" />
        <h2 className="text-2xl font-black">Oeffentliche Profile</h2>
      </div>

      {sharedRooms.length === 0 ? (
        <div className="empty-state">
          <Globe className="h-11 w-11 text-mint" />
          <h3 className="text-xl font-black">Keine oeffentlichen Profile</h3>
          <p className="max-w-sm text-sm leading-6 text-muted">Erstelle zuerst dein eigenes oeffentliches Profil um gefunden zu werden.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {sharedRooms.map((room) => {
            const tracks = room.trackIds.map((id) => files.find((f) => f.id === id)).filter(Boolean);
            return (
              <motion.div
                key={room.id}
                className="track-row"
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
              >
                <button onClick={() => tracks[0] && onPlay(tracks[0])} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                  <div className="cover-wrap h-12 w-12">
                    <img src={coverUrl(tracks[0] as ApiFile)} alt="" className="cover-art" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold">{room.displayName}</p>
                    <p className="truncate text-xs text-muted">{room.trackIds.length} Tracks • {room.followerCount} Follower</p>
                  </div>
                </button>
                <button className="icon-button">
                  <UserPlus className="h-4 w-4" />
                </button>
              </motion.div>
            );
          })}
        </div>
      )}
    </motion.section>
  );
}`;