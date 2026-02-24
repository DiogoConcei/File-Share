import path from 'path';
import fse from 'fs-extra';
import { Readable } from 'stream';
import { pipeline } from 'node:stream/promises';

export default class StreamProcessor {
  private readonly baseDir = path.resolve(__dirname, 'files');
  private readonly progressDir = path.resolve(__dirname, '.inprogress');

  public async saveStream(stream: Readable, fileName: string) {
    const filePath = path.join(this.progressDir, fileName);
    const finalPath = path.join(this.baseDir, fileName);
    await pipeline(stream, fse.createWriteStream(filePath));
    await fse.move(filePath, finalPath);
    return finalPath;
  }

  public async getReadStream(filePath: string): Promise<Readable> {
    if (!(await fse.pathExists(filePath))) {
      throw new Error(`Arquivo não existe no disco: ${filePath}`);
    }

    return fse.createReadStream(filePath);
  }
}
