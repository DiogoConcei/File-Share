import { DataPackage } from './dataPackage.interface';

export interface PeerIdentity {
  peerId: string;
  displayName: string;
  createdAt: string;
}

export interface PeerState {
  info: PeerInfo;
  sync: PeerSyncPersist;
}

export interface PeerInfo {
  id: string;
  displayName: string;
  address: string;
  port: number;
  lastSeen: number;
}

export interface PeerSyncPersist {
  id: string;
  displayName: string;
  lastAddress: string;
  port: number;
  lastSeen: number;
  queue: {
    toSend: DataPackage[];
    toDelete: DataPackage[];
    toRequest: DataPackage[];
  };
}

export interface PeerMsg {
  type: string;
  peerId: string;
  port: number;
  name: string;
  timeStamp: number;
}
