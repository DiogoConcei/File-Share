import fse from 'fs-extra';
import crypto from 'node:crypto';

export default class HashService {
  public async hashFile(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('sha256');
      const rs = fse.createReadStream(filePath);
      rs.on('data', (c) => hash.update(c));
      rs.on('end', () => resolve(hash.digest('hex')));
      rs.on('error', reject);
    });
  }

  public async isHashed(fileHash: string, newPath: string): Promise<boolean> {
    try {
      const calcHash = await this.hashFile(newPath);
      if (fileHash !== calcHash) return false;
      return true;
    } catch (e) {
      console.error(`Falha em verificar integridade do arquivo: `, e);
      return false;
    }
  }
}
