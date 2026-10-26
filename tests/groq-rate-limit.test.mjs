import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

import {
  GROQ_RATE_LIMIT_FALLBACK_SECONDS,
  getGroqRateLimitSchedule,
  getNonRateLimitRetryDelaySeconds,
  parseGroqDurationMs,
} from "../supabase/functions/generate-article-workflow/rate-limit.mjs";

const NOW = Date.parse("2026-10-26T10:00:00.000Z");

test("continues immediately when Groq reports available capacity", () => {
  const schedule = getGroqRateLimitSchedule(new Headers({
    "x-ratelimit-remaining-tokens": "1234",
    "x-ratelimit-remaining-requests": "10",
  }), 200, NOW);

  assert.equal(schedule.exhausted, false);
  assert.equal(schedule.nextAttemptAtMs, NOW);
});

test("Retry-After 12 schedules the retry with a 1.5 second safety buffer", () => {
  const schedule = getGroqRateLimitSchedule(new Headers({ "retry-after": "12" }), 429, NOW);

  assert.equal(schedule.exhausted, true);
  assert.equal(schedule.source, "retry-after");
  assert.ok(schedule.nextAttemptAtMs - NOW >= 13_000);
  assert.ok(schedule.nextAttemptAtMs - NOW <= 14_000);
});

test("uses the precise Groq token reset duration", () => {
  assert.equal(parseGroqDurationMs("2m59.56s"), 179_560);
  const schedule = getGroqRateLimitSchedule(new Headers({
    "x-ratelimit-remaining-tokens": "0",
    "x-ratelimit-reset-tokens": "7.66s",
  }), 429, NOW);

  assert.equal(schedule.source, "token-reset");
  assert.equal(schedule.nextAttemptAtMs, NOW + 7_660 + 1_500);
});

test("falls back to 65 seconds when a 429 has no usable timing headers", () => {
  const schedule = getGroqRateLimitSchedule(new Headers(), 429, NOW);

  assert.equal(schedule.source, "fallback");
  assert.equal(schedule.nextAttemptAtMs, NOW + GROQ_RATE_LIMIT_FALLBACK_SECONDS * 1_000);
});

test("validation failures do not trigger a rate-limit cooldown", () => {
  assert.equal(getNonRateLimitRetryDelaySeconds(1, "invalid_ai_output"), 0);
  assert.equal(getNonRateLimitRetryDelaySeconds(3, "invalid_materials_output"), 0);
  assert.equal(getNonRateLimitRetryDelaySeconds(1, "groq_failed"), 2);
});

test("a 429 requeues the same job record instead of creating another job", async () => {
  const source = await readFile(
    new URL("../supabase/functions/generate-article-workflow/index.ts", import.meta.url),
    "utf8",
  );
  const catchBlock = source.slice(source.indexOf("} catch (error) {", source.indexOf("async function runClaimedPhase")));

  assert.match(catchBlock, /status: `\$\{phase\}_queued`/);
  assert.match(catchBlock, /next_attempt_at: new Date\(retryAtMs\)\.toISOString\(\)/);
  assert.match(catchBlock, /await updateJob\(url, serviceKey, jobId, userId/);
  assert.doesNotMatch(catchBlock.slice(0, catchBlock.indexOf("Deno.serve")), /createGenerationJob|insertGenerationJob/);
});
