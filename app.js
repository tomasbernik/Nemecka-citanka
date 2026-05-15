const PROFILE_KEY = "profiles";
const CURRENT_PROFILE_KEY = "currentProfileId";
const LEGACY_MIGRATION_KEY = "legacyProfileDataMigrated";
const SUPABASE_CONFIG = window.NC_SUPABASE_CONFIG || {};
const AUTO_READ_DELAY_MS = 2 * 60 * 1000;
const VISIBLE_CATEGORY_LIMIT = 6;
const DEFAULT_NATIVE_LANGUAGE = "sk";
const NATIVE_LANGUAGES = {
  sk: { label: "Slovenčina", promptName: "slovenčiny", lineFormat: "slovensky", locale: "sk" },
  ru: { label: "Ruština", promptName: "ruštiny", lineFormat: "rusky", locale: "ru" },
  pl: { label: "Poľština", promptName: "poľštiny", lineFormat: "poľsky", locale: "pl" },
  hu: { label: "Maďarčina", promptName: "maďarčiny", lineFormat: "maďarsky", locale: "hu" }
};

const state = {
  articles: [],
  profiles: [],
  selectedCategory: "Všetky",
  currentArticle: null,
  currentProfile: null,
  profileData: emptyProfileData(),
  speech: {
    sentenceIndex: 0,
    isReading: false,
    utterance: null,
    mode: "text",
    runId: 0
  },
  articleReadTimer: null,
  startupQuiz: {
    questions: [],
    index: 0,
    answered: false,
    shown: false
  },
  sentenceGame: {
    solution: [],
    chosen: [],
    bank: []
  },
  matchGame: {
    cards: [],
    selectedIds: [],
    matchedIds: []
  },
  vocabChoiceGame: null,
  clozeGame: null,
  mistakeGame: null,
  wordSearchGame: {
    words: [],
    found: [],
    selected: []
  },
  showAllCategories: false,
  remoteReady: Boolean(SUPABASE_CONFIG.url && SUPABASE_CONFIG.anonKey)
};

const $ = (id) => document.getElementById(id);

function isSupportedNativeLanguage(language) {
  return Boolean(NATIVE_LANGUAGES[language]);
}

function getNativeLanguage(profile = state.currentProfile) {
  return isSupportedNativeLanguage(profile?.nativeLanguage)
    ? profile.nativeLanguage
    : DEFAULT_NATIVE_LANGUAGE;
}

function getNativeLanguageInfo(language = getNativeLanguage()) {
  return NATIVE_LANGUAGES[isSupportedNativeLanguage(language) ? language : DEFAULT_NATIVE_LANGUAGE];
}

function getVocabularyTranslation(item, language = getNativeLanguage()) {
  if (!item) return "";
  return item[language] || item.sk || item.translation || "";
}

function makeVocabularyItem(de, translation, language = getNativeLanguage()) {
  return {
    de: (de || "").trim(),
    [language]: (translation || "").trim()
  };
}

function normalizeName(value) {
  return value.trim().toLocaleLowerCase("sk");
}

