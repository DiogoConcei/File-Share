import axios from 'axios';
import Catalog from './providers/CatalogProvider';
import HashService from './services/HashService';
import StreamProcessor from './services/StreamProcessor';
import { Readable } from 'stream';
import { FileMetadata } from './interfaces';
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
      `[PEER API] requisitando arquivo ${file.fileId} de ${this.address}:${this.port}`,
    );

    const url = `http://${this.address}:${this.port}/${file.fileId}/download`;

    // 🔽 aqui está a diferença-chave
    const response = await axios.get<Readable>(url, {
      responseType: 'stream',
    });

    const fileName = file.name + file.ext;

    // salva stream localmente
    const filePath = await this.streamProcessor.saveStream(
      response.data,
      fileName,
    );

    // valida integridade
    const ok = await this.hashService.isHashed(file.hash, filePath);
    if (!ok) {
      throw new Error('Hash mismatch após download');
    }

    // registra no catálogo local
    await Catalog.registerFile(filePath);

    console.log('[PEER API] arquivo sincronizado com sucesso');
  }

  public async fetchPeerFiles(): Promise<FileMetadata[]> {
    try {
      const url = `http://${this.address}:${this.port}/`;

      const response = await axios.get<FileMetadata[]>(url);

      if (response.status !== 200) return [];

      return response.data;
    } catch (e) {
      console.log(`Falha em ler arquivos do peer ${this.address}:${this.port}`);
      return [];
    }
  }

  public async sendFile(file: FileMetadata) {
    console.log(
      `[PEER API] enviando arquivo ${file.fileId} para ${this.address}:${this.port}`,
    );

    const stream = await this.streamProcessor.getReadStream(file.fileId);

    await axios.post(`http://${this.address}:${this.port}/upload`, stream, {
      headers: {
        'Content-Type': 'application/octet-stream',
        fileid: file.fileId,
        name: file.name,
        ext: file.ext,
        hash: file.hash,
      },
    });

    console.log('[PEER API] upload concluído');
  }

  // public async compareFiles(): Promise<DiffData> {
  //   try {
  //     const peerData = await this.fetchPeerFiles();
  //     const serverData = await this.fileCatalog.fetchServerFiles();

  //     const peerMap = new Map<string, FileMetadata>();
  //     for (const f of peerData) peerMap.set(f.fileId, f);

  //     const serverMap = new Map<string, FileMetadata>();
  //     for (const f of serverData) serverMap.set(f.fileId, f);

  //     const peerIds = new Set(peerMap.keys());
  //     const serverIds = new Set(serverMap.keys());

  //     const onlyInPeer: FileMetadata[] = [];
  //     const onlyInServer: FileMetadata[] = [];
  //     const sync: FileMetadata[] = [];

  //     for (const id of peerIds) {
  //       if (serverIds.has(id)) {
  //         const file = peerMap.get(id)!;
  //         sync.push(file);
  //       } else {
  //         onlyInPeer.push(peerMap.get(id)!);
  //       }
  //     }

  //     for (const id of serverIds) {
  //       if (!peerIds.has(id)) {
  //         onlyInServer.push(serverMap.get(id)!);
  //       }
  //     }

  //     return {
  //       inPeer: onlyInPeer,
  //       inServer: onlyInServer,
  //       sync,
  //     };
  //   } catch (e) {
  //     console.error(`Falha em verificar estado dos arquivos: `, e);
  //     return {
  //       inPeer: [],
  //       inServer: [],
  //       sync: [],
  //     };
  //   }
  // }

  // public async peerSync(peerFile: FileMetadata) {
  //   try {
  //     const fileName = peerFile.name.concat(peerFile.ext);

  //     const url = `http://${this.address}:${this.port}/${peerFile.fileId}/download`;

  //     const response = await axios.get<Readable>(url, {
  //       responseType: "stream",
  //     });

  //     const stream = response.data;

  //     const filePath = await this.fileCatalog.saveStream(stream, fileName);

  //     const sameHash = await this.fileCatalog.checkHash(
  //       peerFile.hash,
  //       filePath
  //     );

  //     if (!sameHash) {
  //       console.log("Processo finalizado devido a conflito entre hash");
  //       return;
  //     }

  //     await this.fileCatalog.registerFile(filePath);
  //   } catch (e) {
  //     console.log(`Falha em ler arquivos`);
  //     return [];
  //   }
  // }
}
