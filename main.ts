import dotenv from "dotenv";
import { modelFile, PeerInfo } from "./interfaces";

import DiscoveryService from "./DiscoveryService";
import FileHttpApi from "./FileHttpApi";
import PeerApi from "./PeerApi";

dotenv.config({ path: "./.env" });
const port = Number(process.env.PORT);

const discovery = new DiscoveryService(port);
const httpApi = new FileHttpApi(port, "./data/dataTeste.json");

discovery.on("peer:discovered", async (peer: PeerInfo) => {
  console.log("Peer encontrado:", peer.id);
  const peerApi = new PeerApi(peer.address, peer.port);

  const files = await peerApi.compareData();
  const { inServer, inPeer, sync } = files;

  console.log(`Arquivos do peer: ${inPeer.length}`);

  if (inPeer.length !== 0) {
    await Promise.all(
      inPeer.map(async (peerFile) => {
        const fileName = peerFile.name.concat(peerFile.ext);
        await peerApi.peerSync(peerFile.fileId, fileName);
      })
    );
  }
});

discovery.on("error", console.error);

// start
httpApi.start();
discovery.start();
