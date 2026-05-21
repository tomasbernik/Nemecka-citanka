// Home, progress, and startup quiz flow.

function showHome() {
  stopReading();
  state.currentArticle = null;
  showView("homeView");
  renderHomeAssignments();
  renderClickedReview();
  renderCategories();
  renderLevelFilters();
  renderArticles();
  renderOnboarding();
  scheduleInstallPrompt();
  scrollToPageTop();
}

function showClickedReviewFromNav() {
  stopReading();
  startClickedReviewGame();
  setMobileNavButton("mobileNavHomeBtn", t("articles"), false);
  setMobileNavButton("mobileNavReviewBtn", t("clickedReviewEyebrow"), true);
}

function setTeacherPanel(panel) {
  const canShowOverview = Boolean(state.currentProfile);
  const canEditArticles = Boolean(state.currentProfile);
  const isTeacher = state.currentProfile?.role === "teacher";
  const activePanel = canEditArticles || panel !== "articles" ? panel : "students";
  const showStudents = canShowOverview && activePanel === "students";
  const showProfiles = canCreateProfiles() && activePanel === "profiles";
  $("teacherStudentsTabBtn").textContent = isTeacher ? t("studentOverview") : t("myProgress");
  document.querySelector("#teacherOverviewCard h2").textContent = isTeacher ? t("studentOverview") : t("myProgress");
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
  renderGamification();
  renderMobileBottomNav(getActiveViewId());
  renderOnboarding();
}

async function showTeacherView(panel = state.currentProfile?.role === "teacher" ? "articles" : "students") {
  if (!state.currentProfile) return;
  renderArticleEditorList();
  if (panel === "students" || state.currentProfile.role !== "teacher") {
    await renderTeacherOverview();
    setTeacherPanel("students");
  } else {
    setTeacherPanel("articles");
  }
  showView("teacherView");
  renderGamification();
  renderOnboarding();
}

function formatPracticeType(type) {
  return {
    "sentence-order": t("sentenceOrder"),
    "match-pairs": t("matchPairs"),
    "startup-vocabulary": t("startupWarmup"),
    "clicked-vocabulary-review": t("clickedReviewTitle"),
    "true-false": `${t("trueLabel")}/${t("falseLabel")}`,
    "vocab-choice": t("vocabChoice"),
    "cloze-word": t("cloze"),
    "find-mistake": t("mistake"),
    "word-search": t("wordSearch")
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
            <span class="muted">${escapeHtml(formatText("tasksProgressShort", { progress: progressLabel }))}</span>
          </summary>
          <div class="dashboard-article-body">
            ${status.detail ? `<p class="muted">${escapeHtml(status.detail)}</p>` : ""}
            <p class="muted">${escapeHtml(formatText("clickedVocabularyCount", { count: item.clickedVocabulary }))} &bull; ${escapeHtml(formatText("practiceCount", { count: item.articlePractices.length }))}</p>
            ${item.articlePractices.length ? `<ul class="dashboard-list">${buildPracticeList(item.articlePractices)}</ul>` : ""}
            ${answerCards || `<p class="muted">${escapeHtml(t("noSavedAnswersForArticle"))}</p>`}
          </div>
        </details>
      `;
    }).join("");

    return `
      <section class="overview-section dashboard-card">
        <div class="dashboard-header">
          <div>
            <h3>${escapeHtml(title)}</h3>
            <p class="dashboard-meta">${escapeHtml(roleLabel(profile))} &bull; ${escapeHtml(t(gamification.level.titleKey))} &bull; ${escapeHtml(formatText("pointsShort", { points: gamification.points }))}${practiceLog[0]?.at ? ` &bull; ${escapeHtml(formatText("lastActivity", { date: formatDateTime(practiceLog[0].at) }))}` : ""}</p>
          </div>
          <strong class="dashboard-score">${completionPercent}%</strong>
        </div>
        <div class="dashboard-stats">
          <div class="dashboard-stat"><strong>${readIds.size}</strong><span>${escapeHtml(t("readPlural"))}</span></div>
          <div class="dashboard-stat"><strong>${doneAssigned}/${assignments.length}</strong><span>${escapeHtml(t("assignments"))}</span></div>
          <div class="dashboard-stat"><strong>${assignmentCounts.new || 0}</strong><span>${escapeHtml(t("newAssignments"))}</span></div>
          <div class="dashboard-stat"><strong>${assignmentCounts.opened || 0}</strong><span>${escapeHtml(t("opened"))}</span></div>
          <div class="dashboard-stat"><strong>${assignmentCounts["in-progress"] || 0}</strong><span>${escapeHtml(t("inProgress"))}</span></div>
          <div class="dashboard-stat"><strong>${doneTasks}/${totalTasks}</strong><span>${escapeHtml(t("tasks"))}</span></div>
          <div class="dashboard-stat"><strong>${practiceLog.length}</strong><span>${escapeHtml(t("practicePlural"))}</span></div>
          <div class="dashboard-stat"><strong>${clickedCount}</strong><span>${escapeHtml(t("vocabularyPhrases"))}</span></div>
        </div>
        <div class="dashboard-articles">
          ${articleCards || `<p class="muted">${escapeHtml(t("noDashboardActivity"))}</p>`}
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
  const questions = buildStartupQuizQuestions().slice(0, 1);
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
