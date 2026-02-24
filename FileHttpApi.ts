import { IncomingHttpHeaders } from 'http';
import express, { Express } from 'express';
import { FilePackage } from './interfaces/fileMetadata.interfaces';
import HashService from './services/HashService';
import StreamProcessor from './services/StreamProcessor';
import Catalog from './providers/CatalogProvider';

export default class FileHttpApi {
  private readonly streamProcessor: StreamProcessor = new StreamProcessor();
  private readonly hashService: HashService = new HashService();
  private app: Express;
  private port: number;

  constructor(port: number) {
    this.port = port;
    this.app = express();

    this.setupRoutes();
  }

  private setupRoutes() {
    // Get com todos os arquivos
    this.app.get('/', async (_req, res) => {
      const data = await Catalog.fetchServerFiles();

      return res.status(200).json(data);
    });

    // Get com um único arquivo
    this.app.get('/:ulid/download', async (req, res) => {
      console.log('[HTTP] pedido de download:', req.params.ulid);
      const id = req.params.ulid;

      const file = await Catalog.fetchFile(id);

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
        const filePkg: FilePackage | null = await this.extractFilePackage(
          req.headers,
        );

        if (!filePkg) {
          throw new Error(
            `Falha no recebimento de dados atraves da requisicao`,
          );
        }

        const fileName = `${filePkg.name}${filePkg.ext}`;

        const filePath = await this.streamProcessor.saveStream(req, fileName);

        const ok = await this.hashService.isHashed(filePkg.hash, filePath);

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

  private ensureString(value: string | string[] | undefined): string {
    if (Array.isArray(value)) {
      return value[0] || '';
    }
    return value ?? '';
  }

  private extractFilePackage(headers: IncomingHttpHeaders): FilePackage | null {
    const pkg: FilePackage = {
      fileid: this.ensureString(headers['fileid']),
      name: this.ensureString(headers['name']),
      ext: this.ensureString(headers['ext']),
      hash: this.ensureString(headers['hash']),
    };

    const isValid = Object.values(pkg).every((val) => val.length > 0);

    return isValid ? pkg : null;
  }

  start() {
    this.app.listen(this.port, () => {
      console.log(`HTTP API ativa em http://localhost:${this.port}`);
    });
  }
}
