import modelFile from "./files.interfaces";
import crypto from "crypto";
import fse from "fs-extra";
import path from "path";
import { ulid } from "ulid";

export default class FileCatalog {
  private readonly baseDir = path.join(__dirname, "localFiles");

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

  public async validFiles(): Promise<void> {
    let temp: modelFile[] = [];

    const entries = (await fse.readdir(this.baseDir, { withFileTypes: true }))
      .filter((e) => e.isFile() && /\.(cbz|cbr|zip|rar)$/i.test(e.name))
      .map((e) => path.join(e.parentPath, e.name));

    const results = await Promise.all(
      entries.map(async (file) => {
        const hash = await this.hashFile(file);
        return hash;
      })
    );

    for (let idx = 0; idx < entries.length; idx++) {
      const modelFile: modelFile = {
        fileId: ulid(),
        name: path.basename(entries[idx], path.extname(entries[idx])),
        hash: results[idx],
        path: entries[idx],
        isDownloaded: "not_downloaded",
        isSync: "unsynchronized",
        privacy: "public",
        size: (await fse.stat(entries[idx])).size, // size in bytes
      };

      temp.push(modelFile);
    }

    await fse.writeJson("./dataTeste.json", temp, { spaces: 2 });
  }
}
