import IdentityManager from './IdentityManager';
import Catalog from './providers/CatalogProvider';
import FileHttpApi from './FileHttpApi';
import SyncManager from './SyncManager';
import DiscoveryService from './services/DiscoveryService';
import PeerApi from './PeerApi';
import { AddedEvent } from './interfaces/event.interfaces';

import dotenv from 'dotenv';
import { DataPackage } from './interfaces/dataPackage.interface';

dotenv.config({ path: './.env' });

async function main() {
  const httpPort = Number(process.env['HTTP_PORT']);
  const discoveryPort = Number(process.env['DISCOVERY_PORT']);

  const identity = await IdentityManager.loadOrCreate();

  await Catalog.start();

  const fileApi = new FileHttpApi(httpPort);
  fileApi.start();

  const syncManager = new SyncManager();
  syncManager.start();

  const discovery = new DiscoveryService(discoveryPort, httpPort, identity);

  discovery.on('peer:seen', (peer) => {
    syncManager.emit('peer:seen', peer);
  });

  Catalog.on('node:added', ({ data, origin }: AddedEvent) => {
    if (origin === 'network') return;

    syncManager.emit('node:added', data);
  });

  syncManager.on('peer:discovered', async (peer) => {
    console.log(`Informações do peer detectado: `, peer);
  });

  syncManager.on(
    'node:queued:toSend',
    async ({ peerId, dataNode }: { peerId: string; dataNode: DataPackage }) => {
      const peer = syncManager.getPeer(peerId);

      if (!peer) {
        throw new Error(`Peer com id ${peerId} nao encontrado!`);
      }

      const address = peer.sync.lastAddress;
      const port = peer.sync.port;
      const api = new PeerApi(address, port);

      try {
        if (dataNode.type == 'file') {
          await api.sendFile(dataNode);
        } else {
          await api.sendDir(dataNode);
        }

        await syncManager.withWriteLock(async () => {
          const data = await syncManager.loadSyncData();
          const peerData = data.peers[peerId];

          if (!peerData) {
            console.warn(
              `Dados de sincronização para o peer ${peerId} não encontrados.`,
            );
            return;
          }

          peerData.queue.toSend = peerData.queue.toSend.filter(
            (file: DataPackage) => file.id !== dataNode.id,
          );

          await syncManager.persistSyncData(data);
          const isSave = await Catalog.syncRegister(dataNode);

          if (!isSave) throw new Error(`Falha em persistir dados`);
        });
      } catch (error) {
        console.error(`[ERROR] Falha ao enviar o arquivo: ${dataNode.id}`);
        console.error(`[ERROR] ${String(error)}`);
      }
    },
  );

  discovery.start();
}

main();
