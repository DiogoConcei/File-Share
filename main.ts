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
  console.log(`Arquivos do server: ${inServer.length}`);
  console.log(`Arquivos syncronizados: ${sync.length}`);

  // Arquivos do peer
  if (inPeer.length !== 0) {
    await Promise.all(
      inPeer.map(async (peerFile) => {
        await peerApi.peerSync(peerFile);
      })
    );
  }

  // Arquivos do server

  // Verificar hash, se diferente, sincronizar
});

discovery.on("error", console.error);

// start
httpApi.start();
discovery.start();
