import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const articlesSource = await readFile(new URL("../articles.js", import.meta.url), "utf8");
const context = vm.createContext({});
vm.runInContext(articlesSource, context);
const getArticleLanguageFocusTitles = vm.runInContext("getArticleLanguageFocusTitles", context);

test("returns only unique language-focus titles for an article card", () => {
  const titles = getArticleLanguageFocusTitles([
    { languageFocus: { title: "Trennbare Verben im Hauptsatz" } },
    { languageFocus: { title: "trennbare Verben im Hauptsatz" } },
    { languageFocus: { title: "Konjunktiv I in der indirekten Rede" } },
    { languageFocus: null }
  ]);

  assert.deepEqual(
    Array.from(titles),
    ["Trennbare Verben im Hauptsatz", "Konjunktiv I in der indirekten Rede"]
  );
});

test("uses the requested feature when an older focus has no title", () => {
  const titles = getArticleLanguageFocusTitles([
    { languageFocus: { requestedFeature: "Akkusativ" } }
  ]);

  assert.deepEqual(Array.from(titles), ["Akkusativ"]);
});
