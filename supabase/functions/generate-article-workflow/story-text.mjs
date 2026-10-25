const cleanLine = value => String(value || "").trim();

export function getApproximateWordRange(minWords, maxWords, tolerance = 0.1) {
  return {
    min: minWords - Math.ceil(minWords * tolerance),
    max: maxWords + Math.ceil(maxWords * tolerance),
  };
}

export function parseStoryTextOutput(value) {
  if (typeof value !== "string") return null;
  const cleaned = value
    .replace(/^\uFEFF/u, "")
    .replace(/^```(?:markdown|md|text)?\s*/iu, "")
    .replace(/\s*```$/u, "")
    .trim();
  if (!cleaned) return null;

  const lines = cleaned.split(/\r?\n/u);
  const firstContentIndex = lines.findIndex(line => cleanLine(line));
  if (firstContentIndex < 0) return null;
  const heading = cleanLine(lines[firstContentIndex]);
  const titleMatch = heading.match(/^(?:#{1,3}\s+|TITLE:\s*)(.+)$/iu);
  if (!titleMatch?.[1]) return null;

  const body = lines
    .slice(firstContentIndex + 1)
    .join("\n")
    .replace(/^\s*(?:TEXT|STORY):\s*/iu, "")
    .trim();
  if (!body) return null;

  const text = body
    .split(/\n\s*\n/u)
    .map(paragraph => paragraph.split(/\r?\n/u).map(cleanLine).filter(Boolean).join(" "))
    .filter(Boolean);
  if (!text.length) return null;

  return { title: cleanLine(titleMatch[1]), text };
}
