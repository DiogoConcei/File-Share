export interface FileMetadata {
  id: string;
  name: string;
  ext: string;
  parentId: string;
  hash: string;
  size: number;
  privacy: 'public' | 'private';
  isDownloaded: 'not_downloaded' | 'downloaded' | 'downloading';
  isSync: 'synchronized' | 'synchronizing' | 'unsynchronized';
  origin?: 'local' | 'network';
  type: 'file';
}

export interface FilePackage {
  parentId: string;
  id: string;
  name: string;
  ext: string;
  hash: string;
  privacy: 'public' | 'private';
}

export interface DiffData {
  inPeer: FileMetadata[];
  inServer: FileMetadata[];
  sync: FileMetadata[];
}
