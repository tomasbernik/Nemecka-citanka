const PROFILE_KEY = "profiles";
const CURRENT_PROFILE_KEY = "currentProfileId";
const LEGACY_MIGRATION_KEY = "legacyProfileDataMigrated";
const DEVICE_ID_KEY = "deviceId";
const AUTH_SESSION_KEY = "supabaseAuthSession";
const AUTH_PENDING_ACTION_KEY = "supabaseAuthPendingAction";
const AUTH_PENDING_INVITE_KEY = "supabaseAuthPendingInvite";
const GEO_APP_OPENED_KEY_PREFIX = "geoAppOpened";
const INSTALL_PROMPT_DISMISSED_KEY = "installPromptDismissedSession";
const SUPABASE_CONFIG = window.NC_SUPABASE_CONFIG || {};
const ADMIN_PROFILE_IDS = new Set(window.NC_ADMIN_PROFILE_IDS || []);
const VISIBLE_CATEGORY_LIMIT = 6;
const DEFAULT_NATIVE_LANGUAGE = "sk";
const DEFAULT_PRELOGIN_LANGUAGE = "de";
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
const NATIVE_LANGUAGES = {
  sk: { label: "Slovenčina", promptName: "slovenčiny", lineFormat: "slovensky", locale: "sk" },
  ru: { label: "Русский", promptName: "ruštiny", lineFormat: "rusky", locale: "ru" },
  pl: { label: "Polski", promptName: "poľštiny", lineFormat: "poľsky", locale: "pl" },
  hu: { label: "Magyar", promptName: "maďarčiny", lineFormat: "maďarsky", locale: "hu" }
};

const CATEGORY_LABELS = {
  "Jedlo": { sk: "Jedlo", ru: "Еда", pl: "Jedzenie", hu: "Étel" },
  "Voľný čas": { sk: "Voľný čas", ru: "Свободное время", pl: "Czas wolny", hu: "Szabadidő" },
  "Každodenný život": { sk: "Každodenný život", ru: "Повседневная жизнь", pl: "Codzienne życie", hu: "Mindennapi élet" },
  "Cestovanie": { sk: "Cestovanie", ru: "Путешествия", pl: "Podróże", hu: "Utazás" },
  "Nakupovanie": { sk: "Nakupovanie", ru: "Покупки", pl: "Zakupy", hu: "Vásárlás" }
};

const ARTICLE_IMAGE_EXTENSIONS = ["jpg", "png"];
