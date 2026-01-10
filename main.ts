import dotenv from "dotenv";
import { FileMetadata, PeerInfo } from "./interfaces";

import DiscoveryService from "./DiscoveryService";
import FileHttpApi from "./FileHttpApi";
import PeerApi from "./PeerApi";
import FileCatalog from "./FileCatalog";

dotenv.config({ path: "./.env" });
const port = Number(process.env.PORT);

const discovery = new DiscoveryService(port);
const httpApi = new FileHttpApi(port, "files-metada.json");
const fCatalog = new FileCatalog();

// discovery.on("peer:discovered", async (peer: PeerInfo) => {
// console.log("Peer encontrado:", peer.id);
// const peerApi = new PeerApi(peer.address, peer.port);

// const files = await peerApi.compareData();
// const { inServer, inPeer, sync } = files;
// });

// discovery.on("error", console.error);

// start
// httpApi.start();
// discovery.start();

fCatalog.start();
