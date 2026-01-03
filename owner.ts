import { createServer } from "http";
import { Server } from "socket.io";
import fse from "fs-extra";
import crypto from "crypto";

const httpServer = createServer();
const io = new Server(httpServer, { cors: { origin: "*" } });

const inputFile = "./dataTeste.jpg";
const CHUNK_SIZE = 2048 * 1024; // 64KB

io.on("connection", (socket) => {
  console.log("[SERVER] Cliente conectado:", socket.id);

  const stats = fse.statSync(inputFile);
  const totalBytes = stats.size;
  let sentBytes = 0;

  console.log(`[SERVER] Tamanho do arquivo: ${totalBytes} bytes`);

  const readStream = fse.createReadStream(inputFile, {
    highWaterMark: CHUNK_SIZE,
  });

  readStream.on("data", (chunk) => {
    readStream.pause();
    sentBytes += chunk.length;

    const percent = ((sentBytes / totalBytes) * 100).toFixed(2);

    const hash = crypto.createHash("sha256");
    hash.update(chunk);

    console.log(`[SERVER] Enviando chunk ${chunk.length} bytes | ${percent}%`);

    socket.emit(
      "file-chunk",
      {
        hash: hash.digest("hex"),
        data: chunk,
        sentBytes,
        totalBytes,
      },
      () => {
        readStream.resume();
      }
    );
  });

  readStream.on("end", () => {
    console.log("[SERVER] Envio concluído (100%)");
    socket.emit("file-end");
  });

  readStream.on("error", (err) => {
    console.error("[SERVER] Erro no readStream:", err);
  });
});

httpServer.listen(3000, "0.0.0.0", () => {
  console.log("[SERVER] Socket.IO rodando na porta 3000");
});
