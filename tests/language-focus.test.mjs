import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const editorSource = await readFile(new URL("../editor.js", import.meta.url), "utf8");
const context = vm.createContext({});
vm.runInContext(editorSource, context);
const normalizeLanguageFocusImport = vm.runInContext("normalizeLanguageFocusImport", context);

const paragraphs = [
  "Gestern habe ich lange gearbeitet.",
  "Danach bin ich nach Hause gegangen."
];

test("accepts a valid multiple-choice language focus", () => {
  const focus = normalizeLanguageFocusImport({
    title: "Perfekt mit haben und sein",
    examples: [
      { sentence: paragraphs[0], highlight: "habe ich lange gearbeitet" },
      { sentence: paragraphs[1], highlight: "bin ich nach Hause gegangen" }
    ],
    exercise: {
      type: "multiple_choice",
      prompt: "Gestern ___ ich lange gearbeitet.",
      options: ["habe", "bin", "werde"],
      answer: "habe"
    }
  }, paragraphs);

  assert.equal(focus.title, "Perfekt mit haben und sein");
  assert.equal(focus.examples.length, 2);
  assert.equal(focus.exercise.answer, "habe");
});

test("accepts word order only when words reconstruct the answer", () => {
  const valid = normalizeLanguageFocusImport({
    title: "Verb auf Position zwei",
    examples: [
      { sentence: paragraphs[0], highlight: "habe" },
      { sentence: paragraphs[1], highlight: "bin" }
    ],
    exercise: {
      type: "word_order",
      words: ["Danach", "bin", "ich", "nach", "Hause", "gegangen."],
      answer: "Danach bin ich nach Hause gegangen."
    }
  }, paragraphs);
  const invalid = normalizeLanguageFocusImport({
    title: "Verb auf Position zwei",
    examples: [
      { sentence: paragraphs[0], highlight: "habe" },
      { sentence: paragraphs[1], highlight: "bin" }
    ],
    exercise: {
      type: "word_order",
      words: ["ich", "Danach", "bin", "nach", "Hause", "gegangen."],
      answer: "Danach bin ich nach Hause gegangen."
    }
  }, paragraphs);

  assert.equal(valid.exercise.type, "word_order");
  assert.equal(invalid, null);
});

test("rejects examples that are not copied from the article", () => {
  const focus = normalizeLanguageFocusImport({
    title: "Perfekt",
    examples: [
      { sentence: paragraphs[0], highlight: "habe" },
      { sentence: "Diese erfundene Aussage steht nicht im Text.", highlight: "steht" }
    ],
    exercise: {
      type: "multiple_choice",
      prompt: "Gestern ___ ich lange gearbeitet.",
      options: ["habe", "bin", "werde"],
      answer: "habe"
    }
  }, paragraphs);

  assert.equal(focus, null);
});
