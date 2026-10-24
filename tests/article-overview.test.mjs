import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const articlesSource = await readFile(new URL("../articles.js", import.meta.url), "utf8");
const context = vm.createContext({ getNativeLanguage: () => "sk" });
vm.runInContext(articlesSource, context);
const getArticleLanguageFocusTitles = vm.runInContext("getArticleLanguageFocusTitles", context);

test("returns only unique localized language-focus titles for an article card", () => {
  const titles = getArticleLanguageFocusTitles([
    { languageFocus: { title: "Trennbare Verben im Hauptsatz" } },
    { languageFocus: { title: "trennbare Verben im Hauptsatz" } },
    { languageFocus: { title: "Konjunktiv I in der indirekten Rede" } },
    { languageFocus: null }
  ]);

  assert.deepEqual(
    Array.from(titles),
    ["Oddeliteľné slovesá v hlavnej vete", "Konjunktív I v nepriamej reči"]
  );
});

test("uses the requested feature when an older focus has no title", () => {
  const titles = getArticleLanguageFocusTitles([
    { languageFocus: { requestedFeature: "Akkusativ" } }
  ]);

  assert.deepEqual(Array.from(titles), ["Akkusativ"]);
});

test("prefers a stored label for the current native language", () => {
  const titles = getArticleLanguageFocusTitles([{
    languageFocus: {
      title: "Konjunktiv I in der indirekten Rede",
      labels: { sk: "Nepriama reč s Konjunktívom I" }
    }
  }], "sk");

  assert.deepEqual(Array.from(titles), ["Nepriama reč s Konjunktívom I"]);
});
