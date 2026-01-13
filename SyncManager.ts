import {
  FileMetadata,
  PeerInfo,
  PeerState,
  PeerIdentity,
  PeerSyncPersist,
} from "./interfaces";
import { EventEmitter } from "events";
import os from "os";
import path from "path";
import fse from "fs-extra";

export default class SyncManager extends EventEmitter {
  private readonly syncData = path.resolve(
    __dirname,
    "json",
    "sync-metadata.json"
  );
  private readonly peers = new Map<string, PeerState>();
  private readonly peerId: string;

  constructor(peerId: string) {
    super();
    this.peerId = peerId;
  }

  start() {
    this.on("peer:seen", (peer: PeerInfo) => {
      this.peerSeen(peer);
    });

    this.on("peer:discovered", () => {});

    this.on("file:added", (fileMeta: FileMetadata) => {
      this.toSync(fileMeta);
    });
  }

  private peerSeen(peer: PeerInfo) {
    const exist = this.peers.get(peer.id);

    if (!exist) {
      this.addPeer(peer).catch((err) => {
        console.error("Erro ao adicionar peer:", err);
      });
    } else {
      this.updatePeerInfo(peer);
    }
  }

  private async addPeer(peer: PeerInfo) {
    const syncState = await this.loadSyncData();

    let persisted: PeerSyncPersist | undefined = syncState.peers[peer.id];

    if (!persisted) {
      persisted = {
        id: peer.id,
        displayName: os.hostname(),
        lastAddress: peer.address,
        port: peer.port,
        lastSeen: Date.now(),
        queue: {
          toSend: [],
          toDelete: [],
          toRequest: [],
        },
      };

      syncState.peers[peer.id] = persisted;
    } else {
      persisted.lastAddress = peer.address;
      persisted.port = peer.port;
      persisted.lastSeen = Date.now();
    }

    await this.persistSyncData(syncState);

    const state: PeerState = {
      info: {
        ...peer,
        lastSeen: Date.now(),
      },
      sync: persisted,
    };

    this.peers.set(peer.id, state);

    this.emit("peer:discovered", peer);
  }

  private async loadSyncData(): Promise<{ peers: Record<string, any> }> {
    try {
      if (!(await fse.pathExists(this.syncData))) {
        return { peers: {} };
      }

      const data = await fse.readJson(this.syncData);
      // garantia mínima de forma
      return {
        peers: data && data.peers ? data.peers : {},
      };
    } catch (err) {
      // em caso de erro, logue e retorne estrutura vazia para não travar o fluxo
      console.error("Falha ao ler sync-metadata:", err);
      return { peers: {} };
    }
  }

  private async persistSyncData(data: { peers: Record<string, any> }) {
    const tmp = this.syncData + ".tmp";
    await fse.writeJson(tmp, data, { spaces: 2 });
    await fse.move(tmp, this.syncData, { overwrite: true });
  }

  private updatePeerInfo(peer: PeerInfo) {
    const state = this.peers.get(peer.id);
    if (!state) return;

    state.info = {
      ...state.info,
      address: peer.address,
      port: peer.port,
      lastSeen: Date.now(),
    };
  }

  private toSync(fileMeta: FileMetadata) {
    console.log(
      "Arquivo adicionado localmente, decidir estratégia de sync:",
      fileMeta.fileId
    );
  }

  stop() {}
}
