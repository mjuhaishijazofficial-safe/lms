import { describe, expect, it, vi } from "vitest";
import { AiError, OpenAiClient, type LlmClient, type LlmResult } from "@/server/ai/openai";
import { generateLesson, MAX_CHARS_PER_REQUEST } from "@/server/ai/generate-lesson";

const usage = { inputTokens: 100, outputTokens: 50 };
const noSleep = async () => {};
const chapter = { title: "Lesson 43: Writing", text: "Cause and effect tasks. ".repeat(40) };

const notes = (extra: object = {}) => ({
  subtitle: "About writing",
  topics: [{ title: "Cause and Effect", body: "<p>Causes lead to effects.</p>" }],
  definitions: [{ term: "Exposition", definition: "Writing that explains.", example: "" }],
  ...extra,
});
const mcq = (i: number, extra: object = {}) => ({ question: `Question ${i}?`, options: ["A", "B", "C", "D"], answer: i % 4, explanation: "Because.", ...extra });

/** A stand-in model: answers notes requests and question requests from the functions given. */
function fake(handlers: { notes?: () => unknown; mcqs?: () => unknown }): LlmClient & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    async complete({ schema }): Promise<LlmResult> {
      calls.push(schema.name);
      const h = schema.name === "lesson_notes" ? handlers.notes : handlers.mcqs;
      return { data: h?.() ?? {}, usage };
    },
  };
}

