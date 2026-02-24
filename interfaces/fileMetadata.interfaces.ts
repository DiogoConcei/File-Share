export interface FileMetadata {
  fileId: string;
  name: string;
  ext: string;
  path: string;
  hash: string;
  size: number;
  privacy: 'public' | 'private';
  isDownloaded: 'not_downloaded' | 'downloaded' | 'downloading';
  isSync: 'synchronized' | 'synchronizing' | 'unsynchronized';
}

export interface FilePackage {
  fileid: string;
  name: string;
  ext: string;
  hash: string;
}

export interface DiffData {
  inPeer: FileMetadata[];
  inServer: FileMetadata[];
  sync: FileMetadata[];
}
