import crypto from "crypto";
import dotenv from "dotenv";

import DiscoveryService from "./DiscoveryService";
import FileHttpApi from "./FileHttpApi";

dotenv.config({ path: "./.env" });
const peerId = crypto.randomUUID();

const discovery = new DiscoveryService(Number(process.env.PORT) || 3000);
const httpApi = new FileHttpApi(
  Number(process.env.PORT) || 3000,
  "./dataTeste.json"
);

discovery.on("peer:discovered", (peer) => {
  console.log("Peer encontrado:", peer.id);
});

discovery.on("error", console.error);

// start
httpApi.start();
discovery.start();
