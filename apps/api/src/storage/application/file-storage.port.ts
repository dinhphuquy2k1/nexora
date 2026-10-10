export interface StoredBlob {
  id: string;
  sha256: string;
  sizeBytes: number;
}
export interface FileStorage {
  put(data: Buffer): Promise<StoredBlob>;
  read(id: string): Promise<Buffer>;
  remove(id: string): Promise<void>;
  isReady(): Promise<boolean>;
}
export interface FileCatalog {
  register(blob: StoredBlob): Promise<void>;
  has(id: string): Promise<boolean>;
}
export class FilesService {
  constructor(
    private readonly storage: FileStorage,
    private readonly catalog: FileCatalog,
  ) {}
  async save(data: Buffer): Promise<StoredBlob> {
    const blob = await this.storage.put(data);
    try {
      await this.catalog.register(blob);
      return blob;
    } catch (error) {
      await this.storage.remove(blob.id);
      throw error;
    }
  }
  async read(id: string): Promise<Buffer> {
    if (!(await this.catalog.has(id))) throw new Error("Unknown file ID");
    return this.storage.read(id);
  }
}
