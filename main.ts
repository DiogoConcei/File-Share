import dgram from "dgram";
import crypto from "crypto";

const PORT = 3000;
const PEER_ID = crypto.randomUUID();
const MULTICAST_GROUP = "239.255.0.1";

const server = dgram.createSocket({ type: "udp4", reuseAddr: true });

const peers = new Map<
  string,
  { address: string; port: number; lastSeen: number }
>();

server.on("error", (error) => {
  console.error(`Server error: ${error.stack}`);
  server.close();
});

server.on("listening", () => {
  const address = server.address();

  console.log(
    `Peer ${PEER_ID} escutando em ${address.address}:${address.port}`
  );

  // entra no grupo multicast (recebimento)
  server.addMembership(MULTICAST_GROUP);

  // -> Apenas para LAN (TTL baixo)
  server.setMulticastTTL(1);
});

server.on("message", (msg, rinfo) => {
  const data = JSON.parse(msg.toString());

  // 🔴 FILTRO: ignora mensagens próprias
  if (data.peerId === PEER_ID) {
    return;
  }

  // 📌 cadastro lógico do peer
  peers.set(data.peerId, {
    address: rinfo.address,
    port: rinfo.port,
    lastSeen: Date.now(),
  });

  console.log("Peer recebido:", data.peerId);
  console.log("Peers conhecidos:", [...peers.keys()]);
});
server.bind(PORT);

setInterval(() => {
  const message = Buffer.from(
    JSON.stringify({
      type: "ANNOUNCE",
      peerId: PEER_ID,
      timeStamp: Date.now(),
    })
  );

  server.send(message, PORT, MULTICAST_GROUP, (err) => {
    if (err) console.error("Erro ao enviar: ", err);
    else console.log("Announce enviado");
  });
}, 5000);

// import express from "express";
// import dotenv from "dotenv";
// import crypto from "crypto";
// import { ulid } from "ulid";
// import dgram from "dgram";

// import fse from "fs-extra";
// import path from "path";

// import modelFile from "./files.interfaces";

// const app = express();
// const port = process.env.PORT || 3000;
// const baseDir = path.join(__dirname, "localFiles");
// const dataDir = path.join(__dirname, "dataTeste.json");

// dotenv.config({ path: "./.env" });

// app.get("/", async (req, res) => {
//   const data: modelFile[] = await fse.readJson(dataDir, { encoding: "utf8" });

//   res.json(data);
// });

// app.get("/:filename/:ulid/download", async (req, res) => {
//   const id = req.params.ulid;
//   const data: modelFile[] = await fse.readJson(dataDir, { encoding: "utf8" });
//   const file = data.find((file) => file.fileId === id);

//   if (!file) return;

//   res.download(file.path);
// });

// app.listen(port, () => {
//   console.log(`Servidor rodando na porta: http://localhost:${port}`);
// });

// function hashFile(filePath: string): Promise<string> {
//   return new Promise((resolve, reject) => {
//     const hash = crypto.createHash("sha256");
//     const rs = fse.createReadStream(filePath);

//     rs.on("data", (chunk) => hash.update(chunk));

//     rs.on("end", () => {
//       const digest = hash.digest("hex");
//       resolve(digest);
//     });

//     rs.on("error", (err) => {
//       reject(err);
//     });
//   });
// }

// async function validFiles(): Promise<void> {
//   let temp: modelFile[] = [];

//   const entries = (await fse.readdir(baseDir, { withFileTypes: true }))
//     .filter((e) => e.isFile() && /\.(cbz|cbr|zip|rar)$/i.test(e.name))
//     .map((e) => path.join(e.parentPath, e.name));

//   const results = await Promise.all(
//     entries.map(async (file) => {
//       const hash = await hashFile(file);
//       return hash;
//     })
//   );

//   for (let idx = 0; idx < entries.length; idx++) {
//     const modelFile: modelFile = {
//       fileId: ulid(),
//       name: path.basename(entries[idx], path.extname(entries[idx])),
//       hash: results[idx],
//       path: entries[idx],
//       isDownloaded: "not_downloaded",
//       isSync: "unsynchronized",
//       privacy: "public",
//       size: (await fse.stat(entries[idx])).size,
//     };

//     // size in bytes

//     temp.push(modelFile);
//   }

//   await fse.writeJson("./dataTeste.json", temp, { spaces: 2 });
// }
