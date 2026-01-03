import { createServer } from "http";
import { Server } from "socket.io";
import fse from "fs-extra";
import crypto from "crypto";

const httpServer = createServer();
const io = new Server(httpServer, {
  cors: { origin: "*" },
});

const inputFile = "./dataTeste.7z";
const CHUNK_SIZE = 4096 * 1024;

io.on("connection", (socket) => {
  console.log("Cliente conectado:", socket.id);

  const readStream = fse.createReadStream(inputFile, {
    highWaterMark: CHUNK_SIZE,
  });

  readStream.on("data", (chunk) => {
    const hash = crypto.createHash("sha256");
    hash.update(chunk);

    socket.emit("file-chunk", {
      hash: hash.digest("hex"),
      data: chunk,
    });
  });

  readStream.on("end", () => {
    socket.emit("file-end");
    console.log("Arquivo enviado por completo");
  });
});

/**
 * 🔴 IMPORTANTE:
 * Escutar em 0.0.0.0 = todas as interfaces de rede
 */
httpServer.listen(3000, "0.0.0.0", () => {
  console.log("Servidor rodando na porta 3000");
});
