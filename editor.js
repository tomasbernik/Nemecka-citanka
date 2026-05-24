function linesToList(value) {
  return value.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
}

function parseVocabularyJson(value, allowDraft = false) {
  const text = stripJsonCodeFence(value);
  if (!text || (!text.startsWith("[") && !text.startsWith("{"))) return null;

  const parsed = JSON.parse(text);
  const items = Array.isArray(parsed) ? parsed : [parsed];
  return items.map(normalizeVocabularyImportItem)
    .filter(Boolean)
    .filter(item => item.de && (allowDraft || hasAnyVocabularyTranslation(item)));
}

function parseVocabularyLines(value) {
  const jsonItems = parseVocabularyJson(value);
  if (jsonItems) return jsonItems;

  const language = getNativeLanguage();
  return linesToList(value).map(line => {
    const [de, ...rest] = line.split("=");
    return makeVocabularyItem(de, rest.join("="), language);
  }).filter(item => item.de && getVocabularyTranslation(item, language));
}

function parseVocabularyDraftLines(value) {
  const jsonItems = parseVocabularyJson(value, true);
  if (jsonItems) return jsonItems;

  const language = getNativeLanguage();
  return linesToList(value).map(line => {
    const [de, ...rest] = line.split("=");
    return makeVocabularyItem(de, rest.join("="), language);
  }).filter(item => item.de);
}

function formatVocabularyLines(items = []) {
  const language = getNativeLanguage();
  const hasMultipleTranslations = items.some(item =>
    VOCABULARY_LANGUAGE_CODES.filter(code => item[code]).length > (item[language] ? 1 : 0)
    || item.base
  );
  if (hasMultipleTranslations) {
    return JSON.stringify(items.map(normalizeVocabularyImportItem).filter(Boolean), null, 2);
  }
  return items.map(item => `${item.de} = ${getVocabularyTranslation(item)}`).join("\n");
}

function mergeVocabularyTranslations(existingItems = [], parsedItems = [], language = getNativeLanguage()) {
  const existingByKey = new Map(existingItems.map(item => [normalizeVocabularyKey(item.de), item]));
  return parsedItems.map(item => {
    const existing = existingByKey.get(normalizeVocabularyKey(item.de)) || {};
    const translations = getVocabularyTranslations(item);
    return {
      ...existing,
      ...translations,
      de: item.de,
      base: item.base || existing.base || "",
      ...(item[language] ? { [language]: item[language] } : {})
    };
  });
}

function appendVocabularyTranslations(existingItems = [], parsedItems = [], language = getNativeLanguage()) {
  const byKey = new Map(existingItems.map(item => [normalizeVocabularyKey(item.de), item]));

  parsedItems.forEach(item => {
    const key = normalizeVocabularyKey(item.de);
    const existing = byKey.get(key) || {};
    const translations = getVocabularyTranslations(item);
    byKey.set(key, {
      ...existing,
      ...translations,
      de: item.de || existing.de,
      base: item.base || existing.base || "",
      ...(item[language] ? { [language]: item[language] } : {})
    });
  });

  return [...byKey.values()].filter(item => item.de);
}

function stripJsonCodeFence(value) {
  return value.trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function normalizeVocabularyImportItem(item) {
  if (!item || typeof item !== "object") return null;
  const normalized = {
    de: (item.de || item.german || item.word || item.phrase || "").trim(),
    base: (item.base || item.lemma || item.basic || item.grundform || "").trim()
  };
  VOCABULARY_LANGUAGE_CODES.forEach(code => {
    normalized[code] = (item[code] || "").trim();
  });
  return normalized.de ? normalized : null;
}

function normalizeQuestionImportItem(item) {
  if (typeof item === "string") {
    const [statement, ...rest] = item.split("=");
    return {
      statement: (statement || "").trim(),
      answer: ["true", "pravda", "p", "1", "ano", "áno"].includes(rest.join("=").trim().toLocaleLowerCase("sk"))
    };
  }
  if (!item || typeof item !== "object") return null;
  const answer = item.answer ?? item.correct ?? item.isTrue;
  return {
    statement: (item.statement || item.sentence || item.question || "").trim(),
    answer: typeof answer === "boolean"
      ? answer
      : ["true", "pravda", "p", "1", "ano", "áno"].includes(String(answer || "").trim().toLocaleLowerCase("sk"))
  };
}

function hasStrictAlternatingAnswers(questions) {
  return questions.length > 2
    && questions.every((question, index) => index === 0 || Boolean(question.answer) !== Boolean(questions[index - 1].answer));
}

function avoidAlternatingQuestionPattern(questions) {
  if (!hasStrictAlternatingAnswers(questions)) return questions;

  const adjusted = [...questions];
  [adjusted[1], adjusted[2]] = [adjusted[2], adjusted[1]];
  return adjusted;
}

function parseArticleImport(value) {
  const text = stripJsonCodeFence(value);
  if (!text) throw new Error(t("validationImportArticle"));

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw new Error(t("validationImportArticle"));
  }

  const source = parsed.article && typeof parsed.article === "object" ? parsed.article : parsed;
  const title = (source.title || "").trim();
  const textParagraphs = Array.isArray(source.text)
    ? source.text.map(item => String(item).trim()).filter(Boolean)
    : linesToList(String(source.text || ""));
  const vocabulary = (Array.isArray(source.vocabulary) ? source.vocabulary : [])
    .map(normalizeVocabularyImportItem)
    .filter(Boolean);
  const inlineVocabulary = (Array.isArray(source.inlineVocabulary) ? source.inlineVocabulary : source.inline_vocabulary || [])
    .map(normalizeVocabularyImportItem)
    .filter(Boolean);
  const questions = (Array.isArray(source.questions) ? source.questions : [])
    .map(normalizeQuestionImportItem)
    .filter(item => item?.statement);
  const categoryLabels = normalizeArticleCategoryLabels(
    source.categoryLabels || source.category_labels || {},
    source.category || getArticleEditorCategory()
  );

  const article = {
    id: (source.id || makeArticleId(title)).trim(),
    title,
    level: (source.level || $("articleLevelInput").value || "A2-B1").trim(),
    category: (source.category || getArticleEditorCategory()).trim(),
    categoryLabels,
    summary: (source.summary || source.description || "").trim(),
    text: textParagraphs,
    vocabulary,
    inlineVocabulary,
    questions: avoidAlternatingQuestionPattern(questions)
  };

  if (!article.title || !article.summary || !article.text.length || !article.vocabulary.length || !article.questions.length) {
    throw new Error(t("validationImportArticle"));
  }

  return article;
}

