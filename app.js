const PROFILE_KEY = "profiles";
const CURRENT_PROFILE_KEY = "currentProfileId";
const LEGACY_MIGRATION_KEY = "legacyProfileDataMigrated";
const SUPABASE_CONFIG = window.NC_SUPABASE_CONFIG || {};
const AUTO_READ_DELAY_MS = 2 * 60 * 1000;

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
  remoteReady: Boolean(SUPABASE_CONFIG.url && SUPABASE_CONFIG.anonKey)
};

const $ = (id) => document.getElementById(id);

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

function profileDataKey(profileId) {
  return `profileData:${profileId}`;
}

function emptyProfileData() {
  return {
    readIds: [],
    discoveredVocabulary: {},
    answers: {}
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

  if (!state.remoteReady) return;

  try {
    const profiles = await supabaseRequest("app_profiles?select=id,name,pin,role&order=role.desc,name.asc");
    if (profiles?.length) {
      state.profiles = profiles;
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
    await supabaseRequest("app_profiles?on_conflict=id", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates" },
      body: JSON.stringify(state.profiles)
    });
  } catch (error) {
    console.error(error);
  }
}

async function loadArticles() {
  try {
    const response = await fetch("articles.json", { cache: "no-store" });
    state.articles = await response.json();
  } catch (error) {
    console.error(error);
    state.articles = [];
  }
  renderCategories();
  renderArticles();
}

function getCategories() {
  return ["Všetky", ...new Set(state.articles.map(a => a.category))];
}

function renderCategories() {
  const root = $("categoryFilters");
  root.innerHTML = "";
  getCategories().forEach(category => {
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
}

function renderArticles() {
  const root = $("articleList");
  const articles = state.selectedCategory === "Všetky"
    ? state.articles
    : state.articles.filter(a => a.category === state.selectedCategory);

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
        <span class="badge">${escapeHtml(article.minutes)} min</span>
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

function getSavedVocabulary(article) {
  if (!article) return [];
  return state.profileData.discoveredVocabulary[article.id] || [];
}

function getVisibleVocabulary(article) {
  const initialVocabulary = article.vocabulary || [];
  const savedVocabulary = getSavedVocabulary(article);
  const seen = new Set();

  return [...initialVocabulary, ...savedVocabulary].filter(item => {
    const key = item.de.toLocaleLowerCase("de");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function getAllVocabulary() {
  const seen = new Set();
  return state.articles.flatMap(article => [
    ...(article.vocabulary || []),
    ...getInlineVocabulary(article)
  ]).filter(item => {
    if (!item.de || !item.sk) return false;
    const key = `${item.de.toLocaleLowerCase("de")}|${item.sk.toLocaleLowerCase("sk")}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
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

function renderVocabulary() {
  const article = state.currentArticle;
  $("vocabList").innerHTML = getVisibleVocabulary(article)
    .map(v => `<li><strong>${escapeHtml(v.de)}</strong> – ${escapeHtml(v.sk)}</li>`)
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

      return `${prefix}<button class="inline-word" type="button" data-word="${escapeHtml(vocab.de)}" data-translation="${escapeHtml(vocab.sk)}" aria-expanded="false">${word}</button>`;
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
      <li>
        <div class="question-text">${escapeHtml(question)}</div>
        <textarea class="answer-input" data-question-index="${index}" placeholder="Moja odpoveď">${escapeHtml(answers[index] || "")}</textarea>
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
  $("sentenceGameFeedback").textContent = answer === solution
    ? "Výborne, veta sedí."
    : "Skús prehodiť poradie ešte raz.";
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
  const vocabulary = shuffle(getVisibleVocabulary(state.currentArticle)).slice(0, 6);
  const cards = vocabulary.flatMap((item, index) => [
    { id: `${index}-de`, pairId: String(index), label: item.de, type: "de" },
    { id: `${index}-sk`, pairId: String(index), label: item.sk, type: "sk" }
  ]);

  state.matchGame = {
    cards: shuffle(cards),
    selectedIds: [],
    matchedIds: []
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

  $("articleMeta").textContent = `${article.level} • ${article.category} • ${article.minutes} min`;
  $("articleTitle").textContent = article.title;
  renderArticleText(article);
  renderVocabulary();
  renderQuestions(article);
  startSentenceGame();
  startMatchGame();

  $("markReadBtn").textContent = state.profileData.readIds.includes(article.id)
    ? "Prečítané ✓"
    : "Označiť ako prečítané";
  startArticleReadTimer();
}

function addDiscoveredVocabulary(word, translation) {
  const article = state.currentArticle;
  if (!article) return;

  const exists = getVisibleVocabulary(article).some(v => v.de.toLocaleLowerCase("de") === word.toLocaleLowerCase("de"));
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
  state.currentProfile = profile;
  localStorage.setItem(CURRENT_PROFILE_KEY, profile.id);
  await loadProfileData(profile);
  $("currentProfileLabel").textContent = `${profile.name} • ${profile.role === "teacher" ? "učiteľ" : "žiačka"}${state.remoteReady ? " • online" : " • lokálne"}`;
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
    { id: makeProfileId(teacherName), name: teacherName, pin: teacherPin, role: "teacher" },
    { id: makeProfileId(studentName), name: studentName, pin: studentPin, role: "student" }
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

  return JSON.parse(localStorage.getItem(profileDataKey(profile.id)) || "null") || emptyProfileData();
}

async function renderTeacherOverview() {
  const students = state.profiles.filter(profile => profile.role === "student");
  const root = $("teacherOverview");
  const sections = await Promise.all(students.map(async student => {
    const data = await getProfileData(student);
    const readArticles = data.readIds
      .map(id => state.articles.find(article => article.id === id)?.title || id);
    const clickedCount = Object.values(data.discoveredVocabulary || {}).reduce((sum, items) => sum + items.length, 0);
    const answerCards = Object.entries(data.answers || {}).flatMap(([articleId, answers]) => {
      const article = state.articles.find(item => item.id === articleId);
      if (!article) return [];

      return Object.entries(answers)
        .filter(([, answer]) => answer.trim())
        .map(([index, answer]) => `
          <div class="answer-card">
            <p><strong>${escapeHtml(article.title)}</strong></p>
            <p>${escapeHtml(article.questions[Number(index)] || "")}</p>
            <p>${escapeHtml(answer)}</p>
          </div>
        `);
    }).join("");

    return `
      <section class="overview-section">
        <h3>${escapeHtml(student.name)}</h3>
        <p class="muted">Prečítané texty: ${readArticles.length} • Kliknuté slovíčka/frázy: ${clickedCount}</p>
        <ul class="overview-list">
          ${readArticles.length ? readArticles.map(title => `<li>${escapeHtml(title)}</li>`).join("") : "<li>Zatiaľ nič prečítané.</li>"}
        </ul>
        <h3>Odpovede</h3>
        ${answerCards || '<p class="muted">Zatiaľ nie sú uložené odpovede.</p>'}
      </section>
    `;
  }));

  root.innerHTML = sections.join("");
}

function saveAnswer(input) {
  const article = state.currentArticle;
  if (!article) return;

  const index = input.dataset.questionIndex;
  state.profileData.answers[article.id] = {
    ...getArticleAnswers(article.id),
    [index]: input.value
  };
  saveProfileData();
}

function buildStartupQuizQuestions() {
  const vocabulary = getAllVocabulary();
  if (vocabulary.length < 4) return [];

  const makeQuestion = (direction) => {
    const correct = shuffle(vocabulary)[0];
    const optionKey = direction === "de-sk" ? "sk" : "de";
    const promptKey = direction === "de-sk" ? "de" : "sk";
    const wrongOptions = shuffle(vocabulary.filter(item => item[optionKey] !== correct[optionKey]))
      .slice(0, 3)
      .map(item => item[optionKey]);

    return {
      direction,
      prompt: correct[promptKey],
      answer: correct[optionKey],
      options: shuffle([correct[optionKey], ...wrongOptions])
    };
  };

  return [makeQuestion("de-sk"), makeQuestion("sk-de")];
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

  $("fontSizeSelect").value = fontSize;
  $("darkModeToggle").checked = dark;

  document.body.classList.toggle("font-large", fontSize === "large");
  document.body.classList.toggle("font-xlarge", fontSize === "xlarge");
  document.body.classList.toggle("dark", dark);
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
$("skipStartupQuizBtn").onclick = closeStartupQuiz;
$("nextStartupQuizBtn").onclick = nextStartupQuizQuestion;

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

$("questionList").addEventListener("input", event => {
  const input = event.target.closest(".answer-input");
  if (!input) return;
  saveAnswer(input);
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
