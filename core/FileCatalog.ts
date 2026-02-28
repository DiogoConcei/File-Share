import { FileMetadata } from '../interfaces/fileMetadata.interfaces';
import { DirMetadata } from '../interfaces/dirMetadata.interfaces';
import { DataPackage } from '../interfaces/dataPackage.interface';
import { EventEmitter } from 'events';
import { ulid } from 'ulid';
import chokidar from 'chokidar';
import path from 'path';
import fse from 'fs-extra';
import PLimit from 'p-limit';

interface IStorage {
  load(): Promise<DataPackage[]>;
  save(meta: DataPackage[]): Promise<boolean>;
}

interface IHash {
  hashFile(filePath: string): Promise<string>;
  isHashed(fileHash: string, newPath: string): Promise<boolean>;
}

class FileCatalog extends EventEmitter {
  private readonly hasher: IHash;
  private readonly storage: IStorage;
  private eventQueue: { type: 'dir' | 'file'; itemPath: string }[] = [];
  private queueTimeout: NodeJS.Timeout | null = null;

  private index = new Map<string, DataPackage>(); // id -> item
  private pathIndex = new Map<string, string>();

  private fileIndex = new Map<string, FileMetadata>(); // fileId -> fileMetadata
  private hashIndex = new Map<string, string>(); // hash -> fileId

  private dirIndex = new Map<string, DirMetadata>(); // parentId -> dirMetadata
  private parentIndex = new Map<string, string>(); // fileId (childId) -> parentId

  private networkImportedPaths = new Set<string>();

  private limitHash = PLimit(5);

  constructor(hasher: IHash, storage: IStorage) {
    super();

    if (!hasher || !storage) {
      throw new Error(`Falha em inicializar FileCatalog`);
    }

    this.hasher = hasher;
    this.storage = storage;
  }

  async start() {
    const arr: DataPackage[] = await this.storage.load();

    for (const dt of arr) {
      if (dt.type === 'file') {
        this.fileIndex.set(dt.id, dt);
        this.hashIndex.set(dt.hash, dt.id);
        this.parentIndex.set(dt.id, dt.parentId);
      } else if (dt.type === 'dir') {
        this.dirIndex.set(dt.id, dt);
      }

      this.index.set(dt.id, dt);
    }

    for (const dt of arr) {
      const absolutePath = this.buildPath(dt.id);

      // "C:\...\files\fotos\praia.jpg" -> "ID-DA-PRAIA"
      this.pathIndex.set(absolutePath, dt.id);
    }

    this.startWatching();
  }

  private startWatching() {
    const watchPath = path.resolve(process.cwd(), 'files');
    const watcher = chokidar.watch(watchPath, {
      ignoreInitial: true,
      persistent: true,
      awaitWriteFinish: { stabilityThreshold: 1500, pollInterval: 100 },
      ignored: ['**/.inprogress/**'],
    });

    watcher.on('addDir', (p) => this.queueEvent('dir', p));
    watcher.on('add', (p) => this.queueEvent('file', p));
    // watcher.on('unlink', (p) => this.onRemove(p));
  }

  private queueEvent(type: 'dir' | 'file', itemPath: string) {
    this.eventQueue.push({ type, itemPath });

    if (this.queueTimeout) {
      clearTimeout(this.queueTimeout);
    }

    this.queueTimeout = setTimeout(() => {
      this.processQueue();
    }, 250);
  }

  private async processQueue() {
    const items = [...this.eventQueue];
    this.eventQueue = [];

    items.sort((a, b) => {
      if (a.type === 'dir' && b.type === 'file') return -1;
      if (a.type === 'file' && b.type === 'dir') return 1;
      return 0;
    });

    for (const item of items) {
      if (item.type === 'dir') {
        this.onAddDir(item.itemPath);
      } else {
        this.onAdd(item.itemPath);
      }
    }
  }

  public buildPath(targetId: string): string {
    let currentId = targetId;

    const pathSegments: string[] = [];

    while (currentId) {
      const item = this.index.get(currentId);

      if (!item) break;

      pathSegments.unshift(item.name);

      currentId = item.parentId;
    }

    return path.resolve(process.cwd(), 'files', ...pathSegments);
  }