function getArticleImagePublicUrl(path) {
  return `${SUPABASE_CONFIG.url.replace(/\/$/, "")}/storage/v1/object/public/${ARTICLE_IMAGE_BUCKET}/${path}`;
}

async function imageFileToJpegBlob(file) {
  const bitmap = typeof createImageBitmap === "function"
    ? await createImageBitmap(file).catch(() => null)
    : null;

  if (bitmap) {
    try {
      return await drawImageAsJpegBlob(bitmap, bitmap.width, bitmap.height);
    } finally {
      bitmap.close?.();
    }
  }

  const imageUrl = URL.createObjectURL(file);
  const image = new Image();
  image.decoding = "async";

  try {
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = () => reject(new Error("Prehliadač nevie načítať vybraný obrázok."));
      image.src = imageUrl;
    });

    return await drawImageAsJpegBlob(image, image.naturalWidth, image.naturalHeight);
  } finally {
    URL.revokeObjectURL(imageUrl);
  }
}

async function drawImageAsJpegBlob(image, sourceWidth, sourceHeight) {
  const scale = Math.min(1, ARTICLE_IMAGE_MAX_WIDTH / sourceWidth);
  const width = Math.max(1, Math.round(sourceWidth * scale));
  const height = Math.max(1, Math.round(sourceHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) throw new Error("Prehliadač nevie pripraviť obrázok na upload.");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);

  return await new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (blob) resolve(blob);
      else reject(new Error("Prehliadač nevie previesť obrázok na JPG."));
    }, "image/jpeg", ARTICLE_IMAGE_JPEG_QUALITY);
  });
}

async function uploadArticleImage(article) {
  if (!state.articleImageFile) return article.image || null;
  if (!state.remoteReady) throw new Error(t("editorNeedsSupabase"));

  $("articleImageStatus").textContent = t("imageUploading");
  const blob = await imageFileToJpegBlob(state.articleImageFile);
  const path = `${article.id}.jpg`;

  await supabaseStorageRequest(`object/${ARTICLE_IMAGE_BUCKET}/${encodeURIComponent(path)}`, {
    method: "POST",
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "3600",
      "x-upsert": "true"
    },
    body: blob
  });

  $("articleImageStatus").textContent = t("imageUploaded");
  return {
    desktop: getArticleImagePublicUrl(path),
    alt: article.title
  };
}

function updateArticleImageStatus(article = null) {
  const status = $("articleImageStatus");
  if (!status) return;
  if (state.articleImageFile) {
    status.textContent = t("imageReady");
  } else if (article?.image?.desktop) {
    status.textContent = t("imageExisting");
  } else {
    status.textContent = "";
  }
}

function getArticleImageStoragePath(article) {
  const desktop = article?.image?.desktop || "";
  const marker = `/storage/v1/object/public/${ARTICLE_IMAGE_BUCKET}/`;
  const index = desktop.indexOf(marker);
  return index >= 0
    ? decodeURIComponent(desktop.slice(index + marker.length))
    : article?.id ? `${article.id}.jpg` : "";
}

function parseQuestionLines(value) {
  return linesToList(value).map(line => {
    const [statement, ...rest] = line.split("=");
    const answerValue = rest.join("=").trim().toLocaleLowerCase("sk");
    return {
      statement: (statement || "").trim(),
      answer: ["true", "pravda", "p", "1", "ano", "áno"].includes(answerValue)
    };
  }).filter(item => item.statement);
}

function formatQuestionLines(items = []) {
  return items.map(item => `${item.statement || item} = ${item.answer ? "true" : "false"}`).join("\n");
}

async function copyTextToClipboard(text, successMessage = t("copied")) {
  if (!text.trim()) {
    $("articleEditorStatus").textContent = t("nothingToCopy");
    return;
  }

  try {
    if (!navigator.clipboard?.writeText) {
      throw new Error("Clipboard API nie je dostupné.");
    }

    await navigator.clipboard.writeText(text);
    $("generatedPromptOutput").value = "";
    $("generatedPromptWrap").classList.add("hidden");
    $("articleEditorStatus").textContent = successMessage;
  } catch (error) {
    $("generatedPromptOutput").value = text;
    $("generatedPromptWrap").classList.remove("hidden");
    $("generatedPromptOutput").focus();
    $("generatedPromptOutput").select();
    $("articleEditorStatus").textContent = t("copyFailed");
  }
}

function getSelectedArticleText() {
  const input = $("articleTextInput");
  return input.value.slice(input.selectionStart, input.selectionEnd).trim();
}

