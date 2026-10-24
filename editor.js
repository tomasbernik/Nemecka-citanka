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

function normalizeLanguageFocusImport(value, textParagraphs = null) {
  if (!value || typeof value !== "object") return null;

  const title = String(value.title || value.name || "").trim();
  const requestedFeature = String(value.requestedFeature || "").trim();
  const labels = Object.fromEntries(
    Object.entries(value.labels && typeof value.labels === "object" ? value.labels : {})
      .map(([language, label]) => [language, String(label || "").trim()])
      .filter(([language, label]) => NATIVE_LANGUAGES[language] && label)
  );
  const articleText = Array.isArray(textParagraphs) ? textParagraphs.join("\n") : "";
  const examples = (Array.isArray(value.examples) ? value.examples : [])
    .slice(0, 3)
    .map(item => typeof item === "string"
      ? { sentence: item.trim(), highlight: "" }
      : {
          sentence: String(item?.sentence || "").trim(),
          highlight: String(item?.highlight || "").trim()
        })
    .filter(item => item.sentence && (!articleText || articleText.includes(item.sentence)))
    .filter(item => !item.highlight || item.sentence.includes(item.highlight));
  const sourceExercise = value.exercise && typeof value.exercise === "object"
    ? value.exercise
    : null;
  if (!title || examples.length < 2 || !sourceExercise) return null;

  const type = sourceExercise.type;
  if (!["multiple_choice", "word_order"].includes(type)) return null;
  if (type === "word_order") {
    const words = (Array.isArray(sourceExercise.words) ? sourceExercise.words : [])
      .map(word => String(word).trim())
      .filter(Boolean)
      .slice(0, 16);
    const answer = String(sourceExercise.answer || "").trim();
    if (words.length < 4 || words.length > 12 || !answer || words.join(" ") !== answer) return null;
    return { title, requestedFeature, labels, examples, exercise: { type, words, answer } };
  }

  const prompt = String(sourceExercise.prompt || "").trim();
  const options = (Array.isArray(sourceExercise.options) ? sourceExercise.options : [])
    .map(option => String(option).trim())
    .filter(Boolean)
    .slice(0, 4);
  const answer = String(sourceExercise.answer || "").trim();
  if (!prompt.includes("___") || options.length !== 3 || !options.includes(answer)) return null;
  return { title, requestedFeature, labels, examples, exercise: { type, prompt, options, answer } };
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
  const languageFocus = normalizeLanguageFocusImport(source.languageFocus || source.language_focus, textParagraphs);

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
    languageFocus,
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
      image.onerror = () => reject(new Error(t("imageLoadFailed")));
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
  if (!context) throw new Error(t("imagePrepareFailed"));
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);

  return await new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (blob) resolve(blob);
      else reject(new Error(t("imageConvertFailed")));
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
      throw new Error(t("clipboardUnavailable"));
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
  const selection = getArticleTextSelection(input);
  return selection?.text || "";
}

function collapseArticleTextSelection(position = $("articleTextInput")?.selectionEnd || 0) {
  const input = $("articleTextInput");
  if (!input) return;
  const safePosition = Math.max(0, Math.min(position, input.value.length));
  input.setSelectionRange(safePosition, safePosition);
  resetArticleTextSelectionAnchor();
  hideInlineSelectionButton();
}

function getArticleTextSelection(input = $("articleTextInput")) {
  if (!input || input.selectionStart === input.selectionEnd) return null;

  let start = Math.min(input.selectionStart, input.selectionEnd);
  let end = Math.max(input.selectionStart, input.selectionEnd);
  while (start < end && /\s/u.test(input.value[start])) start += 1;
  while (end > start && /\s/u.test(input.value[end - 1])) end -= 1;

  const text = input.value.slice(start, end);
  return text ? { start, end, text } : null;
}

function getTextareaSelectionPoint(input, position) {
  const rect = input.getBoundingClientRect();
  const mirror = document.createElement("div");
  const style = getComputedStyle(input);
  const properties = [
    "boxSizing", "width", "paddingTop", "paddingRight", "paddingBottom", "paddingLeft",
    "borderTopWidth", "borderRightWidth", "borderBottomWidth", "borderLeftWidth",
    "fontFamily", "fontSize", "fontWeight", "fontStyle", "lineHeight", "letterSpacing",
    "textTransform", "textAlign", "wordSpacing", "tabSize"
  ];

  properties.forEach(property => {
    mirror.style[property] = style[property];
  });
  mirror.style.position = "fixed";
  mirror.style.left = `${rect.left}px`;
  mirror.style.top = `${rect.top}px`;
  mirror.style.width = `${input.clientWidth}px`;
  mirror.style.visibility = "hidden";
  mirror.style.whiteSpace = "pre-wrap";
  mirror.style.overflowWrap = "break-word";
  mirror.style.pointerEvents = "none";

  const marker = document.createElement("span");
  marker.textContent = input.value.slice(position, position + 1) || ".";
  mirror.append(document.createTextNode(input.value.slice(0, position)), marker);
  document.body.append(mirror);

  const mirrorRect = mirror.getBoundingClientRect();
  const markerRect = marker.getBoundingClientRect();
  const point = {
    left: rect.left + markerRect.left - mirrorRect.left - input.scrollLeft,
    top: rect.top + markerRect.top - mirrorRect.top - input.scrollTop
  };
  mirror.remove();
  return point;
}

function hideInlineSelectionButton() {
  $("addSelectedInlineBtn")?.classList.add("hidden");
}

function updateInlineSelectionButton() {
  const input = $("articleTextInput");
  const button = $("addSelectedInlineBtn");
  const editor = input?.closest(".article-text-editor");
  if (!input || !button || !editor) return;

  const selection = getArticleTextSelection(input);
  state.editorInlineSelection = selection;
  if (!selection) {
    hideInlineSelectionButton();
    return;
  }

  const point = getTextareaSelectionPoint(input, selection.end);
  const editorRect = editor.getBoundingClientRect();
  button.classList.remove("hidden");
  const buttonWidth = button.offsetWidth || 180;
  const buttonHeight = button.offsetHeight || 42;
  const inputStyle = getComputedStyle(input);
  const lineHeight = Number.parseFloat(inputStyle.lineHeight) || Number.parseFloat(inputStyle.fontSize) * 1.45 || 24;
  const left = Math.max(8, Math.min(point.left - editorRect.left - buttonWidth / 2, editor.clientWidth - buttonWidth - 8));
  const belowTop = point.top - editorRect.top + lineHeight + 14;
  const aboveTop = point.top - editorRect.top - buttonHeight - 72;
  const top = belowTop + buttonHeight <= editor.clientHeight - 8
    ? belowTop
    : Math.max(8, aboveTop);

  button.style.left = `${left}px`;
  button.style.top = `${Math.max(8, Math.min(top, editor.clientHeight - buttonHeight - 8))}px`;
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

  const lowerText = text.toLocaleLowerCase("de");
  const ranges = [];
  phrases.forEach(phrase => {
    const normalizedPhrase = String(phrase || "").trim();
    if (!normalizedPhrase) return;

    const lowerPhrase = normalizedPhrase.toLocaleLowerCase("de");
    const needsBoundary = isArticleTextWordChar(normalizedPhrase[0])
      && isArticleTextWordChar(normalizedPhrase[normalizedPhrase.length - 1]);
    let index = lowerText.indexOf(lowerPhrase);

    while (index >= 0) {
      const end = index + lowerPhrase.length;
      const hasBoundary = !needsBoundary
        || (!isArticleTextWordChar(text[index - 1]) && !isArticleTextWordChar(text[end]));
      if (hasBoundary) ranges.push({ start: index, end });
      index = lowerText.indexOf(lowerPhrase, index + Math.max(1, lowerPhrase.length));
    }
  });

  if (!ranges.length) return escapeHtml(text);

  ranges.sort((a, b) => a.start - b.start || b.end - a.end);
  const mergedRanges = [];
  ranges.forEach(range => {
    const last = mergedRanges[mergedRanges.length - 1];
    if (last && range.start < last.end) return;
    mergedRanges.push(range);
  });

  let html = "";
  let cursor = 0;

  mergedRanges.forEach(range => {
    html += escapeHtml(text.slice(cursor, range.start));
    html += `<span class="editor-inline-hit">${escapeHtml(text.slice(range.start, range.end))}</span>`;
    cursor = range.end;
  });

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
  const input = $("articleTextInput");
  const selection = getArticleTextSelection(input) || state.editorInlineSelection;
  const selectionEnd = selection?.end || input?.selectionEnd || 0;
  const selected = selection?.text || "";
  if (!selected) {
    $("articleEditorStatus").textContent = t("selectWordFirst");
    return;
  }

  if (isSelectionCoveredByInlineVocabulary(selected)) {
    collapseArticleTextSelection(selectionEnd);
    $("articleEditorStatus").textContent = t("selectionAlreadyInline");
    return;
  }

  const line = `${selected} =`;
  const inlineAdded = addManualInlineVocabularyItem(selected);
  const vocabAdded = addToVocabulary ? appendUniqueLine("articleVocabularyInput", line) : false;
  if (inlineAdded) $("articleInlineVocabularyInput").dataset.manual = "true";
  if (inlineAdded || vocabAdded) {
    renderArticleInlineHighlightPreview();
  }
  collapseArticleTextSelection(selectionEnd);
  $("articleEditorStatus").textContent = inlineAdded || vocabAdded
    ? t("selectedAdded")
    : t("expressionExists");
  hideInlineSelectionButton();
}

