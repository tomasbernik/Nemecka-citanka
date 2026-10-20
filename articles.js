async function loadArticles() {
  const cacheLanguage = getArticleCacheLanguage();
  const cachedArticles = await loadCachedArticles(cacheLanguage);

  if (state.remoteReady) {
    try {
      const remoteArticles = await loadRemoteArticles();
      if (remoteArticles.length) {
        state.articles = remoteArticles.map(normalizeArticle);
        await saveCachedArticles(state.articles, cacheLanguage);
      } else {
        state.articles = cachedArticles.map(normalizeArticle);
        await seedLocalArticlesToRemote();
      }
    } catch (error) {
      console.error(error);
      const fallbackArticles = cachedArticles.length ? cachedArticles : await loadLocalSeedArticles();
      state.articles = fallbackArticles.map(normalizeArticle);
    }
  } else {
    const localArticles = await loadLocalSeedArticles();
    state.articles = mergeArticles(localArticles, cachedArticles).map(normalizeArticle);
  }

  renderCategories();
  renderLevelFilters();
  renderArticles();
}

async function loadLocalSeedArticles() {
  try {
    const response = await fetch("articles.json", { cache: "no-store" });
    return await response.json();
  } catch (error) {
    console.error(error);
    return [];
  }
}

async function seedLocalArticlesToRemote() {
  const localArticles = await loadLocalSeedArticles();
  if (!localArticles.length) return;

  await saveRemoteArticles(localArticles, { preserveUpdatedAt: true });
  const remoteArticles = await loadRemoteArticles();
  if (remoteArticles.length) {
    state.articles = remoteArticles.map(normalizeArticle);
    await saveCachedArticles(state.articles);
  }
}

async function loadRemoteArticles() {
  let publishedRows;
  try {
    publishedRows = await supabaseRequest("app_articles?select=*&published=eq.true&approval_status=eq.approved&order=display_order.asc.nullslast,updated_at.desc,title.asc");
  } catch (error) {
    if (!error?.message?.includes("display_order")) throw error;
    publishedRows = await supabaseRequest("app_articles?select=*&published=eq.true&approval_status=eq.approved&order=updated_at.desc,title.asc");
  }
  let manageableRows = [];

  if (state.authUser) {
    try {
      manageableRows = await supabaseRequest("rpc/app_manageable_articles", {
        method: "POST",
        body: "{}"
      }) || [];
    } catch (error) {
      console.info("Manageable article lookup skipped:", error.message);
    }
  }

  const rows = new Map();
  [...(publishedRows || []), ...manageableRows].forEach(row => rows.set(row.id, row));
  return Array.from(rows.values()).map(rowToArticle);
}

function mergeArticles(...articleGroups) {
  const merged = new Map();

  articleGroups.flat().filter(Boolean).forEach(article => {
    merged.set(article.id, article);
  });

  return Array.from(merged.values());
}

function getArticleCacheLanguage() {
  if (state.currentProfile) return getNativeLanguage(state.currentProfile);

  const savedProfileId = localStorage.getItem(CURRENT_PROFILE_KEY);
  const storedLanguage = typeof getStoredProfileLanguage === "function"
    ? getStoredProfileLanguage(savedProfileId)
    : null;
  const savedProfileLanguage = state.profiles
    .find(profile => profile.id === savedProfileId)
    ?.nativeLanguage;

  return [storedLanguage, savedProfileLanguage, state.preLoginLanguage, DEFAULT_NATIVE_LANGUAGE]
    .find(isSupportedNativeLanguage) || DEFAULT_NATIVE_LANGUAGE;
}

function getArticleCacheKey(language = getArticleCacheLanguage()) {
  return `${ARTICLE_CACHE_KEY}:${language}`;
}

function getArticleLocalStorageCacheKey(language = getArticleCacheLanguage()) {
  return `${ARTICLE_CACHE_LOCAL_STORAGE_KEY}:${language}`;
}

