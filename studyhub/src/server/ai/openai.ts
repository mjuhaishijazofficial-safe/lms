/**
 * A small OpenAI client using plain fetch, so there is no SDK to keep up to date. It asks for an answer in an exact
 * JSON shape (structured outputs) and turns every way the call can fail into one of a few errors the admin screen can
 * explain in plain words. Nothing here reads the environment: the key and model are passed in.
 */

export type JsonSchemaSpec = { name: string; strict: boolean; schema: Record<string, unknown> };
export type LlmUsage = { inputTokens: number; outputTokens: number };
export type LlmResult = { data: unknown; usage: LlmUsage };

export interface LlmClient {
  complete(args: { system: string; user: string; schema: JsonSchemaSpec }): Promise<LlmResult>;
}

export type AiErrorKind =
  | "config" // no key or model set
  | "auth" // the key was refused
  | "quota" // out of credit
  | "rate" // too many requests right now
  | "timeout" // took longer than we can wait
  | "server" // the provider had a problem
  | "refused" // the model declined to answer
  | "bad_output"; // the answer was cut off or was not the shape we asked for

export class AiError extends Error {
  constructor(readonly kind: AiErrorKind, message: string) {
    super(message);
    this.name = "AiError";
  }
  /** Worth trying again with the same input. */
  get retryable() {
    return this.kind === "rate" || this.kind === "timeout" || this.kind === "server" || this.kind === "bad_output";
  }
}

export type OpenAiOptions = {
  apiKey: string;
  model: string;
  baseUrl?: string;
  /** Give up on one request after this long. Kept under the hosting time limit. */
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
};

/** Provider messages are shown to the admin, so anything that looks like a key is removed first. */
const redact = (s: string) => s.replace(/sk-[A-Za-z0-9_-]{6,}/g, "[key removed]");

const asRecord = (v: unknown): Record<string, unknown> => (v && typeof v === "object" ? (v as Record<string, unknown>) : {});

export class OpenAiClient implements LlmClient {
  constructor(private readonly opts: OpenAiOptions) {
    if (!opts.apiKey) throw new AiError("config", "No OpenAI key is set.");
    if (!opts.model) throw new AiError("config", "No OpenAI model is set.");
  }

  async complete({ system, user, schema }: { system: string; user: string; schema: JsonSchemaSpec }): Promise<LlmResult> {
    const { apiKey, model, baseUrl = "https://api.openai.com/v1", timeoutMs = 50_000, fetchImpl = fetch } = this.opts;

    let res: Response;
    try {
      res = await fetchImpl(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model,
          messages: [{ role: "system", content: system }, { role: "user", content: user }],
          response_format: { type: "json_schema", json_schema: schema },
        }),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (err) {
      if (err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError")) {
        throw new AiError("timeout", "OpenAI took too long to answer.");
      }
      throw new AiError("server", "Could not reach OpenAI.");
    }

    if (!res.ok) throw await this.errorFor(res);

    const body = asRecord(await res.json().catch(() => null));
    const choice = asRecord((body.choices as unknown[] | undefined)?.[0]);
    const message = asRecord(choice.message);

    if (typeof message.refusal === "string" && message.refusal) throw new AiError("refused", "The model declined to answer for this text.");
    if (choice.finish_reason === "length") throw new AiError("bad_output", "The answer was cut off because it was too long.");
    if (typeof message.content !== "string") throw new AiError("bad_output", "OpenAI returned an empty answer.");

    let data: unknown;
    try {
      data = JSON.parse(message.content);
    } catch {
      throw new AiError("bad_output", "OpenAI returned an answer that was not valid JSON.");
    }
    const usage = asRecord(body.usage);
    return { data, usage: { inputTokens: Number(usage.prompt_tokens) || 0, outputTokens: Number(usage.completion_tokens) || 0 } };
  }

  private async errorFor(res: Response): Promise<AiError> {
    const detail = asRecord(asRecord(await res.json().catch(() => null)).error);
    const code = String(detail.code ?? detail.type ?? "");
    if (res.status === 401 || res.status === 403) return new AiError("auth", "OpenAI did not accept the key. Check that it is correct and still active.");
    // A 429 means either "slow down" or "you have no credit"; only the error code tells them apart.
    if (res.status === 429 && /insufficient_quota|billing/i.test(code)) return new AiError("quota", "The OpenAI account is out of credit.");
    if (res.status === 429) return new AiError("rate", "OpenAI is asking us to slow down.");
    if (res.status === 404 || /model_not_found/i.test(code)) return new AiError("config", "OpenAI does not recognise that model name.");
    // The request itself was refused (too long, or a setting the model does not accept): repeating it cannot help.
    if (res.status === 400) return new AiError("config", `OpenAI rejected the request${detail.message ? `: ${redact(String(detail.message)).slice(0, 160)}` : "."}`);
    return new AiError("server", "OpenAI had a problem. Trying again usually works.");
  }
}