function getPromptText() {
  return PROMPT_TEXT[getUiLanguage()] || PROMPT_TEXT[DEFAULT_NATIVE_LANGUAGE];
}

function getTeachingLanguagePromptInfo() {
  return getSelectedArticleLanguage() === "en"
    ? {
        english: "English",
        germanTitle: "englischer Artikeltitel",
        germanDescription: "kurze englische Artikelbeschreibung",
        germanStatement: "englische Richtig/Falsch-Aussage",
        germanAccusative: "englischen",
        germanPlural: "englische",
        slovak: "anglický",
        slovakPlural: "anglické",
        slovakStatement: "anglická veta typu pravda/nepravda",
        englishIndefinite: "an"
      }
    : {
        english: "German",
        germanTitle: "deutscher Artikeltitel",
        germanDescription: "kurze deutsche Artikelbeschreibung",
        germanStatement: "deutsche Richtig/Falsch-Aussage",
        germanAccusative: "deutschen",
        germanPlural: "deutsche",
        slovak: "nemecký",
        slovakPlural: "nemecké",
        slovakStatement: "nemecká veta typu pravda/nepravda",
        englishIndefinite: "a"
      };
}

function getArticleJsonPromptInstructions(level) {
  const isGerman = getUiLanguage() === "de";
  const isEnglish = getUiLanguage() === "en";
  const isFrench = getUiLanguage() === "fr";
  const teachingLanguage = getTeachingLanguagePromptInfo();
  const vocabularyExample = `{\"de\":\"slovo alebo fráza z textu\",\"base\":\"základný tvar\",${PROMPT_TRANSLATION_LANGUAGE_CODES
    .map(code => `\"${code}\":\"${NATIVE_LANGUAGES[code]?.lineFormat || code} preklad\"`)
    .join(",")}}`;

  if (isGerman) {
    const vocabulary = `{"de":"Wort oder Phrase aus dem Text","base":"Grundform",${PROMPT_TRANSLATION_LANGUAGE_CODES.map(code => `"${code}":"Übersetzung auf ${NATIVE_LANGUAGES[code]?.label || code}"`).join(",")}}`;
    return [
      "", "JSON-Schema:", "{",
      `  \"title\": \"${teachingLanguage.germanTitle}\",`,
      `  \"level\": \"${level}\",`,
      "  \"category\": \"Kategorie oder Thema\",",
      `  \"categoryLabels\": {\"Kategorie oder Thema\":{\"${PROMPT_TRANSLATION_LANGUAGE_CODES.join("\":\"Übersetzung\", \"")}\":\"Übersetzung\"}},`,
      `  \"summary\": \"${teachingLanguage.germanDescription}\",`,
      "  \"text\": [\"Absatz 1\", \"Absatz 2\", \"Absatz 3\", \"Absatz 4\"],",
      "  \"vocabulary\": [", `    ${vocabulary}`, "  ],",
      "  \"questions\": [", `    {\"statement\":\"${teachingLanguage.germanStatement}\",\"answer\":true}`, "  ]", "}", "",
      `Verwende den unten eingefügten ${teachingLanguage.germanAccusative} Text exakt. Formuliere ihn nicht um, kürze ihn nicht und ändere seine Länge nicht.`,
      "Teile den Text absatzweise in das Feld \"text\" auf.",
      `Füge genau 5 ${teachingLanguage.germanPlural} Wörter oder Phrasen zu \"vocabulary\" hinzu, die zum Niveau ${level} passen, natürlich im Text vorkommen und als neuer Wortschatz nützlich sind.`,
      `Füge 6 bis 8 ${teachingLanguage.germanPlural} Richtig/Falsch-Aussagen mit einer natürlichen Mischung aus richtigen und falschen Antworten zu \"questions\" hinzu.`,
      `Füge für jede Kategorie oder jedes Thema Übersetzungen in diesen Sprachen zu \"categoryLabels\" hinzu: ${PROMPT_TRANSLATION_LANGUAGE_CODES.join(", ")}.`,
      `Alle Einträge in vocabulary müssen diese Schlüssel enthalten: de, base, ${PROMPT_TRANSLATION_LANGUAGE_CODES.join(", ")}.`,
      "Verwende für \"base\" die Wörterbuchform: bei Substantiven mit bestimmtem Artikel im Nominativ Singular, bei Verben den Infinitiv und bei Adjektiven die Grundform."
    ];
  }

  if (isEnglish) {
    const englishVocabularyExample = `{\"de\":\"word or phrase from the text\",\"base\":\"dictionary form\",${PROMPT_TRANSLATION_LANGUAGE_CODES
      .map(code => `\"${code}\":\"${NATIVE_LANGUAGES[code]?.label || code} translation\"`)
      .join(",")}}`;

    return [
      "",
      "JSON schema:",
      "{",
      `  \"title\": \"${teachingLanguage.english} article title\",`,
      `  \"level\": \"${level}\",`,
      "  \"category\": \"category or topic\",",
      `  \"categoryLabels\": {\"category or topic name\":{\"${PROMPT_TRANSLATION_LANGUAGE_CODES.join("\":\"translation\", \"")}\":\"translation\"}},`,
      `  \"summary\": \"short ${teachingLanguage.english} article description\",`,
      "  \"text\": [\"paragraph 1\", \"paragraph 2\", \"paragraph 3\", \"paragraph 4\"],",
      "  \"vocabulary\": [",
      `    ${englishVocabularyExample}`,
      "  ],",
      "  \"questions\": [",
      `    {\"statement\":\"${teachingLanguage.english} true/false sentence\",\"answer\":true}`,
      "  ]",
      "}",
      "",
      "Use the pasted text below exactly as it is. Do not rewrite it, shorten it, or change the length.",
      "Split the text into the \"text\" array by paragraphs.",
      `Add exactly 5 ${teachingLanguage.english} words or phrases to \"vocabulary\" that fit level ${level} and are typically not already lower-level words. They must appear naturally in the text and should be useful new vocabulary for this level.`,
      `Add 6 to 8 ${teachingLanguage.english} true/false statements to \"questions\" with a mix of true and false answers. The answers must not follow a regular true/false/true/false or false/true/false/true pattern; the order should feel natural and may include two identical answers in a row.`,
      `Add translations for every category or topic to \"categoryLabels\" for these languages: ${PROMPT_TRANSLATION_LANGUAGE_CODES.join(", ")}. The object key must exactly match the value in \"category\"; if multiple categories are separated by |, add each one separately.`,
      `All vocabulary items must have these keys: de, base, ${PROMPT_TRANSLATION_LANGUAGE_CODES.join(", ")}.`,
      "For \"base\", use the dictionary form: for a noun, include the definite article and nominative singular, for example \"der Mann\"; for a verb, use the infinitive, for example \"gehen\"; for an adjective, use the base form, for example \"freundlich\". If \"de\" is already the base form or is a whole phrase, \"base\" may be the same as \"de\"."
    ];
  }

  if (isFrench) {
    const frenchVocabularyExample = `{"de":"mot ou expression du texte","base":"forme du dictionnaire",${PROMPT_TRANSLATION_LANGUAGE_CODES
      .map(code => `"${code}":"traduction en ${NATIVE_LANGUAGES[code]?.label || code}"`)
      .join(",")}}`;

    return [
      "", "Schéma JSON :", "{",
      "  \"title\": \"titre de l’article\",",
      `  "level": "${level}",`,
      "  \"category\": \"catégorie ou thème\",",
      `  "categoryLabels": {"nom de la catégorie ou du thème":{"${PROMPT_TRANSLATION_LANGUAGE_CODES.join("\":\"traduction\", \"")}":"traduction"}},`,
      "  \"summary\": \"brève description de l’article\",",
      "  \"text\": [\"paragraphe 1\", \"paragraphe 2\", \"paragraphe 3\", \"paragraphe 4\"],",
      "  \"vocabulary\": [", `    ${frenchVocabularyExample}`, "  ],",
      "  \"questions\": [", "    {\"statement\":\"affirmation vraie ou fausse\",\"answer\":true}", "  ]", "}", "",
      "Utilise exactement le texte collé ci-dessous. Ne le reformule pas, ne le raccourcis pas et ne modifie pas sa longueur.",
      "Répartis les paragraphes dans le tableau \"text\".",
      `Ajoute exactement 5 mots ou expressions utiles de niveau ${level} dans "vocabulary". Ils doivent apparaître naturellement dans le texte.`,
      "Ajoute 6 à 8 affirmations vraies ou fausses dans \"questions\", avec un ordre naturel et sans alternance régulière.",
      `Ajoute les traductions de chaque catégorie dans "categoryLabels" pour ces langues : ${PROMPT_TRANSLATION_LANGUAGE_CODES.join(", ")}.`,
      `Chaque élément de "vocabulary" doit contenir les clés suivantes : de, base, ${PROMPT_TRANSLATION_LANGUAGE_CODES.join(", ")}.`,
      "Dans \"base\", utilise la forme du dictionnaire : article défini et nominatif singulier pour un nom, infinitif pour un verbe et forme de base pour un adjectif."
    ];
  }

  return [
    "",
    "JSON schéma:",
    "{",
    `  \"title\": \"${teachingLanguage.slovak} názov článku\",`,
    `  \"level\": \"${level}\",`,
    "  \"category\": \"kategória alebo téma\",",
    `  \"categoryLabels\": {\"názov kategórie alebo témy\":{\"${PROMPT_TRANSLATION_LANGUAGE_CODES.join("\":\"preklad\", \"")}\":\"preklad\"}},`,
    `  \"summary\": \"krátky ${teachingLanguage.slovak} popis článku\",`,
    "  \"text\": [\"odsek 1\", \"odsek 2\", \"odsek 3\", \"odsek 4\"],",
    "  \"vocabulary\": [",
    `    ${vocabularyExample}`,
    "  ],",
    "  \"questions\": [",
    `    {\"statement\":\"${teachingLanguage.slovakStatement}\",\"answer\":true}`,
    "  ],",
    "  \"languageFocus\": {",
    "    \"title\": \"názov jedného jazykového javu\",",
    "    \"examples\": [{\"sentence\":\"presná veta z textu\",\"highlight\":\"presná časť na zvýraznenie\"}],",
    "    \"exercise\": {\"type\":\"multiple_choice\",\"prompt\":\"veta s ___\",\"options\":[\"možnosť 1\",\"možnosť 2\",\"možnosť 3\"],\"answer\":\"možnosť 1\"}",
    "  }",
    "}",
    "",
    "Použi nižšie vložený text presne tak, ako je. Neprepisuj ho, neskracuj ho a nemen dĺžku textu.",
    "Text rozdeľ do poľa \"text\" podľa odsekov.",
    `Do "vocabulary" pridaj presne 5 slov alebo fráz vo vyučovanom jazyku (${getArticleLanguageLabel(getSelectedArticleLanguage())}), ktoré patria na úroveň ${level}, ale typicky ešte nepatria do nižšej úrovne. Musia sa prirodzene objaviť v texte a majú sa učiť ako nové slovíčka tejto úrovne.`,
    `Do \"questions\" pridaj 6 až 8 pravda/nepravda viet vo vyučovanom jazyku (${getArticleLanguageLabel(getSelectedArticleLanguage())}) s mixom true a false. Odpovede nesmú byť v pravidelnom poradí true/false/true/false ani false/true/false/true; poradie musí pôsobiť prirodzene a môže mať aj dve rovnaké odpovede za sebou.`,
    `Do \"languageFocus\" vyber jeden užitočný jazykový jav primeraný úrovni ${level}. Nepridávaj teoretické vysvetlenie. Pridaj 2 až 3 príklady, pričom \"sentence\" musí byť presná celá veta z textu a \"highlight\" presná časť tejto vety. Pridaj práve jedno krátke cvičenie. Pre tvary použi type \"multiple_choice\" s tromi možnosťami a odpoveďou, ktorá je presne jednou z možností. Pre slovosled môžeš použiť type \"word_order\" s poľom \"words\" a hotovou správnou vetou v \"answer\".`,
    `Do \"categoryLabels\" pridaj pre každú kategóriu alebo tému preklady do týchto jazykov: ${PROMPT_TRANSLATION_LANGUAGE_CODES.join(", ")}. Kľúč objektu musí presne zodpovedať hodnote v poli \"category\"; ak je viac kategórií oddelených znakom |, pridaj každú zvlášť.`,
    `Všetky položky vocabulary musia mať kľúče de, base, ${PROMPT_TRANSLATION_LANGUAGE_CODES.join(", ")}.`,
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
  const languageFocus = getArticleLanguageFocusRequirement();
  const range = getSelectedArticleLengthRange();
  const isGerman = getUiLanguage() === "de";
  const isEnglish = getUiLanguage() === "en";
  const teachingLanguage = getTeachingLanguagePromptInfo();

  if (isGerman) {
    return [
      `Schreibe eine ${teachingLanguage.germanPlural} Geschichte oder einen ${teachingLanguage.germanAccusative} Artikel auf dem Niveau ${level}.`,
      category ? `Kategorie/Thema: ${category}.` : "",
      topic ? `Konkrete Aufgabe: ${topic}` : "",
      languageFocus ? `Verbindliches Sprachphänomen: ${languageFocus}. Verwende es mehrfach natürlich im Text.` : "",
      requiredWords.length ? `Verwende diese ${teachingLanguage.germanPlural} Wörter oder Phrasen natürlich: ${requiredWords.join(", ")}.` : "",
      `Länge: ${range.min} bis ${range.max} Wörter.`,
      `Der Inhalt muss mindestens einen natürlichen Dialog auf ${getArticleLanguageLabel(getSelectedArticleLanguage())} enthalten, zum Beispiel 2 bis 4 Gesprächszeilen.`,
      "Die Handlung darf praktisch, interessant oder leicht humorvoll sein.",
      `Gib nur den fertigen ${teachingLanguage.germanAccusative} Inhalt zurück. Schreibe kein JSON, keine Vokabelliste, keine Fragen und keine Erklärungen.`
    ].filter(Boolean).join("\n");
  }

  if (isEnglish) {
    return [
      `Write ${teachingLanguage.englishIndefinite} ${teachingLanguage.english} story or article at level ${level}.`,
      category ? `Category/topic: ${category}.` : "",
      topic ? `Specific brief: ${topic}` : "",
      languageFocus ? `Required language feature: ${languageFocus}. Use it naturally several times in the text.` : "",
      requiredWords.length
        ? `Use these ${teachingLanguage.english} words or phrases naturally: ${requiredWords.join(", ")}.`
        : "",
      `Length: ${range.min} to ${range.max} words.`,
      `The content must include at least one natural dialogue in ${teachingLanguage.english}, for example 2 to 4 lines between characters.`,
      "The story can be practical, interesting, or gently funny.",
      `Return only the finished ${teachingLanguage.english} content. Do not write JSON, vocabulary, questions, or explanations.`
    ].filter(Boolean).join("\n");
  }

  return [
    `Napíš ${teachingLanguage.slovak} príbeh alebo článok na úrovni ${level}.`,
    category ? `Kategória/téma: ${category}.` : "",
    topic ? `Konkrétne zadanie: ${topic}` : "",
    languageFocus ? `Povinný jazykový jav: ${languageFocus}. Použi ho v texte viackrát prirodzene.` : "",
    requiredWords.length
      ? `Tieto slová alebo frázy vo vyučovanom jazyku použi prirodzene: ${requiredWords.join(", ")}.`
      : "",
    `Dĺžka: ${range.label} slov.`,
    `Obsah musí mať aspoň jeden prirodzený dialóg v jazyku ${getArticleLanguageLabel(getSelectedArticleLanguage())}, napríklad 2 až 4 repliky medzi postavami.`,
    "Dej môže byť praktický, zaujímavý alebo mierne veselý.",
    `Vráť iba hotový obsah v jazyku ${getArticleLanguageLabel(getSelectedArticleLanguage())}. Nepíš JSON, slovíčka, otázky ani vysvetlenie.`
  ].filter(Boolean).join("\n");
}