function isArticleTextWordChar(character) {
  return /[\p{L}\p{N}_'-]/u.test(character || "");
}

function getArticleTextWordRange(text, position) {
  if (!text) return null;
  let index = Math.max(0, Math.min(position, text.length - 1));

  if (!isArticleTextWordChar(text[index]) && index > 0 && isArticleTextWordChar(text[index - 1])) {
    index -= 1;
  }
  if (!isArticleTextWordChar(text[index])) return null;

  let start = index;
  let end = index + 1;
  while (start > 0 && isArticleTextWordChar(text[start - 1])) start -= 1;
  while (end < text.length && isArticleTextWordChar(text[end])) end += 1;
  return { start, end };
}

function getArticleTextSentenceRange(text, position) {
  if (!text?.trim()) return null;
  let index = Math.max(0, Math.min(position, text.length - 1));

  if (/\s/u.test(text[index] || "")) {
    const before = text.slice(0, index).search(/\S\s*$/u);
    const afterMatch = text.slice(index).match(/\S/u);
    if (afterMatch && (before < 0 || afterMatch.index <= index - before)) {
      index += afterMatch.index;
    } else if (before >= 0) {
      index = before;
    }
  }

  const paragraphStart = text.lastIndexOf("\n", Math.max(0, index - 1)) + 1;
  const nextBreak = text.indexOf("\n", index);
  const paragraphEnd = nextBreak >= 0 ? nextBreak : text.length;
  if (!text.slice(paragraphStart, paragraphEnd).trim()) return null;

  let start = paragraphStart;
  for (let i = index - 1; i >= paragraphStart; i -= 1) {
    if (/[.!?]/u.test(text[i])) {
      start = i + 1;
      break;
    }
  }

  let end = paragraphEnd;
  for (let i = index; i < paragraphEnd; i += 1) {
    if (/[.!?]/u.test(text[i])) {
      end = i + 1;
      while (end < paragraphEnd && /["'“”‘’»«)]/u.test(text[end])) end += 1;
      break;
    }
  }

  while (start < end && /\s/u.test(text[start])) start += 1;
  while (end > start && /\s/u.test(text[end - 1])) end -= 1;
  return start < end ? { start, end } : null;
}

function selectArticleTextRange(input, start, end) {
  const rangeStart = Math.max(0, Math.min(start, end));
  const rangeEnd = Math.min(input.value.length, Math.max(start, end));
  input.focus({ preventScroll: true });
  input.setSelectionRange(rangeStart, rangeEnd);
}

function resetArticleTextSelectionAnchor() {
  state.editorTapSelectionAnchor = null;
}

function selectArticleTextWordFromCaret() {
  const input = $("articleTextInput");
  if (!input) return;

  const wordRange = getArticleTextWordRange(input.value, input.selectionStart);
  if (!wordRange) {
    resetArticleTextSelectionAnchor();
    $("articleEditorStatus").textContent = t("selectWordFirst");
    return;
  }

  selectArticleTextRange(input, wordRange.start, wordRange.end);
  resetArticleTextSelectionAnchor();
}

function selectArticleTextSentenceFromCaret() {
  const input = $("articleTextInput");
  if (!input) return;

  const sentenceRange = getArticleTextSentenceRange(input.value, input.selectionStart);
  if (!sentenceRange) {
    resetArticleTextSelectionAnchor();
    $("articleEditorStatus").textContent = t("selectWordFirst");
    return;
  }

  selectArticleTextRange(input, sentenceRange.start, sentenceRange.end);
  resetArticleTextSelectionAnchor();
}

function appendUniqueLine(textareaId, line) {
  const textarea = $(textareaId);
  const normalizedLine = line.trim();
  if (!normalizedLine) return false;

  const key = normalizeVocabularyKey(normalizedLine.split("=")[0]);
  let jsonItems = null;
  try {
    jsonItems = parseVocabularyJson(textarea.value, true);
  } catch (error) {
    jsonItems = null;
  }
  if (jsonItems) {
    const existingKeys = jsonItems.map(item => normalizeVocabularyKey(item.de));
    if (existingKeys.includes(key)) return false;

    const language = getNativeLanguage();
    const [de, ...rest] = normalizedLine.split("=");
    textarea.value = JSON.stringify([
      ...jsonItems,
      makeVocabularyItem(de, rest.join("="), language)
    ], null, 2);
    return true;
  }

  const existingKeys = linesToList(textarea.value)
    .map(item => normalizeVocabularyKey(item.split("=")[0]));
  if (existingKeys.includes(key)) return false;

  textarea.value = [...linesToList(textarea.value), normalizedLine].join("\n");
  return true;
}

function getDraftInlineVocabularyItems() {
  try {
    return parseVocabularyDraftLines($("articleInlineVocabularyInput").value);
  } catch (error) {
    return [];
  }
}

function getAllEditorInlineVocabularyItems() {
  return [
    ...(state.editorBaseInlineVocabulary || []),
    ...(state.editorManualInlineVocabulary || []),
    ...getDraftInlineVocabularyItems()
  ];
}

function renderHighlightedArticleText(text, phrases) {
  if (!text) return "";
  if (!phrases.length) return escapeHtml(text);

  const pattern = new RegExp(`(^|[^\\p{L}\\p{N}_])(${phrases.map(escapeRegExp).join("|")})(?=$|[^\\p{L}\\p{N}_])`, "giu");
  let html = "";
  let cursor = 0;
  let match;

  while ((match = pattern.exec(text)) !== null) {
    const prefix = match[1] || "";
    const phrase = match[2] || "";
    const phraseStart = match.index + prefix.length;
    const phraseEnd = phraseStart + phrase.length;

    html += escapeHtml(text.slice(cursor, phraseStart));
    html += `<span class="editor-inline-hit">${escapeHtml(text.slice(phraseStart, phraseEnd))}</span>`;
    cursor = phraseEnd;
  }

  return html + escapeHtml(text.slice(cursor));
}

function syncArticleInlineHighlightScroll() {
  const input = $("articleTextInput");
  const wrap = $("articleInlineHighlightPreview");
  if (!input || !wrap) return;
  wrap.scrollLeft = input.scrollLeft;
  wrap.scrollTop = input.scrollTop;
}

function renderArticleInlineHighlightPreview() {
  const wrap = $("articleInlineHighlightPreview");
  if (!wrap) return;

  const text = $("articleTextInput").value;
  const phrases = getAllEditorInlineVocabularyItems()
    .map(item => item.de)
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);

  wrap.innerHTML = renderHighlightedArticleText(text, phrases);
  syncArticleInlineHighlightScroll();
}

function addManualInlineVocabularyItem(text) {
  const item = makeVocabularyItem(text, "", getNativeLanguage());
  const key = normalizeVocabularyKey(item.de);
  if (!key) return false;

  const existingKeys = [
    ...(state.editorBaseInlineVocabulary || []),
    ...(state.editorManualInlineVocabulary || []),
    ...getDraftInlineVocabularyItems()
  ].map(entry => normalizeVocabularyKey(entry.de));

  if (existingKeys.includes(key)) return false;
  state.editorManualInlineVocabulary = [
    ...(state.editorManualInlineVocabulary || []),
    item
  ];
  return true;
}

function isSelectionCoveredByInlineVocabulary(selected) {
  const selectedKey = normalizeVocabularyKey(selected);
  if (!selectedKey) return false;
  const selectedWords = getSentenceWords(selectedKey);

  return getAllEditorInlineVocabularyItems().some(item => {
    const itemKey = normalizeVocabularyKey(item.de);
    if (!itemKey) return false;
    if (itemKey === selectedKey) return true;
    if (selectedWords.length !== 1) return itemKey.includes(selectedKey);
    return getSentenceWords(itemKey).includes(selectedWords[0]);
  });
}

function addSelectedTextToVocabulary(addToVocabulary) {
  const selected = getSelectedArticleText();
  if (!selected) {
    $("articleEditorStatus").textContent = t("selectWordFirst");
    return;
  }

  if (isSelectionCoveredByInlineVocabulary(selected)) {
    $("articleEditorStatus").textContent = t("selectionAlreadyInline");
    return;
  }

  const line = `${selected} =`;
  const inlineAdded = addManualInlineVocabularyItem(selected);
  const vocabAdded = addToVocabulary ? appendUniqueLine("articleVocabularyInput", line) : false;
  if (inlineAdded) $("articleInlineVocabularyInput").dataset.manual = "true";
  $("articleEditorStatus").textContent = inlineAdded || vocabAdded
    ? t("selectedAdded")
    : t("expressionExists");
}

function getPromptText() {
  return PROMPT_TEXT[getUiLanguage()] || PROMPT_TEXT[DEFAULT_NATIVE_LANGUAGE];
}

function getArticleJsonPromptInstructions(level) {
  const vocabularyExample = `{\"de\":\"slovo alebo fráza z textu\",\"base\":\"základný tvar\",${VOCABULARY_LANGUAGE_CODES
    .map(code => `\"${code}\":\"${NATIVE_LANGUAGES[code]?.lineFormat || code} preklad\"`)
    .join(",")}}`;
  const inlineVocabularyExample = `{\"de\":\"presný súvislý úsek skopírovaný z textu článku\",\"base\":\"základný tvar\",${VOCABULARY_LANGUAGE_CODES
    .map(code => `\"${code}\":\"${NATIVE_LANGUAGES[code]?.lineFormat || code} preklad\"`)
    .join(",")}}`;

  return [
    "",
    "JSON schéma:",
    "{",
    "  \"title\": \"nemecký názov článku\",",
    `  \"level\": \"${level}\",`,
    "  \"category\": \"kategória alebo téma\",",
    `  \"categoryLabels\": {\"názov kategórie alebo témy\":{\"${Object.keys(NATIVE_LANGUAGES).join("\":\"preklad\", \"")}\":\"preklad\"}},`,
    "  \"summary\": \"krátky nemecký popis článku\",",
    "  \"text\": [\"odsek 1\", \"odsek 2\", \"odsek 3\", \"odsek 4\"],",
    "  \"vocabulary\": [",
    `    ${vocabularyExample}`,
    "  ],",
    "  \"inlineVocabulary\": [",
    `    ${inlineVocabularyExample}`,
    "  ],",
    "  \"questions\": [",
    "    {\"statement\":\"nemecká pravda/nepravda veta\",\"answer\":true}",
    "  ]",
    "}",
    "",
    "Použi nižšie vložený text presne tak, ako je. Neprepisuj ho, neskracuj ho a nemen dĺžku textu.",
    "Text rozdeľ do poľa \"text\" podľa odsekov.",
    `Do "vocabulary" pridaj presne 5 nemeckých slov alebo fráz, ktoré patria na úroveň ${level}, ale typicky ešte nepatria do nižšej úrovne. Musia sa prirodzene objaviť v texte a majú sa učiť ako nové slovíčka tejto úrovne.`,
    "Do \"inlineVocabulary\" pridaj 8 až 12 položiek: môžu to byť jednotlivé slová, krátke frázy, ustálené spojenia alebo zaujímavé výrazy, ktoré môžu byť pre študenta neznáme. Hodnota \"de\" musí byť presný súvislý úsek skopírovaný z textu článku v rovnakom tvare, poradí slov a páde/čase. Nepoužívaj slovníkové tvary ani infinitívne parafrázy, ak sa presne tak v texte nenachádzajú. Opakuj položky z \"vocabulary\" ale v tvare, ako su spomenute v texte.",
    "Do \"questions\" pridaj 6 až 8 pravda/nepravda viet po nemecky s mixom true a false. Odpovede nesmú byť v pravidelnom poradí true/false/true/false ani false/true/false/true; poradie musí pôsobiť prirodzene a môže mať aj dve rovnaké odpovede za sebou.",
    `Do \"categoryLabels\" pridaj pre každú kategóriu alebo tému preklady do všetkých jazykov: ${Object.keys(NATIVE_LANGUAGES).join(", ")}. Kľúč objektu musí presne zodpovedať hodnote v poli \"category\"; ak je viac kategórií oddelených znakom |, pridaj každú zvlášť.`,
    `Všetky položky vocabulary aj inlineVocabulary musia mať kľúče de, base, ${VOCABULARY_LANGUAGE_CODES.join(", ")}.`,
    "Do \"base\" daj základný slovníkový tvar: pri podstatnom mene s určitým členom a v nominatíve jednotného čísla, napríklad \"der Mann\"; pri slovese infinitív, napríklad \"gehen\"; pri prídavnom mene základný tvar, napríklad \"freundlich\". Ak je \"de\" už základný tvar alebo ide o celú frázu, môže byť \"base\" rovnaké ako \"de\"."
  ];
}

