import {
  buildReviewPayload,
  parseArgs,
  supabaseRequest,
  writeJsonFile
} from "./translation-entry-utils.mjs";

function addFilter(filters, name, value) {
  if (!value) return;
  filters.push(`${name}=eq.${encodeURIComponent(value)}`);
}

async function main() {
  const args = parseArgs();
  const output = args.output || `translations/review-batch-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  const limit = Number(args.limit || 100);
  const filters = [
    "select=*",
    "order=namespace.asc,source_entity_id.asc,source_field.asc,target_language.asc",
    `limit=${limit}`
  ];

  addFilter(filters, "review_status", args.reviewStatus || "unreviewed");
  addFilter(filters, "provider", args.provider);
  addFilter(filters, "target_language", args.language || args.targetLanguage);
  addFilter(filters, "namespace", args.namespace);

  const rows = await supabaseRequest(`app_translation_entries?${filters.join("&")}`, {}, args);
  const payload = {
    instructions: [
      "Review each translated_text against source_text.",
      "Keep the target language natural and concise for a language-learning app.",
      "Return the same JSON shape and change only corrected_text and notes.",
      "Do not remove id values."
    ],
    exported_at: new Date().toISOString(),
    count: rows.length,
    entries: rows.map(buildReviewPayload)
  };

  await writeJsonFile(output, payload);
  console.log(`Exported ${rows.length} entries to ${output}`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
