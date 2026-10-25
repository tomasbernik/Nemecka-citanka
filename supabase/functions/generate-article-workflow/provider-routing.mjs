export function selectArticleAiTarget({
  attempt,
  lastErrorCode,
  groqKey,
  groqModel,
  groqFallbackModel,
}) {
  const normalizedAttempt = Number.isFinite(attempt) && attempt > 0 ? Math.floor(attempt) : 1;
  if (!groqKey) return null;

  const useFallback = lastErrorCode === "groq_json_failed"
    || lastErrorCode === "groq_limit_reached"
    || normalizedAttempt === 3
    || normalizedAttempt >= 5;
  return {
    provider: "groq",
    apiKey: groqKey,
    model: useFallback ? groqFallbackModel : groqModel,
    repairModel: groqFallbackModel,
  };
}
