import { IncomingHttpHeaders } from 'http';
import fse from 'fs-extra';
import express, { Express } from 'express';
import path from 'path';
import { FilePackage } from './interfaces/fileMetadata.interfaces';
import HashService from './services/HashService';
import StreamProcessor from './services/StreamProcessor';
import Catalog from './providers/CatalogProvider';
import { DataPackage } from './interfaces/dataPackage.interface';
import { DirMetadata } from './interfaces/dirMetadata.interfaces';

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
      const id = req.params.ulid;
      const filePath = path.join(process.cwd(), 'files', id);

      const file = await Catalog.fetchFile(id);

      if (!file) {
        console.log('[HTTP] fileId NÃO encontrado');
        res.status(404).end();
        return;
      }

      console.log('[HTTP] enviando arquivo:', filePath);
      res.download(filePath);
    });

    // FileHttpApi.ts
    this.app.post('/v1/sync/file', async (req, res) => {
      try {
        const filePkg = await this.extractFilePackage(req.headers);

        if (!filePkg) {
          throw new Error(
            `Falha no recebimento de dados atraves da requisicao`,
          );
        }

        const fileName = filePkg.id;

        const filePath = await this.streamProcessor.saveStream(req, fileName);

        const ok = await this.hashService.isHashed(filePkg.hash, filePath);

        if (!ok) {
          await fse.remove(filePath);
          res.status(400).json({ error: 'Hash mismatch' });
          return;
        }

        const stat = await fse.stat(filePath);

        const completePackage: DataPackage = {
          id: filePkg.id,
          parentId: filePkg.parentId,
          type: 'file',
          name: filePkg.name,
          ext: filePkg.ext,
          hash: filePkg.hash,
          size: stat.size,
          privacy: filePkg.privacy || 'public',
          isDownloaded: 'downloaded',
          isSync: 'synchronized',
          origin: 'network',
        };

        await Catalog.syncRegister(completePackage);

        res.status(200).json({ ok: true });
      } catch (e) {
        console.error('[HTTP] erro no upload:', e);
        res.status(500).json({ error: 'Falha no upload' });
      }
    });

    this.app.post('/v1/sync/dir', async (req, res) => {
      const dirData: DirMetadata = req.body;

      // Usamos o syncRegister em vez do registerDir!
      await Catalog.syncRegister(dirData);

      res.status(200).json({ ok: true });
    });
  }

  private ensureString(
    value: string | string[] | undefined | 'public' | 'private',
  ): string {
    if (Array.isArray(value)) {
      return value[0] || '';
    }
    return value ?? '';
  }

  private ensurePrivacy(
    value: string | string[] | undefined,
  ): 'public' | 'private' {
    const strValue = Array.isArray(value) ? value[0] : value;
    return strValue === 'private' ? 'private' : 'public';
  }

  private extractFilePackage(headers: IncomingHttpHeaders): FilePackage | null {
    const pkg: FilePackage = {
      parentId: this.ensureString(headers['parentId']),
      id: this.ensureString(headers['fileid']),
      name: this.ensureString(headers['name']),
      ext: this.ensureString(headers['ext']),
      hash: this.ensureString(headers['hash']),
      privacy: this.ensurePrivacy(headers['privacy']),
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