function buildArticleJsonPrompt() {
  const text = $("articleTextInput").value.trim();
  const level = $("articleLevelInput").value.trim() || "A2-B1";
  const category = getArticleEditorCategory();
  const title = $("articleTitleInput").value.trim();
  const summary = $("articleSummaryInput").value.trim();
  const isGerman = getUiLanguage() === "de";
  const isEnglish = getUiLanguage() === "en";
  const teachingLanguage = getTeachingLanguagePromptInfo();

  addRequiredWordsToVocabulary();

  if (isGerman) {
    return [
      `Wandle diesen fertigen ${teachingLanguage.germanAccusative} Text in JSON für die Lese-App um.`,
      "Wichtig: Verwende den eingefügten Text exakt. Formuliere ihn nicht um, kürze oder erweitere ihn nicht.",
      title ? `Verwende diesen Titel, wenn er passt: ${title}` : `Erstelle einen kurzen ${teachingLanguage.germanAccusative} Titel.`,
      summary ? `Verwende diese Kurzbeschreibung, wenn sie passt: ${summary}` : `Erstelle eine kurze ${teachingLanguage.germanPlural} Beschreibung.`,
      category ? `Kategorie: ${category}.` : "",
      ...getArticleJsonPromptInstructions(level), "",
      text ? `Fertiger ${teachingLanguage.germanTitle.replace("Artikeltitel", "Text")}:` : `Der fertige ${teachingLanguage.germanTitle.replace("Artikeltitel", "Text")} ist deine letzte Antwort in diesem Chat. Verwende exakt diese Antwort.`,
      text
    ].filter(Boolean).join("\n");
  }

  if (isEnglish) {
    return [
      `Convert this finished ${teachingLanguage.english} text into JSON for the reading app.`,
      "Important: use the pasted text exactly. Do not rewrite it, shorten it, expand it, or change the wording.",
      title ? `Use this title if it fits: ${title}` : `Create a short ${teachingLanguage.english} title.`,
      summary ? `Use this short description if it fits: ${summary}` : `Create a short ${teachingLanguage.english} description.`,
      category ? `Category: ${category}.` : "",
      ...getArticleJsonPromptInstructions(level),
      "",
      text
        ? `Finished ${teachingLanguage.english} text:`
        : `The finished ${teachingLanguage.english} text is your last answer in this chat. Use exactly that last answer.`,
      text
    ].filter(Boolean).join("\n");
  }

  return [
    `Premeň tento hotový ${teachingLanguage.slovak} text na JSON pre čítankovú appku.`,
    "Dôležité: vložený text použi presne. Neprepisuj ho, neskracuj ho, nerozširuj ho a nemeň formulácie.",
    title ? `Ak sa hodí, použi tento názov: ${title}` : `Vytvor krátky ${teachingLanguage.slovak} názov.`,
    summary ? `Ak sa hodí, použi tento krátky popis: ${summary}` : `Vytvor krátky ${teachingLanguage.slovak} popis.`,
    category ? `Kategória: ${category}.` : "",
    ...getArticleJsonPromptInstructions(level),
    "",
    text
      ? `Hotový text v jazyku ${getArticleLanguageLabel(getSelectedArticleLanguage())}:`
      : `Hotový text v jazyku ${getArticleLanguageLabel(getSelectedArticleLanguage())} je tvoja posledná odpoveď v tomto chate. Použi práve túto poslednú odpoveď.`,
    text
  ].filter(Boolean).join("\n");
}

