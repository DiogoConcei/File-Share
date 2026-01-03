import { io } from "socket.io-client";
import fse from "fs-extra";

const SERVER_IP = "192.168.0.10"; // 👈 IP DA MÁQUINA DO SERVIDOR
const outputFile = "./data_copiada.7z";

const socket = io(`http://${SERVER_IP}:3000`);

const writeStream = fse.createWriteStream(outputFile);

socket.on("connect", () => {
  console.log("Conectado ao servidor:", socket.id);
});

socket.on("file-chunk", ({ data }) => {
  writeStream.write(data);
});

socket.on("file-end", () => {
  writeStream.end();
  console.log("Arquivo recebido por completo");
});

socket.on("disconnect", () => {
  console.log("Desconectado");
});
