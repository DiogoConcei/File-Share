import { FileMetadata } from '../interfaces/fileMetadata.interfaces';
import fse from 'fs-extra';
import path from 'path';

interface SystemError {
  code: string;
}

class StorageService {
  private readonly dataFile = path.resolve(
    __dirname,
    process.cwd(),
    'json',
    'files-metadata.json',
  );
  private readonly backupFile = path.resolve(
    __dirname,
    process.cwd(),
    'json',
    'files-metadata-backup.json',
  );

  public async load(): Promise<FileMetadata[]> {
    try {
      return await fse.readJson(this.dataFile);
    } catch (error) {
      if (this.isSystemError(error) && error.code === 'ENOENT') {
        return [];
      }

      try {
        return await fse.readJson(this.backupFile);
      } catch (backupError) {
        throw new Error(
          'Falha crítica: Arquivo principal e backup estão ilegíveis.',
          { cause: backupError },
        );
      }
    }
  }

  public async save(files: FileMetadata[]): Promise<boolean> {
    const tmpFile = this.dataFile + '.tmp';

    try {
      await fse.writeJson(tmpFile, files, { spaces: 2 });

      await fse.move(tmpFile, this.dataFile, { overwrite: true });

      await fse.copy(this.dataFile, this.backupFile, { overwrite: true });
      return true;
    } catch (error) {
      console.error('Falha ao persistir dados no disco:', error);
      return false;
    }
  }

  private isSystemError(error: unknown): error is SystemError {
    return typeof error === 'object' && error !== null && 'code' in error;
  }
}

export const storageService = new StorageService();
