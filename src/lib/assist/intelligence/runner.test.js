import { describe, it, expect } from "vitest";
import { runJsonPrompt, parseJsonLoose } from "./runner.js";

function fakeLlm(content, usage = { total_tokens: 123, prompt_tokens: 100, completion_tokens: 23 }) {
  return {
    chat: {
      completions: {
        create: async (req) => {
          fakeLlm.lastReq = req;
          return { choices: [{ message: { content } }], usage };
        },
      },
    },
  };
}

describe("parseJsonLoose", () => {
  it("parses plain JSON", () => {
    expect(parseJsonLoose('{"a":1}')).toEqual({ a: 1 });
  });
  it("strips ```json fences", () => {
    expect(parseJsonLoose('```json\n{"a":2}\n```')).toEqual({ a: 2 });
  });
  it("strips bare ``` fences", () => {
    expect(parseJsonLoose('```\n{"a":3}\n```')).toEqual({ a: 3 });
  });
  it("extracts the first JSON object embedded in prose", () => {
    expect(parseJsonLoose('Here:\n{"a":4}\nthanks')).toEqual({ a: 4 });
  });
  it("returns null on garbage rather than throwing", () => {
    expect(parseJsonLoose("not json at all")).toBeNull();
  });
});

describe("runJsonPrompt", () => {
  it("parses fenced JSON and captures tokens", async () => {
    const llm = fakeLlm('```json\n{"account_score":"77"}\n```');
    const { data, tokensUsed } = await runJsonPrompt({
      llm,
      model: "gpt-4o-mini",
      system: "sys",
      user: "usr",
    });
    expect(data).toEqual({ account_score: "77" });
    expect(tokensUsed).toEqual({ total_tokens: 123, prompt_tokens: 100, completion_tokens: 23 });
  });

  it("sends system+user messages, json response_format, and the model", async () => {
    const llm = fakeLlm('{"ok":true}');
    await runJsonPrompt({ llm, model: "m1", system: "S", user: "U" });
    const req = fakeLlm.lastReq;
    expect(req.model).toBe("m1");
    expect(req.response_format).toEqual({ type: "json_object" });
    expect(req.messages).toEqual([
      { role: "system", content: "S" },
      { role: "user", content: "U" },
    ]);
  });

  it("returns data:null when the model emits non-JSON", async () => {
    const llm = fakeLlm("sorry, no json");
    const { data } = await runJsonPrompt({ llm, model: "m", system: "s", user: "u" });
    expect(data).toBeNull();
  });
});
