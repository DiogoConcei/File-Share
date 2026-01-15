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

  // ... dentro de main(), onde você já tem fileCatalog e syncManager:

  // quando um peer é detectado, peça a lista de arquivos e baixe os que faltam
  syncManager.on("peer:start-queue", async (peer) => {
    // certifique-se que 'peer' tem .address e .port (consistência com DiscoveryService)
    const address =
      peer.address || peer.info?.address || peer.sync?.lastAddress;
    const port = peer.port || peer.info?.port;

    if (!address || !port) {
      console.warn("[APP] peer sem endereço/porta válidos", peer);
      return;
    }

    const api = new PeerApi(address, 3000);

    try {
      const peerFiles = await api.fetchPeerFiles(); // lista do peer remoto
      const localFiles = await fileCatalog.fetchServerFiles(); // lista local

      const localIds = new Set(localFiles.map((f) => f.fileId));

      for (const f of peerFiles) {
        if (!localIds.has(f.fileId)) {
          console.log(
            `[APP] solicitando download do arquivo ${f.fileId} de ${address}:${port}`
          );
          try {
            await api.requestFile(f);
          } catch (err) {
            console.error("[APP] falha ao baixar arquivo:", f.fileId, err);
          }
        }
      }
    } catch (e) {
      console.error("[APP] erro durante sincronização com peer", e);
    }
  });
  discovery.start();

  console.log(`App P2P iniciada. HTTP em http://localhost:${httpPort}`);
}

main().catch((err) => {
  console.error("Erro ao iniciar app:", err);
  process.exit(1);
});
