
const state = {
  articles: [],
  selectedCategory: "Alle",
  currentArticle: null,
  readIds: JSON.parse(localStorage.getItem("readIds") || "[]")
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
  return ["Alle", ...new Set(state.articles.map(a => a.category))];
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
  const articles = state.selectedCategory === "Alle"
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

function openArticle(id) {
  const article = state.articles.find(a => a.id === id);
  if (!article) return;

  state.currentArticle = article;
  $("homeView").classList.add("hidden");
  $("settingsView").classList.add("hidden");
  $("articleView").classList.remove("hidden");

  $("articleMeta").textContent = `${article.level} • ${article.category} • ${article.minutes} min`;
  $("articleTitle").textContent = article.title;
  $("articleText").innerHTML = article.text.map(p => `<p>${p}</p>`).join("");

  $("vocabList").innerHTML = article.vocabulary
    .map(v => `<li><strong>${v.de}</strong> – ${v.sk}</li>`)
    .join("");

  $("questionList").innerHTML = article.questions
    .map(q => `<li>${q}</li>`)
    .join("");

  $("markReadBtn").textContent = state.readIds.includes(article.id)
    ? "Prečítané ✓"
    : "Označiť ako prečítané";
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
