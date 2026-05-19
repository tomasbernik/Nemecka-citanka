const state = {
  articles: [],
  profiles: [],
  preLoginLanguage: DEFAULT_PRELOGIN_LANGUAGE,
  selectedCategory: ALL_CATEGORIES,
  selectedLevel: ALL_LEVELS,
  currentArticle: null,
  activePracticeGroup: "vocab",
  currentProfile: null,
  authSession: null,
  authUser: null,
  lastInviteUrl: "",
  profileData: emptyProfileData(),
  speech: {
    sentenceIndex: 0,
    isReading: false,
    utterance: null,
    mode: "text",
    runId: 0
  },
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
  clickedReviewGame: null,
  vocabChoiceGame: null,
  clozeGame: null,
  mistakeGame: null,
  wordSearchGame: {
    words: [],
    found: [],
    selected: []
  },
  articleImageFile: null,
  editorBaseInlineVocabulary: [],
  editorManualInlineVocabulary: [],
  showAllCategories: false,
  deferredInstallPrompt: null,
  installPromptShown: false,
  remoteReady: Boolean(SUPABASE_CONFIG.url && SUPABASE_CONFIG.anonKey)
};

const $ = (id) => document.getElementById(id);

function getUiLanguage() {
  if (state.currentProfile) return getNativeLanguage(state.currentProfile);
  return state.preLoginLanguage || DEFAULT_PRELOGIN_LANGUAGE;
}

function t(key, language = getUiLanguage()) {
  return UI_TEXT[language]?.[key] || UI_TEXT[DEFAULT_PRELOGIN_LANGUAGE][key] || UI_TEXT[DEFAULT_NATIVE_LANGUAGE][key] || key;
}

function formatText(key, values = {}) {
  return Object.entries(values).reduce(
    (text, [name, value]) => text.replaceAll(`{${name}}`, value ?? ""),
    t(key)
  );
}

function setText(id, key) {
  const element = $(id);
  if (element) element.textContent = t(key);
}

function setLabelText(inputId, key) {
  const input = $(inputId);
  const label = input?.closest("label");
  if (label?.firstChild) label.firstChild.textContent = `${t(key)}\n            `;
}

function setOptionText(selectId, value, key) {
  const option = $(`${selectId}`)?.querySelector(`option[value="${value}"]`);
  if (option) option.textContent = t(key);
}

function setButtonLabel(id, key) {
  const button = $(id);
  if (!button) return;
  const label = t(key);
  button.setAttribute("aria-label", label);
  button.setAttribute("title", label);
}

function onClick(id, handler) {
  const element = $(id);
  if (element) element.onclick = handler;
}

function onChange(id, handler) {
  const element = $(id);
  if (element) element.onchange = handler;
}

function onEvent(id, eventName, handler) {
  const element = $(id);
  if (element) element.addEventListener(eventName, handler);
}

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
  if (item[language]) return item[language];
  return language === DEFAULT_NATIVE_LANGUAGE ? item.translation || "" : "";
}

function shouldShowVocabularyBase(item) {
  if (!item?.base) return false;
  return normalizeVocabularyKey(item.base) !== normalizeVocabularyKey(item.de);
}

function makeVocabularyItem(de, translation, language = getNativeLanguage()) {
  return {
    de: (de || "").trim(),
    base: "",
    [language]: (translation || "").trim()
  };
}

function getCategoryLabel(category) {
  if (category === ALL_CATEGORIES) return t("all");
  if (category === UNREAD_CATEGORY) return t("unread");
  return CATEGORY_LABELS[category]?.[getUiLanguage()] || category;
}

function getArticleCategoriesForFilter(article) {
  return String(article?.category || "")
    .split("|")
    .map(category => category.trim())
    .filter(Boolean);
}

function getPrimaryArticleCategory(article) {
  return getArticleCategoriesForFilter(article)[0] || article?.category || "";
}

function formatArticleCategories(article) {
  return getArticleCategoriesForFilter(article).map(getCategoryLabel).join(", ");
}

