import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = path => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const [constants, app, profiles, auth, schema] = await Promise.all([
  read("constants.js"),
  read("app.js"),
  read("profiles.js"),
  read("auth.js"),
  read("supabase-schema.sql"),
]);

test("native-language choices match automatic vocabulary translation languages", () => {
  assert.match(constants, /const PROMPT_TRANSLATION_LANGUAGE_CODES = \["sk", "pl", "hu", "ru", "en", "fr"\]/);
  assert.match(constants, /const SELECTABLE_NATIVE_LANGUAGE_CODES = \[\.\.\.PROMPT_TRANSLATION_LANGUAGE_CODES\]/);
  assert.match(profiles, /SELECTABLE_NATIVE_LANGUAGE_CODES\s*\.map\(code =>/);
});

test("new profiles and profile updates accept only selectable native languages", () => {
  assert.match(app, /function isSelectableNativeLanguage\(language\)/);
  assert.match(auth, /nativeLanguage: isSelectableNativeLanguage\(state\.preLoginLanguage\)/);
  assert.match(profiles, /if \(!state\.currentProfile \|\| !isSelectableNativeLanguage\(language\)\) return/);
});

test("existing wider language data remains compatible", () => {
  assert.match(constants, /const VOCABULARY_LANGUAGE_CODES = \["sk", "ru", "pl", "hu", "ro", "it", "en", "fr", "tr"\]/);
  assert.match(constants, /de: \{ label: "Deutsch"/);
  assert.match(constants, /ro: \{ label: "Română"/);
  assert.match(constants, /it: \{ label: "Italiano"/);
  assert.match(constants, /tr: \{ label: "Türkçe"/);
  assert.match(profiles, /preservedLegacyOption/);
  assert.match(schema, /native_language in \('de', 'sk', 'ru', 'pl', 'hu', 'ro', 'it', 'en', 'fr', 'tr'\)/);
});