function getSelectedArticleLengthRange() {
  const value = $("articleLengthSelect")?.value || "300-350";
  const [min, max] = value.split("-").map(item => Number.parseInt(item, 10));
  return {
    label: Number.isFinite(min) && Number.isFinite(max) ? `${min} až ${max}` : "300 až 350",
    min: Number.isFinite(min) ? min : 300,
    max: Number.isFinite(max) ? max : 350
  };
}

function buildArticlePrompt() {
  const topic = $("articlePromptInput").value.trim();
  const level = $("articleLevelInput").value.trim() || "A2-B1";
  const category = getArticleEditorCategory();
  const requiredWords = getArticleRequiredWords();
  const range = getSelectedArticleLengthRange();

  return [
    `Napíš nemecký príbeh alebo článok na úrovni ${level}.`,
    category ? `Kategória/téma: ${category}.` : "",
    topic ? `Konkrétne zadanie: ${topic}` : "",
    requiredWords.length
      ? `Tieto nemecké slová alebo frázy použi prirodzene: ${requiredWords.join(", ")}.`
      : "",
    `Dĺžka: ${range.label} slov.`,
    "Obsah musí mať aspoň jeden prirodzený dialóg v nemčine, napríklad 2 až 4 repliky medzi postavami.",
    "Dej môže byť praktický, zaujímavý alebo mierne veselý.",
    "Vráť iba hotový nemecký obsah. Nepíš JSON, slovíčka, otázky ani vysvetlenie."
  ].filter(Boolean).join("\n");
}