function normalizeArticleLevel(level) {
  const match = String(level || "").toUpperCase().match(/A1|A2|B1|B2|C1|C2/);
  return match?.[0] || String(level || "").trim();
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

function getDeviceId() {
  let deviceId = localStorage.getItem(DEVICE_ID_KEY);
  if (deviceId) return deviceId;

  const randomPart = crypto?.randomUUID
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  deviceId = `device-${randomPart}`;
  localStorage.setItem(DEVICE_ID_KEY, deviceId);
  return deviceId;
}

function getBrowserName() {
  const ua = navigator.userAgent;
  if (/Edg\//.test(ua)) return "Edge";
  if (/OPR\//.test(ua)) return "Opera";
  if (/Firefox\//.test(ua)) return "Firefox";
  if (/Chrome\//.test(ua) && !/Edg\//.test(ua)) return "Chrome";
  if (/Safari\//.test(ua) && !/Chrome\//.test(ua)) return "Safari";
  return "Browser";
}

function getDevicePlatformName() {
  const ua = navigator.userAgent;
  if (/iPhone/i.test(ua)) return "iPhone";
  if (/iPad/i.test(ua)) return "iPad";
  if (/Android/i.test(ua)) {
    const model = ua.match(/Android[^;]*;\s*([^;)]+)\)/i)?.[1];
    return model ? `Android ${model.trim()}` : "Android";
  }
  if (/Windows/i.test(ua)) return "Windows";
  if (/Mac OS X/i.test(ua)) return "Mac";
  if (/Linux/i.test(ua)) return "Linux";
  return "Zariadenie";
}

function getAutomaticDeviceName() {
  const deviceId = getDeviceId();
  const shortId = deviceId.split("-").pop()?.slice(0, 6) || deviceId.slice(-6);
  const profileName = state.currentProfile?.name || "Neprihlásené";
  return `${profileName} • ${getDevicePlatformName()} • ${getBrowserName()} • ${shortId}`;
}

async function getDeviceName() {
  const deviceId = getDeviceId();
  const automaticName = getAutomaticDeviceName();

  if (!state.remoteReady) return automaticName;

  try {
    await supabaseRequest("app_devices?on_conflict=device_id", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify([{
        device_id: deviceId,
        profile_id: state.currentProfile?.id || null,
        automatic_name: automaticName,
        user_agent: navigator.userAgent,
        last_seen_at: new Date().toISOString()
      }])
    });

    const rows = await supabaseRequest(`app_devices?device_id=eq.${encodeURIComponent(deviceId)}&select=device_name,automatic_name&limit=1`);
    const device = rows?.[0] || {};
    return device.device_name || device.automatic_name || automaticName;
  } catch (error) {
    console.info("Device name lookup skipped:", error.message);
    return automaticName;
  }
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
    completedTasks: {},
    assignments: [],
    seenAssignmentIds: [],
    openedAssignmentIds: [],
    onboarding: {}
  };
}

function showView(viewId) {
  ["setupView", "loginView", "homeView", "articleView", "settingsView", "teacherView"].forEach(id => {
    $(id).classList.toggle("hidden", id !== viewId);
  });
  renderMobileBottomNav(viewId);
}

function scrollToPageTop() {
  window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  requestAnimationFrame(() => window.scrollTo({ top: 0, left: 0, behavior: "auto" }));
}

function setMobileNavButton(id, label, active = false) {
  const button = $(id);
  if (!button) return;
  button.classList.toggle("active", active);
  button.setAttribute("aria-label", label);
  button.setAttribute("title", label);
  button.setAttribute("aria-current", active ? "page" : "false");
  const labelElement = button.querySelector(".mobile-nav-label");
  if (labelElement) labelElement.textContent = label;
}

function renderMobileBottomNav(activeViewId = "") {
  const nav = $("mobileBottomNav");
  if (!nav) return;

  const isVisible = Boolean(state.currentProfile);
  nav.classList.toggle("hidden", !isVisible);
  document.body.classList.toggle("has-mobile-nav", isVisible);
  if (!isVisible) return;

  const isTeacher = state.currentProfile?.role === "teacher";
  setMobileNavButton("mobileNavHomeBtn", t("articles"), activeViewId === "homeView" || activeViewId === "articleView");
  setMobileNavButton("mobileNavReviewBtn", t("clickedReviewEyebrow"), false);
  setMobileNavButton("mobileNavProgressBtn", isTeacher ? t("articleEditor") : t("myProgress"), activeViewId === "teacherView");
  setMobileNavButton("mobileNavSettingsBtn", t("settings"), activeViewId === "settingsView");
}

function getActiveViewId() {
  return ["setupView", "loginView", "homeView", "articleView", "settingsView", "teacherView"]
    .find(id => !$(id)?.classList.contains("hidden")) || "";
}

function getPracticeGroupLabel(group) {
  return {
    vocab: t("vocabulary"),
    questions: t("questions"),
    games: t("practiceGames"),
    search: t("wordSearch")
  }[group] || group;
}

function renderArticlePracticeTabs() {
  const activeGroup = state.activePracticeGroup || "vocab";
  document.querySelectorAll("[data-practice-tab]").forEach(button => {
    const isActive = button.dataset.practiceTab === activeGroup;
    const label = getPracticeGroupLabel(button.dataset.practiceTab);
    button.textContent = label;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-selected", String(isActive));
  });
  document.querySelectorAll("[data-practice-panel]").forEach(panel => {
    panel.classList.toggle("active", panel.dataset.practicePanel === activeGroup);
  });
}

function setArticlePracticeGroup(group, options = {}) {
  if (!["vocab", "questions", "games", "search"].includes(group)) return;
  state.activePracticeGroup = group;
  renderArticlePracticeTabs();
  if (options.scroll) {
    document.querySelector(`[data-practice-panel="${group}"]`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

function isOnboardingDone(key) {
  return Boolean(state.profileData.onboarding?.[key]);
}

async function completeOnboarding(key) {
  if (!state.currentProfile || isOnboardingDone(key)) return;
  state.profileData.onboarding = {
    ...(state.profileData.onboarding || {}),
    [key]: new Date().toISOString()
  };
  await saveProfileData();
  if (key === "studentIntroDone") renderArticles();
  renderOnboarding();
}

function renderOnboarding() {
  const studentPanel = $("studentOnboarding");
  if (studentPanel) {
    const showStudentIntro = Boolean(
      state.currentProfile
      && state.currentProfile.role !== "teacher"
      && !isOnboardingDone("studentIntroDone")
    );
    studentPanel.classList.toggle("hidden", !showStudentIntro);
  }

  const teacherPanel = $("teacherOnboarding");
  if (teacherPanel) {
    const showTeacherIntro = Boolean(
      state.currentProfile?.role === "teacher"
      && !isOnboardingDone("teacherIntroDone")
      && !$("teacherView")?.classList.contains("hidden")
    );
    teacherPanel.classList.toggle("hidden", !showTeacherIntro);
  }

  const wordHint = $("wordOnboardingHint");
  if (wordHint) {
    const showWordHint = Boolean(
      state.currentArticle
      && !isOnboardingDone("firstWordHintDone")
      && $("articleText")?.querySelector(".inline-word")
    );
    wordHint.classList.toggle("hidden", !showWordHint);
    $("articleText")?.querySelector(".inline-word")?.classList.toggle("onboarding-focus", showWordHint);
  }
}

function updateStaticTexts() {
  document.documentElement.lang = getUiLanguage();
  document.title = t("appTitle");
  document.querySelector(".topbar h1").textContent = t("appTitle");
  document.querySelector(".topbar .eyebrow").textContent = t("languageLabel");
  const teacherButtonLabel = state.currentProfile?.role === "teacher" ? t("articleEditor") : t("myProgress");
  $("teacherBtn").setAttribute("aria-label", teacherButtonLabel);
  $("teacherBtn").setAttribute("title", teacherButtonLabel);
  $("shareAppBtn").setAttribute("aria-label", t("shareApp"));
  $("shareAppBtn").setAttribute("title", t("shareApp"));
  $("settingsBtn").setAttribute("aria-label", t("settings"));
  $("settingsBtn").setAttribute("title", t("settings"));

  document.querySelector("#setupView .eyebrow").textContent = t("setupEyebrow");
  document.querySelector("#setupView h2").textContent = t("setupTitle");
  document.querySelector("#setupView .muted").textContent = t("setupNote");
  setLabelText("teacherNameInput", "profile1Name");
  setLabelText("teacherPinInput", "profile1Pin");
  setLabelText("teacherRoleSelect", "profile1Role");
  setLabelText("teacherNativeLanguageSelect", "profile1Language");
  setLabelText("studentNameInput", "profile2Name");
  setLabelText("studentPinInput", "profile2Pin");
  setLabelText("studentRoleSelect", "profile2Role");
  setLabelText("setupNativeLanguageSelect", "profile2Language");
  setOptionText("teacherRoleSelect", "teacher", "teacherRole");
  setOptionText("teacherRoleSelect", "student", "studentRole");
  setOptionText("studentRoleSelect", "teacher", "teacherRole");
  setOptionText("studentRoleSelect", "student", "studentRole");
  setText("createProfilesBtn", "saveProfiles");
  setText("setupBackBtn", "backToLogin");

  document.querySelector("#loginView .eyebrow").textContent = t("loginEyebrow");
  document.querySelector("#loginView h2").textContent = t("loginTitle");
  setLabelText("loginNameInput", "name");
  setLabelText("loginPinInput", "pin");
  setLabelText("loginNativeLanguageSelect", "nativeLanguage");
  setText("loginBtn", "login");
  setText("googleLoginBtn", "googleLogin");
  setLabelText("magicEmailInput", "magicEmail");
  setText("magicLinkBtn", "magicLinkLogin");
  setText("registerProfileBtn", "newProfile");
  setText("setupPairBtn", "setupPair");

  setText("logoutBtn", "logout");
  setText("clickedReviewEyebrow", "clickedReviewEyebrow");
  setText("clickedReviewTitle", "clickedReviewTitle");
  setText("newClickedReviewBtn", "next");
  document.querySelector("#homeView .section-title h3").textContent = t("articles");
  setText("refreshBtn", "refresh");

  setText("backBtn", "back");
  setButtonLabel("readAloudBtn", "readText");
  setButtonLabel("pauseReadBtn", "pause");
  setButtonLabel("stopReadBtn", "stop");
  setText("markReadBtn", "markRead");
  setText("markReadBottomBtn", "markRead");

  document.querySelectorAll("#articleView .practice-heading .eyebrow").forEach(item => item.textContent = t("game"));
  setText("vocabPanelEyebrow", "overview");
  setText("vocabPanelTitle", "vocabulary");
  setText("questionsPanelEyebrow", "practice");
  setText("questionsPanelTitle", "questions");
  setText("sentenceGameTitle", "sentenceOrder");
  setText("newSentenceGameBtn", "newSentence");
  setText("matchGameTitle", "matchPairs");
  setText("newMatchGameBtn", "shuffle");
  setText("vocabChoiceTitle", "vocabChoice");
  setText("newVocabChoiceBtn", "newVocab");
  setText("clozeGameTitle", "cloze");
  setText("newClozeGameBtn", "newSentence");
  setText("mistakeGameTitle", "mistake");
  setText("newMistakeGameBtn", "newSentence");
  setText("wordSearchTitle", "wordSearch");
  setText("newWordSearchBtn", "newGame");

  setText("settingsBackBtn", "back");
  document.querySelector("#settingsView h2").textContent = t("settingsTitle");
  setLabelText("fontSizeSelect", "fontSize");
  setOptionText("fontSizeSelect", "normal", "normal");
  setOptionText("fontSizeSelect", "large", "large");
  setOptionText("fontSizeSelect", "xlarge", "xlarge");
  setLabelText("settingsNativeLanguageSelect", "nativeLanguage");
  setLabelText("settingsRoleSelect", "profileRole");
  setOptionText("settingsRoleSelect", "teacher", "teacherRole");
  setOptionText("settingsRoleSelect", "student", "studentRole");
  setLabelText("darkModeToggle", "darkMode");
  setText("authAccountTitle", "accountTitle");
  setText("linkGoogleAccountBtn", "linkGoogle");
  setText("signOutGoogleBtn", "signOutGoogle");
  renderAuthControls();
  document.querySelector("#notificationStatus").previousElementSibling.textContent = t("notifications");
  setText("notificationStatus", "notificationNote");
  setText("testNotificationBtn", "testNotification");

  setText("teacherBackBtn", "back");
  setText("articleEditorBottomBackBtn", "back");
  setText("teacherArticlesTabBtn", "articleEditor");
  setText("teacherStudentsTabBtn", "studentOverview");
  setText("teacherProfilesTabBtn", "profileSetup");
  setText("profileManagerEyebrow", "profileManager");
  setText("profileManagerTitle", "newProfileTitle");
  setLabelText("newProfileNameInput", "name");
  setLabelText("newProfilePinInput", "pin");
  setLabelText("newProfileRoleSelect", "profileRole");
  setOptionText("newProfileRoleSelect", "teacher", "teacherRole");
  setOptionText("newProfileRoleSelect", "student", "studentRole");
  setLabelText("newProfileNativeLanguageSelect", "nativeLanguage");
  setText("createSingleProfileBtn", "createProfile");
  setText("shareInviteLinkBtn", "shareInviteLink");
  setText("joinInviteTitle", "joinInviteTitle");
  setLabelText("joinInviteInput", "joinInviteLabel");
  setText("joinInviteBtn", "joinInvite");
  document.querySelector("#teacherOverviewCard .eyebrow").textContent = t("teacherView");
  document.querySelector("#teacherOverviewCard h2").textContent = t("studentOverview");
  document.querySelector(".article-editor .practice-heading .eyebrow").textContent = t("teacherArticles");
  document.querySelector(".article-editor .practice-heading h2").textContent = t("articleEditor");
  setText("newArticleBtn", "newArticle");
  setLabelText("articleEditorSelect", "editArticle");
  setLabelText("articleCategorySelect", "category");
  setLabelText("articleCategoryInput", "newCategory");
  setLabelText("articleCategory2Select", "category");
  setLabelText("articleCategory2Input", "newCategory");
  setLabelText("articleVisibilitySelect", "visibility");
  setOptionText("articleVisibilitySelect", "private", "privateArticle");
  setOptionText("articleVisibilitySelect", "public", "publicAfterApproval");
  setLabelText("articleApprovalStatusSelect", "approvalStatus");
  setOptionText("articleApprovalStatusSelect", "draft", "draft");
  setOptionText("articleApprovalStatusSelect", "pending", "pending");
  setOptionText("articleApprovalStatusSelect", "approved", "approved");
  setOptionText("articleApprovalStatusSelect", "rejected", "rejected");
  document.querySelector(".editor-helper .eyebrow").textContent = t("chatGptHelper");
  setLabelText("articlePromptInput", "articleTask");
  setLabelText("articleRequiredWordsMode", "requiredWordsMode");
  setLabelText("articleRequiredWordsInput", "requiredWords");
  setLabelText("articleLengthSelect", "articleLength");
  setText("copyArticlePromptBtn", "copyArticlePrompt");
  setText("copyArticleJsonPromptBtn", "copyArticleJsonPrompt");
  setText("copyImagePromptBtn", "copyImagePrompt");
  setLabelText("articleImportInput", "articleImportJson");
  setText("importArticleBtn", "importArticle");
  setText("copyTranslationPromptBtn", "copyTranslationPrompt");
  setLabelText("generatedPromptOutput", "generatedPrompt");
  setLabelText("articleTitleInput", "title");
  setLabelText("articleLevelInput", "level");
  setLabelText("articleSummaryInput", "summary");
  setLabelText("articleTextInput", "articleTextLabel");
  setLabelText("articleImageInput", "articleImage");
  setText("addSelectedInlineBtn", "addSelectedInline");
  setLabelText("articleVocabularyInput", "vocabInputLabel");
  setLabelText("articleInlineVocabularyInput", "inlineVocabInputLabel");
  setLabelText("articleQuestionsInput", "questionsInputLabel");
  setText("saveArticleBtn", "saveArticle");
  setText("deleteArticleBtn", "deleteArticle");

  document.querySelector("#startupQuiz .eyebrow").textContent = t("startupWarmup");
  setText("startupQuizTitle", "startupTitle");
  setText("skipStartupQuizBtn", "skip");
  setText("nextStartupQuizBtn", "next");

  renderCurrentProfileLabel();
  renderProfileCreationControls();
  renderCategories();
  renderLevelFilters();
  renderArticles();
  renderMobileBottomNav(getActiveViewId());
  renderArticlePracticeTabs();
}

function getStoredAuthSession() {
  try {
    return JSON.parse(localStorage.getItem(AUTH_SESSION_KEY) || "null");
  } catch {
    return null;
  }
}

function saveAuthSession(session) {
  state.authSession = session;
  if (session) {
    localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session));
  } else {
    localStorage.removeItem(AUTH_SESSION_KEY);
  }
}

function getAuthRedirectUrl() {
  if (SUPABASE_CONFIG.authRedirectUrl) {
    return SUPABASE_CONFIG.authRedirectUrl;
  }

  return `${location.origin}${location.pathname}`;
}

function getInviteTokenFromValue(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";

  try {
    const url = new URL(raw, location.href);
    return url.searchParams.get("invite") || raw;
  } catch {
    return raw;
  }
}

function getInviteUrl(token) {
  const url = new URL(getAuthRedirectUrl(), location.href);
  url.searchParams.set("invite", token);
  return url.href;
}

function captureInviteFromUrl() {
  const params = new URLSearchParams(location.search);
  const token = params.get("invite");
  if (!token) return "";

  localStorage.setItem(AUTH_PENDING_INVITE_KEY, token);
  return token;
}

function getAuthAccessToken() {
  return state.authSession?.access_token || null;
}

function getCurrentAuthUserId() {
  return state.authUser?.id || null;
}

async function supabaseAuthRequest(path, options = {}) {
  if (!state.remoteReady) return null;

  const response = await fetch(`${SUPABASE_CONFIG.url.replace(/\/$/, "")}/auth/v1/${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_CONFIG.anonKey,
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });

  if (!response.ok) {
    throw new Error(`Supabase Auth ${response.status}: ${await response.text()}`);
  }

  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

function readAuthSessionFromHash() {
  if (!location.hash.includes("access_token")) return null;

  const params = new URLSearchParams(location.hash.slice(1));
  const accessToken = params.get("access_token");
  if (!accessToken) return null;

  const expiresIn = Number(params.get("expires_in") || 3600);
  return {
    access_token: accessToken,
    refresh_token: params.get("refresh_token"),
    token_type: params.get("token_type") || "bearer",
    expires_at: Number(params.get("expires_at")) || Math.floor(Date.now() / 1000) + expiresIn
  };
}

async function refreshAuthSession() {
  const session = state.authSession || getStoredAuthSession();
  const expiresAt = Number(session.expires_at || 0);
  if (!session?.refresh_token) {
    if (expiresAt && expiresAt - 60 <= Math.floor(Date.now() / 1000)) {
      saveAuthSession(null);
      return null;
    }
    return session || null;
  }

  if (expiresAt && expiresAt - 60 > Math.floor(Date.now() / 1000)) return session;

  const refreshed = await supabaseAuthRequest("token?grant_type=refresh_token", {
    method: "POST",
    body: JSON.stringify({ refresh_token: session.refresh_token })
  });

  const nextSession = {
    access_token: refreshed.access_token,
    refresh_token: refreshed.refresh_token || session.refresh_token,
    token_type: refreshed.token_type || "bearer",
    expires_at: Math.floor(Date.now() / 1000) + Number(refreshed.expires_in || 3600)
  };
  saveAuthSession(nextSession);
  return nextSession;
}

async function getFreshAuthAccessToken() {
  try {
    const session = await refreshAuthSession();
    return session?.access_token || null;
  } catch (error) {
    console.info("Auth refresh skipped:", error.message);
    saveAuthSession(null);
    state.authUser = null;
    return null;
  }
}

async function loadAuthUser() {
  const session = await refreshAuthSession();
  if (!session?.access_token) {
    state.authUser = null;
    return null;
  }

  try {
    const user = await supabaseAuthRequest("user", {
      headers: { Authorization: `Bearer ${session.access_token}` }
    });
    state.authUser = user;
    return user;
  } catch (error) {
    console.info("Auth user lookup skipped:", error.message);
    state.authUser = null;
    return null;
  }
}

async function initAuthFromRedirect() {
  captureInviteFromUrl();
  const hashSession = readAuthSessionFromHash();
  if (hashSession) {
    saveAuthSession(hashSession);
    history.replaceState(null, "", getAuthRedirectUrl());
  } else {
    saveAuthSession(getStoredAuthSession());
  }

  if (state.authSession) {
    await loadAuthUser();
  }
}

function startGoogleAuth(action) {
  if (!state.remoteReady) {
    $("loginError").textContent = t("authUnavailable");
    return;
  }

  localStorage.setItem(AUTH_PENDING_ACTION_KEY, action);
  const params = new URLSearchParams({
    provider: "google",
    redirect_to: getAuthRedirectUrl()
  });
  location.href = `${SUPABASE_CONFIG.url.replace(/\/$/, "")}/auth/v1/authorize?${params}`;
}

async function signInWithGoogle() {
  $("loginError").textContent = t("authLinkStarted");
  startGoogleAuth("login");
}

async function sendMagicLink() {
  if (!state.remoteReady) {
    $("loginError").textContent = t("authUnavailable");
    return;
  }

  const email = $("magicEmailInput").value.trim().toLowerCase();
  if (!email || !email.includes("@")) {
    $("loginError").textContent = t("magicLinkFill");
    return;
  }

  $("loginError").textContent = t("magicLinkStarted");
  localStorage.setItem(AUTH_PENDING_ACTION_KEY, "magic-login");

  try {
    await supabaseAuthRequest(`otp?redirect_to=${encodeURIComponent(getAuthRedirectUrl())}`, {
      method: "POST",
      body: JSON.stringify({
        email,
        create_user: true,
        data: {
          full_name: email.split("@")[0]
        }
      })
    });
    $("loginError").textContent = t("magicLinkSent");
  } catch (error) {
    localStorage.removeItem(AUTH_PENDING_ACTION_KEY);
    console.error(error);
    $("loginError").textContent = t("authUnavailable");
  }
}

async function signOutGoogle() {
  const accessToken = getAuthAccessToken();
  if (accessToken) {
    try {
      await supabaseAuthRequest("logout", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: "{}"
      });
    } catch (error) {
      console.info("Auth logout skipped:", error.message);
    }
  }

  saveAuthSession(null);
  state.authUser = null;
  localStorage.removeItem(AUTH_PENDING_ACTION_KEY);
  renderAuthControls(t("authSignedOut"));
}

async function linkCurrentProfileToAuthUser(statusTarget = "authAccountStatus") {
  const target = $(statusTarget) || $("loginError");
  if (!state.currentProfile) {
    if (target) target.textContent = t("authSignInFirst");
    return false;
  }

  const user = state.authUser || await loadAuthUser();
  if (!user?.id) {
    if (target) target.textContent = state.remoteReady ? t("authLinkStarted") : t("authUnavailable");
    startGoogleAuth("link-profile");
    return false;
  }

  try {
    await linkProfileToAuthUser(state.currentProfile, user);
    renderAuthControls(t("authLinkSuccess"));
    logAppEvent("profile_google_linked", {
      profileId: state.currentProfile.id,
      email: user.email || null
    });
    return true;
  } catch (error) {
    console.error(error);
    if (target) target.textContent = error.message || t("authUnavailable");
    return false;
  }
}

async function linkProfileToAuthUser(profile, user) {
  if (!profile?.id || !user?.id) return null;

  if (state.remoteReady) {
    const previousProfiles = state.profiles.filter(item =>
      item.authUserId === user.id && item.id !== profile.id
    );
    for (const previousProfile of previousProfiles) {
      await supabaseRequest(`app_profiles?id=eq.${encodeURIComponent(previousProfile.id)}`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ auth_user_id: null })
      });
    }

    await supabaseRequest(`app_profiles?id=eq.${encodeURIComponent(profile.id)}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        auth_user_id: user.id,
        owner_auth_user_id: profile.ownerAuthUserId || user.id
      })
    });
  }

  state.profiles = state.profiles.map(item => {
    if (item.authUserId === user.id && item.id !== profile.id) {
      return { ...item, authUserId: null };
    }
    if (item.id === profile.id) {
      return {
        ...item,
        authUserId: user.id,
        ownerAuthUserId: item.ownerAuthUserId || user.id
      };
    }
    return item;
  });
  if (state.currentProfile?.id === profile.id) {
    state.currentProfile = normalizeProfile(state.profiles.find(item => item.id === profile.id));
  }
  localStorage.setItem(PROFILE_KEY, JSON.stringify(state.profiles));
  await loadProfiles();
  const linkedProfile = state.profiles.find(item => item.id === profile.id) || null;
  if (linkedProfile && state.currentProfile?.id === profile.id) state.currentProfile = linkedProfile;
  return linkedProfile;
}

