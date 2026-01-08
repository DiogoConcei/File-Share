import dotenv from "dotenv";
import { modelFile, PeerInfo } from "./interfaces";

import DiscoveryService from "./DiscoveryService";
import FileHttpApi from "./FileHttpApi";
import PeerApi from "./PeerApi";

dotenv.config({ path: "./.env" });
const port = Number(process.env.PORT);

const discovery = new DiscoveryService(port);
const httpApi = new FileHttpApi(port, "./json/dataTeste.json");

discovery.on("peer:discovered", async (peer: PeerInfo) => {
  console.log("Peer encontrado:", peer.id);
  const peerApi = new PeerApi(peer.address, peer.port);

  const files = await peerApi.compareData();
  const { inServer, inPeer, sync } = files;

  if (inServer.length !== 0) {
    await Promise.all(
      inServer.map(async (serverFile) => {
        const fileName = serverFile.name.concat(serverFile.ext);
        await peerApi.peerSync(serverFile.fileId, fileName);
      })
    );
  }
});

discovery.on("error", console.error);

// start
httpApi.start();
discovery.start();
