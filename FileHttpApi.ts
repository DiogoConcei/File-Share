import express, { Express } from "express";
import fse from "fs-extra";

export default class FileHttpApi {
  private app: Express;
  private port: number;
  private dataFile: string;

  constructor(port: number, dataFile: string) {
    this.port = port;
    this.dataFile = dataFile;
    this.app = express();

    this.setupRoutes();
  }

  private setupRoutes() {
    // Get com todos os arquivos
    this.app.get("/", async (_req, res) => {
      try {
        const data = await fse.readJson(this.dataFile, { encoding: "utf8" });

        res.status(200).json(data);
      } catch (e: any) {
        if (e.code === "ENOENT") {
          return res.status(404).json({
            error: "Arquivo não encontrado",
          });
        }

        return res.status(500).json({
          error: "Erro ao ler o arquivo",
        });
      }
    });

    // Get com um único arquivo
    this.app.get("/:ulid/download", async (req, res) => {
      console.log("[HTTP] download solicitado:", req.params.ulid);

      const data = await fse.readJson(this.dataFile, { encoding: "utf8" });
      const file = data.find((f: any) => f.fileId === req.params.ulid);

      if (!file) {
        console.log("[HTTP] arquivo não encontrado");
        res.status(404).end();
        return;
      }

      console.log("[HTTP] enviando arquivo:", file.path);
      res.download(file.path, (err) => {
        if (err) {
          console.error("[HTTP] erro no download:", err);
        }
      });
    });
  }

  start() {
    this.app.listen(this.port, () => {
      console.log(`HTTP API ativa em http://localhost:${this.port}`);
    });
  }
}
