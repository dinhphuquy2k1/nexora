import { constants } from "node:fs";
import { open, realpath, lstat, unlink } from "node:fs/promises";
import { resolve, join, isAbsolute } from "node:path";
import { randomUUID, createHash } from "node:crypto";
import type { FileStorage, StoredBlob } from "../application/file-storage.port";
const ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
export class LocalStorage implements FileStorage {
  constructor(
    private readonly root: string,
    private readonly maxBytes = 16 * 1024 * 1024,
  ) {
    if (!isAbsolute(root) || resolve(root) !== root)
      throw new Error("Absolute canonical storage root required");
  }
  private async path(id: string): Promise<string> {
    if (!ID.test(id)) throw new Error("Invalid file ID");
    const stat = await lstat(this.root);
    if (
      stat.isSymbolicLink() ||
      !stat.isDirectory() ||
      (await realpath(this.root)) !== this.root
    )
      throw new Error("Unsafe storage root");
    return join(this.root, id);
  }
  async put(data: Buffer): Promise<StoredBlob> {
    if (!Buffer.isBuffer(data) || data.length > this.maxBytes)
      throw new Error("Storage size limit exceeded");
    const id = randomUUID(),
      path = await this.path(id);
    const file = await open(
      path,
      constants.O_WRONLY |
        constants.O_CREAT |
        constants.O_EXCL |
        constants.O_NOFOLLOW,
      0o600,
    );
    try {
      await file.writeFile(data);
      await file.sync();
    } catch (error) {
      await unlink(path);
      throw error;
    } finally {
      await file.close();
    }
    return {
      id,
      sizeBytes: data.length,
      sha256: createHash("sha256").update(data).digest("hex"),
    };
  }
  async read(id: string): Promise<Buffer> {
    const file = await open(
      await this.path(id),
      constants.O_RDONLY | constants.O_NOFOLLOW,
    );
    try {
      const stat = await file.stat();
      if (!stat.isFile() || stat.size > this.maxBytes)
        throw new Error("Unsafe stored file");
      return await file.readFile();
    } finally {
      await file.close();
    }
  }
  async remove(id: string): Promise<void> {
    await unlink(await this.path(id));
  }
  async isReady(): Promise<boolean> {
    let id: string | undefined;
    try {
      const probe = await this.put(Buffer.from("nexora-ready"));
      id = probe.id;
      return (await this.read(id)).equals(Buffer.from("nexora-ready"));
    } catch {
      return false;
    } finally {
      if (id) await this.remove(id).catch(() => {});
    }
  }
}