  public async onAddDir(dirPath: string) {
    return this.withWriteLock(async () => {
      if (this.networkImportedPaths.has(dirPath)) {
        this.networkImportedPaths.delete(dirPath);
        return;
      }

      const dirMetadata: DirMetadata = await this.registerDir(dirPath, {
        origin: 'local',
      });

      if (dirMetadata) {
        this.emit('node:added', { dirMetadata, origin: 'network' });
      }
    });
  }

  public async onAdd(filePath: string) {
    if (path.extname(filePath) === '') {
      return;
    }

    return this.withWriteLock(async () => {
      if (this.networkImportedPaths.has(filePath)) {
        this.networkImportedPaths.delete(filePath);
        return;
      }

      const fileMeta = await this.limitHash(() =>
        this.registerFile(filePath, { origin: 'local' }),
      );

      if (fileMeta) {
        this.emit('node:added', { fileMeta, origin: 'local' });
      }
    });
  }

  public async registerDir(
    dirPath: string,
    options: { origin?: 'local' | 'network' } = {},
  ): Promise<DirMetadata> {
    const origin = options.origin ?? 'local';

    if (origin === 'network') {
      this.networkImportedPaths.add(dirPath);
    }

    if (this.pathIndex.has(dirPath)) {
      const existingId = this.pathIndex.get(dirPath);
      if (existingId) {
        return this.index.get(existingId) as DirMetadata;
      }
    }

    const parentPath = path.dirname(dirPath);
    const rootPath = path.resolve(process.cwd(), 'files');

    let parentId = '';

    if (parentPath !== rootPath) {
      parentId = this.pathIndex.get(parentPath) || '';

      if (!parentId) {
        console.warn(
          `[Aviso] Pasta pai não encontrada no índice para: ${dirPath}`,
        );
      }
    }

    const dirMeta: DirMetadata = {
      id: ulid(),
      parentId: parentId,
      name: path.basename(dirPath),
      size: 0,
      hash: '',
      childId: [],
      isDownloaded: origin === 'local' ? 'not_downloaded' : 'downloaded',
      isSync: origin === 'local' ? 'unsynchronized' : 'synchronized',
      privacy: 'public',
      type: 'dir',
      origin,
    };

    if (parentId) {
      const parentMeta = this.index.get(parentId);

      if (parentMeta && parentMeta.type === 'dir') {
        parentMeta.childId.push(dirMeta.id);

        this.index.set(parentId, parentMeta);
        this.dirIndex.set(parentId, parentMeta);
      }
    }

    this.index.set(dirMeta.id, dirMeta);
    this.dirIndex.set(dirMeta.id, dirMeta);
    this.pathIndex.set(dirPath, dirMeta.id);

    const dataToSave = Array.from(this.index.values());
    const isSave = await this.storage.save(dataToSave);

    if (!isSave) {
      throw new Error(
        `Falha em atualizar base de dados ao salvar o diretório ${dirMeta.name}`,
      );
    }

    return dirMeta;
  }

  public async registerFile(
    filePath: string,
    options: { origin?: 'local' | 'network' } = {},
  ): Promise<FileMetadata> {
    const origin = options.origin ?? 'local';

    if (origin === 'network') {
      this.networkImportedPaths.add(filePath);
    }

    if (this.pathIndex.has(filePath)) {
      const existingId = this.pathIndex.get(filePath);
      if (existingId) return this.index.get(existingId) as FileMetadata;
    }

    const [hash, stat] = await Promise.all([
      this.hasher.hashFile(filePath),
      fse.stat(filePath),
    ]);

    const parentPath = path.dirname(filePath);
    const rootPath = path.resolve(process.cwd(), 'files');

    let parentId = '';

    if (parentPath !== rootPath) {
      parentId = this.pathIndex.get(parentPath) || '';

      if (!parentId) {
        console.warn(
          `[Aviso] Pasta pai não encontrada no índice para o arquivo: ${filePath}`,
        );
      }
    }

    if (this.hashIndex.has(hash)) {
      const existingId = this.hashIndex.get(hash);

      if (!existingId) throw new Error('Falha durante o calculo de hash');

      const existing = this.index.get(existingId) as FileMetadata;

      if (!existing)
        throw new Error('Falha: Hash existe mas arquivo sumiu do índice');

      const currentAbsolutePath = this.buildPath(existing.id);
      if (currentAbsolutePath !== filePath) {
        // Futura lógica de atualização de parentId
      }

      return existing;
    }

    const fileMeta: FileMetadata = {
      id: ulid(),
      parentId: parentId,
      type: 'file',
      name: path.basename(filePath, path.extname(filePath)),
      ext: path.extname(filePath),
      hash,
      size: stat.size,
      privacy: 'public',
      isDownloaded: origin === 'local' ? 'not_downloaded' : 'downloaded',
      isSync: origin === 'local' ? 'unsynchronized' : 'synchronized',
      origin,
    };

    if (parentId) {
      const parentMeta = this.index.get(parentId);

      if (parentMeta && parentMeta.type === 'dir') {
        parentMeta.childId.push(fileMeta.id);

        this.index.set(parentId, parentMeta);
      }
    }

    this.index.set(fileMeta.id, fileMeta);
    this.fileIndex.set(fileMeta.id, fileMeta);
    this.hashIndex.set(hash, fileMeta.id);
    this.pathIndex.set(filePath, fileMeta.id);
    this.parentIndex.set(fileMeta.id, parentId);

    const dataToSave = Array.from(this.index.values());
    const isSave = await this.storage.save(dataToSave);

    if (!isSave) {
      throw new Error(
        `Falha em atualizar base de dados ao salvar ${fileMeta.name}`,
      );
    }

    await fse.move(filePath, path.join(rootPath, fileMeta.id));

    return fileMeta;
  }

