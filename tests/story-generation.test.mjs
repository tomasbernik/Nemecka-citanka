import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile } from "node:fs/promises";

const editorSource = await readFile(new URL("../editor.js", import.meta.url), "utf8");
const context = vm.createContext({});
vm.runInContext(editorSource, context, { filename: "editor.js" });
const buildStoryChapterBrief = vm.runInContext("buildStoryChapterBrief", context);
const buildStoryChapterContext = vm.runInContext("buildStoryChapterContext", context);
const applyGeneratedStoryMetadata = vm.runInContext("applyGeneratedStoryMetadata", context);
const getStoryChapterCooldownSeconds = vm.runInContext("getStoryChapterCooldownSeconds", context);

test("the chapter brief stays compact and delegates history to structured context", () => {
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

  assert.match(brief, /Write chapter 4 of 5/);
  assert.match(brief, /Overall story brief/);
  assert.doesNotMatch(brief, /PREVIOUS_CHAPTER_FULL_TEXT/);
  assert.doesNotMatch(brief, /OLD_FULL_TEXT_SHOULD_NOT_BE_INCLUDED/);
  assert.ok(brief.length <= 3_000);
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

test("story context carries the binding plan, continuity state and only the previous ending", () => {
  const story = {
    topic: "A station crew repairs a cooling system.",
    seriesTitle: "Aurora",
    chapterCount: 3,
    storyPlan: { title: "Aurora", ending: "The main system restarts." },
    continuityState: { openThreads: ["Replace the pipe"] },
    completedChapters: [
      { title: "Alarm", summary: "The pipe breaks.", text: ["OLD_FULL_TEXT"] },
      { title: "Der Kristall", summary: "Kiko tests the crystal.", text: ["START", "PREVIOUS_ENDING"] }
    ]
  };

  const storyContext = buildStoryChapterContext(story, 2);

  assert.equal(storyContext.chapterNumber, 3);
  assert.equal(storyContext.plan.title, "Aurora");
  assert.equal(storyContext.state.openThreads[0], "Replace the pipe");
  assert.match(storyContext.earlierSummaries, /Chapter 1 \(Alarm\): The pipe breaks\./);
  assert.match(storyContext.previousChapter.ending, /PREVIOUS_ENDING/);
  assert.doesNotMatch(storyContext.previousChapter.ending, /OLD_FULL_TEXT/);
});

test("generated story metadata is persisted separately from the article", () => {
  const story = { seriesTitle: "", storyPlan: null, continuityState: null };
  const plan = { title: "Aurora", chapterPlans: [{ chapter: 1 }] };
  const continuityState = { establishedFacts: ["The pipe is in the reactor module."] };

  applyGeneratedStoryMetadata(story, { article: { storyPlan: plan, continuityState } });

  assert.equal(story.seriesTitle, "Aurora");
  assert.equal(story.storyPlan, plan);
  assert.equal(story.continuityState, continuityState);
});

test("chapter cooldown survives a reload and counts down from persisted time", () => {
  assert.equal(getStoryChapterCooldownSeconds({ nextChapterAt: 165_000 }, 100_000), 65);
  assert.equal(getStoryChapterCooldownSeconds({ nextChapterAt: 100_001 }, 100_000), 1);
  assert.equal(getStoryChapterCooldownSeconds({ nextChapterAt: 99_000 }, 100_000), 0);
  assert.equal(getStoryChapterCooldownSeconds({}, 100_000), 0);
});