describe("generateLesson", () => {
  it("builds a lesson from one notes request and one questions request", async () => {
    const client = fake({ notes: () => notes(), mcqs: () => ({ mcqs: [mcq(1), mcq(2), mcq(3)] }) });
    const r = await generateLesson(client, chapter, { sleep: noSleep });
    expect(client.calls).toEqual(["lesson_notes", "lesson_mcqs"]);
    expect(r.lesson.topics).toHaveLength(1);
    expect(r.lesson.definitions[0]).toEqual({ term: "Exposition", definition: "Writing that explains." }); // blank example dropped
    expect(r.lesson.mcqs).toHaveLength(3);
    expect(r.usage).toEqual({ inputTokens: 200, outputTokens: 100 });
    expect(r.warnings).toEqual([]);
  });

  it("sanitises what the model wrote, exactly like a lesson pasted by hand", async () => {
    const client = fake({ notes: () => notes({ topics: [{ title: "T", body: "<p onclick='x()'>Hi</p><script>bad()</script>" }] }), mcqs: () => ({ mcqs: [mcq(1)] }) });
    const r = await generateLesson(client, chapter, { sleep: noSleep });
    expect(r.lesson.topics[0].body).toBe("<p>Hi</p>");
  });

  it("drops malformed questions and says so, instead of failing the whole chapter", async () => {
    const client = fake({
      notes: () => notes(),
      mcqs: () => ({
        mcqs: [
          mcq(1),
          mcq(2, { answer: 9 }), // answer outside the options
          mcq(3, { options: ["Same", "same", "X", "Y"] }), // duplicate options
          mcq(4, { options: ["only one"] }),
          mcq(5, { question: "   " }),
          mcq(6),
        ],
      }),
    });
    const r = await generateLesson(client, chapter, { sleep: noSleep });
    expect(r.lesson.mcqs.map((q) => q.question)).toEqual(["Question 1?", "Question 6?"]);
    expect(r.warnings[0]).toMatch(/4 questions were discarded/);
  });

  it("removes repeated questions", async () => {
    const client = fake({ notes: () => notes(), mcqs: () => ({ mcqs: [mcq(1), mcq(1), mcq(2)] }) });
    expect((await generateLesson(client, chapter, { sleep: noSleep })).lesson.mcqs).toHaveLength(2);
  });

  it("retries a temporary failure and then succeeds", async () => {
    let n = 0;
    const client: LlmClient = {
      async complete({ schema }) {
        if (schema.name === "lesson_notes" && n++ < 2) throw new AiError("server", "hiccup");
        return { data: schema.name === "lesson_notes" ? notes() : { mcqs: [mcq(1)] }, usage };
      },
    };
    const r = await generateLesson(client, chapter, { sleep: noSleep });
    expect(n).toBe(3);
    expect(r.lesson.topics).toHaveLength(1);
  });

  it("gives up after three attempts on a persistent failure", async () => {
    const complete = vi.fn(async () => { throw new AiError("timeout", "slow"); });
    await expect(generateLesson({ complete }, chapter, { sleep: noSleep })).rejects.toMatchObject({ kind: "timeout" });
    expect(complete).toHaveBeenCalledTimes(3);
  });

  it("does not retry when the key is refused or the credit has run out", async () => {
    for (const kind of ["auth", "quota", "config"] as const) {
      const complete = vi.fn(async () => { throw new AiError(kind, kind); });
      await expect(generateLesson({ complete }, chapter, { sleep: noSleep })).rejects.toMatchObject({ kind });
      expect(complete).toHaveBeenCalledTimes(1);
    }
  });

  it("keeps the notes when only the questions fail", async () => {
    const client: LlmClient = {
      async complete({ schema }) {
        if (schema.name === "lesson_mcqs") throw new AiError("server", "down");
        return { data: notes(), usage };
      },
    };
    const r = await generateLesson(client, chapter, { sleep: noSleep });
    expect(r.lesson.topics).toHaveLength(1);
    expect(r.lesson.mcqs).toEqual([]);
    expect(r.warnings.join(" ")).toMatch(/practice questions could not be generated/);
  });

  it("stops at once if credit runs out while writing the questions", async () => {
    const client: LlmClient = {
      async complete({ schema }) {
        if (schema.name === "lesson_mcqs") throw new AiError("quota", "no credit");
        return { data: notes(), usage };
      },
    };
    await expect(generateLesson(client, chapter, { sleep: noSleep })).rejects.toMatchObject({ kind: "quota" });
  });

  it("fails clearly when the model returns no topics, or the chapter has no text", async () => {
    await expect(generateLesson(fake({ notes: () => ({ subtitle: "s", topics: [], definitions: [] }) }), chapter, { sleep: noSleep })).rejects.toThrow(/no usable topics/);
    await expect(generateLesson(fake({}), { title: "x", text: "   " }, { sleep: noSleep })).rejects.toThrow(/no text/);
  });

  it("does a long chapter in pieces and merges the results without repeating terms", async () => {
    const long = { title: "Long", text: Array.from({ length: 80 }, (_, i) => `Paragraph ${i}. ${"filler words ".repeat(30)}`).join("\n\n") };
    expect(long.text.length).toBeGreaterThan(MAX_CHARS_PER_REQUEST);
    let part = 0;
    const client = fake({
      notes: () => notes({ topics: [{ title: `Topic ${++part}`, body: "<p>x</p>" }] }), // same definition term every time
      mcqs: () => ({ mcqs: [mcq(part * 10 + 1), mcq(part * 10 + 2)] }),
    });
    const r = await generateLesson(client, long, { mcqCount: 6, sleep: noSleep });
    const noteCalls = client.calls.filter((c) => c === "lesson_notes").length;
    expect(noteCalls).toBeGreaterThan(1);
    expect(r.lesson.topics).toHaveLength(noteCalls);
    expect(r.lesson.definitions).toHaveLength(1); // "Exposition" appeared in every piece, kept once
  });

  it("can skip questions entirely", async () => {
    const client = fake({ notes: () => notes() });
    const r = await generateLesson(client, chapter, { mcqCount: 0, sleep: noSleep });
    expect(client.calls).toEqual(["lesson_notes"]);
    expect(r.lesson.mcqs).toEqual([]);
  });
});

