import fse from "fs-extra";
import crypto from "crypto";

const inputFile = "./dataTeste.7z";
const outputFile = "./data_copiada.7z";
const chunk_size = 4096 * 1024; // 256KB POR CHUNK

async function workingWithStream() {
  let chunkCount = 0;
  let totalBytes = 0;

  const readStream = await fse.createReadStream(inputFile, {
    highWaterMark: chunk_size,
  });
  const writeStream = await fse.createWriteStream(outputFile);

  readStream.on("data", (chunk) => {
    chunkCount++;
    totalBytes += chunk.length;

    const hash = crypto.createHash("sha256");
    hash.update(chunk);
    const chunkHash = hash.digest("hex");

    console.log(`Chunk recebido: ${chunk.length} bytes, hash: ${chunkHash}`);

    writeStream.write(chunk);
  });

  readStream.on("end", () => {
    writeStream.end(); // Fecha o arquivo de saída

    console.log("\n=== Resumo da operação ===");
    console.log(`Arquivo original: ${inputFile}`);
    console.log(`Arquivo reconstruído: ${outputFile}`);
    console.log(`Chunks lidos: ${chunkCount}`);
    console.log(`Bytes totais: ${totalBytes}`);
    console.log(`Hashes de todos os chunks:`);
    console.log("\nProjeto 1 concluído!");
  });
}

workingWithStream();
