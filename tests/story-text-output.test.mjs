import assert from "node:assert/strict";
import test from "node:test";

import {
  getApproximateWordRange,
  parseStorySeriesTextOutput,
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

test("parses a complete multi-chapter story without mechanically splitting prose", () => {
  assert.deepEqual(parseStorySeriesTextOutput(`# Ein neuer Anfang

## Kapitel 1: Das Café

Anna sitzt am Fenster.

Leo kommt herein.

Sie sprechen über Fotos.

## Kapitel 2: Die Idee

Leo zeigt seinen Plan.

Anna stellt eine Frage.

Beide finden eine Lösung.

## Kapitel 3: Die Ausstellung

Die Freunde arbeiten zusammen.

Die Besucher hören Musik.

Anna und Leo sind zufrieden.`, 3), {
    title: "Ein neuer Anfang",
    chapters: [
      { number: 1, title: "Das Café", text: ["Anna sitzt am Fenster.", "Leo kommt herein.", "Sie sprechen über Fotos."] },
      { number: 2, title: "Die Idee", text: ["Leo zeigt seinen Plan.", "Anna stellt eine Frage.", "Beide finden eine Lösung."] },
      { number: 3, title: "Die Ausstellung", text: ["Die Freunde arbeiten zusammen.", "Die Besucher hören Musik.", "Anna und Leo sind zufrieden."] },
    ],
  });
});

test("rejects a complete story with a missing or misnumbered chapter", () => {
  assert.equal(parseStorySeriesTextOutput(`# Titel

## Kapitel 1: Anfang

Absatz eins.\n\nAbsatz zwei.\n\nAbsatz drei.

## Kapitel 3: Ende

Absatz eins.\n\nAbsatz zwei.\n\nAbsatz drei.`, 2), null);
});

test("accepts common chapter heading variants and recovers a missing series title", () => {
  const parsed = parseStorySeriesTextOutput(`### Kapitel 1 – Anfang

Absatz eins.\n\nAbsatz zwei.\n\nAbsatz drei.

## Kapitel 2: Ende

Absatz eins.\n\nAbsatz zwei.\n\nAbsatz drei.`, 2, "Sommergeschichte");

  assert.equal(parsed.title, "Sommergeschichte");
  assert.equal(parsed.chapters[0].title, "Anfang");
  assert.equal(parsed.chapters[1].title, "Ende");
});
