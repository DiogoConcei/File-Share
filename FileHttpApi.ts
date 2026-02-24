import express, { Express } from 'express';
import fse from 'fs-extra';
import HashService from './services/HashService';
import StreamProcessor from './services/StreamProcessor';
import Catalog from './providers/CatalogProvider';

export default class FileHttpApi {
  private readonly streamProcessor: StreamProcessor = new StreamProcessor();
  private readonly hashService: HashService = new HashService();
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
    this.app.get('/', async (_req, res) => {
      try {
        const data = await fse.readJson(this.dataFile, { encoding: 'utf8' });

        return res.status(200).json(data);
      } catch (e: any) {
        if (e.code === 'ENOENT') {
          return res.status(404).json({
            error: 'Arquivo não encontrado',
          });
        }

        return res.status(500).json({
          error: 'Erro ao ler o arquivo',
        });
      }
    });

    // Get com um único arquivo
    this.app.get('/:ulid/download', async (req, res) => {
      console.log('[HTTP] pedido de download:', req.params.ulid);
      console.log('[HTTP] dataFile:', this.dataFile);

      const data = await fse.readJson(this.dataFile);
      console.log(
        '[HTTP] arquivos conhecidos:',
        data.map((f: any) => f.fileId),
      );

      const file = data.find((f: any) => f.fileId === req.params.ulid);

      if (!file) {
        console.log('[HTTP] fileId NÃO encontrado');
        res.status(404).end();
        return;
      }

      console.log('[HTTP] enviando arquivo:', file.path);
      res.download(file.path);
    });

    // FileHttpApi.ts
    this.app.post('/upload', async (req, res) => {
      try {
        const { fileid, name, ext, hash } = req.headers as any;

        if (!fileid || !name || !ext || !hash) {
          res.status(400).json({ error: 'Headers ausentes' });
          return;
        }

        const fileName = `${name}${ext}`;

        const filePath = await this.streamProcessor.saveStream(req, fileName);

        const ok = await this.hashService.isHashed(hash, filePath);

        if (!ok) {
          res.status(400).json({ error: 'Hash mismatch' });
          return;
        }

        await Catalog.registerFile(filePath);

        res.status(200).json({ ok: true });
      } catch (e) {
        console.error('[HTTP] erro no upload:', e);
        res.status(500).json({ error: 'Falha no upload' });
      }
    });
  }

  start() {
    this.app.listen(this.port, () => {
      console.log(`HTTP API ativa em http://localhost:${this.port}`);
    });
  }
}
