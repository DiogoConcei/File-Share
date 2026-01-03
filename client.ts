import { io } from "socket.io-client";
import fse from "fs-extra";

const outputFile = "./data_copiada.7z";

const socket = io("http://localhost:3000");

socket.on("connect", () => {
  console.log("Conectado ao servidor com id:", socket.id);

  socket.emit("ping", "ping do cliente");
});

socket.on("pong", (msg) => {
  console.log("Recebi do servidor:", msg);
});

socket.on("disconnect", () => {
  console.log("Desconectado do servidor");
});

socket.on("file-chunk", ({ hash, data }) => {
  console.log("Recebendo dados");
  const writeStream = fse.createWriteStream(outputFile);
  writeStream.write(data);
});
