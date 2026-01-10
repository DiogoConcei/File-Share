import { FileMetadata } from "./interfaces";
import { EventEmitter } from "events";
import path from "path";
import fse from "fs-extra";
import PLimit from "p-limit";

export default class SyncManager extends EventEmitter {
  private readonly syncData = path.resolve(__dirname, "sync-metadata.json");

  //   Modo de sincronização ativa
  start() {
    // Escuta o evento de peer ativo
    // Verifica
    // Há itens na fila para adicionar ? (ação prioritária)
    // Há itens na fila para remover ? (ação secundária)
    // Há itens na fila para sincronizar ? (ação com menor importância)
    // Escuta o evento de file:add
    // Escuta o evento de file:remove
    // Escuta o evento de file:sync
  }

  //   Modo sem a sincronização
  stop() {
    // Basicamente, os mesmos dos acima
    // A unica diferença é que não vai realizar requisições
    // E vai salvar todas as modificações na queue
  }
}
