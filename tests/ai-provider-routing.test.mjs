import assert from "node:assert/strict";
import test from "node:test";

import { selectArticleAiTarget } from "../supabase/functions/generate-article-workflow/provider-routing.mjs";

const config = {
  groqKey: "groq-key",
  groqModel: "openai/gpt-oss-120b",
  geminiKey: "gemini-key",
  geminiPrimaryModel: "gemini-3.8-flash",
  geminiFallbackModel: "gemini-3.6-flash",
};

test("prefers Groq for the first two attempts", () => {
  assert.deepEqual(selectArticleAiTarget({ attempt: 1, ...config }), {
    provider: "groq",
    apiKey: "groq-key",
    model: "openai/gpt-oss-120b",
  });
  assert.equal(selectArticleAiTarget({ attempt: 2, ...config }).provider, "groq");
});

test("falls back to Gemini primary and then fallback model", () => {
  assert.deepEqual(selectArticleAiTarget({ attempt: 3, ...config }), {
    provider: "gemini",
    apiKey: "gemini-key",
    model: "gemini-3.8-flash",
  });
  assert.equal(selectArticleAiTarget({ attempt: 4, ...config }).model, "gemini-3.8-flash");
  assert.equal(selectArticleAiTarget({ attempt: 5, ...config }).model, "gemini-3.6-flash");
});

test("continues with the configured provider when only one API key exists", () => {
  assert.equal(selectArticleAiTarget({ attempt: 1, ...config, groqKey: "" }).provider, "gemini");
  assert.equal(selectArticleAiTarget({ attempt: 5, ...config, geminiKey: "" }).provider, "groq");
  assert.equal(selectArticleAiTarget({ attempt: 1, ...config, groqKey: "", geminiKey: "" }), null);
});
