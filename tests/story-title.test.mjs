import assert from "node:assert/strict";
import test from "node:test";

import {
  buildChapterTitleInstruction,
  getSequentialChapterTitleError,
} from "../supabase/functions/generate-article-workflow/story-title.mjs";

const storyContext = {
  seriesTitle: "Ein neuer Anfang im Café",
  previousChapters: [
    { title: "Das erste Gespräch" },
    { title: "Ein gemeinsamer Spaziergang" },
  ],
};

test("sequential chapter titles must differ from the series and previous chapters", () => {
  assert.match(
    getSequentialChapterTitleError("Ein neuer Anfang im Cafe", storyContext),
    /duplicates the series/,
  );
  assert.match(
    getSequentialChapterTitleError("Das erste Gespräch", storyContext),
    /duplicates the series or previous chapter/,
  );
  assert.equal(getSequentialChapterTitleError("Ein Plan für Samstag", storyContext), "");
});

test("a numeric suffix cannot disguise a repeated chapter title", () => {
  assert.match(
    getSequentialChapterTitleError("Ein neuer Anfang im Café – Kapitel 2", storyContext),
    /mechanical chapter label or number/,
  );
  assert.match(
    getSequentialChapterTitleError("Teil III: Das Treffen", storyContext),
    /mechanical chapter label or number/,
  );
  assert.match(
    getSequentialChapterTitleError("Das erste Gespräch 2", storyContext),
    /adds only a numeric suffix/,
  );
});

test("chapter title instructions expose every forbidden title to writer and reviewer", () => {
  const instruction = buildChapterTitleInstruction(storyContext);
  assert.match(instruction, /Ein neuer Anfang im Café/);
  assert.match(instruction, /Das erste Gespräch/);
  assert.match(instruction, /Never add Kapitel, Teil/);
});
