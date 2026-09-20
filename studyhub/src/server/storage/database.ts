import "server-only";
import { db } from "@/server/db";
import { STORAGE_KEY_PATTERN, type StorageProvider } from "./types";

/** Files in the Postgres StoredFile table. For hosts without a writable disk; use an object store for large files. */
export class DatabaseStorage implements StorageProvider {
  private check(key: string) {
    if (!STORAGE_KEY_PATTERN.test(key)) throw new Error("Invalid storage key");
  }

  async put(key: string, data: Buffer): Promise<void> {
    this.check(key);
    await db.storedFile.create({ data: { key, data: new Uint8Array(data) } }); // a duplicate key fails, never overwrites
  }

  async get(key: string) {
    this.check(key);
    const row = await db.storedFile.findUnique({ where: { key }, select: { data: true } });
    if (!row) return null;
    const bytes = new Uint8Array(row.data);
    return {
      size: bytes.byteLength,
      stream: new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(bytes);
          controller.close();
        },
      }),
    };
  }

  async delete(key: string): Promise<void> {
    this.check(key);
    await db.storedFile.deleteMany({ where: { key } });
  }
}
