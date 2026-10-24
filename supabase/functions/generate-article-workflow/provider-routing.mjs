export function selectArticleAiTarget({
  attempt,
  lastErrorCode,
  groqKey,
  groqModel,
  geminiKey,
  geminiPrimaryModel,
  geminiFallbackModel,
}) {
  const normalizedAttempt = Number.isFinite(attempt) && attempt > 0 ? Math.floor(attempt) : 1;
  const retryGroqAfterRateLimit = lastErrorCode === "groq_limit_reached" && normalizedAttempt === 3;

  if (groqKey && (normalizedAttempt <= 2 || retryGroqAfterRateLimit || !geminiKey)) {
    return { provider: "groq", apiKey: groqKey, model: groqModel };
  }
  if (geminiKey) {
    return {
      provider: "gemini",
      apiKey: geminiKey,
      model: normalizedAttempt >= 5 ? geminiFallbackModel : geminiPrimaryModel,
    };
  }
  return null;
}