  public async fetchServerFiles(): Promise<DataPackage[]> {
    return Array.from(this.index.values());
  }

  public async fetchFile(fileId: string): Promise<DataPackage | null> {
    return this.index.get(fileId) || null;
  }

  public async syncRegister(fileMetadata: DataPackage): Promise<boolean> {
    const existingMeta = this.index.get(fileMetadata.id);

    const syncronizedPackage: DataPackage = {
      ...fileMetadata,
      isDownloaded: 'downloaded',
      isSync: 'synchronized',
    };

    if (!existingMeta) {
      if (syncronizedPackage.parentId) {
        const parentMeta = this.index.get(syncronizedPackage.parentId);

        if (parentMeta && parentMeta.type === 'dir') {
          if (!parentMeta.childId.includes(syncronizedPackage.id)) {
            parentMeta.childId.push(syncronizedPackage.id);
            this.index.set(parentMeta.id, parentMeta);
          }
        }
      }
    }

    this.index.set(syncronizedPackage.id, syncronizedPackage);

    if (syncronizedPackage.type === 'dir') {
      this.dirIndex.set(
        syncronizedPackage.id,
        syncronizedPackage as DirMetadata,
      );
    } else {
      this.fileIndex.set(
        syncronizedPackage.id,
        syncronizedPackage as FileMetadata,
      );
      this.hashIndex.set(syncronizedPackage.hash, syncronizedPackage.id);
    }

    const dataToSave = Array.from(this.index.values());
    const isSave = await this.storage.save(dataToSave);

    if (!isSave) {
      throw new Error(
        `Falha em atualizar base de dados durante o syncRegister`,
      );
    }

    return true;
  }

  private writeLock: Promise<void> = Promise.resolve();

  private async withWriteLock<T>(fn: () => Promise<T>): Promise<T> {
    let release!: () => void;
    const next = new Promise<void>((r) => (release = r));

    const prev = this.writeLock;
    this.writeLock = this.writeLock.then(() => next);

    await prev;
    try {
      return await fn();
    } finally {
      release();
    }
  }

  // private async onRemove(filePath: string) {
  //   return this.withWriteLock(async () => {
  //     const fileMeta = await this.unlinkFile(filePath);
  //     if (fileMeta) {
  //       this.emit('file:removed', fileMeta);
  //     }
  //   });
  // }

  // private async unlinkFile(filePath: string): Promise<FileMetadata> {
  //   const fileId = this.pathIndex.get(filePath);

  //   if (!fileId) {
  //     throw new Error(`Falha em encontrar o arquivo ${filePath}`);
  //   }

  //   const metadata = this.index.get(fileId);

  //   if (!metadata) {
  //     throw new Error(`Falha em encontrar os metadados do arquivo ${filePath}`);
  //   }

  //   this.index.delete(fileId);
  //   this.hashIndex.delete(metadata.hash);
  //   this.pathIndex.delete(filePath);

  //   const dataToSave = Array.from(this.index.values());
  //   const isSave = await this.storage.save(dataToSave);

  //   if (!isSave) {
  //     throw new Error(`Falha em atualizar base de dados`);
  //   }

  //   return metadata;
  // }
}

export default FileCatalog;
