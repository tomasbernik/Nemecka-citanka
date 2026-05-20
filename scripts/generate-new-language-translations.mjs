import fs from "node:fs/promises";
import vm from "node:vm";
import { AUDIT_FILE, writeJsonFile } from "./translation-entry-utils.mjs";

const TARGET_LANGUAGES = {
  ro: "Romanian",
  it: "Italian",
  en: "English",
  fr: "French",
  tr: "Turkish"
};

const TRANSLATE_DELAY_MS = 90;

function protectPlaceholders(text) {
  const placeholders = [];
  const protectedText = text.replace(/\{[^}]+\}/g, (match) => {
    const token = `ZXQ${placeholders.length}QXZ`;
    placeholders.push([token, match]);
    return token;
  });
  return { protectedText, placeholders };
}

function restorePlaceholders(text, placeholders) {
  return placeholders.reduce(
    (value, [token, placeholder]) => value.replaceAll(token, placeholder),
    text
  );
}

function escapeForJs(value) {
  return JSON.stringify(value);
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function translateText(text, targetLanguage) {
  if (!text) return text;

  const { protectedText, placeholders } = protectPlaceholders(text);
  const params = new URLSearchParams({
    client: "gtx",
    sl: "sk",
    tl: targetLanguage,
    dt: "t",
    q: protectedText
  });
  const response = await fetch(`https://translate.googleapis.com/translate_a/single?${params}`);
  if (!response.ok) {
    throw new Error(`Translate ${targetLanguage} failed with ${response.status}`);
  }
  const payload = await response.json();
  const translated = (payload[0] || []).map(part => part[0]).join("");
  return restorePlaceholders(translated, placeholders);
}

async function loadReferenceText() {
  const context = { window: {}, console };
  vm.createContext(context);

  for (const file of ["constants.js", "translations/ui.js", "translations/auth.js"]) {
    vm.runInContext(await fs.readFile(file, "utf8"), context, { filename: file });
  }

  vm.runInContext("this.loadedUiText = UI_TEXT;", context);

  return context.loadedUiText.sk;
}

function renderLanguageBlock(language, label, translations) {
  const rows = Object.entries(translations)
    .map(([key, value]) => `    ${key}: ${escapeForJs(value)}`)
    .join(",\n");
  return [
    `  ${language}: {`,
    `    // Generated from Slovak source text; review wording naturally for ${label}.`,
    rows,
    "  }"
  ].join("\n");
}

async function main() {
  const reference = await loadReferenceText();
  const keys = Object.keys(reference);
  const output = {};
  const providerRunId = `google-translate-script:${new Date().toISOString()}`;
  const auditEntries = [];

  for (const [language, label] of Object.entries(TARGET_LANGUAGES)) {
    output[language] = {};
    for (const [index, key] of keys.entries()) {
      output[language][key] = await translateText(reference[key], language);
      auditEntries.push({
        namespace: "ui",
        source_entity_id: key,
        source_field: "text",
        source_path: "",
        source_language: "sk",
        target_language: language,
        source_text: reference[key],
        translated_text: output[language][key],
        provider: "google_translate_script",
        provider_run_id: providerRunId,
        review_status: "unreviewed",
        metadata: {
          script: "scripts/generate-new-language-translations.mjs",
          target_language_label: label
        }
      });
      await wait(TRANSLATE_DELAY_MS);
      if ((index + 1) % 25 === 0) {
        console.log(`${language}: ${index + 1}/${keys.length}`);
      }
    }
  }

  const blocks = Object.entries(output)
    .map(([language, translations]) => renderLanguageBlock(language, TARGET_LANGUAGES[language], translations))
    .join(",\n");

  const file = `const NEW_LANGUAGE_UI_TEXT = {\n${blocks}\n};\n\nObject.entries(NEW_LANGUAGE_UI_TEXT).forEach(([language, text]) => {\n  assignUiText(language, text);\n});\n`;

  await fs.writeFile("translations/new-languages.js", file);
  await writeJsonFile(AUDIT_FILE, {
    provider: "google_translate_script",
    provider_run_id: providerRunId,
    generated_at: new Date().toISOString(),
    source_language: "sk",
    entries: auditEntries
  });
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
