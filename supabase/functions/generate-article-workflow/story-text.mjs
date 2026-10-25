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

export function parseStorySeriesTextOutput(value, expectedChapterCount, fallbackTitle = "") {
  if (typeof value !== "string") return null;
  const cleaned = value
    .replace(/^\uFEFF/u, "")
    .replace(/^```(?:markdown|md|text)?\s*/iu, "")
    .replace(/\s*```$/u, "")
    .trim();
  if (!cleaned) return null;

  const lines = cleaned.split(/\r?\n/u);
  let title = "";
  const chapters = [];
  let current = null;
  for (const rawLine of lines) {
    const line = cleanLine(rawLine);
    const chapterMatch = line.match(/^(?:#{1,4}\s*)?Kapitel\s*(\d+)\s*[:.\-–—]?\s*(.*)$/iu)
      || line.match(/^#{2,4}\s*(\d+)\s*[:.\-–—]\s*(.*)$/u);
    if (chapterMatch) {
      if (current) chapters.push(current);
      const number = Number(chapterMatch[1]);
      current = {
        number,
        title: cleanLine(chapterMatch[2]) || `Kapitel ${number}`,
        lines: [],
      };
      continue;
    }
    if (!current && !title) {
      const titleMatch = line.match(/^#{1,3}\s+(.+)$/u);
      if (titleMatch?.[1]) title = cleanLine(titleMatch[1]);
    }
    if (current) current.lines.push(rawLine);
  }
  if (current) chapters.push(current);

  if (!Number.isInteger(expectedChapterCount) || expectedChapterCount < 2
    || chapters.length !== expectedChapterCount) return null;
  if (chapters.some((chapter, index) => chapter.number !== index + 1 || !chapter.title)) return null;

  const normalizedChapters = chapters.map(chapter => {
    const body = chapter.lines.join("\n").trim();
    let text = body
      .split(/\n\s*\n/u)
      .map(paragraph => paragraph.split(/\r?\n/u).map(cleanLine).filter(Boolean).join(" "))
      .filter(Boolean);
    if (text.length < 3) {
      text = chapter.lines.map(cleanLine).filter(Boolean);
    }
    return { number: chapter.number, title: chapter.title, text };
  });
  if (normalizedChapters.some(chapter => chapter.text.length < 3)) return null;

  title = title || cleanLine(fallbackTitle);
  if (!title) return null;
  return { title, chapters: normalizedChapters };
}
