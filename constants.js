const PROFILE_KEY = "profiles";
const PROFILE_LANGUAGE_KEY_PREFIX = "profileLanguage";
const CURRENT_PROFILE_KEY = "currentProfileId";
const LEGACY_MIGRATION_KEY = "legacyProfileDataMigrated";
const DEVICE_ID_KEY = "deviceId";
const AUTH_SESSION_KEY = "supabaseAuthSession";
const AUTH_PENDING_ACTION_KEY = "supabaseAuthPendingAction";
const AUTH_PENDING_INVITE_KEY = "supabaseAuthPendingInvite";
const GEO_APP_OPENED_KEY_PREFIX = "geoAppOpened";
const INSTALL_PROMPT_DISMISSED_KEY = "installPromptDismissedSession";
const SUPABASE_CONFIG = window.NC_SUPABASE_CONFIG || {};
const REMOTE_REQUEST_TIMEOUT_MS = 8000;
const ARTICLE_CACHE_DB_NAME = "citanka-article-cache";
const ARTICLE_CACHE_STORE_NAME = "articleSnapshots";
const ARTICLE_CACHE_KEY = "publishedArticles";
const ARTICLE_CACHE_LOCAL_STORAGE_KEY = "cachedPublishedArticles";
const ADMIN_PROFILE_IDS = new Set(window.NC_ADMIN_PROFILE_IDS || []);
const VISIBLE_CATEGORY_LIMIT = 6;
const DEFAULT_NATIVE_LANGUAGE = "en";
const DEFAULT_PRELOGIN_LANGUAGE = "en";
const DEFAULT_ARTICLE_VISIBILITY = "public";
const DEFAULT_ARTICLE_APPROVAL_STATUS = "draft";
const PUBLIC_ARTICLE_APPROVAL_STATUS = "pending";
const ARTICLE_IMAGE_BUCKET = "article-images";
const ARTICLE_IMAGE_MAX_WIDTH = 1100;
const ARTICLE_IMAGE_JPEG_QUALITY = 0.72;
const ALL_CATEGORIES = "__all__";
const UNREAD_CATEGORY = "__unread__";
const NEW_CATEGORY_VALUE = "__new_category__";
const ALL_LEVELS = "__all_levels__";
const CATEGORY_SEPARATOR = " | ";
const VOCABULARY_LANGUAGE_CODES = ["sk", "ru", "pl", "hu", "ro", "it", "en", "fr", "tr"];
const PROMPT_TRANSLATION_LANGUAGE_CODES = ["sk", "pl", "hu", "ru"];
const NATIVE_LANGUAGES = {
  sk: { label: "Slovenčina", promptName: "slovenčiny", lineFormat: "slovensky", locale: "sk" },
  ru: { label: "Русский", promptName: "ruštiny", lineFormat: "rusky", locale: "ru" },
  pl: { label: "Polski", promptName: "poľštiny", lineFormat: "poľsky", locale: "pl" },
  hu: { label: "Magyar", promptName: "maďarčiny", lineFormat: "maďarsky", locale: "hu" },
  ro: { label: "Română", promptName: "rumunčiny", lineFormat: "rumunsky", locale: "ro" },
  it: { label: "Italiano", promptName: "taliančiny", lineFormat: "taliansky", locale: "it" },
  en: { label: "English", promptName: "angličtiny", lineFormat: "anglicky", locale: "en" },
  fr: { label: "Français", promptName: "francúzštiny", lineFormat: "francúzsky", locale: "fr" },
  tr: { label: "Türkçe", promptName: "turečtiny", lineFormat: "turecky", locale: "tr" }
};

const CATEGORY_LABELS = {
  "Jedlo": { sk: "Jedlo", ru: "Еда", pl: "Jedzenie", hu: "Étel", ro: "Mâncare", it: "Cibo", en: "Food", fr: "Nourriture", tr: "Yemek" },
  "Voľný čas": { sk: "Voľný čas", ru: "Свободное время", pl: "Czas wolny", hu: "Szabadidő", ro: "Timp liber", it: "Tempo libero", en: "Free time", fr: "Temps libre", tr: "Boş zaman" },
  "Každodenný život": { sk: "Každodenný život", ru: "Повседневная жизнь", pl: "Codzienne życie", hu: "Mindennapi élet", ro: "Viața de zi cu zi", it: "Vita quotidiana", en: "Everyday life", fr: "Vie quotidienne", tr: "Günlük yaşam" },
  "Cestovanie": { sk: "Cestovanie", ru: "Путешествия", pl: "Podróże", hu: "Utazás", ro: "Călătorii", it: "Viaggi", en: "Travel", fr: "Voyages", tr: "Seyahat" },
  "Nakupovanie": { sk: "Nakupovanie", ru: "Покупки", pl: "Zakupy", hu: "Vásárlás", ro: "Cumpărături", it: "Acquisti", en: "Shopping", fr: "Achats", tr: "Alışveriş" },
  "Príbeh": { sk: "Príbeh", ru: "История", pl: "Historia", hu: "Történet", ro: "Poveste", it: "Storia", en: "Story", fr: "Histoire", tr: "Hikaye" },
  "Romantika": { sk: "Romantika", ru: "Романтика", pl: "Romans", hu: "Romantika", ro: "Romantic", it: "Romantico", en: "Romance", fr: "Romance", tr: "Romantizm" },
  "Zábava": { sk: "Zábava", ru: "Развлечения", pl: "Rozrywka", hu: "Szórakozás", ro: "Distracție", it: "Intrattenimento", en: "Entertainment", fr: "Divertissement", tr: "Eğlence" },
  "Krimi": { sk: "Krimi", ru: "Криминал", pl: "Kryminał", hu: "Krimi", ro: "Crimă", it: "Giallo", en: "Crime", fr: "Polar", tr: "Polisiye" }
};

const ARTICLE_IMAGE_EXTENSIONS = ["jpg", "png"];
