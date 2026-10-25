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

export function parseStorySeriesTextOutput(value, expectedChapterCount) {
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
  const seriesMatch = cleanLine(lines[firstContentIndex]).match(/^#\s+(.+)$/u);
  if (!seriesMatch?.[1]) return null;

  const chapters = [];
  let current = null;
  for (const rawLine of lines.slice(firstContentIndex + 1)) {
    const line = cleanLine(rawLine);
    const chapterMatch = line.match(/^##\s+(?:Kapitel\s+)?(\d+)\s*[:.\-–—]?\s*(.+)$/iu);
    if (chapterMatch) {
      if (current) chapters.push(current);
      current = { number: Number(chapterMatch[1]), title: cleanLine(chapterMatch[2]), lines: [] };
      continue;
    }
    if (current) current.lines.push(rawLine);
  }
  if (current) chapters.push(current);

  if (!Number.isInteger(expectedChapterCount) || expectedChapterCount < 2
    || chapters.length !== expectedChapterCount) return null;
  if (chapters.some((chapter, index) => chapter.number !== index + 1 || !chapter.title)) return null;

  const normalizedChapters = chapters.map(chapter => {
    const body = chapter.lines.join("\n").trim();
    const text = body
      .split(/\n\s*\n/u)
      .map(paragraph => paragraph.split(/\r?\n/u).map(cleanLine).filter(Boolean).join(" "))
      .filter(Boolean);
    return { number: chapter.number, title: chapter.title, text };
  });
  if (normalizedChapters.some(chapter => chapter.text.length < 3)) return null;

  return { title: cleanLine(seriesMatch[1]), chapters: normalizedChapters };
}
