import fs from "node:fs/promises";
import vm from "node:vm";
import {
  loadAppContext,
  parseArgs,
  supabaseRequest
} from "./translation-entry-utils.mjs";

const TRANSLATE_DELAY_MS = 90;
const TRANSLATION_CACHE_FILE = "translations/generated-remote-vocab-translations.json";

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function withConfigCredentials(args) {
  if (args.supabaseUrl && args.supabaseKey) return args;

  try {
    const context = { window: {} };
    vm.createContext(context);
    vm.runInContext(await fs.readFile("config.js", "utf8"), context, { filename: "config.js" });
    const config = context.window.NC_SUPABASE_CONFIG || {};
    return {
      ...args,
      supabaseUrl: args.supabaseUrl || config.url,
      supabaseKey: args.supabaseKey || config.anonKey
    };
  } catch {
    return args;
  }
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

async function translateTextWithRetry(text, targetLanguage, retries = 4) {
  let lastError;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await translateText(text, targetLanguage);
    } catch (error) {
      lastError = error;
      if (attempt === retries) break;
      await wait(750 * (attempt + 1));
    }
  }

  throw lastError;
}

function normalizeRemoteArticle(row) {
  return {
    id: row.id,
    title: row.title,
    vocabulary: row.vocabulary || [],
    inlineVocabulary: row.inline_vocabulary || []
  };
}

function getMissingItems(articles, languages) {
  const items = new Map();

  for (const article of articles) {
    for (const field of ["vocabulary", "inlineVocabulary"]) {
      for (const item of article[field] || []) {
        const sourceText = item?.de || item?.base || "";
        if (!sourceText) continue;
        const missingLanguages = languages.filter(language => !item[language]);
        if (!missingLanguages.length) continue;
        if (!items.has(sourceText)) items.set(sourceText, new Set());
        missingLanguages.forEach(language => items.get(sourceText).add(language));
      }
    }
  }

  return [...items.entries()].map(([sourceText, languagesForSource]) => ({
    sourceText,
    languages: [...languagesForSource]
  }));
}

async function loadPublishedArticles(args) {
  const rows = await supabaseRequest(
    "app_articles?select=id,title,vocabulary,inline_vocabulary&published=eq.true&order=title.asc",
    {},
    args
  );
  return (rows || []).map(normalizeRemoteArticle);
}

async function readTranslationCache(path = TRANSLATION_CACHE_FILE) {
  try {
    return JSON.parse(await fs.readFile(path, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return {};
    throw error;
  }
}

async function writeTranslationCache(translations, path = TRANSLATION_CACHE_FILE) {
  await fs.writeFile(path, `${JSON.stringify(translations, null, 2)}\n`, "utf8");
}

async function buildTranslations(items, targetLanguages, args) {
  const cachePath = args.cache || TRANSLATION_CACHE_FILE;
  const translations = args.noCache ? {} : await readTranslationCache(cachePath);

  for (const [index, item] of items.entries()) {
    translations[item.sourceText] ||= {};
    for (const language of targetLanguages.filter(target => item.languages.includes(target))) {
      if (translations[item.sourceText][language]) continue;
      translations[item.sourceText][language] = await translateTextWithRetry(item.sourceText, language);
      if (!args.noCache) await writeTranslationCache(translations, cachePath);
      await wait(TRANSLATE_DELAY_MS);
    }
    if ((index + 1) % 25 === 0 || index + 1 === items.length) {
      console.log(`Translated ${index + 1}/${items.length}`);
    }
  }

  return translations;
}

function applyTranslations(articles, translations) {
  const changedArticleIds = new Set();
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
            changedArticleIds.add(article.id);
          }
        }
      }
    }
  }

  return { changed, changedArticleIds };
}

async function saveChangedArticles(articles, changedArticleIds, args) {
  const changedArticles = articles.filter(article => changedArticleIds.has(article.id));

  for (const [index, article] of changedArticles.entries()) {
    await supabaseRequest(`app_articles?id=eq.${encodeURIComponent(article.id)}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        vocabulary: article.vocabulary,
        inline_vocabulary: article.inlineVocabulary,
        updated_at: new Date().toISOString()
      })
    }, args);
    console.log(`Saved ${index + 1}/${changedArticles.length}: ${article.id}`);
  }

  return changedArticles.length;
}

async function main() {
  const args = await withConfigCredentials(parseArgs());
  const context = await loadAppContext();
  const targetLanguages = String(args.languages || context.VOCABULARY_LANGUAGE_CODES.join(","))
    .split(",")
    .map(language => language.trim())
    .filter(Boolean);
  const invalidLanguages = targetLanguages.filter(language => !context.VOCABULARY_LANGUAGE_CODES.includes(language));

  if (invalidLanguages.length) {
    throw new Error(`Unsupported target languages: ${invalidLanguages.join(", ")}`);
  }

  const articles = await loadPublishedArticles(args);
  const missingItems = getMissingItems(articles, targetLanguages);

  if (args.dryRun) {
    console.log(`Remote published articles: ${articles.length}`);
    console.log(`Unique German entries with missing translations: ${missingItems.length}`);
    missingItems.slice(0, Number(args.limit || 20)).forEach(item => {
      console.log(`${item.sourceText}: ${item.languages.join(", ")}`);
    });
    return;
  }

  if (!missingItems.length) {
    console.log("No missing remote article vocabulary translations found.");
    return;
  }

  const translations = await buildTranslations(missingItems, targetLanguages, args);
  const { changed, changedArticleIds } = applyTranslations(articles, translations);
  const savedArticles = await saveChangedArticles(articles, changedArticleIds, args);
  console.log(`Updated ${changed} remote vocabulary translations in ${savedArticles} articles.`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
