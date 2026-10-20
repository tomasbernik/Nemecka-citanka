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

function showClickedReviewFromNav(event) {
  event?.preventDefault();
  event?.stopPropagation();
  stopReading();
  requestAnimationFrame(() => {
    startClickedReviewGame();
    setMobileNavButton("mobileNavHomeBtn", t("articles"), false);
    setMobileNavButton("mobileNavReviewBtn", t("clickedReviewEyebrow"), true);
  });
}

function setTeacherPanel(panel) {
  const canShowOverview = Boolean(state.currentProfile);
  const canEditArticles = isPublisherAccount() || isProfileOwnedByCurrentAuth();
  const isTeacher = hasTeacherLicense();
  const canShowAdmin = isPublisherAccount();
  const activePanel = panel === "admin" && !canShowAdmin
    ? "articles"
    : canEditArticles || panel !== "articles" ? panel : "students";
  const showStudents = canShowOverview && activePanel === "students";
  const showAdmin = canShowAdmin && activePanel === "admin";
  const showArticles = canEditArticles && !showStudents && !showAdmin;
  $("teacherStudentsTabBtn").textContent = isTeacher ? t("studentOverview") : t("myProgress");
  document.querySelector("#teacherOverviewCard h2").textContent = isTeacher ? t("studentOverview") : t("myProgress");
  $("articleEditorCard").classList.toggle("hidden", !showArticles);
  $("teacherOverviewCard").classList.toggle("hidden", !showStudents);
  $("adminOverviewCard").classList.toggle("hidden", !showAdmin);
  $("teacherArticlesTabBtn").classList.toggle("hidden", !canEditArticles);
  $("teacherStudentsTabBtn").classList.toggle("hidden", !canShowOverview);
  $("adminOverviewTabBtn").classList.toggle("hidden", !canShowAdmin);
  $("teacherArticlesTabBtn").classList.toggle("active", showArticles);
  $("teacherStudentsTabBtn").classList.toggle("active", showStudents);
  $("adminOverviewTabBtn").classList.toggle("active", showAdmin);
  $("teacherArticlesTabBtn").classList.toggle("quiet", !showArticles);
  $("teacherStudentsTabBtn").classList.toggle("quiet", !showStudents);
  $("adminOverviewTabBtn").classList.toggle("quiet", !showAdmin);
  if (showArticles) renderArticleModerationQueue();
  renderGamification();
  renderMobileBottomNav(getActiveViewId());
  renderOnboarding();
}

async function showTeacherView(panel = "articles") {
  if (!state.currentProfile) return;
  renderArticleEditorList();
  if (panel === "students") {
    setTeacherPanel("students");
    showView("teacherView");
    await renderTeacherOverview();
  } else {
    setTeacherPanel("articles");
    showView("teacherView");
  }
  renderGamification();
  renderOnboarding();
}



function getArticleOwnerLabel(article) {
  return state.profiles.find(profile => profile.id === article.ownerProfileId)?.name
    || article.ownerProfileId
    || "-";
}

function renderArticleModerationQueue() {
  const panel = $("articleModerationPanel");
  const root = $("articleModerationList");
  if (!panel || !root) return;

  const articles = getModeratableArticles()
    .filter(article => ["draft", "pending"].includes(article.approvalStatus))
    .sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));

  panel.classList.toggle("hidden", !hasTeacherLicense());
  root.innerHTML = articles.length
    ? articles.map(article => `
        <article class="management-row">
          <div>
            <strong>${escapeHtml(article.title)}</strong>
            <p class="muted">${escapeHtml(t("articleAuthor"))}: ${escapeHtml(getArticleOwnerLabel(article))} &bull; ${escapeHtml(t(article.approvalStatus))}</p>
          </div>
          <div class="management-actions">
            <button class="secondary-btn compact" type="button" data-approval="approved" data-article-id="${escapeHtml(article.id)}">${escapeHtml(t("approveArticle"))}</button>
            <button class="text-btn" type="button" data-approval="rejected" data-article-id="${escapeHtml(article.id)}">${escapeHtml(t("rejectArticle"))}</button>
          </div>
        </article>
      `).join("")
    : `<p class="muted">${escapeHtml(t("noArticlesAwaitingApproval"))}</p>`;
}

