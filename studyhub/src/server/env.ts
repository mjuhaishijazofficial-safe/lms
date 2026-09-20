import "server-only";
import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.url(),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  // "local" = server disk; "database" = Postgres, for hosts with a read-only disk (Vercel). An S3-compatible driver is one new file behind the StorageProvider interface.
  STORAGE_DRIVER: z.enum(["local", "database"]).default("local"),
  STORAGE_LOCAL_DIR: z.string().default("./storage"),
  // Capped at 55 because next.config.ts sets the request body limit to 60 MB.
  MAX_UPLOAD_MB: z.coerce.number().int().positive().max(55).default(50),
});

export const env = schema.parse(process.env);