async function handlePendingAuthAction() {
  const action = localStorage.getItem(AUTH_PENDING_ACTION_KEY);
  if (!action || !state.authUser) return false;

  localStorage.removeItem(AUTH_PENDING_ACTION_KEY);

  if (action === "login" || action === "magic-login") {
    const inviteToken = localStorage.getItem(AUTH_PENDING_INVITE_KEY);
    let profile = inviteToken ? await claimInvite(inviteToken) : null;
    profile = profile || state.profiles.find(item => item.authUserId === state.authUser.id);
    if (!profile && !state.profiles.length) {
      profile = await createFirstGoogleTeacherProfile();
    }
    if (!profile) {
      showLogin();
      $("loginError").textContent = t("authLoginNoProfile");
      return true;
    }

    await setCurrentProfile(profile);
    logAppEvent("profile_login", {
      profileId: profile.id,
      role: profile.role,
      source: action === "magic-login" ? "magic_link" : "google"
    });
    return true;
  }

  if (action === "link-profile") {
    await linkCurrentProfileToAuthUser();
    return true;
  }

  return false;
}

async function handlePendingInvite() {
  if (!state.authUser?.id) return false;
  const inviteToken = localStorage.getItem(AUTH_PENDING_INVITE_KEY);
  if (!inviteToken) return false;

  const profile = await claimInvite(inviteToken);
  if (!profile) return false;

  await setCurrentProfile(profile);
  logAppEvent("profile_invite_claimed", {
    profileId: profile.id,
    role: profile.role
  });
  return true;
}

function renderAuthControls(message = "") {
  const status = $("authAccountStatus");
  if (!status) return;

  const email = state.authUser?.email || state.authUser?.user_metadata?.email || "";
  const linked = Boolean(state.currentProfile?.authUserId);

  if (message) {
    status.textContent = message;
  } else if (linked && email) {
    status.textContent = formatText("authLinked", { email });
  } else if (email) {
    status.textContent = formatText("authSignedIn", { email });
  } else {
    status.textContent = t("authUnlinked");
  }

  $("linkGoogleAccountBtn")?.classList.toggle("hidden", linked && Boolean(email));
  $("signOutGoogleBtn")?.classList.toggle("hidden", !email);
}

function canCreateProfiles() {
  return Boolean(state.currentProfile);
}

function isCurrentGoogleAdmin() {
  const authUserId = getCurrentAuthUserId();
  return Boolean(
    authUserId
    && state.currentProfile?.role === "teacher"
    && (
      isAdminProfile()
      || state.currentProfile?.ownerAuthUserId === authUserId
    )
    && (
      state.currentProfile?.authUserId === authUserId
      || state.currentProfile?.ownerAuthUserId === authUserId
    )
  );
}

function canCreateTeacherProfiles() {
  return Boolean(state.currentProfile);
}

function canCreateStudentProfiles() {
  return Boolean(state.currentProfile);
}

function renderProfileCreationControls() {
  $("registerProfileBtn")?.classList.add("hidden");
  $("setupPairBtn")?.classList.add("hidden");
  $("googleLoginBtn")?.classList.add("primary-btn");
  $("googleLoginBtn")?.classList.remove("secondary-btn", "quiet");
  $("teacherProfilesTabBtn")?.classList.toggle("hidden", !canCreateProfiles());
  renderProfileManagerControls();
}

function renderProfileManagerControls() {
  const roleSelect = $("newProfileRoleSelect");
  if (!roleSelect) return;

  const canCreateTeacher = canCreateTeacherProfiles();
  const roleLabel = roleSelect.closest("label");
  roleLabel?.classList.toggle("hidden", !canCreateTeacher);
  if (!canCreateTeacher) roleSelect.value = "student";
}

function getAuthProfileName() {
  const user = state.authUser;
  const rawName = user?.user_metadata?.full_name
    || user?.user_metadata?.name
    || user?.user_metadata?.given_name
    || user?.email?.split("@")[0]
    || "Učiteľ";
  return rawName.trim() || "Učiteľ";
}

function makeRandomPin() {
  const bytes = new Uint32Array(1);
  crypto.getRandomValues(bytes);
  return String(100000 + (bytes[0] % 900000));
}

function makeInviteToken() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
}

async function createFirstGoogleTeacherProfile() {
  if (!state.authUser?.id || state.profiles.length) return null;

  const name = getAuthProfileName();
  const id = makeProfileId(name) || `teacher-${state.authUser.id.slice(0, 8)}`;
  const profile = {
    id,
    name,
    pin: makeRandomPin(),
    role: "teacher",
    teacherGroupId: id,
    nativeLanguage: DEFAULT_NATIVE_LANGUAGE,
    authUserId: state.authUser.id,
    ownerAuthUserId: state.authUser.id
  };

  state.profiles = [profile];
  await saveProfiles();
  await loadProfiles();
  return state.profiles.find(item => item.authUserId === state.authUser.id) || profile;
}

async function createAuthTeacherProfile() {
  if (!state.authUser?.id) return null;

  const baseName = getAuthProfileName();
  const baseId = makeProfileId(baseName) || `teacher-${state.authUser.id.slice(0, 8)}`;
  let id = baseId;
  let name = baseName;
  let counter = 2;
  while (state.profiles.some(profile => profile.id === id || normalizeName(profile.name) === normalizeName(name))) {
    name = `${baseName} ${counter}`;
    id = `${baseId}-${counter}`;
    counter += 1;
  }

  const profile = {
    id,
    name,
    pin: makeRandomPin(),
    role: "teacher",
    teacherGroupId: id,
    nativeLanguage: DEFAULT_NATIVE_LANGUAGE,
    authUserId: state.authUser.id,
    ownerAuthUserId: state.authUser.id
  };

  await insertProfile(profile);
  await loadProfiles();
  return state.profiles.find(item => item.authUserId === state.authUser.id) || profile;
}

async function claimInvite(tokenValue) {
  const token = getInviteTokenFromValue(tokenValue);
  if (!token || !state.authUser?.id) return null;

  await loadProfiles();
  const invited = state.profiles.find(profile =>
    profile.inviteToken === token
    && (!profile.inviteClaimedAt || profile.authUserId === state.authUser.id)
  );
  if (!invited) return null;

  const claimedAt = new Date().toISOString();
  if (state.remoteReady) {
    const previousProfiles = state.profiles.filter(profile =>
      profile.authUserId === state.authUser.id && profile.id !== invited.id
    );
    for (const profile of previousProfiles) {
      await supabaseRequest(`app_profiles?id=eq.${encodeURIComponent(profile.id)}`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ auth_user_id: null })
      });
    }
    await supabaseRequest(`app_profiles?id=eq.${encodeURIComponent(invited.id)}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        auth_user_id: state.authUser.id,
        owner_auth_user_id: invited.ownerAuthUserId || state.authUser.id,
        invite_claimed_at: claimedAt
      })
    });
  }

  state.profiles = state.profiles.map(profile => {
    if (profile.authUserId === state.authUser.id && profile.id !== invited.id) {
      return { ...profile, authUserId: null };
    }
    if (profile.id === invited.id) {
      return {
        ...profile,
        authUserId: state.authUser.id,
        ownerAuthUserId: profile.ownerAuthUserId || state.authUser.id,
        inviteClaimedAt: claimedAt
      };
    }
    return profile;
  });

  localStorage.setItem(PROFILE_KEY, JSON.stringify(state.profiles));
  if (!state.remoteReady) await saveProfiles();
  await loadProfiles();
  localStorage.removeItem(AUTH_PENDING_INVITE_KEY);
  return state.profiles.find(profile => profile.authUserId === state.authUser.id) || null;
}

async function supabaseRequest(path, options = {}) {
  if (!state.remoteReady) return null;
  const accessToken = await getFreshAuthAccessToken();

  const response = await fetch(`${SUPABASE_CONFIG.url.replace(/\/$/, "")}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_CONFIG.anonKey,
      Authorization: `Bearer ${accessToken || SUPABASE_CONFIG.anonKey}`,
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

async function supabaseStorageRequest(path, options = {}) {
  if (!state.remoteReady) return null;
  const accessToken = await getFreshAuthAccessToken();

  const response = await fetch(`${SUPABASE_CONFIG.url.replace(/\/$/, "")}/storage/v1/${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_CONFIG.anonKey,
      Authorization: `Bearer ${accessToken || SUPABASE_CONFIG.anonKey}`,
      ...(options.headers || {})
    }
  });

  if (!response.ok) {
    throw new Error(`Supabase Storage ${response.status}: ${await response.text()}`);
  }

  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

async function buildAppEvent(eventType, details = {}) {
  const deviceId = getDeviceId();
  return {
    event_type: eventType,
    profile_id: state.currentProfile?.id || null,
    article_id: details.articleId || state.currentArticle?.id || null,
    article_title: details.articleTitle || state.currentArticle?.title || null,
    device_id: deviceId,
    device_name: await getDeviceName(),
    ui_language: getUiLanguage(),
    native_language: getNativeLanguage(),
    details,
    user_agent: navigator.userAgent
  };
}

async function insertAppEvent(event) {
  await supabaseRequest("app_events", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify(event)
  });
}

async function logAppEvent(eventType, details = {}) {
  if (!state.remoteReady) return;

  const event = await buildAppEvent(eventType, details);

  try {
    await insertAppEvent(event);
  } catch (error) {
    if (error.message.includes("device_name") || error.message.includes("device_id")) {
      try {
        const { device_id, device_name, ...eventWithoutDeviceId } = event;
        await insertAppEvent(eventWithoutDeviceId);
        return;
      } catch (fallbackError) {
        console.info("Event logging skipped:", fallbackError.message);
        return;
      }
    }
    console.info("Event logging skipped:", error.message);
  }
}

function geoAppOpenedKey() {
  return `${GEO_APP_OPENED_KEY_PREFIX}:${getDeviceId()}`;
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

async function logAppOpened(details = {}) {
  if (!state.remoteReady) return;

  const key = geoAppOpenedKey();
  const today = todayKey();

  if (localStorage.getItem(key) === today) {
    logAppEvent("app_opened", details);
    return;
  }

  try {
    const event = await buildAppEvent("app_opened", details);
    const response = await fetch(`${SUPABASE_CONFIG.url.replace(/\/$/, "")}/functions/v1/log-app-opened`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_CONFIG.anonKey,
        Authorization: `Bearer ${SUPABASE_CONFIG.anonKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(event)
    });

    if (!response.ok) {
      throw new Error(`Edge Function ${response.status}: ${await response.text()}`);
    }

    localStorage.setItem(key, today);
  } catch (error) {
    console.info("Geo app_opened logging skipped:", error.message);
    logAppEvent("app_opened", details);
  }
}

async function loadProfiles() {
  state.profiles = JSON.parse(localStorage.getItem(PROFILE_KEY) || "[]");
  state.profiles = state.profiles.map(normalizeProfile);
  ensureProfileGroups();

  if (!state.remoteReady) return;

  try {
    let profiles;
    try {
      profiles = await supabaseRequest("app_profiles?select=id,name,pin,role,native_language,teacher_group_id,auth_user_id,owner_auth_user_id,invite_token,invite_claimed_at&order=role.desc,name.asc");
    } catch (error) {
      try {
        profiles = await supabaseRequest("app_profiles?select=id,name,pin,role,native_language,teacher_group_id,auth_user_id,owner_auth_user_id&order=role.desc,name.asc");
      } catch {
        profiles = await supabaseRequest("app_profiles?select=id,name,pin,role,native_language,teacher_group_id&order=role.desc,name.asc");
      }
    }
    if (profiles?.length) {
      state.profiles = profiles.map(rowToProfile);
      ensureProfileGroups();
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

async function insertProfile(profile) {
  if (state.remoteReady) {
    await supabaseRequest("app_profiles", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify(profileToRow(profile))
    });
  }

  state.profiles = [...state.profiles, profile];
  localStorage.setItem(PROFILE_KEY, JSON.stringify(state.profiles));
}

function normalizeProfile(profile) {
  return {
    ...profile,
    teacherGroupId: profile?.teacherGroupId || profile?.teacher_group_id || null,
    authUserId: profile?.authUserId || profile?.auth_user_id || null,
    ownerAuthUserId: profile?.ownerAuthUserId || profile?.owner_auth_user_id || profile?.authUserId || profile?.auth_user_id || null,
    inviteToken: profile?.inviteToken || profile?.invite_token || null,
    inviteClaimedAt: profile?.inviteClaimedAt || profile?.invite_claimed_at || null,
    nativeLanguage: isSupportedNativeLanguage(profile?.nativeLanguage)
      ? profile.nativeLanguage
      : DEFAULT_NATIVE_LANGUAGE
  };
}

function ensureProfileGroups() {
  if (!state.profiles.length) return;

  const fallbackTeacher = state.profiles.find(profile => profile.role === "teacher") || state.profiles[0];
  state.profiles = state.profiles.map(profile => ({
    ...profile,
    teacherGroupId: profile.teacherGroupId || (profile.role === "teacher" ? profile.id : fallbackTeacher.id)
  }));
}

function rowToProfile(row) {
  return normalizeProfile({
    id: row.id,
    name: row.name,
    pin: row.pin,
    role: row.role,
    nativeLanguage: row.native_language,
    teacherGroupId: row.teacher_group_id,
    authUserId: row.auth_user_id,
    ownerAuthUserId: row.owner_auth_user_id,
    inviteToken: row.invite_token,
    inviteClaimedAt: row.invite_claimed_at
  });
}

function profileToRow(profile) {
  return {
    id: profile.id,
    name: profile.name,
    pin: profile.pin,
    role: profile.role,
    teacher_group_id: profile.teacherGroupId || profile.id,
    native_language: getNativeLanguage(profile),
    auth_user_id: profile.authUserId || null,
    owner_auth_user_id: profile.ownerAuthUserId || profile.authUserId || null,
    invite_token: profile.inviteToken || null,
    invite_claimed_at: profile.inviteClaimedAt || null
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

  state.articles = localArticles.map(normalizeArticle);

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
        state.articles = remoteArticles.map(normalizeArticle);
      }
    } catch (error) {
      console.error(error);
    }
  }

  renderCategories();
  renderLevelFilters();
  renderArticles();
}

async function loadRemoteArticles() {
  const rows = await supabaseRequest("app_articles?select=*&published=eq.true&order=updated_at.desc,title.asc");
  return (rows || []).map(rowToArticle);
}

function normalizeArticle(article) {
  return {
    ...article,
    ownerProfileId: article.ownerProfileId || article.owner_profile_id || null,
    teacherGroupId: article.teacherGroupId || article.teacher_group_id || null,
    image: article.image || null,
    visibility: article.visibility || "public",
    approvalStatus: article.approvalStatus || article.approval_status || "approved"
  };
}

function canViewArticle(article, profile = state.currentProfile) {
  if (!article?.published && article?.published !== undefined) return false;
  if (article.visibility === "public" && article.approvalStatus === "approved") return true;
  if (!profile) return false;
  if (profile.role === "teacher" && (
    article.teacherGroupId === profile.teacherGroupId
    || article.ownerProfileId === profile.id
    || !article.teacherGroupId
  )) return true;
  return article.ownerProfileId === profile.id;
}

