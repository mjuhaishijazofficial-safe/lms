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
  // Lesson generation from handouts. Optional: without a key and a model the feature simply reports it is not set up.
  // An empty value in the hosting dashboard counts as not set.
  OPENAI_API_KEY: z.string().trim().optional().transform((v) => v || undefined),
  OPENAI_MODEL: z.string().trim().optional().transform((v) => v || undefined),
  // Only for testing against a stand-in server or a proxy. Leave empty to use OpenAI itself.
  OPENAI_BASE_URL: z.string().trim().optional().transform((v) => v || undefined),
  // What the model costs per million tokens, only used to show the admin an estimate of what a run cost.
  OPENAI_INPUT_PER_M: z.coerce.number().positive().optional().or(z.literal("").transform(() => undefined)),
  OPENAI_OUTPUT_PER_M: z.coerce.number().positive().optional().or(z.literal("").transform(() => undefined)),
});

export const env = schema.parse(process.env);
