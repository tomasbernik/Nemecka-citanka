import fs from "node:fs/promises";
import vm from "node:vm";

export const AUDIT_FILE = "translations/generated-translation-audit.json";

const APP_FILES = [
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

export function parseArgs(argv = process.argv.slice(2)) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) continue;
    const [rawKey, rawValue] = arg.slice(2).split("=");
    const key = rawKey.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    if (rawValue !== undefined) {
      args[key] = rawValue;
    } else if (argv[index + 1] && !argv[index + 1].startsWith("--")) {
      args[key] = argv[index + 1];
      index += 1;
    } else {
      args[key] = true;
    }
  }
  return args;
}

function exposeTopLevelConsts(code) {
  return GLOBAL_CONSTS.reduce(
    (updated, name) => updated.replace(new RegExp(`\\bconst\\s+${name}\\b`), `var ${name}`),
    code
  );
}

export async function loadAppContext() {
  const context = {
    console,
    window: {
      NC_ADMIN_PROFILE_IDS: [],
      NC_SUPABASE_CONFIG: {}
    }
  };
  vm.createContext(context);

  for (const file of APP_FILES) {
    const code = exposeTopLevelConsts(await fs.readFile(file, "utf8"));
    vm.runInContext(code, context, { filename: file });
  }

  return context;
}

export async function readJsonFile(path, fallback) {
  try {
    return JSON.parse(await fs.readFile(path, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return fallback;
    throw error;
  }
}

export async function writeJsonFile(path, value) {
  await fs.writeFile(`${path}.tmp`, `${JSON.stringify(value, null, 2)}\n`);
  await fs.rename(`${path}.tmp`, path);
}

export function makeEntryKey(entry) {
  return [
    entry.namespace,
    entry.source_entity_id,
    entry.source_field,
    entry.source_path || "",
    entry.source_language,
    entry.target_language
  ].join("\u001f");
}

export function getSupabaseCredentials(args = {}) {
  const url = args.supabaseUrl || process.env.SUPABASE_URL;
  const key = args.supabaseKey
    || process.env.SUPABASE_SERVICE_ROLE_KEY
    || process.env.SUPABASE_ACCESS_TOKEN
    || process.env.SUPABASE_ANON_KEY;
  return { url, key };
}

export async function supabaseRequest(path, options = {}, args = {}) {
  const { url, key } = getSupabaseCredentials(args);
  if (!url || !key) {
    throw new Error("Missing Supabase credentials. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY, or pass --supabase-url and --supabase-key.");
  }

  const response = await fetch(`${url.replace(/\/$/, "")}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });

  if (!response.ok) {
    throw new Error(`Supabase ${response.status}: ${await response.text()}`);
  }

  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

export function buildReviewPayload(entry) {
  return {
    id: entry.id,
    namespace: entry.namespace,
    source_entity_id: entry.source_entity_id,
    source_field: entry.source_field,
    source_path: entry.source_path,
    source_language: entry.source_language,
    target_language: entry.target_language,
    source_text: entry.source_text,
    translated_text: entry.translated_text,
    corrected_text: entry.translated_text,
    notes: ""
  };
}
