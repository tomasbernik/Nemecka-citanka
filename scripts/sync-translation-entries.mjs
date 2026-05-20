import {
  AUDIT_FILE,
  loadAppContext,
  makeEntryKey,
  parseArgs,
  readJsonFile,
  supabaseRequest,
  writeJsonFile
} from "./translation-entry-utils.mjs";

const SOURCE_PROVIDER = {
  UNKNOWN: "unknown",
  MANUAL: "manual",
  GOOGLE_SCRIPT: "google_translate_script"
};

function makeEntry({
  namespace,
  sourceEntityId,
  sourceField,
  sourcePath = "",
  sourceLanguage,
  targetLanguage,
  sourceText,
  translatedText,
  provider = SOURCE_PROVIDER.UNKNOWN,
  providerRunId = null,
  metadata = {}
}) {
  return {
    namespace,
    source_entity_id: sourceEntityId,
    source_field: sourceField,
    source_path: sourcePath,
    source_language: sourceLanguage,
    target_language: targetLanguage,
    source_text: String(sourceText || ""),
    translated_text: String(translatedText || ""),
    provider,
    provider_run_id: providerRunId,
    review_status: "unreviewed",
    metadata
  };
}

function addUiEntries(entries, context, auditMap) {
  const source = context.UI_TEXT[context.DEFAULT_NATIVE_LANGUAGE] || {};
  for (const [key, sourceText] of Object.entries(source)) {
    for (const language of Object.keys(context.NATIVE_LANGUAGES)) {
      if (language === context.DEFAULT_NATIVE_LANGUAGE) continue;
      const translatedText = context.UI_TEXT[language]?.[key];
      if (!translatedText || typeof translatedText !== "string") continue;

      const auditKey = [
        "ui",
        key,
        "text",
        "",
        context.DEFAULT_NATIVE_LANGUAGE,
        language
      ].join("\u001f");
      const audit = auditMap.get(auditKey);

      entries.push(makeEntry({
        namespace: "ui",
        sourceEntityId: key,
        sourceField: "text",
        sourceLanguage: context.DEFAULT_NATIVE_LANGUAGE,
        targetLanguage: language,
        sourceText,
        translatedText,
        provider: audit?.provider || SOURCE_PROVIDER.UNKNOWN,
        providerRunId: audit?.provider_run_id || null,
        metadata: { file: language in (context.NEW_LANGUAGE_UI_TEXT || {}) ? "translations/new-languages.js" : "translations/ui.js" }
      }));
    }
  }
}

function addCategoryEntries(entries, context) {
  for (const [category, labels] of Object.entries(context.CATEGORY_LABELS || {})) {
    const sourceText = labels[context.DEFAULT_NATIVE_LANGUAGE] || category;
    for (const language of context.VOCABULARY_LANGUAGE_CODES || []) {
      if (language === context.DEFAULT_NATIVE_LANGUAGE) continue;
      if (!labels[language]) continue;
      entries.push(makeEntry({
        namespace: "category",
        sourceEntityId: category,
        sourceField: "label",
        sourceLanguage: context.DEFAULT_NATIVE_LANGUAGE,
        targetLanguage: language,
        sourceText,
        translatedText: labels[language],
        provider: SOURCE_PROVIDER.UNKNOWN,
        metadata: { file: "constants.js" }
      }));
    }
  }
}

function addVocabularyEntries(entries, context, articles) {
  const languages = context.VOCABULARY_LANGUAGE_CODES || [];
  for (const article of articles) {
    for (const field of ["vocabulary", "inlineVocabulary"]) {
      const items = Array.isArray(article[field]) ? article[field] : [];
      items.forEach((item, index) => {
        const sourceText = item?.de || item?.base || "";
        if (!sourceText) return;
        for (const language of languages) {
          if (!item[language]) continue;
          entries.push(makeEntry({
            namespace: "article",
            sourceEntityId: article.id,
            sourceField: field === "inlineVocabulary" ? "inline_vocabulary" : "vocabulary",
            sourcePath: `${index}`,
            sourceLanguage: "de",
            targetLanguage: language,
            sourceText,
            translatedText: item[language],
            provider: SOURCE_PROVIDER.UNKNOWN,
            metadata: {
              article_title: article.title || "",
              item_index: index,
              item_de: item.de || "",
              item_base: item.base || ""
            }
          }));
        }
      });
    }
  }
}

async function loadAuditMap() {
  const audit = await readJsonFile(AUDIT_FILE, { entries: [] });
  return new Map((audit.entries || []).map(entry => [makeEntryKey(entry), entry]));
}

async function loadExistingMap(args) {
  try {
    const rows = await supabaseRequest(
      "app_translation_entries?select=id,namespace,source_entity_id,source_field,source_path,source_language,target_language,provider,provider_run_id,review_status,review_provider,reviewed_at,notes,metadata",
      {},
      args
    );
    return new Map((rows || []).map(row => [makeEntryKey(row), row]));
  } catch (error) {
    if (args.requireSupabase) throw error;
    return new Map();
  }
}

function preserveReviewState(entries, existingMap) {
  return entries.map(entry => {
    const existing = existingMap.get(makeEntryKey(entry));
    if (!existing) return entry;

    const shouldPreserveProvider = existing.provider && existing.provider !== SOURCE_PROVIDER.UNKNOWN;
    const shouldPreserveReview = existing.review_status && existing.review_status !== "unreviewed";
    return {
      ...entry,
      id: existing.id,
      provider: shouldPreserveProvider ? existing.provider : entry.provider,
      provider_run_id: shouldPreserveProvider ? existing.provider_run_id : entry.provider_run_id,
      review_status: shouldPreserveReview ? existing.review_status : entry.review_status,
      review_provider: existing.review_provider,
      reviewed_at: existing.reviewed_at,
      notes: existing.notes,
      metadata: {
        ...(existing.metadata || {}),
        ...(entry.metadata || {})
      }
    };
  });
}

async function main() {
  const args = parseArgs();
  const context = await loadAppContext();
  const articles = await readJsonFile("articles.json", []);
  const auditMap = await loadAuditMap();
  const entries = [];

  addUiEntries(entries, context, auditMap);
  addCategoryEntries(entries, context);
  addVocabularyEntries(entries, context, articles);

  const uniqueEntries = [...new Map(entries.map(entry => [makeEntryKey(entry), entry])).values()]
    .filter(entry => entry.source_text && entry.translated_text);

  const existingMap = await loadExistingMap(args);
  const output = preserveReviewState(uniqueEntries, existingMap);

  if (args.output) {
    await writeJsonFile(args.output, output);
    console.log(`Wrote ${output.length} translation entries to ${args.output}`);
  }

  if (args.supabase) {
    const batchSize = Number(args.batchSize || 500);
    for (let index = 0; index < output.length; index += batchSize) {
      const batch = output.slice(index, index + batchSize).map(({ id, ...entry }) => entry);
      await supabaseRequest("app_translation_entries?on_conflict=namespace,source_entity_id,source_field,source_path,source_language,target_language", {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify(batch)
      }, args);
      console.log(`Synced ${Math.min(index + batch.length, output.length)}/${output.length}`);
    }
  }

  if (!args.output && !args.supabase) {
    console.log(`Found ${output.length} translation entries. Use --output translations/translation-entries.json or --supabase.`);
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