function buildArticleJsonPrompt() {
  const text = $("articleTextInput").value.trim();
  const level = $("articleLevelInput").value.trim() || "A2-B1";
  const category = getArticleEditorCategory();
  const title = $("articleTitleInput").value.trim();
  const summary = $("articleSummaryInput").value.trim();

  addRequiredWordsToVocabulary();

  return [
    "Premeň tento hotový nemecký text na JSON pre čítankovú appku.",
    "Dôležité: vložený text použi presne. Neprepisuj ho, neskracuj ho, nerozširuj ho a nemeň formulácie.",
    title ? `Ak sa hodí, použi tento názov: ${title}` : "Vytvor krátky nemecký názov.",
    summary ? `Ak sa hodí, použi tento krátky popis: ${summary}` : "Vytvor krátky nemecký popis.",
    category ? `Kategória: ${category}.` : "",
    ...getArticleJsonPromptInstructions(level),
    "",
    text
      ? "Hotový nemecký text:"
      : "Hotový nemecký text je tvoja posledná odpoveď v tomto chate. Použi práve túto poslednú nemeckú odpoveď.",
    text
  ].filter(Boolean).join("\n");
}

function importArticleToEditor() {
  try {
    const article = parseArticleImport($("articleImportInput").value);
    $("articleEditorSelect").value = "";
    fillArticleEditor({
      ...article,
      visibility: DEFAULT_ARTICLE_VISIBILITY,
      approvalStatus: DEFAULT_ARTICLE_APPROVAL_STATUS
    });
    $("articleVocabularyInput").value = JSON.stringify(article.vocabulary, null, 2);
    state.editorBaseInlineVocabulary = article.inlineVocabulary || [];
    state.editorManualInlineVocabulary = [];
    $("articleInlineVocabularyInput").value = "";
    $("articleInlineVocabularyInput").dataset.manual = "";
    $("articleQuestionsInput").value = formatQuestionLines(article.questions);
    $("articleEditorStatus").textContent = t("articleImported");
    updateArticleEditorFlow();
  } catch (error) {
    $("articleEditorStatus").textContent = error.message;
  }
}

function addRequiredWordsToVocabulary() {
}

