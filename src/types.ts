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
  updatedAt: string;
}

export interface UploadState {
  active: boolean;
  progress: number;
  message: string;
}

export type View = 'library' | 'queue' | 'upload' | 'room';
