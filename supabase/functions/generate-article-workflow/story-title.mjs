function normalizeComparableTitle(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("de-DE")
    .replace(/[„“”"'’`´]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function getForbiddenChapterTitles(storyContext, storyPlan = null) {
  const previousChapters = Array.isArray(storyContext?.previousChapters)
    ? storyContext.previousChapters
    : [];
  return [
    storyPlan?.title,
    storyContext?.seriesTitle,
    ...previousChapters.map(chapter => chapter?.title),
  ].map(value => String(value || "").trim()).filter(Boolean);
}

export function buildChapterTitleInstruction(storyContext, storyPlan = null) {
  const forbiddenTitles = getForbiddenChapterTitles(storyContext, storyPlan);
  return [
    "CHAPTER TITLE RULES:",
    "- Use a short, content-specific German title that identifies this chapter's own event or development.",
    "- The chapter title must differ meaningfully from the series title and every previous chapter title.",
    "- Never add Kapitel, Teil, a chapter number, or a numeric suffix to make a repeated title appear different.",
    forbiddenTitles.length
      ? `- Do not use or mechanically extend any of these titles: ${JSON.stringify(forbiddenTitles)}.`
      : "- Do not reuse the series title as the chapter title.",
  ].join("\n");
}

export function getSequentialChapterTitleError(title, storyContext, storyPlan = null) {
  const candidate = String(title || "").trim();
  if (!candidate) return "The chapter title is missing.";
  if (/\b(?:kapitel|teil)\s*(?:\d+|[ivxlcdm]+)\b/iu.test(candidate)) {
    return `The chapter title ${JSON.stringify(candidate)} contains a mechanical chapter label or number.`;
  }

  const normalizedCandidate = normalizeComparableTitle(candidate);
  const forbiddenTitles = getForbiddenChapterTitles(storyContext, storyPlan);
  const duplicate = forbiddenTitles
    .find(existing => normalizeComparableTitle(existing) === normalizedCandidate);
  if (duplicate) {
    return `The chapter title ${JSON.stringify(candidate)} duplicates the series or previous chapter title ${JSON.stringify(duplicate)}.`;
  }
  const numericSuffix = candidate.match(/^(.*?)(?:\s*[-–—:]\s*|\s+)\d+\s*$/u);
  const disguisedDuplicate = numericSuffix && forbiddenTitles
    .find(existing => normalizeComparableTitle(existing) === normalizeComparableTitle(numericSuffix[1]));
  if (disguisedDuplicate) {
    return `The chapter title ${JSON.stringify(candidate)} adds only a numeric suffix to ${JSON.stringify(disguisedDuplicate)}.`;
  }
  return "";
}