function buildTranslationPrompt() {
  const translatedKeys = new Set(getDraftInlineVocabularyItems()
    .filter(hasAnyVocabularyTranslation)
    .map(item => normalizeVocabularyKey(item.de)));
  const words = (state.editorManualInlineVocabulary || [])
    .filter(item => !translatedKeys.has(normalizeVocabularyKey(item.de)));
  const seen = new Set();
  const missing = words
    .filter(item => !hasAllVocabularyTranslations(item))
    .filter(item => {
      const key = normalizeVocabularyKey(item.de);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map(item => `${item.de} =`);

  if (!missing.length) return "";
  return getPromptText().translation(missing).join("\n");
}

function buildQuestionsPrompt() {
  const title = $("articleTitleInput").value.trim();
  const text = $("articleTextInput").value.trim();

  return getPromptText().questions({ title, text }).filter(Boolean).join("\n");
}

function buildImagePrompt() {
  const title = $("articleTitleInput").value.trim();
  const summary = $("articleSummaryInput").value.trim();
  const level = $("articleLevelInput").value.trim() || "A2-B1";
  const category = getArticleEditorCategory();
  const text = linesToList($("articleTextInput").value).join(" ");
  const topic = $("articlePromptInput").value.trim();
  const vocabulary = [
    ...parseVocabularyDraftLines($("articleVocabularyInput").value),
    ...parseVocabularyDraftLines($("articleInlineVocabularyInput").value)
  ].map(item => item.de).filter(Boolean).slice(0, 12);

  return [
    "Create a cheerful modern educational illustration for a German reading app.",
    title ? `Article title: ${title}` : "",
    `German level: ${level}.`,
    category ? `Category: ${category}.` : "",
    summary ? `Article summary: ${summary}` : topic ? `Topic: ${topic}` : "",
    text ? `Article text context: ${text.slice(0, 900)}` : "",
    vocabulary.length ? `Important words and phrases to reflect subtly: ${vocabulary.join(", ")}.` : "",
    "The image should show the main situation from the article clearly and naturally.",
    "No text, no letters, no captions, no speech bubbles, no logos.",
    "Warm, slightly playful style with friendly light humor and expressive characters, but not childish.",
    "Colorful everyday European setting, natural light, suitable for teen and adult learners.",
    "Landscape composition, 16:9, clean focus, polished modern textbook illustration style."
  ].filter(Boolean).join("\n");
}

async function renderArticleAssignmentPanel(article = state.articles.find(item => item.id === $("articleEditorSelect")?.value) || null) {
  const panel = $("articleAssignmentPanel");
  const list = $("articleAssignmentList");
  if (!panel || !list) return;

  const canAssign = Boolean(article?.id && state.currentProfile?.role === "teacher");
  panel.classList.toggle("hidden", !canAssign);
  $("articleAssignmentStatus").textContent = "";
  if (!canAssign) {
    list.innerHTML = "";
    return;
  }

  const students = getTeacherStudents();
  if (!students.length) {
    list.innerHTML = '<p class="muted">V skupine ešte nie sú žiaci.</p>';
    return;
  }

  const rows = await Promise.all(students.map(async student => {
    const data = await getProfileData(student);
    const assignment = getAssignmentForArticle(article.id, data);
    const assigned = Boolean(assignment);
    const status = getArticleAssignmentStatusInfo(article, data);
    return `
      <label class="assignment-row assignment-row-${escapeHtml(status.key)}">
        <input type="checkbox" value="${escapeHtml(student.id)}" ${assigned ? "checked" : ""}>
        <span>
          <strong>${escapeHtml(student.name)}</strong>
          <small>
            <span class="dashboard-pill status-${escapeHtml(status.key)}">${escapeHtml(status.label)}</span>
            ${status.detail ? ` ${escapeHtml(status.detail)}` : ""}
          </small>
        </span>
      </label>
    `;
  }));
  list.innerHTML = rows.join("");
}

async function assignSelectedArticleToStudents() {
  const article = state.articles.find(item => item.id === $("articleEditorSelect")?.value);
  if (!article) return;

  const selectedIds = new Set(
    Array.from(document.querySelectorAll("#articleAssignmentList input[type='checkbox']:checked"))
      .map(input => input.value)
  );
  const students = getTeacherStudents();
  const assignedAt = new Date().toISOString();

  try {
    await Promise.all(students.map(async student => {
      const data = await getProfileData(student);
      const currentAssignment = getAssignmentForArticle(article.id, data);
      const existing = getAssignments(data).filter(assignment => assignment.articleId !== article.id);
      const assignments = selectedIds.has(student.id)
        ? [
            currentAssignment
              ? { ...currentAssignment, articleTitle: article.title, teacherId: state.currentProfile.id }
              : {
              articleId: article.id,
              articleTitle: article.title,
              teacherId: state.currentProfile.id,
              assignedAt
            },
            ...existing
          ]
        : existing;
      await saveProfileDataForProfile(student, { ...data, assignments });
    }));
    $("articleAssignmentStatus").textContent = "Zadanie je uložené.";
    renderArticleAssignmentPanel(article);
    await renderTeacherOverview();
  } catch (error) {
    $("articleAssignmentStatus").textContent = error.message;
  }
}

function renderArticleEditorList(selectedId = $("articleEditorSelect")?.value) {
  const select = $("articleEditorSelect");
  if (!select) return;

  select.innerHTML = [
    `<option value="">${escapeHtml(t("newArticleOption"))}</option>`,
    ...getEditableArticles().map(article => `<option value="${escapeHtml(article.id)}">${escapeHtml(article.title)}</option>`)
  ].join("");
  select.value = selectedId && getEditableArticles().some(article => article.id === selectedId) ? selectedId : "";

  const article = state.articles.find(item => item.id === select.value);
  fillArticleEditor(article || null);
}

function renderArticleCategoryOptions(selectedCategory = "") {
  const select = $("articleCategorySelect");
  if (!select) return;

  const categories = getArticleCategories();
  const selectedExists = selectedCategory && categories.includes(selectedCategory);
  select.innerHTML = [
    `<option value="">${escapeHtml(t("chooseCategory"))}</option>`,
    ...categories.map(category => `<option value="${escapeHtml(category)}">${escapeHtml(getCategoryLabel(category))}</option>`),
    `<option value="${NEW_CATEGORY_VALUE}">+ ${escapeHtml(t("newCategory"))}</option>`
  ].join("");
  select.value = selectedExists ? selectedCategory : selectedCategory ? NEW_CATEGORY_VALUE : "";
  $("articleCategoryInput").value = selectedExists ? "" : selectedCategory;
  updateArticleCategoryMode();
}

function getArticleEditorCategory() {
  return getArticleEditorCategoryValue();
}

function fillCategorySelect(selectId, inputId, selectedCategory = "") {
  const select = $(selectId);
  if (!select) return;

  const categories = getArticleCategories();
  const selectedExists = selectedCategory && categories.includes(selectedCategory);
  select.innerHTML = [
    `<option value="">${escapeHtml(t("chooseCategory"))}</option>`,
    ...categories.map(category => `<option value="${escapeHtml(category)}">${escapeHtml(getCategoryLabel(category))}</option>`),
    `<option value="${NEW_CATEGORY_VALUE}">+ ${escapeHtml(t("newCategory"))}</option>`
  ].join("");
  select.value = selectedExists ? selectedCategory : selectedCategory ? NEW_CATEGORY_VALUE : "";
  $(inputId).value = selectedExists ? "" : selectedCategory;
}

function renderArticleCategoryOptionsMulti(selectedCategory = "") {
  const [primaryCategory = "", secondaryCategory = ""] = Array.isArray(selectedCategory)
    ? selectedCategory
    : getArticleCategoriesForFilter({ category: selectedCategory });
  fillCategorySelect("articleCategorySelect", "articleCategoryInput", primaryCategory);
  fillCategorySelect("articleCategory2Select", "articleCategory2Input", secondaryCategory);
  updateArticleCategoryMode();
}

function getEmptyCategoryLabels(category = "") {
  return Object.fromEntries(Object.keys(NATIVE_LANGUAGES).map(code => [code, category]));
}

function normalizeCategoryLabels(labels = {}, category = "") {
  const source = labels && typeof labels === "object" ? labels : {};
  const normalized = getEmptyCategoryLabels(category);
  Object.keys(NATIVE_LANGUAGES).forEach(code => {
    if (source[code]) normalized[code] = String(source[code]).trim();
  });
  return normalized;
}

function normalizeArticleCategoryLabels(labels = {}, categoryValue = "") {
  const categories = getArticleCategoriesForFilter({ category: categoryValue });
  return Object.fromEntries(categories
    .filter(category => !getCategoryLabels(category))
    .map(category => {
      const source = labels?.[category] || labels;
      return [category, normalizeCategoryLabels(source, category)];
    }));
}

function renderCategoryTranslationInputs(rootId, category, labels = {}) {
  const root = $(rootId);
  if (!root) return;

  root.innerHTML = `
    <p class="muted">${escapeHtml(t("categoryTranslations"))}</p>
    <div class="category-translation-grid">
      ${Object.entries(NATIVE_LANGUAGES).map(([code, language]) => `
        <label class="field-row compact">
          ${escapeHtml(language.label)}
          <input data-category-translation="${escapeHtml(code)}" value="${escapeHtml(labels[code] || category || "")}">
        </label>
      `).join("")}
    </div>
  `;
}

function readCategoryTranslationInputs(rootId, category) {
  const root = $(rootId);
  if (!root || root.classList.contains("hidden")) return null;

  const labels = getEmptyCategoryLabels(category);
  root.querySelectorAll("[data-category-translation]").forEach(input => {
    labels[input.dataset.categoryTranslation] = input.value.trim() || category;
  });
  return labels;
}

function getArticleEditorCategoryLabels() {
  const categoryPairs = [
    {
      category: $("articleCategorySelect").value === NEW_CATEGORY_VALUE ? $("articleCategoryInput").value.trim() : $("articleCategorySelect").value.trim(),
      rootId: "articleCategoryTranslations",
      isNew: $("articleCategorySelect").value === NEW_CATEGORY_VALUE
    },
    {
      category: $("articleCategory2Select").value === NEW_CATEGORY_VALUE ? $("articleCategory2Input").value.trim() : $("articleCategory2Select").value.trim(),
      rootId: "articleCategory2Translations",
      isNew: $("articleCategory2Select").value === NEW_CATEGORY_VALUE
    }
  ];

  return categoryPairs.reduce((labelsByCategory, item) => {
    if (!item.category) return labelsByCategory;
    const enteredLabels = readCategoryTranslationInputs(item.rootId, item.category);
    const existingArticleLabels = state.editorCategoryLabels?.[item.category];
    if ((item.isNew && !getCategoryLabels(item.category)) || existingArticleLabels) {
      labelsByCategory[item.category] = normalizeCategoryLabels(enteredLabels || existingArticleLabels || {}, item.category);
    }
    return labelsByCategory;
  }, {});
}

function getArticleEditorCategories() {
  const primary = $("articleCategorySelect").value === NEW_CATEGORY_VALUE
    ? $("articleCategoryInput").value.trim()
    : $("articleCategorySelect").value.trim();
  const secondary = $("articleCategory2Select").value === NEW_CATEGORY_VALUE
    ? $("articleCategory2Input").value.trim()
    : $("articleCategory2Select").value.trim();
  return [primary, secondary]
    .map(category => category.trim())
    .filter(Boolean)
    .filter((category, index, categories) => categories.indexOf(category) === index);
}

function getArticleEditorCategoryValue() {
  return getArticleEditorCategories().join(CATEGORY_SEPARATOR);
}

function wantsRequiredWords() {
  return $("articleRequiredWordsMode")?.value === "yes";
}

function getArticleRequiredWords() {
  return wantsRequiredWords() ? linesToList($("articleRequiredWordsInput").value) : [];
}

function updateArticleRequiredWordsMode() {
  const enabled = wantsRequiredWords();
  $("articleRequiredWordsWrap")?.classList.toggle("hidden", !enabled);
  if (!enabled) $("articleRequiredWordsInput").value = "";
}

function updateArticleCategoryMode() {
  const isNewCategory = $("articleCategorySelect").value === NEW_CATEGORY_VALUE;
  $("articleNewCategoryWrap").classList.toggle("hidden", !isNewCategory);
  const isNewCategory2 = $("articleCategory2Select")?.value === NEW_CATEGORY_VALUE;
  $("articleNewCategory2Wrap")?.classList.toggle("hidden", !isNewCategory2);
  $("articleCategoryTranslations")?.classList.toggle("hidden", !isNewCategory);
  $("articleCategory2Translations")?.classList.toggle("hidden", !isNewCategory2);
  if (isNewCategory) {
    const category = $("articleCategoryInput").value.trim();
    renderCategoryTranslationInputs("articleCategoryTranslations", category, state.editorCategoryLabels?.[category] || getEmptyCategoryLabels(category));
  }
  if (isNewCategory2) {
    const category = $("articleCategory2Input").value.trim();
    renderCategoryTranslationInputs("articleCategory2Translations", category, state.editorCategoryLabels?.[category] || getEmptyCategoryLabels(category));
  }
}

function hasTranslatedVocabulary() {
  try {
    return parseVocabularyLines($("articleVocabularyInput").value).length > 0;
  } catch (error) {
    return false;
  }
}

function updateArticleEditorFlow() {
  const isEditing = Boolean($("articleEditorSelect")?.value);
  const selectedArticle = state.articles.find(item => item.id === $("articleEditorSelect")?.value) || null;
  const hasGeneratedPrompt = Boolean($("generatedPromptOutput")?.value.trim());
  const hasContent = Boolean(
    $("articleTitleInput").value.trim()
    || $("articleTextInput").value.trim()
    || $("articleSummaryInput").value.trim()
    || getArticleEditorCategory()
    || $("articlePromptInput").value.trim()
    || getArticleRequiredWords().length
  );
  const hasText = Boolean($("articleTextInput").value.trim());
  const hasQuestions = Boolean($("articleQuestionsInput").value.trim());
  const hasVocabulary = hasTranslatedVocabulary();
  const showInlineVocabularyEditor = $("articleInlineVocabularyInput").dataset.manual === "true"
    || Boolean($("articleInlineVocabularyInput").value.trim());

  $("articleContentStep").classList.toggle("hidden", !(isEditing || hasGeneratedPrompt || hasContent));
  $("articleQuestionsStep").classList.add("hidden");
  $("articleVocabularyStep").classList.toggle("hidden", !showInlineVocabularyEditor);
  $("inlineTranslationActions").classList.toggle("hidden", !showInlineVocabularyEditor);
  $("articleInlineVocabularyWrap").classList.toggle("hidden", !showInlineVocabularyEditor);
  $("saveArticleBtn").classList.toggle("hidden", !(hasQuestions && hasVocabulary));
  $("deleteArticleBtn").classList.toggle("hidden", !(selectedArticle && isAdminProfile()));
  renderArticleInlineHighlightPreview();
}

function fillArticleEditor(article) {
  state.articleImageFile = null;
  state.editorBaseInlineVocabulary = getInlineVocabulary(article || {});
  state.editorManualInlineVocabulary = [];
  state.editorCategoryLabels = article?.categoryLabels || {};
  $("articleRequiredWordsMode").value = "no";
  $("articleRequiredWordsInput").value = "";
  updateArticleRequiredWordsMode();
  $("articleTitleInput").value = article?.title || "";
  $("articleIdInput").value = article?.id || "";
  $("articleVisibilitySelect").value = article?.visibility || DEFAULT_ARTICLE_VISIBILITY;
  $("articleApprovalStatusSelect").value = article?.approvalStatus || DEFAULT_ARTICLE_APPROVAL_STATUS;
  $("articleLevelInput").value = article?.level || "B1";
  renderArticleCategoryOptionsMulti(article?.category || "");
  $("articleSummaryInput").value = article?.summary || "";
  $("articleTextInput").value = (article?.text || []).join("\n");
  $("articleImageInput").value = "";
  $("articleVocabularyInput").value = formatVocabularyLines(article?.vocabulary || []);
  $("articleInlineVocabularyInput").value = "";
  $("articleInlineVocabularyInput").dataset.manual = "";
  $("articleQuestionsInput").value = formatQuestionLines(article?.questions || []);
  $("generatedPromptOutput").value = "";
  $("generatedPromptWrap").classList.add("hidden");
  $("articleEditorStatus").textContent = state.remoteReady
    ? ""
    : t("editorNeedsSupabase");
  updateArticleApprovalControl(article);
  updateArticleImageStatus(article);
  renderArticleAssignmentPanel(article);
  updateArticleEditorFlow();
}

function clearArticleCreationHelperInputs() {
  $("articlePromptInput").value = "";
  $("articleRequiredWordsMode").value = "no";
  $("articleRequiredWordsInput").value = "";
  updateArticleRequiredWordsMode();
  $("articleImportInput").value = "";
  $("generatedPromptOutput").value = "";
  $("generatedPromptWrap").classList.add("hidden");
}

function canModerateArticleApproval(article) {
  return Boolean(
    article
    && isAdminProfile()
  );
}

function updateArticleApprovalControl(article = state.articles.find(item => item.id === $("articleEditorSelect")?.value) || null) {
  const select = $("articleApprovalStatusSelect");
  if (!select) return;

  const isPublic = $("articleVisibilitySelect").value === "public";
  select.closest("label")?.classList.toggle("hidden", !isPublic);
  if (!isPublic) {
    select.value = DEFAULT_ARTICLE_APPROVAL_STATUS;
    select.disabled = true;
    return;
  }

  const canModerate = canModerateArticleApproval(article);
  select.disabled = !canModerate;

  if (!canModerate) {
    select.value = article?.approvalStatus === "approved"
      ? "approved"
      : PUBLIC_ARTICLE_APPROVAL_STATUS;
  }
}

function readArticleEditor() {
  const existingArticle = state.articles.find(item => item.id === $("articleEditorSelect").value);
  if (existingArticle && !canEditArticle(existingArticle)) {
    throw new Error(t("editNotAllowed"));
  }
  const language = getNativeLanguage();
  const title = $("articleTitleInput").value.trim();
  const id = ($("articleIdInput").value.trim() || makeArticleId(title));
  const idArticle = state.articles.find(item => item.id === id);
  if (idArticle && idArticle.id !== existingArticle?.id && !canEditArticle(idArticle)) {
    throw new Error(t("editNotAllowed"));
  }
  const visibility = $("articleVisibilitySelect").value || DEFAULT_ARTICLE_VISIBILITY;
  const selectedApprovalStatus = $("articleApprovalStatusSelect").value || DEFAULT_ARTICLE_APPROVAL_STATUS;
  const approvalStatus = visibility === "public"
    ? canModerateArticleApproval(existingArticle)
      ? selectedApprovalStatus
      : existingArticle?.approvalStatus === "approved"
        ? "approved"
      : PUBLIC_ARTICLE_APPROVAL_STATUS
    : DEFAULT_ARTICLE_APPROVAL_STATUS;
  const parsedVocabulary = parseVocabularyLines($("articleVocabularyInput").value);
  const parsedInlineVocabulary = parseVocabularyDraftLines($("articleInlineVocabularyInput").value)
    .filter(hasAnyVocabularyTranslation);
  const article = {
    id,
    ownerProfileId: existingArticle?.ownerProfileId || state.currentProfile?.id || null,
    teacherGroupId: existingArticle?.teacherGroupId || state.currentProfile?.teacherGroupId || state.currentProfile?.id || null,
    visibility,
    approvalStatus,
    title,
    level: $("articleLevelInput").value.trim(),
    category: getArticleEditorCategory(),
    categoryLabels: getArticleEditorCategoryLabels(),
    summary: $("articleSummaryInput").value.trim(),
    text: linesToList($("articleTextInput").value),
    image: existingArticle?.image || null,
    vocabulary: mergeVocabularyTranslations(existingArticle?.vocabulary || [], parsedVocabulary, language),
    inlineVocabulary: appendVocabularyTranslations(state.editorBaseInlineVocabulary || [], parsedInlineVocabulary, language),
    questions: avoidAlternatingQuestionPattern(parseQuestionLines($("articleQuestionsInput").value))
  };

  if (!article.title || !article.id || !article.level || !article.category || !article.summary || !article.text.length) {
    throw new Error(t("validationFillArticle"));
  }

  if (!article.questions.length) {
    throw new Error(t("validationQuestion"));
  }

  if (!parsedVocabulary.length) {
    throw new Error(t("validationVocabulary"));
  }

  return article;
}

async function saveArticleFromEditor() {
  try {
    const article = readArticleEditor();
    article.image = await uploadArticleImage(article);
    await saveArticle(article);
    state.editorBaseInlineVocabulary = getInlineVocabulary(article);
    state.editorManualInlineVocabulary = [];
    $("articleInlineVocabularyInput").value = "";
    $("articleInlineVocabularyInput").dataset.manual = "";
    state.articleImageFile = null;
    $("articleImageInput").value = "";
    updateArticleImageStatus(article);
    updateArticleEditorFlow();
    $("articleEditorStatus").textContent = t("articleSaved");
  } catch (error) {
    $("articleEditorStatus").textContent = error.message.includes("Supabase Storage")
      ? `${t("imageUploadFailed")} ${error.message}`
      : error.message;
  }
}

async function deleteArticleFromEditor() {
  const article = state.articles.find(item => item.id === $("articleEditorSelect").value);
  if (!article || !isAdminProfile()) return;
  if (!confirm(t("confirmDeleteArticle"))) return;

  try {
    await supabaseRequest(`app_articles?id=eq.${encodeURIComponent(article.id)}`, {
      method: "DELETE",
      headers: { Prefer: "return=minimal" }
    });

    const imagePath = getArticleImageStoragePath(article);
    if (imagePath) {
      try {
        await supabaseStorageRequest(`object/${ARTICLE_IMAGE_BUCKET}/${encodeURIComponent(imagePath)}`, {
          method: "DELETE"
        });
      } catch (error) {
        console.info("Article image delete skipped:", error.message);
      }
    }

    state.articles = state.articles.filter(item => item.id !== article.id);
    renderCategories();
    renderLevelFilters();
    renderArticles();
    renderArticleCategoryOptionsMulti();
    renderArticleEditorList();
    $("articleEditorStatus").textContent = t("articleDeleted");
  } catch (error) {
    $("articleEditorStatus").textContent = error.message;
  }
}