function makeProfileId(name) {
  return normalizeName(name)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function makeArticleId(title) {
  return makeProfileId(title);
}

function profileDataKey(profileId) {
  return `profileData:${profileId}`;
}

function emptyProfileData() {
  return {
    readIds: [],
    discoveredVocabulary: {},
    answers: {},
    practiceLog: [],
    completedTasks: {}
  };
}

function showView(viewId) {
  ["setupView", "loginView", "homeView", "articleView", "settingsView", "teacherView"].forEach(id => {
    $(id).classList.toggle("hidden", id !== viewId);
  });
}

async function supabaseRequest(path, options = {}) {
  if (!state.remoteReady) return null;

  const response = await fetch(`${SUPABASE_CONFIG.url.replace(/\/$/, "")}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_CONFIG.anonKey,
      Authorization: `Bearer ${SUPABASE_CONFIG.anonKey}`,
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });

  if (!response.ok) {
    throw new Error(`Supabase ${response.status}: ${await response.text()}`);
  }

  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

async function loadProfiles() {
  state.profiles = JSON.parse(localStorage.getItem(PROFILE_KEY) || "[]");
  state.profiles = state.profiles.map(normalizeProfile);

  if (!state.remoteReady) return;

  try {
    let profiles;
    try {
      profiles = await supabaseRequest("app_profiles?select=id,name,pin,role,native_language&order=role.desc,name.asc");
    } catch (error) {
      profiles = await supabaseRequest("app_profiles?select=id,name,pin,role&order=role.desc,name.asc");
    }
    if (profiles?.length) {
      state.profiles = profiles.map(rowToProfile);
      localStorage.setItem(PROFILE_KEY, JSON.stringify(state.profiles));
    } else if (state.profiles.length) {
      await saveProfiles();
    }
  } catch (error) {
    console.error(error);
  }
}

async function saveProfiles() {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(state.profiles));

  if (!state.remoteReady || !state.profiles.length) return;

  try {
    try {
      await supabaseRequest("app_profiles?on_conflict=id", {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates" },
        body: JSON.stringify(state.profiles.map(profileToRow))
      });
    } catch (error) {
      await supabaseRequest("app_profiles?on_conflict=id", {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates" },
        body: JSON.stringify(state.profiles.map(({ id, name, pin, role }) => ({ id, name, pin, role })))
      });
    }
  } catch (error) {
    console.error(error);
  }
}

function normalizeProfile(profile) {
  return {
    ...profile,
    nativeLanguage: isSupportedNativeLanguage(profile?.nativeLanguage)
      ? profile.nativeLanguage
      : DEFAULT_NATIVE_LANGUAGE
  };
}

function rowToProfile(row) {
  return normalizeProfile({
    id: row.id,
    name: row.name,
    pin: row.pin,
    role: row.role,
    nativeLanguage: row.native_language
  });
}

function profileToRow(profile) {
  return {
    id: profile.id,
    name: profile.name,
    pin: profile.pin,
    role: profile.role,
    native_language: getNativeLanguage(profile)
  };
}

async function loadArticles() {
  let localArticles = [];

  try {
    const response = await fetch("articles.json", { cache: "no-store" });
    localArticles = await response.json();
  } catch (error) {
    console.error(error);
    localArticles = [];
  }

  state.articles = localArticles;

  if (state.remoteReady) {
    try {
      let remoteArticles = await loadRemoteArticles();
      const remoteIds = new Set(remoteArticles.map(article => article.id));
      const missingLocalArticles = localArticles.filter(article => !remoteIds.has(article.id));

      if (missingLocalArticles.length) {
        await saveRemoteArticles(missingLocalArticles, { preserveUpdatedAt: true });
        remoteArticles = await loadRemoteArticles();
      }

      if (remoteArticles.length) {
        state.articles = remoteArticles;
      }
    } catch (error) {
      console.error(error);
    }
  }

  renderCategories();
  renderArticles();
}

async function loadRemoteArticles() {
  const rows = await supabaseRequest("app_articles?select=*&published=eq.true&order=updated_at.desc,title.asc");
  return (rows || []).map(rowToArticle);
}

async function saveRemoteArticles(articles, options = {}) {
  if (!state.remoteReady || !articles.length) return;

  await supabaseRequest("app_articles?on_conflict=id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify(articles.map(article => articleToRow(article, options)))
  });
}

function rowToArticle(row) {
  return {
    id: row.id,
    title: row.title,
    level: row.level,
    category: row.category,
    summary: row.summary,
    text: row.text || [],
    vocabulary: row.vocabulary || [],
    inlineVocabulary: row.inline_vocabulary || [],
    questions: row.questions || [],
    updatedAt: row.updated_at || null
  };
}

function articleToRow(article, options = {}) {
  const row = {
    id: article.id,
    title: article.title,
    level: article.level,
    category: article.category,
    summary: article.summary,
    text: article.text || [],
    vocabulary: article.vocabulary || [],
    inline_vocabulary: getInlineVocabulary(article),
    questions: article.questions || [],
    published: article.published !== false
  };

  if (!options.preserveUpdatedAt) {
    row.updated_at = new Date().toISOString();
  }

  return row;
}

async function saveArticle(article) {
  if (!state.remoteReady) {
    throw new Error("Editor článkov potrebuje zapnutý Supabase.");
  }

  await supabaseRequest("app_articles?on_conflict=id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify([articleToRow(article)])
  });

  const index = state.articles.findIndex(item => item.id === article.id);
  if (index >= 0) {
    state.articles[index] = article;
  } else {
    state.articles = [article, ...state.articles];
  }
  renderCategories();
  renderArticles();
  renderArticleEditorList(article.id);
}

function getCategories() {
  const categories = [];
  const seen = new Set();

  state.articles.forEach(article => {
    if (!article.category || seen.has(article.category)) return;
    seen.add(article.category);
    categories.push(article.category);
  });

  return ["Všetky", ...categories];
}

function renderCategories() {
  const root = $("categoryFilters");
  const categories = getCategories();
  const visibleCategories = state.showAllCategories
    ? categories
    : categories.slice(0, VISIBLE_CATEGORY_LIMIT);
  const hasMore = categories.length > VISIBLE_CATEGORY_LIMIT;

  root.innerHTML = "";
  visibleCategories.forEach(category => {
    const btn = document.createElement("button");
    btn.className = "chip" + (category === state.selectedCategory ? " active" : "");
    btn.textContent = category;
    btn.onclick = () => {
      state.selectedCategory = category;
      renderCategories();
      renderArticles();
    };
    root.appendChild(btn);
  });

  if (hasMore) {
    const btn = document.createElement("button");
    btn.className = "chip more-chip";
    btn.textContent = state.showAllCategories ? "Menej tém" : "Ďalšie témy";
    btn.onclick = () => {
      state.showAllCategories = !state.showAllCategories;
      renderCategories();
    };
    root.appendChild(btn);
  }
}

function renderArticles() {
  const root = $("articleList");
  const articles = (state.selectedCategory === "Všetky"
    ? state.articles
    : state.articles.filter(a => a.category === state.selectedCategory));

  root.innerHTML = "";

  articles.forEach(article => {
    const isRead = state.profileData.readIds.includes(article.id);
    const btn = document.createElement("button");
    btn.className = "article-card";
    btn.innerHTML = `
      <h4>${escapeHtml(article.title)}</h4>
      <p>${escapeHtml(article.summary)}</p>
      <div class="badges">
        <span class="badge">${escapeHtml(article.level)}</span>
        <span class="badge">${escapeHtml(article.category)}</span>
        ${isRead ? '<span class="badge">✓ prečítané</span>' : ""}
      </div>
    `;
    btn.onclick = () => openArticle(article.id);
    root.appendChild(btn);
  });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function shuffle(items) {
  return [...items].sort(() => Math.random() - 0.5);
}

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

function cleanupDiscoveredVocabulary(article) {
  if (!article || !state.profileData.discoveredVocabulary?.[article.id]) return;

  const initialKeys = new Set((article.vocabulary || []).map(item => normalizeVocabularyKey(item.de)));
  const cleaned = getSavedVocabulary(article).filter(item => !initialKeys.has(normalizeVocabularyKey(item.de)));

  if (cleaned.length !== getSavedVocabulary(article).length) {
    state.profileData.discoveredVocabulary[article.id] = cleaned;
    saveProfileData();
  }
}

function getAllVocabulary() {
  const seen = new Set();
  return state.articles.flatMap(article => [
    ...(article.vocabulary || []),
    ...getInlineVocabulary(article)
  ]).filter(item => {
    const translation = getVocabularyTranslation(item);
    if (!item.de || !translation) return false;
    const key = `${item.de.toLocaleLowerCase("de")}|${translation.toLocaleLowerCase(getNativeLanguageInfo().locale)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function getPracticeVocabulary(article) {
  const seen = new Set();
  return [
    ...(article?.vocabulary || []),
    ...getInlineVocabulary(article),
    ...getSavedVocabulary(article)
  ]
    .filter(item => item.de && getVocabularyTranslation(item))
    .filter(item => getSentenceWords(item.de).length <= 2)
    .filter(item => item.de.length <= 18 && getVocabularyTranslation(item).length <= 32)
    .filter(item => {
      const key = normalizeVocabularyKey(item.de);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function normalizeSearchWord(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-zÄÖÜäöüß]/g, "")
    .toLocaleUpperCase("de")
    .replaceAll("Ä", "AE")
    .replaceAll("Ö", "OE")
    .replaceAll("Ü", "UE")
    .replaceAll("ẞ", "SS")
    .replaceAll("ß", "SS");
}

function getWordSearchVocabulary(article) {
  return getPracticeVocabulary(article)
    .map(item => ({ ...item, search: normalizeSearchWord(item.de) }))
    .filter(item => item.search.length >= 4 && item.search.length <= 10)
    .slice(0, 24);
}

async function saveProfileData() {
  if (!state.currentProfile) return;

  localStorage.setItem(profileDataKey(state.currentProfile.id), JSON.stringify(state.profileData));

  if (!state.remoteReady) return;

  try {
    await supabaseRequest("app_profile_data?on_conflict=profile_id", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates" },
      body: JSON.stringify({
        profile_id: state.currentProfile.id,
        data: state.profileData,
        updated_at: new Date().toISOString()
      })
    });
  } catch (error) {
    console.error(error);
  }
}

function logPractice(type, details = {}) {
  if (!state.currentProfile) return;

  const entry = {
    type,
    articleId: state.currentArticle?.id || null,
    articleTitle: state.currentArticle?.title || null,
    at: new Date().toISOString(),
    ...details
  };

  state.profileData.practiceLog = [
    entry,
    ...(state.profileData.practiceLog || [])
  ].slice(0, 80);
  saveProfileData();
}

function getQuestionTaskId(index) {
  return `question:${index}`;
}

function getTaskDefinitions(article) {
  if (!article) return [];

  const tasks = (article.questions || []).map((question, index) => ({
    id: getQuestionTaskId(index),
    label: `Otázka ${index + 1}`,
    section: "Otázky"
  }));

  if (hasSentenceOrderTask(article)) tasks.push({ id: "sentence-order", label: "Zoraď vetu", section: "Hry" });
  if (getVisibleVocabulary(article).length) tasks.push({ id: "match-pairs", label: "Nájdi dvojice", section: "Hry" });
  if (getPracticeVocabulary(article).length >= 4) tasks.push({ id: "vocab-choice", label: "4 možnosti", section: "Hry" });
  if (hasClozeTask(article)) tasks.push({ id: "cloze-word", label: "Doplň slovo", section: "Hry" });
  if (hasMistakeTask(article)) tasks.push({ id: "find-mistake", label: "Nájdi chybu", section: "Hry" });
  if (getWordSearchVocabulary(article).length >= 3) tasks.push({ id: "word-search", label: "Osemsmerovka", section: "Hry" });

  return tasks;
}

function getArticleCompletedTasks(articleId) {
  return state.profileData.completedTasks?.[articleId] || [];
}

function isTaskCompleted(articleId, taskId) {
  return getArticleCompletedTasks(articleId).includes(taskId);
}

function markTaskCompleted(taskId) {
  const article = state.currentArticle;
  if (!article || !taskId) return;

  const completed = new Set(getArticleCompletedTasks(article.id));
  if (completed.has(taskId)) {
    renderArticleTaskProgress();
    return;
  }

  completed.add(taskId);
  state.profileData.completedTasks = {
    ...(state.profileData.completedTasks || {}),
    [article.id]: [...completed]
  };
  saveProfileData();
  renderArticleTaskProgress();
}

function getArticleTaskProgress(article, data = state.profileData) {
  const tasks = getTaskDefinitions(article);
  const completed = data.completedTasks?.[article.id] || [];
  return {
    total: tasks.length,
    done: tasks.filter(task => completed.includes(task.id)).length,
    tasks
  };
}

function renderArticleTaskProgress() {
  const article = state.currentArticle;
  if (!article) return;

  const progress = getArticleTaskProgress(article);
  const allDone = progress.total > 0 && progress.done === progress.total;
  $("articleTaskProgress").innerHTML = `
    <div class="task-progress-line ${allDone ? "complete" : ""}">
      <strong>${allDone ? "Všetky úlohy splnené" : "Splnené úlohy"}</strong>
      <span>${progress.done}/${progress.total}</span>
    </div>
  `;
}

function renderVocabulary() {
  const article = state.currentArticle;
  $("vocabList").innerHTML = getVisibleVocabulary(article)
    .map(v => `<li><strong>${escapeHtml(v.de)}</strong> – ${escapeHtml(getVocabularyTranslation(v))}</li>`)
    .join("");
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

      return `${prefix}<button class="inline-word" type="button" data-word="${escapeHtml(vocab.de)}" data-translation="${escapeHtml(getVocabularyTranslation(vocab))}" aria-expanded="false">${word}</button>`;
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
          <button class="choice-btn ${answers[index] === true ? "selected" : ""}" type="button" data-question-index="${index}" data-answer="true">Pravda</button>
          <button class="choice-btn ${answers[index] === false ? "selected" : ""}" type="button" data-question-index="${index}" data-answer="false">Nepravda</button>
        </div>
        <p class="practice-feedback">${typeof answers[index] === "boolean" ? (answers[index] === Boolean(question.answer) ? "Správne." : "Správne je: " + (question.answer ? "pravda" : "nepravda")) : ""}</p>
      </li>
    `)
    .join("");
}

function setSpeechStatus(message = "") {
  $("speechStatus").textContent = message;
}

function setAudioOnlyMode(isAudioOnly) {
  $("articleView").classList.toggle("audio-only", isAudioOnly);
  $("showTextAfterListeningBtn").classList.add("hidden");
}

function showArticleText() {
  $("articleView").classList.remove("audio-only");
  $("showTextAfterListeningBtn").classList.add("hidden");
  setSpeechStatus("");
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
  $("readAloudBtn").textContent = "Prečítať text";
  $("pauseReadBtn").textContent = "Pauza";
  $("listenOnlyBtn").textContent = "Počúvať bez textu";
  clearReadingHighlight();
  showArticleText();
  setSpeechStatus("");
}

function finishReading(message = "Dočítané.") {
  const mode = state.speech.mode;
  state.speech.isReading = false;
  state.speech.utterance = null;
  state.speech.sentenceIndex = 0;
  state.speech.runId += 1;
  $("readAloudBtn").textContent = "Prečítať text";
  $("pauseReadBtn").textContent = "Pauza";
  $("listenOnlyBtn").textContent = "Počúvať bez textu";
  clearReadingHighlight();
  setSpeechStatus(message);

  if (mode === "audioOnly") {
    $("showTextAfterListeningBtn").classList.remove("hidden");
  }
}

async function readSentence(index = 0, mode = "text") {
  if (!("speechSynthesis" in window)) {
    setSpeechStatus("Tento prehliadač nepodporuje čítanie nahlas.");
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
  state.speech.mode = mode;
  state.speech.runId = runId;
  if (mode === "audioOnly") {
    setAudioOnlyMode(true);
  } else {
    setAudioOnlyMode(false);
    highlightSentence(index);
  }

  const utterance = new SpeechSynthesisUtterance(sentences[index]);
  utterance.lang = "de-DE";
  utterance.rate = Number($("speechRateSelect").value || 1);
  utterance.voice = getGermanVoice();
  utterance.onend = () => {
    if (state.speech.isReading && state.speech.utterance === utterance && state.speech.runId === runId) {
      readSentence(index + 1, state.speech.mode);
    }
  };
  utterance.onerror = (event) => {
    if (state.speech.utterance !== utterance) return;
    if (state.speech.runId !== runId) return;
    if (event.error === "interrupted" || event.error === "canceled") return;

    state.speech.isReading = false;
    setSpeechStatus("Čítanie sa nepodarilo spustiť.");
  };

  state.speech.utterance = utterance;
  $("readAloudBtn").textContent = "Od začiatku";
  $("listenOnlyBtn").textContent = mode === "audioOnly" ? "Počúvam..." : "Počúvať bez textu";
  setSpeechStatus(mode === "audioOnly"
    ? `Počúvaj vetu ${index + 1} z ${sentences.length}.`
    : `Čítam vetu ${index + 1} z ${sentences.length}.`);
  window.speechSynthesis.speak(utterance);
}

function listenWithoutText() {
  readSentence(0, "audioOnly");
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

function changeSpeechRate() {
  if (!state.speech.isReading) return;

  const index = state.speech.sentenceIndex;
  const mode = state.speech.mode;

  if (state.speech.utterance) {
    state.speech.utterance.onend = null;
    state.speech.utterance.onerror = null;
  }

  state.speech.runId += 1;
  window.speechSynthesis.cancel();
  setSpeechStatus("Mením rýchlosť...");
  setTimeout(() => readSentence(index, mode), 80);
}

function togglePauseReading() {
  if (!("speechSynthesis" in window) || !state.speech.isReading) return;

  if (window.speechSynthesis.paused) {
    window.speechSynthesis.resume();
    $("pauseReadBtn").textContent = "Pauza";
    setSpeechStatus("Pokračujem v čítaní.");
  } else {
    window.speechSynthesis.pause();
    $("pauseReadBtn").textContent = "Pokračovať";
    setSpeechStatus("Čítanie je pozastavené.");
  }
}

function startSentenceGame() {
  const candidates = getArticleSentences(state.currentArticle)
    .map(sentence => ({ sentence, words: getSentenceWords(sentence) }))
    .filter(item => item.words.length >= 4 && item.words.length <= 10);
  const selected = shuffle(candidates)[0] || { words: [] };

  state.sentenceGame = {
    solution: selected.words,
    chosen: [],
    bank: shuffle(selected.words.map((word, index) => ({ id: `${index}-${word}`, word })))
  };
  renderSentenceGame();
}

function hasSentenceOrderTask(article) {
  return getArticleSentences(article)
    .map(sentence => getSentenceWords(sentence))
    .some(words => words.length >= 4 && words.length <= 10);
}

function renderSentenceGame() {
  const game = state.sentenceGame;
  $("sentenceTarget").innerHTML = game.chosen.length
    ? game.chosen.map(item => `<button class="word-chip selected" type="button" data-word-id="${escapeHtml(item.id)}">${escapeHtml(item.word)}</button>`).join("")
    : '<span class="muted">Ťukaj slová v správnom poradí.</span>';
  $("sentenceWordBank").innerHTML = game.bank
    .map(item => `<button class="word-chip" type="button" data-word-id="${escapeHtml(item.id)}">${escapeHtml(item.word)}</button>`)
    .join("");

  if (!game.solution.length) {
    $("sentenceGameFeedback").textContent = "Na túto hru treba aspoň jednu kratšiu vetu.";
    return;
  }

  if (game.chosen.length !== game.solution.length) {
    $("sentenceGameFeedback").textContent = "";
    return;
  }

  const answer = game.chosen.map(item => item.word).join(" ");
  const solution = game.solution.join(" ");
  const isCorrect = answer === solution;
  $("sentenceGameFeedback").textContent = isCorrect
    ? "Výborne, veta sedí."
    : "Skús prehodiť poradie ešte raz.";
  logPractice("sentence-order", { correct: isCorrect, answer, solution });
  if (isCorrect) markTaskCompleted("sentence-order");
}

function chooseSentenceWord(id) {
  const item = state.sentenceGame.bank.find(word => word.id === id);
  if (!item) return;
  state.sentenceGame.bank = state.sentenceGame.bank.filter(word => word.id !== id);
  state.sentenceGame.chosen.push(item);
  renderSentenceGame();
}

function returnSentenceWord(id) {
  const item = state.sentenceGame.chosen.find(word => word.id === id);
  if (!item) return;
  state.sentenceGame.chosen = state.sentenceGame.chosen.filter(word => word.id !== id);
  state.sentenceGame.bank.push(item);
  renderSentenceGame();
}

function startMatchGame() {
  const vocabulary = shuffle(getVisibleVocabulary(state.currentArticle).filter(item => getVocabularyTranslation(item))).slice(0, 6);
  const cards = vocabulary.flatMap((item, index) => [
    { id: `${index}-de`, pairId: String(index), label: item.de, type: "de" },
    { id: `${index}-native`, pairId: String(index), label: getVocabularyTranslation(item), type: "native" }
  ]);

  state.matchGame = {
    cards: shuffle(cards),
    selectedIds: [],
    matchedIds: [],
    loggedComplete: false
  };
  renderMatchGame();
}

function renderMatchGame() {
  const game = state.matchGame;
  $("matchGameBoard").innerHTML = game.cards.map(card => {
    const isSelected = game.selectedIds.includes(card.id);
    const isMatched = game.matchedIds.includes(card.id);
    const classes = ["match-card", isSelected ? "selected" : "", isMatched ? "matched" : ""].filter(Boolean).join(" ");
    return `<button class="${classes}" type="button" data-card-id="${escapeHtml(card.id)}" ${isMatched ? "disabled" : ""}>${escapeHtml(card.label)}</button>`;
  }).join("");

  if (!game.cards.length) {
    $("matchGameFeedback").textContent = "Na dvojice treba najprv slovíčka v článku.";
  } else if (game.matchedIds.length === game.cards.length) {
    $("matchGameFeedback").textContent = "Hotovo, všetky dvojice sedia.";
    if (!game.loggedComplete) {
      game.loggedComplete = true;
      logPractice("match-pairs", { pairs: game.cards.length / 2 });
      markTaskCompleted("match-pairs");
    }
  } else {
    $("matchGameFeedback").textContent = "";
  }
}

function chooseMatchCard(id) {
  const game = state.matchGame;
  const card = game.cards.find(item => item.id === id);
  if (!card || game.selectedIds.length === 2 || game.matchedIds.includes(id) || game.selectedIds.includes(id)) return;

  game.selectedIds = [...game.selectedIds, id].slice(-2);
  renderMatchGame();

  if (game.selectedIds.length < 2) return;

  const [first, second] = game.selectedIds.map(selectedId => game.cards.find(item => item.id === selectedId));
  if (first.pairId === second.pairId && first.type !== second.type) {
    game.matchedIds.push(first.id, second.id);
    game.selectedIds = [];
    renderMatchGame();
  } else {
    $("matchGameFeedback").textContent = "Toto ešte nie je dvojica.";
    setTimeout(() => {
      game.selectedIds = [];
      renderMatchGame();
    }, 800);
  }
}

function startVocabChoiceGame() {
  const vocabulary = getPracticeVocabulary(state.currentArticle);
  if (vocabulary.length < 4) {
    state.vocabChoiceGame = null;
    $("vocabChoicePrompt").textContent = "";
    $("vocabChoiceOptions").innerHTML = "";
    $("vocabChoiceFeedback").textContent = "Na túto hru treba aspoň 4 slovíčka.";
    return;
  }

  const correct = shuffle(vocabulary)[0];
  const correctTranslation = getVocabularyTranslation(correct);
  const options = shuffle([
    correctTranslation,
    ...shuffle(vocabulary.filter(item => getVocabularyTranslation(item) !== correctTranslation)).slice(0, 3).map(item => getVocabularyTranslation(item))
  ]);
  state.vocabChoiceGame = { correct, correctTranslation, options, answered: false };
  $("vocabChoicePrompt").textContent = correct.de;
  $("vocabChoiceOptions").innerHTML = options
    .map(option => `<button class="quiz-option" type="button" data-answer="${escapeHtml(option)}">${escapeHtml(option)}</button>`)
    .join("");
  $("vocabChoiceFeedback").textContent = "";
}

function answerVocabChoice(answer) {
  const game = state.vocabChoiceGame;
  if (!game || game.answered) return;
  game.answered = true;

  document.querySelectorAll("#vocabChoiceOptions .quiz-option").forEach(button => {
    const isCorrect = button.dataset.answer === game.correctTranslation;
    const isChosen = button.dataset.answer === answer;
    button.classList.toggle("correct", isCorrect);
    button.classList.toggle("wrong", isChosen && !isCorrect);
    button.disabled = true;
  });

  const isCorrect = answer === game.correctTranslation;
  $("vocabChoiceFeedback").textContent = isCorrect ? "Správne." : `Správne je: ${game.correctTranslation}`;
  logPractice("vocab-choice", { correct: isCorrect, prompt: game.correct.de, answer, expected: game.correctTranslation });
  if (isCorrect) markTaskCompleted("vocab-choice");
}

function findSentenceWithVocabulary(article) {
  const sentences = getArticleSentences(article);
  const vocabulary = getPracticeVocabulary(article);
  const candidates = [];

  vocabulary.forEach(item => {
    if (getSentenceWords(item.de).length !== 1) return;
    const pattern = new RegExp(`(^|[^\\p{L}\\p{N}_])(${escapeRegExp(item.de)})(?=$|[^\\p{L}\\p{N}_])`, "iu");
    sentences.forEach(sentence => {
      if (pattern.test(sentence)) candidates.push({ sentence, item, pattern });
    });
  });

  return shuffle(candidates)[0] || null;
}

function hasClozeTask(article) {
  const vocabulary = getPracticeVocabulary(article).filter(item => getSentenceWords(item.de).length === 1);
  return vocabulary.length >= 4 && Boolean(findSentenceWithVocabulary(article));
}

function hasMistakeTask(article) {
  const candidate = findSentenceWithVocabulary(article);
  const vocabulary = getPracticeVocabulary(article)
    .filter(item => getSentenceWords(item.de).length === 1 && item.de !== candidate?.item.de);
  return Boolean(candidate && vocabulary.length);
}

function startClozeGame() {
  const candidate = findSentenceWithVocabulary(state.currentArticle);
  const vocabulary = getPracticeVocabulary(state.currentArticle).filter(item => getSentenceWords(item.de).length === 1);
  if (!candidate || vocabulary.length < 4) {
    state.clozeGame = null;
    $("clozeSentence").textContent = "";
    $("clozeOptions").innerHTML = "";
    $("clozeFeedback").textContent = "Na túto hru treba viac krátkych slovíčok v texte.";
    return;
  }

  const options = shuffle([
    candidate.item.de,
    ...shuffle(vocabulary.filter(item => item.de !== candidate.item.de)).slice(0, 3).map(item => item.de)
  ]);
  const sentence = candidate.sentence.replace(candidate.pattern, (match, prefix) => `${prefix}_____`);
  state.clozeGame = { answer: candidate.item.de, sentence, options, answered: false };
  $("clozeSentence").textContent = sentence;
  $("clozeOptions").innerHTML = options
    .map(option => `<button class="quiz-option" type="button" data-answer="${escapeHtml(option)}">${escapeHtml(option)}</button>`)
    .join("");
  $("clozeFeedback").textContent = "";
}

function answerClozeGame(answer) {
  const game = state.clozeGame;
  if (!game || game.answered) return;
  game.answered = true;
  document.querySelectorAll("#clozeOptions .quiz-option").forEach(button => {
    const isCorrect = button.dataset.answer === game.answer;
    const isChosen = button.dataset.answer === answer;
    button.classList.toggle("correct", isCorrect);
    button.classList.toggle("wrong", isChosen && !isCorrect);
    button.disabled = true;
  });
  const isCorrect = answer === game.answer;
  $("clozeFeedback").textContent = isCorrect ? "Správne." : `Správne je: ${game.answer}`;
  logPractice("cloze-word", { correct: isCorrect, answer, expected: game.answer });
  if (isCorrect) markTaskCompleted("cloze-word");
}

function startMistakeGame() {
  const candidate = findSentenceWithVocabulary(state.currentArticle);
  const vocabulary = getPracticeVocabulary(state.currentArticle)
    .filter(item => getSentenceWords(item.de).length === 1 && item.de !== candidate?.item.de);
  if (!candidate || !vocabulary.length) {
    state.mistakeGame = null;
    $("mistakeSentence").textContent = "";
    $("mistakeOptions").innerHTML = "";
    $("mistakeFeedback").textContent = "Na túto hru treba viac krátkych slovíčok v texte.";
    return;
  }

  const wrongWord = shuffle(vocabulary)[0].de;
  const sentence = candidate.sentence.replace(candidate.pattern, (match, prefix) => `${prefix}${wrongWord}`);
  const options = shuffle([...new Set(getSentenceWords(sentence))]).slice(0, 5);
  if (!options.includes(wrongWord)) options[0] = wrongWord;
  state.mistakeGame = { wrongWord, correctWord: candidate.item.de, sentence, answered: false };
  $("mistakeSentence").textContent = sentence;
  $("mistakeOptions").innerHTML = shuffle(options)
    .map(option => `<button class="quiz-option" type="button" data-answer="${escapeHtml(option)}">${escapeHtml(option)}</button>`)
    .join("");
  $("mistakeFeedback").textContent = "";
}

function answerMistakeGame(answer) {
  const game = state.mistakeGame;
  if (!game || game.answered) return;
  game.answered = true;
  document.querySelectorAll("#mistakeOptions .quiz-option").forEach(button => {
    const isCorrect = button.dataset.answer === game.wrongWord;
    const isChosen = button.dataset.answer === answer;
    button.classList.toggle("correct", isCorrect);
    button.classList.toggle("wrong", isChosen && !isCorrect);
    button.disabled = true;
  });
  const isCorrect = answer === game.wrongWord;
  $("mistakeFeedback").textContent = isCorrect
    ? `Správne. Vo vete má byť: ${game.correctWord}`
    : `Chybné slovo je: ${game.wrongWord}. Vo vete má byť: ${game.correctWord}`;
  logPractice("find-mistake", { correct: isCorrect, answer, expected: game.wrongWord });
  if (isCorrect) markTaskCompleted("find-mistake");
}

function createWordSearchGrid(words) {
  const size = 12;
  const grid = Array.from({ length: size }, () => Array(size).fill(""));
  const directions = [
    [1, 0], [0, 1], [1, 1], [-1, 1],
    [-1, 0], [0, -1], [-1, -1], [1, -1]
  ];

  const placeWord = (item) => {
    const word = item.search;
    for (let attempt = 0; attempt < 120; attempt += 1) {
      const [dx, dy] = shuffle(directions)[0];
      const x = Math.floor(Math.random() * size);
      const y = Math.floor(Math.random() * size);
      const endX = x + dx * (word.length - 1);
      const endY = y + dy * (word.length - 1);
      if (endX < 0 || endX >= size || endY < 0 || endY >= size) continue;

      let fits = true;
      for (let index = 0; index < word.length; index += 1) {
        const cell = grid[y + dy * index][x + dx * index];
        if (cell && cell !== word[index]) fits = false;
      }
      if (!fits) continue;

      for (let index = 0; index < word.length; index += 1) {
        grid[y + dy * index][x + dx * index] = word[index];
      }
      item.cells = Array.from({ length: word.length }, (_, index) => ({
        row: y + dy * index,
        col: x + dx * index
      }));
      return true;
    }
    return false;
  };

  const placed = words.filter(item => placeWord(item));
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      if (!grid[row][col]) grid[row][col] = letters[Math.floor(Math.random() * letters.length)];
    }
  }

  return { grid, placed };
}

function startWordSearchGame() {
  const vocabulary = shuffle(getWordSearchVocabulary(state.currentArticle)).slice(0, 6);
  if (vocabulary.length < 3) {
    state.wordSearchGame = { words: [], found: [], selected: [], grid: [] };
    $("wordSearchHints").innerHTML = "";
    $("wordSearchGrid").innerHTML = "";
    $("wordSearchFeedback").textContent = "Na osemsmerovku treba aspoň 3 kratšie slovíčka.";
    return;
  }

  const { grid, placed } = createWordSearchGrid(vocabulary);
  state.wordSearchGame = { words: placed, found: [], selected: [], foundCells: [], grid };
  renderWordSearchGame();
}

function renderWordSearchGame() {
  const game = state.wordSearchGame;
  $("wordSearchHints").innerHTML = game.words
    .map(item => `<li class="${game.found.includes(item.search) ? "found" : ""}">${escapeHtml(getVocabularyTranslation(item))}</li>`)
    .join("");
  $("wordSearchGrid").innerHTML = game.grid.flatMap((row, rowIndex) =>
    row.map((letter, colIndex) => {
      const key = `${rowIndex}-${colIndex}`;
      const selected = game.selected.some(item => item.key === key);
      const found = game.foundCells?.includes(key);
      return `<button class="letter-cell ${selected ? "selected" : ""} ${found ? "found" : ""}" type="button" data-row="${rowIndex}" data-col="${colIndex}">${letter}</button>`;
    })
  ).join("");
  $("wordSearchFeedback").textContent = game.found.length === game.words.length && game.words.length
    ? "Hotovo, všetky slová sú nájdené."
    : game.selected.length ? game.selected.map(item => item.letter).join("") : "";
}

function chooseWordSearchLetter(row, col) {
  const game = state.wordSearchGame;
  if (!game.grid?.length) return;
  const key = `${row}-${col}`;
  if (game.selected.some(item => item.key === key)) return;
  game.selected.push({ key, letter: game.grid[row][col] });
  const selectedWord = game.selected.map(item => item.letter).join("");
  const foundWord = game.words.find(item => item.search === selectedWord && !game.found.includes(item.search));

  if (foundWord) {
    game.found.push(foundWord.search);
    game.foundCells = [
      ...(game.foundCells || []),
      ...foundWord.cells.map(cell => `${cell.row}-${cell.col}`)
    ];
    game.selected = [];
    logPractice("word-search", { word: foundWord.de });
    if (game.found.length === game.words.length) markTaskCompleted("word-search");
  } else if (!game.words.some(item => item.search.startsWith(selectedWord))) {
    setTimeout(() => {
      game.selected = [];
      renderWordSearchGame();
    }, 450);
  }
  renderWordSearchGame();
}

function markCurrentArticleRead(source = "manual") {
  const article = state.currentArticle;
  if (!article || state.profileData.readIds.includes(article.id)) return;

  state.profileData.readIds.push(article.id);
  saveProfileData();
  $("markReadBtn").textContent = source === "auto"
    ? "Označené ako prečítané"
    : "Prečítané ✓";
}

function clearArticleReadTimer() {
  if (!state.articleReadTimer) return;
  clearTimeout(state.articleReadTimer);
  state.articleReadTimer = null;
}

function startArticleReadTimer() {
  clearArticleReadTimer();
  const article = state.currentArticle;
  if (!article || state.profileData.readIds.includes(article.id)) return;

  state.articleReadTimer = setTimeout(() => {
    if (state.currentArticle?.id !== article.id || $("articleView").classList.contains("hidden")) return;
    markCurrentArticleRead("auto");
  }, AUTO_READ_DELAY_MS);
}

function openArticle(id) {
  const article = state.articles.find(a => a.id === id);
  if (!article) return;

  clearArticleReadTimer();
  stopReading();
  state.currentArticle = article;
  showView("articleView");

  $("articleMeta").textContent = `${article.level} • ${article.category}`;
  $("articleTitle").textContent = article.title;
  cleanupDiscoveredVocabulary(article);
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

  $("markReadBtn").textContent = state.profileData.readIds.includes(article.id)
    ? "Prečítané ✓"
    : "Označiť ako prečítané";
  startArticleReadTimer();
}

function addDiscoveredVocabulary(word, translation) {
  const article = state.currentArticle;
  if (!article) return;

  const wordKey = normalizeVocabularyKey(word);
  const exists = getVisibleVocabulary(article).some(v => normalizeVocabularyKey(v.de) === wordKey);
  if (!exists) {
    state.profileData.discoveredVocabulary[article.id] = [
      ...getSavedVocabulary(article),
      { de: word, sk: translation }
    ];
    saveProfileData();
    renderVocabulary();
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
}

function showHome() {
  clearArticleReadTimer();
  stopReading();
  state.currentArticle = null;
  showView("homeView");
  renderArticles();
}

function showSettings() {
  showView("settingsView");
}

async function loadProfileData(profile) {
  const localData = JSON.parse(localStorage.getItem(profileDataKey(profile.id)) || "null");
  state.profileData = localData ? { ...emptyProfileData(), ...localData } : emptyProfileData();

  if (localStorage.getItem(LEGACY_MIGRATION_KEY) !== "true") {
    state.profileData.readIds = JSON.parse(localStorage.getItem("readIds") || "[]");
    state.profileData.discoveredVocabulary = JSON.parse(localStorage.getItem("discoveredVocabulary") || "{}");
    localStorage.setItem(LEGACY_MIGRATION_KEY, "true");
  }

  if (!state.remoteReady) {
    localStorage.setItem(profileDataKey(profile.id), JSON.stringify(state.profileData));
    return;
  }

  try {
    const rows = await supabaseRequest(`app_profile_data?profile_id=eq.${encodeURIComponent(profile.id)}&select=data`);
    if (rows?.[0]?.data) {
      state.profileData = { ...emptyProfileData(), ...rows[0].data };
      localStorage.setItem(profileDataKey(profile.id), JSON.stringify(state.profileData));
    } else {
      await saveProfileData();
    }
  } catch (error) {
    console.error(error);
  }
}

async function setCurrentProfile(profile) {
  state.currentProfile = normalizeProfile(profile);
  localStorage.setItem(CURRENT_PROFILE_KEY, profile.id);
  await loadProfileData(state.currentProfile);
  $("currentProfileLabel").textContent = `${profile.name} • ${profile.role === "teacher" ? "učiteľ" : "žiačka"}${state.remoteReady ? " • online" : " • lokálne"}`;
  renderNativeLanguageControls();
  $("settingsBtn").classList.remove("hidden");
  $("teacherBtn").classList.toggle("hidden", profile.role !== "teacher");
  showHome();
  showStartupQuiz();
}

function showLogin() {
  clearArticleReadTimer();
  stopReading();
  $("settingsBtn").classList.add("hidden");
  $("teacherBtn").classList.add("hidden");
  showView(state.profiles.length ? "loginView" : "setupView");
}

async function login() {
  const name = normalizeName($("loginNameInput").value);
  const pin = $("loginPinInput").value.trim();
  const profile = state.profiles.find(item => normalizeName(item.name) === name && item.pin === pin);

  if (!profile) {
    $("loginError").textContent = "Meno alebo PIN nesedí.";
    return;
  }

  $("loginError").textContent = "";
  $("loginPinInput").value = "";
  const nativeLanguage = $("loginNativeLanguageSelect").value;
  if (isSupportedNativeLanguage(nativeLanguage) && profile.nativeLanguage !== nativeLanguage) {
    profile.nativeLanguage = nativeLanguage;
    state.profiles = state.profiles.map(item => item.id === profile.id ? profile : item);
    await saveProfiles();
  }
  await setCurrentProfile(profile);
}

async function createProfiles() {
  const teacherName = $("teacherNameInput").value.trim();
  const teacherPin = $("teacherPinInput").value.trim();
  const studentName = $("studentNameInput").value.trim();
  const studentPin = $("studentPinInput").value.trim();

  if (!teacherName || !teacherPin || !studentName || !studentPin) {
    $("setupError").textContent = "Vyplň obe mená aj oba PINy.";
    return;
  }

  if (normalizeName(teacherName) === normalizeName(studentName)) {
    $("setupError").textContent = "Profily musia mať rozdielne mená.";
    return;
  }

  state.profiles = [
    { id: makeProfileId(teacherName), name: teacherName, pin: teacherPin, role: "teacher", nativeLanguage: DEFAULT_NATIVE_LANGUAGE },
    { id: makeProfileId(studentName), name: studentName, pin: studentPin, role: "student", nativeLanguage: $("setupNativeLanguageSelect").value || DEFAULT_NATIVE_LANGUAGE }
  ];
  await saveProfiles();
  $("setupError").textContent = "";
  await setCurrentProfile(state.profiles[0]);
}

function logout() {
  clearArticleReadTimer();
  stopReading();
  state.currentProfile = null;
  state.profileData = emptyProfileData();
  state.currentArticle = null;
  localStorage.removeItem(CURRENT_PROFILE_KEY);
  $("loginNameInput").value = "";
  $("loginPinInput").value = "";
  showLogin();
}

async function showTeacherOverview() {
  if (!state.currentProfile || state.currentProfile.role !== "teacher") return;
  await renderTeacherOverview();
  renderArticleEditorList();
  showView("teacherView");
}

async function getProfileData(profile) {
  if (state.remoteReady) {
    try {
      const rows = await supabaseRequest(`app_profile_data?profile_id=eq.${encodeURIComponent(profile.id)}&select=data`);
      if (rows?.[0]?.data) return { ...emptyProfileData(), ...rows[0].data };
    } catch (error) {
      console.error(error);
    }
  }

  const localData = JSON.parse(localStorage.getItem(profileDataKey(profile.id)) || "null");
  return localData ? { ...emptyProfileData(), ...localData } : emptyProfileData();
}

function formatPracticeType(type) {
  return {
    "sentence-order": "Zoraď vetu",
    "match-pairs": "Nájdi dvojice",
    "startup-vocabulary": "Úvodné slovíčko",
    "true-false": "Pravda/nepravda",
    "vocab-choice": "4 možnosti",
    "cloze-word": "Doplň slovo",
    "find-mistake": "Nájdi chybné slovo",
    "word-search": "Osemsmerovka"
  }[type] || type;
}

function formatDateTime(value) {
  if (!value) return "";
  return new Date(value).toLocaleString("sk-SK", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function renderNativeLanguageSelect(selectId, value = DEFAULT_NATIVE_LANGUAGE) {
  const select = $(selectId);
  if (!select) return;

  select.innerHTML = Object.entries(NATIVE_LANGUAGES)
    .map(([code, language]) => `<option value="${code}">${escapeHtml(language.label)}</option>`)
    .join("");
  select.value = isSupportedNativeLanguage(value) ? value : DEFAULT_NATIVE_LANGUAGE;
}

function renderNativeLanguageControls() {
  const profileLanguage = getNativeLanguage();
  renderNativeLanguageSelect("setupNativeLanguageSelect", DEFAULT_NATIVE_LANGUAGE);
  renderNativeLanguageSelect("loginNativeLanguageSelect", profileLanguage);
  renderNativeLanguageSelect("settingsNativeLanguageSelect", profileLanguage);
}

async function updateCurrentProfileNativeLanguage(language) {
  if (!state.currentProfile || !isSupportedNativeLanguage(language)) return;

  state.currentProfile.nativeLanguage = language;
  state.profiles = state.profiles.map(profile =>
    profile.id === state.currentProfile.id ? { ...profile, nativeLanguage: language } : profile
  );
  await saveProfiles();
  renderNativeLanguageControls();

  if (state.currentArticle) {
    renderVocabulary();
    renderArticleText(state.currentArticle);
    startMatchGame();
    startVocabChoiceGame();
    startWordSearchGame();
  } else {
    renderArticles();
  }
}

function linesToList(value) {
  return value.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
}

function parseVocabularyLines(value) {
  const language = getNativeLanguage();
  return linesToList(value).map(line => {
    const [de, ...rest] = line.split("=");
    return makeVocabularyItem(de, rest.join("="), language);
  }).filter(item => item.de && getVocabularyTranslation(item, language));
}

function parseVocabularyDraftLines(value) {
  const language = getNativeLanguage();
  return linesToList(value).map(line => {
    const [de, ...rest] = line.split("=");
    return makeVocabularyItem(de, rest.join("="), language);
  }).filter(item => item.de);
}

function formatVocabularyLines(items = []) {
  return items.map(item => `${item.de} = ${getVocabularyTranslation(item)}`).join("\n");
}

function mergeVocabularyTranslations(existingItems = [], parsedItems = [], language = getNativeLanguage()) {
  const existingByKey = new Map(existingItems.map(item => [normalizeVocabularyKey(item.de), item]));
  return parsedItems.map(item => {
    const existing = existingByKey.get(normalizeVocabularyKey(item.de)) || {};
    return {
      ...existing,
      ...item,
      de: item.de,
      [language]: getVocabularyTranslation(item, language)
    };
  });
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

async function copyTextToClipboard(text, successMessage = "Skopírované.") {
  if (!text.trim()) {
    $("articleEditorStatus").textContent = "Nie je čo kopírovať.";
    return;
  }

  $("generatedPromptOutput").value = text;
  $("generatedPromptWrap").classList.remove("hidden");

  try {
    if (!navigator.clipboard?.writeText) {
      throw new Error("Clipboard API nie je dostupné.");
    }

    await navigator.clipboard.writeText(text);
    $("articleEditorStatus").textContent = successMessage;
  } catch (error) {
    $("generatedPromptOutput").focus();
    $("generatedPromptOutput").select();
    $("articleEditorStatus").textContent = "Automatické kopírovanie zlyhalo. Prompt je zobrazený nižšie, skopíruj ho ručne.";
  }
}

function getSelectedArticleText() {
  const input = $("articleTextInput");
  return input.value.slice(input.selectionStart, input.selectionEnd).trim();
}

function appendUniqueLine(textareaId, line) {
  const textarea = $(textareaId);
  const normalizedLine = line.trim();
  if (!normalizedLine) return false;

  const key = normalizeVocabularyKey(normalizedLine.split("=")[0]);
  const existingKeys = linesToList(textarea.value)
    .map(item => normalizeVocabularyKey(item.split("=")[0]));
  if (existingKeys.includes(key)) return false;

  textarea.value = [...linesToList(textarea.value), normalizedLine].join("\n");
  return true;
}

function addSelectedTextToVocabulary(addToVocabulary) {
  const selected = getSelectedArticleText();
  if (!selected) {
    $("articleEditorStatus").textContent = "Najprv označ slovo alebo frázu v texte článku.";
    return;
  }

  const line = `${selected} =`;
  const inlineAdded = appendUniqueLine("articleInlineVocabularyInput", line);
  const vocabAdded = addToVocabulary ? appendUniqueLine("articleVocabularyInput", line) : false;
  $("articleEditorStatus").textContent = inlineAdded || vocabAdded
    ? "Označený text je pridaný."
    : "Tento výraz už v zozname je.";
}

function buildArticlePrompt() {
  const topic = $("articlePromptInput").value.trim();
  const level = $("articleLevelInput").value.trim() || "A2-B1";
  const category = $("articleCategoryInput").value.trim();
  const requiredWords = linesToList($("articleRequiredWordsInput").value);
  addRequiredWordsToVocabulary();

  return [
    `Napíš krátky článok v nemčine pre úroveň ${level}.`,
    category ? `Kategória/téma: ${category}.` : "",
    topic ? `Konkrétne zadanie: ${topic}` : "",
    requiredWords.length
      ? `Tieto slová alebo frázy musia byť v texte použité každé minimálne 2x a maximálne 4x: ${requiredWords.join(", ")}.`
      : "",
    "Vráť iba názov, krátky nemecký popis a nemecký text rozdelený na odseky."
  ].filter(Boolean).join("\n");
}

function addRequiredWordsToVocabulary() {
  const requiredWords = linesToList($("articleRequiredWordsInput").value);
  requiredWords.forEach(word => {
    const line = `${word} =`;
    appendUniqueLine("articleVocabularyInput", line);
    appendUniqueLine("articleInlineVocabularyInput", line);
  });
}

function buildTranslationPrompt() {
  const language = getNativeLanguage();
  const languageInfo = getNativeLanguageInfo(language);
  const words = [
    ...parseVocabularyDraftLines($("articleVocabularyInput").value),
    ...parseVocabularyDraftLines($("articleInlineVocabularyInput").value)
  ];
  const seen = new Set();
  const missing = words
    .filter(item => !getVocabularyTranslation(item, language))
    .filter(item => {
      const key = normalizeVocabularyKey(item.de);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map(item => `${item.de} =`);

  return [
    `Prelož tieto nemecké slová a frázy do ${languageInfo.promptName}.`,
    `Vráť presne formát: nemecky = ${languageInfo.lineFormat}.`,
    "Nepíš vysvetlenia navyše.",
    "",
    missing.join("\n")
  ].join("\n");
}

function buildQuestionsPrompt() {
  const title = $("articleTitleInput").value.trim();
  const text = $("articleTextInput").value.trim();

  return [
    "Vytvor pravda/nepravda vety k tomuto nemeckému článku.",
    "Vráť 6 až 8 riadkov vo formáte:",
    "nemecká veta = true",
    "nemecká veta = false",
    "Použi mix pravdivých a nepravdivých viet. Nepíš nič navyše.",
    title ? `Názov: ${title}` : "",
    "",
    text
  ].filter(Boolean).join("\n");
}

function renderArticleEditorList(selectedId = $("articleEditorSelect")?.value) {
  const select = $("articleEditorSelect");
  if (!select) return;

  select.innerHTML = [
    '<option value="">-- nový článok --</option>',
    ...state.articles.map(article => `<option value="${escapeHtml(article.id)}">${escapeHtml(article.title)}</option>`)
  ].join("");
  select.value = selectedId && state.articles.some(article => article.id === selectedId) ? selectedId : "";

  const article = state.articles.find(item => item.id === select.value);
  fillArticleEditor(article || null);
}

function fillArticleEditor(article) {
  $("articleTitleInput").value = article?.title || "";
  $("articleIdInput").value = article?.id || "";
  $("articleLevelInput").value = article?.level || "A2-B1";
  $("articleCategoryInput").value = article?.category || "";
  $("articleSummaryInput").value = article?.summary || "";
  $("articleTextInput").value = (article?.text || []).join("\n");
  $("articleVocabularyInput").value = formatVocabularyLines(article?.vocabulary || []);
  $("articleInlineVocabularyInput").value = formatVocabularyLines(getInlineVocabulary(article || {}));
  $("articleQuestionsInput").value = formatQuestionLines(article?.questions || []);
  $("articleEditorStatus").textContent = state.remoteReady
    ? ""
    : "Editor vie ukladať až po zapnutí Supabase.";
}

function readArticleEditor() {
  const existingArticle = state.articles.find(item => item.id === $("articleEditorSelect").value);
  const language = getNativeLanguage();
  const title = $("articleTitleInput").value.trim();
  const id = ($("articleIdInput").value.trim() || makeArticleId(title));
  const parsedVocabulary = parseVocabularyLines($("articleVocabularyInput").value);
  const parsedInlineVocabulary = parseVocabularyLines($("articleInlineVocabularyInput").value);
  const article = {
    id,
    title,
    level: $("articleLevelInput").value.trim(),
    category: $("articleCategoryInput").value.trim(),
    summary: $("articleSummaryInput").value.trim(),
    text: linesToList($("articleTextInput").value),
    vocabulary: mergeVocabularyTranslations(existingArticle?.vocabulary || [], parsedVocabulary, language),
    inlineVocabulary: mergeVocabularyTranslations(getInlineVocabulary(existingArticle || {}), parsedInlineVocabulary, language),
    questions: parseQuestionLines($("articleQuestionsInput").value)
  };

  if (!article.title || !article.id || !article.level || !article.category || !article.summary || !article.text.length) {
    throw new Error("Vyplň názov, ID, úroveň, kategóriu, popis a aspoň jeden odsek textu.");
  }

  if (!article.questions.length) {
    throw new Error("Pridaj aspoň jednu pravda/nepravda vetu.");
  }

  return article;
}

async function saveArticleFromEditor() {
  try {
    const article = readArticleEditor();
    await saveArticle(article);
    $("articleEditorStatus").textContent = "Článok je uložený.";
  } catch (error) {
    $("articleEditorStatus").textContent = error.message;
  }
}

async function renderTeacherOverview() {
  const students = state.profiles.filter(profile => profile.role === "student");
  const root = $("teacherOverview");
  const sections = await Promise.all(students.map(async student => {
    const data = await getProfileData(student);
    const readArticles = data.readIds
      .map(id => state.articles.find(article => article.id === id)?.title || id);
    const clickedCount = Object.values(data.discoveredVocabulary || {}).reduce((sum, items) => sum + items.length, 0);
    const practiceLog = data.practiceLog || [];
    const articleProgress = state.articles.map(article => {
      const progress = getArticleTaskProgress(article, data);
      return { article, ...progress };
    });
    const totalTasks = articleProgress.reduce((sum, item) => sum + item.total, 0);
    const doneTasks = articleProgress.reduce((sum, item) => sum + item.done, 0);
    const progressCards = articleProgress.map(item => `
      <li>
        <strong>${escapeHtml(item.article.title)}</strong>
        <span class="muted"> &bull; ${item.done}/${item.total}</span>
      </li>
    `).join("");
    const practiceCards = practiceLog.slice(0, 8).map(entry => `
      <li>
        <strong>${escapeHtml(formatPracticeType(entry.type))}</strong>
        ${entry.articleTitle ? ` &bull; ${escapeHtml(entry.articleTitle)}` : ""}
        ${typeof entry.correct === "boolean" ? ` &bull; ${entry.correct ? "správne" : "nesprávne"}` : ""}
        <span class="muted"> &bull; ${escapeHtml(formatDateTime(entry.at))}</span>
      </li>
    `).join("");
    const answerCards = Object.entries(data.answers || {}).flatMap(([articleId, answers]) => {
      const article = state.articles.find(item => item.id === articleId);
      if (!article) return [];

      return Object.entries(answers)
        .filter(([, answer]) => answer !== null && answer !== undefined && answer !== "")
        .map(([index, answer]) => `
          <div class="answer-card">
            <p><strong>${escapeHtml(article.title)}</strong></p>
            <p>${escapeHtml(article.questions[Number(index)]?.statement || article.questions[Number(index)] || "")}</p>
            <p>${answer === true ? "Pravda" : answer === false ? "Nepravda" : escapeHtml(answer)}</p>
          </div>
        `);
    }).join("");

    return `
      <section class="overview-section">
        <h3>${escapeHtml(student.name)}</h3>
        <p class="muted">Prečítané texty: ${readArticles.length} • Kliknuté slovíčka/frázy: ${clickedCount} • Cvičenia: ${practiceLog.length} • Splnené úlohy: ${doneTasks}/${totalTasks}</p>
        <ul class="overview-list">
          ${readArticles.length ? readArticles.map(title => `<li>${escapeHtml(title)}</li>`).join("") : "<li>Zatiaľ nič prečítané.</li>"}
        </ul>
        <h3>Progres úloh</h3>
        <ul class="overview-list">
          ${progressCards}
        </ul>
        <h3>Cvičenia</h3>
        <ul class="overview-list">
          ${practiceCards || "<li>Zatiaľ žiadne cvičenie.</li>"}
        </ul>
        <h3>Odpovede</h3>
        ${answerCards || '<p class="muted">Zatiaľ nie sú uložené odpovede.</p>'}
      </section>
    `;
  }));

  root.innerHTML = sections.join("");
}

function saveTrueFalseAnswer(index, answer) {
  const article = state.currentArticle;
  if (!article) return;

  state.profileData.answers[article.id] = {
    ...getArticleAnswers(article.id),
    [index]: answer
  };
  const question = article.questions[Number(index)];
  if (answer === Boolean(question.answer)) {
    markTaskCompleted(getQuestionTaskId(index));
  }
  saveProfileData();
  renderQuestions(article);
  logPractice("true-false", {
    correct: answer === Boolean(question.answer),
    answer,
    expected: Boolean(question.answer)
  });
}

function buildStartupQuizQuestions() {
  const vocabulary = getAllVocabulary();
  if (vocabulary.length < 4) return [];

  const makeQuestion = (direction) => {
    const correct = shuffle(vocabulary)[0];
    const correctTranslation = getVocabularyTranslation(correct);
    const prompt = direction === "de-native" ? correct.de : correctTranslation;
    const answer = direction === "de-native" ? correctTranslation : correct.de;
    const wrongOptions = shuffle(vocabulary.filter(item => {
      const option = direction === "de-native" ? getVocabularyTranslation(item) : item.de;
      return option !== answer;
    }))
      .slice(0, 3)
      .map(item => direction === "de-native" ? getVocabularyTranslation(item) : item.de);

    return {
      direction,
      prompt,
      answer,
      options: shuffle([answer, ...wrongOptions])
    };
  };

  return [makeQuestion("de-native"), makeQuestion("native-de")];
}

function renderStartupQuiz() {
  const quiz = state.startupQuiz;
  const question = quiz.questions[quiz.index];
  if (!question) {
    closeStartupQuiz();
    return;
  }

  quiz.answered = false;
  $("startupQuizTitle").textContent = quiz.index === 0
    ? "Čo znamená toto nemecké slovíčko?"
    : "Ako sa to povie po nemecky?";
  $("startupQuizPrompt").textContent = question.prompt;
  $("startupQuizFeedback").textContent = "";
  $("nextStartupQuizBtn").classList.add("hidden");
  $("startupQuizOptions").innerHTML = question.options
    .map(option => `<button class="quiz-option" type="button" data-answer="${escapeHtml(option)}">${escapeHtml(option)}</button>`)
    .join("");
  $("startupQuiz").classList.remove("hidden");
}

function showStartupQuiz() {
  if (state.startupQuiz.shown || !state.currentProfile || !state.articles.length) return;
  const questions = buildStartupQuizQuestions();
  if (!questions.length) return;

  state.startupQuiz = {
    questions,
    index: 0,
    answered: false,
    shown: true
  };
  renderStartupQuiz();
}

function closeStartupQuiz() {
  $("startupQuiz").classList.add("hidden");
}

function answerStartupQuiz(answer) {
  const quiz = state.startupQuiz;
  const question = quiz.questions[quiz.index];
  if (!question || quiz.answered) return;

  quiz.answered = true;
  document.querySelectorAll(".quiz-option").forEach(button => {
    const isCorrect = button.dataset.answer === question.answer;
    const isChosen = button.dataset.answer === answer;
    button.classList.toggle("correct", isCorrect);
    button.classList.toggle("wrong", isChosen && !isCorrect);
    button.disabled = true;
  });

  $("startupQuizFeedback").textContent = answer === question.answer
    ? "Správne."
    : `Správne je: ${question.answer}`;
  logPractice("startup-vocabulary", {
    correct: answer === question.answer,
    direction: question.direction,
    prompt: question.prompt,
    answer,
    expected: question.answer
  });
  $("nextStartupQuizBtn").textContent = quiz.index + 1 >= quiz.questions.length ? "Hotovo" : "Ďalej";
  $("nextStartupQuizBtn").classList.remove("hidden");
}

function nextStartupQuizQuestion() {
  state.startupQuiz.index += 1;
  if (state.startupQuiz.index >= state.startupQuiz.questions.length) {
    closeStartupQuiz();
    return;
  }
  renderStartupQuiz();
}

function loadSettings() {
  const fontSize = localStorage.getItem("fontSize") || "normal";
  const dark = localStorage.getItem("darkMode") === "true";

  renderNativeLanguageControls();
  $("fontSizeSelect").value = fontSize;
  $("darkModeToggle").checked = dark;

  document.body.classList.toggle("font-large", fontSize === "large");
  document.body.classList.toggle("font-xlarge", fontSize === "xlarge");
  document.body.classList.toggle("dark", dark);
  updateNotificationStatus();
}

function updateNotificationStatus(message = "") {
  if (!("Notification" in window)) {
    $("notificationStatus").textContent = "Tento prehliadač nepodporuje notifikácie.";
    return;
  }

  if (message) {
    $("notificationStatus").textContent = message;
    return;
  }

  const labels = {
    default: "Notifikácie ešte nie sú povolené.",
    granted: "Notifikácie sú povolené pre toto zariadenie.",
    denied: "Notifikácie sú zablokované v prehliadači."
  };
  $("notificationStatus").textContent = labels[Notification.permission] || "";
}

async function showTestNotification() {
  if (!("Notification" in window)) {
    updateNotificationStatus();
    return;
  }

  let permission = Notification.permission;
  if (permission === "default") {
    permission = await Notification.requestPermission();
  }

  if (permission !== "granted") {
    updateNotificationStatus("Notifikácie nie sú povolené.");
    return;
  }

  const registration = await navigator.serviceWorker?.ready;
  if (!registration?.showNotification) {
    new Notification("Nemecká čítanka", {
      body: "Skúšobná pripomienka funguje.",
      icon: "icons/icon-192.png"
    });
    updateNotificationStatus("Skúšobná notifikácia odoslaná.");
    return;
  }

  await registration.showNotification("Nemecká čítanka", {
    body: "Dnes stačí pár minút nemčiny.",
    icon: "icons/icon-192.png",
    badge: "icons/icon-192.png",
    data: { url: "./index.html" }
  });
  updateNotificationStatus("Skúšobná notifikácia odoslaná.");
}

$("backBtn").onclick = showHome;
$("settingsBackBtn").onclick = showHome;
$("teacherBackBtn").onclick = showHome;
$("settingsBtn").onclick = showSettings;
$("teacherBtn").onclick = showTeacherOverview;
$("refreshBtn").onclick = loadArticles;
$("loginBtn").onclick = login;
$("createProfilesBtn").onclick = createProfiles;
$("logoutBtn").onclick = logout;
$("readAloudBtn").onclick = () => readSentence(0);
$("listenOnlyBtn").onclick = listenWithoutText;
$("pauseReadBtn").onclick = togglePauseReading;
$("stopReadBtn").onclick = stopReading;
$("showTextAfterListeningBtn").onclick = showArticleText;
$("newSentenceGameBtn").onclick = startSentenceGame;
$("newMatchGameBtn").onclick = startMatchGame;
$("newVocabChoiceBtn").onclick = startVocabChoiceGame;
$("newClozeGameBtn").onclick = startClozeGame;
$("newMistakeGameBtn").onclick = startMistakeGame;
$("newWordSearchBtn").onclick = startWordSearchGame;
$("skipStartupQuizBtn").onclick = closeStartupQuiz;
$("nextStartupQuizBtn").onclick = nextStartupQuizQuestion;
$("testNotificationBtn").onclick = showTestNotification;
$("newArticleBtn").onclick = () => {
  $("articleEditorSelect").value = "";
  fillArticleEditor(null);
};
$("saveArticleBtn").onclick = saveArticleFromEditor;
$("articleEditorSelect").onchange = () => {
  const article = state.articles.find(item => item.id === $("articleEditorSelect").value);
  fillArticleEditor(article || null);
};
$("articleTitleInput").addEventListener("input", () => {
  if (!$("articleEditorSelect").value) {
    $("articleIdInput").value = makeArticleId($("articleTitleInput").value);
  }
});
$("addSelectedVocabularyBtn").onclick = () => addSelectedTextToVocabulary(true);
$("addSelectedInlineBtn").onclick = () => addSelectedTextToVocabulary(false);
$("copyArticlePromptBtn").onclick = () => copyTextToClipboard(buildArticlePrompt(), "Prompt pre článok je skopírovaný.");
$("copyTranslationPromptBtn").onclick = () => copyTextToClipboard(buildTranslationPrompt(), "Slovíčka na preklad sú skopírované.");
$("copyQuestionsPromptBtn").onclick = () => copyTextToClipboard(buildQuestionsPrompt(), "Prompt pre otázky je skopírovaný.");

$("loginPinInput").addEventListener("keydown", event => {
  if (event.key === "Enter") login();
});

$("markReadBtn").onclick = () => {
  markCurrentArticleRead("manual");
};

$("articleText").onclick = (event) => {
  const button = event.target.closest(".inline-word");
  if (!button) return;
  showInlineTranslation(button);
};

$("questionList").addEventListener("click", event => {
  const button = event.target.closest(".choice-btn");
  if (!button) return;
  saveTrueFalseAnswer(button.dataset.questionIndex, button.dataset.answer === "true");
});

$("sentenceWordBank").addEventListener("click", event => {
  const button = event.target.closest(".word-chip");
  if (!button) return;
  chooseSentenceWord(button.dataset.wordId);
});

$("sentenceTarget").addEventListener("click", event => {
  const button = event.target.closest(".word-chip");
  if (!button) return;
  returnSentenceWord(button.dataset.wordId);
});

$("matchGameBoard").addEventListener("click", event => {
  const button = event.target.closest(".match-card");
  if (!button) return;
  chooseMatchCard(button.dataset.cardId);
});

$("vocabChoiceOptions").addEventListener("click", event => {
  const button = event.target.closest(".quiz-option");
  if (!button) return;
  answerVocabChoice(button.dataset.answer);
});

$("clozeOptions").addEventListener("click", event => {
  const button = event.target.closest(".quiz-option");
  if (!button) return;
  answerClozeGame(button.dataset.answer);
});

$("mistakeOptions").addEventListener("click", event => {
  const button = event.target.closest(".quiz-option");
  if (!button) return;
  answerMistakeGame(button.dataset.answer);
});

$("wordSearchGrid").addEventListener("click", event => {
  const button = event.target.closest(".letter-cell");
  if (!button) return;
  chooseWordSearchLetter(Number(button.dataset.row), Number(button.dataset.col));
});

$("speechRateSelect").onchange = () => {
  changeSpeechRate();
};

$("startupQuizOptions").addEventListener("click", event => {
  const button = event.target.closest(".quiz-option");
  if (!button) return;
  answerStartupQuiz(button.dataset.answer);
});

$("fontSizeSelect").onchange = (e) => {
  localStorage.setItem("fontSize", e.target.value);
  loadSettings();
};

$("darkModeToggle").onchange = (e) => {
  localStorage.setItem("darkMode", e.target.checked);
  loadSettings();
};

$("settingsNativeLanguageSelect").onchange = (e) => {
  updateCurrentProfileNativeLanguage(e.target.value);
};

window.addEventListener("pagehide", forceStopSpeech);
window.addEventListener("beforeunload", forceStopSpeech);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) forceStopSpeech();
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("service-worker.js");
  });
}

async function init() {
  loadSettings();
  await loadProfiles();
  await loadArticles();

  const savedProfileId = localStorage.getItem(CURRENT_PROFILE_KEY);
  const savedProfile = state.profiles.find(profile => profile.id === savedProfileId);
  if (savedProfile) {
    await setCurrentProfile(savedProfile);
  } else {
    showLogin();
  }
}

init();
