import {
  FileMetadata,
  PeerInfo,
  PeerState,
  PeerSyncPersist,
} from "./interfaces";
import { EventEmitter } from "events";
import path from "path";
import fse from "fs-extra";

enum Priority {
  HIGH = 0,
  MEDIUM = 1,
  LOW = 2,
}

type Task = () => Promise<void>;

export default class SyncManager extends EventEmitter {
  private readonly syncData = path.resolve(
    __dirname,
    "json",
    "sync-metadata.json",
  );
  private readonly peers = new Map<string, PeerState>();

  private announceTimer?: NodeJS.Timeout;
  queues: Record<Priority, Task[]> = {
    [Priority.HIGH]: [],
    [Priority.MEDIUM]: [],
    [Priority.LOW]: [],
  };

  // Mantém o estado em memória
  private syncState: { peers: Record<string, PeerSyncPersist> } = { peers: {} };
  private running = false;
  private writeLock: Promise<void> = Promise.resolve();

  constructor() {
    super();
  }

  async start() {
    // Eventos de peers e arquivos
    this.on("peer:seen", (peer: PeerInfo) => this.peerSeen(peer));
    this.on("file:added", (fileMeta: FileMetadata) => this.toSend(fileMeta));

    this.announceTimer = setInterval(() => this.checkPeer(), 1000 * 5);

    // Carrega o estado do disco para memória
    this.syncState = await this.loadSyncData();
  }

  stop() {
    if (this.announceTimer) clearInterval(this.announceTimer);
  }

  private async run() {
    this.running = true;

    while (true) {
      const task =
        this.queues[Priority.HIGH].shift() ||
        this.queues[Priority.MEDIUM].shift() ||
        this.queues[Priority.LOW].shift();

      if (!task) break;

      try {
        await task();
      } catch (e) {
        console.error("Erro na lista de tarefas: ", e);
      }
    }

    this.running = false;
  }

  private async enqueue(task: Task, priority: Priority) {
    this.queues[priority].push(task);
    if (!this.running) this.run();
  }

  private checkPeer() {
    const now = Date.now();
    for (const [peerId, peer] of this.peers) {
      if (now - peer.info.lastSeen > 1000 * 15) {
        this.peers.delete(peerId);
        this.emit("peer:disconnected", peerId);
      }
    }
  }

  private peerSeen(peer: PeerInfo) {
    const existing = this.peers.get(peer.id);
    if (!existing) {
      this.addPeer(peer).catch((err) =>
        console.error("Erro ao adicionar peer:", err),
      );
    } else {
      this.updatePeerInfo(peer);
    }
  }

  private async addPeer(peer: PeerInfo) {
    await this.withWriteLock(async () => {
      let persisted = this.syncState.peers[peer.id];

      if (!persisted) {
        persisted = {
          id: peer.id,
          displayName: peer.displayName,
          lastAddress: peer.address,
          port: peer.port,
          lastSeen: Date.now(),
          queue: { toSend: [], toDelete: [], toRequest: [] },
        };
        this.syncState.peers[peer.id] = persisted;
      } else {
        persisted.lastAddress = peer.address;
        persisted.port = peer.port;
        persisted.lastSeen = Date.now();
      }

      await this.persistSyncData(this.syncState);

      const state: PeerState = {
        info: { ...peer, lastSeen: Date.now() },
        sync: persisted,
      };

      this.peers.set(peer.id, state);
      this.emit("peer:discovered", peer);
    });
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

  // Agendamento de envio de arquivos
  private async toSend(fileMeta: FileMetadata) {
    const toEnqueue: Array<{ peerId: string; fileMeta: FileMetadata }> = [];

    await this.withWriteLock(async () => {
      for (const [peerId, peerState] of this.peers) {
        const persisted = this.syncState.peers[peerId];
        if (!persisted) continue;

        persisted.queue.toSend.push(fileMeta);
        peerState.sync.queue.toSend.push(fileMeta);

        toEnqueue.push({ peerId, fileMeta });
      }

      await this.persistSyncData(this.syncState);
    });

    for (const job of toEnqueue) {
      this.enqueue(async () => {
        this.emit("file:queued:toSend", job);
      }, Priority.HIGH);
    }
  }

  // Lock para escrita atômica
  public async withWriteLock<T>(fn: () => Promise<T>): Promise<T> {
    let release!: () => void;
    const next = new Promise<void>((r) => (release = r));

    const prev = this.writeLock;
    this.writeLock = this.writeLock.then(() => next);

    await prev;
    try {
      return await fn();
    } finally {
      release();
    }
  }

  public async loadSyncData(): Promise<{
    peers: Record<string, PeerSyncPersist>;
  }> {
    try {
      if (!(await fse.pathExists(this.syncData))) return { peers: {} };

      const data = await fse.readJson(this.syncData);
      return { peers: data?.peers ?? {} };
    } catch (err) {
      console.error("Falha ao ler sync-metadata:", err);
      return { peers: {} };
    }
  }

  public async persistSyncData(data: {
    peers: Record<string, PeerSyncPersist>;
  }) {
    const dir = path.dirname(this.syncData);
    await fse.ensureDir(dir); // 🔹 garante que 'json/' exista

    const tmp = this.syncData + ".tmp";
    await fse.writeJson(tmp, data, { spaces: 2 });
    await fse.move(tmp, this.syncData, { overwrite: true });
  }

  public getPeer(peerId: string): PeerState | undefined {
    return this.peers.get(peerId);
  }
}
