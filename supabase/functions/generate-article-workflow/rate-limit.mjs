export const GROQ_RATE_LIMIT_FALLBACK_SECONDS = 65;
export const GROQ_RATE_LIMIT_BUFFER_MS = 1_500;

const finiteNumber = value => {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export function parseGroqDurationMs(value) {
  const text = String(value || "").trim().toLowerCase();
  if (!text) return null;
  if (/^\d+(?:\.\d+)?$/.test(text)) return Number(text) * 1_000;
  let total = 0;
  let matched = "";
  for (const part of text.matchAll(/(\d+(?:\.\d+)?)(ms|d|h|m|s)/g)) {
    const amount = Number(part[1]);
    const multiplier = { ms: 1, s: 1_000, m: 60_000, h: 3_600_000, d: 86_400_000 }[part[2]];
    total += amount * multiplier;
    matched += part[0];
  }
  return matched === text && Number.isFinite(total) ? total : null;
}

export function parseRetryAfterAt(value, nowMs = Date.now()) {
  const text = String(value || "").trim();
  if (!text) return null;
  const seconds = finiteNumber(text);
  if (seconds !== null && seconds >= 0) return nowMs + seconds * 1_000;
  const date = Date.parse(text);
  return Number.isFinite(date) && date >= nowMs ? date : null;
}

const headerNumber = (headers, name) => finiteNumber(headers.get(name)?.trim());
const resetAt = (headers, name, nowMs) => {
  const duration = parseGroqDurationMs(headers.get(name));
  return duration === null ? null : nowMs + duration;
};

export function getGroqRateLimitSchedule(headers, status = 200, nowMs = Date.now()) {
  const remainingTokens = headerNumber(headers, "x-ratelimit-remaining-tokens");
  const remainingRequests = headerNumber(headers, "x-ratelimit-remaining-requests");
  const tokenResetAt = resetAt(headers, "x-ratelimit-reset-tokens", nowMs);
  const requestResetAt = resetAt(headers, "x-ratelimit-reset-requests", nowMs);
  const retryAfterAt = parseRetryAfterAt(headers.get("retry-after"), nowMs);
  const tokensExhausted = remainingTokens !== null && remainingTokens <= 0;
  const requestsExhausted = remainingRequests !== null && remainingRequests <= 0;
  const exhausted = status === 429 || tokensExhausted || requestsExhausted;

  if (!exhausted) {
    return { exhausted: false, nextAttemptAtMs: nowMs, source: "available" };
  }

  const candidates = [];
  if (retryAfterAt !== null) candidates.push({ at: retryAfterAt, source: "retry-after" });
  if (tokensExhausted && tokenResetAt !== null) {
    candidates.push({ at: tokenResetAt, source: "token-reset" });
  }
  if (requestsExhausted && requestResetAt !== null) {
    candidates.push({ at: requestResetAt, source: "request-reset" });
  }
  // A 429 can occasionally omit the remaining counters while still exposing
  // the applicable reset. Prefer the short TPM reset before the much longer
  // request/day reset in that ambiguous case.
  if (status === 429 && remainingTokens === null && tokenResetAt !== null) {
    candidates.push({ at: tokenResetAt, source: "token-reset" });
  }
  if (status === 429 && remainingRequests === null && retryAfterAt === null
    && tokenResetAt === null && requestResetAt !== null) {
    candidates.push({ at: requestResetAt, source: "request-reset" });
  }

  if (!candidates.length) {
    return {
      exhausted: true,
      nextAttemptAtMs: nowMs + GROQ_RATE_LIMIT_FALLBACK_SECONDS * 1_000,
      source: "fallback",
    };
  }
  const selected = candidates.reduce((latest, item) => item.at > latest.at ? item : latest);
  return {
    exhausted: true,
    nextAttemptAtMs: Math.ceil(selected.at + GROQ_RATE_LIMIT_BUFFER_MS),
    source: selected.source,
  };
}

export function getNonRateLimitRetryDelaySeconds(attempt, code) {
  const index = Math.min(Math.max((Number(attempt) || 1) - 1, 0), 3);
  if (["invalid_ai_output", "invalid_story_output", "invalid_story_plan",
    "invalid_story_review", "invalid_materials_output", "groq_json_failed"].includes(code)) return 0;
  if (code === "groq_failed" || code === "ai_timeout_or_network_error") {
    return [2, 5, 15, 30][index];
  }
  return [1, 2, 5, 10][index];
}
