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
    console.log(`peer encontrado: `, peer);
    syncManager.emit("peer:seen", peer);
  });

  discovery.start();
}

main();
