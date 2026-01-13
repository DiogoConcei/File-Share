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
  const port = Number(process.env.PORT || 8080);

  const identity = await IdentityManager.loadOrCreate();

  // const fileCatalog = new FileCatalog();
  // await fileCatalog.start();

  // As rotas precisam ser modificadas para corresponder a cada peer
  // const dataFile = path.resolve(__dirname, "json", "files-metadata.json");
  // const fileApi = new FileHttpApi(port, dataFile);
  // fileApi.start();

  // const syncManager = new SyncManager(identity.peerId);
  // syncManager.start();

  const discovery = new DiscoveryService(port, identity);
  // acho que está faltando discovery.start()

  // discovery.on("peer:seen", (peer) => {
  //   syncManager.emit("peer:seen", peer);
  // });

  // Não acho que esse tipo de chamda é necessária, é tipo ativar a mesma lampada duas vezes
  // fileCatalog.on("file:added", (meta) => {
  //   syncManager.emit("file:added", meta);
  // });

  // syncManager.on("peer:discovered", async (peer) => {
  //   try {
  //     console.log("Peer descoberto, sincronizando:", peer);
  //     const api = new PeerApi(peer.address, peer.port);
  //     const diff = await api.compareFiles();

  //     for (const f of diff.inPeer) {
  //       console.log("Baixando arquivo do peer:", f.fileId);
  //       await api.peerSync(f);
  //     }
  //   } catch (err) {
  //     console.error("Erro durante sync com peer:", err);
  //   }
  // });

  discovery.start();

  console.log(`App P2P iniciada. HTTP em http://localhost:${port}`);
}

main().catch((err) => {
  console.error("Erro ao iniciar app:", err);
  process.exit(1);
});
