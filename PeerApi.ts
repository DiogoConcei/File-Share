import axios from "axios";
import FileCatalog from "./FileCatalog";
import fse from "fs-extra";
import { Readable } from "stream";
import { FileMetadata, DiffData } from "./interfaces";

export default class PeerApi {
  private readonly fileCatalog = new FileCatalog();
  private readonly address: string;
  private readonly port: number;

  constructor(address: string, port: number) {
    this.address = address;
    this.port = port;
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

  public async sendFile(file: FileMetadata): Promise<void> {
    const url = `http://${this.address}:${this.port}/upload`;

    const stream = fse.createReadStream(file.path);

    await axios.post(url, stream, {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Length": file.size,
        fileId: file.fileId,
        name: file.name,
        ext: file.ext,
        hash: file.hash,
      },
    });
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
