import assert from "node:assert/strict";
import test from "node:test";

import {
  getApproximateWordRange,
  parseStoryTextOutput,
} from "../supabase/functions/generate-article-workflow/story-text.mjs";

test("allows a ten-percent tolerance around the selected word range", () => {
  assert.deepEqual(getApproximateWordRange(300, 350), { min: 270, max: 385 });
  assert.deepEqual(getApproximateWordRange(100, 150), { min: 90, max: 165 });
});

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