function applyImportedArticleToEditor(article) {
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
  updateArticleEditorFlow();
}

function importArticleToEditor() {
  try {
    applyImportedArticleToEditor(parseArticleImport($("articleImportInput").value));
    $("articleEditorStatus").textContent = t("articleImported");
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
    .filter(item => !PROMPT_TRANSLATION_LANGUAGE_CODES.every(code => Boolean(item[code])))
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
  const teachingLanguage = getTeachingLanguagePromptInfo();

  return [
    `Create a cheerful modern educational illustration for ${teachingLanguage.englishIndefinite} ${teachingLanguage.english} reading app.`,
    title ? `Article title: ${title}` : "",
    `${teachingLanguage.english} level: ${level}.`,
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

async function renderArticleAssignmentPanel(article = state.articles.find(item => item.id === $("articleEditorSelect")?.value) || null, options = {}) {
  const panelId = options.panelId || "articleAssignmentPanel";
  const listId = options.listId || "articleAssignmentList";
  const statusId = options.statusId || "articleAssignmentStatus";
  const panel = $(panelId);
  const list = $(listId);
  if (!panel || !list) return;

  const canAssign = Boolean(article?.id && hasTeacherLicense());
  panel.classList.toggle("hidden", !canAssign);
  $(statusId).textContent = "";
  if (!canAssign) {
    list.innerHTML = "";
    return;
  }

  const teams = getManagedTeams();
  if (!teams.length) {
    list.innerHTML = `<p class="muted">${escapeHtml(t("noClassesForAssignment"))}</p>`;
    return;
  }

  const sections = await Promise.all(teams.map(async team => {
    const students = getTeacherStudents(team.id);
    const teacherName = getTeamTeacherName(team) || t("unknownTeacher");
    const teamLabel = isPublisherAccount()
      ? formatText("classTeacherSummary", { name: team.name, teacher: teacherName })
      : team.name;
    if (!students.length) {
      return `
        <section class="assignment-class" data-assignment-team="${escapeHtml(team.id)}">
          <label class="assignment-class-heading">
            <input type="checkbox" data-assignment-team-toggle disabled>
            <strong>${escapeHtml(teamLabel)}</strong>
          </label>
          <p class="muted">${escapeHtml(t("noStudentsForAssignment"))}</p>
        </section>
      `;
    }

    const rows = await Promise.all(students.map(async student => {
      const data = await getProfileData(student);
      const assigned = Boolean(getAssignmentForArticle(article.id, data));
      const status = getArticleAssignmentStatusInfo(article, data);
      return `
        <label class="assignment-row assignment-row-${escapeHtml(status.key)}">
          <input type="checkbox" value="${escapeHtml(student.id)}" data-assignment-student data-team-id="${escapeHtml(team.id)}" ${assigned ? "checked" : ""}>
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
    return `
      <section class="assignment-class" data-assignment-team="${escapeHtml(team.id)}">
        <label class="assignment-class-heading">
          <input type="checkbox" data-assignment-team-toggle>
          <strong>${escapeHtml(formatText("assignWholeClass", { class: teamLabel }))}</strong>
        </label>
        <div class="assignment-class-students">${rows.join("")}</div>
      </section>
    `;
  }));
  list.innerHTML = sections.join("");
  list.querySelectorAll("[data-assignment-team]").forEach(updateAssignmentClassToggle);
}

function renderCurrentArticleTeacherActions(article = state.currentArticle) {
  const actions = $("articleTeacherActions");
  const panel = $("currentArticleAssignmentPanel");
  const button = $("assignCurrentArticleBtn");
  if (!actions || !panel || !button) return;

  const canAssign = Boolean(article?.id && hasTeacherLicense());
  actions.classList.toggle("hidden", !canAssign);
  panel.classList.add("hidden");
  button.setAttribute("aria-expanded", "false");
}

async function toggleCurrentArticleAssignmentPanel() {
  const panel = $("currentArticleAssignmentPanel");
  const button = $("assignCurrentArticleBtn");
  if (!panel || !button || !state.currentArticle || !hasTeacherLicense()) return;

  const opening = panel.classList.contains("hidden");
  if (!opening) {
    panel.classList.add("hidden");
    button.setAttribute("aria-expanded", "false");
    return;
  }

  button.setAttribute("aria-expanded", "true");
  await renderArticleAssignmentPanel(state.currentArticle, {
    panelId: "currentArticleAssignmentPanel",
    listId: "currentArticleAssignmentList",
    statusId: "currentArticleAssignmentStatus"
  });
  panel.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function updateAssignmentClassToggle(section) {
  const toggle = section?.querySelector("[data-assignment-team-toggle]");
  const students = Array.from(section?.querySelectorAll("[data-assignment-student]") || []);
  if (!toggle || !students.length) return;
  const checkedCount = students.filter(input => input.checked).length;
  toggle.checked = checkedCount === students.length;
  toggle.indeterminate = checkedCount > 0 && checkedCount < students.length;
}

function handleArticleAssignmentChange(event) {
  const section = event.target.closest("[data-assignment-team]");
  if (!section) return;
  if (event.target.matches("[data-assignment-team-toggle]")) {
    section.querySelectorAll("[data-assignment-student]").forEach(input => {
      input.checked = event.target.checked;
    });
  }
  updateAssignmentClassToggle(section);
}

async function saveArticleAssignments(article, options = {}) {
  if (!article) return;

  const listId = options.listId || "articleAssignmentList";
  const statusId = options.statusId || "articleAssignmentStatus";

  const studentChoices = new Map();
  document.querySelectorAll(`#${listId} [data-assignment-student]`).forEach(input => {
    const current = studentChoices.get(input.value) || {
      student: state.profiles.find(profile => profile.id === input.value),
      teamId: input.dataset.teamId,
      assigned: false
    };
    current.assigned = current.assigned || input.checked;
    if (input.checked) current.teamId = input.dataset.teamId;
    studentChoices.set(input.value, current);
  });

  try {
    const newlyAssigned = [];
    await Promise.all(Array.from(studentChoices.values()).map(async choice => {
      const { student, teamId, assigned } = choice;
      if (!student || !teamId) return;
      const data = await getProfileData(student);
      if (Boolean(getAssignmentForArticle(article.id, data)) === assigned) return;
      await supabaseRequest("rpc/app_set_article_assignment", {
        method: "POST",
        body: JSON.stringify({
          target_team_id: teamId,
          target_profile_id: student.id,
          target_article_id: article.id,
          target_assigned: assigned
        })
      });
      if (assigned) newlyAssigned.push({ article, student, teamId });
    }));
    await Promise.all(newlyAssigned.map(payload =>
      sendAssignmentPushNotification(payload).catch(error => {
        console.info("Assignment push notification skipped:", error.message);
      })
    ));
    await renderArticleAssignmentPanel(article, options);
    $(statusId).textContent = t("assignmentSaved");
    await renderTeacherOverview();
  } catch (error) {
    $(statusId).textContent = error.message;
  }
}

async function assignSelectedArticleToStudents() {
  const article = state.articles.find(item => item.id === $("articleEditorSelect")?.value);
  await saveArticleAssignments(article);
}

async function assignCurrentArticleToStudents() {
  await saveArticleAssignments(state.currentArticle, {
    panelId: "currentArticleAssignmentPanel",
    listId: "currentArticleAssignmentList",
    statusId: "currentArticleAssignmentStatus"
  });
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

function getArticleEditorCategoryLabels() {
  return getArticleEditorCategories().reduce((labelsByCategory, category) => {
    const existingArticleLabels = state.editorCategoryLabels?.[category];
    if (!getCategoryLabels(category) || existingArticleLabels) {
      labelsByCategory[category] = normalizeCategoryLabels(existingArticleLabels || {}, category);
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

function getArticleLanguageFocusRequirement() {
  return $("articleLanguageFocusInput")?.value.trim() || "";
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
}

function hasTranslatedVocabulary() {
  try {
    return parseVocabularyLines($("articleVocabularyInput").value).length > 0;
  } catch (error) {
    return false;
  }
}

function getArticleEditorSnapshot() {
  const imageFile = state.articleImageFile;
  return JSON.stringify({
    approvalStatus: $("articleApprovalStatusSelect")?.value || "",
    title: $("articleTitleInput")?.value || "",
    id: $("articleIdInput")?.value || "",
    level: $("articleLevelInput")?.value || "",
    category: getArticleEditorCategory(),
    categoryLabels: state.editorCategoryLabels || {},
    languageFocus: state.editorLanguageFocus || null,
    summary: $("articleSummaryInput")?.value || "",
    text: $("articleTextInput")?.value || "",
    vocabulary: $("articleVocabularyInput")?.value || "",
    inlineVocabulary: $("articleInlineVocabularyInput")?.value || "",
    questions: $("articleQuestionsInput")?.value || "",
    imageFile: imageFile ? [imageFile.name, imageFile.size, imageFile.lastModified] : null
  });
}

function getLastArticleLevel() {
  try {
    return localStorage.getItem(LAST_ARTICLE_LEVEL_KEY)?.trim() || "B1";
  } catch (error) {
    return "B1";
  }
}

function rememberArticleLevel() {
  const level = $("articleLevelInput")?.value.trim();
  if (!level) return;

  try {
    localStorage.setItem(LAST_ARTICLE_LEVEL_KEY, level);
  } catch (error) {
    console.info("Article level preference could not be saved:", error.message);
  }
}

function updateArticleEditorFlow() {
  const isEditing = Boolean($("articleEditorSelect")?.value);
  const selectedArticle = state.articles.find(item => item.id === $("articleEditorSelect")?.value) || null;
  const isExpanded = !isEditing || state.editorExpanded;
  const hasGeneratedPrompt = Boolean($("generatedPromptOutput")?.value.trim());
  const hasContent = Boolean(
    $("articleTitleInput").value.trim()
    || $("articleTextInput").value.trim()
    || $("articleSummaryInput").value.trim()
    || getArticleEditorCategory()
    || $("articlePromptInput").value.trim()
    || getArticleLanguageFocusRequirement()
    || getArticleRequiredWords().length
  );
  const hasText = Boolean($("articleTextInput").value.trim());
  const hasQuestions = Boolean($("articleQuestionsInput").value.trim());
  const hasVocabulary = hasTranslatedVocabulary();
  const isReadyToSave = hasQuestions && hasVocabulary;
  const hasUnsavedChanges = getArticleEditorSnapshot() !== state.editorSavedSnapshot;
  const showInlineVocabularyEditor = $("articleInlineVocabularyInput").dataset.manual === "true"
    || Boolean($("articleInlineVocabularyInput").value.trim());
  const showContentStep = isExpanded && (isEditing || hasGeneratedPrompt || hasContent);

  document.querySelector(".editor-helper")?.classList.toggle("hidden", !isExpanded);
  $("articleContentStep").classList.toggle("hidden", !showContentStep);
  $("articleImageStep").classList.toggle("hidden", !showContentStep);
  $("articleQuestionsStep").classList.add("hidden");
  $("articleVocabularyStep").classList.toggle("hidden", !isExpanded || !showInlineVocabularyEditor);
  $("inlineTranslationActions").classList.toggle("hidden", !showInlineVocabularyEditor);
  $("articleInlineVocabularyWrap").classList.toggle("hidden", !showInlineVocabularyEditor);
  $("saveArticleBtn").classList.toggle("hidden", !isExpanded || !isReadyToSave);
  $("articleEditorFloatingActions").classList.toggle("hidden", !isReadyToSave || !hasUnsavedChanges);
  $("editArticleDetailsBtn").classList.toggle("hidden", !isEditing || isExpanded);
  $("deleteArticleBtn").classList.toggle("hidden", !(selectedArticle && canDeleteArticle(selectedArticle)));
  renderArticleInlineHighlightPreview();
}

function fillArticleEditor(article) {
  state.articleImageFile = null;
  state.editorBaseInlineVocabulary = getInlineVocabulary(article || {});
  state.editorManualInlineVocabulary = [];
  state.editorCategoryLabels = article?.categoryLabels || {};
  state.editorLanguageFocus = normalizeLanguageFocusImport(
    article?.languageFocus || article?.language_focus,
    article?.text || null
  );
  state.editorInlineSelection = null;
  hideInlineSelectionButton();
  $("articleRequiredWordsMode").value = "no";
  $("articleRequiredWordsInput").value = "";
  $("articleLanguageFocusInput").value = "";
  updateArticleRequiredWordsMode();
  $("articleTitleInput").value = article?.title || "";
  $("articleIdInput").value = article?.id || "";
  $("articleApprovalStatusSelect").value = article?.approvalStatus || DEFAULT_ARTICLE_APPROVAL_STATUS;
  $("articleLevelInput").value = article?.level || getLastArticleLevel();
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
  setArticleGenerationStatus();
  state.editorExpanded = !article || !$("articleEditorSelect")?.value;
  $("articleEditorStatus").textContent = state.remoteReady
    ? ""
    : t("editorNeedsSupabase");
  updateArticleApprovalControl(article);
  updateArticleImageStatus(article);
  renderArticleAssignmentPanel(article);
  state.editorSavedSnapshot = $("articleEditorSelect")?.value
    ? getArticleEditorSnapshot()
    : "";
  updateArticleEditorFlow();
}

function resetManualJsonImport() {
  $("articleImportInput").value = "";
  const details = document.querySelector(".manual-json-import");
  if (details) details.open = false;
}

function clearArticleCreationHelperInputs() {
  $("articlePromptInput").value = "";
  if ($("storyTitleInput")) $("storyTitleInput").value = "";
  $("articleLanguageFocusInput").value = "";
  $("articleRequiredWordsMode").value = "no";
  $("articleRequiredWordsInput").value = "";
  updateArticleRequiredWordsMode();
  resetManualJsonImport();
  $("generatedPromptOutput").value = "";
  $("generatedPromptWrap").classList.add("hidden");
  setArticleGenerationStatus();
}

let articleCreationMode = "article";

function readPendingStoryGeneration() {
  try {
    return JSON.parse(localStorage.getItem(STORY_GENERATION_STATE_KEY) || "null");
  } catch {
    return null;
  }
}

function savePendingStoryGeneration(value) {
  if (value?.seriesId) localStorage.setItem(STORY_GENERATION_STATE_KEY, JSON.stringify(value));
  else localStorage.removeItem(STORY_GENERATION_STATE_KEY);
}

function setArticleCreationMode(mode = "article") {
  articleCreationMode = mode === "story" ? "story" : "article";
  const isStory = articleCreationMode === "story";
  $("articleModeBtn")?.classList.toggle("active", !isStory);
  $("storyModeBtn")?.classList.toggle("active", isStory);
  $("articleModeBtn")?.setAttribute("aria-pressed", String(!isStory));
  $("storyModeBtn")?.setAttribute("aria-pressed", String(isStory));
  $("storyGenerationOptions")?.classList.toggle("hidden", !isStory);
  $("storyModeHelp")?.classList.toggle("hidden", !isStory);
  const generateButton = $("generateArticleAiBtn");
  if (generateButton && !articleGenerationRunning) {
    generateButton.textContent = t(isStory ? "generateStoryAi" : "generateArticleAi");
  }
  updateArticleGenerationControls();
}

function setArticleGenerationStatus(message = "", type = "") {
  const status = $("articleGenerationStatus");
  if (!status) return;
  status.textContent = message;
  status.classList.toggle("is-progress", type === "progress");
  status.classList.toggle("is-success", type === "success");
  status.classList.toggle("is-error", type === "error");
}

function canModerateArticleApproval(article) {
  return canModerateArticle(article);
}

function updateArticleApprovalControl(article = state.articles.find(item => item.id === $("articleEditorSelect")?.value) || null) {
  const select = $("articleApprovalStatusSelect");
  if (!select) return;

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
  const visibility = DEFAULT_ARTICLE_VISIBILITY;
  const selectedApprovalStatus = $("articleApprovalStatusSelect").value || DEFAULT_ARTICLE_APPROVAL_STATUS;
  const approvalStatus = canModerateArticleApproval(existingArticle)
    ? selectedApprovalStatus
    : existingArticle?.approvalStatus === "approved"
      ? "approved"
      : PUBLIC_ARTICLE_APPROVAL_STATUS;
  const parsedVocabulary = parseVocabularyLines($("articleVocabularyInput").value);
  const parsedInlineVocabulary = parseVocabularyDraftLines($("articleInlineVocabularyInput").value)
    .filter(hasAnyVocabularyTranslation);
  const article = {
    id,
    language: existingArticle ? getArticleLanguage(existingArticle) : getSelectedArticleLanguage(),
    ownerProfileId: existingArticle?.ownerProfileId || state.currentProfile?.id || null,
    teamId: null,
    teacherGroupId: existingArticle?.teacherGroupId || state.currentProfile?.teacherGroupId || state.currentProfile?.id || null,
    visibility,
    approvalStatus,
    published: existingArticle?.published === true,
    displayOrder: existingArticle?.displayOrder ?? null,
    seriesId: existingArticle?.seriesId || null,
    seriesTitle: existingArticle?.seriesTitle || null,
    chapterOrder: existingArticle?.chapterOrder ?? null,
    title,
    level: $("articleLevelInput").value.trim(),
    category: getArticleEditorCategory(),
    categoryLabels: getArticleEditorCategoryLabels(),
    languageFocus: state.editorLanguageFocus,
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
    const existingArticle = state.articles.find(item => item.id === article.id) || null;
    const requestedApprovalStatus = article.approvalStatus;
    const shouldModerateAfterSave = Boolean(
      existingArticle
      && canModerateArticleApproval(existingArticle)
      && ["approved", "rejected"].includes(requestedApprovalStatus)
      && requestedApprovalStatus !== existingArticle.approvalStatus
    );

    // Content and moderation are separate operations. Saving both in one PATCH
    // makes the workflow trigger reset the status back to pending whenever the
    // teacher also corrected article content.
    if (shouldModerateAfterSave) {
      article.approvalStatus = existingArticle.approvalStatus;
      article.published = existingArticle.published === true;
    }

    article.image = await uploadArticleImage(article);
    await saveArticle(article);
    if (shouldModerateAfterSave) {
      await setArticleApprovalStatus(article.id, requestedApprovalStatus);
      article.approvalStatus = requestedApprovalStatus;
      article.published = requestedApprovalStatus === "approved";
    }
    state.editorBaseInlineVocabulary = getInlineVocabulary(article);
    state.editorManualInlineVocabulary = [];
    $("articleInlineVocabularyInput").value = "";
    $("articleInlineVocabularyInput").dataset.manual = "";
    state.articleImageFile = null;
    $("articleImageInput").value = "";
    resetManualJsonImport();
    const savedArticle = state.articles.find(item => item.id === article.id) || article;
    state.editorExpanded = false;
    fillArticleEditor(savedArticle);
    $("articleEditorStatus").textContent = t("articleSaved");
  } catch (error) {
    $("articleEditorStatus").textContent = error.message.includes("Supabase Storage")
      ? `${t("imageUploadFailed")} ${error.message}`
      : error.message;
  }
}

async function deleteArticleFromEditor() {
  const article = state.articles.find(item => item.id === $("articleEditorSelect").value);
  if (!article || !canDeleteArticle(article)) return;
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

let articleGenerationRunning = false;
let articleGenerationCancelling = false;

function updateArticleGenerationControls() {
  const generateButton = $("generateArticleAiBtn");
  const cancelButton = $("cancelArticleGenerationBtn");
  if (generateButton) generateButton.disabled = articleGenerationRunning;
  if ($("articleModeBtn")) $("articleModeBtn").disabled = articleGenerationRunning;
  if ($("storyModeBtn")) $("storyModeBtn").disabled = articleGenerationRunning;
  if ($("storyTitleInput")) $("storyTitleInput").disabled = articleGenerationRunning;
  if ($("storyChapterCountSelect")) $("storyChapterCountSelect").disabled = articleGenerationRunning;
  if (!cancelButton) return;
  const hasPendingJob = Boolean(readPendingArticleGeneration()?.jobId);
  cancelButton.classList.toggle("hidden", !articleGenerationRunning || !hasPendingJob);
  cancelButton.disabled = articleGenerationCancelling;
  cancelButton.textContent = t(articleGenerationCancelling
    ? "cancellingArticleGeneration"
    : "cancelArticleGeneration");
}

function getStoryChapterCount() {
  const count = Number.parseInt($("storyChapterCountSelect")?.value || "5", 10);
  return Math.min(8, Math.max(2, Number.isFinite(count) ? count : 5));
}

function getStoryArcInstruction(chapterIndex, chapterCount) {
  if (chapterIndex === 0) return "Introduce the main characters, situation and central problem. Do not resolve the main problem yet.";
  if (chapterIndex === chapterCount - 1) return "This is the final chapter. Resolve the central problem and the important open plot lines with a satisfying ending.";
  if (chapterIndex === chapterCount - 2) return "Move decisively toward the climax, but leave the central problem for the final chapter.";
  return "Develop the conflict, reveal something new and end with a natural reason to continue.";
}

function buildStoryChapterBrief(story, chapterIndex) {
  const completed = Array.isArray(story.completedChapters) ? story.completedChapters : [];
  const previous = completed[completed.length - 1] || null;
  const olderSummaries = completed.slice(0, -1).map((chapter, index) =>
    `Chapter ${index + 1} (${chapter.title}): ${chapter.summary}`
  ).join("\n").slice(-1_200);
  const previousText = previous
    ? String((previous.text || []).join("\n")).slice(-2_800)
    : "";

  return [
    `Write chapter ${chapterIndex + 1} of ${story.chapterCount} of one continuous story.`,
    story.seriesTitle ? `Overall story title: ${story.seriesTitle}.` : "",
    `Overall story brief: ${String(story.topic || "").slice(0, 1_600)}`,
    `Chapter role: ${getStoryArcInstruction(chapterIndex, story.chapterCount)}`,
    "Keep all names, relationships, facts, chronology and unresolved plot lines consistent.",
    "Do not retell earlier chapters. Give this chapter its own short German title without a chapter number.",
    olderSummaries ? `Earlier chapter summaries:\n${olderSummaries}` : "",
    previous ? `Immediately previous chapter (${previous.title}), full ending context:\n${previousText}` : "",
    chapterIndex > 0 ? "Continue directly and naturally from the preceding events." : ""
  ].filter(Boolean).join("\n\n").slice(0, 6_000);
}

function renderStoryGenerationProgress(story, activeIndex = story?.nextChapter || 0) {
  const wrap = $("storyGenerationProgress");
  const list = $("storyGenerationProgressList");
  const title = $("storyGenerationProgressTitle");
  if (!wrap || !list || !title || !story) return;
  wrap.classList.remove("hidden");
  title.textContent = formatText("storyProgressTitle", {
    current: Math.min(activeIndex + 1, story.chapterCount),
    total: story.chapterCount
  });
  list.replaceChildren();
  for (let index = 0; index < story.chapterCount; index += 1) {
    const item = document.createElement("li");
    const completed = story.completedChapters?.[index];
    item.textContent = completed
      ? `✓ ${completed.title}`
      : formatText("storyChapterLabel", { number: index + 1 });
    item.classList.toggle("is-complete", Boolean(completed));
    item.classList.toggle("is-active", index === activeIndex && !completed);
    list.append(item);
  }
}

function showStoryChapterProgress(story, chapterIndex, phase) {
  const phaseKey = {
    starting: "generationStartingStatus",
    draft: "generationDraftStatus",
    review: "generationReviewStatus",
    materials: "generationMaterialsStatus",
    retry: "generationRetryStatus"
  }[phase] || "generatingArticleStatus";
  setArticleGenerationStatus(
    `${formatText("storyChapterProgress", { current: chapterIndex + 1, total: story.chapterCount })} ${t(phaseKey)}`,
    "progress"
  );
  renderStoryGenerationProgress(story, chapterIndex);
  updateArticleGenerationControls();
}

const STORY_CHAPTER_COOLDOWN_MS = 65_000;

function getStoryChapterCooldownSeconds(story, now = Date.now()) {
  const nextChapterAt = Number(story?.nextChapterAt) || 0;
  return Math.max(0, Math.ceil((nextChapterAt - now) / 1_000));
}

async function waitForStoryChapterCooldown(story, chapterIndex) {
  let seconds = getStoryChapterCooldownSeconds(story);
  while (seconds > 0) {
    setArticleGenerationStatus(
      formatText("storyChapterCooldown", {
        current: chapterIndex + 1,
        total: story.chapterCount,
        seconds
      }),
      "progress"
    );
    renderStoryGenerationProgress(story, chapterIndex);
    await new Promise(resolve => window.setTimeout(resolve, 1_000));
    seconds = getStoryChapterCooldownSeconds(story);
  }
  if (story.nextChapterAt) {
    delete story.nextChapterAt;
    savePendingStoryGeneration(story);
  }
}

function makeGeneratedStoryChapter(result, story, chapterIndex) {
  if (!result?.article) throw new Error(t("generationEmpty"));
  const generated = JSON.parse(JSON.stringify(result.article));
  const requestedFeature = String(generated.languageFocus?.requestedFeature || "").trim();
  if (generated.languageFocus && requestedFeature) {
    generated.languageFocus.labels = {
      ...(generated.languageFocus.labels && typeof generated.languageFocus.labels === "object"
        ? generated.languageFocus.labels
        : {}),
      [getNativeLanguage()]: requestedFeature
    };
  }
  if (!story.seriesTitle) story.seriesTitle = generated.title;
  const idBase = makeArticleId(`${story.seriesTitle}-${chapterIndex + 1}-${generated.title}`)
    || `${story.seriesId}-${chapterIndex + 1}`;
  const id = state.articles.some(article => article.id === idBase)
    ? `${idBase}-${Date.now().toString(36)}`
    : idBase;

  return normalizeArticle({
    ...generated,
    id,
    language: story.language || getSelectedArticleLanguage(),
    ownerProfileId: state.currentProfile?.id || null,
    teamId: null,
    teacherGroupId: state.currentProfile?.teacherGroupId || state.currentProfile?.id || null,
    visibility: DEFAULT_ARTICLE_VISIBILITY,
    approvalStatus: DEFAULT_ARTICLE_APPROVAL_STATUS,
    published: false,
    displayOrder: null,
    seriesId: story.seriesId,
    seriesTitle: story.seriesTitle,
    chapterOrder: chapterIndex,
    categoryLabels: generated.categoryLabels || {},
    inlineVocabulary: generated.inlineVocabulary || [],
    image: null
  });
}

async function continueStoryGeneration(story) {
  setArticleCreationMode("story");
  if ($("storyTitleInput")) $("storyTitleInput").value = story.requestedStoryTitle || story.seriesTitle || "";
  if ($("storyChapterCountSelect")) $("storyChapterCountSelect").value = String(story.chapterCount);

  for (let chapterIndex = story.nextChapter || 0; chapterIndex < story.chapterCount; chapterIndex += 1) {
    story.nextChapter = chapterIndex;
    savePendingStoryGeneration(story);
    await waitForStoryChapterCooldown(story, chapterIndex);
    showStoryChapterProgress(story, chapterIndex, "starting");
    const result = await generateArticleWithAi({
      topic: buildStoryChapterBrief(story, chapterIndex),
      level: story.level,
      category: story.category,
      minWords: story.minWords,
      maxWords: story.maxWords,
      requiredWords: story.requiredWords,
      languageFocus: story.languageFocus,
      onProgress: phase => showStoryChapterProgress(story, chapterIndex, phase)
    });
    const article = makeGeneratedStoryChapter(result, story, chapterIndex);
    await saveArticle(article);
    story.completedChapters = [...(story.completedChapters || []), {
      id: article.id,
      title: article.title,
      summary: article.summary,
      text: article.text
    }];
    story.nextChapter = chapterIndex + 1;
    if (story.nextChapter < story.chapterCount) {
      story.nextChapterAt = Date.now() + STORY_CHAPTER_COOLDOWN_MS;
    }
    savePendingStoryGeneration(story);
    renderStoryGenerationProgress(story, story.nextChapter);
  }

  savePendingStoryGeneration(null);
  const lastId = story.completedChapters?.[story.completedChapters.length - 1]?.id;
  const lastArticle = state.articles.find(article => article.id === lastId);
  if (lastArticle) {
    $("articleEditorSelect").value = lastArticle.id;
    fillArticleEditor(lastArticle);
  }
  renderStoryGenerationProgress(story, story.chapterCount);
  setArticleGenerationStatus(
    formatText("storyGenerationDone", { title: story.seriesTitle, count: story.chapterCount }),
    "success"
  );
}

async function generateStoryDirectlyWithAi() {
  if (articleGenerationRunning) return;
  const button = $("generateArticleAiBtn");
  let story = readPendingStoryGeneration();

  if (!story) {
    const topic = $("articlePromptInput").value.trim();
    if (!topic) {
      setArticleGenerationStatus(t("articleTopicRequired"), "error");
      $("articlePromptInput").focus();
      return;
    }
    if ($("articleEditorSelect").value || $("articleTextInput").value.trim()) {
      if (!confirm(t("replaceStoryConfirm"))) return;
    }
    const range = getSelectedArticleLengthRange();
    const requestedStoryTitle = $("storyTitleInput")?.value.trim() || "";
    story = {
      version: 1,
      seriesId: `story-${Date.now().toString(36)}`,
      requestedStoryTitle,
      seriesTitle: requestedStoryTitle,
      topic,
      chapterCount: getStoryChapterCount(),
      nextChapter: 0,
      completedChapters: [],
      level: $("articleLevelInput").value.trim(),
      category: getArticleEditorCategory(),
      minWords: range.min,
      maxWords: range.max,
      requiredWords: getArticleRequiredWords(),
      languageFocus: getArticleLanguageFocusRequirement(),
      language: getSelectedArticleLanguage(),
      createdAt: Date.now()
    };
    savePendingStoryGeneration(story);
  }

  articleGenerationRunning = true;
  updateArticleGenerationControls();
  button.textContent = t("generatingStory");
  try {
    await continueStoryGeneration(story);
  } catch (error) {
    if (error?.code === "generation_cancelled") savePendingStoryGeneration(null);
    showArticleGenerationError(error);
  } finally {
    articleGenerationRunning = false;
    button.textContent = t("generateStoryAi");
    updateArticleGenerationControls();
  }
}

function showArticleGenerationProgress(phase) {
  const statusKey = {
    starting: "generationStartingStatus",
    draft: "generationDraftStatus",
    review: "generationReviewStatus",
    materials: "generationMaterialsStatus",
    retry: "generationRetryStatus"
  }[phase] || "generatingArticleStatus";
  const backgroundNote = phase === "retry" ? "" : ` ${t("generationRunsInBackground")}`;
  setArticleGenerationStatus(`${t(statusKey)}${backgroundNote}`, "progress");
  updateArticleGenerationControls();
}

function applyGeneratedArticleResult(result) {
  if (!result?.article) throw new Error(t("generationEmpty"));
  const generatedArticle = JSON.parse(JSON.stringify(result.article));
  const focus = generatedArticle.languageFocus;
  const requestedFeature = String(focus?.requestedFeature || "").trim();
  if (focus && requestedFeature) {
    focus.labels = {
      ...(focus.labels && typeof focus.labels === "object" ? focus.labels : {}),
      [getNativeLanguage()]: requestedFeature
    };
  }
  const article = parseArticleImport(JSON.stringify(generatedArticle));
  applyImportedArticleToEditor(article);
  setArticleGenerationStatus(t("generationDone"), "success");
}

function showArticleGenerationError(error) {
  if (error?.code === "generation_cancelled") {
    setArticleGenerationStatus(t("generationCancelled"), "success");
    return;
  }
  console.error("AI article generation:", error);
  const message = error?.code === "generation_continues_in_background"
    ? t("generationContinuesInBackground")
    : error?.name === "AbortError" || /aborted/i.test(error?.message || "")
      ? t("generationTimeout")
      : error?.message || t("generationEmpty");
  const type = error?.code === "generation_continues_in_background" ? "progress" : "error";
  setArticleGenerationStatus(
    type === "progress" ? message : formatText("generationFailed", { message }),
    type
  );
  $("articleGenerationStatus")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

async function cancelPendingArticleGeneration() {
  if (articleGenerationCancelling || !readPendingArticleGeneration()?.jobId) return;
  if (!confirm(t("cancelArticleGenerationConfirm"))) return;

  articleGenerationCancelling = true;
  updateArticleGenerationControls();
  try {
    const result = await cancelArticleGenerationWithAi();
    if (result.cancelled === true) savePendingStoryGeneration(null);
    setArticleGenerationStatus(
      t(result.cancelled === true ? "generationCancelled" : "generationAlreadyFinished"),
      "success"
    );
  } catch (error) {
    console.error("AI article generation cancellation:", error);
    setArticleGenerationStatus(
      formatText("generationCancelFailed", { message: error?.message || t("generationEmpty") }),
      "error"
    );
  } finally {
    articleGenerationCancelling = false;
    updateArticleGenerationControls();
  }
}

async function resumePendingArticleGeneration() {
  if (articleGenerationRunning) return;
  if (readPendingStoryGeneration()) {
    await generateStoryDirectlyWithAi();
    return;
  }
  const button = $("generateArticleAiBtn");
  articleGenerationRunning = true;
  updateArticleGenerationControls();
  const originalText = button.textContent;
  button.textContent = t("generatingArticle");
  try {
    const result = await resumeArticleGenerationWithAi({
      onProgress: showArticleGenerationProgress
    });
    if (result) applyGeneratedArticleResult(result);
  } catch (error) {
    showArticleGenerationError(error);
  } finally {
    articleGenerationRunning = false;
    button.textContent = originalText;
    updateArticleGenerationControls();
  }
}

async function generateArticleDirectlyWithAi() {
  if (articleGenerationRunning) return;
  if (articleCreationMode === "story") {
    await generateStoryDirectlyWithAi();
    return;
  }
  const button = $("generateArticleAiBtn");

  const topic = $("articlePromptInput").value.trim();
  const level = $("articleLevelInput").value;
  const category = getArticleEditorCategory();
  const range = getSelectedArticleLengthRange();
  const requiredWords = getArticleRequiredWords();
  const languageFocus = getArticleLanguageFocusRequirement();

  if (!topic) {
    setArticleGenerationStatus(t("articleTopicRequired"), "error");
    $("articlePromptInput").focus();
    return;
  }

  if ($("articleEditorSelect").value ||
      $("articleTextInput").value.trim()) {
    const confirmed = confirm(t("replaceArticleConfirm"));
    if (!confirmed) return;
  }

  articleGenerationRunning = true;
  updateArticleGenerationControls();
  const originalText = button.textContent;
  button.textContent = t("generatingArticle");
  showArticleGenerationProgress("starting");

  try {
    const result = await generateArticleWithAi({
      topic,
      level,
      category,
      minWords: range.min,
      maxWords: range.max,
      requiredWords,
      languageFocus,
      onProgress: showArticleGenerationProgress
    });
    applyGeneratedArticleResult(result);
  } catch (error) {
    showArticleGenerationError(error);
  } finally {
    articleGenerationRunning = false;
    button.textContent = originalText;
    updateArticleGenerationControls();
  }
}
