/**
 * Where uploaded study files live. The database stores only the returned `key`.
 * To move to S3, R2 or Supabase Storage, add another implementation and select it in storage/index.ts.
 */
export interface StorageProvider {
  put(key: string, data: Buffer, meta: { contentType: string }): Promise<void>;
  /** Streams the file, or returns null if it does not exist. */
  get(key: string): Promise<{ stream: ReadableStream<Uint8Array>; size: number } | null>;
  /** Removing a key that does not exist is not an error. */
  delete(key: string): Promise<void>;
}

/** Storage keys are random, extension-suffixed and never derived from user input. */
export const STORAGE_KEY_PATTERN = /^[a-f0-9]{48}\.(pdf|doc|docx|ppt|pptx|xls|xlsx|txt|jpg|jpeg|png)$/;
