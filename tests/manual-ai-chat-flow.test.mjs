import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = path => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const [html, app, editor, translations] = await Promise.all([
  read("index.html"),
  read("app.js"),
  read("editor.js"),
  read("translations/ui-completions.js"),
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

test("the own-AI-chat flow presents the agreed three steps without technical button labels", () => {
  assert.match(html, /id="manualAiStep1Title"/);
  assert.match(html, /id="manualAiStep2Title"/);
  assert.match(html, /id="manualAiStep3Title"/);
  assert.match(html, /id="copyArticlePromptBtn"/);
  assert.match(html, /id="manualAiStep1Status"[^>]*role="status"[^>]*aria-live="polite"/);
  assert.match(html, /id="copyArticleJsonPromptBtn"/);
  assert.match(html, /id="manualAiStep2Status"[^>]*role="status"[^>]*aria-live="polite"/);
  assert.match(html, /id="articleImportInput"/);
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
