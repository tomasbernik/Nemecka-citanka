import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile } from "node:fs/promises";

const editorSource = await readFile(new URL("../editor.js", import.meta.url), "utf8");
const appSource = await readFile(new URL("../app.js", import.meta.url), "utf8");
const workflowSource = await readFile(
  new URL("../supabase/functions/generate-article-workflow/index.ts", import.meta.url),
  "utf8"
);
const context = vm.createContext({});
vm.runInContext(editorSource, context, { filename: "editor.js" });
const buildStoryChapterBrief = vm.runInContext("buildStoryChapterBrief", context);
const buildStoryChapterContext = vm.runInContext("buildStoryChapterContext", context);
const buildCompleteStoryBrief = vm.runInContext("buildCompleteStoryBrief", context);
const buildCompleteStoryContext = vm.runInContext("buildCompleteStoryContext", context);
const applyGeneratedStoryMetadata = vm.runInContext("applyGeneratedStoryMetadata", context);
const getStoryChapterCooldownSeconds = vm.runInContext("getStoryChapterCooldownSeconds", context);
const canAutoResumeStoryGeneration = vm.runInContext("canAutoResumeStoryGeneration", context);
const getGenerationProgressStatusKey = vm.runInContext("getGenerationProgressStatusKey", context);
const recoverCompletedStoryGeneration = vm.runInContext("recoverCompletedStoryGeneration", context);
const shouldKeepPendingStoryGenerationAfterError = vm.runInContext(
  "shouldKeepPendingStoryGenerationAfterError",
  context
);

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

test("new stories request the complete series in one generation job", () => {
  const story = {
    version: 3,
    chapterCount: 5,
    requestedStoryTitle: "Ein neues Projekt",
    topic: "Anna und Leo planen eine Ausstellung.",
    storyPlan: null,
  };

  const brief = buildCompleteStoryBrief(story);
  const storyContext = buildCompleteStoryContext(story);

  assert.match(brief, /exactly 5 separately titled chapters/);
  assert.match(brief, /complete causal arc/);
  assert.equal(storyContext.mode, "complete_story");
  assert.equal(storyContext.version, 3);
  assert.equal(storyContext.chapterCount, 5);
  assert.equal(storyContext.seriesTitle, "Ein neues Projekt");
});

test("chapter cooldown survives a reload and counts down from persisted time", () => {
  assert.equal(getStoryChapterCooldownSeconds({ nextChapterAt: 165_000 }, 100_000), 65);
  assert.equal(getStoryChapterCooldownSeconds({ nextChapterAt: 100_001 }, 100_000), 1);
  assert.equal(getStoryChapterCooldownSeconds({ nextChapterAt: 99_000 }, 100_000), 0);
  assert.equal(getStoryChapterCooldownSeconds({}, 100_000), 0);
});

test("a story only auto-resumes when server work or a chapter cooldown is pending", () => {
  const story = { seriesId: "story-1" };

  assert.equal(canAutoResumeStoryGeneration(story, null), false);
  assert.equal(canAutoResumeStoryGeneration(story, { jobId: "job-1" }), true);
  assert.equal(canAutoResumeStoryGeneration({ ...story, nextChapterAt: 165_000 }, null), true);
  assert.equal(canAutoResumeStoryGeneration({ ...story, generatedChapters: [] }, null), true);
});

test("retry progress distinguishes plan, validation, provider and save failures", () => {
  assert.equal(
    getGenerationProgressStatusKey("retry", { lastErrorCode: "invalid_story_plan" }),
    "generationPlanRetryStatus"
  );
  assert.equal(
    getGenerationProgressStatusKey("retry", { lastErrorCode: "invalid_materials_output" }),
    "generationValidationRetryStatus"
  );
  assert.equal(
    getGenerationProgressStatusKey("retry", { lastErrorCode: "groq_limit_reached" }),
    "generationProviderRetryStatus"
  );
  assert.equal(
    getGenerationProgressStatusKey("retry", { lastErrorCode: "generation_job_update_failed" }),
    "generationSaveRetryStatus"
  );
});

