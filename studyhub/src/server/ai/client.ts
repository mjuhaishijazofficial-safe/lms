import "server-only";
import { env } from "@/server/env";
import { AiError, OpenAiClient, type LlmClient } from "./openai";

/** The model client for this deployment, or an error the admin can act on when it has not been set up. */
export function getLlmClient(): LlmClient {
  if (!env.OPENAI_API_KEY) throw new AiError("config", "Lesson generation is not set up yet: add OPENAI_API_KEY in the hosting settings.");
  if (!env.OPENAI_MODEL) throw new AiError("config", "Lesson generation is not set up yet: add OPENAI_MODEL in the hosting settings.");
  return new OpenAiClient({ apiKey: env.OPENAI_API_KEY, model: env.OPENAI_MODEL, baseUrl: env.OPENAI_BASE_URL });
}

/** What the admin screen may know about the setup. The key itself never leaves the server. */
export const aiStatus = () => ({
  ready: !!env.OPENAI_API_KEY && !!env.OPENAI_MODEL,
  model: env.OPENAI_MODEL ?? null,
  inputPerM: env.OPENAI_INPUT_PER_M ?? null,
  outputPerM: env.OPENAI_OUTPUT_PER_M ?? null,
});
