import axios from "axios";
import FileCatalog from "./FileCatalog";
import { modelFile } from "./interfaces";

export default class PeerApi {
  private readonly fileCatalog = new FileCatalog();

  constructor() {}

  public async fetchFiles(address: string, port: string): Promise<modelFile[]> {
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
}
