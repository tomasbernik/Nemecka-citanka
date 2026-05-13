
const state = {
  articles: [],
  selectedCategory: "Všetky",
  currentArticle: null,
  readIds: JSON.parse(localStorage.getItem("readIds") || "[]"),
  discoveredVocabulary: JSON.parse(localStorage.getItem("discoveredVocabulary") || "{}")
};

const $ = (id) => document.getElementById(id);

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
    const isRead = state.readIds.includes(article.id);
    const btn = document.createElement("button");
    btn.className = "article-card";
    btn.innerHTML = `
      <h4>${article.title}</h4>
      <p>${article.summary}</p>
      <div class="badges">
        <span class="badge">${article.level}</span>
        <span class="badge">${article.category}</span>
        <span class="badge">${article.minutes} min</span>
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

function getInlineVocabulary(article) {
  return article.inlineVocabulary || article.clickVocabulary || [];
}

function getSavedVocabulary(article) {
  if (!article) return [];
  return state.discoveredVocabulary[article.id] || [];
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

function saveDiscoveredVocabulary() {
  localStorage.setItem("discoveredVocabulary", JSON.stringify(state.discoveredVocabulary));
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

  if (!words.length) {
    $("articleText").innerHTML = article.text.map(p => `<p>${escapeHtml(p)}</p>`).join("");
    return;
  }

  const pattern = new RegExp(`(^|[^\\p{L}\\p{N}_])(${words.map(escapeRegExp).join("|")})(?=$|[^\\p{L}\\p{N}_])`, "giu");

  $("articleText").innerHTML = article.text.map(paragraph => {
    const html = escapeHtml(paragraph).replace(pattern, (match, prefix, word) => {
      const vocab = lookup.get(word.toLocaleLowerCase("de"));
      if (!vocab) return match;

      return `${prefix}<button class="inline-word" type="button" data-word="${escapeHtml(vocab.de)}" data-translation="${escapeHtml(vocab.sk)}">${word}</button>`;
    });

    return `<p>${html}</p>`;
  }).join("");
}

function openArticle(id) {
  const article = state.articles.find(a => a.id === id);
  if (!article) return;

  state.currentArticle = article;
  $("homeView").classList.add("hidden");
  $("settingsView").classList.add("hidden");
  $("articleView").classList.remove("hidden");

  $("articleMeta").textContent = `${article.level} • ${article.category} • ${article.minutes} min`;
  $("articleTitle").textContent = article.title;
  renderArticleText(article);
  renderVocabulary();

  $("questionList").innerHTML = article.questions
    .map(q => `<li>${escapeHtml(q)}</li>`)
    .join("");

  $("markReadBtn").textContent = state.readIds.includes(article.id)
    ? "Prečítané ✓"
    : "Označiť ako prečítané";
}

function addDiscoveredVocabulary(word, translation) {
  const article = state.currentArticle;
  if (!article) return;

  const exists = getVisibleVocabulary(article).some(v => v.de.toLocaleLowerCase("de") === word.toLocaleLowerCase("de"));
  if (!exists) {
    state.discoveredVocabulary[article.id] = [
      ...getSavedVocabulary(article),
      { de: word, sk: translation }
    ];
    saveDiscoveredVocabulary();
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
  $("articleView").classList.add("hidden");
  $("settingsView").classList.add("hidden");
  $("homeView").classList.remove("hidden");
  renderArticles();
}

function showSettings() {
  $("homeView").classList.add("hidden");
  $("articleView").classList.add("hidden");
  $("settingsView").classList.remove("hidden");
}

function saveReadState() {
  localStorage.setItem("readIds", JSON.stringify(state.readIds));
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
$("settingsBtn").onclick = showSettings;
$("refreshBtn").onclick = loadArticles;

$("markReadBtn").onclick = () => {
  const article = state.currentArticle;
  if (!article || state.readIds.includes(article.id)) return;
  state.readIds.push(article.id);
  saveReadState();
  $("markReadBtn").textContent = "Prečítané ✓";
};

$("articleText").onclick = (event) => {
  const button = event.target.closest(".inline-word");
  if (!button) return;
  showInlineTranslation(button);
};

$("fontSizeSelect").onchange = (e) => {
  localStorage.setItem("fontSize", e.target.value);
  loadSettings();
};

$("darkModeToggle").onchange = (e) => {
  localStorage.setItem("darkMode", e.target.checked);
  loadSettings();
};

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("service-worker.js");
  });
}

loadSettings();
loadArticles();
