import { createServer } from "http";
import { Server, Socket } from "socket.io";
import fse from "fs-extra";
import crypto from "crypto";

const httpServer = createServer();
const io = new Server(httpServer, { cors: { origin: "*" } });
const inputFile = "./dataTeste.7z";
const chunk_size = 4096 * 1024; // 256KB POR CHUNK

io.on("connection", (socket: Socket) => {
  console.log("Cliente conectado: ", socket.id);

  socket.on("ping", (msg) => {
    console.log("Recebi do cliente: ", msg);
    socket.emit("pong", "pong do servidor");
  });

  socket.on("disconnect", () => {
    console.log("Cliente desconectado");
  });

  const readStream = fse.createReadStream(inputFile, {
    highWaterMark: chunk_size,
  });

  readStream.on("data", (chunk) => {
    const hash = crypto.createHash("sha256");
    hash.update(chunk);
    console.log("Transmitindo dados");

    socket.emit("file-chunk", { hash: hash.digest("hex"), data: chunk });
  });
});

httpServer.listen(3000, () => {
  console.log("Servidor socket.io rodando na porta 3000");
});
