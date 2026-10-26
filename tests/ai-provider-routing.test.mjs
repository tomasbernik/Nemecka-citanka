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
  groqReviewModel: "qwen/qwen3.8-27b",
};

test("keeps at least one full Groq TPM window between large requests", () => {
  assert.equal(GROQ_COOLDOWN_SECONDS, 65);
});

test("starts with the primary Groq model and exposes the repair model", () => {
  assert.deepEqual(selectArticleAiTarget({ phase: "draft", attempt: 1, ...config }), {
    provider: "groq",
    apiKey: "groq-key",
    model: "openai/gpt-oss-120b",
    repairModel: "openai/gpt-oss-20b",
  });
  assert.equal(selectArticleAiTarget({ attempt: 2, ...config }).model, "openai/gpt-oss-120b");
});

test("uses a different model for the independent review", () => {
  assert.deepEqual(selectArticleAiTarget({ phase: "review", attempt: 1, ...config }), {
    provider: "groq",
    apiKey: "groq-key",
    model: "qwen/qwen3.8-27b",
    repairModel: "openai/gpt-oss-20b",
  });
  assert.equal(selectArticleAiTarget({ phase: "review", attempt: 13, ...config }).model, "qwen/qwen3.8-27b");
});

test("switches an empty or malformed independent review to the non-Qwen fallback", () => {
  assert.equal(selectArticleAiTarget({
    phase: "review",
    attempt: 2,
    lastErrorCode: "invalid_ai_output",
    ...config,
  }).model, "openai/gpt-oss-20b");
  assert.equal(selectArticleAiTarget({
    phase: "review",
    attempt: 2,
    lastErrorCode: "invalid_story_review",
    ...config,
  }).model, "openai/gpt-oss-20b");
});

test("uses the large writer for targeted repairs after the independent review", () => {
  assert.equal(selectArticleAiTarget({
    phase: "review",
    attempt: 5,
    completeStory: true,
    reviewCompleted: true,
    ...config,
  }).model, "openai/gpt-oss-120b");
});

test("keeps the large writer model for complete-story writing and materials retries", () => {
  assert.equal(selectArticleAiTarget({
    phase: "draft",
    attempt: 5,
    completeStory: true,
    ...config,
  }).model, "openai/gpt-oss-120b");
  assert.equal(selectArticleAiTarget({
    phase: "materials",
    attempt: 5,
    completeStory: true,
    ...config,
  }).model, "openai/gpt-oss-120b");
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
