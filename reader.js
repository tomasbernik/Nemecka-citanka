function getArticleSentences(article) {
  if (!article) return [];

  return article.text.flatMap(paragraph =>
    paragraph.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [paragraph]
  ).map(sentence => sentence.trim()).filter(Boolean);
}

function getSentenceWords(sentence) {
  return sentence.match(/[\p{L}\p{N}]+(?:[-'][\p{L}\p{N}]+)?/gu) || [];
}

function getInlineVocabulary(article) {
  return article.inlineVocabulary || article.clickVocabulary || [];
}

function normalizeVocabularyKey(value) {
  return String(value)
    .trim()
    .toLocaleLowerCase("de")
    .replace(/^(der|die|das|ein|eine)\s+/u, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function getSavedVocabulary(article) {
  if (!article) return [];
  return state.profileData.discoveredVocabulary[article.id] || [];
}

function getVisibleVocabulary(article) {
  const initialVocabulary = article.vocabulary || [];
  const savedVocabulary = getSavedVocabulary(article);
  const seen = new Set();

  return [...initialVocabulary, ...savedVocabulary].filter(item => {
    const key = normalizeVocabularyKey(item.de);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function getVocabularySourceItem(article, word) {
  const key = normalizeVocabularyKey(word);
  return [
    ...(article?.vocabulary || []),
    ...getInlineVocabulary(article)
  ].find(item => normalizeVocabularyKey(item.de) === key);
}

function makeDiscoveredVocabularyItem(article, word, translation) {
  const source = getVocabularySourceItem(article, word) || {};
  const item = { de: word };
  VOCABULARY_LANGUAGE_CODES.forEach(language => {
    if (source[language]) item[language] = source[language];
  });

  const language = getNativeLanguage();
  if (!item[language] && translation) item[language] = translation;
  return item;
}

function cleanupDiscoveredVocabulary(article) {
  if (!article || !state.profileData.discoveredVocabulary?.[article.id]) return;

  const initialKeys = new Set((article.vocabulary || []).map(item => normalizeVocabularyKey(item.de)));
  const cleaned = getSavedVocabulary(article).filter(item => !initialKeys.has(normalizeVocabularyKey(item.de)));

  if (cleaned.length !== getSavedVocabulary(article).length) {
    state.profileData.discoveredVocabulary[article.id] = cleaned;
    saveProfileData();
  }
}

function renderVocabulary() {
  const article = state.currentArticle;
  $("vocabList").innerHTML = getVisibleVocabulary(article)
    .map(v => {
      const base = shouldShowVocabularyBase(v) ? ` <span class="vocab-base">(${escapeHtml(v.base)})</span>` : "";
      return `<li><strong>${escapeHtml(v.de)}</strong>${base} – ${escapeHtml(getVocabularyTranslation(v))}</li>`;
    })
    .join("");
}

function renderArticleImage(article) {
  const wrap = $("articleImageWrap");

  if (!wrap) return;
  if (!article?.id) {
    wrap.classList.add("hidden");
    wrap.innerHTML = "";
    return;
  }

  const image = article.image || {};
  const desktop = image.desktop || `images/articles/${article.id}.jpg`;
  const fallbackSources = [
    desktop,
    ...ARTICLE_IMAGE_EXTENSIONS
      .map(extension => `images/articles/${article.id}.${extension}`)
      .filter(source => source !== desktop)
  ];
  const alt = image.alt || article.title || "";
  wrap.innerHTML = `
    <picture>
      ${image.mobile ? `<source media="(max-width: 700px)" srcset="${escapeHtml(image.mobile)}">` : ""}
      <img src="${escapeHtml(desktop)}" alt="${escapeHtml(alt)}" loading="lazy" data-fallback-sources="${escapeHtml(fallbackSources.join("|"))}">
    </picture>
  `;
  wrap.classList.remove("hidden");

  const img = wrap.querySelector("img");
  img.onerror = () => {
    const sources = (img.dataset.fallbackSources || "").split("|").filter(Boolean);
    const currentIndex = sources.indexOf(img.getAttribute("src"));
    const nextSource = sources[currentIndex + 1];
    if (nextSource) {
      img.src = nextSource;
    } else {
      wrap.classList.add("hidden");
      wrap.innerHTML = "";
    }
  };
}

function renderArticleText(article) {
  const inlineVocabulary = getInlineVocabulary(article);
  const lookup = new Map(inlineVocabulary.map(v => [v.de.toLocaleLowerCase("de"), v]));
  const words = inlineVocabulary
    .map(v => v.de)
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);
  let sentenceIndex = 0;

  const renderSentence = (sentence) => {
    const index = sentenceIndex++;

    if (!words.length) {
      return `<span class="reading-sentence" data-sentence-index="${index}">${escapeHtml(sentence)}</span>`;
    }

    const pattern = new RegExp(`(^|[^\\p{L}\\p{N}_])(${words.map(escapeRegExp).join("|")})(?=$|[^\\p{L}\\p{N}_])`, "giu");
    const html = escapeHtml(sentence).replace(pattern, (match, prefix, word) => {
      const vocab = lookup.get(word.toLocaleLowerCase("de"));
      if (!vocab) return match;

      return `${prefix}<span class="inline-word" role="button" tabindex="0" data-word="${escapeHtml(vocab.de)}" data-translation="${escapeHtml(getVocabularyTranslation(vocab))}" aria-expanded="false">${word}</span>`;
    });

    return `<span class="reading-sentence" data-sentence-index="${index}">${html}</span>`;
  };

  if (!words.length) {
    $("articleText").innerHTML = article.text
      .map(paragraph => `<p>${(paragraph.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [paragraph]).map(sentence => renderSentence(sentence.trim())).join(" ")}</p>`)
      .join("");
    return;
  }

  $("articleText").innerHTML = article.text
    .map(paragraph => `<p>${(paragraph.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [paragraph]).map(sentence => renderSentence(sentence.trim())).join(" ")}</p>`)
    .join("");
}

function getArticleAnswers(articleId) {
  return state.profileData.answers[articleId] || {};
}

function renderQuestions(article) {
  const answers = getArticleAnswers(article.id);
  $("questionList").innerHTML = article.questions
    .map((question, index) => `
      <li class="true-false-item ${isTaskCompleted(article.id, getQuestionTaskId(index)) ? "task-complete" : ""}">
        <div class="question-text">${escapeHtml(question.statement || question)}</div>
        <div class="true-false-actions">
          <button class="choice-btn ${answers[index] === true ? "selected" : ""}" type="button" data-question-index="${index}" data-answer="true">${escapeHtml(t("trueLabel"))}</button>
          <button class="choice-btn ${answers[index] === false ? "selected" : ""}" type="button" data-question-index="${index}" data-answer="false">${escapeHtml(t("falseLabel"))}</button>
        </div>
        <p class="practice-feedback">${typeof answers[index] === "boolean" ? (answers[index] === Boolean(question.answer) ? escapeHtml(t("correct")) : `${escapeHtml(t("correctIs"))} ${question.answer ? escapeHtml(t("trueLabel").toLocaleLowerCase()) : escapeHtml(t("falseLabel").toLocaleLowerCase())}`) : ""}</p>
      </li>
    `)
    .join("");
}

function setSpeechStatus(message = "") {
  $("speechStatus").textContent = message;
}

function clearReadingHighlight() {
  document.querySelectorAll(".reading-sentence.active").forEach(sentence => {
    sentence.classList.remove("active");
  });
}

function highlightSentence(index) {
  clearReadingHighlight();
  const sentence = document.querySelector(`.reading-sentence[data-sentence-index="${index}"]`);
  if (!sentence) return;
  sentence.classList.add("active");
  sentence.scrollIntoView({ behavior: "smooth", block: "center" });
}

function getGermanVoice() {
  const voices = window.speechSynthesis?.getVoices?.() || [];
  return voices.find(voice => voice.lang?.toLocaleLowerCase("de").startsWith("de"))
    || voices.find(voice => voice.lang?.toLocaleLowerCase().startsWith("de"))
    || null;
}

function loadSpeechVoices() {
  if (!("speechSynthesis" in window) || window.speechSynthesis.getVoices().length) {
    return Promise.resolve();
  }

  return new Promise(resolve => {
    const timeout = setTimeout(resolve, 350);
    window.speechSynthesis.onvoiceschanged = () => {
      clearTimeout(timeout);
      resolve();
    };
  });
}

function stopReading() {
  if (state.speech.utterance) {
    state.speech.utterance.onend = null;
    state.speech.utterance.onerror = null;
  }

  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }

  state.speech = {
    sentenceIndex: 0,
    isReading: false,
    utterance: null,
    mode: "text",
    runId: state.speech.runId + 1
  };
  clearReadingHighlight();
  setSpeechStatus("");
  setButtonLabel("readAloudBtn", "readText");
  setButtonLabel("pauseReadBtn", "pause");
}

function finishReading(message = t("finishedReading")) {
  state.speech.isReading = false;
  state.speech.utterance = null;
  state.speech.sentenceIndex = 0;
  state.speech.runId += 1;
  clearReadingHighlight();
  setSpeechStatus(message);
  setButtonLabel("readAloudBtn", "readText");
  setButtonLabel("pauseReadBtn", "pause");
}

async function readSentence(index = 0) {
  if (!("speechSynthesis" in window)) {
    setSpeechStatus(t("browserNoSpeech"));
    return;
  }

  await loadSpeechVoices();

  const sentences = getArticleSentences(state.currentArticle);
  if (!sentences.length || index >= sentences.length) {
    finishReading();
    return;
  }

  if (state.speech.utterance) {
    state.speech.utterance.onend = null;
    state.speech.utterance.onerror = null;
  }

  window.speechSynthesis.cancel();
  const runId = state.speech.runId + 1;
  state.speech.sentenceIndex = index;
  state.speech.isReading = true;
  state.speech.mode = "text";
  state.speech.runId = runId;
  highlightSentence(index);

  const utterance = new SpeechSynthesisUtterance(sentences[index]);
  utterance.lang = "de-DE";
  utterance.rate = 1;
  utterance.voice = getGermanVoice();
  utterance.onend = () => {
    if (state.speech.isReading && state.speech.utterance === utterance && state.speech.runId === runId) {
      readSentence(index + 1);
    }
  };
  utterance.onerror = (event) => {
    if (state.speech.utterance !== utterance) return;
    if (state.speech.runId !== runId) return;
    if (event.error === "interrupted" || event.error === "canceled") return;

    state.speech.isReading = false;
    setSpeechStatus(t("readingFailed"));
  };

  state.speech.utterance = utterance;
  setButtonLabel("readAloudBtn", "restart");
  setSpeechStatus(t("readingSentence").replace("{current}", index + 1).replace("{total}", sentences.length));
  window.speechSynthesis.speak(utterance);
}

function forceStopSpeech() {
  if (state.speech.utterance) {
    state.speech.utterance.onend = null;
    state.speech.utterance.onerror = null;
  }

  state.speech.isReading = false;
  state.speech.utterance = null;
  state.speech.runId += 1;

  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
}

function togglePauseReading() {
  if (!("speechSynthesis" in window) || !state.speech.isReading) return;

  if (window.speechSynthesis.paused) {
    window.speechSynthesis.resume();
    setButtonLabel("pauseReadBtn", "pause");
    setSpeechStatus(t("continuingReading"));
  } else {
    window.speechSynthesis.pause();
    setButtonLabel("pauseReadBtn", "continueReading");
    setSpeechStatus(t("readingPaused"));
  }
}

function markCurrentArticleRead(source = "manual") {
  const article = state.currentArticle;
  if (!article || state.profileData.readIds.includes(article.id)) return;

  state.profileData.readIds.push(article.id);
  saveProfileData();
  logAppEvent("article_marked_read", {
    articleId: article.id,
    articleTitle: article.title,
    source
  });
  updateMarkReadButtons(source === "auto" ? t("markedRead") : t("readDone"));
  renderCategories();
  renderLevelFilters();
  renderArticles();
  renderHomeAssignments();
  renderGamification();
}

function updateMarkReadButtons(label) {
  $("markReadBtn").textContent = label;
  $("markReadBottomBtn").textContent = label;
}

async function openArticle(id) {
  const article = state.articles.find(a => a.id === id);
  if (!article || !canViewArticle(article)) return;

  const assignment = getAssignmentForArticle(article.id);
  if (assignment) await markAssignmentSeen(assignment, true);

  stopReading();
  state.currentArticle = article;
  state.activePracticeGroup = "vocab";
  logAppEvent("article_opened", {
    articleId: article.id,
    articleTitle: article.title,
    category: article.category,
    level: article.level
  });
  showView("articleView");
  renderArticlePracticeTabs();
  window.scrollTo({ top: 0, left: 0, behavior: "auto" });

  $("articleMeta").textContent = `${article.level} • ${formatArticleCategories(article)}`;
  $("articleTitle").textContent = article.title;
  cleanupDiscoveredVocabulary(article);
  renderArticleImage(article);
  renderArticleText(article);
  renderVocabulary();
  renderQuestions(article);
  renderArticleTaskProgress();
  startSentenceGame();
  startMatchGame();
  startVocabChoiceGame();
  startClozeGame();
  startMistakeGame();
  startWordSearchGame();

  updateMarkReadButtons(state.profileData.readIds.includes(article.id) ? t("readDone") : t("markRead"));
  renderOnboarding();
  scrollToPageTop();
}

function addDiscoveredVocabulary(word, translation) {
  const article = state.currentArticle;
  if (!article) return;

  const wordKey = normalizeVocabularyKey(word);
  const exists = getVisibleVocabulary(article).some(v => normalizeVocabularyKey(v.de) === wordKey);
  if (!exists) {
    state.profileData.discoveredVocabulary[article.id] = [
      ...getSavedVocabulary(article),
      makeDiscoveredVocabularyItem(article, word, translation)
    ];
    saveProfileData();
    renderVocabulary();
    renderGamification();
  }
}

function showInlineTranslation(button) {
  const word = button.dataset.word;
  const translation = button.dataset.translation;

  addDiscoveredVocabulary(word, translation);

  document.querySelectorAll(".inline-word.active").forEach(activeButton => {
    if (activeButton !== button) activeButton.classList.remove("active");
  });

  const isOpen = button.classList.toggle("active");
  button.setAttribute("aria-expanded", String(isOpen));
  completeOnboarding("firstWordHintDone");
}
