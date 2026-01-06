import dgram from "dgram";
import { EventEmitter } from "events";
import crypto from "crypto";

type PeerInfo = {
  id: string;
  address: string;
  port: string;
  lastSeen: number;
};

export default class DiscoveryService extends EventEmitter {
  private readonly multicastGroup = "239.255.0.1";
  private readonly port: number;
  private readonly peerId = crypto.randomUUID();

  private readonly socket = dgram.createSocket({
    type: "udp4",
    reuseAddr: true,
  });

  private readonly peers = new Map<string, PeerInfo>();
  private announceTimer?: NodeJS.Timeout;

  constructor(port: number) {
    super();
    this.port = port;
    this.setupSocket();
  }

  private setupSocket() {
    this.socket.on("listening", () => {
      this.socket.addMembership(this.multicastGroup);
      this.socket.setMulticastTTL(1);

      this.emit("ready", this.peerId);
    });

    this.socket.on("message", (msg, rinfo) => {
      this.handleMessage(msg, rinfo);
    });

    this.socket.on("error", (err) => {
      this.emit("error", err);
    });
  }

  start() {
    this.socket.bind(this.port);

    this.announceTimer = setInterval(() => {
      this.announce();
    }, 5000);
  }

  stop() {
    if (this.announceTimer) clearInterval(this.announceTimer);
    this.socket.close();
  }

  private announce() {
    const payload = Buffer.from(
      JSON.stringify({
        type: "ANNOUNCE",
        peerId: this.peerId,
        port: this.port,
        timestamp: Date.now(),
      })
    );

    this.socket.send(payload, this.port, this.multicastGroup);
  }

  private handleMessage(msg: Buffer, rinfo: dgram.RemoteInfo) {
    const data = JSON.parse(msg.toString());

    if (data.peerId === this.peerId) return;

    const peer: PeerInfo = {
      id: data.peerId,
      address: rinfo.address,
      port: data.port,
      lastSeen: Date.now(),
    };

    const isNew = !this.peers.has(peer.id);
    this.peers.set(peer.id, peer);

    if (isNew) {
      this.emit("peer:discovered", peer);
    }
  }
}
