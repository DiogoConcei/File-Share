import { io } from "socket.io-client";
import fse from "fs-extra";

const SERVER_IP = "192.168.0.10"; // IP do servidor
const outputFile = "./data_copiada.7z";

const socket = io(`http://${SERVER_IP}:3000`);

const writeStream = fse.createWriteStream(outputFile);

let receivedBytes = 0;
let totalBytes = 0;

socket.on("connect", () => {
  console.log("[CLIENT] Conectado ao servidor:", socket.id);
});

socket.on("file-chunk", ({ data, sentBytes, totalBytes: total }) => {
  if (!totalBytes) totalBytes = total;

  receivedBytes += data.length;

  const percent = ((receivedBytes / totalBytes) * 100).toFixed(2);

  console.log(`[CLIENT] Recebendo chunk ${data.length} bytes | ${percent}%`);

  writeStream.write(data);
});

socket.on("file-end", () => {
  writeStream.end();
  console.log("[CLIENT] Arquivo recebido com sucesso (100%)");
});

socket.on("disconnect", () => {
  console.log("[CLIENT] Desconectado");
});
