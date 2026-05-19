function getPromptVocabularyLanguageList() {
  return VOCABULARY_LANGUAGE_CODES
    .map(code => NATIVE_LANGUAGES[code]?.promptName || code)
    .join(", ");
}

function getPromptVocabularyKeys() {
  return ["de", ...VOCABULARY_LANGUAGE_CODES].join(", ");
}

function getPromptVocabularyExample() {
  return JSON.stringify({
    de: "die Erfahrung",
    sk: "skúsenosť",
    ru: "опыт",
    pl: "doświadczenie",
    hu: "tapasztalat",
    ro: "experiență",
    it: "esperienza",
    en: "experience",
    fr: "expérience",
    tr: "deneyim"
  });
}

const PROMPT_TEXT = {
  sk: {
    article: ({ level, category, topic, requiredWords }) => [
      `Napíš článok v nemčine pre úroveň ${level}.`,
      category ? `Kategória/téma: ${category}.` : "",
      topic ? `Konkrétne zadanie: ${topic}` : "",
      requiredWords.length
        ? `Tieto slová alebo frázy musia byť v texte použité každé minimálne 2x a maximálne 4x: ${requiredWords.join(", ")}.`
        : "",
      "Vráť iba validný JSON podľa schémy nižšie. Nepíš žiadne vysvetlenia."
    ],
    translation: (missing) => [
      `Prelož tieto nemecké slová a frázy do týchto jazykov: ${getPromptVocabularyLanguageList()}.`,
      "Vráť iba validné JSON pole. Nepíš vysvetlenia navyše a nepoužívaj markdown blok ```json.",
      `Každá položka musí mať presne tieto kľúče: ${getPromptVocabularyKeys()}.`,
      "Formát jednej položky:",
      getPromptVocabularyExample(),
      "",
      missing.join("\n")
    ],
    questions: ({ title, text }) => [
      "Vytvor pravda/nepravda vety k tomuto nemeckému článku.",
      "Vráť 6 až 8 riadkov vo formáte:",
      "nemecká veta = true",
      "nemecká veta = false",
      "Použi mix pravdivých a nepravdivých viet. Nepíš nič navyše.",
      "Odpovede nesmú byť v pravidelnom poradí true/false/true/false ani false/true/false/true. Môžu byť aj dve pravdivé alebo dve nepravdivé vety za sebou.",
      title ? `Názov: ${title}` : "",
      "",
      text
    ]
  },
  ru: {
    article: ({ level, category, topic, requiredWords }) => [
      `Напиши короткую статью на немецком языке для уровня ${level}.`,
      category ? `Категория/тема: ${category}.` : "",
      topic ? `Конкретное задание: ${topic}` : "",
      requiredWords.length
        ? `Эти немецкие слова или фразы должны быть использованы в тексте каждое минимум 2 раза и максимум 4 раза: ${requiredWords.join(", ")}.`
        : "",
      "Верни только валидный JSON по схеме ниже. Не добавляй объяснений."
    ],
    translation: (missing) => [
      `Переведи эти немецкие слова и фразы на эти языки: ${getPromptVocabularyLanguageList()}.`,
      "Верни только валидный JSON-массив. Не добавляй никаких объяснений.",
      `Каждый объект должен иметь ровно эти ключи: ${getPromptVocabularyKeys()}.`,
      "Формат одного объекта:",
      getPromptVocabularyExample(),
      "",
      missing.join("\n")
    ],
    questions: ({ title, text }) => [
      "Создай предложения true/false к этой немецкой статье.",
      "Верни 6-8 строк в формате:",
      "немецкое предложение = true",
      "немецкое предложение = false",
      "Используй смесь правдивых и ложных предложений. Не добавляй ничего лишнего.",
      "Ответы не должны идти в регулярном порядке true/false/true/false или false/true/false/true. Могут быть и два правдивых или два ложных предложения подряд.",
      title ? `Название: ${title}` : "",
      "",
      text
    ]
  },
  pl: {
    article: ({ level, category, topic, requiredWords }) => [
      `Napisz krótki artykuł po niemiecku dla poziomu ${level}.`,
      category ? `Kategoria/temat: ${category}.` : "",
      topic ? `Konkretne zadanie: ${topic}` : "",
      requiredWords.length
        ? `Te niemieckie słowa albo frazy muszą zostać użyte w tekście każde minimum 2 razy i maksimum 4 razy: ${requiredWords.join(", ")}.`
        : "",
      "Zwróć tylko poprawny JSON według schematu poniżej. Nie dodawaj wyjaśnień."
    ],
    translation: (missing) => [
      `Przetłumacz te niemieckie słowa i frazy na te języki: ${getPromptVocabularyLanguageList()}.`,
      "Zwróć tylko poprawną tablicę JSON. Nie dodawaj żadnych wyjaśnień.",
      `Każdy obiekt musi mieć dokładnie te klucze: ${getPromptVocabularyKeys()}.`,
      "Format jednego obiektu:",
      getPromptVocabularyExample(),
      "",
      missing.join("\n")
    ],
    questions: ({ title, text }) => [
      "Utwórz zdania true/false do tego niemieckiego artykułu.",
      "Zwróć 6-8 wierszy w formacie:",
      "niemieckie zdanie = true",
      "niemieckie zdanie = false",
      "Użyj mieszanki zdań prawdziwych i fałszywych. Nie dodawaj niczego więcej.",
      "Odpowiedzi nie mogą być w regularnej kolejności true/false/true/false ani false/true/false/true. Mogą też wystąpić dwa zdania prawdziwe albo dwa fałszywe pod rząd.",
      title ? `Tytuł: ${title}` : "",
      "",
      text
    ]
  },
  hu: {
    article: ({ level, category, topic, requiredWords }) => [
      `Írj egy rövid német cikket ${level} szintre.`,
      category ? `Kategória/téma: ${category}.` : "",
      topic ? `Konkrét feladat: ${topic}` : "",
      requiredWords.length
        ? `Ezeket a német szavakat vagy kifejezéseket a szövegben mindegyiket legalább 2-szer és legfeljebb 4-szer kell használni: ${requiredWords.join(", ")}.`
        : "",
      "Csak érvényes JSON-t adj vissza az alábbi séma szerint. Ne írj magyarázatot."
    ],
    translation: (missing) => [
      `Fordítsd le ezeket a német szavakat és kifejezéseket ezekre a nyelvekre: ${getPromptVocabularyLanguageList()}.`,
      "Csak érvényes JSON tömböt adj vissza. Ne írj semmilyen magyarázatot.",
      `Minden objektumnak pontosan ezek a kulcsai legyenek: ${getPromptVocabularyKeys()}.`,
      "Egy objektum formátuma:",
      getPromptVocabularyExample(),
      "",
      missing.join("\n")
    ],
    questions: ({ title, text }) => [
      "Készíts true/false mondatokat ehhez a német cikkhez.",
      "Adj vissza 6-8 sort ebben a formátumban:",
      "német mondat = true",
      "német mondat = false",
      "Legyen benne igaz és hamis mondat is. Ne írj semmi mást.",
      title ? `Cím: ${title}` : "",
      "",
      text
    ]
  }
};
