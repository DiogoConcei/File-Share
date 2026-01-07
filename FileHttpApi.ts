import express, { Express } from "express";
import fse from "fs-extra";

export default class FileHttpApi {
  private app: Express;
  private port: number;
  private dataDir: string;

  constructor(port: number, dataDir: string) {
    this.port = port;
    this.dataDir = dataDir;
    this.app = express();

    this.setupRoutes();
  }

  private setupRoutes() {
    this.app.get("/", async (_req, res) => {
      try {
        const data = await fse.readJson(this.dataDir, { encoding: "utf8" });

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

    this.app.get("/:filename/:ulid/download", async (req, res) => {
      const data = await fse.readJson(this.dataDir, { encoding: "utf8" });
      const file = data.find((f: any) => f.fileId === req.params.ulid);

      if (!file) {
        res.status(404).end();
        return;
      }

      res.download(file.path);
    });
  }

  start() {
    this.app.listen(this.port, () => {
      console.log(`HTTP API ativa em http://localhost:${this.port}`);
    });
  }
}
