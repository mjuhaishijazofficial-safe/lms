import "server-only";
import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.url(),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  // "local" = server disk; "database" = Postgres, for hosts with a read-only disk (Vercel). An S3-compatible driver is one new file behind the StorageProvider interface.
  STORAGE_DRIVER: z.enum(["local", "database"]).default("local"),
  STORAGE_LOCAL_DIR: z.string().default("./storage"),
  // Capped at 55 because next.config.ts sets the request body limit to 60 MB. Left unset here: the default
  // depends on STORAGE_DRIVER and is filled in below.
  MAX_UPLOAD_MB: z.coerce.number().int().positive().max(55).optional(),
});

const parsed = schema.parse(process.env);

// Hosts on the "database" driver (Vercel and similar) sit behind a platform request-body cap of their own —
// on Vercel's Hobby plan, around 4.5 MB — no matter what next.config.ts allows. A file under that ceiling still
// fails once the rest of the form (title, description, cookies) is added on top, so the default here leaves
// headroom. MAX_UPLOAD_MB in the hosting dashboard always overrides this; this is only what applies when it is
// left unset, so a fresh "database" deploy is safe by default instead of failing with a raw 413.
const DEFAULT_MAX_UPLOAD_MB = parsed.STORAGE_DRIVER === "database" ? 4 : 50;

export const env = { ...parsed, MAX_UPLOAD_MB: parsed.MAX_UPLOAD_MB ?? DEFAULT_MAX_UPLOAD_MB };
