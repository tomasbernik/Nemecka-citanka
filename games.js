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