function isInCurrentTeacherGroup(profile) {
  if (!state.currentProfile || !profile) return false;
  if (state.currentProfile.role !== "teacher") return profile.id === state.currentProfile.id;
  const teacherGroupId = state.currentProfile.teacherGroupId || state.currentProfile.id;
  return profile.teacherGroupId === teacherGroupId && profile.id !== state.currentProfile.id;
}

function getVisibleArticles() {
  return state.articles.filter(article => canViewArticle(article));
}

function isAdminProfile(profile = state.currentProfile) {
  return Boolean(profile?.id && ADMIN_PROFILE_IDS.has(profile.id));
}

function canEditArticle(article, profile = state.currentProfile) {
  if (!article || !profile) return false;
  return isAdminProfile(profile) || article.ownerProfileId === profile.id;
}

function getEditableArticles() {
  if (!state.currentProfile) return [];
  return state.articles.filter(article => canEditArticle(article));
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
    ownerProfileId: row.owner_profile_id || null,
    teacherGroupId: row.teacher_group_id || null,
    visibility: row.visibility || "public",
    approvalStatus: row.approval_status || "approved",
    title: row.title,
    level: row.level,
    category: row.category,
    summary: row.summary,
    text: row.text || [],
    vocabulary: row.vocabulary || [],
    inlineVocabulary: row.inline_vocabulary || [],
    image: row.image || null,
    questions: row.questions || [],
    updatedAt: row.updated_at || null
  };
}

function articleToRow(article, options = {}) {
  const row = {
    id: article.id,
    owner_profile_id: article.ownerProfileId || null,
    teacher_group_id: article.teacherGroupId || null,
    visibility: article.visibility || "public",
    approval_status: article.approvalStatus || "approved",
    title: article.title,
    level: article.level,
    category: article.category,
    summary: article.summary,
    text: article.text || [],
    vocabulary: article.vocabulary || [],
    inline_vocabulary: getInlineVocabulary(article),
    image: article.image || null,
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

  article = normalizeArticle(article);

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
  renderLevelFilters();
  renderArticles();
  renderArticleCategoryOptionsMulti(article.category);
  renderArticleEditorList(article.id);
}

function getCategories() {
  const categories = [];
  const seen = new Set();

  getVisibleArticles().forEach(article => {
    getArticleCategoriesForFilter(article).forEach(category => {
      if (!category || seen.has(category)) return;
      seen.add(category);
      categories.push(category);
    });
  });

  return [ALL_CATEGORIES, UNREAD_CATEGORY, ...categories];
}

function getArticleLevels() {
  const levels = [];
  const seen = new Set();
  getVisibleArticles().forEach(article => {
    const level = normalizeArticleLevel(article.level);
    if (!level || seen.has(level)) return;
    seen.add(level);
    levels.push(level);
  });
  return [ALL_LEVELS, ...levels.sort((a, b) => a.localeCompare(b, "sk", { numeric: true }))];
}

function getArticleCategories() {
  return getCategories().filter(category => category !== ALL_CATEGORIES && category !== UNREAD_CATEGORY);
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
    btn.textContent = getCategoryLabel(category);
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
    btn.textContent = state.showAllCategories ? t("lessTopics") : t("moreTopics");
    btn.onclick = () => {
      state.showAllCategories = !state.showAllCategories;
      renderCategories();
    };
    root.appendChild(btn);
  }
}

function renderLevelFilters() {
  const root = $("levelFilters");
  if (!root) return;
  const levels = getArticleLevels();
  root.innerHTML = "";
  levels.forEach(level => {
    const btn = document.createElement("button");
    btn.className = "chip" + (level === state.selectedLevel ? " active" : "");
    btn.textContent = level === ALL_LEVELS ? "Všetky úrovne" : level;
    btn.onclick = () => {
      state.selectedLevel = level;
      renderLevelFilters();
      renderArticles();
    };
    root.appendChild(btn);
  });
}