function openArticleCacheDb() {
  if (!("indexedDB" in window)) return Promise.resolve(null);

  return new Promise(resolve => {
    const request = indexedDB.open(ARTICLE_CACHE_DB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(ARTICLE_CACHE_STORE_NAME, { keyPath: "key" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
    request.onblocked = () => resolve(null);
  });
}

async function loadCachedArticles(language = getArticleCacheLanguage()) {
  const localStorageKey = getArticleLocalStorageCacheKey(language);
  const fallback = () => {
    try {
      return JSON.parse(localStorage.getItem(localStorageKey) || "[]");
    } catch (error) {
      console.info("Article cache fallback skipped:", error.message);
      return [];
    }
  };
  const db = await openArticleCacheDb();
  if (!db) return fallback();

  return new Promise(resolve => {
    const transaction = db.transaction(ARTICLE_CACHE_STORE_NAME, "readonly");
    const request = transaction.objectStore(ARTICLE_CACHE_STORE_NAME).get(getArticleCacheKey(language));
    request.onsuccess = () => resolve(request.result?.articles || fallback());
    request.onerror = () => resolve(fallback());
    transaction.oncomplete = () => db.close();
  });
}

function pickLanguageValue(values = {}, language) {
  if (!values || typeof values !== "object") return {};
  return values[language] ? { [language]: values[language] } : {};
}

function trimCategoryLabelsForCache(categoryLabels = {}, language) {
  return Object.fromEntries(
    Object.entries(categoryLabels)
      .map(([category, labels]) => [category, pickLanguageValue(labels, language)])
      .filter(([, labels]) => Object.keys(labels).length)
  );
}

function trimVocabularyItemForCache(item = {}, language) {
  const trimmed = {
    de: item.de || "",
    base: item.base || ""
  };

  if (item[language]) {
    trimmed[language] = item[language];
  } else if (language === DEFAULT_NATIVE_LANGUAGE && item.translation) {
    trimmed.translation = item.translation;
  }

  return trimmed;
}

function trimArticleForCache(article, language) {
  const normalized = normalizeArticle(article);
  return {
    ...normalized,
    categoryLabels: trimCategoryLabelsForCache(normalized.categoryLabels, language),
    vocabulary: (normalized.vocabulary || []).map(item => trimVocabularyItemForCache(item, language)),
    inlineVocabulary: getInlineVocabulary(normalized).map(item => trimVocabularyItemForCache(item, language))
  };
}

async function saveCachedArticles(articles, language = getArticleCacheLanguage()) {
  const normalizedArticles = articles.map(article => trimArticleForCache(article, language));
  const localStorageKey = getArticleLocalStorageCacheKey(language);

  try {
    VOCABULARY_LANGUAGE_CODES
      .filter(code => code !== language)
      .forEach(code => localStorage.removeItem(getArticleLocalStorageCacheKey(code)));
    localStorage.setItem(localStorageKey, JSON.stringify(normalizedArticles));
    localStorage.removeItem(ARTICLE_CACHE_LOCAL_STORAGE_KEY);
  } catch (error) {
    console.info("Article cache localStorage fallback skipped:", error.message);
  }

  const db = await openArticleCacheDb();
  if (!db) return;

  return new Promise(resolve => {
    const transaction = db.transaction(ARTICLE_CACHE_STORE_NAME, "readwrite");
    const store = transaction.objectStore(ARTICLE_CACHE_STORE_NAME);
    store.delete(ARTICLE_CACHE_KEY);
    VOCABULARY_LANGUAGE_CODES
      .filter(code => code !== language)
      .forEach(code => store.delete(getArticleCacheKey(code)));
    store.put({
      key: getArticleCacheKey(language),
      savedAt: new Date().toISOString(),
      language,
      articles: normalizedArticles
    });
    transaction.oncomplete = () => {
      db.close();
      resolve();
    };
    transaction.onerror = () => {
      db.close();
      resolve();
    };
  });
}

function normalizeArticle(article) {
  const displayOrder = article.displayOrder ?? article.display_order;
  const chapterOrder = article.chapterOrder ?? article.chapter_order;
  return {
    ...article,
    language: article.language || "de",
    variantGroupId: article.variantGroupId || article.variant_group_id || getInferredArticleVariantGroupId(article),
    ownerProfileId: article.ownerProfileId || article.owner_profile_id || null,
    teamId: article.teamId || article.team_id || null,
    teacherGroupId: article.teacherGroupId || article.teacher_group_id || null,
    categoryLabels: article.categoryLabels || article.category_labels || {},
    image: article.image || null,
    visibility: article.visibility || "public",
    approvalStatus: article.approvalStatus || article.approval_status || "approved",
    displayOrder: displayOrder !== null && displayOrder !== undefined && Number.isFinite(Number(displayOrder))
      ? Number(displayOrder)
      : null,
    seriesId: article.seriesId || article.series_id || null,
    seriesTitle: article.seriesTitle || article.series_title || null,
    chapterOrder: chapterOrder !== null && chapterOrder !== undefined && Number.isFinite(Number(chapterOrder))
      ? Number(chapterOrder)
      : null,
    published: article.published !== false
  };
}

function canViewArticle(article, profile = state.currentProfile) {
  return Boolean(article?.published && article.visibility === "public" && article.approvalStatus === "approved");
}

function isInCurrentTeacherGroup(profile, teamId = null) {
  if (!state.currentProfile || !profile) return false;
  if (isPublisherAccount()) {
    const relevantTeamIds = teamId
      ? new Set([teamId])
      : new Set(getManagedTeams().map(team => team.id));
    return state.teamMemberships.some(membership =>
      relevantTeamIds.has(membership.teamId) && membership.profileId === profile.id
    );
  }
  if (state.currentProfile.role !== "teacher") return profile.id === state.currentProfile.id;
  const relevantTeamIds = teamId
    ? new Set([teamId])
    : new Set(getManagedTeams().map(team => team.id));
  return state.teamMemberships.some(membership =>
    relevantTeamIds.has(membership.teamId)
    && membership.profileId === profile.id
    && profile.id !== state.currentProfile.id
  );
}

function getVisibleArticles() {
  return state.articles.filter(article => canViewArticle(article));
}

function getArticleLanguage(article) {
  return ARTICLE_LANGUAGES[article?.language] ? article.language : DEFAULT_ARTICLE_LANGUAGE;
}

function getArticleLanguageLabel(language) {
  return ARTICLE_LANGUAGES[language]?.label || String(language || "").toUpperCase();
}

function getInferredArticleVariantGroupId(article = {}) {
  const id = article.id || "";
  if (id === "en-a-very-big-breakfast-on-saturday") return "ein-sehr-gro-es-fruhstuck-am-samstag";
  if (id === "en-the-vanished-server") return "der-verschwundene-server";
  return id.replace(/^en-/, "");
}

function getSelectedArticleLanguage() {
  return ARTICLE_LANGUAGES[state.selectedArticleLanguage]
    ? state.selectedArticleLanguage
    : DEFAULT_ARTICLE_LANGUAGE;
}

function getHomeArticles() {
  const language = getSelectedArticleLanguage();
  return getVisibleArticles().filter(article => getArticleLanguage(article) === language);
}

function compareArticleDisplayOrder(a, b) {
  const aOrder = Number.isFinite(a?.displayOrder) ? a.displayOrder : Number.MAX_SAFE_INTEGER;
  const bOrder = Number.isFinite(b?.displayOrder) ? b.displayOrder : Number.MAX_SAFE_INTEGER;
  return aOrder - bOrder
    || String(b?.updatedAt || "").localeCompare(String(a?.updatedAt || ""))
    || String(a?.title || "").localeCompare(String(b?.title || ""), "sk");
}

function compareChapterOrder(a, b) {
  const aOrder = Number.isFinite(a?.chapterOrder) ? a.chapterOrder : Number.MAX_SAFE_INTEGER;
  const bOrder = Number.isFinite(b?.chapterOrder) ? b.chapterOrder : Number.MAX_SAFE_INTEGER;
  return aOrder - bOrder || compareArticleDisplayOrder(a, b);
}

function getSeriesArticles(seriesId, articles = getHomeArticles()) {
  if (!seriesId) return [];
  return articles.filter(article => article.seriesId === seriesId).sort(compareChapterOrder);
}

function getArticleDisplayEntries(articles = getHomeArticles()) {
  const entries = [];
  const seenSeries = new Set();
  [...articles].sort(compareArticleDisplayOrder).forEach(article => {
    if (!article.seriesId) {
      entries.push({ type: "article", id: article.id, article, articles: [article] });
      return;
    }
    if (seenSeries.has(article.seriesId)) return;
    seenSeries.add(article.seriesId);
    const chapters = getSeriesArticles(article.seriesId, articles);
    const firstChapter = chapters[0] || article;
    entries.push({
      type: "series",
      id: article.seriesId,
      title: firstChapter.seriesTitle || firstChapter.title,
      article: firstChapter,
      articles: chapters,
      displayOrder: Math.min(...chapters.map(chapter => Number.isFinite(chapter.displayOrder) ? chapter.displayOrder : Number.MAX_SAFE_INTEGER))
    });
  });
  return entries.sort((a, b) => compareArticleDisplayOrder(
    { ...a.article, displayOrder: a.displayOrder ?? a.article.displayOrder },
    { ...b.article, displayOrder: b.displayOrder ?? b.article.displayOrder }
  ));
}

function isAdminProfile(profile = state.currentProfile) {
  return Boolean(profile?.id && ADMIN_PROFILE_IDS.has(profile.id));
}

function isPublisherAccount() {
  const email = state.authUser?.email || state.authUser?.user_metadata?.email || "";
  return email.trim().toLowerCase() === PUBLISHER_EMAIL;
}

function canModerateArticle(article, profile = state.currentProfile) {
  if (!article || !profile || !state.authUser) return false;
  if (isPublisherAccount()) return true;
  if (!hasTeacherLicense(profile)) return false;
  return article.ownerProfileId === profile.id;
}

function getModeratableArticles() {
  return state.articles.filter(article => canModerateArticle(article));
}

function canEditArticle(article, profile = state.currentProfile) {
  if (!article || !profile) return false;
  return isPublisherAccount()
    || (isProfileOwnedByCurrentAuth(profile) && article.ownerProfileId === profile.id);
}

function canDeleteArticle(article, profile = state.currentProfile) {
  return canEditArticle(article, profile);
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

function omitArticleRowColumns(row, columns) {
  return Object.fromEntries(
    Object.entries(row).filter(([column]) => !columns.includes(column))
  );
}

async function saveArticleRows(rows) {
  try {
    return await supabaseRequest("app_articles?on_conflict=id", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify(rows)
    });
  } catch (error) {
    const missingColumns = [
      ...(isMissingCategoryLabelsColumn(error) ? ["category_labels"] : []),
      ...(error?.message?.includes("language") ? ["language"] : []),
      ...(error?.message?.includes("variant_group_id") ? ["variant_group_id"] : []),
      ...(["display_order", "series_id", "series_title", "chapter_order"].filter(column => error?.message?.includes(column)))
    ];
    if (!missingColumns.length) throw error;
    return await supabaseRequest("app_articles?on_conflict=id", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify(rows.map(row => omitArticleRowColumns(row, missingColumns)))
    });
  }
}

async function insertArticleRow(row) {
  const rows = await saveArticleRows([row]);
  return rows?.[0] || null;
}

async function updateArticleRow(row) {
  const { id, ...changes } = row;
  const update = async payload => supabaseRequest(`app_articles?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(payload)
  });

  try {
    const rows = await update(changes);
    return rows?.[0] || null;
  } catch (error) {
    const missingColumns = [
      ...(isMissingCategoryLabelsColumn(error) ? ["category_labels"] : []),
      ...(error?.message?.includes("language") ? ["language"] : []),
      ...(error?.message?.includes("variant_group_id") ? ["variant_group_id"] : []),
      ...(["display_order", "series_id", "series_title", "chapter_order"].filter(column => error?.message?.includes(column)))
    ];
    if (!missingColumns.length) throw error;
    const rows = await update(omitArticleRowColumns(changes, missingColumns));
    return rows?.[0] || null;
  }
}

function rowToArticle(row) {
  return {
    id: row.id,
    language: row.language || "de",
    variantGroupId: row.variant_group_id || getInferredArticleVariantGroupId(row),
    ownerProfileId: row.owner_profile_id || null,
    teamId: row.team_id || null,
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
    displayOrder: row.display_order ?? null,
    seriesId: row.series_id || null,
    seriesTitle: row.series_title || null,
    chapterOrder: row.chapter_order ?? null,
    updatedAt: row.updated_at || null,
    published: row.published === true
  };
}

function articleToRow(article, options = {}) {
  const row = {
    id: article.id,
    language: article.language || "de",
    variant_group_id: article.variantGroupId || getInferredArticleVariantGroupId(article),
    owner_profile_id: article.ownerProfileId || null,
    team_id: article.teamId || null,
    teacher_group_id: article.teacherGroupId || null,
    visibility: "public",
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
    display_order: article.displayOrder ?? null,
    series_id: article.seriesId || null,
    series_title: article.seriesTitle || null,
    chapter_order: article.chapterOrder ?? null,
    published: article.published !== false
  };

  if (!options.preserveUpdatedAt) {
    row.updated_at = new Date().toISOString();
  }

  return row;
}

async function updateArticleOrganization(articleId, changes) {
  if (!isPublisherAccount()) throw new Error(t("adminOnlyAction"));
  const has = key => Object.prototype.hasOwnProperty.call(changes, key);
  const payload = {
    ...(has("displayOrder") ? { display_order: changes.displayOrder } : {}),
    ...(has("seriesId") ? { series_id: changes.seriesId } : {}),
    ...(has("seriesTitle") ? { series_title: changes.seriesTitle } : {}),
    ...(has("chapterOrder") ? { chapter_order: changes.chapterOrder } : {})
  };
  const rows = await supabaseRequest(`app_articles?id=eq.${encodeURIComponent(articleId)}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(payload)
  });
  const updated = rows?.[0];
  if (!updated) return null;
  const article = normalizeArticle(rowToArticle(updated));
  const index = state.articles.findIndex(item => item.id === article.id);
  if (index >= 0) state.articles[index] = article;
  return article;
}

async function saveArticleDisplayEntries(entries) {
  await Promise.all(entries.flatMap((entry, displayOrder) =>
    entry.articles.map(article => updateArticleOrganization(article.id, { displayOrder }))
  ));
  await saveCachedArticles(state.articles);
  renderArticles();
}

async function createArticleSeries(title, articleIds) {
  const cleanTitle = String(title || "").trim();
  const uniqueIds = [...new Set(articleIds)].filter(Boolean);
  if (!cleanTitle || uniqueIds.length < 2) throw new Error(t("seriesNeedsTwoArticles"));
  const seriesId = `${makeArticleId(cleanTitle) || "series"}-${Date.now().toString(36)}`;
  const selected = uniqueIds
    .map(id => state.articles.find(article => article.id === id))
    .filter(Boolean)
    .sort(compareArticleDisplayOrder);
  if (selected.length < 2) throw new Error(t("seriesNeedsTwoArticles"));
  if (new Set(selected.map(getArticleLanguage)).size > 1) throw new Error(t("seriesNeedsSameLanguage"));
  const displayOrder = Math.min(...selected.map(article => Number.isFinite(article.displayOrder) ? article.displayOrder : Number.MAX_SAFE_INTEGER));
  await Promise.all(selected.map((article, chapterOrder) => updateArticleOrganization(article.id, {
    seriesId,
    seriesTitle: cleanTitle,
    chapterOrder,
    displayOrder: Number.isFinite(displayOrder) ? displayOrder : 0
  })));
  await saveCachedArticles(state.articles);
  renderArticles();
  return seriesId;
}

async function dissolveArticleSeries(seriesId) {
  const chapters = state.articles.filter(article => article.seriesId === seriesId).sort(compareChapterOrder);
  await Promise.all(chapters.map((article, offset) => updateArticleOrganization(article.id, {
    seriesId: null,
    seriesTitle: null,
    chapterOrder: null,
    displayOrder: (Number.isFinite(article.displayOrder) ? article.displayOrder : 0) + offset
  })));
  await saveCachedArticles(state.articles);
  renderArticles();
}

async function removeArticleFromSeries(articleId) {
  const article = state.articles.find(item => item.id === articleId);
  if (!article?.seriesId) return;
  const seriesId = article.seriesId;
  await updateArticleOrganization(articleId, { seriesId: null, seriesTitle: null, chapterOrder: null });
  const remaining = state.articles.filter(item => item.seriesId === seriesId).sort(compareChapterOrder);
  if (remaining.length < 2) {
    await Promise.all(remaining.map(item => updateArticleOrganization(item.id, {
      seriesId: null,
      seriesTitle: null,
      chapterOrder: null
    })));
  } else {
    await Promise.all(remaining.map((item, chapterOrder) => updateArticleOrganization(item.id, { chapterOrder })));
  }
  await saveCachedArticles(state.articles);
  renderArticles();
}

async function saveArticle(article) {
  if (!state.remoteReady) {
    throw new Error(t("editorNeedsSupabase"));
  }

  article = normalizeArticle(article);

  const existingArticle = state.articles.find(item => item.id === article.id);
  const row = articleToRow(article);
  const savedRow = existingArticle
    ? await updateArticleRow(row)
    : await insertArticleRow(row);
  if (savedRow) article = normalizeArticle(rowToArticle(savedRow));

  const index = state.articles.findIndex(item => item.id === article.id);
  if (index >= 0) {
    state.articles[index] = article;
  } else {
    state.articles = [article, ...state.articles];
  }
  await saveCachedArticles(state.articles);
  renderCategories();
  renderLevelFilters();
  renderArticles();
  renderArticleCategoryOptionsMulti(article.category);
  renderArticleEditorList(article.id);
}

async function setArticleApprovalStatus(articleId, approvalStatus) {
  const rows = await supabaseRequest("rpc/app_set_article_approval", {
    method: "POST",
    body: JSON.stringify({ target_article_id: articleId, target_status: approvalStatus })
  });
  const updated = Array.isArray(rows) ? rows[0] : rows;
  if (!updated) return null;
  const article = normalizeArticle(rowToArticle(updated));
  const index = state.articles.findIndex(item => item.id === article.id);
  if (index >= 0) state.articles[index] = article;
  return article;
}

async function setArticlePublished(articleId, published) {
  const rows = await supabaseRequest("rpc/app_set_article_published", {
    method: "POST",
    body: JSON.stringify({ target_article_id: articleId, target_published: published })
  });
  const updated = Array.isArray(rows) ? rows[0] : rows;
  if (!updated) return null;
  const article = normalizeArticle(rowToArticle(updated));
  const index = state.articles.findIndex(item => item.id === article.id);
  if (index >= 0) state.articles[index] = article;
  return article;
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

function renderArticleLanguageControls() {
  const select = $("settingsArticleLanguageSelect");
  if (!select) return;

  select.innerHTML = Object.entries(ARTICLE_LANGUAGES)
    .map(([code, language]) => `<option value="${escapeHtml(code)}">${escapeHtml(language.label)}</option>`)
    .join("");
  select.value = getSelectedArticleLanguage();
}

function setSelectedArticleLanguage(language) {
  if (!ARTICLE_LANGUAGES[language] || language === getSelectedArticleLanguage()) return;
  state.selectedArticleLanguage = language;
  localStorage.setItem(ARTICLE_LANGUAGE_KEY, language);
  state.selectedCategory = ALL_CATEGORIES;
  state.selectedLevel = ALL_LEVELS;
  renderArticleLanguageControls();
  updateTeachingLanguageBrand();
  renderCategories();
  renderLevelFilters();
  renderArticles();
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
  const entries = getArticleDisplayEntries().filter(entry => entry.articles.some(article => {
    const levelMatches = state.selectedLevel === ALL_LEVELS
      || normalizeArticleLevel(article.level) === state.selectedLevel;
    if (!levelMatches) return false;
    if (state.selectedCategory === ALL_CATEGORIES) return true;
    if (state.selectedCategory === UNREAD_CATEGORY) {
      return !state.profileData.readIds.includes(article.id);
    }
    return getArticleCategoriesForFilter(article).includes(state.selectedCategory);
  }));
  root.innerHTML = "";

  if (!entries.length) {
    root.innerHTML = `<p class="muted">${escapeHtml(t("noArticles"))}</p>`;
    return;
  }

  entries.forEach((entry, index) => {
    const article = entry.article;
    const isSeries = entry.type === "series";
    const isRead = entry.articles.every(item => state.profileData.readIds.includes(item.id));
    const showStartBadge = index === 0 && state.currentProfile?.role !== "teacher" && !isOnboardingDone("studentIntroDone");
    const image = article.image || {};
    const imageSrc = image.desktop || `images/articles/${article.id}.jpg`;
    const imageAlt = image.alt || article.title || "";
    const btn = document.createElement("button");
    btn.className = "article-card";
    btn.innerHTML = `
      <img class="article-card-thumb" src="${escapeHtml(imageSrc)}" alt="${escapeHtml(imageAlt)}" loading="lazy">
      <div class="article-card-body">
        <h4>${escapeHtml(isSeries ? entry.title : article.title)}</h4>
        <p>${escapeHtml(article.summary)}</p>
        <div class="badges">
          <span class="badge">${escapeHtml(article.level)}</span>
          ${isSeries ? `<span class="badge series-badge">${escapeHtml(formatText("chapterCount", { count: entry.articles.length }))}</span>` : ""}
          ${showStartBadge ? `<span class="badge start-badge">${escapeHtml(t("startHere"))}</span>` : ""}
          ${getArticleCategoriesForFilter(article).map(category => `<span class="badge">${escapeHtml(getCategoryLabel(category))}</span>`).join("")}
          ${entry.articles.some(item => isArticleAssignedToProfile(item.id)) ? `<span class="badge">${escapeHtml(t("assignedBadge"))}</span>` : ""}
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
