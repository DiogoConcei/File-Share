import axios from 'axios';
import path from 'path';
import Catalog from './providers/CatalogProvider';
import HashService from './services/HashService';
import StreamProcessor from './services/StreamProcessor';
import { Readable } from 'stream';
import { FileMetadata } from './interfaces/fileMetadata.interfaces';
import { DirMetadata } from './interfaces/dirMetadata.interfaces';

export default class PeerApi {
  private readonly streamProcessor: StreamProcessor = new StreamProcessor();
  private readonly hashService: HashService = new HashService();

  private readonly address: string;
  private readonly port: number;

  constructor(address: string, port: number) {
    this.address = address;
    this.port = port;
  }

  public async requestFile(file: FileMetadata) {
    console.log(
      `[PEER API] requisitando arquivo ${file.id} de ${this.address}:${this.port}`,
    );

    const url = `http://${this.address}:${this.port}/${file.id}/download`;

    const response = await axios.get<Readable>(url, {
      responseType: 'stream',
    });

    const fileName = file.name + file.ext;

    const filePath = await this.streamProcessor.saveStream(
      response.data,
      fileName,
    );

    const ok = await this.hashService.isHashed(file.hash, filePath);
    if (!ok) {
      throw new Error('Hash mismatch após download');
    }

    await Catalog.registerFile(filePath, { origin: 'network' });

    console.log('[PEER API] arquivo sincronizado com sucesso');
  }

  public async fetchPeerFiles(): Promise<FileMetadata[]> {
    try {
      const url = `http://${this.address}:${this.port}/`;

      const response = await axios.get<FileMetadata[]>(url);

      if (response.status !== 200) return [];

      return response.data;
    } catch {
      console.log(`Falha em ler arquivos do peer ${this.address}:${this.port}`);
      return [];
    }
  }

  public async sendFile(file: FileMetadata) {
    console.log(
      `[PEER API] enviando arquivo ${file.id} para ${this.address}:${this.port}`,
    );

    const filePath: string = path.join(process.cwd(), 'files', file.id);

    const stream = await this.streamProcessor.getReadStream(filePath);

    await axios.post(
      `http://${this.address}:${this.port}/v1/sync/file`,
      stream,
      {
        headers: {
          'Content-Type': 'application/octet-stream',
          parentId: file.parentId,
          fileid: file.id,
          name: file.name,
          ext: file.ext,
          hash: file.hash,
          privacy: file.privacy,
        },
      },
    );

    console.log('[PEER API] upload concluído');
  }

  public async sendDir(dir: DirMetadata) {
    console.log(
      `[PEER API] enviando a pasta ${dir.id} para ${this.address}:${this.port}`,
    );

    await axios.post(`http://${this.address}:${this.port}/v1/sync/dir`, dir);
  }
}
