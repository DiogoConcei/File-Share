import dotenv from "dotenv";
import { modelFile, PeerInfo } from "./interfaces";

import DiscoveryService from "./DiscoveryService";
import FileHttpApi from "./FileHttpApi";
import PeerApi from "./PeerApi";

dotenv.config({ path: "./.env" });
const port = Number(process.env.PORT);

const discovery = new DiscoveryService(port);
const httpApi = new FileHttpApi(port, "./json/dataTeste.json");
const peerApi = new PeerApi();

discovery.on("peer:discovered", async (peer: PeerInfo) => {
  console.log("Peer encontrado:", peer.id);

  const files: modelFile[] = await peerApi.fetchFiles(peer.address, peer.port);

  for (let idx = 0; idx < files.length; idx++) {
    console.log(`Nome do arquivo: ${files[idx].name}`);
  }
});

discovery.on("error", console.error);

// start
httpApi.start();
discovery.start();
