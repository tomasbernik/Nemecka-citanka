import fs from "node:fs/promises";
import {
  loadAppContext,
  parseArgs,
  readJsonFile,
  writeJsonFile
} from "./translation-entry-utils.mjs";

const DEFAULT_TARGETS = ["ro", "it", "fr", "tr"];
const TRANSLATE_DELAY_MS = 90;

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function uniqueMissingItems(articles, targets) {
  const items = new Map();

  for (const article of articles) {
    for (const field of ["vocabulary", "inlineVocabulary"]) {
      for (const item of article[field] || []) {
        const sourceText = item?.de || item?.base || "";
        if (!sourceText) continue;
        const missingTargets = targets.filter(language => !item[language]);
        if (!missingTargets.length) continue;
        if (!items.has(sourceText)) items.set(sourceText, new Set());
        missingTargets.forEach(language => items.get(sourceText).add(language));
      }
    }
  }

  return [...items.entries()].map(([sourceText, languages]) => ({
    sourceText,
    languages: [...languages]
  }));
}

async function translateText(text, targetLanguage) {
  const params = new URLSearchParams({
    client: "gtx",
    sl: "de",
    tl: targetLanguage,
    dt: "t",
    q: text
  });
  const response = await fetch(`https://translate.googleapis.com/translate_a/single?${params}`);
  if (!response.ok) {
    throw new Error(`Translate ${targetLanguage} failed with ${response.status}: ${await response.text()}`);
  }
  const payload = await response.json();
  return (payload[0] || []).map(part => part[0]).join("").trim();
}

async function buildTranslations(items, targets) {
  const translated = {};

  for (const [itemIndex, item] of items.entries()) {
    translated[item.sourceText] = {};
    for (const language of targets.filter(target => item.languages.includes(target))) {
      translated[item.sourceText][language] = await translateText(item.sourceText, language);
      await wait(TRANSLATE_DELAY_MS);
    }
    if ((itemIndex + 1) % 25 === 0 || itemIndex + 1 === items.length) {
      console.log(`Translated ${itemIndex + 1}/${items.length}`);
    }
  }

  return translated;
}

function applyTranslations(articles, translations) {
  let changed = 0;

  for (const article of articles) {
    for (const field of ["vocabulary", "inlineVocabulary"]) {
      for (const item of article[field] || []) {
        const sourceText = item?.de || item?.base || "";
        const translated = translations[sourceText] || {};
        for (const [language, value] of Object.entries(translated)) {
          if (!item[language] && value) {
            item[language] = value;
            changed += 1;
          }
        }
      }
    }
  }

  return changed;
}

async function main() {
  const args = parseArgs();
  const context = await loadAppContext();
  const articlesPath = args.input || "articles.json";
  const outputPath = args.output || articlesPath;
  const targets = String(args.languages || DEFAULT_TARGETS.join(","))
    .split(",")
    .map(language => language.trim())
    .filter(Boolean);
  const invalidTargets = targets.filter(language => !context.VOCABULARY_LANGUAGE_CODES.includes(language));

  if (invalidTargets.length) {
    throw new Error(`Unsupported target languages: ${invalidTargets.join(", ")}`);
  }

  const articles = await readJsonFile(articlesPath, []);
  const items = uniqueMissingItems(articles, targets);

  if (!items.length) {
    console.log("No missing article vocabulary translations found.");
    return;
  }

  if (args.dryRun) {
    console.log(`Found ${items.length} unique German vocabulary entries with missing translations.`);
    for (const item of items.slice(0, Number(args.limit || 20))) {
      console.log(`${item.sourceText}: ${item.languages.join(", ")}`);
    }
    return;
  }

  const translations = await buildTranslations(items, targets);
  const changed = applyTranslations(articles, translations);
  await writeJsonFile(outputPath, articles);
  console.log(`Updated ${changed} article vocabulary translations in ${outputPath}`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
