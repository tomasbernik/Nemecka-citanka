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

function getVocabularyTranslations(item = {}) {
  return Object.fromEntries(VOCABULARY_LANGUAGE_CODES
    .filter(code => item[code])
    .map(code => [code, String(item[code]).trim()]));
}

function hasAnyVocabularyTranslation(item = {}) {
  return VOCABULARY_LANGUAGE_CODES.some(code => Boolean(item[code]));
}

function hasAllVocabularyTranslations(item = {}) {
  return VOCABULARY_LANGUAGE_CODES.every(code => Boolean(item[code]));
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
  setText("profileProgressBtn", state.currentProfile?.role === "teacher" ? "articleEditor" : "myProgress");
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

  $("logoutBtn")?.setAttribute("aria-label", t("logout"));
  $("logoutBtn")?.setAttribute("title", t("logout"));
  document.querySelector("#studentOnboarding .eyebrow").textContent = t("quickStart");
  document.querySelector("#studentOnboarding h3").textContent = t("studentOnboardingTitle");
  document.querySelector("#studentOnboarding .muted").textContent = t("studentOnboardingText");
  setText("dismissStudentOnboardingBtn", "understand");
  document.querySelector("#wordOnboardingHint .muted").textContent = t("wordOnboardingText");
  setText("dismissWordHintBtn", "hide");
  document.querySelector("#assignmentInbox .section-title h3").textContent = t("myAssignments");
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
  setText("gamificationEyebrow", "gamificationEyebrow");
  setText("gamificationTitle", "gamificationTitle");
  document.querySelector("#teacherOnboarding .eyebrow").textContent = t("quickStart");
  document.querySelector("#teacherOnboarding h3").textContent = t("teacherOnboardingTitle");
  document.querySelector("#teacherOnboarding .muted").textContent = t("teacherOnboardingText");
  setText("dismissTeacherOnboardingBtn", "understand");
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
  renderArticleEditorList();
  renderGamification();
  renderMobileBottomNav(getActiveViewId());
  renderArticlePracticeTabs();
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

function showSettings() {
  showView("settingsView");
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
    ? t("installPromptTitleIos")
    : t("installPromptTitle");
  $("installPromptText").textContent = isIos
    ? t("installPromptTextIos")
    : t("installPromptText");
  $("installAppBtn").textContent = isIos ? t("understand") : t("installApp");
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
      icon: "icons/icon-v2-192.png"
    });
    updateNotificationStatus(t("notificationSent"));
    return;
  }

  await registration.showNotification("Čítanka", {
    body: t("pushBody"),
    icon: "icons/icon-v2-192.png",
    badge: "icons/icon-v2-192.png",
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
onClick("profileProgressBtn", showTeacherView);
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
  let refreshingForServiceWorkerUpdate = false;

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (refreshingForServiceWorkerUpdate) return;
    refreshingForServiceWorkerUpdate = true;
    window.location.reload();
  });

  window.addEventListener("load", async () => {
    try {
      const registration = await navigator.serviceWorker.register("service-worker.js", {
        updateViaCache: "none"
      });
      await registration.update();
    } catch (error) {
      console.info("Service worker registration skipped:", error.message);
    }
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