async function handleArticleModerationClick(event) {
  const button = event.target.closest("[data-approval][data-article-id]");
  if (!button) return;
  button.disabled = true;
  try {
    await setArticleApprovalStatus(button.dataset.articleId, button.dataset.approval);
    $("articleModerationStatus").textContent = t("articleStatusUpdated");
    renderArticleModerationQueue();
    if (isPublisherAccount()) renderAdminOverview();
  } catch (error) {
    $("articleModerationStatus").textContent = error.message;
  } finally {
    button.disabled = false;
  }
}

function buildAdminArticleSection(title, articles) {
  return `
    <section class="management-section">
      <h3>${escapeHtml(title)} <span class="management-count">${articles.length}</span></h3>
      <div class="management-list">
        ${articles.length ? articles.map(article => {
          const approvalActions = ["draft", "pending"].includes(article.approvalStatus)
            ? `
                <button class="secondary-btn compact" type="button" data-approval="approved" data-article-id="${escapeHtml(article.id)}">${escapeHtml(t("approveArticle"))}</button>
                <button class="text-btn" type="button" data-approval="rejected" data-article-id="${escapeHtml(article.id)}">${escapeHtml(t("rejectArticle"))}</button>
              `
            : article.approvalStatus === "rejected"
              ? `<button class="secondary-btn compact" type="button" data-approval="approved" data-article-id="${escapeHtml(article.id)}">${escapeHtml(t("approveArticle"))}</button>`
              : "";
          const publicationAction = article.approvalStatus === "approved"
            ? `<button class="secondary-btn compact" type="button" data-published="${article.published ? "false" : "true"}" data-article-id="${escapeHtml(article.id)}">${escapeHtml(t(article.published ? "unpublishArticle" : "publishArticle"))}</button>`
            : "";
          return `
            <article class="management-row">
              <div>
                <strong>${escapeHtml(article.title)}</strong>
                <p class="muted">${escapeHtml(t("articleAuthor"))}: ${escapeHtml(getArticleOwnerLabel(article))} &bull; ${escapeHtml(t(article.approvalStatus))}</p>
              </div>
              <div class="management-actions">${approvalActions}${publicationAction}</div>
            </article>
          `;
        }).join("") : `<p class="muted">0</p>`}
      </div>
    </section>
  `;
}

function buildTeacherHierarchy() {
  const teachers = state.profiles
    .filter(profile => profile.role === "teacher")
    .sort((a, b) => a.name.localeCompare(b.name));
  const teacherGroups = new Set(teachers.map(profile => profile.teacherGroupId || profile.id));
  const students = state.profiles.filter(profile => profile.role === "student");
  const cards = teachers.map(teacher => {
    const groupId = teacher.teacherGroupId || teacher.id;
    const groupStudents = students.filter(student => student.teacherGroupId === groupId);
    return `
      <article class="management-profile-card">
        <strong>${escapeHtml(teacher.name)}</strong>
        <span class="muted">${escapeHtml(t("teacherRole"))} &bull; ${escapeHtml(groupId)}</span>
        <ul>${groupStudents.length
          ? groupStudents.map(student => `<li>${escapeHtml(student.name)}</li>`).join("")
          : `<li class="muted">${escapeHtml(t("noStudentsInGroup"))}</li>`}
        </ul>
      </article>
    `;
  });
  const unassigned = students.filter(student => !teacherGroups.has(student.teacherGroupId));
  if (unassigned.length) {
    cards.push(`
      <article class="management-profile-card warning">
        <strong>${escapeHtml(t("unassignedStudents"))}</strong>
        <ul>${unassigned.map(student => `<li>${escapeHtml(student.name)} <span class="muted">(${escapeHtml(student.teacherGroupId || "-")})</span></li>`).join("")}</ul>
      </article>
    `);
  }
  return `<section class="management-section"><h3>${escapeHtml(t("teachersAndStudents"))}</h3><div class="management-profile-grid">${cards.join("")}</div></section>`;
}

