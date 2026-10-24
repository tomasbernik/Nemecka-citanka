import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile } from "node:fs/promises";

const editorSource = await readFile(new URL("../editor.js", import.meta.url), "utf8");
const context = vm.createContext({});
vm.runInContext(editorSource, context, { filename: "editor.js" });
const buildStoryChapterBrief = vm.runInContext("buildStoryChapterBrief", context);

test("later story chapters receive summaries of all older chapters and the previous chapter text", () => {
  const story = {
    topic: "Anna follows a mysterious letter through Berlin.",
    seriesTitle: "Der geheimnisvolle Brief",
    chapterCount: 5,
    completedChapters: [
      { title: "Der Brief", summary: "Anna findet einen Brief.", text: ["OLD_FULL_TEXT_SHOULD_NOT_BE_INCLUDED"] },
      { title: "Die Reise", summary: "Anna fährt nach Berlin.", text: ["SECOND_OLD_FULL_TEXT"] },
      { title: "Die Spur", summary: "Sie entdeckt eine wichtige Spur.", text: ["PREVIOUS_CHAPTER_FULL_TEXT"] }
    ]
  };

  const brief = buildStoryChapterBrief(story, 3);

  assert.match(brief, /Chapter 1 \(Der Brief\): Anna findet einen Brief\./);
  assert.match(brief, /Chapter 2 \(Die Reise\): Anna fährt nach Berlin\./);
  assert.match(brief, /Immediately previous chapter \(Die Spur\)/);
  assert.match(brief, /PREVIOUS_CHAPTER_FULL_TEXT/);
  assert.doesNotMatch(brief, /OLD_FULL_TEXT_SHOULD_NOT_BE_INCLUDED/);
  assert.ok(brief.length <= 6_000);
});

test("the final chapter is explicitly instructed to resolve open plot lines", () => {
  const brief = buildStoryChapterBrief({
    topic: "A simple mystery",
    seriesTitle: "Das Rätsel",
    chapterCount: 5,
    completedChapters: []
  }, 4);

  assert.match(brief, /final chapter/i);
  assert.match(brief, /Resolve the central problem/);
});