describe("OpenAiClient", () => {
  const ask = (fetchImpl: typeof fetch) =>
    new OpenAiClient({ apiKey: "sk-test", model: "test-model", fetchImpl }).complete({ system: "s", user: "u", schema: { name: "x", strict: true, schema: {} } });
  const respond = (status: number, body: unknown) => (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;
  const ok = (content: string, extra: object = {}) =>
    respond(200, { choices: [{ finish_reason: "stop", message: { content } }], usage: { prompt_tokens: 12, completion_tokens: 7 }, ...extra });

  it("returns the parsed answer and the token counts", async () => {
    expect(await ask(ok('{"a":1}'))).toEqual({ data: { a: 1 }, usage: { inputTokens: 12, outputTokens: 7 } });
  });

  it("sends the key, the model and the schema, and nothing else it should not", async () => {
    const fetchImpl = vi.fn(ok("{}"));
    await ask(fetchImpl as unknown as typeof fetch);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.openai.com/v1/chat/completions");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer sk-test");
    const body = JSON.parse(init.body as string);
    expect(body.model).toBe("test-model");
    expect(body.response_format.type).toBe("json_schema");
    expect(body.messages.map((m: { role: string }) => m.role)).toEqual(["system", "user"]);
  });

  it("tells apart a refused key, no credit, and being asked to slow down", async () => {
    await expect(ask(respond(401, { error: { code: "invalid_api_key" } }))).rejects.toMatchObject({ kind: "auth" });
    await expect(ask(respond(429, { error: { code: "insufficient_quota" } }))).rejects.toMatchObject({ kind: "quota" });
    await expect(ask(respond(429, { error: { code: "rate_limit_exceeded" } }))).rejects.toMatchObject({ kind: "rate", message: expect.stringContaining("slow down") });
  });

  it("marks a bad model name and a rejected request as not worth retrying", async () => {
    const nf = await ask(respond(404, { error: { code: "model_not_found" } })).catch((e) => e);
    expect(nf.kind).toBe("config");
    expect(nf.retryable).toBe(false);
    const bad = await ask(respond(400, { error: { message: "context length exceeded" } })).catch((e) => e);
    expect(bad).toMatchObject({ kind: "config" });
    expect(bad.retryable).toBe(false);
  });

  it("marks provider errors and timeouts as worth retrying", async () => {
    const err = await ask(respond(503, {})).catch((e) => e);
    expect(err).toMatchObject({ kind: "server" });
    expect(err.retryable).toBe(true);
    const timeout = await ask((async () => { throw Object.assign(new Error("t"), { name: "TimeoutError" }); }) as unknown as typeof fetch).catch((e) => e);
    expect(timeout).toMatchObject({ kind: "timeout" });
    expect(timeout.retryable).toBe(true);
  });

  it("rejects a truncated, refused, empty or non-JSON answer", async () => {
    await expect(ask(respond(200, { choices: [{ finish_reason: "length", message: { content: '{"a"' } }] }))).rejects.toMatchObject({ kind: "bad_output" });
    await expect(ask(respond(200, { choices: [{ finish_reason: "stop", message: { content: null, refusal: "no" } }] }))).rejects.toMatchObject({ kind: "refused" });
    await expect(ask(respond(200, { choices: [{ finish_reason: "stop", message: {} }] }))).rejects.toMatchObject({ kind: "bad_output" });
    await expect(ask(ok("not json at all"))).rejects.toMatchObject({ kind: "bad_output" });
  });

  it("refuses to be built without a key or a model", () => {
    expect(() => new OpenAiClient({ apiKey: "", model: "m" })).toThrow(/No OpenAI key/);
    expect(() => new OpenAiClient({ apiKey: "k", model: "" })).toThrow(/No OpenAI model/);
  });

  it("removes anything that looks like a key from a message it passes on", async () => {
    const err = await ask(respond(400, { error: { message: "bad request for key sk-proj-abcdef1234567890XYZ" } })).catch((e) => e);
    expect(err.message).toContain("[key removed]");
    expect(err.message).not.toContain("abcdef1234567890");
  });

  it("never puts the key in an error message", async () => {
    const err = await ask(respond(401, { error: { message: "Incorrect API key provided: sk-test" } })).catch((e) => e);
    expect(String(err.message)).not.toContain("sk-test");
  });
});
