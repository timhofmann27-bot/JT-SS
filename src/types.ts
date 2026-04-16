export interface FileEntry {
  id: string;
  name: string;
  type: 'mp3' | 'mp4';
  size: string;
  date: string;
}

export interface Group {
  id: string;
  name: string;
  status: 'Verschlüsselt' | 'Offen';
  members: number;
}

export type View = 'login' | 'dashboard' | 'groups';
