import { FileMetadata } from "./interfaces";

import { EventEmitter } from "events";
import { ulid } from "ulid";
import crypto from "crypto";
import chokidar from "chokidar";
import path from "path";
import fse from "fs-extra";
import { Readable } from "stream";
import { pipeline } from "node:stream/promises";
import PLimit from "p-limit";

export default class FileCatalog extends EventEmitter {
  private readonly baseDir = path.resolve(__dirname, "files");
  private readonly dataFile = path.resolve(
    __dirname,
    "json",
    "files-metadata.json"
  );
  private index = new Map<string, FileMetadata>(); // fileId -> metadata
  private hashIndex = new Map<string, string>(); // hash -> fileId
  private pathIndex = new Map<string, string>(); // path -> fileId
  private limitHash = PLimit(5);

  async start() {
    await this.loadIndex();
    this.startWatching();
  }

  private async loadIndex() {
    try {
      const arr: FileMetadata[] = await fse.readJson(this.dataFile);

      for (const f of arr) {
        this.index.set(f.fileId, f);
        this.hashIndex.set(f.hash, f.fileId);
        this.pathIndex.set(f.path, f.fileId);
      }
    } catch (e) {
      await this.persistIndex();
    }
  }

  private async persistIndex() {
    console.log([...this.index.values()]);
    await fse.writeJson(this.dataFile + ".tmp", [...this.index.values()], {
      spaces: 2,
    });
    await fse.move(this.dataFile + ".tmp", this.dataFile, { overwrite: true });
  }

  private startWatching() {
    const watcher = chokidar.watch(this.baseDir, {
      ignoreInitial: true,
      persistent: true,
      awaitWriteFinish: { stabilityThreshold: 1500, pollInterval: 100 },
      ignored: ["**/.inprogress/**"],
    });

    watcher.on("add", (p) => this.onAdd(p));
    watcher.on("unlink", (p) => this.onRemove(p));
  }

  public async onAdd(filePath: string) {
    const fileMeta = await this.limitHash(() => this.registerFile(filePath));

    if (fileMeta) {
      this.emit("file:added", fileMeta);
    }
  }

  private async onRemove(filePath: string) {
    const fileMeta = await this.unlinkFile(filePath);
    if (fileMeta) {
      this.emit("file:removed", fileMeta);
    }
  }

  private async unlinkFile(filePath: string): Promise<FileMetadata> {
    const fileId = this.pathIndex.get(filePath);

    if (!fileId) {
      throw new Error(`Falha em encontrar o arquivo ${filePath}`);
    }

    const metadata = this.index.get(fileId);

    if (!metadata) {
      throw new Error(`Falha em encontrar os metadados do arquivo ${filePath}`);
    }

    this.index.delete(fileId);
    this.hashIndex.delete(metadata.hash);
    this.pathIndex.delete(filePath);
    await this.persistIndex();

    return metadata;
  }

  public async registerFile(filePath: string): Promise<FileMetadata> {
    const [hash, stat] = await Promise.all([
      this.hashFile(filePath),
      fse.stat(filePath),
    ]);

    if (this.hashIndex.has(hash)) {
      const existingId = this.hashIndex.get(hash)!;
      const existing = this.index.get(existingId);

      if (!existing) {
        throw new Error("Falha durante o calculo  de hash");
      }

      if (existing.path !== filePath) {
        existing.path = filePath;
        await this.persistIndex();
      }

      return existing;
    }

    const meta: FileMetadata = {
      fileId: ulid(),
      name: path.basename(filePath, path.extname(filePath)),
      ext: path.extname(filePath),
      hash,
      path: filePath,
      isDownloaded: "not_downloaded",
      isSync: "unsynchronized",
      privacy: "public",
      size: stat.size,
    };

    this.index.set(meta.fileId, meta);
    this.hashIndex.set(hash, meta.fileId);
    await this.persistIndex();

    return meta;
  }

  public async hashFile(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash("sha256");
      const rs = fse.createReadStream(filePath);
      rs.on("data", (c) => hash.update(c));
      rs.on("end", () => resolve(hash.digest("hex")));
      rs.on("error", reject);
    });
  }

  // Método para salvar o chunk que a api envia
  public async saveStream(stream: Readable, fileName: string) {
    const filePath = path.join(this.baseDir, fileName);
    await pipeline(stream, fse.createWriteStream(filePath));
    return filePath;
  }

  // Método para comparar o  hash entre o arquivo recebido e o presente
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

  // Método para externalizar a data do server
  public async fetchServerFiles(): Promise<FileMetadata[]> {
    try {
      const jsonData: FileMetadata[] = await fse.readJson(this.dataFile);

      if (jsonData.length === 0) return [];

      return jsonData;
    } catch (e) {
      console.error(`Falha em recuperar dados: `, e);
      return [];
    }
  }
}
