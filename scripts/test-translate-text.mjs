import fs from "node:fs/promises";

const configSource = await fs.readFile(new URL("../config.js", import.meta.url), "utf8");
const articles = JSON.parse(await fs.readFile(new URL("../articles.json", import.meta.url), "utf8"));
const supabaseUrl = configSource.match(/url:\s*"([^"]+)"/)?.[1];
const publishableKey = configSource.match(/anonKey:\s*"([^"]+)"/)?.[1];

if (!supabaseUrl || !publishableKey) {
  throw new Error("Supabase config not found.");
}

const article = articles.find(item => (!item.language || item.language === "de") && item.text?.length);
const sourceText = (article?.text?.[0]?.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [])[0]?.trim();

if (!article || !sourceText) {
  throw new Error("No German test sentence found.");
}

const response = await fetch(`${supabaseUrl}/functions/v1/translate-text`, {
  method: "POST",
  headers: {
    apikey: publishableKey,
    Authorization: `Bearer ${publishableKey}`,
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    articleId: article.id,
    sourceType: "sentence",
    sourceText,
    sourceContext: "",
    targetLanguage: "sk"
  })
});

const result = await response.json().catch(() => ({}));
console.log(JSON.stringify({
  status: response.status,
  articleId: article.id,
  sourceText,
  result
}, null, 2));

if (!response.ok || !result.translation) process.exitCode = 1;
