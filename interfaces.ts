export interface FileMetadata {
  fileId: string;
  name: string;
  ext: string;
  path: string;
  hash: string;
  size: number;
  privacy: "public" | "private";
  isDownloaded: "not_downloaded" | "downloaded" | "downloading";
  isSync: "synchronized" | "synchronizing" | "unsynchronized";
}

export interface PeerInfo {
  id: string;
  address: string;
  port: string;
  lastSeen: number;
}

export interface DiffData {
  inPeer: FileMetadata[];
  inServer: FileMetadata[];
  sync: FileMetadata[];
}
