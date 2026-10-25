import assert from "node:assert/strict";
import test from "node:test";

import {
  GROQ_COOLDOWN_SECONDS,
  selectArticleAiTarget,
} from "../supabase/functions/generate-article-workflow/provider-routing.mjs";

const config = {
  groqKey: "groq-key",
  groqModel: "openai/gpt-oss-120b",
  groqFallbackModel: "openai/gpt-oss-20b",
};

test("keeps at least one full Groq TPM window between large requests", () => {
  assert.equal(GROQ_COOLDOWN_SECONDS, 65);
});

test("starts with the primary Groq model and exposes the repair model", () => {
  assert.deepEqual(selectArticleAiTarget({ attempt: 1, ...config }), {
    provider: "groq",
    apiKey: "groq-key",
    model: "openai/gpt-oss-120b",
    repairModel: "openai/gpt-oss-20b",
  });
  assert.equal(selectArticleAiTarget({ attempt: 2, ...config }).model, "openai/gpt-oss-120b");
});

test("alternates to the smaller Groq model for later recovery", () => {
  assert.equal(selectArticleAiTarget({ attempt: 3, ...config }).model, "openai/gpt-oss-20b");
  assert.equal(selectArticleAiTarget({ attempt: 4, ...config }).model, "openai/gpt-oss-120b");
  assert.equal(selectArticleAiTarget({ attempt: 5, ...config }).model, "openai/gpt-oss-20b");
});

test("switches immediately to the smaller Groq model after an invalid JSON response", () => {
  assert.equal(selectArticleAiTarget({
    attempt: 2,
    lastErrorCode: "groq_json_failed",
    ...config,
  }).model, "openai/gpt-oss-20b");
});

test("switches model after a temporary Groq TPM limit", () => {
  assert.equal(selectArticleAiTarget({
    attempt: 2,
    lastErrorCode: "groq_limit_reached",
    ...config,
  }).model, "openai/gpt-oss-20b");
});

test("requires Groq because Gemini is not part of automatic routing", () => {
  assert.equal(selectArticleAiTarget({ attempt: 1, ...config, groqKey: "" }), null);
});
