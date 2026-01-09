import { modelFile } from "./interfaces";
import crypto from "crypto";
import fse from "fs-extra";
import { pipeline } from "node:stream/promises";
import path from "path";
import { ulid } from "ulid";
import { Readable } from "stream";

export default class FileCatalog {
  private readonly baseDir = path.join(__dirname, "localFiles");
  private readonly dataDir = path.join(__dirname, "data", "dataTeste.json");

  // Retorna o hash
  private async hashFile(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash("sha256");
      const rs = fse.createReadStream(filePath);

      rs.on("data", (chunk) => hash.update(chunk));

      rs.on("end", () => {
        const digest = hash.digest("hex");
        resolve(digest);
      });

      rs.on("error", (err) => {
        reject(err);
      });
    });
  }

  public async indexDirectory(): Promise<void> {
    try {
      const rawEntries = await fse.readdir(this.baseDir, {
        withFileTypes: true,
      });
      const fileEntries = rawEntries.filter(
        (e) => e.isFile() && /\.(cbz|cbr|zip|rar)$/i.test(e.name)
      );

      const processedFiles: modelFile[] = await Promise.all(
        fileEntries.map(async (entry) => {
          const fullPath = path.join(entry.parentPath, entry.name);

          const [fileHash, fileStats] = await Promise.all([
            this.hashFile(fullPath),
            fse.stat(fullPath),
          ]);

          return {
            fileId: ulid(),
            name: path.basename(entry.name, path.extname(entry.name)),
            ext: path.extname(entry.name),
            hash: fileHash,
            path: fullPath,
            isDownloaded: "not_downloaded",
            isSync: "unsynchronized",
            privacy: "public",
            size: fileStats.size,
          };
        })
      );

      await fse.writeJson(this.dataDir, processedFiles, {
        spaces: 2,
      });
    } catch (e) {
      console.error(`Falha em atualizar metadata: `, e);
      throw new String(e);
    }
  }

  public async checkHash(fileHash: string, newPath: string): Promise<boolean> {
    try {
      const calcHash = await this.hashFile(newPath);
      if (fileHash !== calcHash) return false;
      return true;
    } catch (e) {
      console.error(`Falha em verificar integridade do arquivo: `, e);
      return false;
    }
  }

  public async indexFile(filePath: string, peerFile: modelFile) {
    const data = await this.getData();

    const newFile: modelFile = {
      ...peerFile,
      path: filePath,
      isDownloaded: "downloaded",
      isSync: "synchronized",
    };

    data.push(newFile);

    await fse.writeJson(this.dataDir, data, {
      spaces: 2,
    });
  }

  public async getData(): Promise<modelFile[]> {
    try {
      const jsonData: modelFile[] = await fse.readJson(this.dataDir);

      if (jsonData.length === 0) return [];

      return jsonData;
    } catch (e) {
      console.error(`Falha em recuperar dados: `, e);
      return [];
    }
  }

  public async saveStream(stream: Readable, fileName: string) {
    const filePath = path.join(this.baseDir, fileName);
    await pipeline(stream, fse.createWriteStream(filePath));
    return filePath;
  }
}
