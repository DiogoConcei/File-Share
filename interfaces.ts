// src/interfaces.ts
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

export interface PeerMsg {
  type: string;
  peerId: string;
  port: number;
  name: string;
  timeStamp: number;
}

export interface DiffData {
  inPeer: FileMetadata[];
  inServer: FileMetadata[];
  sync: FileMetadata[];
}

export interface PeerIdentity {
  peerId: string;
  displayName: string;
  createdAt: string;
}

export interface PeerState {
  info: PeerInfo; // volátil
  sync: PeerSyncPersist; // persistente (nome 'sync' para casar com SyncManager)
}

export interface PeerInfo {
  id: string;
  displayName: string;
  address: string;
  port: number; // padronizado para number
  lastSeen: number;
}

export interface PeerSyncPersist {
  id: string;
  displayName: string;
  lastAddress: string;
  port: number;
  lastSeen: number;
  queue: {
    toSend: any[];
    toDelete: any[];
    toRequest: any[];
  };
}
