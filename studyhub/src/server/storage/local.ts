import "server-only";
import { createReadStream } from "node:fs";
import { mkdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { STORAGE_KEY_PATTERN, type StorageProvider } from "./types";

/** Files on the server's disk. Fine for one server; use an object store when you scale out. */
export class LocalStorage implements StorageProvider {
  private readonly root: string;

  constructor(dir: string) {
    // The storage folder is chosen at runtime, so tell the bundler not to trace it into the build output.
    this.root = path.resolve(/* turbopackIgnore: true */ process.cwd(), dir);
  }

  /** Resolves a key to a path, refusing anything that is not one of our generated keys (no traversal). */
  private pathFor(key: string): string {
    if (!STORAGE_KEY_PATTERN.test(key)) throw new Error("Invalid storage key");
    const full = path.join(this.root, key);
    if (path.dirname(full) !== this.root) throw new Error("Invalid storage key");
    return full;
  }

  async put(key: string, data: Buffer): Promise<void> {
    const file = this.pathFor(key);
    await mkdir(this.root, { recursive: true });
    await writeFile(file, data, { flag: "wx" }); // never overwrite an existing file
  }

  async get(key: string) {
    const file = this.pathFor(key);
    try {
      const info = await stat(file);
      if (!info.isFile()) return null;
      return { stream: Readable.toWeb(createReadStream(file)) as ReadableStream<Uint8Array>, size: info.size };
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw err;
    }
  }

  async delete(key: string): Promise<void> {
    await rm(this.pathFor(key), { force: true });
  }
}
