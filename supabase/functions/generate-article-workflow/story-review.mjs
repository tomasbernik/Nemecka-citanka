const REVIEW_CATEGORIES = new Set([
  "brief", "logic", "location", "timeline", "object_state", "knowledge",
  "continuity", "causality", "language", "cefr", "safety", "length",
]);

const readLine = (block, label) => {
  const match = block.match(new RegExp(`^${label}:[ \\t]*(.*)$`, "mi"));
  return match ? match[1].trim() : "";
};

export function parseStoryReviewText(output) {
  const text = String(output || "").replace(/\r/g, "").trim();
  const briefValue = readLine(text, "BRIEF").toUpperCase();
  if (!["PASS", "FAIL", "TRUE", "FALSE"].includes(briefValue)) {
    throw new Error("Review is missing a valid BRIEF line.");
  }

  const checkedValue = readLine(text, "CHECKED");
  if (!checkedValue) throw new Error("Review is missing a CHECKED line.");
  const checkedChapters = checkedValue
    .split(",")
    .map(value => Number(value.trim()))
    .filter(Number.isInteger);

  const issueMarkers = text.match(/^ISSUE:\s*$/gim) || [];
  const issueBlocks = [...text.matchAll(/^ISSUE:\s*\n([\s\S]*?)^END_ISSUE\s*$/gim)];
  if (issueMarkers.length !== issueBlocks.length) {
    throw new Error("Review contains an incomplete ISSUE block.");
  }

  const issues = issueBlocks.map(match => {
    const block = match[1];
    const chapter = Number(readLine(block, "CHAPTER"));
    const category = readLine(block, "CATEGORY").toLowerCase();
    const description = readLine(block, "DESCRIPTION");
    const evidence = readLine(block, "EVIDENCE");
    const relatedEvidence = readLine(block, "RELATED_EVIDENCE");
    const requiredFix = readLine(block, "FIX");
    if (!Number.isInteger(chapter) || !REVIEW_CATEGORIES.has(category)
      || !description || !evidence || !requiredFix) {
      throw new Error("Review contains an incomplete or invalid ISSUE block.");
    }
    return { chapter, category, description, evidence, relatedEvidence, requiredFix };
  });

  return {
    briefSatisfied: briefValue === "PASS" || briefValue === "TRUE",
    checkedChapters,
    issues,
  };
}
