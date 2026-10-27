import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const read = path => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const [editorSource, workflowSource, html, articlesSource] = await Promise.all([
  read("editor.js"),
  read("supabase/functions/generate-article-workflow/index.ts"),
  read("index.html"),
  read("articles.js"),
]);

const context = vm.createContext({
  PROMPT_TRANSLATION_LANGUAGE_CODES: ["sk", "pl", "hu", "ru", "en", "fr"],
  VOCABULARY_LANGUAGE_CODES: ["sk", "pl", "hu", "ru", "en", "fr"],
  NATIVE_LANGUAGES: {
    sk: { label: "Slovenčina", lineFormat: "slovensky" },
    pl: { label: "Polski", lineFormat: "poľsky" },
    hu: { label: "Magyar", lineFormat: "maďarsky" },
    ru: { label: "Русский", lineFormat: "rusky" },
    en: { label: "English", lineFormat: "anglicky" },
    fr: { label: "Français", lineFormat: "francúzsky" },
  },
  getUiLanguage: () => "sk",
  getSelectedArticleLanguage: () => "de",
  getArticleLanguageLabel: () => "Deutsch",
});
vm.runInContext(editorSource, context, { filename: "editor.js" });
const getArticleJsonPromptInstructions = vm.runInContext("getArticleJsonPromptInstructions", context);
const normalizeVocabularyImportItem = vm.runInContext("normalizeVocabularyImportItem", context);

test("manual JSON prompt omits languageFocus unless the creator requested it", () => {
  const withoutFocus = getArticleJsonPromptInstructions("A2").join("\n");
  const withFocus = getArticleJsonPromptInstructions("A2", "Trennbare Verben im Hauptsatz").join("\n");

  assert.doesNotMatch(withoutFocus, /\"languageFocus\"\s*:/);
  assert.match(withoutFocus, /Nevytváraj languageFocus/);
  assert.match(withFocus, /\"languageFocus\"\s*:/);
  assert.match(withFocus, /\"requestedFeature\": "Trennbare Verben im Hauptsatz"/);
  assert.match(withFocus, /type multiple_choice/);
});

test("manual JSON instructions always use the previous response from the same AI chat", () => {
  const instructions = getArticleJsonPromptInstructions("A2").join("\n");

  assert.match(instructions, /bezprostredne predchádzajúcej odpovede v tomto chate/);
  assert.doesNotMatch(instructions, /nižšie vložený text/);
  assert.doesNotMatch(editorSource, /const usePreviousChatResponse = !text/);
  assert.doesNotMatch(editorSource, /Hotový text v jazyku.*:/);
  assert.match(editorSource, /Zdrojovým textom je tvoja bezprostredne predchádzajúca odpoveď/);
});

test("manual and API material contracts use an exact occurrence separate from the learner-facing form", () => {
  const prompt = getArticleJsonPromptInstructions("A2").join("\n");
  assert.match(prompt, /occurrence musí byť znak po znaku presný súvislý úsek textu/);
  assert.match(prompt, /steht … auf/);
  assert.match(prompt, /aufstehen/);
  assert.match(workflowSource, /occurrence is one exact contiguous substring copied character-for-character/);
  assert.match(workflowSource, /required: \["de", "base", "occurrence", "sk", "pl", "hu", "ru", "en", "fr"\]/);
  assert.match(workflowSource, /normalizedStoryText\.includes\(occurrence\.normalize\("NFC"\)\)/);
  assert.match(workflowSource, /prompt\.match\(\/___\/gu\).*length === 1/);
});

test("vocabulary import and cache retain occurrence", () => {
  const item = normalizeVocabularyImportItem({
    de: "steht … auf",
    base: "aufstehen",
    occurrence: "steht um sieben Uhr auf",
    sk: "vstať",
  });
  assert.equal(item.de, "steht … auf");
  assert.equal(item.base, "aufstehen");
  assert.equal(item.occurrence, "steht um sieben Uhr auf");
  assert.match(articlesSource, /occurrence: item\.occurrence \|\| ""/);
});

test("short article descriptions have one visible 300-character contract", () => {
  assert.match(html, /id="articleSummaryInput"[^>]*maxlength="300"[^>]*aria-describedby="articleSummaryCounter"/);
  assert.match(html, /id="articleSummaryCounter"[^>]*>0\/300</);
  assert.match(editorSource, /ARTICLE_SUMMARY_MAX_LENGTH/);
  assert.match(workflowSource, /const ARTICLE_SUMMARY_MAX_LENGTH = 300/);
  assert.match(workflowSource, /summary exceeds \$\{ARTICLE_SUMMARY_MAX_LENGTH\} characters/);
});
