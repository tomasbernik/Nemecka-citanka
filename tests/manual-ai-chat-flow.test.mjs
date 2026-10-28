import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = path => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const [html, app, editor, translations, styles] = await Promise.all([
  read("index.html"),
  read("app.js"),
  read("editor.js"),
  read("translations/ui-completions.js"),
  read("style.css"),
]);

test("article creation offers automatic and own-AI-chat modes", () => {
  assert.match(html, /id="automaticArticleCreationBtn"/);
  assert.match(html, /id="manualArticleCreationBtn"/);
  assert.match(html, /id="automaticArticleCreationPanel"/);
  assert.match(html, /id="manualArticleCreationPanel"[^>]*\bhidden\b/);
  assert.match(app, /setArticleCreationMethod\("automatic"\)/);
  assert.match(app, /setArticleCreationMethod\("manual"\)/);
  assert.match(editor, /function setArticleCreationMethod\(method = "automatic"\)/);
});

test("automatic creation keeps the primary generate action close and visually prominent", () => {
  const panelStart = html.indexOf('id="automaticArticleCreationPanel"');
  const panelEnd = html.indexOf('id="manualArticleCreationPanel"', panelStart);
  const panel = html.slice(panelStart, panelEnd);

  assert.ok(panel.indexOf('id="generateArticleAiBtn"') < panel.indexOf('id="automaticArticleCreationHelp"'));
  assert.match(panel, /id="generateArticleAiBtn" class="primary-btn article-generate-cta"/);
  assert.match(styles, /\.article-primary-action \.article-generate-cta\s*{[^}]*min-height:\s*54px;[^}]*background:\s*var\(--accent\);[^}]*box-shadow:/s);
});

test("the own-AI-chat flow presents the agreed three steps without technical button labels", () => {
  assert.match(html, /id="manualAiStep1Title"/);
  assert.match(html, /id="manualAiStep2Title"/);
  assert.match(html, /id="manualAiStep3Title"/);
  assert.match(html, /id="copyArticlePromptBtn"/);
  assert.match(html, /id="manualAiStep1Status"[^>]*role="status"[^>]*aria-live="polite"/);
  assert.match(html, /id="copyArticleJsonPromptBtn"/);
  assert.match(html, /id="manualAiStep2Status"[^>]*role="status"[^>]*aria-live="polite"/);
  assert.match(html, /id="articleImportInput"/);
  assert.match(html, /id="articleImportInput"[^>]*class="editor-textarea manual-ai-result-textarea"/);
  assert.match(styles, /\.editor-textarea\.manual-ai-result-textarea\s*{[^}]*height:\s*130px;[^}]*min-height:\s*130px;/s);
  assert.match(translations, /manualArticleCreation: "Pomocou vlastného AI chatu"/);
  assert.match(translations, /copyArticlePrompt: "Kopírovať zadanie na vytvorenie článku"/);
  assert.match(translations, /copyArticleJsonPrompt: "Kopírovať zadanie na spracovanie článku"/);
  assert.match(translations, /articleImportJson: "Výsledok z AI chatu"/);
  assert.match(translations, /importArticle: "Načítať článok do editora"/);
  assert.match(translations, /promptArticleCopied: "Skopírované\. Teraz vlož zadanie do svojho AI chatu\."/);
  assert.match(translations, /promptArticleJsonCopied: "Skopírované\. Teraz vlož zadanie hneď pod vytvorený článok do rovnakého AI chatu\."/);
  assert.match(app, /t\("promptArticleCopied"\), "manualAiStep1Status"/);
  assert.match(app, /t\("promptArticleJsonCopied"\), "manualAiStep2Status"/);
  assert.match(editor, /setClipboardStatus\(statusElementId, successMessage, "success"\)/);
});

test("manual recovery by ID is removed from the ordinary editor while automatic resume remains", () => {
  assert.doesNotMatch(html, /id="recoverArticleGenerationBtn"/);
  assert.doesNotMatch(app, /onClick\("recoverArticleGenerationBtn"/);
  assert.match(editor, /async function resumePendingArticleGeneration\(\)/);
  assert.match(editor, /schedulePendingArticleGenerationResume\(\)/);
});

test("automatic article creation surfaces preflight failures instead of failing silently", () => {
  const start = editor.indexOf("async function generateArticleDirectlyWithAi()");
  const flow = editor.slice(start);

  assert.ok(start >= 0, "automatic article generation function is present");
  assert.match(flow, /setArticleGenerationStatus\(t\("generationStartingStatus"\), "progress"\)/);
  assert.ok(
    flow.indexOf("try {") < flow.indexOf("getArticleEditorCategory()"),
    "editor preflight runs inside the guarded block"
  );
  assert.match(flow, /catch \(error\) \{\s*showArticleGenerationError\(error\);/s);
});

test("the generate button stays interactive while background generation is active", () => {
  assert.doesNotMatch(editor, /generateButton\.disabled = articleGenerationRunning/);
  assert.match(editor, /generateButton\.disabled = false/);
  assert.match(editor, /generateButton\.setAttribute\("aria-busy", String\(articleGenerationRunning\)\)/);
  assert.match(
    editor,
    /articleGenerationStatus"\)\?\.scrollIntoView\(\{ behavior: "smooth", block: "nearest" \}\)/
  );
});
