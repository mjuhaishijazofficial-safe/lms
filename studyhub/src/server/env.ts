import "server-only";
import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.url(),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  // Only "local" exists today. An S3-compatible driver is one new file behind the StorageProvider interface.
  STORAGE_DRIVER: z.enum(["local"]).default("local"),
  STORAGE_LOCAL_DIR: z.string().default("./storage"),
  // Capped at 55 because next.config.ts sets the request body limit to 60 MB.
  MAX_UPLOAD_MB: z.coerce.number().int().positive().max(55).default(50),
});

export const env = schema.parse(process.env);
