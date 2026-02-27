export interface DirMetadata {
  id: string;
  name: string;
  parentId: string;
  childId: string[];
  hash: string;
  size: number;
  privacy: 'public' | 'private';
  isDownloaded: 'not_downloaded' | 'downloaded' | 'downloading';
  isSync: 'synchronized' | 'synchronizing' | 'unsynchronized';
  origin?: 'local' | 'network';
  type: 'dir';
}