async function loadTeacherRequests() {
  if (!isPublisherAccount()) return [];
  try {
    return await supabaseRequest("app_teacher_requests?select=profile_id,email,status,requested_at,reviewed_at,license_tier&order=requested_at.desc");
  } catch (error) {
    console.info("Teacher requests unavailable:", error.message);
    return [];
  }
}

function buildTeacherRequestSection(requests) {
  const pending = requests.filter(request => request.status === "pending");
  $("adminOverviewTabBtn").textContent = pending.length
    ? `${t("adminOverviewTab")} (${pending.length})`
    : t("adminOverviewTab");

  return `
    <section class="management-section">
      <h3>${escapeHtml(t("teacherRequests"))} <span class="management-count">${pending.length}</span></h3>
      <div class="management-list">
        ${requests.length ? requests.map(request => {
          const profile = state.profiles.find(item => item.id === request.profile_id);
          const actions = request.status === "pending"
            ? `
                <button class="secondary-btn compact" type="button" data-teacher-profile-id="${escapeHtml(request.profile_id)}" data-license-tier="pilot">${escapeHtml(t("grantPilot"))}</button>
                <button class="secondary-btn compact" type="button" data-teacher-profile-id="${escapeHtml(request.profile_id)}" data-license-tier="paid">${escapeHtml(t("grantPaid"))}</button>
                <button class="text-btn" type="button" data-teacher-profile-id="${escapeHtml(request.profile_id)}" data-request-decision="rejected">${escapeHtml(t("rejectRequest"))}</button>
              `
            : `<span class="muted">${escapeHtml(t(request.status === "approved" ? "requestApproved" : "requestRejected"))}${request.license_tier !== "none" ? ` &bull; ${escapeHtml(t(request.license_tier === "pilot" ? "pilotLicense" : "paidLicense"))}` : ""}</span>`;
          return `
            <article class="management-row">
              <div>
                <strong>${escapeHtml(profile?.name || request.email)}</strong>
                <p class="muted">${escapeHtml(request.email)} &bull; ${escapeHtml(formatDateTime(request.requested_at))}</p>
              </div>
              <div class="management-actions">${actions}</div>
            </article>
          `;
        }).join("") : `<p class="muted">${escapeHtml(t("noTeacherRequests"))}</p>`}
      </div>
    </section>
  `;
}

async function renderAdminOverview() {
  const root = $("adminOverview");
  if (!root || !isPublisherAccount()) return;
  const teacherRequests = await loadTeacherRequests();
  const articles = [...state.articles].sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
  const pending = articles.filter(article => ["draft", "pending"].includes(article.approvalStatus));
  const awaitingPublication = articles.filter(article => article.approvalStatus === "approved" && !article.published);
  const published = articles.filter(article => article.published);
  const rejected = articles.filter(article => article.approvalStatus === "rejected");
  const privateArticles = articles.filter(article => article.visibility === "private");
  root.innerHTML = [
    buildTeacherRequestSection(teacherRequests),
    buildAdminArticleSection(t("articleNew"), pending),
    buildAdminArticleSection(t("approvedAwaitingPublication"), awaitingPublication),
    buildAdminArticleSection(t("publishedArticles"), published),
    buildAdminArticleSection(t("rejectedArticles"), rejected),
    buildAdminArticleSection(t("privateLegacyArticles"), privateArticles),
    buildTeacherHierarchy()
  ].join("");
}

