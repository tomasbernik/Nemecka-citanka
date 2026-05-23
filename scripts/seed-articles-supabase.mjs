import {
  loadAppContext,
  parseArgs,
  readJsonFile,
  supabaseRequest
} from "./translation-entry-utils.mjs";
import fs from "node:fs/promises";
import vm from "node:vm";

function getInlineVocabulary(article) {
  if (Array.isArray(article.inlineVocabulary)) return article.inlineVocabulary;
  if (Array.isArray(article.inline_vocabulary)) return article.inline_vocabulary;
  return [];
}

function normalizeArticle(article) {
  return {
    ...article,
    ownerProfileId: article.ownerProfileId || article.owner_profile_id || null,
    teacherGroupId: article.teacherGroupId || article.teacher_group_id || null,
    categoryLabels: article.categoryLabels || article.category_labels || {},
    visibility: article.visibility || "public",
    approvalStatus: article.approvalStatus || article.approval_status || "approved",
    published: article.published !== false
  };
}

function articleToRow(article, options = {}) {
  const normalized = normalizeArticle(article);
  const row = {
    id: normalized.id,
    owner_profile_id: normalized.ownerProfileId,
    teacher_group_id: normalized.teacherGroupId,
    visibility: normalized.visibility,
    approval_status: normalized.approvalStatus,
    title: normalized.title,
    level: normalized.level,
    category: normalized.category,
    category_labels: normalized.categoryLabels,
    summary: normalized.summary,
    text: normalized.text || [],
    vocabulary: normalized.vocabulary || [],
    inline_vocabulary: getInlineVocabulary(normalized),
    image: normalized.image || null,
    questions: normalized.questions || [],
    published: normalized.published
  };

  if (!options.preserveUpdatedAt) row.updated_at = new Date().toISOString();

  return row;
}

function findMissingVocabularyTranslations(articles, languages) {
  const missing = [];

  for (const article of articles) {
    for (const field of ["vocabulary", "inlineVocabulary"]) {
      for (const [index, item] of (article[field] || []).entries()) {
        const missingLanguages = languages.filter(language => !item[language]);
        if (!missingLanguages.length) continue;
        missing.push({
          article: article.id,
          field,
          index,
          de: item.de || "",
          missing: missingLanguages
        });
      }
    }
  }

  return missing;
}

async function upsertRows(rows, args) {
  const batchSize = Number(args.batchSize || 100);

  for (let index = 0; index < rows.length; index += batchSize) {
    const batch = rows.slice(index, index + batchSize);
    await supabaseRequest("app_articles?on_conflict=id", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify(batch)
    }, args);
    console.log(`Seeded ${Math.min(index + batch.length, rows.length)}/${rows.length}`);
  }
}

async function verifyRemoteArticles(args, languages) {
  const rows = await supabaseRequest(
    "app_articles?select=id,title,vocabulary,inline_vocabulary&published=eq.true&order=title.asc",
    {},
    args
  );
  const articles = (rows || []).map(row => ({
    id: row.id,
    title: row.title,
    vocabulary: row.vocabulary || [],
    inlineVocabulary: row.inline_vocabulary || []
  }));
  const missingTranslations = findMissingVocabularyTranslations(articles, languages);

  console.log(`Remote app_articles published rows: ${articles.length}`);
  if (!missingTranslations.length) {
    console.log("Remote article vocabulary translations are complete.");
    return;
  }

  console.log(`Remote article vocabulary still misses ${missingTranslations.length} entries.`);
  missingTranslations.slice(0, 10).forEach(item => {
    console.log(`${item.article} ${item.field}[${item.index}] ${item.de}: ${item.missing.join(", ")}`);
  });
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

async function main() {
  const args = await withConfigCredentials(parseArgs());
  const context = await loadAppContext();
  const input = args.input || "articles.json";
  const articles = (await readJsonFile(input, [])).map(normalizeArticle);
  const requiredLanguages = args.allowMissingTranslations
    ? []
    : context.VOCABULARY_LANGUAGE_CODES || [];
  const missingTranslations = findMissingVocabularyTranslations(articles, requiredLanguages);

  if (args.verify) {
    await verifyRemoteArticles(args, context.VOCABULARY_LANGUAGE_CODES || []);
    return;
  }

  if (!articles.length) {
    throw new Error(`No articles found in ${input}`);
  }

  if (missingTranslations.length) {
    const preview = missingTranslations
      .slice(0, 10)
      .map(item => `${item.article} ${item.field}[${item.index}] ${item.de}: ${item.missing.join(", ")}`)
      .join("\n");
    throw new Error([
      `Cannot seed articles: ${missingTranslations.length} vocabulary entries still miss translations.`,
      preview,
      "Run scripts/translate-article-vocabulary.mjs first, or pass --allow-missing-translations."
    ].join("\n"));
  }

  const rows = articles.map(article => articleToRow(article, {
    preserveUpdatedAt: args.preserveUpdatedAt !== "false"
  }));

  if (args.dryRun) {
    console.log(`Would seed ${rows.length} articles from ${input} into Supabase app_articles.`);
    return;
  }

  await upsertRows(rows, args);
  console.log(`Seeded ${rows.length} articles into Supabase app_articles.`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
