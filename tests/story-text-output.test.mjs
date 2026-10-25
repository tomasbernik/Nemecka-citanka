import assert from "node:assert/strict";
import test from "node:test";

import { parseStoryTextOutput } from "../supabase/functions/generate-article-workflow/story-text.mjs";

test("parses a Markdown story into a title and paragraphs", () => {
  assert.deepEqual(parseStoryTextOutput(`# Ein Tag am See

Mia fährt mit dem Bus zum See.
Sie trägt einen roten Rucksack.

Am Abend fährt sie glücklich nach Hause.`), {
    title: "Ein Tag am See",
    text: [
      "Mia fährt mit dem Bus zum See. Sie trägt einen roten Rucksack.",
      "Am Abend fährt sie glücklich nach Hause.",
    ],
  });
});

test("accepts a fenced TITLE and TEXT response", () => {
  assert.deepEqual(parseStoryTextOutput(`\`\`\`text
TITLE: Der Schlüssel
TEXT:
Tom findet einen Schlüssel.

Er bringt ihn zur Polizei.
\`\`\``), {
    title: "Der Schlüssel",
    text: ["Tom findet einen Schlüssel.", "Er bringt ihn zur Polizei."],
  });
});

test("rejects output without an explicit title or story body", () => {
  assert.equal(parseStoryTextOutput("Nur ein Absatz ohne Überschrift."), null);
  assert.equal(parseStoryTextOutput("# Nur ein Titel"), null);
});
