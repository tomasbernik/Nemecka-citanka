import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = path => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("multi-chapter story mode is shown only to the publisher", async () => {
  const [html, editor] = await Promise.all([
    read("index.html"),
    read("editor.js"),
  ]);

  assert.match(html, /id="articleCreationModeControls"[^>]*\bhidden\b/);
  assert.match(editor, /const canGenerateStory = isPublisherAccount\(\)/);
  assert.match(editor, /articleCreationModeControls"\)\?\.classList\.toggle\("hidden", !canGenerateStory\)/);
  assert.match(editor, /async function generateStoryDirectlyWithAi\(\) \{\s+if \(!isPublisherAccount\(\)\) return;/);
});

test("the workflow rejects only non-admin multi-chapter generation", async () => {
  const [workflow, legacy] = await Promise.all([
    read("supabase/functions/generate-article-workflow/index.ts"),
    read("supabase/functions/generate-article/index.ts"),
  ]);

  assert.match(workflow, /if \(storyContext && !isPublisher\) \{\s+throw new WorkflowError\("admin_only", 403/);
  assert.doesNotMatch(legacy, /admin_only/);
});
