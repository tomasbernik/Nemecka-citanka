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
    categoryLabels: article.categoryLabels || article.category_labels || {},
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

function getHomeArticles() {
  const visibleArticles = getVisibleArticles();
  if (!state.currentProfile || state.currentProfile.role === "teacher") return visibleArticles;

  const openAssignmentArticleIds = new Set(
    getAssignments()
      .filter(assignment => !state.profileData.readIds.includes(assignment.articleId))
      .map(assignment => assignment.articleId)
  );
  return visibleArticles.filter(article => openAssignmentArticleIds.has(article.id));
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

  await saveArticleRows(articles.map(article => articleToRow(article, options)));
}

function isMissingCategoryLabelsColumn(error) {
  return error?.message?.includes("category_labels");
}

async function saveArticleRows(rows) {
  try {
    await supabaseRequest("app_articles?on_conflict=id", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates" },
      body: JSON.stringify(rows)
    });
  } catch (error) {
    if (!isMissingCategoryLabelsColumn(error)) throw error;
    await supabaseRequest("app_articles?on_conflict=id", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates" },
      body: JSON.stringify(rows.map(({ category_labels, ...row }) => row))
    });
  }
}

async function insertArticleRow(row) {
  await saveArticleRows([row]);
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
    categoryLabels: row.category_labels || {},
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
    category_labels: article.categoryLabels || {},
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

  await insertArticleRow(articleToRow(article));

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

  getHomeArticles().forEach(article => {
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
  getHomeArticles().forEach(article => {
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
  if (!root) return;

  root.classList.add("filter-select-wrap");
  root.innerHTML = `
    <label class="filter-select-label">
      <span>${escapeHtml(t("topics"))}</span>
      <select id="categoryFilterSelect" class="filter-select"></select>
    </label>
  `;

  const select = $("categoryFilterSelect");
  select.innerHTML = categories
    .map(category => `<option value="${escapeHtml(category)}">${escapeHtml(category === ALL_CATEGORIES ? t("allTopics") : getCategoryLabel(category))}</option>`)
    .join("");
  select.value = categories.includes(state.selectedCategory) ? state.selectedCategory : ALL_CATEGORIES;
  if (select.value !== state.selectedCategory) state.selectedCategory = select.value;
  select.onchange = () => {
    state.selectedCategory = select.value;
    renderCategories();
    renderArticles();
  };
}

function renderLevelFilters() {
  const root = $("levelFilters");
  if (!root) return;
  const levels = getArticleLevels();

  root.classList.add("filter-select-wrap");
  root.innerHTML = `
    <label class="filter-select-label">
      <span>${escapeHtml(t("level"))}</span>
      <select id="levelFilterSelect" class="filter-select"></select>
    </label>
  `;

  const select = $("levelFilterSelect");
  select.innerHTML = levels
    .map(level => `<option value="${escapeHtml(level)}">${escapeHtml(level === ALL_LEVELS ? t("allLevels") : level)}</option>`)
    .join("");
  select.value = levels.includes(state.selectedLevel) ? state.selectedLevel : ALL_LEVELS;
  if (select.value !== state.selectedLevel) state.selectedLevel = select.value;
  select.onchange = () => {
    state.selectedLevel = select.value;
    renderLevelFilters();
    renderArticles();
  };
}

function getArticleApprovalBadge(article) {
  if (article.visibility !== "public" || article.approvalStatus === "approved") return "";
  const labelKey = ["draft", "pending", "rejected"].includes(article.approvalStatus)
    ? article.approvalStatus
    : "pendingApproval";
  return `<span class="badge">${escapeHtml(t(labelKey))}</span>`;
}

function renderArticles() {
  const root = $("articleList");
  const articles = getHomeArticles().filter(article => {
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

  if (!articles.length) {
    root.innerHTML = `<p class="muted">${escapeHtml(t("noOpenAssignments"))}</p>`;
    return;
  }

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
          ${showStartBadge ? `<span class="badge start-badge">${escapeHtml(t("startHere"))}</span>` : ""}
          ${getArticleCategoriesForFilter(article).map(category => `<span class="badge">${escapeHtml(getCategoryLabel(category))}</span>`).join("")}
          ${isArticleAssignedToProfile(article.id) ? `<span class="badge">${escapeHtml(t("assignedBadge"))}</span>` : ""}
          ${article.visibility === "private" ? `<span class="badge">${escapeHtml(t("private"))}</span>` : ""}
          ${getArticleApprovalBadge(article)}
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