function renderArticles() {
  const root = $("articleList");
  const articles = getVisibleArticles().filter(article => {
    const levelMatches = state.selectedLevel === ALL_LEVELS
      || normalizeArticleLevel(article.level) === state.selectedLevel;
    if (!levelMatches) return false;
    if (state.selectedCategory === ALL_CATEGORIES) return true;
    if (state.selectedCategory === UNREAD_CATEGORY) {
      return !state.profileData.readIds.includes(article.id);
    }
    return getArticleCategoriesForFilter(article).includes(state.selectedCategory);
  });

  root.innerHTML = "";

  articles.forEach((article, index) => {
    const isRead = state.profileData.readIds.includes(article.id);
    const showStartBadge = index === 0 && state.currentProfile?.role !== "teacher" && !isOnboardingDone("studentIntroDone");
    const image = article.image || {};
    const imageSrc = image.desktop || `images/articles/${article.id}.jpg`;
    const imageAlt = image.alt || article.title || "";
    const btn = document.createElement("button");
    btn.className = "article-card";
    btn.innerHTML = `
      <img class="article-card-thumb" src="${escapeHtml(imageSrc)}" alt="${escapeHtml(imageAlt)}" loading="lazy">
      <div class="article-card-body">
        <h4>${escapeHtml(article.title)}</h4>
        <p>${escapeHtml(article.summary)}</p>
        <div class="badges">
          <span class="badge">${escapeHtml(article.level)}</span>
          ${showStartBadge ? `<span class="badge start-badge">Začni tu</span>` : ""}
          ${getArticleCategoriesForFilter(article).map(category => `<span class="badge">${escapeHtml(getCategoryLabel(category))}</span>`).join("")}
          ${isArticleAssignedToProfile(article.id) ? `<span class="badge">Zadané</span>` : ""}
          ${article.visibility === "private" ? `<span class="badge">${escapeHtml(t("private"))}</span>` : ""}
          ${article.visibility === "public" && article.approvalStatus !== "approved" ? `<span class="badge">${escapeHtml(t("pendingApproval"))}</span>` : ""}
          ${isRead ? `<span class="badge">✓ ${escapeHtml(t("read"))}</span>` : ""}
        </div>
      </div>
    `;
    const thumb = btn.querySelector(".article-card-thumb");
    thumb.onerror = () => thumb.remove();
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
  ["sk", "ru", "pl", "hu"].forEach(language => {
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

function getAllVocabulary() {
  const seen = new Set();
  const language = getNativeLanguage();
  const locale = getNativeLanguageInfo(language).locale;
  return state.articles.flatMap(article => [
    ...(article.vocabulary || []),
    ...getInlineVocabulary(article)
  ]).filter(item => {
    const translation = getVocabularyTranslation(item, language);
    if (!item.de || !translation) return false;
    const key = `${item.de.toLocaleLowerCase("de")}|${translation.toLocaleLowerCase(locale)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function getClickedReviewVocabulary() {
  const seen = new Set();
  const language = getNativeLanguage();
  const locale = getNativeLanguageInfo(language).locale;
  return Object.entries(state.profileData.discoveredVocabulary || {}).flatMap(([articleId, items]) => {
    const article = state.articles.find(candidate => candidate.id === articleId);
    return (items || []).map(item => ({ ...item, articleTitle: article?.title || "" }));
  }).filter(item => {
    const translation = getVocabularyTranslation(item, language);
    if (!item.de || !translation) return false;
    const key = `${normalizeVocabularyKey(item.de)}|${translation.toLocaleLowerCase(locale)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function getClickedReviewOptions(correct, clickedVocabulary) {
  const language = getNativeLanguage();
  const correctTranslation = getVocabularyTranslation(correct, language);
  const optionSource = [...clickedVocabulary, ...getAllVocabulary()];
  const wrongOptions = shuffle(optionSource)
    .map(item => getVocabularyTranslation(item, language))
    .filter(option => option && option !== correctTranslation)
    .filter((option, index, options) => options.indexOf(option) === index)
    .slice(0, 3);

  return shuffle([correctTranslation, ...wrongOptions]);
}

function startClickedReviewGame() {
  const panel = $("clickedReviewPanel");
  if (!panel) return;

  const clickedVocabulary = getClickedReviewVocabulary();
  panel.classList.remove("hidden");
  $("clickedReviewMeta").textContent = clickedVocabulary.length
    ? `${formatText("clickedReviewCount", { count: clickedVocabulary.length })} ${t("clickedReviewQuestion")}`
    : t("clickedReviewEmpty");

  if (!clickedVocabulary.length) {
    state.clickedReviewGame = null;
    $("clickedReviewPrompt").textContent = "";
    $("clickedReviewOptions").innerHTML = "";
    $("clickedReviewFeedback").textContent = "";
    $("newClickedReviewBtn").classList.add("hidden");
    return;
  }

  const correct = shuffle(clickedVocabulary)[0];
  const correctTranslation = getVocabularyTranslation(correct);
  const options = getClickedReviewOptions(correct, clickedVocabulary);
  state.clickedReviewGame = { correct, correctTranslation, options, answered: false };
  $("clickedReviewPrompt").textContent = correct.de;
  $("clickedReviewOptions").innerHTML = options
    .map(option => `<button class="quiz-option" type="button" data-answer="${escapeHtml(option)}">${escapeHtml(option)}</button>`)
    .join("");
  $("clickedReviewFeedback").textContent = "";
  $("newClickedReviewBtn").classList.toggle("hidden", options.length < 2);
}

function renderClickedReview() {
  startClickedReviewGame();
}

function answerClickedReview(answer) {
  const game = state.clickedReviewGame;
  if (!game || game.answered) return;

  game.answered = true;
  const isCorrect = answer === game.correctTranslation;
  document.querySelectorAll("#clickedReviewOptions .quiz-option").forEach(button => {
    const buttonIsCorrect = button.dataset.answer === game.correctTranslation;
    const buttonIsChosen = button.dataset.answer === answer;
    button.classList.toggle("correct", buttonIsCorrect);
    button.classList.toggle("wrong", buttonIsChosen && !buttonIsCorrect);
    button.disabled = true;
  });

  $("clickedReviewFeedback").textContent = isCorrect ? t("correct") : `${t("correctIs")} ${game.correctTranslation}`;
  logPractice("clicked-vocabulary-review", {
    correct: isCorrect,
    prompt: game.correct.de,
    answer,
    expected: game.correctTranslation
  });
}

const GAMIFICATION_LEVELS = [
  { min: 0, title: "Level 1 - Začíname" },
  { min: 40, title: "Level 2 - Čitateľ" },
  { min: 100, title: "Level 3 - Lovec slovíčok" },
  { min: 200, title: "Level 4 - Samostatný čitateľ" },
  { min: 360, title: "Level 5 - Nemecký maratónec" }
];

function countCompletedTasks(data = state.profileData) {
  return Object.values(data.completedTasks || {}).reduce((sum, tasks) => sum + (Array.isArray(tasks) ? tasks.length : 0), 0);
}

function countClickedVocabulary(data = state.profileData) {
  return Object.values(data.discoveredVocabulary || {}).reduce((sum, items) => sum + (Array.isArray(items) ? items.length : 0), 0);
}

function countCompletedAssignments(data = state.profileData) {
  const readIds = new Set(data.readIds || []);
  return getAssignments(data).filter(assignment => readIds.has(assignment.articleId)).length;
}

function getGamificationStats(data = state.profileData) {
  const readCount = (data.readIds || []).length;
  const clickedCount = countClickedVocabulary(data);
  const practiceLog = data.practiceLog || [];
  const completedTasks = countCompletedTasks(data);
  const completedAssignments = countCompletedAssignments(data);
  const correctPractice = practiceLog.filter(entry => entry.correct === true).length;
  const reviewPractice = practiceLog.filter(entry => entry.type === "clicked-vocabulary-review").length;
  const points =
    readCount * 10
    + clickedCount
    + completedTasks * 2
    + completedAssignments * 15
    + correctPractice * 3
    + reviewPractice * 2;

  const levelIndex = GAMIFICATION_LEVELS.reduce((current, level, index) => points >= level.min ? index : current, 0);
  const level = GAMIFICATION_LEVELS[levelIndex];
  const nextLevel = GAMIFICATION_LEVELS[levelIndex + 1] || null;
  const levelStart = level.min;
  const levelEnd = nextLevel?.min || Math.max(points, levelStart + 1);
  const progress = nextLevel
    ? Math.min(100, Math.round(((points - levelStart) / (levelEnd - levelStart)) * 100))
    : 100;
  const badges = [
    { id: "first-article", label: "Prvý článok", earned: readCount >= 1 },
    { id: "five-articles", label: "5 článkov", earned: readCount >= 5 },
    { id: "word-hunter", label: "10 slovíčok", earned: clickedCount >= 10 },
    { id: "review-master", label: "Majster opakovania", earned: reviewPractice >= 5 },
    { id: "task-finisher", label: "Riešiteľ úloh", earned: completedTasks >= 10 },
    { id: "assignment-done", label: "Hotové zadanie", earned: completedAssignments >= 1 }
  ];

  return {
    points,
    level,
    nextLevel,
    progress,
    readCount,
    clickedCount,
    practiceCount: practiceLog.length,
    completedTasks,
    completedAssignments,
    badges,
    earnedBadges: badges.filter(badge => badge.earned)
  };
}

function renderGamification() {
  const panel = $("gamificationPanel");
  if (!panel || !state.currentProfile) return;

  const stats = getGamificationStats();
  panel.classList.remove("hidden");
  $("gamificationPoints").textContent = `${stats.points} b`;
  $("gamificationLevel").textContent = stats.level.title;
  $("gamificationNext").textContent = stats.nextLevel
    ? `${stats.nextLevel.min - stats.points} b do ďalšieho levelu`
    : "Najvyšší level";
  $("gamificationProgressFill").style.width = `${stats.progress}%`;
  $("gamificationBadges").innerHTML = stats.badges
    .map(badge => `<span class="gamification-badge ${badge.earned ? "earned" : ""}">${escapeHtml(badge.label)}</span>`)
    .join("");
}

function getPracticeVocabulary(article) {
  const seen = new Set();
  const language = getNativeLanguage();
  return [
    ...(article?.vocabulary || []),
    ...getInlineVocabulary(article),
    ...getSavedVocabulary(article)
  ]
    .filter(item => item.de && getVocabularyTranslation(item, language))
    .filter(item => getSentenceWords(item.de).length <= 2)
    .filter(item => item.de.length <= 18 && getVocabularyTranslation(item, language).length <= 32)
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
    state.profileData = await mergeRemoteProfileDataBeforeOwnSave(state.currentProfile, state.profileData);
    localStorage.setItem(profileDataKey(state.currentProfile.id), JSON.stringify(state.profileData));
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

async function mergeRemoteProfileDataBeforeOwnSave(profile, localData) {
  if (!profile || !state.remoteReady) return localData;

  try {
    const rows = await supabaseRequest(`app_profile_data?profile_id=eq.${encodeURIComponent(profile.id)}&select=data`);
    const remoteData = rows?.[0]?.data;
    if (!remoteData) return localData;

    return mergeProfileDataPreservingRemoteAssignments(localData, remoteData);
  } catch (error) {
    console.error(error);
    return localData;
  }
}

function mergeProfileDataPreservingRemoteAssignments(localData, remoteData) {
  const merged = {
    ...emptyProfileData(),
    ...(remoteData || {}),
    ...(localData || {})
  };

  merged.assignments = Array.isArray(remoteData?.assignments)
    ? getAssignments(remoteData)
    : getAssignments(localData);
  merged.seenAssignmentIds = mergeUniqueValues(localData?.seenAssignmentIds, remoteData?.seenAssignmentIds);
  merged.openedAssignmentIds = mergeUniqueValues(localData?.openedAssignmentIds, remoteData?.openedAssignmentIds);

  return merged;
}

function mergeUniqueValues(primary = [], secondary = []) {
  return [...new Set([...(Array.isArray(primary) ? primary : []), ...(Array.isArray(secondary) ? secondary : [])])];
}

async function saveProfileDataForProfile(profile, data) {
  if (!profile) return;
  localStorage.setItem(profileDataKey(profile.id), JSON.stringify(data));

  if (!state.remoteReady) return;

  await supabaseRequest("app_profile_data?on_conflict=profile_id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify({
      profile_id: profile.id,
      data,
      updated_at: new Date().toISOString()
    })
  });
}

function getAssignments(data = state.profileData) {
  return Array.isArray(data?.assignments) ? data.assignments : [];
}

function getAssignmentKey(assignment) {
  return `${assignment.articleId}:${assignment.assignedAt || ""}`;
}

function isArticleAssignedToProfile(articleId, data = state.profileData) {
  return getAssignments(data).some(assignment => assignment.articleId === articleId);
}

function getAssignmentForArticle(articleId, data = state.profileData) {
  return getAssignments(data).find(assignment => assignment.articleId === articleId) || null;
}

function getTeacherStudents() {
  return state.profiles.filter(profile => profile.role === "student" && isInCurrentTeacherGroup(profile));
}

function getArticleForAssignment(assignment) {
  return state.articles.find(article => article.id === assignment.articleId) || null;
}

function getAssignmentStatus(assignment, data = state.profileData) {
  const article = getArticleForAssignment(assignment);
  if ((data.readIds || []).includes(assignment.articleId)) return "Hotové";
  if (article && getArticleTaskProgress(article, data).done > 0) return "Rozpracované";
  if ((data.openedAssignmentIds || []).includes(getAssignmentKey(assignment))) return "Otvorené";
  return "Nové";
}

function getAssignmentStatusInfo(assignment, data = state.profileData) {
  if (!assignment) return { key: "not-assigned", label: "Nezadané", detail: "", done: 0, total: 0 };

  const article = getArticleForAssignment(assignment);
  if (!article) {
    return { key: "missing", label: "Článok chýba", detail: "Zadanie odkazuje na článok, ktorý už nie je dostupný.", done: 0, total: 0 };
  }

  const progress = getArticleTaskProgress(article, data);
  const isRead = (data.readIds || []).includes(assignment.articleId);
  const isOpened = (data.openedAssignmentIds || []).includes(getAssignmentKey(assignment));
  if (isRead) return { key: "completed", label: "Hotové", detail: `Úlohy ${progress.done}/${progress.total}`, ...progress };
  if (progress.done > 0) return { key: "in-progress", label: "Rozpracované", detail: `Úlohy ${progress.done}/${progress.total}`, ...progress };
  if (isOpened) return { key: "opened", label: "Otvorené", detail: "Článok otvorený, úlohy ešte nezačaté.", ...progress };
  return { key: "new", label: "Nové", detail: "Zatiaľ neotvorené.", ...progress };
}

function getArticleAssignmentStatusInfo(article, data = state.profileData) {
  const assignment = getAssignmentForArticle(article?.id, data);
  if (assignment) return getAssignmentStatusInfo(assignment, data);

  const progress = article ? getArticleTaskProgress(article, data) : { done: 0, total: 0 };
  if (article && (data.readIds || []).includes(article.id)) {
    return { key: "completed", label: "Prečítané mimo zadania", detail: `Úlohy ${progress.done}/${progress.total}`, ...progress };
  }
  if (progress.done > 0) {
    return { key: "in-progress", label: "Rozpracované mimo zadania", detail: `Úlohy ${progress.done}/${progress.total}`, ...progress };
  }
  return { key: "not-assigned", label: "Nezadané", detail: "", ...progress };
}

async function markAssignmentSeen(assignment, opened = false) {
  if (!assignment || !state.currentProfile) return;
  const key = getAssignmentKey(assignment);
  const seen = new Set(state.profileData.seenAssignmentIds || []);
  const openedSet = new Set(state.profileData.openedAssignmentIds || []);
  seen.add(key);
  if (opened) openedSet.add(key);
  state.profileData.seenAssignmentIds = [...seen];
  state.profileData.openedAssignmentIds = [...openedSet];
  await saveProfileData();
}

function getSortedAssignments() {
  return getAssignments()
    .map(assignment => ({ ...assignment, article: getArticleForAssignment(assignment) }))
    .sort((a, b) => {
      const aDone = (state.profileData.readIds || []).includes(a.articleId);
      const bDone = (state.profileData.readIds || []).includes(b.articleId);
      if (aDone !== bDone) return aDone ? 1 : -1;
      return String(b.assignedAt || "").localeCompare(String(a.assignedAt || ""));
    });
}

function hasUnseenAssignments() {
  const seen = new Set(state.profileData.seenAssignmentIds || []);
  return getSortedAssignments().some(assignment => !seen.has(getAssignmentKey(assignment)));
}

function renderAssignmentInbox() {
  const panel = $("assignmentInbox");
  const list = $("assignmentInboxList");
  if (!panel || !list) return;

  const assignments = getSortedAssignments();
  panel.classList.toggle("hidden", !assignments.length);
  if (!assignments.length) {
    list.innerHTML = "";
    return;
  }

  list.innerHTML = assignments.map(assignment => {
    const article = assignment.article;
    const status = getAssignmentStatus(assignment);
    const statusInfo = getAssignmentStatusInfo(assignment);
    const canOpen = Boolean(article);
    return `
      <article class="assignment-inbox-card ${status === "Hotové" ? "done" : ""}">
        <div>
          <span class="dashboard-pill status-${escapeHtml(statusInfo.key)}">${escapeHtml(statusInfo.label)}</span>
          <h4>${escapeHtml(article?.title || assignment.articleTitle || assignment.articleId)}</h4>
          <p class="muted">${assignment.assignedAt ? `Zadané ${escapeHtml(formatDateTime(assignment.assignedAt))}` : "Zadaný článok"}</p>
        </div>
        <button class="secondary-btn compact" type="button" data-assignment-open="${escapeHtml(getAssignmentKey(assignment))}" ${canOpen ? "" : "disabled"}>Otvoriť</button>
      </article>
    `;
  }).join("");
}

function renderAssignmentNotice() {
  const notice = $("assignmentNotice");
  if (!notice) return;

  const seen = new Set(state.profileData.seenAssignmentIds || []);
  const assignment = getSortedAssignments().find(item => !seen.has(getAssignmentKey(item)));
  notice.classList.toggle("hidden", !assignment);
  if (!assignment) {
    notice.innerHTML = "";
    return;
  }

  const title = assignment.article?.title || assignment.articleTitle || assignment.articleId;
  notice.innerHTML = `
    <div>
      <p class="eyebrow">Nové zadanie</p>
      <h3>${escapeHtml(title)}</h3>
      <p class="muted">Učiteľ ti zadal nový článok.</p>
    </div>
    <div class="assignment-notice-actions">
      <button class="secondary-btn compact" type="button" data-assignment-open="${escapeHtml(getAssignmentKey(assignment))}" ${assignment.article ? "" : "disabled"}>Otvoriť</button>
      <button class="text-btn" type="button" data-assignment-dismiss="${escapeHtml(getAssignmentKey(assignment))}">Zavrieť</button>
    </div>
  `;
}

function renderHomeAssignments() {
  renderAssignmentNotice();
  renderAssignmentInbox();
}

async function openAssignmentByKey(key) {
  const assignment = getAssignments().find(item => getAssignmentKey(item) === key);
  if (!assignment) return;
  await markAssignmentSeen(assignment, true);
  renderHomeAssignments();
  await openArticle(assignment.articleId);
}

async function dismissAssignmentNotice(key) {
  const assignment = getAssignments().find(item => getAssignmentKey(item) === key);
  if (!assignment) return;
  await markAssignmentSeen(assignment, false);
  renderHomeAssignments();
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
  renderGamification();
}

function getQuestionTaskId(index) {
  return `question:${index}`;
}

function getTaskDefinitions(article) {
  if (!article) return [];

  const tasks = (article.questions || []).map((question, index) => ({
    id: getQuestionTaskId(index),
    label: `${t("questions")} ${index + 1}`,
    section: t("questions")
  }));

  if (hasSentenceOrderTask(article)) tasks.push({ id: "sentence-order", label: t("sentenceOrder"), section: t("game") });
  if (getVisibleVocabulary(article).length) tasks.push({ id: "match-pairs", label: t("matchPairs"), section: t("game") });
  if (getPracticeVocabulary(article).length >= 4) tasks.push({ id: "vocab-choice", label: t("vocabChoice"), section: t("game") });
  if (hasClozeTask(article)) tasks.push({ id: "cloze-word", label: t("cloze"), section: t("game") });
  if (hasMistakeTask(article)) tasks.push({ id: "find-mistake", label: t("mistake"), section: t("game") });
  if (getWordSearchVocabulary(article).length >= 3) tasks.push({ id: "word-search", label: t("wordSearch"), section: t("game") });

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
  renderGamification();
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
      <strong>${allDone ? escapeHtml(t("taskAllDone")) : escapeHtml(t("taskDone"))}</strong>
      <span>${progress.done}/${progress.total}</span>
    </div>
  `;
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
    : `<span class="muted">${escapeHtml(t("tapWords"))}</span>`;
  $("sentenceWordBank").innerHTML = game.bank
    .map(item => `<button class="word-chip" type="button" data-word-id="${escapeHtml(item.id)}">${escapeHtml(item.word)}</button>`)
    .join("");

  if (!game.solution.length) {
    $("sentenceGameFeedback").textContent = t("sentenceNoTask");
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
    ? t("sentenceCorrect")
    : t("sentenceRetry");
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
    $("matchGameFeedback").textContent = t("matchNoVocab");
  } else if (game.matchedIds.length === game.cards.length) {
    $("matchGameFeedback").textContent = t("matchDone");
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
    $("matchGameFeedback").textContent = t("noPair");
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
    $("vocabChoiceFeedback").textContent = t("vocabNeed4");
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
  $("vocabChoiceFeedback").textContent = isCorrect ? t("correct") : `${t("correctIs")} ${game.correctTranslation}`;
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
    $("clozeFeedback").textContent = t("clozeNeedMore");
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
  $("clozeFeedback").textContent = isCorrect ? t("correct") : `${t("correctIs")} ${game.answer}`;
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
    $("mistakeFeedback").textContent = t("mistakeNeedMore");
    return;
  }

  const wrongWord = shuffle(vocabulary)[0].de;
  const sentence = candidate.sentence.replace(candidate.pattern, (match, prefix) => `${prefix}${wrongWord}`);
  const options = shuffle([
    candidate.item.de,
    ...shuffle(vocabulary.filter(item => item.de !== wrongWord && item.de !== candidate.item.de)).slice(0, 4).map(item => item.de)
  ]);
  state.mistakeGame = { wrongWord, correctWord: candidate.item.de, sentence, options, answered: false };
  $("mistakeSentence").textContent = sentence;
  $("mistakeOptions").innerHTML = options
    .map(option => `<button class="quiz-option" type="button" data-answer="${escapeHtml(option)}">${escapeHtml(option)}</button>`)
    .join("");
  $("mistakeFeedback").textContent = "";
}

function answerMistakeGame(answer) {
  const game = state.mistakeGame;
  if (!game || game.answered) return;
  game.answered = true;
  document.querySelectorAll("#mistakeOptions .quiz-option").forEach(button => {
    const isCorrect = button.dataset.answer === game.correctWord;
    const isChosen = button.dataset.answer === answer;
    button.classList.toggle("correct", isCorrect);
    button.classList.toggle("wrong", isChosen && !isCorrect);
    button.disabled = true;
  });
  const isCorrect = answer === game.correctWord;
  $("mistakeFeedback").textContent = isCorrect
    ? `${t("mistakeCorrect")} ${game.correctWord}`
    : t("mistakeWrong").replace("{wrong}", game.wrongWord).replace("{correct}", game.correctWord);
  logPractice("find-mistake", { correct: isCorrect, answer, expected: game.correctWord, wrongWord: game.wrongWord });
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
    $("wordSearchFeedback").textContent = t("wordSearchNeed3");
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
    ? t("wordSearchDone")
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

function showHome() {
  stopReading();
  state.currentArticle = null;
  showView("homeView");
  renderHomeAssignments();
  renderGamification();
  renderClickedReview();
  renderCategories();
  renderLevelFilters();
  renderArticles();
  renderOnboarding();
  scheduleInstallPrompt();
  scrollToPageTop();
}

function showSettings() {
  showView("settingsView");
}

function showClickedReviewFromNav() {
  showHome();
  startClickedReviewGame();
  setMobileNavButton("mobileNavHomeBtn", t("articles"), false);
  setMobileNavButton("mobileNavReviewBtn", t("clickedReviewEyebrow"), true);
  requestAnimationFrame(() => {
    $("clickedReviewPanel")?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

async function shareApp() {
  const shareData = {
    title: t("appTitle"),
    text: t("shareAppText"),
    url: window.location.href
  };

  try {
    if (navigator.share) {
      await navigator.share(shareData);
      return;
    }

    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(shareData.url);
      alert(t("shareCopied"));
      return;
    }

    throw new Error("Share unavailable");
  } catch (error) {
    if (error?.name === "AbortError") return;
    alert(t("shareFailed"));
  }
}

async function shareLastInviteLink() {
  const url = state.lastInviteUrl;
  if (!url) return;

  const shareData = {
    title: t("appTitle"),
    text: t("inviteShareText"),
    url
  };

  try {
    if (navigator.share) {
      await navigator.share(shareData);
    } else if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(url);
      $("newProfileStatus").textContent = t("inviteCopied");
    }
  } catch (error) {
    if (error?.name !== "AbortError") {
      $("newProfileStatus").textContent = url;
    }
  }
}

async function joinInviteFromSettings() {
  const status = $("joinInviteStatus");
  const token = getInviteTokenFromValue($("joinInviteInput").value);
  if (!token) {
    status.textContent = t("inviteMissing");
    return;
  }

  if (!state.authUser?.id) {
    localStorage.setItem(AUTH_PENDING_INVITE_KEY, token);
    status.textContent = t("authSignInFirst");
    return;
  }

  const profile = await claimInvite(token);
  if (!profile) {
    status.textContent = t("inviteInvalid");
    return;
  }

  $("joinInviteInput").value = "";
  status.textContent = t("inviteClaimed");
  await setCurrentProfile(profile);
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
  renderNativeLanguageControls();
  renderRoleControls();
  renderCurrentProfileLabel();
  renderAuthControls();
  renderProfileCreationControls();
  updateStaticTexts();
  $("settingsBtn").classList.remove("hidden");
  $("teacherBtn").classList.remove("hidden");
  $("shareAppBtn").classList.remove("hidden");
  showHome();
  if (!hasUnseenAssignments()) showStartupQuiz();
}

function showLogin() {
  stopReading();
  $("settingsBtn").classList.add("hidden");
  $("teacherBtn").classList.add("hidden");
  $("shareAppBtn").classList.add("hidden");
  renderNativeLanguageControls();
  updateStaticTexts();
  renderProfileCreationControls();
  showView("loginView");
}

function showSetup() {
  if (state.profiles.length && !canCreateProfiles()) {
    showLogin();
    return;
  }
  stopReading();
  $("settingsBtn").classList.toggle("hidden", !state.currentProfile);
  $("teacherBtn").classList.toggle("hidden", !state.currentProfile);
  $("shareAppBtn").classList.toggle("hidden", !state.currentProfile);
  renderNativeLanguageControls();
  updateStaticTexts();
  showView("setupView");
}

async function login() {
  const name = normalizeName($("loginNameInput").value);
  const pin = $("loginPinInput").value.trim();

  if (!name || !pin) {
    $("loginError").textContent = t("loginFill");
    logAppEvent("login_failed", {
      attemptedName: name,
      reason: "missing_fields"
    });
    return;
  }

  const profile = state.profiles.find(item => normalizeName(item.name) === name && item.pin === pin);

  if (!profile) {
    $("loginError").textContent = t("loginMismatch");
    logAppEvent("login_failed", {
      attemptedName: name,
      reason: "wrong_credentials"
    });
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
  logAppEvent("login_success", {
    profileId: profile.id,
    role: profile.role,
    nativeLanguage: profile.nativeLanguage
  });
  logAppEvent("profile_selected", {
    profileId: profile.id,
    role: profile.role,
    source: "login"
  });
  logAppEvent("profile_login", {
    profileId: profile.id,
    role: profile.role,
    nativeLanguage: profile.nativeLanguage
  });
}

async function registerProfileFromLogin() {
  $("loginError").textContent = t("registrationClosed");
}

async function createProfiles() {
  if (state.profiles.length && !canCreateProfiles()) {
    $("setupError").textContent = t("authSignInFirst");
    return;
  }

  const teacherName = $("teacherNameInput").value.trim();
  const teacherPin = makeRandomPin();
  const teacherRole = $("teacherRoleSelect").value;
  const teacherNativeLanguage = $("teacherNativeLanguageSelect").value || DEFAULT_NATIVE_LANGUAGE;
  const studentName = $("studentNameInput").value.trim();
  const studentPin = makeRandomPin();
  const studentRole = $("studentRoleSelect").value;
  const studentNativeLanguage = $("setupNativeLanguageSelect").value || DEFAULT_NATIVE_LANGUAGE;

  if (!teacherName || !studentName) {
    $("setupError").textContent = t("setupFill");
    return;
  }

  if (normalizeName(teacherName) === normalizeName(studentName)) {
    $("setupError").textContent = t("setupDifferentNames");
    return;
  }

  if (teacherRole === studentRole) {
    $("setupError").textContent = t("setupDifferentRoles");
    return;
  }

  if (state.profiles.length && (teacherRole === "teacher" || studentRole === "teacher") && !canCreateTeacherProfiles()) {
    $("setupError").textContent = t("teacherCreationRestricted");
    return;
  }

  const existingNames = new Set(state.profiles.map(profile => normalizeName(profile.name)));
  if (existingNames.has(normalizeName(teacherName)) || existingNames.has(normalizeName(studentName))) {
    $("setupError").textContent = t("setupNameExists");
    return;
  }

  const firstProfileId = makeProfileId(teacherName);
  const secondProfileId = makeProfileId(studentName);
  const groupId = teacherRole === "teacher" ? firstProfileId : secondProfileId;
  const ownerAuthUserId = getCurrentAuthUserId() || state.currentProfile?.ownerAuthUserId || state.currentProfile?.authUserId || null;
  const newProfiles = [
    { id: firstProfileId, name: teacherName, pin: teacherPin, role: teacherRole, teacherGroupId: groupId, nativeLanguage: teacherNativeLanguage, ownerAuthUserId },
    { id: secondProfileId, name: studentName, pin: studentPin, role: studentRole, teacherGroupId: groupId, nativeLanguage: studentNativeLanguage, ownerAuthUserId }
  ];
  state.profiles = [...state.profiles, ...newProfiles];
  await saveProfiles();
  $("setupError").textContent = "";
  if (state.currentProfile) {
    await loadProfiles();
    renderNativeLanguageControls();
    renderProfileCreationControls();
    await showTeacherView();
  } else {
    await setCurrentProfile(newProfiles.find(profile => profile.role === "teacher") || newProfiles[0]);
  }
  newProfiles.forEach(profile => {
    logAppEvent("profile_created", {
      profileId: profile.id,
      role: profile.role,
      nativeLanguage: profile.nativeLanguage,
      source: "pair_setup"
    });
  });
}

async function createSingleProfile() {
  if (!canCreateProfiles()) {
    $("newProfileStatus").textContent = t("authSignInFirst");
    return;
  }

  const name = $("newProfileNameInput").value.trim();
  const pin = makeRandomPin();
  const nativeLanguage = $("newProfileNativeLanguageSelect").value || DEFAULT_NATIVE_LANGUAGE;
  const role = $("newProfileRoleSelect").value;

  if (!name) {
    $("newProfileStatus").textContent = t("loginFill");
    return;
  }

  if (role === "teacher" && !canCreateTeacherProfiles()) {
    $("newProfileStatus").textContent = t("teacherCreationRestricted");
    return;
  }

  if (state.profiles.some(item => normalizeName(item.name) === normalizeName(name))) {
    $("newProfileStatus").textContent = t("profileExists");
    return;
  }

  const id = makeProfileId(name);
  const ownerAuthUserId = getCurrentAuthUserId()
    || state.currentProfile?.ownerAuthUserId
    || state.currentProfile?.authUserId
    || null;
  const teacherGroupId = state.currentProfile?.teacherGroupId || state.currentProfile?.id || id;
  const inviteToken = makeInviteToken();
  const profile = {
    id,
    name,
    pin,
    role,
    teacherGroupId,
    nativeLanguage,
    ownerAuthUserId,
    inviteToken
  };

  try {
    await insertProfile(profile);
    await loadProfiles();
    $("newProfileNameInput").value = "";
    $("newProfilePinInput").value = "";
    $("newProfileRoleSelect").value = "student";
    const inviteUrl = getInviteUrl(inviteToken);
    state.lastInviteUrl = inviteUrl;
    $("shareInviteLinkBtn")?.classList.remove("hidden");
    $("newProfileStatus").textContent = formatText("inviteCreated", { url: inviteUrl });
    renderProfileManagerControls();
    logAppEvent("profile_created", {
      profileId: profile.id,
      role: profile.role,
      nativeLanguage: profile.nativeLanguage,
      source: "profile_manager"
    });
  } catch (error) {
    $("newProfileStatus").textContent = error.message;
  }
}

function logout() {
  stopReading();
  state.currentProfile = null;
  state.profileData = emptyProfileData();
  state.currentArticle = null;
  localStorage.removeItem(CURRENT_PROFILE_KEY);
  $("loginNameInput").value = "";
  $("loginPinInput").value = "";
  showLogin();
}

function setTeacherPanel(panel) {
  const canShowOverview = Boolean(state.currentProfile);
  const canEditArticles = state.currentProfile?.role === "teacher";
  const activePanel = canEditArticles || panel !== "articles" ? panel : "students";
  const showStudents = canShowOverview && activePanel === "students";
  const showProfiles = canCreateProfiles() && activePanel === "profiles";
  $("teacherStudentsTabBtn").textContent = state.currentProfile?.role === "teacher" ? t("studentOverview") : t("myProgress");
  document.querySelector("#teacherOverviewCard h2").textContent = state.currentProfile?.role === "teacher" ? t("studentOverview") : t("myProgress");
  $("articleEditorCard").classList.toggle("hidden", !canEditArticles || showStudents || showProfiles);
  $("teacherOverviewCard").classList.toggle("hidden", !showStudents);
  $("profileManagerCard").classList.toggle("hidden", !showProfiles);
  $("teacherArticlesTabBtn").classList.toggle("hidden", !canEditArticles);
  $("teacherStudentsTabBtn").classList.toggle("hidden", !canShowOverview);
  $("teacherProfilesTabBtn").classList.toggle("hidden", !canCreateProfiles());
  $("teacherArticlesTabBtn").classList.toggle("active", canEditArticles && !showStudents && !showProfiles);
  $("teacherStudentsTabBtn").classList.toggle("active", showStudents);
  $("teacherProfilesTabBtn").classList.toggle("active", showProfiles);
  $("teacherArticlesTabBtn").classList.toggle("quiet", showStudents || showProfiles || !canEditArticles);
  $("teacherStudentsTabBtn").classList.toggle("quiet", !showStudents);
  $("teacherProfilesTabBtn").classList.toggle("quiet", !showProfiles);
  if (showProfiles) renderProfileManagerControls();
  renderOnboarding();
}

async function showTeacherView() {
  if (!state.currentProfile) return;
  renderArticleEditorList();
  if (state.currentProfile.role === "teacher") {
    setTeacherPanel("articles");
  } else {
    await renderTeacherOverview();
    setTeacherPanel("students");
  }
  showView("teacherView");
  renderOnboarding();
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
    "clicked-vocabulary-review": "Opakovanie kliknutých slovíčok",
    "true-false": "Pravda/nepravda",
    "vocab-choice": "4 možnosti",
    "cloze-word": "Doplň slovo",
    "find-mistake": "Nahraď chybné slovo",
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
  const loginLanguage = state.currentProfile
    ? profileLanguage
    : isSupportedNativeLanguage(state.preLoginLanguage) ? state.preLoginLanguage : DEFAULT_NATIVE_LANGUAGE;
  renderNativeLanguageSelect("teacherNativeLanguageSelect", DEFAULT_NATIVE_LANGUAGE);
  renderNativeLanguageSelect("setupNativeLanguageSelect", DEFAULT_NATIVE_LANGUAGE);
  renderNativeLanguageSelect("newProfileNativeLanguageSelect", DEFAULT_NATIVE_LANGUAGE);
  renderNativeLanguageSelect("loginNativeLanguageSelect", loginLanguage);
  renderNativeLanguageSelect("settingsNativeLanguageSelect", profileLanguage);
}

function renderRoleControls() {
  if ($("settingsRoleSelect") && state.currentProfile) {
    $("settingsRoleSelect").value = state.currentProfile.role;
  }
}

function renderCurrentProfileLabel() {
  const profile = state.currentProfile;
  if (!profile) return;

  $("currentProfileLabel").textContent = `${profile.name} • ${profile.role === "teacher" ? t("teacher") : t("student")}${state.remoteReady ? ` • ${t("online")}` : ` • ${t("local")}`}`;
}

async function updateCurrentProfileNativeLanguage(language) {
  if (!state.currentProfile || !isSupportedNativeLanguage(language)) return;

  state.currentProfile.nativeLanguage = language;
  state.profiles = state.profiles.map(profile =>
    profile.id === state.currentProfile.id ? { ...profile, nativeLanguage: language } : profile
  );
  await saveProfiles();
  renderNativeLanguageControls();
  updateStaticTexts();

  if (state.currentArticle) {
    renderVocabulary();
    renderArticleText(state.currentArticle);
    renderQuestions(state.currentArticle);
    renderArticleTaskProgress();
    startMatchGame();
    startVocabChoiceGame();
    startWordSearchGame();
  } else {
    renderArticles();
  }
}

async function updateCurrentProfileRole(role) {
  if (!state.currentProfile || !["teacher", "student"].includes(role)) return;

  state.currentProfile.role = role;
  if (role === "teacher" && !state.currentProfile.teacherGroupId) {
    state.currentProfile.teacherGroupId = state.currentProfile.id;
  }
  state.profiles = state.profiles.map(profile =>
    profile.id === state.currentProfile.id ? { ...profile, role, teacherGroupId: state.currentProfile.teacherGroupId } : profile
  );
  await saveProfiles();
  renderRoleControls();
  renderCurrentProfileLabel();
  $("teacherBtn").classList.remove("hidden");
  renderMobileBottomNav(getActiveViewId());
  renderArticles();
}

function linesToList(value) {
  return value.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
}

function parseVocabularyJson(value, allowDraft = false) {
  const text = stripJsonCodeFence(value);
  if (!text || (!text.startsWith("[") && !text.startsWith("{"))) return null;

  const parsed = JSON.parse(text);
  const items = Array.isArray(parsed) ? parsed : [parsed];
  return items.map(item => ({
    de: (item.de || "").trim(),
    base: (item.base || item.lemma || item.basic || item.grundform || "").trim(),
    sk: (item.sk || "").trim(),
    ru: (item.ru || "").trim(),
    pl: (item.pl || "").trim(),
    hu: (item.hu || "").trim()
  })).filter(item => item.de && (allowDraft || item.sk || item.ru || item.pl || item.hu));
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
    ["sk", "ru", "pl", "hu"].filter(code => item[code]).length > (item[language] ? 1 : 0)
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
    const translations = Object.fromEntries(["sk", "ru", "pl", "hu"]
      .filter(code => item[code])
      .map(code => [code, item[code]]));
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
    const translations = Object.fromEntries(["sk", "ru", "pl", "hu"]
      .filter(code => item[code])
      .map(code => [code, item[code]]));
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
    base: (item.base || item.lemma || item.basic || item.grundform || "").trim(),
    sk: (item.sk || "").trim(),
    ru: (item.ru || "").trim(),
    pl: (item.pl || "").trim(),
    hu: (item.hu || "").trim()
  };
  return normalized.de && (normalized.sk || normalized.ru || normalized.pl || normalized.hu)
    ? normalized
    : null;
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

  const article = {
    id: (source.id || makeArticleId(title)).trim(),
    title,
    level: (source.level || $("articleLevelInput").value || "A2-B1").trim(),
    category: (source.category || getArticleEditorCategory()).trim(),
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

function renderArticleInlineHighlightPreview() {
  const wrap = $("articleInlineHighlightPreview");
  if (!wrap) return;

  const paragraphs = linesToList($("articleTextInput").value);
  const phrases = getAllEditorInlineVocabularyItems()
    .map(item => item.de)
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);

  wrap.classList.toggle("hidden", !paragraphs.length || !phrases.length);
  if (!paragraphs.length || !phrases.length) {
    wrap.innerHTML = "";
    return;
  }

  const pattern = new RegExp(`(^|[^\\p{L}\\p{N}_])(${phrases.map(escapeRegExp).join("|")})(?=$|[^\\p{L}\\p{N}_])`, "giu");
  wrap.innerHTML = paragraphs.map(paragraph => {
    const html = escapeHtml(paragraph).replace(pattern, (match, prefix, phrase) =>
      `${prefix}<span class="editor-inline-hit">${phrase}</span>`
    );
    return `<p>${html}</p>`;
  }).join("");
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
  return [
    "",
    "JSON schéma:",
    "{",
    "  \"title\": \"nemecký názov článku\",",
    `  \"level\": \"${level}\",`,
    "  \"category\": \"kategória alebo téma\",",
    "  \"summary\": \"krátky nemecký popis článku\",",
    "  \"text\": [\"odsek 1\", \"odsek 2\", \"odsek 3\", \"odsek 4\"],",
    "  \"vocabulary\": [",
    "    {\"de\":\"slovo alebo fráza z textu\",\"base\":\"základný tvar\",\"sk\":\"slovenský preklad\",\"ru\":\"ruský preklad\",\"pl\":\"poľský preklad\",\"hu\":\"maďarský preklad\"}",
    "  ],",
    "  \"inlineVocabulary\": [",
    "    {\"de\":\"presný súvislý úsek skopírovaný z textu článku\",\"base\":\"základný tvar\",\"sk\":\"slovenský preklad\",\"ru\":\"ruský preklad\",\"pl\":\"poľský preklad\",\"hu\":\"maďarský preklad\"}",
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
    "Všetky položky vocabulary aj inlineVocabulary musia mať kľúče de, base, sk, ru, pl, hu.",
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
    .filter(item => item.sk || item.ru || item.pl || item.hu)
    .map(item => normalizeVocabularyKey(item.de)));
  const words = (state.editorManualInlineVocabulary || [])
    .filter(item => !translatedKeys.has(normalizeVocabularyKey(item.de)));
  const seen = new Set();
  const missing = words
    .filter(item => !item.sk || !item.ru || !item.pl || !item.hu)
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
    '<option value="">-- nový článok --</option>',
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
    '<option value="">-- vyber kategóriu --</option>',
    ...categories.map(category => `<option value="${escapeHtml(category)}">${escapeHtml(getCategoryLabel(category))}</option>`),
    `<option value="${NEW_CATEGORY_VALUE}">+ nová kategória</option>`
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
    '<option value="">-- vyber kategoriu --</option>',
    ...categories.map(category => `<option value="${escapeHtml(category)}">${escapeHtml(getCategoryLabel(category))}</option>`),
    `<option value="${NEW_CATEGORY_VALUE}">+ nova kategoria</option>`
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
    .filter(item => item.sk || item.ru || item.pl || item.hu);
  const article = {
    id,
    ownerProfileId: existingArticle?.ownerProfileId || state.currentProfile?.id || null,
    teacherGroupId: existingArticle?.teacherGroupId || state.currentProfile?.teacherGroupId || state.currentProfile?.id || null,
    visibility,
    approvalStatus,
    title,
    level: $("articleLevelInput").value.trim(),
    category: getArticleEditorCategory(),
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

async function renderTeacherOverviewLegacy() {
  const students = state.profiles.filter(profile => profile.role === "student" && isInCurrentTeacherGroup(profile));
  const root = $("teacherOverview");
  const visibleArticles = state.articles.filter(article => canViewArticle(article, state.currentProfile));
  const currentGroupId = state.currentProfile?.teacherGroupId || state.currentProfile?.id || "";
  const isAdmin = isAdminProfile();
  const roleLabel = profile => profile.role === "teacher" ? t("teacherRole") : t("studentRole");
  const profileTitle = profile => `${profile.name} • ${roleLabel(profile)} • skupina: ${profile.teacherGroupId || profile.id}`;
  const buildSection = async (profile, title) => {
    const data = profile.id === state.currentProfile?.id
      ? state.profileData
      : await getProfileData(profile);
    const readArticles = data.readIds
      .map(id => state.articles.find(article => article.id === id)?.title || id);
    const clickedCount = Object.values(data.discoveredVocabulary || {}).reduce((sum, items) => sum + items.length, 0);
    const practiceLog = data.practiceLog || [];
    const articleProgress = visibleArticles.map(article => {
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
        <h3>${escapeHtml(title)}</h3>
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
  };

  const sections = [
    await buildSection(state.currentProfile, t("myProgress")),
    ...(await Promise.all(students.map(student => buildSection(student, student.name))))
  ];

  if (isAdmin) {
    const otherProfiles = state.profiles
      .filter(profile => profile.id !== state.currentProfile.id)
      .filter(profile => (profile.teacherGroupId || profile.id) !== currentGroupId)
      .sort((a, b) =>
        String(a.teacherGroupId || a.id).localeCompare(String(b.teacherGroupId || b.id), "sk")
        || a.role.localeCompare(b.role, "sk")
        || a.name.localeCompare(b.name, "sk")
      );

    if (otherProfiles.length) {
      sections.push(`
        <section class="overview-section">
          <h3>Ostatné profily mimo tvojej skupiny</h3>
          <p class="muted">Admin pohľad na učiteľov a žiakov, ktorí nie sú v tvojej učiteľskej skupine.</p>
        </section>
      `);
      sections.push(...await Promise.all(otherProfiles.map(profile => buildSection(profile, profileTitle(profile)))));
    }
  }

  root.innerHTML = sections.join("") || `<p class="muted">${escapeHtml(t("noStudentsInGroup"))}</p>`;
}

async function renderTeacherOverview() {
  const root = $("teacherOverview");
  const visibleArticles = state.articles.filter(article => canViewArticle(article, state.currentProfile));
  const currentGroupId = state.currentProfile?.teacherGroupId || state.currentProfile?.id || "";
  const isAdmin = isAdminProfile();
  const roleLabel = profile => profile.role === "teacher" ? t("teacherRole") : t("studentRole");
  const profileTitle = profile => `${profile.name} - ${roleLabel(profile)} - skupina: ${profile.teacherGroupId || profile.id}`;
  const formatAnswer = answer => answer === true ? "Pravda" : answer === false ? "Nepravda" : String(answer);
  const buildPracticeList = entries => entries.slice(0, 4).map(entry => `
    <li>
      <strong>${escapeHtml(formatPracticeType(entry.type))}</strong>
      ${typeof entry.correct === "boolean" ? ` &bull; ${entry.correct ? "správne" : "nesprávne"}` : ""}
      <span class="muted"> &bull; ${escapeHtml(formatDateTime(entry.at))}</span>
    </li>
  `).join("");

  const buildSection = async (profile, title) => {
    const data = profile.id === state.currentProfile?.id
      ? state.profileData
      : await getProfileData(profile);
    const readIds = new Set(data.readIds || []);
    const assignments = getAssignments(data);
    const assignedIds = new Set(assignments.map(assignment => assignment.articleId));
    const doneAssigned = assignments.filter(assignment => readIds.has(assignment.articleId)).length;
    const clickedCount = Object.values(data.discoveredVocabulary || {}).reduce((sum, items) => sum + items.length, 0);
    const practiceLog = data.practiceLog || [];
    const gamification = getGamificationStats(data);
    const articleSummaries = visibleArticles.map(article => {
      const progress = getArticleTaskProgress(article, data);
      const articlePractices = practiceLog.filter(entry =>
        entry.articleId === article.id || (!entry.articleId && entry.articleTitle === article.title)
      );
      const answers = Object.entries(data.answers?.[article.id] || {})
        .filter(([, answer]) => answer !== null && answer !== undefined && answer !== "");
      const clickedVocabulary = data.discoveredVocabulary?.[article.id]?.length || 0;
      const isRead = readIds.has(article.id);
      const isAssigned = assignedIds.has(article.id);
      const assignmentStatus = getArticleAssignmentStatusInfo(article, data);
      const active = isAssigned || isRead || progress.done > 0 || articlePractices.length > 0 || answers.length > 0 || clickedVocabulary > 0;
      return { article, progress, articlePractices, answers, clickedVocabulary, isRead, isAssigned, assignmentStatus, active };
    });
    const activeArticles = articleSummaries.filter(item => item.active);
    const totalTasks = articleSummaries.reduce((sum, item) => sum + item.progress.total, 0);
    const doneTasks = articleSummaries.reduce((sum, item) => sum + item.progress.done, 0);
    const assignmentCounts = assignments.reduce((counts, assignment) => {
      const status = getAssignmentStatusInfo(assignment, data).key;
      counts[status] = (counts[status] || 0) + 1;
      return counts;
    }, {});
    const completionPercent = totalTasks ? Math.round((doneTasks / totalTasks) * 100) : 0;
    const articleCards = activeArticles.map(item => {
      const progressLabel = item.progress.total ? `${item.progress.done}/${item.progress.total}` : "0/0";
      const status = item.assignmentStatus;
      const answerCards = item.answers.map(([index, answer]) => {
        const question = item.article.questions?.[Number(index)];
        const statement = question?.statement || question || `Otázka ${Number(index) + 1}`;
        return `
          <div class="dashboard-answer">
            <p><strong>${escapeHtml(statement)}</strong></p>
            <p>${escapeHtml(formatAnswer(answer))}</p>
          </div>
        `;
      }).join("");

      return `
        <details class="dashboard-article">
          <summary>
            <span>
              <strong>${escapeHtml(item.article.title)}</strong>
              <span class="dashboard-pill status-${escapeHtml(status.key)}">${escapeHtml(status.label)}</span>
            </span>
            <span class="muted">Úlohy ${escapeHtml(progressLabel)}</span>
          </summary>
          <div class="dashboard-article-body">
            ${status.detail ? `<p class="muted">${escapeHtml(status.detail)}</p>` : ""}
            <p class="muted">Kliknuté slovíčka/frázy: ${item.clickedVocabulary} &bull; Cvičenia: ${item.articlePractices.length}</p>
            ${item.articlePractices.length ? `<ul class="dashboard-list">${buildPracticeList(item.articlePractices)}</ul>` : ""}
            ${answerCards || '<p class="muted">Bez uložených odpovedí v tomto článku.</p>'}
          </div>
        </details>
      `;
    }).join("");

    return `
      <section class="overview-section dashboard-card">
        <div class="dashboard-header">
          <div>
            <h3>${escapeHtml(title)}</h3>
            <p class="dashboard-meta">${escapeHtml(roleLabel(profile))} &bull; ${escapeHtml(gamification.level.title)} &bull; ${gamification.points} b${practiceLog[0]?.at ? ` &bull; posledná aktivita ${escapeHtml(formatDateTime(practiceLog[0].at))}` : ""}</p>
          </div>
          <strong class="dashboard-score">${completionPercent}%</strong>
        </div>
        <div class="dashboard-stats">
          <div class="dashboard-stat"><strong>${readIds.size}</strong><span>prečítané</span></div>
          <div class="dashboard-stat"><strong>${doneAssigned}/${assignments.length}</strong><span>zadania</span></div>
          <div class="dashboard-stat"><strong>${assignmentCounts.new || 0}</strong><span>nové zadania</span></div>
          <div class="dashboard-stat"><strong>${assignmentCounts.opened || 0}</strong><span>otvorené</span></div>
          <div class="dashboard-stat"><strong>${assignmentCounts["in-progress"] || 0}</strong><span>rozpracované</span></div>
          <div class="dashboard-stat"><strong>${doneTasks}/${totalTasks}</strong><span>úlohy</span></div>
          <div class="dashboard-stat"><strong>${practiceLog.length}</strong><span>cvičenia</span></div>
          <div class="dashboard-stat"><strong>${clickedCount}</strong><span>slovíčka/frázy</span></div>
          <div class="dashboard-stat"><strong>${gamification.earnedBadges.length}/${gamification.badges.length}</strong><span>odznaky</span></div>
        </div>
        <div class="dashboard-articles">
          ${articleCards || '<p class="muted">Zatiaľ tu nie je aktivita. Keď profil prečíta článok, klikne slovíčko alebo spraví cvičenie, objaví sa tu.</p>'}
        </div>
      </section>
    `;
  };

  const sections = [await buildSection(state.currentProfile, t("myProgress"))];

  if (state.currentProfile?.role === "teacher") {
    const students = state.profiles.filter(profile => profile.role === "student" && isInCurrentTeacherGroup(profile));
    sections.push(...await Promise.all(students.map(student => buildSection(student, student.name))));
  }

  if (isAdmin) {
    const otherProfiles = state.profiles
      .filter(profile => profile.id !== state.currentProfile.id)
      .filter(profile => (profile.teacherGroupId || profile.id) !== currentGroupId)
      .sort((a, b) =>
        String(a.teacherGroupId || a.id).localeCompare(String(b.teacherGroupId || b.id), "sk")
        || a.role.localeCompare(b.role, "sk")
        || a.name.localeCompare(b.name, "sk")
      );

    if (otherProfiles.length) {
      sections.push(`
        <section class="overview-section">
          <h3>Ostatné profily mimo tvojej skupiny</h3>
          <p class="muted">Admin pohľad na učiteľov a žiakov, ktorí nie sú v tvojej učiteľskej skupine.</p>
        </section>
      `);
      sections.push(...await Promise.all(otherProfiles.map(profile => buildSection(profile, profileTitle(profile)))));
    }
  }

  root.innerHTML = sections.join("") || `<p class="muted">${escapeHtml(t("noStudentsInGroup"))}</p>`;
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
    ? t("startupQ1")
    : t("startupQ2");
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
  if (!isInstallPromptHidden()) return;
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

function isStandaloneDisplayMode() {
  return window.matchMedia?.("(display-mode: standalone)")?.matches
    || navigator.standalone === true;
}

function isIosInstallInstructionDevice() {
  const platform = navigator.platform || "";
  const userAgent = navigator.userAgent || "";
  const isiPadOS = platform === "MacIntel" && navigator.maxTouchPoints > 1;
  return /iPhone|iPad|iPod/i.test(userAgent) || isiPadOS;
}

function isInstallPromptHidden() {
  return $("installPrompt")?.classList.contains("hidden") !== false;
}

function canShowInstallPrompt() {
  return Boolean(
    state.currentProfile
    && (state.deferredInstallPrompt || isIosInstallInstructionDevice())
    && !state.installPromptShown
    && !sessionStorage.getItem(INSTALL_PROMPT_DISMISSED_KEY)
    && isStandaloneDisplayMode() === false
  );
}

function showInstallPrompt() {
  if (!canShowInstallPrompt()) return;
  state.installPromptShown = true;
  const isIos = isIosInstallInstructionDevice() && !state.deferredInstallPrompt;
  $("installPromptTitle").textContent = isIos
    ? "Pridať Čítanku na plochu"
    : "Pridať Čítanku na plochu?";
  $("installPromptText").textContent = isIos
    ? "Na iPhone klepni v Safari na Zdieľať a potom vyber Pridať na plochu."
    : "Bude sa otvárať ako appka a nájdeš ju medzi ikonami v mobile.";
  $("installAppBtn").textContent = isIos ? "Rozumiem" : "Pridať na plochu";
  $("installPrompt")?.classList.remove("hidden");
}

function scheduleInstallPrompt() {
  if (!canShowInstallPrompt()) return;
  window.setTimeout(() => {
    if (document.hidden || !canShowInstallPrompt()) return;
    showInstallPrompt();
  }, 900);
}

function hideInstallPrompt() {
  $("installPrompt")?.classList.add("hidden");
}

function dismissInstallPrompt() {
  sessionStorage.setItem(INSTALL_PROMPT_DISMISSED_KEY, "true");
  hideInstallPrompt();
  if (!hasUnseenAssignments()) showStartupQuiz();
}

async function installAppFromPrompt() {
  const promptEvent = state.deferredInstallPrompt;
  if (!promptEvent) {
    dismissInstallPrompt();
    return;
  }

  hideInstallPrompt();
  state.deferredInstallPrompt = null;
  try {
    promptEvent.prompt();
    await promptEvent.userChoice;
  } catch (error) {
    console.info("Install prompt skipped:", error.message);
  }
  sessionStorage.setItem(INSTALL_PROMPT_DISMISSED_KEY, "true");
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
    ? t("correct")
    : `${t("correctIs")} ${question.answer}`;
  logPractice("startup-vocabulary", {
    correct: answer === question.answer,
    direction: question.direction,
    prompt: question.prompt,
    answer,
    expected: question.answer
  });
  $("nextStartupQuizBtn").textContent = quiz.index + 1 >= quiz.questions.length ? t("done") : t("next");
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
  renderRoleControls();
  $("fontSizeSelect").value = fontSize;
  $("darkModeToggle").checked = dark;

  document.body.classList.toggle("font-large", fontSize === "large");
  document.body.classList.toggle("font-xlarge", fontSize === "xlarge");
  document.body.classList.toggle("dark", dark);
  updateStaticTexts();
  updateNotificationStatus();
}

function updateNotificationStatus(message = "") {
  if (!("Notification" in window)) {
    $("notificationStatus").textContent = t("notificationUnsupported");
    return;
  }

  if (message) {
    $("notificationStatus").textContent = message;
    return;
  }

  const labels = {
    default: t("notificationDefault"),
    granted: t("notificationGranted"),
    denied: t("notificationDenied")
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
    updateNotificationStatus(t("notificationNotAllowed"));
    return;
  }

  const registration = await navigator.serviceWorker?.ready;
  if (!registration?.showNotification) {
    new Notification("Čítanka", {
      body: t("notificationBody"),
      icon: "icons/icon-192.png"
    });
    updateNotificationStatus(t("notificationSent"));
    return;
  }

  await registration.showNotification("Čítanka", {
    body: t("pushBody"),
    icon: "icons/icon-192.png",
    badge: "icons/icon-192.png",
    data: { url: "./index.html" }
  });
  updateNotificationStatus(t("notificationSent"));
}

onClick("backBtn", showHome);
onClick("settingsBackBtn", showHome);
onClick("teacherBackBtn", showHome);
onClick("articleEditorBottomBackBtn", showHome);
onClick("settingsBtn", showSettings);
onClick("shareAppBtn", shareApp);
onClick("teacherBtn", showTeacherView);
onClick("mobileNavHomeBtn", showHome);
onClick("mobileNavReviewBtn", showClickedReviewFromNav);
onClick("mobileNavProgressBtn", showTeacherView);
onClick("mobileNavSettingsBtn", showSettings);
onClick("practiceTabVocab", () => setArticlePracticeGroup("vocab", { scroll: true }));
onClick("practiceTabQuestions", () => setArticlePracticeGroup("questions", { scroll: true }));
onClick("practiceTabGames", () => setArticlePracticeGroup("games", { scroll: true }));
onClick("practiceTabSearch", () => setArticlePracticeGroup("search", { scroll: true }));
onClick("dismissStudentOnboardingBtn", () => completeOnboarding("studentIntroDone"));
onClick("dismissWordHintBtn", () => completeOnboarding("firstWordHintDone"));
onClick("dismissTeacherOnboardingBtn", () => completeOnboarding("teacherIntroDone"));
onClick("teacherArticlesTabBtn", () => setTeacherPanel("articles"));
onClick("teacherStudentsTabBtn", async () => {
  await renderTeacherOverview();
  setTeacherPanel("students");
});
onClick("teacherProfilesTabBtn", () => setTeacherPanel("profiles"));
onClick("refreshBtn", loadArticles);
onClick("loginBtn", login);
onClick("googleLoginBtn", signInWithGoogle);
onClick("magicLinkBtn", sendMagicLink);
onClick("registerProfileBtn", registerProfileFromLogin);
onClick("setupPairBtn", showSetup);
onClick("setupBackBtn", () => state.currentProfile ? showHome() : showLogin());
onClick("createProfilesBtn", createProfiles);
onClick("createSingleProfileBtn", createSingleProfile);
onClick("shareInviteLinkBtn", shareLastInviteLink);
onClick("joinInviteBtn", joinInviteFromSettings);
onClick("logoutBtn", logout);
onClick("readAloudBtn", () => readSentence(0));
onClick("pauseReadBtn", togglePauseReading);
onClick("stopReadBtn", stopReading);
onClick("newSentenceGameBtn", startSentenceGame);
onClick("newMatchGameBtn", startMatchGame);
onClick("newClickedReviewBtn", startClickedReviewGame);
onClick("newVocabChoiceBtn", startVocabChoiceGame);
onClick("newClozeGameBtn", startClozeGame);
onClick("newMistakeGameBtn", startMistakeGame);
onClick("newWordSearchBtn", startWordSearchGame);
onClick("skipStartupQuizBtn", closeStartupQuiz);
onClick("nextStartupQuizBtn", nextStartupQuizQuestion);
onClick("installLaterBtn", dismissInstallPrompt);
onClick("installAppBtn", installAppFromPrompt);
onClick("testNotificationBtn", showTestNotification);
onClick("linkGoogleAccountBtn", () => linkCurrentProfileToAuthUser());
onClick("signOutGoogleBtn", signOutGoogle);
onClick("newArticleBtn", () => {
  $("articleEditorSelect").value = "";
  clearArticleCreationHelperInputs();
  fillArticleEditor(null);
});
onClick("saveArticleBtn", saveArticleFromEditor);
onClick("deleteArticleBtn", deleteArticleFromEditor);
onClick("assignArticleBtn", assignSelectedArticleToStudents);
onChange("articleEditorSelect", () => {
  const article = state.articles.find(item => item.id === $("articleEditorSelect").value);
  fillArticleEditor(article || null);
});
onChange("articleVisibilitySelect", (event) => {
  if (event.target.value === "public" && $("articleApprovalStatusSelect").value === "draft") {
    $("articleApprovalStatusSelect").value = PUBLIC_ARTICLE_APPROVAL_STATUS;
  }
  if (event.target.value === "private") {
    $("articleApprovalStatusSelect").value = DEFAULT_ARTICLE_APPROVAL_STATUS;
  }
  updateArticleApprovalControl();
});
onEvent("articleTitleInput", "input", () => {
  if (!$("articleEditorSelect").value) {
    $("articleIdInput").value = makeArticleId($("articleTitleInput").value);
  }
  updateArticleEditorFlow();
});
onChange("articleCategorySelect", () => {
  updateArticleCategoryMode();
  updateArticleEditorFlow();
});
onChange("articleCategory2Select", () => {
  updateArticleCategoryMode();
  updateArticleEditorFlow();
});
onEvent("articleCategoryInput", "input", updateArticleEditorFlow);
onEvent("articleCategory2Input", "input", updateArticleEditorFlow);
onChange("articleRequiredWordsMode", () => {
  updateArticleRequiredWordsMode();
  updateArticleEditorFlow();
});
onEvent("articlePromptInput", "input", updateArticleEditorFlow);
onEvent("articleRequiredWordsInput", "input", updateArticleEditorFlow);
onEvent("articleSummaryInput", "input", updateArticleEditorFlow);
onEvent("articleTextInput", "input", updateArticleEditorFlow);
onChange("articleImageInput", (event) => {
  state.articleImageFile = event.target.files?.[0] || null;
  updateArticleImageStatus();
});
onEvent("articleQuestionsInput", "input", updateArticleEditorFlow);
onEvent("articleVocabularyInput", "input", updateArticleEditorFlow);
onEvent("articleInlineVocabularyInput", "input", updateArticleEditorFlow);
onClick("addSelectedInlineBtn", () => {
  addSelectedTextToVocabulary(false);
  updateArticleEditorFlow();
});
onClick("copyArticlePromptBtn", async () => {
  await copyTextToClipboard(buildArticlePrompt(), t("promptArticleCopied"));
  updateArticleEditorFlow();
});
onClick("copyArticleJsonPromptBtn", async () => {
  await copyTextToClipboard(buildArticleJsonPrompt(), t("promptArticleJsonCopied"));
  updateArticleEditorFlow();
});
onClick("copyImagePromptBtn", async () => {
  await copyTextToClipboard(buildImagePrompt(), t("promptImageCopied"));
  updateArticleEditorFlow();
});
onClick("importArticleBtn", importArticleToEditor);
onClick("copyTranslationPromptBtn", () => copyTextToClipboard(buildTranslationPrompt(), t("promptTranslationCopied")));

onEvent("loginPinInput", "keydown", event => {
  if (event.key === "Enter") login();
});

onEvent("magicEmailInput", "keydown", event => {
  if (event.key === "Enter") sendMagicLink();
});

onChange("loginNativeLanguageSelect", (event) => {
  state.preLoginLanguage = event.target.value;
  updateStaticTexts();
});

onClick("markReadBtn", () => {
  markCurrentArticleRead("manual");
});
onClick("markReadBottomBtn", () => {
  markCurrentArticleRead("manual");
});

onClick("articleText", (event) => {
  const button = event.target.closest(".inline-word");
  if (!button) return;
  showInlineTranslation(button);
});

onEvent("homeView", "click", async event => {
  const reviewOption = event.target.closest("#clickedReviewOptions .quiz-option");
  if (reviewOption) {
    answerClickedReview(reviewOption.dataset.answer);
    return;
  }

  const openButton = event.target.closest("[data-assignment-open]");
  if (openButton) {
    await openAssignmentByKey(openButton.dataset.assignmentOpen);
    return;
  }

  const dismissButton = event.target.closest("[data-assignment-dismiss]");
  if (dismissButton) {
    await dismissAssignmentNotice(dismissButton.dataset.assignmentDismiss);
  }
});

onEvent("articleText", "keydown", event => {
  const button = event.target.closest(".inline-word");
  if (!button || !["Enter", " "].includes(event.key)) return;
  event.preventDefault();
  showInlineTranslation(button);
});

onEvent("questionList", "click", event => {
  const button = event.target.closest(".choice-btn");
  if (!button) return;
  saveTrueFalseAnswer(button.dataset.questionIndex, button.dataset.answer === "true");
});

onEvent("sentenceWordBank", "click", event => {
  const button = event.target.closest(".word-chip");
  if (!button) return;
  chooseSentenceWord(button.dataset.wordId);
});

onEvent("sentenceTarget", "click", event => {
  const button = event.target.closest(".word-chip");
  if (!button) return;
  returnSentenceWord(button.dataset.wordId);
});

onEvent("matchGameBoard", "click", event => {
  const button = event.target.closest(".match-card");
  if (!button) return;
  chooseMatchCard(button.dataset.cardId);
});

onEvent("vocabChoiceOptions", "click", event => {
  const button = event.target.closest(".quiz-option");
  if (!button) return;
  answerVocabChoice(button.dataset.answer);
});

onEvent("clozeOptions", "click", event => {
  const button = event.target.closest(".quiz-option");
  if (!button) return;
  answerClozeGame(button.dataset.answer);
});

onEvent("mistakeOptions", "click", event => {
  const button = event.target.closest(".quiz-option");
  if (!button) return;
  answerMistakeGame(button.dataset.answer);
});

onEvent("wordSearchGrid", "click", event => {
  const button = event.target.closest(".letter-cell");
  if (!button) return;
  chooseWordSearchLetter(Number(button.dataset.row), Number(button.dataset.col));
});

onEvent("startupQuizOptions", "click", event => {
  const button = event.target.closest(".quiz-option");
  if (!button) return;
  answerStartupQuiz(button.dataset.answer);
});

onChange("fontSizeSelect", (e) => {
  localStorage.setItem("fontSize", e.target.value);
  loadSettings();
});

onChange("darkModeToggle", (e) => {
  localStorage.setItem("darkMode", e.target.checked);
  loadSettings();
});

onChange("settingsNativeLanguageSelect", (e) => {
  updateCurrentProfileNativeLanguage(e.target.value);
});

onChange("settingsRoleSelect", (e) => {
  updateCurrentProfileRole(e.target.value);
});

window.addEventListener("pagehide", forceStopSpeech);
window.addEventListener("beforeunload", forceStopSpeech);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) forceStopSpeech();
});

window.addEventListener("beforeinstallprompt", event => {
  event.preventDefault();
  state.deferredInstallPrompt = event;
  scheduleInstallPrompt();
});

window.addEventListener("appinstalled", () => {
  state.deferredInstallPrompt = null;
  sessionStorage.setItem(INSTALL_PROMPT_DISMISSED_KEY, "true");
  hideInstallPrompt();
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("service-worker.js");
  });
}

async function init() {
  loadSettings();
  await initAuthFromRedirect();
  await loadProfiles();
  await loadArticles();
  if (await handlePendingInvite()) return;
  logAppOpened({
    hasSavedProfile: Boolean(localStorage.getItem(CURRENT_PROFILE_KEY)),
    path: location.pathname
  });

  const savedProfileId = localStorage.getItem(CURRENT_PROFILE_KEY);
  const savedProfile = state.profiles.find(profile => profile.id === savedProfileId);
  if (savedProfile) {
    await setCurrentProfile(savedProfile);
    logAppEvent("profile_selected", {
      profileId: savedProfile.id,
      role: savedProfile.role,
      source: "saved_profile"
    });
    if (await handlePendingAuthAction()) return;
  } else if (await handlePendingAuthAction()) {
    return;
  } else {
    showLogin();
  }
}

init();
