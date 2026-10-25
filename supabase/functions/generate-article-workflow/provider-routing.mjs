export const GROQ_COOLDOWN_SECONDS = 65;

export function selectArticleAiTarget({
  phase,
  attempt,
  lastErrorCode,
  groqKey,
  groqModel,
  groqFallbackModel,
  groqReviewModel,
  completeStory = false,
  reviewCompleted = false,
}) {
  const normalizedAttempt = Number.isFinite(attempt) && attempt > 0 ? Math.floor(attempt) : 1;
  if (!groqKey) return null;

  const isIndependentReview = phase === "review" && !reviewCompleted;
  const fallbackRequested = lastErrorCode === "groq_json_failed"
    || lastErrorCode === "groq_limit_reached"
    || (!isIndependentReview && (normalizedAttempt === 3 || normalizedAttempt >= 5));
  const requiresLargeWriter = completeStory && (phase !== "review" || reviewCompleted);
  const useFallback = fallbackRequested && !requiresLargeWriter;
  const preferredModel = isIndependentReview
    ? (groqReviewModel || groqFallbackModel)
    : groqModel;
  const fallbackModel = isIndependentReview ? groqModel : groqFallbackModel;
  return {
    provider: "groq",
    apiKey: groqKey,
    model: useFallback ? fallbackModel : preferredModel,
    repairModel: fallbackModel,
  };
}
