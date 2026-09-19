import "server-only";
import { randomBytes } from "node:crypto";
import { env } from "@/server/env";
import { LocalStorage } from "./local";
import type { StorageProvider } from "./types";

let instance: StorageProvider | undefined;

export function getStorage(): StorageProvider {
  instance ??= new LocalStorage(env.STORAGE_LOCAL_DIR);
  return instance;
}

export const newStorageKey = (ext: string) => `${randomBytes(24).toString("hex")}.${ext}`;
