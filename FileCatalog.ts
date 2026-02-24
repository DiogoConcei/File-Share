import { FileMetadata } from './interfaces';
import { EventEmitter } from 'events';
import { ulid } from 'ulid';
import chokidar from 'chokidar';
import path from 'path';
import fse from 'fs-extra';
import PLimit from 'p-limit';

interface IStorage {
  load(): Promise<FileMetadata[]>;
  save(meta: FileMetadata[]): Promise<boolean>;
}

interface IHash {
  hashFile(filePath: string): Promise<string>;
  isHashed(fileHash: string, newPath: string): Promise<boolean>;
}

class FileCatalog extends EventEmitter {
  private readonly hasher: IHash;
  private readonly storage: IStorage;

  private readonly dataFile = path.resolve(
    __dirname,
    'json',
    'files-metadata.json',
  );

  private index = new Map<string, FileMetadata>(); // fileId -> metadata
  private hashIndex = new Map<string, string>(); // hash -> fileId
  private pathIndex = new Map<string, string>(); // path -> fileId
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
    const isLoad = await this.storage.load();

    if (!isLoad) {
      throw new Error(`Falha em carregar base de dados`);
    }

    const arr: FileMetadata[] = await fse.readJson(this.dataFile);

    for (const f of arr) {
      this.index.set(f.fileId, f);
      this.hashIndex.set(f.hash, f.fileId);
      this.pathIndex.set(f.path, f.fileId);
    }

    this.startWatching();
  }

  private startWatching() {
    const watcher = chokidar.watch(path.resolve(__dirname, 'files'), {
      ignoreInitial: true,
      persistent: true,
      awaitWriteFinish: { stabilityThreshold: 1500, pollInterval: 100 },
      ignored: ['**/.inprogress/**'],
    });

    watcher.on('add', (p) => this.onAdd(p));
    watcher.on('unlink', (p) => this.onRemove(p));
  }

  public async onAdd(filePath: string) {
    console.log(`${filePath} has been added`);
    return this.withWriteLock(async () => {
      const fileMeta = await this.limitHash(() => this.registerFile(filePath));

      if (fileMeta) {
        this.emit('file:added', fileMeta);
      }
    });
  }

  private async onRemove(filePath: string) {
    return this.withWriteLock(async () => {
      const fileMeta = await this.unlinkFile(filePath);
      if (fileMeta) {
        this.emit('file:removed', fileMeta);
      }
    });
  }

  private async unlinkFile(filePath: string): Promise<FileMetadata> {
    const fileId = this.pathIndex.get(filePath);

    if (!fileId) {
      throw new Error(`Falha em encontrar o arquivo ${filePath}`);
    }

    const metadata = this.index.get(fileId);

    if (!metadata) {
      throw new Error(`Falha em encontrar os metadados do arquivo ${filePath}`);
    }

    this.index.delete(fileId);
    this.hashIndex.delete(metadata.hash);
    this.pathIndex.delete(filePath);

    const dataToSave = Array.from(this.index.values());
    const isSave = await this.storage.save(dataToSave);

    if (isSave) {
      throw new Error(`Falha em atualizar base de dados`);
    }

    return metadata;
  }

  public async registerFile(filePath: string): Promise<FileMetadata> {
    const [hash, stat] = await Promise.all([
      this.hasher.hashFile(filePath),
      fse.stat(filePath),
    ]);

    if (this.hashIndex.has(hash)) {
      const existingId = this.hashIndex.get(hash);

      if (!existingId) {
        throw new Error('Falha durante o calculo  de hash');
      }

      const existing = this.index.get(existingId);

      if (!existing) {
        throw new Error('Falha durante o calculo  de hash');
      }

      if (existing.path !== filePath) {
        existing.path = filePath;

        this.index.set(existing.fileId, existing);
      }

      return existing;
    }

    const meta: FileMetadata = {
      fileId: ulid(),
      name: path.basename(filePath, path.extname(filePath)),
      ext: path.extname(filePath),
      hash,
      path: filePath,
      isDownloaded: 'not_downloaded',
      isSync: 'unsynchronized',
      privacy: 'public',
      size: stat.size,
    };

    this.index.set(meta.fileId, meta);
    this.hashIndex.set(hash, meta.fileId);
    this.pathIndex.set(meta.path, meta.fileId);

    const dataToSave = Array.from(this.index.values());
    const isSave = await this.storage.save(dataToSave);

    if (isSave) {
      throw new Error(`Falha em atualizar base de dados`);
    }

    return meta;
  }

  // Método para externalizar a data do server
  public async fetchServerFiles(): Promise<FileMetadata[]> {
    try {
      const jsonData: FileMetadata[] = await fse.readJson(this.dataFile);

      if (jsonData.length === 0) return [];

      return jsonData;
    } catch (e) {
      console.error(`Falha em recuperar dados: `, e);
      return [];
    }
  }

  public async fetchFile(fileId: string): Promise<FileMetadata | null> {
    try {
      const data = await this.fetchServerFiles();
      const file = data.find((f) => f.fileId == fileId);

      if (!file) {
        console.log('Arquivos disponíveis:', JSON.stringify(data, null, 2));
        return null;
      }

      return file;
    } catch (e) {
      console.error(`Falha em filtrar capítulo individual: `, e);
      return null;
    }
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
}

export default FileCatalog;
