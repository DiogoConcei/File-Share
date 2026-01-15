// src/app.ts
import dotenv from "dotenv";
import path from "path";
import IdentityManager from "./IdentityManager";
import DiscoveryService from "./DiscoveryService";
import FileCatalog from "./FileCatalog";
import FileHttpApi from "./FileHttpApi";
import SyncManager from "./SyncManager";
import PeerApi from "./PeerApi";

dotenv.config({ path: "./.env" });

async function main() {
  const httpPort = Number(process.env.HTTP_PORT);
  const discoveryPort = Number(process.env.DISCOVERY_PORT);

  const identity = await IdentityManager.loadOrCreate();

  // Iniciar o watcher e o index
  const fileCatalog = new FileCatalog();
  await fileCatalog.start();

  // As rotas precisam ser modificadas para corresponder a cada peer
  const dataFile = path.resolve(__dirname, "json", "files-metadata.json");
  const fileApi = new FileHttpApi(httpPort, dataFile);
  fileApi.start();

  const syncManager = new SyncManager(httpPort);
  syncManager.start();

  const discovery = new DiscoveryService(discoveryPort, identity);

  discovery.on("peer:seen", (peer) => {
    syncManager.emit("peer:seen", peer);
  });

  // Não acho que esse tipo de chamda é necessária, é tipo ativar a mesma lampada duas vezes
  // Tenho que verificar isso aqui
  fileCatalog.on("file:added", (meta) => {
    syncManager.emit("file:added", meta);
  });

  syncManager.on("peer:discovered", async (peer) => {
    syncManager.emit("peer:start-queue", peer);
  });

  syncManager.on("file:queued:toSend", async ({ peerId, fileMeta }) => {
    const peer = syncManager.getPeer(peerId);
    console.log("[APP] recebido file:queued:toSend", peerId, fileMeta.fileId);

    if (!peer) return;

    const api = new PeerApi(peer.sync.lastAddress, peer.sync.port);

    await api.requestFile(fileMeta);
  });

  discovery.start();

  console.log(`App P2P iniciada. HTTP em http://localhost:${httpPort}`);
}

main().catch((err) => {
  console.error("Erro ao iniciar app:", err);
  process.exit(1);
});