async function handleAdminOverviewClick(event) {
  const button = event.target.closest("[data-article-id], [data-teacher-profile-id]");
  if (!button || !isPublisherAccount()) return;
  button.disabled = true;
  try {
    if (button.dataset.teacherProfileId) {
      const approved = Boolean(button.dataset.licenseTier);
      await supabaseRequest("rpc/app_review_teacher_request", {
        method: "POST",
        body: JSON.stringify({
          target_profile_id: button.dataset.teacherProfileId,
          target_decision: approved ? "approved" : "rejected",
          target_license_tier: button.dataset.licenseTier || "pilot"
        })
      });
      await loadProfiles();
    } else if (button.dataset.approval) {
      await setArticleApprovalStatus(button.dataset.articleId, button.dataset.approval);
    } else if (button.dataset.published) {
      await setArticlePublished(button.dataset.articleId, button.dataset.published === "true");
    } else {
      return;
    }
    await renderAdminOverview();
    renderArticleModerationQueue();
    renderArticles();
  } catch (error) {
    window.alert(error.message);
  } finally {
    button.disabled = false;
  }
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
          <p class="muted">Admin pohľad na učiteľov a študentov, ktorí nie sú v tvojej učiteľskej skupine.</p>
        </section>
      `);
      sections.push(...await Promise.all(otherProfiles.map(profile => buildSection(profile, profileTitle(profile)))));
    }
  }

  root.innerHTML = sections.join("") || `<p class="muted">${escapeHtml(t("noStudentsInGroup"))}</p>`;
}

let teacherOverviewMode = "students";

function setTeacherOverviewStatus(message = "", isError = false) {
  const status = $("teacherOverviewStatus");
  if (!status) return;
  status.textContent = message;
  status.classList.toggle("form-error", isError);
}

async function setStudentTeam(profileId, teamId) {
  const managedTeamIds = new Set(getManagedTeams().map(team => team.id));
  const currentTeamIds = state.teamMemberships
    .filter(membership => membership.profileId === profileId && managedTeamIds.has(membership.teamId))
    .map(membership => membership.teamId);
  if (teamId && !currentTeamIds.includes(teamId)) {
    await supabaseRequest("rpc/app_set_team_member", {
      method: "POST",
      body: JSON.stringify({ target_team_id: teamId, target_profile_id: profileId, target_member: true })
    });
  }

  for (const currentTeamId of currentTeamIds.filter(id => id !== teamId)) {
    await supabaseRequest("rpc/app_set_team_member", {
      method: "POST",
      body: JSON.stringify({ target_team_id: currentTeamId, target_profile_id: profileId, target_member: false })
    });
  }
}

async function handleTeacherOverviewChange(event) {
  const select = event.target.closest("[data-student-team]");
  if (!select) return;
  select.disabled = true;
  setTeacherOverviewStatus(t("savingChanges"));
  try {
    await setStudentTeam(select.dataset.studentTeam, select.value);
    await loadProfiles();
    await loadTeams();
    await renderTeacherOverview();
    setTeacherOverviewStatus(t("studentClassUpdated"));
  } catch (error) {
    select.disabled = false;
    setTeacherOverviewStatus(error.message, true);
  }
}

async function handleTeacherOverviewClick(event) {
  const modeButton = event.target.closest("[data-overview-mode]");
  if (modeButton) {
    teacherOverviewMode = modeButton.dataset.overviewMode === "classes" ? "classes" : "students";
    await renderTeacherOverview();
    return;
  }

  const actionButton = event.target.closest("[data-student-action]");
  if (!actionButton) return;
  const profileId = actionButton.dataset.profileId;
  const profile = state.profiles.find(item => item.id === profileId);
  if (!profile) return;

  if (actionButton.dataset.studentAction === "remove") {
    if (!window.confirm(formatText("removeStudentConfirm", { name: profile.name }))) return;
    actionButton.disabled = true;
    try {
      await setStudentTeam(profileId, "");
      await loadProfiles();
      await loadTeams();
      await renderTeacherOverview();
      setTeacherOverviewStatus(t("studentRemoved"));
    } catch (error) {
      actionButton.disabled = false;
      setTeacherOverviewStatus(error.message, true);
    }
    return;
  }

  if (actionButton.dataset.studentAction === "delete-account" && isPublisherAccount()) {
    const confirmation = window.prompt(formatText("deleteStudentAccountConfirm", { name: profile.name })) || "";
    if (confirmation.trim() !== profile.name) {
      if (confirmation) setTeacherOverviewStatus(t("deleteStudentAccountNameMismatch"), true);
      return;
    }
    actionButton.disabled = true;
    try {
      await supabaseRequest("rpc/app_admin_delete_student_account", {
        method: "POST",
        body: JSON.stringify({ target_profile_id: profileId })
      });
      await loadProfiles();
      await loadTeams();
      await renderTeacherOverview();
      setTeacherOverviewStatus(t("studentAccountDeleted"));
    } catch (error) {
      actionButton.disabled = false;
      setTeacherOverviewStatus(error.message, true);
    }
  }
}

async function renderTeacherOverview() {
  const root = $("teacherOverview");
  const visibleArticles = state.articles.filter(article => canViewArticle(article, state.currentProfile));
  const currentGroupId = state.currentProfile?.teacherGroupId || state.currentProfile?.id || "";
  const isAdmin = isAdminProfile();
  const canDeleteStudentAccounts = isPublisherAccount();
  const managedTeams = hasTeacherLicense() ? getManagedTeams() : [];
  if (!managedTeams.length) teacherOverviewMode = "students";
  const roleLabel = profile => profile.role === "teacher" ? t("teacherRole") : t("studentRole");
  const profileTitle = profile => `${profile.name} - ${roleLabel(profile)} - ${t("groupLabel")}: ${profile.teacherGroupId || profile.id}`;
  const formatAnswer = answer => answer === true ? t("trueLabel") : answer === false ? t("falseLabel") : String(answer);
  const inactiveAfterDays = 14;
  const now = Date.now();
  const labels = {
    classSummary: t("classSummary"),
    assignmentSummary: t("assignmentSummary"),
    students: t("studentsLabel"),
    activeStudents: t("activeStudents"),
    inactiveStudents: t("inactiveStudents"),
    assignedDone: t("completedAssignments"),
    assignedOpen: t("unfinishedAssignmentsCount"),
    noLastActivity: t("noActivity"),
    noAssignments: t("noAssignmentsLabel"),
    doneAssignments: t("doneAssignmentsHeading"),
    unfinishedAssignments: t("unfinishedAssignmentsHeading"),
    otherActivity: t("otherActivity"),
    details: t("detail"),
    assigned: t("assignedLower"),
    done: t("doneLower"),
    open: t("openedLower"),
    inactive: t("inactiveLabel"),
    active: t("activeLabel"),
    noOpenAssignments: t("studentNoOpenAssignments"),
    noDoneAssignments: t("noDoneAssignments"),
    noOtherActivity: t("noOtherActivity"),
    noStudents: t("noStudentsInGroup"),
    lastActivity: t("lastActivityLabel"),
    tasks: t("tasks"),
    answers: t("answersLabel")
  };
  const buildPracticeList = entries => entries.slice(0, 4).map(entry => `
    <li>
      <strong>${escapeHtml(formatPracticeType(entry.type))}</strong>
      ${typeof entry.correct === "boolean" ? ` &bull; ${entry.correct ? t("correctLower") : t("incorrectLower")}` : ""}
      <span class="muted"> &bull; ${escapeHtml(formatDateTime(entry.at))}</span>
    </li>
  `).join("");

  const getLatestActivityDate = (data, assignments) => {
    const dates = [
      ...(data.practiceLog || []).map(entry => entry.at),
      ...assignments.map(assignment => assignment.assignedAt)
    ]
      .map(value => value ? new Date(value).getTime() : NaN)
      .filter(Number.isFinite);
    return dates.length ? new Date(Math.max(...dates)) : null;
  };

  const isLongInactive = latestActivity => {
    if (!latestActivity) return true;
    return now - latestActivity.getTime() > inactiveAfterDays * 24 * 60 * 60 * 1000;
  };

  const buildArticleDetail = (item) => {
    const progressLabel = item.progress.total ? `${item.progress.done}/${item.progress.total}` : "0/0";
    const status = item.assignmentStatus;
    const answerCards = item.answers.map(([index, answer]) => {
      const question = item.article.questions?.[Number(index)];
      const statement = question?.statement || question || formatText("questionNumber", { number: Number(index) + 1 });
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
          <span class="muted">${escapeHtml(labels.tasks)} ${escapeHtml(progressLabel)}</span>
        </summary>
        <div class="dashboard-article-body">
          ${status.detail ? `<p class="muted">${escapeHtml(status.detail)}</p>` : ""}
          <p class="muted">${escapeHtml(formatText("clickedVocabularyCount", { count: item.clickedVocabulary }))} &bull; ${escapeHtml(formatText("practiceCount", { count: item.articlePractices.length }))}</p>
          ${item.articlePractices.length ? `<ul class="dashboard-list">${buildPracticeList(item.articlePractices)}</ul>` : ""}
          ${answerCards || `<p class="muted">${escapeHtml(t("noSavedAnswersForArticle"))}</p>`}
        </div>
      </details>
    `;
  };

  const buildAssignmentItem = item => {
    const title = item.article?.title || item.assignment.articleTitle || item.assignment.articleId;
    const assignedAt = item.assignment.assignedAt
      ? `<span>${escapeHtml(formatText("assignedAt", { date: formatDateTime(item.assignment.assignedAt) }))}</span>`
      : "";
    const progress = item.status.total ? `${item.status.done}/${item.status.total}` : "0/0";
    return `
      <li class="dashboard-assignment-item">
        <span>
          <strong>${escapeHtml(title)}</strong>
          <span class="dashboard-pill status-${escapeHtml(item.status.key)}">${escapeHtml(item.status.label)}</span>
        </span>
        <small>${assignedAt}${assignedAt ? " &bull; " : ""}${escapeHtml(labels.tasks)} ${escapeHtml(progress)}</small>
      </li>
    `;
  };

  const buildProfileSummary = async (profile, title) => {
    const data = profile.id === state.currentProfile?.id
      ? state.profileData
      : await getProfileData(profile);
    const readIds = new Set(data.readIds || []);
    const assignments = getAssignments(data);
    const clickedCount = Object.values(data.discoveredVocabulary || {}).reduce((sum, items) => sum + items.length, 0);
    const practiceLog = data.practiceLog || [];
    const articleSummaries = visibleArticles.map(article => {
      const progress = getArticleTaskProgress(article, data);
      const articlePractices = practiceLog.filter(entry =>
        entry.articleId === article.id || (!entry.articleId && entry.articleTitle === article.title)
      );
      const answers = Object.entries(data.answers?.[article.id] || {})
        .filter(([, answer]) => answer !== null && answer !== undefined && answer !== "");
      const clickedVocabulary = data.discoveredVocabulary?.[article.id]?.length || 0;
      const isRead = readIds.has(article.id);
      const isAssigned = assignments.some(assignment => assignment.articleId === article.id);
      const assignmentStatus = getArticleAssignmentStatusInfo(article, data);
      const active = isAssigned || isRead || progress.done > 0 || articlePractices.length > 0 || answers.length > 0 || clickedVocabulary > 0;
      return { article, progress, articlePractices, answers, clickedVocabulary, isRead, isAssigned, assignmentStatus, active };
    });
    const assignmentSummaries = assignments.map(assignment => ({
      assignment,
      article: getArticleForAssignment(assignment),
      status: getAssignmentStatusInfo(assignment, data)
    }));
    const doneAssignments = assignmentSummaries.filter(item => item.status.key === "completed");
    const openAssignments = assignmentSummaries.filter(item => item.status.key !== "completed");
    const otherActiveArticles = articleSummaries.filter(item => item.active && !item.isAssigned);
    const latestActivity = getLatestActivityDate(data, assignments);
    const inactive = isLongInactive(latestActivity);

    return {
      profile,
      title,
      data,
      readIds,
      assignments,
      assignmentSummaries,
      doneAssignments,
      openAssignments,
      otherActiveArticles,
      latestActivity,
      inactive,
      clickedCount,
      practiceLog
    };
  };

  const buildProfileRow = summary => {
    const latest = summary.latestActivity
      ? `${labels.lastActivity}: ${formatDateTime(summary.latestActivity.toISOString())}`
      : labels.noLastActivity;
    const openPreview = summary.openAssignments.slice(0, 2).map(item =>
      item.article?.title || item.assignment.articleTitle || item.assignment.articleId
    );
    const openText = openPreview.length
      ? openPreview.join(", ") + (summary.openAssignments.length > openPreview.length ? ` +${summary.openAssignments.length - openPreview.length}` : "")
      : labels.noOpenAssignments;
    const inactivePill = summary.inactive
      ? `<span class="dashboard-pill status-inactive">${escapeHtml(labels.inactive)}</span>`
      : `<span class="dashboard-pill status-active">${escapeHtml(labels.active)}</span>`;
    const openClass = summary.openAssignments.length ? "has-open" : "all-done";
    const studentManagedTeamIds = new Set(state.teamMemberships
      .filter(membership => membership.profileId === summary.profile.id)
      .map(membership => membership.teamId));
    const selectedTeamId = managedTeams.find(team => studentManagedTeamIds.has(team.id))?.id || "";
    const studentManagement = hasTeacherLicense() && summary.profile.role === "student" ? `
      <section class="dashboard-student-management">
        <label class="field-row compact">
          ${escapeHtml(t("studentClass"))}
          <select data-student-team="${escapeHtml(summary.profile.id)}">
            <option value="">${escapeHtml(t("noClass"))}</option>
            ${managedTeams.map(team => `<option value="${escapeHtml(team.id)}" ${team.id === selectedTeamId ? "selected" : ""}>${escapeHtml(team.name)}</option>`).join("")}
          </select>
        </label>
        <div class="editor-actions">
          <button class="secondary-btn quiet compact" type="button" data-student-action="remove" data-profile-id="${escapeHtml(summary.profile.id)}">${escapeHtml(t("removeFromMyStudents"))}</button>
          ${canDeleteStudentAccounts ? `<button class="text-btn danger-text" type="button" data-student-action="delete-account" data-profile-id="${escapeHtml(summary.profile.id)}">${escapeHtml(t("deleteStudentAccount"))}</button>` : ""}
        </div>
      </section>
    ` : "";

    return `
      <details class="dashboard-student ${openClass} ${summary.inactive ? "is-inactive" : ""}">
        <summary class="dashboard-student-summary">
          <span class="dashboard-student-main">
            <strong>${escapeHtml(summary.title)}</strong>
            <small>${escapeHtml(latest)}</small>
          </span>
          <span class="dashboard-student-status">
            ${inactivePill}
            <span><strong>${summary.openAssignments.length}</strong> ${escapeHtml(labels.open)}</span>
            <span><strong>${summary.doneAssignments.length}/${summary.assignments.length}</strong> ${escapeHtml(labels.done)}</span>
          </span>
          <span class="dashboard-student-open">
            <small>${escapeHtml(labels.assignedOpen)}</small>
            <span>${escapeHtml(openText)}</span>
          </span>
          <span class="dashboard-detail-link">${escapeHtml(labels.details)}</span>
        </summary>
        <div class="dashboard-student-detail">
          <div class="dashboard-detail-grid">
            <section>
              <h4>${escapeHtml(labels.unfinishedAssignments)}</h4>
              ${summary.openAssignments.length
                ? `<ul class="dashboard-assignment-list">${summary.openAssignments.map(buildAssignmentItem).join("")}</ul>`
                : `<p class="muted">${escapeHtml(labels.noOpenAssignments)}</p>`}
            </section>
            <section>
              <h4>${escapeHtml(labels.doneAssignments)}</h4>
              ${summary.doneAssignments.length
                ? `<ul class="dashboard-assignment-list">${summary.doneAssignments.map(buildAssignmentItem).join("")}</ul>`
                : `<p class="muted">${escapeHtml(labels.noDoneAssignments)}</p>`}
            </section>
          </div>
          <section>
            <h4>${escapeHtml(labels.otherActivity)}</h4>
            ${summary.otherActiveArticles.length
              ? summary.otherActiveArticles.map(buildArticleDetail).join("")
              : `<p class="muted">${escapeHtml(labels.noOtherActivity)}</p>`}
          </section>
          ${studentManagement}
        </div>
      </details>
    `;
  };

  const buildClassSummary = summaries => {
    const totalAssignments = summaries.reduce((sum, item) => sum + item.assignments.length, 0);
    const doneAssignments = summaries.reduce((sum, item) => sum + item.doneAssignments.length, 0);
    const openAssignments = summaries.reduce((sum, item) => sum + item.openAssignments.length, 0);
    const inactiveCount = summaries.filter(item => item.inactive).length;
    const activeCount = summaries.length - inactiveCount;
    return `
      <section class="dashboard-class-summary">
        <div class="dashboard-stat"><strong>${summaries.length}</strong><span>${escapeHtml(labels.students)}</span></div>
        <div class="dashboard-stat"><strong>${activeCount}</strong><span>${escapeHtml(labels.activeStudents)}</span></div>
        <div class="dashboard-stat"><strong>${inactiveCount}</strong><span>${escapeHtml(labels.inactiveStudents)}</span></div>
        <div class="dashboard-stat"><strong>${doneAssignments}/${totalAssignments}</strong><span>${escapeHtml(labels.assignedDone)}</span></div>
        <div class="dashboard-stat"><strong>${openAssignments}</strong><span>${escapeHtml(labels.assignedOpen)}</span></div>
      </section>
    `;
  };

  const buildDashboard = (title, summaries, includeSummary = true, metaLabel = labels.classSummary) => `
    <section class="overview-section dashboard-card">
      <div class="dashboard-header">
        <div>
          <h3>${escapeHtml(title)}</h3>
          <p class="dashboard-meta">${escapeHtml(metaLabel)}</p>
        </div>
      </div>
      ${includeSummary ? buildClassSummary(summaries) : ""}
      <div class="dashboard-student-list">
        ${summaries.length ? summaries.map(buildProfileRow).join("") : `<p class="muted">${escapeHtml(labels.noStudents)}</p>`}
      </div>
    </section>
  `;

  const sections = [];

  if (hasTeacherLicense()) {
    const students = state.profiles.filter(profile => profile.role === "student" && isInCurrentTeacherGroup(profile));
    const studentSummaries = await Promise.all(students.map(student => buildProfileSummary(student, student.name)));
    const summariesById = new Map(studentSummaries.map(summary => [summary.profile.id, summary]));
    if (teacherOverviewMode === "classes" && managedTeams.length) {
      managedTeams.forEach(team => {
        const classSummaries = getTeamMembers(team.id)
          .filter(profile => profile.role === "student")
          .map(profile => summariesById.get(profile.id))
          .filter(Boolean);
        sections.push(buildDashboard(team.name, classSummaries));
      });
    } else if (teacherOverviewMode === "classes") {
      sections.push(`<section class="overview-section dashboard-card"><p class="muted">${escapeHtml(t("noClasses"))}</p></section>`);
    } else {
      sections.push(buildDashboard(t("studentOverview"), studentSummaries));
    }
  } else {
    const ownSummary = await buildProfileSummary(state.currentProfile, t("myProgress"));
    sections.push(buildDashboard(t("myProgress"), [ownSummary], false, labels.assignmentSummary));
  }

  if (isAdmin && teacherOverviewMode === "students") {
    const otherProfiles = state.profiles
      .filter(profile => profile.id !== state.currentProfile.id)
      .filter(profile => (profile.teacherGroupId || profile.id) !== currentGroupId)
      .sort((a, b) =>
        String(a.teacherGroupId || a.id).localeCompare(String(b.teacherGroupId || b.id), "sk")
        || a.role.localeCompare(b.role, "sk")
        || a.name.localeCompare(b.name, "sk")
      );

    if (otherProfiles.length) {
      const otherSummaries = await Promise.all(otherProfiles.map(profile => buildProfileSummary(profile, profileTitle(profile))));
      sections.push(buildDashboard(t("otherProfilesTitle"), otherSummaries));
    }
  }

  const overviewSwitch = hasTeacherLicense() ? `
    <div class="overview-mode-switch" role="group" aria-label="${escapeHtml(t("overviewMode"))}">
      <button class="secondary-btn ${teacherOverviewMode === "students" ? "active" : "quiet"}" type="button" data-overview-mode="students">${escapeHtml(t("studentsTab"))}</button>
      ${managedTeams.length ? `<button class="secondary-btn ${teacherOverviewMode === "classes" ? "active" : "quiet"}" type="button" data-overview-mode="classes">${escapeHtml(t("classesTab"))}</button>` : ""}
    </div>
    <p id="teacherOverviewStatus" class="muted overview-status" aria-live="polite"></p>
  ` : "";
  root.innerHTML = overviewSwitch + (sections.join("") || `<p class="muted">${escapeHtml(t("noStudentsInGroup"))}</p>`);
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
