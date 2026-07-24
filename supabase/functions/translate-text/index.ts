const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

const supportedLanguages = new Set(["de", "en", "sk", "ru", "pl", "hu", "ro", "it", "fr", "tr"]);
const wordPattern = /^[\p{L}\p{N}]+(?:[-'][\p{L}\p{N}]+)*$/u;

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}

function normalizeText(value: unknown) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function splitSentences(paragraph: string) {
  return (paragraph.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [paragraph])
    .map(normalizeText)
    .filter(Boolean);
}

function getArticleSentences(text: unknown) {
  if (!Array.isArray(text)) return [];
  return text.flatMap(paragraph => splitSentences(String(paragraph || "")));
}

function getArticleWords(text: unknown) {
  if (!Array.isArray(text)) return [];
  return text.flatMap(paragraph =>
    String(paragraph || "").match(/[\p{L}\p{N}]+(?:[-'][\p{L}\p{N}]+)*/gu) || []
  );
}

async function restRequest(
  supabaseUrl: string,
  serviceRoleKey: string,
  path: string,
  options: RequestInit = {}
) {
  const headers = new Headers(options.headers);
  headers.set("apikey", serviceRoleKey);
  headers.set("Authorization", `Bearer ${serviceRoleKey}`);
  headers.set("Content-Type", "application/json");

  return fetch(`${supabaseUrl.replace(/\/$/, "")}/rest/v1/${path}`, {
    ...options,
    headers
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const deeplApiKey = Deno.env.get("DEEPL_API_KEY");
  const deeplApiUrl = Deno.env.get("DEEPL_API_URL")
    || (deeplApiKey?.endsWith(":fx") ? "https://api-free.deepl.com" : "https://api.deepl.com");

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: "missing_supabase_environment" }, 500);
  }

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ error: "invalid_json" }, 400);
  }

  const articleId = normalizeText(payload.articleId);
  const sourceType = normalizeText(payload.sourceType);
  const sourceText = normalizeText(payload.sourceText);
  const sourceContext = normalizeText(payload.sourceContext);
  const targetLanguage = normalizeText(payload.targetLanguage).toLocaleLowerCase();

  if (!articleId || !["word", "sentence"].includes(sourceType)) {
    return jsonResponse({ error: "invalid_request" }, 400);
  }
  if (!supportedLanguages.has(targetLanguage)) {
    return jsonResponse({ error: "unsupported_target_language" }, 400);
  }
  if (!sourceText || sourceText.length > (sourceType === "word" ? 80 : 600)) {
    return jsonResponse({ error: "invalid_source_text" }, 400);
  }
  if (sourceType === "word" && !wordPattern.test(sourceText)) {
    return jsonResponse({ error: "invalid_word" }, 400);
  }

  const articleResponse = await restRequest(
    supabaseUrl,
    serviceRoleKey,
    `app_articles?id=eq.${encodeURIComponent(articleId)}&select=id,language,text&limit=1`
  );
  if (!articleResponse.ok) {
    return jsonResponse({ error: "article_lookup_failed" }, 502);
  }

  const [article] = await articleResponse.json();
  if (!article) return jsonResponse({ error: "article_not_found" }, 404);

  const sourceLanguage = supportedLanguages.has(article.language) ? article.language : "de";
  const comparableSource = sourceText.toLocaleLowerCase(sourceLanguage);
  const validSource = sourceType === "sentence"
    ? getArticleSentences(article.text)
      .some(sentence => sentence.toLocaleLowerCase(sourceLanguage) === comparableSource)
    : getArticleWords(article.text)
      .some(word => word.toLocaleLowerCase(sourceLanguage) === comparableSource);

  if (!validSource) return jsonResponse({ error: "text_not_in_article" }, 400);

  if (sourceLanguage === targetLanguage) {
    return jsonResponse({ translation: sourceText, cached: true, provider: "source" });
  }

  const cacheContext = sourceType === "word" ? sourceContext : "";
  const cacheQuery = new URLSearchParams({
    article_id: `eq.${articleId}`,
    source_type: `eq.${sourceType}`,
    source_text: `eq.${sourceText}`,
    source_context: `eq.${cacheContext}`,
    target_language: `eq.${targetLanguage}`,
    select: "translated_text,provider",
    limit: "1"
  });
  const cachedResponse = await restRequest(
    supabaseUrl,
    serviceRoleKey,
    `app_text_translations?${cacheQuery}`
  );
  if (cachedResponse.ok) {
    const [cached] = await cachedResponse.json();
    if (cached?.translated_text) {
      return jsonResponse({
        translation: cached.translated_text,
        cached: true,
        provider: cached.provider || "deepl"
      });
    }
  }

  if (!deeplApiKey) return jsonResponse({ error: "deepl_not_configured" }, 503);

  const deeplBody = new URLSearchParams({
    text: sourceText,
    source_lang: sourceLanguage.toLocaleUpperCase(),
    target_lang: targetLanguage === "en" ? "EN-US" : targetLanguage.toLocaleUpperCase()
  });
  if (sourceType === "word" && sourceContext) deeplBody.set("context", sourceContext);

  const deeplResponse = await fetch(`${deeplApiUrl.replace(/\/$/, "")}/v2/translate`, {
    method: "POST",
    headers: {
      Authorization: `DeepL-Auth-Key ${deeplApiKey}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: deeplBody
  });
  if (!deeplResponse.ok) {
    const detail = await deeplResponse.text();
    console.error("DeepL translation failed", deeplResponse.status, detail.slice(0, 300));
    return jsonResponse({ error: deeplResponse.status === 456 ? "deepl_limit_reached" : "translation_failed" }, 502);
  }

  const deeplResult = await deeplResponse.json();
  const translation = normalizeText(deeplResult?.translations?.[0]?.text);
  if (!translation) return jsonResponse({ error: "empty_translation" }, 502);

  const saveResponse = await restRequest(
    supabaseUrl,
    serviceRoleKey,
    "app_text_translations?on_conflict=article_id,source_type,source_text,source_context,target_language",
    {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({
        article_id: articleId,
        source_type: sourceType,
        source_language: sourceLanguage,
        source_text: sourceText,
        source_context: cacheContext,
        target_language: targetLanguage,
        translated_text: translation,
        provider: "deepl",
        updated_at: new Date().toISOString()
      })
    }
  );
  if (!saveResponse.ok) {
    console.error("Translation cache write failed", saveResponse.status, (await saveResponse.text()).slice(0, 300));
  }

  return jsonResponse({ translation, cached: false, provider: "deepl" });
});
