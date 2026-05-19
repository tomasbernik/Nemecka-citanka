import fs from "node:fs";
import vm from "node:vm";

const FILES = [
  "constants.js",
  "translations/ui.js",
  "translations/auth.js",
  "translations/new-languages.js",
  "translations/prompts.js"
];

const GLOBAL_CONSTS = [
  "DEFAULT_NATIVE_LANGUAGE",
  "DEFAULT_PRELOGIN_LANGUAGE",
  "VOCABULARY_LANGUAGE_CODES",
  "NATIVE_LANGUAGES",
  "CATEGORY_LABELS",
  "UI_TEXT",
  "AUTH_TEXT",
  "NEW_LANGUAGE_UI_TEXT",
  "PROMPT_TEXT"
];

const UI_SOURCE_FILES = [
  "app.js",
  "articles.js",
  "auth.js",
  "editor.js",
  "games.js",
  "home.js",
  "profiles.js",
  "reader.js",
  "theme.js"
];

function exposeTopLevelConsts(code) {
  return GLOBAL_CONSTS.reduce(
    (updated, name) => updated.replace(new RegExp(`\\bconst\\s+${name}\\b`), `var ${name}`),
    code
  );
}

function loadAppTranslations() {
  const context = {
    console,
    window: {
      NC_ADMIN_PROFILE_IDS: [],
      NC_SUPABASE_CONFIG: {}
    }
  };
  vm.createContext(context);

  for (const file of FILES) {
    const code = exposeTopLevelConsts(fs.readFileSync(file, "utf8"));
    vm.runInContext(code, context, { filename: file });
  }

  return context;
}

function findStaticUiKeysInSource() {
  const patterns = [
    /\b(?:t|formatText)\(\s*["']([^"']+)["']/g,
    /\b(?:setText|setLabelText|setButtonLabel)\(\s*["'][^"']+["']\s*,\s*["']([^"']+)["']/g,
    /\bsetOptionText\(\s*["'][^"']+["']\s*,\s*["'][^"']+["']\s*,\s*["']([^"']+)["']/g
  ];
  const keys = new Set();

  for (const file of UI_SOURCE_FILES) {
    if (!fs.existsSync(file)) continue;
    const code = fs.readFileSync(file, "utf8");
    for (const pattern of patterns) {
      for (const match of code.matchAll(pattern)) {
        keys.add(match[1]);
      }
    }
  }

  return [...keys].sort();
}

function findMissingKeys(reference, candidate = {}) {
  return Object.keys(reference).filter(key => !(key in candidate));
}

function findPlaceholderProblems(reference, candidate = {}) {
  const problems = [];
  for (const [key, sourceValue] of Object.entries(reference)) {
    if (!(key in candidate)) continue;
    if (typeof sourceValue !== "string" || typeof candidate[key] !== "string") continue;

    const sourcePlaceholders = [...sourceValue.matchAll(/\{[^}]+\}/g)].map(match => match[0]).sort();
    const candidatePlaceholders = [...candidate[key].matchAll(/\{[^}]+\}/g)].map(match => match[0]).sort();
    if (sourcePlaceholders.join("|") !== candidatePlaceholders.join("|")) {
      problems.push(`${key} expected ${sourcePlaceholders.join(", ") || "none"}, got ${candidatePlaceholders.join(", ") || "none"}`);
    }
  }
  return problems;
}

function printKeyList(label, keys) {
  if (!keys.length) return;
  console.log(`  ${label}: ${keys.join(", ")}`);
}

function checkStaticUiReferences(reference) {
  const usedKeys = findStaticUiKeysInSource();
  const missing = usedKeys.filter(key => !(key in reference));

  console.log("\nStatic UI key references");
  console.log(`${usedKeys.length} static keys found in source files`);
  printKeyList("missing from reference language", missing);

  if (!missing.length) {
    console.log("OK all static UI keys exist in the reference language");
    return 0;
  }

  return 1;
}

function checkTranslationMap({ title, languages, referenceLanguage, translations }) {
  const reference = translations[referenceLanguage] || {};
  let failures = 0;

  console.log(`\n${title}`);
  console.log(`Reference language: ${referenceLanguage} (${Object.keys(reference).length} keys)`);

  for (const language of languages) {
    const candidate = translations[language] || {};
    const missing = findMissingKeys(reference, candidate);
    const placeholderProblems = findPlaceholderProblems(reference, candidate);
    const status = missing.length || placeholderProblems.length ? "FAIL" : "OK";

    console.log(`${status} ${language}: ${Object.keys(candidate).length}/${Object.keys(reference).length} keys`);
    printKeyList("missing", missing);
    printKeyList("placeholder mismatch", placeholderProblems);

    if (missing.length || placeholderProblems.length) failures += 1;
  }

  return failures;
}

function checkCategoryLabels({ categories, languages }) {
  let failures = 0;
  console.log("\nCategory labels");

  for (const [category, labels] of Object.entries(categories)) {
    const missing = languages.filter(language => !(language in labels));
    if (missing.length) {
      failures += 1;
      console.error(`FAIL ${category}: missing ${missing.join(", ")}`);
    }
  }

  if (!failures) console.log(`OK ${Object.keys(categories).length} categories cover all vocabulary languages`);
  return failures;
}

const context = loadAppTranslations();
const nativeLanguages = Object.keys(context.NATIVE_LANGUAGES);
const referenceLanguage = context.DEFAULT_NATIVE_LANGUAGE;
const vocabularyLanguages = context.VOCABULARY_LANGUAGE_CODES;

let failures = 0;

failures += checkTranslationMap({
  title: "UI text",
  languages: nativeLanguages,
  referenceLanguage,
  translations: context.UI_TEXT
});

failures += checkStaticUiReferences(context.UI_TEXT[referenceLanguage] || {});

failures += checkTranslationMap({
  title: "Prompt text",
  languages: nativeLanguages,
  referenceLanguage,
  translations: context.PROMPT_TEXT
});

failures += checkCategoryLabels({
  categories: context.CATEGORY_LABELS,
  languages: vocabularyLanguages
});

if (failures) {
  console.error(`\nTranslation check failed in ${failures} section(s).`);
  process.exit(1);
}

console.log("\nAll translation checks passed.");