test("only a job still running in the background keeps the pending story", () => {
  assert.equal(shouldKeepPendingStoryGenerationAfterError({ code: "invalid_materials_output" }), false);
  assert.equal(shouldKeepPendingStoryGenerationAfterError({ code: "generation_cancelled" }), false);
  assert.equal(
    shouldKeepPendingStoryGenerationAfterError({ code: "generation_continues_in_background" }),
    true
  );
  assert.equal(shouldKeepPendingStoryGenerationAfterError({ code: "login_required" }), true);
});

test("a completed story job can be recovered from its saved request after reload", () => {
  const request = {
    topic: "Complete story brief",
    level: "A2",
    category: "Alltag",
    lengthMin: 300,
    lengthMax: 350,
    requiredWords: ["Sommer"],
    storyContext: {
      mode: "complete_story",
      seriesId: "story-original",
      chapterCount: 3,
      seriesTitle: "Sommerliebe",
      originalBrief: "Eine Liebesgeschichte im Sommer."
    }
  };
  const recovered = recoverCompletedStoryGeneration(
    { jobId: "job-1", signature: JSON.stringify(request), createdAt: 123 },
    { article: {
      seriesTitle: "Sommerliebe",
      storyPlan: { title: "Sommerliebe" },
      chapters: [{ title: "Eins" }, { title: "Zwei" }, { title: "Drei" }]
    } },
    "de"
  );

  assert.equal(recovered.seriesId, "story-original");
  assert.equal(recovered.chapterCount, 3);
  assert.equal(recovered.generatedChapters.length, 3);
  assert.equal(recovered.topic, "Eine Liebesgeschichte im Sommer.");
  assert.equal(recovered.nextChapter, 0);
});

test("a background story job reconnects automatically after polling expires", () => {
  assert.match(editorSource, /function schedulePendingArticleGenerationResume\(\)/);
  assert.match(editorSource, /error\?\.code === "generation_continues_in_background"/);
  assert.match(editorSource, /schedulePendingArticleGenerationResume\(\);/);
  assert.match(appSource, /else if \(readPendingArticleGeneration\(\)\?\.jobId\)/);
  assert.match(appSource, /resumePendingArticleGeneration\(\);/);
});

test("story generation does not request an optional language focus", () => {
  assert.match(editorSource, /languageFocus:\s*""/);
  assert.match(editorSource, /articleLanguageFocusRow"\)\?\.classList\.toggle\("hidden", isStory\)/);
});

test("a targeted review can load an intermediate story outside the total word range", () => {
  assert.match(
    workflowSource,
    /allowTotalLengthRepair:\s*storedDraft\.reviewPassCompleted\s*===\s*true/
  );
  assert.match(workflowSource, /!options\.allowTotalLengthRepair/);
});

test("targeted repairs use the whole story and receive one bounded final audit", () => {
  assert.match(workflowSource, /COMPLETE STORY CONTEXT:/);
  assert.match(workflowSource, /reviewAuditCount\s*<\s*2/);
  assert.match(workflowSource, /complete story queued for final independent audit/);
  assert.match(workflowSource, /reviewPassCompleted:\s*false/);
});

test("the reviewer ignores stylistic preferences that are not publish-blocking defects", () => {
  assert.match(workflowSource, /Do not request a repair merely for natural repetition/);
  assert.match(workflowSource, /concrete publish-blocking length, logic, continuity, CEFR or language defect/);
});

test("the Qwen reviewer uses a supported reasoning effort", () => {
  assert.match(workflowSource, /const effectiveThinkingLevel = isQwen \? "low" : thinkingLevel;/);
  assert.doesNotMatch(workflowSource, /const effectiveThinkingLevel = isQwen \? "none" : thinkingLevel;/);
  assert.match(workflowSource, /const providerThinkingLevel = thinkingLevel === "none" \? "low" : thinkingLevel;/);
});
