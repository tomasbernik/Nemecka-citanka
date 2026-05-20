import {
  parseArgs,
  readJsonFile,
  supabaseRequest
} from "./translation-entry-utils.mjs";

function normalizeReviewedEntry(entry, reviewProvider) {
  if (!entry.id) {
    throw new Error("Every reviewed entry must include id.");
  }

  const correctedText = String(entry.corrected_text ?? entry.translated_text ?? "").trim();
  if (!correctedText) {
    throw new Error(`Reviewed entry ${entry.id} has empty corrected_text.`);
  }

  return {
    id: entry.id,
    translated_text: correctedText,
    review_status: "ai_reviewed",
    review_provider: reviewProvider,
    reviewed_at: new Date().toISOString(),
    notes: entry.notes || null
  };
}

async function main() {
  const args = parseArgs();
  if (!args.input) {
    throw new Error("Pass --input path/to/reviewed-batch.json");
  }

  const reviewProvider = args.reviewProvider || "chatgpt";
  const payload = await readJsonFile(args.input, null);
  const entries = Array.isArray(payload) ? payload : payload?.entries;
  if (!Array.isArray(entries)) {
    throw new Error("Input must be a JSON array or an object with an entries array.");
  }

  const rows = entries.map(entry => normalizeReviewedEntry(entry, reviewProvider));
  for (const [index, row] of rows.entries()) {
    const { id, ...changes } = row;
    await supabaseRequest(`app_translation_entries?id=eq.${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify(changes)
    }, args);
    if ((index + 1) % 25 === 0 || index + 1 === rows.length) {
      console.log(`Imported ${index + 1}/${rows.length}`);
    }
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
