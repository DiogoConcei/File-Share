import dotenv from "dotenv";
import axios from "axios";
import { PeerInfo } from "./interfaces";

import DiscoveryService from "./DiscoveryService";
import FileHttpApi from "./FileHttpApi";

dotenv.config({ path: "./.env" });

const discovery = new DiscoveryService(Number(process.env.PORT));

const httpApi = new FileHttpApi(Number(process.env.PORT), "./dataTeste.json");

discovery.on("peer:discovered", (peer: PeerInfo) => {
  console.log("Peer encontrado:", peer.id);

  axios.get(`${peer.address}:${peer.port}`);
});

discovery.on("error", console.error);

// start
httpApi.start();
discovery.start();
