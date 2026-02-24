import dgram from 'dgram';
import { PeerInfo, PeerIdentity, PeerMsg } from '../interfaces/peer.interfaces';
import { EventEmitter } from 'events';

export default class DiscoveryService extends EventEmitter {
  private readonly multicastGroup = '239.255.0.1';
  private readonly discoveryPort: number;
  private readonly httpPort: number;
  private readonly identity: PeerIdentity;

  private readonly socket = dgram.createSocket({
    type: 'udp4',
    reuseAddr: true,
  });

  private announceTimer?: NodeJS.Timeout;

  constructor(discoveryPort: number, httpPort: number, identity: PeerIdentity) {
    super();
    this.identity = identity;
    this.httpPort = httpPort;
    this.discoveryPort = discoveryPort;
    this.setupSocket();
  }

  private setupSocket() {
    this.socket.on('listening', () => {
      this.socket.addMembership(this.multicastGroup);
      this.socket.setMulticastTTL(1);

      this.emit('ready', this.identity.peerId);
    });

    this.socket.on('message', (msg, rinfo) => {
      this.handleMessage(msg, rinfo);
    });

    this.socket.on('error', (err) => {
      this.emit('error', err);
    });
  }

  start() {
    this.socket.bind(this.discoveryPort);

    this.announceTimer = setInterval(() => {
      this.announce();
    }, 1000 * 5);
  }

  stop() {
    if (this.announceTimer) clearInterval(this.announceTimer);
    this.socket.close();
  }

  private announce() {
    const payload = Buffer.from(
      JSON.stringify({
        type: 'ANNOUNCE',
        peerId: this.identity.peerId,
        name: this.identity.displayName,
        port: this.httpPort,
        timeStamp: Date.now(),
      }),
    );

    this.socket.send(payload, this.discoveryPort, this.multicastGroup);
  }

  private handleMessage(msg: Buffer, rinfo: dgram.RemoteInfo) {
    let data: PeerMsg;

    try {
      data = JSON.parse(msg.toString());
    } catch {
      return;
    }

    if (!data || data.type !== 'ANNOUNCE') return;

    if (data.peerId === this.identity.peerId) return;

    const peer: PeerInfo = {
      id: data.peerId,
      displayName: data.name,
      address: rinfo.address,
      port: data.port,
      lastSeen: Date.now(),
    };

    this.emit('peer:seen', peer);
  }
}
