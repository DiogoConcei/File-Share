import dotenv from "dotenv";
import axios from "axios";
import { PeerInfo } from "./interfaces";

import DiscoveryService from "./DiscoveryService";
import FileHttpApi from "./FileHttpApi";

dotenv.config({ path: "./.env" });

const discovery = new DiscoveryService(Number(process.env.PORT));

const httpApi = new FileHttpApi(Number(process.env.PORT), "./dataTeste.json");

discovery.on("peer:discovered", async (peer: PeerInfo) => {
  console.log("Peer encontrado:", peer.id);

  const response = await axios.get(`http://${peer.address}:${peer.port}/`);
  console.log(response.data);
});

discovery.on("error", console.error);

// start
httpApi.start();
discovery.start();
