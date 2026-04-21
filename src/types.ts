export interface ApiFile {
  id: string;
  name: string;
  title: string;
  artist?: string;
  album?: string;
  kind: 'audio' | 'video';
  mimeType: string;
  size: number;
  sizeLabel: string;
  duration?: number;
  durationLabel?: string;
  hasArtwork: boolean;
  modifiedAt: string;
  externalCoverUrl?: string;
}

export interface Album {
  id: string;
  name: string;
  artist?: string;
  tracks: ApiFile[];
  coverUrl?: string;
  year?: number;
  trackCount: number;
}

export interface Artist {
  id: string;
  name: string;
  albums: Album[];
  topTracks: ApiFile[];
  bio?: string;
  coverUrl?: string;
}

export interface Playlist {
  id: string;
  name: string;
  description?: string;
  trackIds: string[];
  createdAt: string;
  updatedAt: string;
  isPublic: boolean;
  coverUrl?: string;
  createdBy?: string;
}

export interface ChartItem {
  rank: number;
  file: ApiFile;
  plays: number;
  trend: 'up' | 'down' | 'stable';
}

export interface ApiStatus {
  roomName: string;
  host: string;
  maxPeers: number;
  mediaPath: string;
  dataPath: string;
  livePeers: number;
}

export interface QueueItem {
  id: string;
  fileId: string;
  addedAt: string;
  file: ApiFile;
}

export interface RoomState {
  likedIds: string[];
  queue: QueueItem[];
  playlists: Playlist[];
  updatedAt: string;
}

export interface UserSettings {
  audioQuality: 'low' | 'normal' | 'high' | 'lossless';
  sleepTimer: number;
  autoplay: boolean;
  crossfade: number;
  normalize: boolean;
}

export interface UploadState {
  active: boolean;
  progress: number;
  message: string;
}

export interface UserProfile {
  id: string;
  displayName: string;
  bio?: string;
  topTracks: string[];
  avatarUrl?: string;
  isPublic: boolean;
  shareCode: string;
  createdAt: string;
}

export interface SharedRoom {
  id: string;
  displayName: string;
  bio?: string;
  trackIds: string[];
  likedCount: number;
  followerCount: number;
  createdAt: string;
}

export interface InviteTicket {
  id: string;
  code: string;
  role: 'admin' | 'member';
  maxUses: number;
  usedCount: number;
  expiresAt?: string;
  createdAt: string;
  createdBy: string;
}

export interface AuthUser {
  id: string;
  username: string;
  role: 'admin' | 'member';
  twoFactorEnabled: boolean;
}

export interface LoginResponse {
  token: string;
  user: AuthUser;
  error?: string;
}

export interface InviteAPI {
  id: string;
  code: string;
  role: 'admin' | 'member';
  maxUses: number;
  usedCount: number;
  usedBy: string[];
  expiresAt?: string;
  createdAt: string;
  createdBy: string;
}

export type NavTab = 'home' | 'search' | 'library' | 'profile' | 'liked';

export type View =
  | 'home' | 'search' | 'library' | 'profile'
  | 'queue' | 'albums' | 'artists' | 'playlists' | 'discover' | 'charts'
  | 'settings' | 'upload' | 'room' | 'share' | 'public'
  | 'login' | 'register' | 'admin' | 'team'
  | 'album-detail' | 'artist-detail' | 'playlist-detail' | 'liked';