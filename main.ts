import IdentityManager from "./IdentityManager";
import FileCatalog from "./FileCatalog";
import FileHttpApi from "./FileHttpApi";
import SyncManager from "./SyncManager";
import DiscoveryService from "./DiscoveryService";
import PeerApi from "./PeerApi";

import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: "./.env" });

async function main() {
  const httpPort = Number(process.env.HTTP_PORT);
  const discoveryPort = Number(process.env.DISCOVERY_PORT);

  const identity = await IdentityManager.loadOrCreate();

  const fileCatalog = new FileCatalog();
  await fileCatalog.start();

  const dataFile = path.resolve(__dirname, "json", "files-metadata.json");
  const fileApi = new FileHttpApi(httpPort, dataFile);
  fileApi.start();

  const syncManager = new SyncManager();
  syncManager.start();

  const discovery = new DiscoveryService(discoveryPort, httpPort, identity);

  discovery.on("peer:seen", (peer) => {
    syncManager.emit("peer:seen", peer);
  });

  fileCatalog.on("file:added", (meta) => {
    syncManager.emit("file:added", meta);
  });

  syncManager.on("peer:discovered", async (peer) => {
    console.log(`Informações do peer detectado: `, peer);
  });

  syncManager.on("file:queued:toSend", async ({ peerId, fileMeta }) => {
    const peer = syncManager.getPeer(peerId);

    if (!peer) {
      throw new Error(`Peer com id ${peerId} nao encontrado!`);
    }

    console.log(`Informações do arquivo: `);
    console.log(`Informações do peer: `, peer);
    console.log(`Metadata do arquivo: `, fileMeta);

    const address = peer.sync.lastAddress;
    const port = peer.sync.port;
    const api = new PeerApi(address, port);

    // try {
    //   await api.sendFile(fileMeta);

    //   await syncManager.withWriteLock(async () => {
    //     const data = await syncManager.loadSyncData();
    //     data.peers[peerId].queue.toSend = data.peers[
    //       peerId
    //     ].queue.toSend.filter((f: any) => f.fileId !== fileMeta.fileId);
    //     await syncManager.persistSyncData(data);
    //   });
    // } catch (e) {
    //   console.error("Falha ao enviar: ", fileMeta.id);
    // }
  });

  discovery.start();
}

main();
