import axios from "axios";
import fse from "fs-extra";
import FileCatalog from "./FileCatalog";
import { Readable } from "stream";
import { modelFile, compareData } from "./interfaces";

export default class PeerApi {
  private readonly fileCatalog = new FileCatalog();
  private readonly address: string;
  private readonly port: string;

  constructor(address: string, port: string) {
    this.address = address;
    this.port = port;
  }

  private async fetchPeerFiles(
    address: string,
    port: string
  ): Promise<modelFile[]> {
    try {
      const url = `http://${address}:${port}/`;

      const response = await axios.get<modelFile[]>(url);

      if (response.status !== 200) return [];

      return response.data;
    } catch (e) {
      console.log(`Falha em ler arquivos`);
      return [];
    }
  }

  public async compareData(): Promise<compareData> {
    try {
      const peerData = await this.fetchPeerFiles(this.address, this.port);
      const serverData = await this.fileCatalog.getData();

      // Maps para acesso O(1) por fileId e para garantir unicidade por id
      const peerMap = new Map<string, modelFile>();
      for (const f of peerData) peerMap.set(f.fileId, f);

      const serverMap = new Map<string, modelFile>();
      for (const f of serverData) serverMap.set(f.fileId, f);

      const peerIds = new Set(peerMap.keys());
      const serverIds = new Set(serverMap.keys());

      const onlyInPeer: modelFile[] = [];
      const onlyInServer: modelFile[] = [];
      const sync: modelFile[] = [];

      for (const id of peerIds) {
        if (serverIds.has(id)) {
          // Aqui escolhi guardar a versão do peer (pode trocar pela do server se preferir)
          const file = peerMap.get(id)!;
          sync.push(file);
        } else {
          onlyInPeer.push(peerMap.get(id)!);
        }
      }

      // Percorre server: só adiciona os que NÃO existem no peer (os "onlyInServer")
      for (const id of serverIds) {
        if (!peerIds.has(id)) {
          onlyInServer.push(serverMap.get(id)!);
        }
      }

      return {
        inPeer: onlyInPeer,
        inServer: onlyInServer,
        sync,
      };
    } catch (e) {
      console.error(`Falha em verificar estado dos arquivos: `, e);
      return {
        inPeer: [],
        inServer: [],
        sync: [],
      };
    }
  }

  public async peerSync(fileId: string, fileName: string) {
    try {
      const url = `http://${this.address}:${this.port}/${fileId}/download`;

      const response = await axios.get<Readable>(url, {
        responseType: "stream",
      });

      const stream = response.data;

      await this.fileCatalog.saveStream(stream, fileId);
    } catch (e) {
      console.log(`Falha em ler arquivos`);
      return [];
    }
  }
}

// Salvar todos os arquivos com hash diferente
