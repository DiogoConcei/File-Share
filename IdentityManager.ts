import os from "os";
import path from "path";
import fse from "fs-extra";
import { ulid } from "ulid";
import { PeerIdentity } from "./interfaces";
import { EventEmitter } from "events";

export default class IdentityManager extends EventEmitter {
  private static readonly identityPath = path.resolve(
    process.cwd(),
    "json",
    "identity.json"
  );

  static async loadOrCreate(): Promise<PeerIdentity> {
    await fse.ensureDir(path.dirname(this.identityPath));

    if (await fse.pathExists(this.identityPath)) {
      return fse.readJson(this.identityPath);
    }

    const identity: PeerIdentity = {
      peerId: ulid(),
      displayName: os.hostname(),
      createdAt: new Date().toISOString(),
    };

    await this.write(identity);
    return identity;
  }

  private static async write(identity: PeerIdentity) {
    const tmp = this.identityPath + ".tmp";
    await fse.writeJson(tmp, identity, { spaces: 2 });
    await fse.move(tmp, this.identityPath, { overwrite: true });
  }
}
