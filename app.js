const PROFILE_KEY = "profiles";
const CURRENT_PROFILE_KEY = "currentProfileId";
const LEGACY_MIGRATION_KEY = "legacyProfileDataMigrated";
const SUPABASE_CONFIG = window.NC_SUPABASE_CONFIG || {};
const AUTO_READ_DELAY_MS = 2 * 60 * 1000;
const VISIBLE_CATEGORY_LIMIT = 6;
const DEFAULT_NATIVE_LANGUAGE = "sk";
const DEFAULT_PRELOGIN_LANGUAGE = "de";
const DEFAULT_ARTICLE_VISIBILITY = "private";
const DEFAULT_ARTICLE_APPROVAL_STATUS = "draft";
const PUBLIC_ARTICLE_APPROVAL_STATUS = "pending";
const ALL_CATEGORIES = "__all__";
const NATIVE_LANGUAGES = {
  sk: { label: "Slovenčina", promptName: "slovenčiny", lineFormat: "slovensky", locale: "sk" },
  ru: { label: "Русский", promptName: "ruštiny", lineFormat: "rusky", locale: "ru" },
  pl: { label: "Polski", promptName: "poľštiny", lineFormat: "poľsky", locale: "pl" },
  hu: { label: "Magyar", promptName: "maďarčiny", lineFormat: "maďarsky", locale: "hu" }
};

const UI_TEXT = {
  de: {
    appTitle: "Lesebuch",
    languageLabel: "A2 Deutsch",
    overview: "Übersicht",
    settings: "Einstellungen",
    loginEyebrow: "Anmeldung",
    loginTitle: "Wer liest?",
    name: "Name",
    pin: "PIN",
    nativeLanguage: "Muttersprache",
    login: "Anmelden",
    newProfile: "Neues Profil erstellen",
    setupPair: "Zwei Profile einrichten",
    logout: "Abmelden",
    articles: "Artikel",
    refresh: "Aktualisieren",
    all: "Alle",
    lessTopics: "Weniger Themen",
    moreTopics: "Weitere Themen",
    teacher: "Lehrer/in",
    student: "Schüler/in",
    online: "online",
    local: "lokal",
    private: "privat",
    pendingApproval: "wartet auf Freigabe",
    read: "gelesen",
    setupEyebrow: "Einrichtung",
    setupTitle: "Zwei Profile erstellen",
    setupNote: "Der PIN trennt die Profile in dieser privaten App.",
    profile1Name: "Name Profil 1",
    profile1Pin: "PIN Profil 1",
    profile1Role: "Rolle Profil 1",
    profile1Language: "Muttersprache Profil 1",
    profile2Name: "Name Profil 2",
    profile2Pin: "PIN Profil 2",
    profile2Role: "Rolle Profil 2",
    profile2Language: "Muttersprache Profil 2",
    teacherRole: "Lehrer/in",
    studentRole: "Schüler/in",
    saveProfiles: "Profile speichern",
    backToLogin: "Zur Anmeldung",
    fontSize: "Schriftgröße",
    normal: "Normal",
    large: "Groß",
    xlarge: "Sehr groß",
    profileRole: "Profilrolle",
    darkMode: "Dunkler Modus",
    notifications: "Benachrichtigungen",
    notificationNote: "Sende eine Testbenachrichtigung an dieses Gerät.",
    testNotification: "Testbenachrichtigung",
    back: "← Zurück",
    readText: "Text vorlesen",
    listenOnly: "Ohne Text hören",
    pause: "Pause",
    stop: "Stop",
    speed: "Tempo",
    slower: "Langsamer",
    speedNormal: "Normal",
    faster: "Schneller",
    showText: "Text zeigen",
    vocabulary: "Wörter und Phrasen",
    practice: "Übung",
    questions: "Fragen",
    game: "Spiel",
    sentenceOrder: "Satz ordnen",
    newSentence: "Neuer Satz",
    matchPairs: "Paare finden",
    shuffle: "Mischen",
    vocabChoice: "4 Möglichkeiten",
    newVocab: "Neues Wort",
    cloze: "Fehlendes Wort ergänzen",
    mistake: "Falsches Wort finden",
    wordSearch: "Wortsuche",
    newGame: "Neu",
    markRead: "Als gelesen markieren",
    settingsTitle: "Einstellungen",
    taskAllDone: "Alle Aufgaben erledigt",
    taskDone: "Erledigte Aufgaben",
    trueLabel: "Richtig",
    falseLabel: "Falsch",
    correct: "Richtig.",
    correctIs: "Richtig ist:",
    browserNoSpeech: "Dieser Browser unterstützt kein Vorlesen.",
    readingFailed: "Vorlesen konnte nicht gestartet werden.",
    restart: "Von Anfang an",
    listening: "Ich höre...",
    listenSentence: "Höre Satz {current} von {total}.",
    readingSentence: "Ich lese Satz {current} von {total}.",
    changingSpeed: "Tempo wird geändert...",
    continueReading: "Fortsetzen",
    continuingReading: "Ich lese weiter.",
    readingPaused: "Vorlesen ist pausiert.",
    finishedReading: "Fertig gelesen.",
    tapWords: "Tippe die Wörter in der richtigen Reihenfolge an.",
    sentenceNoTask: "Für dieses Spiel braucht man mindestens einen kürzeren Satz.",
    sentenceCorrect: "Sehr gut, der Satz stimmt.",
    sentenceRetry: "Versuche die Reihenfolge noch einmal.",
    matchNoVocab: "Für Paare braucht man zuerst Wörter im Artikel.",
    matchDone: "Fertig, alle Paare passen.",
    noPair: "Das ist noch kein Paar.",
    vocabNeed4: "Für dieses Spiel braucht man mindestens 4 Wörter.",
    clozeNeedMore: "Für dieses Spiel braucht man mehr kurze Wörter im Text.",
    mistakeNeedMore: "Für dieses Spiel braucht man mehr kurze Wörter im Text.",
    mistakeCorrect: "Richtig. Im Satz soll stehen:",
    mistakeWrong: "Das falsche Wort ist: {wrong}. Im Satz soll stehen: {correct}",
    wordSearchNeed3: "Für die Wortsuche braucht man mindestens 3 kürzere Wörter.",
    wordSearchDone: "Fertig, alle Wörter sind gefunden.",
    markedRead: "Als gelesen markiert",
    readDone: "Gelesen ✓",
    teacherView: "Lehreransicht",
    studentOverview: "Schülerübersicht",
    noStudentsInGroup: "In deiner Gruppe sind noch keine Schülerprofile.",
    missingTranslations: "Fehlende Übersetzungen",
    missingTranslationsEmpty: "Alle Wörter im Editor haben Übersetzungen für alle Sprachen.",
    teacherArticles: "Artikel",
    articleEditor: "Artikeleditor",
    newArticle: "Neuer Artikel",
    editArticle: "Artikel bearbeiten",
    visibility: "Sichtbarkeit",
    privateArticle: "Privater Artikel",
    publicAfterApproval: "Öffentlich nach Freigabe",
    approvalStatus: "Freigabestatus",
    draft: "Entwurf",
    pending: "Wartet auf Freigabe",
    approved: "Freigegeben",
    rejected: "Abgelehnt",
    chatGptHelper: "ChatGPT-Helfer",
    articleTask: "Aufgabe für den Artikel",
    requiredWords: "Pflichtwörter, ein Wort oder eine Phrase pro Zeile",
    copyArticlePrompt: "Prompt für Artikel kopieren",
    copyTranslationPrompt: "Wörter zum Übersetzen kopieren",
    copyQuestionsPrompt: "Prompt für Fragen kopieren",
    generatedPrompt: "Generierter Prompt",
    title: "Titel",
    level: "Niveau",
    category: "Kategorie",
    summary: "Kurze Beschreibung",
    articleTextLabel: "Artikeltext, jeder Absatz in einer neuen Zeile",
    addSelectedVocabulary: "Auswahl zu Wörtern und inline hinzufügen",
    addSelectedInline: "Auswahl nur inline hinzufügen",
    vocabInputLabel: "Wörter: JSON aus dem Prompt oder Zeilen Deutsch = Übersetzung",
    inlineVocabInputLabel: "Inline-Wörter: JSON aus dem Prompt oder Zeilen Deutsch = Übersetzung",
    questionsInputLabel: "Richtig/falsch, eine Zeile: deutscher Satz = true/false",
    saveArticle: "Artikel speichern",
    startupWarmup: "Kurzes Aufwärmen",
    startupTitle: "Ein Wort zum Aufwärmen",
    startupQ1: "Was bedeutet dieses deutsche Wort?",
    startupQ2: "Wie sagt man das auf Deutsch?",
    skip: "Überspringen",
    next: "Weiter",
    done: "Fertig"
  },
  sk: {
    appTitle: "Čítanka",
    languageLabel: "A2 nemčina",
    overview: "Prehľad",
    settings: "Nastavenia",
    loginEyebrow: "Prihlásenie",
    loginTitle: "Kto číta?",
    name: "Meno",
    pin: "PIN",
    nativeLanguage: "Materinský jazyk",
    login: "Prihlásiť sa",
    newProfile: "Vytvoriť nový profil",
    setupPair: "Vytvoriť dva profily",
    logout: "Odhlásiť",
    articles: "Články",
    refresh: "Aktualizovať",
    all: "Všetky",
    lessTopics: "Menej tém",
    moreTopics: "Ďalšie témy",
    teacher: "učiteľ",
    student: "žiak",
    online: "online",
    local: "lokálne",
    private: "súkromné",
    pendingApproval: "čaká na schválenie",
    read: "prečítané",
    setupEyebrow: "Nastavenie",
    setupTitle: "Vytvoriť dva profily",
    setupNote: "PIN slúži len na oddelenie profilov v tejto súkromnej appke.",
    profile1Name: "Meno profil 1",
    profile1Pin: "PIN profil 1",
    profile1Role: "Rola profil 1",
    profile1Language: "Materinský jazyk profil 1",
    profile2Name: "Meno profil 2",
    profile2Pin: "PIN profil 2",
    profile2Role: "Rola profil 2",
    profile2Language: "Materinský jazyk profil 2",
    teacherRole: "Učiteľ",
    studentRole: "Žiak",
    saveProfiles: "Uložiť profily",
    backToLogin: "Späť na prihlásenie",
    fontSize: "Veľkosť písma",
    normal: "Normálne",
    large: "Veľké",
    xlarge: "Veľmi veľké",
    profileRole: "Rola profilu",
    darkMode: "Tmavý režim",
    notifications: "Upozornenia",
    notificationNote: "Pošli skúšobnú notifikáciu na toto zariadenie.",
    testNotification: "Skúšobná notifikácia",
    back: "← Späť",
    readText: "Prečítať text",
    listenOnly: "Počúvať bez textu",
    pause: "Pauza",
    stop: "Stop",
    speed: "Rýchlosť",
    slower: "Pomalšie",
    speedNormal: "Normálne",
    faster: "Rýchlejšie",
    showText: "Ukázať text",
    vocabulary: "Slovíčka a frázy",
    practice: "Cvičenie",
    questions: "Otázky",
    game: "Hra",
    sentenceOrder: "Zoraď vetu",
    newSentence: "Nová veta",
    matchPairs: "Nájdi dvojice",
    shuffle: "Zamiešať",
    vocabChoice: "4 možnosti zo slovíčok",
    newVocab: "Nové slovíčko",
    cloze: "Doplň chýbajúce slovo",
    mistake: "Nájdi chybné slovo vo vete",
    wordSearch: "Osemsmerovka",
    newGame: "Nová",
    markRead: "Označiť ako prečítané",
    settingsTitle: "Nastavenia",
    taskAllDone: "Všetky úlohy splnené",
    taskDone: "Splnené úlohy",
    trueLabel: "Pravda",
    falseLabel: "Nepravda",
    correct: "Správne.",
    correctIs: "Správne je:",
    browserNoSpeech: "Tento prehliadač nepodporuje čítanie nahlas.",
    readingFailed: "Čítanie sa nepodarilo spustiť.",
    restart: "Od začiatku",
    listening: "Počúvam...",
    listenSentence: "Počúvaj vetu {current} z {total}.",
    readingSentence: "Čítam vetu {current} z {total}.",
    changingSpeed: "Mením rýchlosť...",
    continueReading: "Pokračovať",
    continuingReading: "Pokračujem v čítaní.",
    readingPaused: "Čítanie je pozastavené.",
    finishedReading: "Dočítané.",
    tapWords: "Ťukaj slová v správnom poradí.",
    sentenceNoTask: "Na túto hru treba aspoň jednu kratšiu vetu.",
    sentenceCorrect: "Výborne, veta sedí.",
    sentenceRetry: "Skús prehodiť poradie ešte raz.",
    matchNoVocab: "Na dvojice treba najprv slovíčka v článku.",
    matchDone: "Hotovo, všetky dvojice sedia.",
    noPair: "Toto ešte nie je dvojica.",
    vocabNeed4: "Na túto hru treba aspoň 4 slovíčka.",
    clozeNeedMore: "Na túto hru treba viac krátkych slovíčok v texte.",
    mistakeNeedMore: "Na túto hru treba viac krátkych slovíčok v texte.",
    mistakeCorrect: "Správne. Vo vete má byť:",
    mistakeWrong: "Chybné slovo je: {wrong}. Vo vete má byť: {correct}",
    wordSearchNeed3: "Na osemsmerovku treba aspoň 3 kratšie slovíčka.",
    wordSearchDone: "Hotovo, všetky slová sú nájdené.",
    markedRead: "Označené ako prečítané",
    readDone: "Prečítané ✓",
    teacherView: "Učiteľský pohľad",
    studentOverview: "Prehľad žiaka",
    noStudentsInGroup: "V tvojej skupine zatiaľ nie sú žiadni žiaci.",
    missingTranslations: "Chýbajúce preklady",
    missingTranslationsEmpty: "Všetky slovíčka v editore majú preklady do všetkých jazykov.",
    teacherArticles: "Články",
    articleEditor: "Editor článkov",
    newArticle: "Nový článok",
    editArticle: "Upraviť článok",
    visibility: "Viditeľnosť",
    privateArticle: "Súkromný článok",
    publicAfterApproval: "Verejný po schválení",
    approvalStatus: "Stav schválenia",
    draft: "Rozpracované",
    pending: "Čaká na schválenie",
    approved: "Schválené",
    rejected: "Zamietnuté",
    chatGptHelper: "ChatGPT pomocník",
    articleTask: "Zadanie pre článok",
    requiredWords: "Povinné slová, jedno slovo alebo fráza na riadok",
    copyArticlePrompt: "Kopírovať prompt pre článok",
    copyTranslationPrompt: "Kopírovať slovíčka na preklad",
    copyQuestionsPrompt: "Kopírovať prompt pre otázky",
    generatedPrompt: "Vygenerovaný prompt",
    title: "Názov",
    level: "Úroveň",
    category: "Kategória",
    summary: "Krátky popis",
    articleTextLabel: "Text článku, každý odsek na nový riadok",
    addSelectedVocabulary: "Označené do slovíčok aj inline",
    addSelectedInline: "Označené iba inline",
    vocabInputLabel: "Slovíčka: buď JSON zo skopírovaného promptu, alebo riadky nemecky = preklad",
    inlineVocabInputLabel: "Inline slovíčka: buď JSON zo skopírovaného promptu, alebo riadky nemecky = preklad",
    questionsInputLabel: "Pravda/nepravda, jeden riadok: nemecká veta = true/false",
    saveArticle: "Uložiť článok",
    startupWarmup: "Krátke rozcvičenie",
    startupTitle: "Jedno slovíčko na zahriatie",
    startupQ1: "Čo znamená toto nemecké slovíčko?",
    startupQ2: "Ako sa to povie po nemecky?",
    skip: "Preskočiť",
    next: "Ďalej",
    done: "Hotovo"
  },
  ru: {
    appTitle: "Книга для чтения",
    languageLabel: "Немецкий A2",
    overview: "Обзор",
    settings: "Настройки",
    loginEyebrow: "Вход",
    loginTitle: "Кто читает?",
    name: "Имя",
    pin: "PIN",
    nativeLanguage: "Родной язык",
    login: "Войти",
    newProfile: "Создать новый профиль",
    setupPair: "Создать два профиля",
    logout: "Выйти",
    articles: "Статьи",
    refresh: "Обновить",
    all: "Все",
    lessTopics: "Меньше тем",
    moreTopics: "Еще темы",
    teacher: "учитель",
    student: "ученик",
    online: "онлайн",
    local: "локально",
    private: "личное",
    pendingApproval: "ожидает одобрения",
    read: "прочитано",
    setupEyebrow: "Настройка",
    setupTitle: "Создать два профиля",
    setupNote: "PIN нужен только для разделения профилей в этой частной app.",
    profile1Name: "Имя профиля 1",
    profile1Pin: "PIN профиля 1",
    profile1Role: "Роль профиля 1",
    profile1Language: "Родной язык профиля 1",
    profile2Name: "Имя профиля 2",
    profile2Pin: "PIN профиля 2",
    profile2Role: "Роль профиля 2",
    profile2Language: "Родной язык профиля 2",
    teacherRole: "Учитель",
    studentRole: "Ученик",
    saveProfiles: "Сохранить профили",
    backToLogin: "Назад ко входу",
    fontSize: "Размер шрифта",
    normal: "Обычный",
    large: "Большой",
    xlarge: "Очень большой",
    profileRole: "Роль профиля",
    darkMode: "Темный режим",
    notifications: "Уведомления",
    notificationNote: "Отправить тестовое уведомление на это устройство.",
    testNotification: "Тестовое уведомление",
    back: "← Назад",
    readText: "Прочитать текст",
    listenOnly: "Слушать без текста",
    pause: "Пауза",
    stop: "Стоп",
    speed: "Скорость",
    slower: "Медленнее",
    speedNormal: "Нормально",
    faster: "Быстрее",
    showText: "Показать текст",
    vocabulary: "Слова и фразы",
    practice: "Упражнение",
    questions: "Вопросы",
    game: "Игра",
    sentenceOrder: "Собери предложение",
    newSentence: "Новое предложение",
    matchPairs: "Найди пары",
    shuffle: "Перемешать",
    vocabChoice: "4 варианта",
    newVocab: "Новое слово",
    cloze: "Вставь слово",
    mistake: "Найди ошибочное слово",
    wordSearch: "Поиск слов",
    newGame: "Новая",
    markRead: "Отметить как прочитано",
    settingsTitle: "Настройки",
    taskAllDone: "Все задания выполнены",
    taskDone: "Выполненные задания",
    trueLabel: "Правда",
    falseLabel: "Неправда",
    correct: "Правильно.",
    correctIs: "Правильно:",
    browserNoSpeech: "Этот браузер не поддерживает чтение вслух.",
    readingFailed: "Не удалось запустить чтение.",
    restart: "С начала",
    listening: "Слушаю...",
    listenSentence: "Слушай предложение {current} из {total}.",
    readingSentence: "Читаю предложение {current} из {total}.",
    changingSpeed: "Меняю скорость...",
    continueReading: "Продолжить",
    continuingReading: "Продолжаю чтение.",
    readingPaused: "Чтение на паузе.",
    finishedReading: "Дочитано.",
    tapWords: "Нажимай слова в правильном порядке.",
    sentenceNoTask: "Для этой игры нужно хотя бы одно короткое предложение.",
    sentenceCorrect: "Отлично, предложение верное.",
    sentenceRetry: "Попробуй изменить порядок еще раз.",
    matchNoVocab: "Для пар сначала нужны слова в статье.",
    matchDone: "Готово, все пары совпадают.",
    noPair: "Это еще не пара.",
    vocabNeed4: "Для этой игры нужно минимум 4 слова.",
    clozeNeedMore: "Для этой игры нужно больше коротких слов в тексте.",
    mistakeNeedMore: "Для этой игры нужно больше коротких слов в тексте.",
    mistakeCorrect: "Правильно. В предложении должно быть:",
    mistakeWrong: "Ошибочное слово: {wrong}. В предложении должно быть: {correct}",
    wordSearchNeed3: "Для поиска слов нужно минимум 3 коротких слова.",
    wordSearchDone: "Готово, все слова найдены.",
    markedRead: "Отмечено как прочитано",
    readDone: "Прочитано ✓",
    teacherView: "Вид учителя",
    studentOverview: "Обзор ученика",
    noStudentsInGroup: "В вашей группе пока нет профилей учеников.",
    missingTranslations: "Недостающие переводы",
    missingTranslationsEmpty: "У всех слов в редакторе есть переводы на все языки.",
    teacherArticles: "Статьи",
    articleEditor: "Редактор статей",
    newArticle: "Новая статья",
    editArticle: "Редактировать статью",
    visibility: "Видимость",
    privateArticle: "Личная статья",
    publicAfterApproval: "Публичная после одобрения",
    approvalStatus: "Статус одобрения",
    draft: "Черновик",
    pending: "Ожидает одобрения",
    approved: "Одобрено",
    rejected: "Отклонено",
    chatGptHelper: "Помощник ChatGPT",
    articleTask: "Задание для статьи",
    requiredWords: "Обязательные слова, одно слово или фраза в строке",
    copyArticlePrompt: "Копировать prompt для статьи",
    copyTranslationPrompt: "Копировать слова для перевода",
    copyQuestionsPrompt: "Копировать prompt для вопросов",
    generatedPrompt: "Сгенерированный prompt",
    title: "Название",
    level: "Уровень",
    category: "Категория",
    summary: "Краткое описание",
    articleTextLabel: "Текст статьи, каждый абзац с новой строки",
    addSelectedVocabulary: "Выделенное в слова и inline",
    addSelectedInline: "Выделенное только inline",
    vocabInputLabel: "Слова: JSON из prompt или строки немецкий = перевод",
    inlineVocabInputLabel: "Inline слова: JSON из prompt или строки немецкий = перевод",
    questionsInputLabel: "Правда/неправда, одна строка: немецкое предложение = true/false",
    saveArticle: "Сохранить статью",
    startupWarmup: "Короткая разминка",
    startupTitle: "Одно слово для разогрева",
    startupQ1: "Что означает это немецкое слово?",
    startupQ2: "Как это сказать по-немецки?",
    skip: "Пропустить",
    next: "Дальше",
    done: "Готово"
  },
  pl: {
    appTitle: "Czytanka",
    languageLabel: "Niemiecki A2",
    overview: "Przegląd",
    settings: "Ustawienia",
    loginEyebrow: "Logowanie",
    loginTitle: "Kto czyta?",
    name: "Imię",
    pin: "PIN",
    nativeLanguage: "Język ojczysty",
    login: "Zaloguj się",
    newProfile: "Utwórz nowy profil",
    setupPair: "Utwórz dwa profile",
    logout: "Wyloguj",
    articles: "Artykuły",
    refresh: "Odśwież",
    all: "Wszystkie",
    lessTopics: "Mniej tematów",
    moreTopics: "Więcej tematów",
    teacher: "nauczyciel",
    student: "uczeń",
    online: "online",
    local: "lokalnie",
    private: "prywatne",
    pendingApproval: "czeka na zatwierdzenie",
    read: "przeczytane",
    setupEyebrow: "Konfiguracja",
    setupTitle: "Utwórz dwa profile",
    setupNote: "PIN służy tylko do rozdzielenia profili w tej prywatnej app.",
    profile1Name: "Imię profilu 1",
    profile1Pin: "PIN profilu 1",
    profile1Role: "Rola profilu 1",
    profile1Language: "Język ojczysty profilu 1",
    profile2Name: "Imię profilu 2",
    profile2Pin: "PIN profilu 2",
    profile2Role: "Rola profilu 2",
    profile2Language: "Język ojczysty profilu 2",
    teacherRole: "Nauczyciel",
    studentRole: "Uczeń",
    saveProfiles: "Zapisz profile",
    backToLogin: "Powrót do logowania",
    fontSize: "Rozmiar czcionki",
    normal: "Normalny",
    large: "Duży",
    xlarge: "Bardzo duży",
    profileRole: "Rola profilu",
    darkMode: "Tryb ciemny",
    notifications: "Powiadomienia",
    notificationNote: "Wyślij testowe powiadomienie na to urządzenie.",
    testNotification: "Testowe powiadomienie",
    back: "← Wstecz",
    readText: "Przeczytaj tekst",
    listenOnly: "Słuchaj bez tekstu",
    pause: "Pauza",
    stop: "Stop",
    speed: "Szybkość",
    slower: "Wolniej",
    speedNormal: "Normalnie",
    faster: "Szybciej",
    showText: "Pokaż tekst",
    vocabulary: "Słówka i frazy",
    practice: "Ćwiczenie",
    questions: "Pytania",
    game: "Gra",
    sentenceOrder: "Ułóż zdanie",
    newSentence: "Nowe zdanie",
    matchPairs: "Znajdź pary",
    shuffle: "Wymieszaj",
    vocabChoice: "4 możliwości",
    newVocab: "Nowe słówko",
    cloze: "Uzupełnij słowo",
    mistake: "Znajdź błędne słowo",
    wordSearch: "Wykreślanka",
    newGame: "Nowa",
    markRead: "Oznacz jako przeczytane",
    settingsTitle: "Ustawienia",
    taskAllDone: "Wszystkie zadania wykonane",
    taskDone: "Wykonane zadania",
    trueLabel: "Prawda",
    falseLabel: "Nieprawda",
    correct: "Poprawnie.",
    correctIs: "Poprawnie:",
    browserNoSpeech: "Ta przeglądarka nie obsługuje czytania na głos.",
    readingFailed: "Nie udało się uruchomić czytania.",
    restart: "Od początku",
    listening: "Słucham...",
    listenSentence: "Słuchaj zdania {current} z {total}.",
    readingSentence: "Czytam zdanie {current} z {total}.",
    changingSpeed: "Zmieniam szybkość...",
    continueReading: "Kontynuuj",
    continuingReading: "Kontynuuję czytanie.",
    readingPaused: "Czytanie jest wstrzymane.",
    finishedReading: "Przeczytane.",
    tapWords: "Klikaj słowa we właściwej kolejności.",
    sentenceNoTask: "Do tej gry potrzebne jest przynajmniej jedno krótkie zdanie.",
    sentenceCorrect: "Świetnie, zdanie pasuje.",
    sentenceRetry: "Spróbuj jeszcze raz zmienić kolejność.",
    matchNoVocab: "Do par potrzebne są najpierw słówka w artykule.",
    matchDone: "Gotowe, wszystkie pary pasują.",
    noPair: "To jeszcze nie jest para.",
    vocabNeed4: "Do tej gry potrzebne są przynajmniej 4 słówka.",
    clozeNeedMore: "Do tej gry potrzeba więcej krótkich słówek w tekście.",
    mistakeNeedMore: "Do tej gry potrzeba więcej krótkich słówek w tekście.",
    mistakeCorrect: "Poprawnie. W zdaniu powinno być:",
    mistakeWrong: "Błędne słowo to: {wrong}. W zdaniu powinno być: {correct}",
    wordSearchNeed3: "Do wykreślanki potrzeba przynajmniej 3 krótszych słówek.",
    wordSearchDone: "Gotowe, wszystkie słowa znalezione.",
    markedRead: "Oznaczone jako przeczytane",
    readDone: "Przeczytane ✓",
    teacherView: "Widok nauczyciela",
    studentOverview: "Przegląd ucznia",
    noStudentsInGroup: "W twojej grupie nie ma jeszcze profili uczniów.",
    missingTranslations: "Brakujące tłumaczenia",
    missingTranslationsEmpty: "Wszystkie słówka w edytorze mają tłumaczenia na wszystkie języki.",
    teacherArticles: "Artykuły",
    articleEditor: "Edytor artykułów",
    newArticle: "Nowy artykuł",
    editArticle: "Edytuj artykuł",
    visibility: "Widoczność",
    privateArticle: "Prywatny artykuł",
    publicAfterApproval: "Publiczny po zatwierdzeniu",
    approvalStatus: "Status zatwierdzenia",
    draft: "Wersja robocza",
    pending: "Czeka na zatwierdzenie",
    approved: "Zatwierdzone",
    rejected: "Odrzucone",
    chatGptHelper: "Pomocnik ChatGPT",
    articleTask: "Zadanie dla artykułu",
    requiredWords: "Wymagane słowa, jedno słowo albo fraza w wierszu",
    copyArticlePrompt: "Kopiuj prompt dla artykułu",
    copyTranslationPrompt: "Kopiuj słówka do tłumaczenia",
    copyQuestionsPrompt: "Kopiuj prompt dla pytań",
    generatedPrompt: "Wygenerowany prompt",
    title: "Tytuł",
    level: "Poziom",
    category: "Kategoria",
    summary: "Krótki opis",
    articleTextLabel: "Tekst artykułu, każdy akapit od nowej linii",
    addSelectedVocabulary: "Zaznaczone do słówek i inline",
    addSelectedInline: "Zaznaczone tylko inline",
    vocabInputLabel: "Słówka: JSON z promptu albo wiersze niemiecki = tłumaczenie",
    inlineVocabInputLabel: "Inline słówka: JSON z promptu albo wiersze niemiecki = tłumaczenie",
    questionsInputLabel: "Prawda/nieprawda, jeden wiersz: niemieckie zdanie = true/false",
    saveArticle: "Zapisz artykuł",
    startupWarmup: "Krótka rozgrzewka",
    startupTitle: "Jedno słówko na rozgrzewkę",
    startupQ1: "Co oznacza to niemieckie słówko?",
    startupQ2: "Jak to powiedzieć po niemiecku?",
    skip: "Pomiń",
    next: "Dalej",
    done: "Gotowe"
  },
  hu: {
    appTitle: "Olvasókönyv",
    languageLabel: "A2 német",
    overview: "Áttekintés",
    settings: "Beállítások",
    loginEyebrow: "Bejelentkezés",
    loginTitle: "Ki olvas?",
    name: "Név",
    pin: "PIN",
    nativeLanguage: "Anyanyelv",
    login: "Bejelentkezés",
    newProfile: "Új profil létrehozása",
    setupPair: "Két profil beállítása",
    logout: "Kijelentkezés",
    articles: "Cikkek",
    refresh: "Frissítés",
    all: "Mind",
    lessTopics: "Kevesebb téma",
    moreTopics: "További témák",
    teacher: "tanár",
    student: "tanuló",
    online: "online",
    local: "helyi",
    private: "privát",
    pendingApproval: "jóváhagyásra vár",
    read: "elolvasva",
    setupEyebrow: "Beállítás",
    setupTitle: "Két profil létrehozása",
    setupNote: "A PIN csak a profilok elválasztására szolgál ebben a privát appban.",
    profile1Name: "1. profil neve",
    profile1Pin: "1. profil PIN",
    profile1Role: "1. profil szerepe",
    profile1Language: "1. profil anyanyelve",
    profile2Name: "2. profil neve",
    profile2Pin: "2. profil PIN",
    profile2Role: "2. profil szerepe",
    profile2Language: "2. profil anyanyelve",
    teacherRole: "Tanár",
    studentRole: "Tanuló",
    saveProfiles: "Profilok mentése",
    backToLogin: "Vissza a belépéshez",
    fontSize: "Betűméret",
    normal: "Normál",
    large: "Nagy",
    xlarge: "Nagyon nagy",
    profileRole: "Profil szerepe",
    darkMode: "Sötét mód",
    notifications: "Értesítések",
    notificationNote: "Teszt értesítés küldése erre az eszközre.",
    testNotification: "Teszt értesítés",
    back: "← Vissza",
    readText: "Szöveg felolvasása",
    listenOnly: "Hallgatás szöveg nélkül",
    pause: "Szünet",
    stop: "Stop",
    speed: "Sebesség",
    slower: "Lassabban",
    speedNormal: "Normál",
    faster: "Gyorsabban",
    showText: "Szöveg mutatása",
    vocabulary: "Szavak és kifejezések",
    practice: "Gyakorlat",
    questions: "Kérdések",
    game: "Játék",
    sentenceOrder: "Rakd össze a mondatot",
    newSentence: "Új mondat",
    matchPairs: "Párok keresése",
    shuffle: "Keverés",
    vocabChoice: "4 lehetőség",
    newVocab: "Új szó",
    cloze: "Hiányzó szó",
    mistake: "Hibás szó keresése",
    wordSearch: "Szókereső",
    newGame: "Új",
    markRead: "Megjelölés olvasottként",
    settingsTitle: "Beállítások",
    taskAllDone: "Minden feladat kész",
    taskDone: "Elvégzett feladatok",
    trueLabel: "Igaz",
    falseLabel: "Hamis",
    correct: "Helyes.",
    correctIs: "A helyes válasz:",
    browserNoSpeech: "Ez a böngésző nem támogatja a felolvasást.",
    readingFailed: "A felolvasást nem sikerült elindítani.",
    restart: "Elölről",
    listening: "Hallgatom...",
    listenSentence: "Hallgasd a(z) {current}. mondatot / {total}.",
    readingSentence: "Olvasom a(z) {current}. mondatot / {total}.",
    changingSpeed: "Sebesség módosítása...",
    continueReading: "Folytatás",
    continuingReading: "Folytatom a felolvasást.",
    readingPaused: "A felolvasás szünetel.",
    finishedReading: "Felolvasva.",
    tapWords: "Koppints a szavakra helyes sorrendben.",
    sentenceNoTask: "Ehhez a játékhoz kell legalább egy rövidebb mondat.",
    sentenceCorrect: "Nagyszerű, a mondat helyes.",
    sentenceRetry: "Próbáld újrarendezni a szavakat.",
    matchNoVocab: "A párosításhoz előbb szavak kellenek a cikkben.",
    matchDone: "Kész, minden pár stimmel.",
    noPair: "Ez még nem pár.",
    vocabNeed4: "Ehhez a játékhoz legalább 4 szó kell.",
    clozeNeedMore: "Ehhez a játékhoz több rövid szó kell a szövegben.",
    mistakeNeedMore: "Ehhez a játékhoz több rövid szó kell a szövegben.",
    mistakeCorrect: "Helyes. A mondatban ez legyen:",
    mistakeWrong: "A hibás szó: {wrong}. A mondatban ez legyen: {correct}",
    wordSearchNeed3: "A szókeresőhöz legalább 3 rövidebb szó kell.",
    wordSearchDone: "Kész, minden szó megvan.",
    markedRead: "Olvasottként megjelölve",
    readDone: "Elolvasva ✓",
    teacherView: "Tanári nézet",
    studentOverview: "Tanulói áttekintés",
    noStudentsInGroup: "A csoportodban még nincsenek tanulói profilok.",
    missingTranslations: "Hiányzó fordítások",
    missingTranslationsEmpty: "A szerkesztőben minden szónak van fordítása minden nyelvre.",
    teacherArticles: "Cikkek",
    articleEditor: "Cikkszerkesztő",
    newArticle: "Új cikk",
    editArticle: "Cikk szerkesztése",
    visibility: "Láthatóság",
    privateArticle: "Privát cikk",
    publicAfterApproval: "Nyilvános jóváhagyás után",
    approvalStatus: "Jóváhagyási állapot",
    draft: "Piszkozat",
    pending: "Jóváhagyásra vár",
    approved: "Jóváhagyva",
    rejected: "Elutasítva",
    chatGptHelper: "ChatGPT segítő",
    articleTask: "Cikkfeladat",
    requiredWords: "Kötelező szavak, soronként egy szó vagy kifejezés",
    copyArticlePrompt: "Cikk prompt másolása",
    copyTranslationPrompt: "Szavak fordításának másolása",
    copyQuestionsPrompt: "Kérdések prompt másolása",
    generatedPrompt: "Generált prompt",
    title: "Cím",
    level: "Szint",
    category: "Kategória",
    summary: "Rövid leírás",
    articleTextLabel: "Cikk szövege, minden bekezdés új sorban",
    addSelectedVocabulary: "Kijelölt rész szavakhoz és inline",
    addSelectedInline: "Kijelölt rész csak inline",
    vocabInputLabel: "Szavak: JSON a promptból vagy sorok német = fordítás",
    inlineVocabInputLabel: "Inline szavak: JSON a promptból vagy sorok német = fordítás",
    questionsInputLabel: "Igaz/hamis, egy sor: német mondat = true/false",
    saveArticle: "Cikk mentése",
    startupWarmup: "Rövid bemelegítés",
    startupTitle: "Egy szó bemelegítésnek",
    startupQ1: "Mit jelent ez a német szó?",
    startupQ2: "Hogy mondjuk ezt németül?",
    skip: "Kihagyás",
    next: "Tovább",
    done: "Kész"
  }
};

Object.assign(UI_TEXT.sk, {
  loginMismatch: "Meno alebo PIN nesedí. Ak si nový používateľ, vytvor nový profil.",
  loginFill: "Vyplň meno aj PIN.",
  profileExists: "Tento profil už existuje. Prihlás sa správnym PINom.",
  setupFill: "Vyplň obe mená aj oba PINy.",
  setupDifferentNames: "Profily musia mať rozdielne mená.",
  setupDifferentRoles: "Vyber raz učiteľa a raz žiaka.",
  setupNameExists: "Aspoň jedno meno profilu už existuje.",
  editorNeedsSupabase: "Editor vie ukladať až po zapnutí Supabase.",
  articleSaved: "Článok je uložený.",
  validationFillArticle: "Vyplň názov, ID, úroveň, kategóriu, popis a aspoň jeden odsek textu.",
  validationQuestion: "Pridaj aspoň jednu pravda/nepravda vetu.",
  copied: "Skopírované.",
  nothingToCopy: "Nie je čo kopírovať.",
  copyFailed: "Automatické kopírovanie zlyhalo. Prompt je zobrazený nižšie, skopíruj ho ručne.",
  selectWordFirst: "Najprv označ slovo alebo frázu v texte článku.",
  selectedAdded: "Označený text je pridaný.",
  expressionExists: "Tento výraz už v zozname je.",
  promptArticleCopied: "Prompt pre článok je skopírovaný.",
  promptTranslationCopied: "Slovíčka na preklad sú skopírované.",
  promptQuestionsCopied: "Prompt pre otázky je skopírovaný.",
  notificationUnsupported: "Tento prehliadač nepodporuje notifikácie.",
  notificationDefault: "Notifikácie ešte nie sú povolené.",
  notificationGranted: "Notifikácie sú povolené pre toto zariadenie.",
  notificationDenied: "Notifikácie sú zablokované v prehliadači.",
  notificationNotAllowed: "Notifikácie nie sú povolené.",
  notificationSent: "Skúšobná notifikácia odoslaná.",
  notificationBody: "Skúšobná pripomienka funguje.",
  pushBody: "Dnes stačí pár minút nemčiny."
});

Object.assign(UI_TEXT.de, {
  loginMismatch: "Name oder PIN stimmt nicht. Wenn du neu bist, erstelle ein neues Profil.",
  loginFill: "Gib bitte Name und PIN ein.",
  profileExists: "Dieses Profil gibt es schon. Melde dich mit dem passenden PIN an.",
  setupFill: "Gib bitte beide Namen und beide PINs ein.",
  setupDifferentNames: "Die Profile brauchen unterschiedliche Namen.",
  setupDifferentRoles: "Wähle einmal Lehrer/in und einmal Schüler/in.",
  setupNameExists: "Mindestens ein Profilname existiert schon.",
  editorNeedsSupabase: "Der Editor kann erst nach aktiviertem Supabase speichern.",
  articleSaved: "Der Artikel ist gespeichert.",
  validationFillArticle: "Fülle Titel, ID, Niveau, Kategorie, Beschreibung und mindestens einen Textabsatz aus.",
  validationQuestion: "Füge mindestens einen richtig/falsch-Satz hinzu.",
  copied: "Kopiert.",
  nothingToCopy: "Es gibt nichts zu kopieren.",
  copyFailed: "Automatisches Kopieren ist fehlgeschlagen. Der Prompt ist unten sichtbar, kopiere ihn manuell.",
  selectWordFirst: "Markiere zuerst ein Wort oder eine Phrase im Artikeltext.",
  selectedAdded: "Der markierte Text wurde hinzugefügt.",
  expressionExists: "Dieser Ausdruck ist schon in der Liste.",
  promptArticleCopied: "Prompt für den Artikel kopiert.",
  promptTranslationCopied: "Wörter zum Übersetzen kopiert.",
  promptQuestionsCopied: "Prompt für Fragen kopiert.",
  notificationUnsupported: "Dieser Browser unterstützt keine Benachrichtigungen.",
  notificationDefault: "Benachrichtigungen sind noch nicht erlaubt.",
  notificationGranted: "Benachrichtigungen sind für dieses Gerät erlaubt.",
  notificationDenied: "Benachrichtigungen sind im Browser blockiert.",
  notificationNotAllowed: "Benachrichtigungen sind nicht erlaubt.",
  notificationSent: "Testbenachrichtigung gesendet.",
  notificationBody: "Die Testerinnerung funktioniert.",
  pushBody: "Heute reichen ein paar Minuten Deutsch."
});

Object.assign(UI_TEXT.ru, {
  loginMismatch: "Имя или PIN не совпадают. Если вы новый пользователь, создайте новый профиль.",
  loginFill: "Введите имя и PIN.",
  profileExists: "Такой профиль уже есть. Войдите с правильным PIN.",
  setupFill: "Введите оба имени и оба PIN.",
  setupDifferentNames: "У профилей должны быть разные имена.",
  setupDifferentRoles: "Выберите одного учителя и одного ученика.",
  setupNameExists: "Хотя бы одно имя профиля уже существует.",
  editorNeedsSupabase: "Редактор сохраняет только после включения Supabase.",
  articleSaved: "Статья сохранена.",
  validationFillArticle: "Заполните название, ID, уровень, категорию, описание и хотя бы один абзац текста.",
  validationQuestion: "Добавьте хотя бы одно предложение правда/неправда.",
  copied: "Скопировано.",
  nothingToCopy: "Нечего копировать.",
  copyFailed: "Автоматическое копирование не удалось. Prompt показан ниже, скопируйте его вручную.",
  selectWordFirst: "Сначала выделите слово или фразу в тексте статьи.",
  selectedAdded: "Выделенный текст добавлен.",
  expressionExists: "Это выражение уже есть в списке.",
  promptArticleCopied: "Prompt для статьи скопирован.",
  promptTranslationCopied: "Слова для перевода скопированы.",
  promptQuestionsCopied: "Prompt для вопросов скопирован.",
  notificationUnsupported: "Этот браузер не поддерживает уведомления.",
  notificationDefault: "Уведомления еще не разрешены.",
  notificationGranted: "Уведомления разрешены для этого устройства.",
  notificationDenied: "Уведомления заблокированы в браузере.",
  notificationNotAllowed: "Уведомления не разрешены.",
  notificationSent: "Тестовое уведомление отправлено.",
  notificationBody: "Тестовое напоминание работает.",
  pushBody: "Сегодня достаточно нескольких минут немецкого."
});

Object.assign(UI_TEXT.pl, {
  loginMismatch: "Imię albo PIN się nie zgadza. Jeśli jesteś nowym użytkownikiem, utwórz nowy profil.",
  loginFill: "Wpisz imię i PIN.",
  profileExists: "Ten profil już istnieje. Zaloguj się właściwym PIN-em.",
  setupFill: "Wpisz oba imiona i oba PIN-y.",
  setupDifferentNames: "Profile muszą mieć różne imiona.",
  setupDifferentRoles: "Wybierz jednego nauczyciela i jednego ucznia.",
  setupNameExists: "Co najmniej jedna nazwa profilu już istnieje.",
  editorNeedsSupabase: "Edytor zapisuje dopiero po włączeniu Supabase.",
  articleSaved: "Artykuł zapisany.",
  validationFillArticle: "Uzupełnij tytuł, ID, poziom, kategorię, opis i przynajmniej jeden akapit tekstu.",
  validationQuestion: "Dodaj przynajmniej jedno zdanie prawda/nieprawda.",
  copied: "Skopiowano.",
  nothingToCopy: "Nie ma czego kopiować.",
  copyFailed: "Automatyczne kopiowanie nie powiodło się. Prompt jest pokazany niżej, skopiuj go ręcznie.",
  selectWordFirst: "Najpierw zaznacz słowo albo frazę w tekście artykułu.",
  selectedAdded: "Zaznaczony tekst został dodany.",
  expressionExists: "To wyrażenie już jest na liście.",
  promptArticleCopied: "Prompt dla artykułu skopiowany.",
  promptTranslationCopied: "Słówka do tłumaczenia skopiowane.",
  promptQuestionsCopied: "Prompt dla pytań skopiowany.",
  notificationUnsupported: "Ta przeglądarka nie obsługuje powiadomień.",
  notificationDefault: "Powiadomienia nie są jeszcze dozwolone.",
  notificationGranted: "Powiadomienia są dozwolone dla tego urządzenia.",
  notificationDenied: "Powiadomienia są zablokowane w przeglądarce.",
  notificationNotAllowed: "Powiadomienia nie są dozwolone.",
  notificationSent: "Testowe powiadomienie wysłane.",
  notificationBody: "Testowe przypomnienie działa.",
  pushBody: "Dziś wystarczy kilka minut niemieckiego."
});

Object.assign(UI_TEXT.hu, {
  loginMismatch: "A név vagy a PIN nem egyezik. Ha új felhasználó vagy, hozz létre új profilt.",
  loginFill: "Add meg a nevet és a PIN-t.",
  profileExists: "Ez a profil már létezik. Jelentkezz be a megfelelő PIN-nel.",
  setupFill: "Add meg mindkét nevet és mindkét PIN-t.",
  setupDifferentNames: "A profilok neve legyen különböző.",
  setupDifferentRoles: "Válassz egy tanárt és egy tanulót.",
  setupNameExists: "Legalább az egyik profilnév már létezik.",
  editorNeedsSupabase: "A szerkesztő csak bekapcsolt Supabase mellett tud menteni.",
  articleSaved: "A cikk mentve.",
  validationFillArticle: "Töltsd ki a címet, ID-t, szintet, kategóriát, leírást és legalább egy bekezdést.",
  validationQuestion: "Adj hozzá legalább egy igaz/hamis mondatot.",
  copied: "Másolva.",
  nothingToCopy: "Nincs mit másolni.",
  copyFailed: "Az automatikus másolás nem sikerült. A prompt lent látható, másold ki kézzel.",
  selectWordFirst: "Először jelölj ki egy szót vagy kifejezést a cikk szövegében.",
  selectedAdded: "A kijelölt szöveg hozzáadva.",
  expressionExists: "Ez a kifejezés már szerepel a listában.",
  promptArticleCopied: "A cikk prompt másolva.",
  promptTranslationCopied: "A fordítandó szavak másolva.",
  promptQuestionsCopied: "A kérdések prompt másolva.",
  notificationUnsupported: "Ez a böngésző nem támogatja az értesítéseket.",
  notificationDefault: "Az értesítések még nincsenek engedélyezve.",
  notificationGranted: "Az értesítések engedélyezve vannak ezen az eszközön.",
  notificationDenied: "Az értesítések blokkolva vannak a böngészőben.",
  notificationNotAllowed: "Az értesítések nincsenek engedélyezve.",
  notificationSent: "Teszt értesítés elküldve.",
  notificationBody: "A teszt emlékeztető működik.",
  pushBody: "Ma elég pár perc német."
});

const state = {
  articles: [],
  profiles: [],
  preLoginLanguage: DEFAULT_PRELOGIN_LANGUAGE,
  selectedCategory: ALL_CATEGORIES,
  currentArticle: null,
  currentProfile: null,
  profileData: emptyProfileData(),
  speech: {
    sentenceIndex: 0,
    isReading: false,
    utterance: null,
    mode: "text",
    runId: 0
  },
  articleReadTimer: null,
  startupQuiz: {
    questions: [],
    index: 0,
    answered: false,
    shown: false
  },
  sentenceGame: {
    solution: [],
    chosen: [],
    bank: []
  },
  matchGame: {
    cards: [],
    selectedIds: [],
    matchedIds: []
  },
  vocabChoiceGame: null,
  clozeGame: null,
  mistakeGame: null,
  wordSearchGame: {
    words: [],
    found: [],
    selected: []
  },
  showAllCategories: false,
  remoteReady: Boolean(SUPABASE_CONFIG.url && SUPABASE_CONFIG.anonKey)
};

const $ = (id) => document.getElementById(id);

function getUiLanguage() {
  if (state.currentProfile) return getNativeLanguage(state.currentProfile);
  return state.preLoginLanguage || DEFAULT_PRELOGIN_LANGUAGE;
}

function t(key, language = getUiLanguage()) {
  return UI_TEXT[language]?.[key] || UI_TEXT[DEFAULT_PRELOGIN_LANGUAGE][key] || UI_TEXT[DEFAULT_NATIVE_LANGUAGE][key] || key;
}

function setText(id, key) {
  const element = $(id);
  if (element) element.textContent = t(key);
}

function setLabelText(inputId, key) {
  const input = $(inputId);
  const label = input?.closest("label");
  if (label?.firstChild) label.firstChild.textContent = `${t(key)}\n            `;
}

function setOptionText(selectId, value, key) {
  const option = $(`${selectId}`)?.querySelector(`option[value="${value}"]`);
  if (option) option.textContent = t(key);
}

function isSupportedNativeLanguage(language) {
  return Boolean(NATIVE_LANGUAGES[language]);
}

function getNativeLanguage(profile = state.currentProfile) {
  return isSupportedNativeLanguage(profile?.nativeLanguage)
    ? profile.nativeLanguage
    : DEFAULT_NATIVE_LANGUAGE;
}

function getNativeLanguageInfo(language = getNativeLanguage()) {
  return NATIVE_LANGUAGES[isSupportedNativeLanguage(language) ? language : DEFAULT_NATIVE_LANGUAGE];
}

function getVocabularyTranslation(item, language = getNativeLanguage()) {
  if (!item) return "";
  if (item[language]) return item[language];
  return language === DEFAULT_NATIVE_LANGUAGE ? item.translation || "" : "";
}

function makeVocabularyItem(de, translation, language = getNativeLanguage()) {
  return {
    de: (de || "").trim(),
    [language]: (translation || "").trim()
  };
}

const CATEGORY_LABELS = {
  "Jedlo": { sk: "Jedlo", ru: "Еда", pl: "Jedzenie", hu: "Étel" },
  "Voľný čas": { sk: "Voľný čas", ru: "Свободное время", pl: "Czas wolny", hu: "Szabadidő" },
  "Každodenný život": { sk: "Každodenný život", ru: "Повседневная жизнь", pl: "Codzienne życie", hu: "Mindennapi élet" },
  "Cestovanie": { sk: "Cestovanie", ru: "Путешествия", pl: "Podróże", hu: "Utazás" },
  "Nakupovanie": { sk: "Nakupovanie", ru: "Покупки", pl: "Zakupy", hu: "Vásárlás" }
};

function getCategoryLabel(category) {
  if (category === ALL_CATEGORIES) return t("all");
  return CATEGORY_LABELS[category]?.[getUiLanguage()] || category;
}

function normalizeName(value) {
  return value.trim().toLocaleLowerCase("sk");
}

function makeProfileId(name) {
  return normalizeName(name)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function makeArticleId(title) {
  return makeProfileId(title);
}

function profileDataKey(profileId) {
  return `profileData:${profileId}`;
}

function emptyProfileData() {
  return {
    readIds: [],
    discoveredVocabulary: {},
    answers: {},
    practiceLog: [],
    completedTasks: {}
  };
}

function showView(viewId) {
  ["setupView", "loginView", "homeView", "articleView", "settingsView", "teacherView"].forEach(id => {
    $(id).classList.toggle("hidden", id !== viewId);
  });
}

function updateStaticTexts() {
  document.documentElement.lang = getUiLanguage();
  document.title = t("appTitle");
  document.querySelector(".topbar h1").textContent = t("appTitle");
  document.querySelector(".topbar .eyebrow").textContent = t("languageLabel");
  $("teacherBtn").setAttribute("aria-label", t("overview"));
  $("settingsBtn").setAttribute("aria-label", t("settings"));

  document.querySelector("#setupView .eyebrow").textContent = t("setupEyebrow");
  document.querySelector("#setupView h2").textContent = t("setupTitle");
  document.querySelector("#setupView .muted").textContent = t("setupNote");
  setLabelText("teacherNameInput", "profile1Name");
  setLabelText("teacherPinInput", "profile1Pin");
  setLabelText("teacherRoleSelect", "profile1Role");
  setLabelText("teacherNativeLanguageSelect", "profile1Language");
  setLabelText("studentNameInput", "profile2Name");
  setLabelText("studentPinInput", "profile2Pin");
  setLabelText("studentRoleSelect", "profile2Role");
  setLabelText("setupNativeLanguageSelect", "profile2Language");
  setOptionText("teacherRoleSelect", "teacher", "teacherRole");
  setOptionText("teacherRoleSelect", "student", "studentRole");
  setOptionText("studentRoleSelect", "teacher", "teacherRole");
  setOptionText("studentRoleSelect", "student", "studentRole");
  setText("createProfilesBtn", "saveProfiles");
  setText("setupBackBtn", "backToLogin");

  document.querySelector("#loginView .eyebrow").textContent = t("loginEyebrow");
  document.querySelector("#loginView h2").textContent = t("loginTitle");
  setLabelText("loginNameInput", "name");
  setLabelText("loginPinInput", "pin");
  setLabelText("loginNativeLanguageSelect", "nativeLanguage");
  setText("loginBtn", "login");
  setText("registerProfileBtn", "newProfile");
  setText("setupPairBtn", "setupPair");

  setText("logoutBtn", "logout");
  document.querySelector("#homeView .section-title h3").textContent = t("articles");
  setText("refreshBtn", "refresh");

  setText("backBtn", "back");
  setText("readAloudBtn", "readText");
  setText("listenOnlyBtn", "listenOnly");
  setText("pauseReadBtn", "pause");
  setText("stopReadBtn", "stop");
  setLabelText("speechRateSelect", "speed");
  setOptionText("speechRateSelect", "0.65", "slower");
  setOptionText("speechRateSelect", "1", "speedNormal");
  setOptionText("speechRateSelect", "1.35", "faster");
  setText("showTextAfterListeningBtn", "showText");
  setText("markReadBtn", "markRead");

  document.querySelectorAll("#articleView .practice-heading .eyebrow").forEach(item => item.textContent = t("game"));
  document.querySelector("#articleView .practice-panel:nth-of-type(1) .eyebrow").textContent = t("overview");
  document.querySelector("#articleView .practice-panel:nth-of-type(1) h3").textContent = t("vocabulary");
  document.querySelector("#articleView .practice-panel:nth-of-type(2) .eyebrow").textContent = t("practice");
  document.querySelector("#articleView .practice-panel:nth-of-type(2) h3").textContent = t("questions");
  setText("sentenceGameTitle", "sentenceOrder");
  setText("newSentenceGameBtn", "newSentence");
  setText("matchGameTitle", "matchPairs");
  setText("newMatchGameBtn", "shuffle");
  setText("vocabChoiceTitle", "vocabChoice");
  setText("newVocabChoiceBtn", "newVocab");
  setText("clozeGameTitle", "cloze");
  setText("newClozeGameBtn", "newSentence");
  setText("mistakeGameTitle", "mistake");
  setText("newMistakeGameBtn", "newSentence");
  setText("wordSearchTitle", "wordSearch");
  setText("newWordSearchBtn", "newGame");

  setText("settingsBackBtn", "back");
  document.querySelector("#settingsView h2").textContent = t("settingsTitle");
  setLabelText("fontSizeSelect", "fontSize");
  setOptionText("fontSizeSelect", "normal", "normal");
  setOptionText("fontSizeSelect", "large", "large");
  setOptionText("fontSizeSelect", "xlarge", "xlarge");
  setLabelText("settingsNativeLanguageSelect", "nativeLanguage");
  setLabelText("settingsRoleSelect", "profileRole");
  setOptionText("settingsRoleSelect", "teacher", "teacherRole");
  setOptionText("settingsRoleSelect", "student", "studentRole");
  setLabelText("darkModeToggle", "darkMode");
  document.querySelector("#notificationStatus").previousElementSibling.textContent = t("notifications");
  setText("notificationStatus", "notificationNote");
  setText("testNotificationBtn", "testNotification");

  setText("teacherBackBtn", "back");
  document.querySelector("#teacherView > .reader-card .eyebrow").textContent = t("teacherView");
  document.querySelector("#teacherView > .reader-card h2").textContent = t("studentOverview");
  document.querySelector(".article-editor .practice-heading .eyebrow").textContent = t("teacherArticles");
  document.querySelector(".article-editor .practice-heading h2").textContent = t("articleEditor");
  setText("newArticleBtn", "newArticle");
  setLabelText("articleEditorSelect", "editArticle");
  setLabelText("articleVisibilitySelect", "visibility");
  setOptionText("articleVisibilitySelect", "private", "privateArticle");
  setOptionText("articleVisibilitySelect", "public", "publicAfterApproval");
  setLabelText("articleApprovalStatusSelect", "approvalStatus");
  setOptionText("articleApprovalStatusSelect", "draft", "draft");
  setOptionText("articleApprovalStatusSelect", "pending", "pending");
  setOptionText("articleApprovalStatusSelect", "approved", "approved");
  setOptionText("articleApprovalStatusSelect", "rejected", "rejected");
  document.querySelector(".editor-helper .eyebrow").textContent = t("chatGptHelper");
  setLabelText("articlePromptInput", "articleTask");
  setLabelText("articleRequiredWordsInput", "requiredWords");
  setText("copyArticlePromptBtn", "copyArticlePrompt");
  setText("copyTranslationPromptBtn", "copyTranslationPrompt");
  setText("copyQuestionsPromptBtn", "copyQuestionsPrompt");
  setLabelText("generatedPromptOutput", "generatedPrompt");
  setText("missingTranslationsTitle", "missingTranslations");
  setLabelText("articleTitleInput", "title");
  setLabelText("articleLevelInput", "level");
  setLabelText("articleCategoryInput", "category");
  setLabelText("articleSummaryInput", "summary");
  setLabelText("articleTextInput", "articleTextLabel");
  setText("addSelectedVocabularyBtn", "addSelectedVocabulary");
  setText("addSelectedInlineBtn", "addSelectedInline");
  setLabelText("articleVocabularyInput", "vocabInputLabel");
  setLabelText("articleInlineVocabularyInput", "inlineVocabInputLabel");
  setLabelText("articleQuestionsInput", "questionsInputLabel");
  setText("saveArticleBtn", "saveArticle");

  document.querySelector("#startupQuiz .eyebrow").textContent = t("startupWarmup");
  setText("startupQuizTitle", "startupTitle");
  setText("skipStartupQuizBtn", "skip");
  setText("nextStartupQuizBtn", "next");

  renderCurrentProfileLabel();
  renderCategories();
  renderArticles();
}

async function supabaseRequest(path, options = {}) {
  if (!state.remoteReady) return null;

  const response = await fetch(`${SUPABASE_CONFIG.url.replace(/\/$/, "")}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_CONFIG.anonKey,
      Authorization: `Bearer ${SUPABASE_CONFIG.anonKey}`,
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

async function loadProfiles() {
  state.profiles = JSON.parse(localStorage.getItem(PROFILE_KEY) || "[]");
  state.profiles = state.profiles.map(normalizeProfile);
  ensureProfileGroups();

  if (!state.remoteReady) return;

  try {
    let profiles;
    try {
      profiles = await supabaseRequest("app_profiles?select=id,name,pin,role,native_language,teacher_group_id&order=role.desc,name.asc");
    } catch (error) {
      profiles = await supabaseRequest("app_profiles?select=id,name,pin,role&order=role.desc,name.asc");
    }
    if (profiles?.length) {
      state.profiles = profiles.map(rowToProfile);
      ensureProfileGroups();
      localStorage.setItem(PROFILE_KEY, JSON.stringify(state.profiles));
    } else if (state.profiles.length) {
      await saveProfiles();
    }
  } catch (error) {
    console.error(error);
  }
}

async function saveProfiles() {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(state.profiles));

  if (!state.remoteReady || !state.profiles.length) return;

  try {
    try {
      await supabaseRequest("app_profiles?on_conflict=id", {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates" },
        body: JSON.stringify(state.profiles.map(profileToRow))
      });
    } catch (error) {
      await supabaseRequest("app_profiles?on_conflict=id", {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates" },
        body: JSON.stringify(state.profiles.map(({ id, name, pin, role }) => ({ id, name, pin, role })))
      });
    }
  } catch (error) {
    console.error(error);
  }
}

function normalizeProfile(profile) {
  return {
    ...profile,
    teacherGroupId: profile?.teacherGroupId || profile?.teacher_group_id || null,
    nativeLanguage: isSupportedNativeLanguage(profile?.nativeLanguage)
      ? profile.nativeLanguage
      : DEFAULT_NATIVE_LANGUAGE
  };
}

function ensureProfileGroups() {
  if (!state.profiles.length) return;

  const fallbackTeacher = state.profiles.find(profile => profile.role === "teacher") || state.profiles[0];
  state.profiles = state.profiles.map(profile => ({
    ...profile,
    teacherGroupId: profile.teacherGroupId || (profile.role === "teacher" ? profile.id : fallbackTeacher.id)
  }));
}

function rowToProfile(row) {
  return normalizeProfile({
    id: row.id,
    name: row.name,
    pin: row.pin,
    role: row.role,
    nativeLanguage: row.native_language,
    teacherGroupId: row.teacher_group_id
  });
}

function profileToRow(profile) {
  return {
    id: profile.id,
    name: profile.name,
    pin: profile.pin,
    role: profile.role,
    teacher_group_id: profile.teacherGroupId || profile.id,
    native_language: getNativeLanguage(profile)
  };
}

async function loadArticles() {
  let localArticles = [];

  try {
    const response = await fetch("articles.json", { cache: "no-store" });
    localArticles = await response.json();
  } catch (error) {
    console.error(error);
    localArticles = [];
  }

  state.articles = localArticles.map(normalizeArticle);

  if (state.remoteReady) {
    try {
      let remoteArticles = await loadRemoteArticles();
      const remoteIds = new Set(remoteArticles.map(article => article.id));
      const missingLocalArticles = localArticles.filter(article => !remoteIds.has(article.id));

      if (missingLocalArticles.length) {
        await saveRemoteArticles(missingLocalArticles, { preserveUpdatedAt: true });
        remoteArticles = await loadRemoteArticles();
      }

      if (remoteArticles.length) {
        state.articles = remoteArticles.map(normalizeArticle);
      }
    } catch (error) {
      console.error(error);
    }
  }

  renderCategories();
  renderArticles();
}

async function loadRemoteArticles() {
  const rows = await supabaseRequest("app_articles?select=*&published=eq.true&order=updated_at.desc,title.asc");
  return (rows || []).map(rowToArticle);
}

function normalizeArticle(article) {
  return {
    ...article,
    ownerProfileId: article.ownerProfileId || article.owner_profile_id || null,
    teacherGroupId: article.teacherGroupId || article.teacher_group_id || null,
    visibility: article.visibility || "public",
    approvalStatus: article.approvalStatus || article.approval_status || "approved"
  };
}

function canViewArticle(article, profile = state.currentProfile) {
  if (!article?.published && article?.published !== undefined) return false;
  if (article.visibility === "public" && article.approvalStatus === "approved") return true;
  if (!profile) return false;
  if (profile.role === "teacher" && (
    article.teacherGroupId === profile.teacherGroupId
    || article.ownerProfileId === profile.id
    || !article.teacherGroupId
  )) return true;
  return article.ownerProfileId === profile.id;
}

function isInCurrentTeacherGroup(profile) {
  if (!state.currentProfile || !profile) return false;
  if (state.currentProfile.role !== "teacher") return profile.id === state.currentProfile.id;
  const teacherGroupId = state.currentProfile.teacherGroupId || state.currentProfile.id;
  return profile.teacherGroupId === teacherGroupId && profile.id !== state.currentProfile.id;
}

function getVisibleArticles() {
  return state.articles.filter(article => canViewArticle(article));
}

function getEditableArticles() {
  if (!state.currentProfile) return [];
  if (state.currentProfile.role === "teacher") {
    return state.articles.filter(article =>
      article.visibility === "public"
      || article.ownerProfileId === state.currentProfile.id
      || article.teacherGroupId === state.currentProfile.teacherGroupId
      || !article.teacherGroupId
    );
  }
  return state.articles.filter(article => article.ownerProfileId === state.currentProfile.id);
}

async function saveRemoteArticles(articles, options = {}) {
  if (!state.remoteReady || !articles.length) return;

  await supabaseRequest("app_articles?on_conflict=id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify(articles.map(article => articleToRow(article, options)))
  });
}

function rowToArticle(row) {
  return {
    id: row.id,
    ownerProfileId: row.owner_profile_id || null,
    teacherGroupId: row.teacher_group_id || null,
    visibility: row.visibility || "public",
    approvalStatus: row.approval_status || "approved",
    title: row.title,
    level: row.level,
    category: row.category,
    summary: row.summary,
    text: row.text || [],
    vocabulary: row.vocabulary || [],
    inlineVocabulary: row.inline_vocabulary || [],
    questions: row.questions || [],
    updatedAt: row.updated_at || null
  };
}

function articleToRow(article, options = {}) {
  const row = {
    id: article.id,
    owner_profile_id: article.ownerProfileId || null,
    teacher_group_id: article.teacherGroupId || null,
    visibility: article.visibility || "public",
    approval_status: article.approvalStatus || "approved",
    title: article.title,
    level: article.level,
    category: article.category,
    summary: article.summary,
    text: article.text || [],
    vocabulary: article.vocabulary || [],
    inline_vocabulary: getInlineVocabulary(article),
    questions: article.questions || [],
    published: article.published !== false
  };

  if (!options.preserveUpdatedAt) {
    row.updated_at = new Date().toISOString();
  }

  return row;
}

async function saveArticle(article) {
  if (!state.remoteReady) {
    throw new Error("Editor článkov potrebuje zapnutý Supabase.");
  }

  article = normalizeArticle(article);

  await supabaseRequest("app_articles?on_conflict=id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify([articleToRow(article)])
  });

  const index = state.articles.findIndex(item => item.id === article.id);
  if (index >= 0) {
    state.articles[index] = article;
  } else {
    state.articles = [article, ...state.articles];
  }
  renderCategories();
  renderArticles();
  renderArticleEditorList(article.id);
}

function getCategories() {
  const categories = [];
  const seen = new Set();

  getVisibleArticles().forEach(article => {
    if (!article.category || seen.has(article.category)) return;
    seen.add(article.category);
    categories.push(article.category);
  });

  return [ALL_CATEGORIES, ...categories];
}

function renderCategories() {
  const root = $("categoryFilters");
  const categories = getCategories();
  const visibleCategories = state.showAllCategories
    ? categories
    : categories.slice(0, VISIBLE_CATEGORY_LIMIT);
  const hasMore = categories.length > VISIBLE_CATEGORY_LIMIT;

  root.innerHTML = "";
  visibleCategories.forEach(category => {
    const btn = document.createElement("button");
    btn.className = "chip" + (category === state.selectedCategory ? " active" : "");
    btn.textContent = getCategoryLabel(category);
    btn.onclick = () => {
      state.selectedCategory = category;
      renderCategories();
      renderArticles();
    };
    root.appendChild(btn);
  });

  if (hasMore) {
    const btn = document.createElement("button");
    btn.className = "chip more-chip";
    btn.textContent = state.showAllCategories ? t("lessTopics") : t("moreTopics");
    btn.onclick = () => {
      state.showAllCategories = !state.showAllCategories;
      renderCategories();
    };
    root.appendChild(btn);
  }
}

function renderArticles() {
  const root = $("articleList");
  const articles = (state.selectedCategory === ALL_CATEGORIES
    ? getVisibleArticles()
    : getVisibleArticles().filter(a => a.category === state.selectedCategory));

  root.innerHTML = "";

  articles.forEach(article => {
    const isRead = state.profileData.readIds.includes(article.id);
    const btn = document.createElement("button");
    btn.className = "article-card";
    btn.innerHTML = `
      <h4>${escapeHtml(article.title)}</h4>
      <p>${escapeHtml(article.summary)}</p>
      <div class="badges">
        <span class="badge">${escapeHtml(article.level)}</span>
        <span class="badge">${escapeHtml(getCategoryLabel(article.category))}</span>
        ${article.visibility === "private" ? `<span class="badge">${escapeHtml(t("private"))}</span>` : ""}
        ${article.visibility === "public" && article.approvalStatus !== "approved" ? `<span class="badge">${escapeHtml(t("pendingApproval"))}</span>` : ""}
        ${isRead ? `<span class="badge">✓ ${escapeHtml(t("read"))}</span>` : ""}
      </div>
    `;
    btn.onclick = () => openArticle(article.id);
    root.appendChild(btn);
  });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function shuffle(items) {
  return [...items].sort(() => Math.random() - 0.5);
}

function getArticleSentences(article) {
  if (!article) return [];

  return article.text.flatMap(paragraph =>
    paragraph.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [paragraph]
  ).map(sentence => sentence.trim()).filter(Boolean);
}

function getSentenceWords(sentence) {
  return sentence.match(/[\p{L}\p{N}]+(?:[-'][\p{L}\p{N}]+)?/gu) || [];
}

function getInlineVocabulary(article) {
  return article.inlineVocabulary || article.clickVocabulary || [];
}

function normalizeVocabularyKey(value) {
  return String(value)
    .trim()
    .toLocaleLowerCase("de")
    .replace(/^(der|die|das|ein|eine)\s+/u, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function getSavedVocabulary(article) {
  if (!article) return [];
  return state.profileData.discoveredVocabulary[article.id] || [];
}

function getVisibleVocabulary(article) {
  const initialVocabulary = article.vocabulary || [];
  const savedVocabulary = getSavedVocabulary(article);
  const seen = new Set();

  return [...initialVocabulary, ...savedVocabulary].filter(item => {
    const key = normalizeVocabularyKey(item.de);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function getVocabularySourceItem(article, word) {
  const key = normalizeVocabularyKey(word);
  return [
    ...(article?.vocabulary || []),
    ...getInlineVocabulary(article)
  ].find(item => normalizeVocabularyKey(item.de) === key);
}

function makeDiscoveredVocabularyItem(article, word, translation) {
  const source = getVocabularySourceItem(article, word) || {};
  const item = { de: word };
  ["sk", "ru", "pl", "hu"].forEach(language => {
    if (source[language]) item[language] = source[language];
  });

  const language = getNativeLanguage();
  if (!item[language] && translation) item[language] = translation;
  return item;
}

function cleanupDiscoveredVocabulary(article) {
  if (!article || !state.profileData.discoveredVocabulary?.[article.id]) return;

  const initialKeys = new Set((article.vocabulary || []).map(item => normalizeVocabularyKey(item.de)));
  const cleaned = getSavedVocabulary(article).filter(item => !initialKeys.has(normalizeVocabularyKey(item.de)));

  if (cleaned.length !== getSavedVocabulary(article).length) {
    state.profileData.discoveredVocabulary[article.id] = cleaned;
    saveProfileData();
  }
}

function getAllVocabulary() {
  const seen = new Set();
  const language = getNativeLanguage();
  const locale = getNativeLanguageInfo(language).locale;
  return state.articles.flatMap(article => [
    ...(article.vocabulary || []),
    ...getInlineVocabulary(article)
  ]).filter(item => {
    const translation = getVocabularyTranslation(item, language);
    if (!item.de || !translation) return false;
    const key = `${item.de.toLocaleLowerCase("de")}|${translation.toLocaleLowerCase(locale)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function getPracticeVocabulary(article) {
  const seen = new Set();
  const language = getNativeLanguage();
  return [
    ...(article?.vocabulary || []),
    ...getInlineVocabulary(article),
    ...getSavedVocabulary(article)
  ]
    .filter(item => item.de && getVocabularyTranslation(item, language))
    .filter(item => getSentenceWords(item.de).length <= 2)
    .filter(item => item.de.length <= 18 && getVocabularyTranslation(item, language).length <= 32)
    .filter(item => {
      const key = normalizeVocabularyKey(item.de);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function normalizeSearchWord(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-zÄÖÜäöüß]/g, "")
    .toLocaleUpperCase("de")
    .replaceAll("Ä", "AE")
    .replaceAll("Ö", "OE")
    .replaceAll("Ü", "UE")
    .replaceAll("ẞ", "SS")
    .replaceAll("ß", "SS");
}

function getWordSearchVocabulary(article) {
  return getPracticeVocabulary(article)
    .map(item => ({ ...item, search: normalizeSearchWord(item.de) }))
    .filter(item => item.search.length >= 4 && item.search.length <= 10)
    .slice(0, 24);
}

async function saveProfileData() {
  if (!state.currentProfile) return;

  localStorage.setItem(profileDataKey(state.currentProfile.id), JSON.stringify(state.profileData));

  if (!state.remoteReady) return;

  try {
    await supabaseRequest("app_profile_data?on_conflict=profile_id", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates" },
      body: JSON.stringify({
        profile_id: state.currentProfile.id,
        data: state.profileData,
        updated_at: new Date().toISOString()
      })
    });
  } catch (error) {
    console.error(error);
  }
}

function logPractice(type, details = {}) {
  if (!state.currentProfile) return;

  const entry = {
    type,
    articleId: state.currentArticle?.id || null,
    articleTitle: state.currentArticle?.title || null,
    at: new Date().toISOString(),
    ...details
  };

  state.profileData.practiceLog = [
    entry,
    ...(state.profileData.practiceLog || [])
  ].slice(0, 80);
  saveProfileData();
}

function getQuestionTaskId(index) {
  return `question:${index}`;
}

function getTaskDefinitions(article) {
  if (!article) return [];

  const tasks = (article.questions || []).map((question, index) => ({
    id: getQuestionTaskId(index),
    label: `${t("questions")} ${index + 1}`,
    section: t("questions")
  }));

  if (hasSentenceOrderTask(article)) tasks.push({ id: "sentence-order", label: t("sentenceOrder"), section: t("game") });
  if (getVisibleVocabulary(article).length) tasks.push({ id: "match-pairs", label: t("matchPairs"), section: t("game") });
  if (getPracticeVocabulary(article).length >= 4) tasks.push({ id: "vocab-choice", label: t("vocabChoice"), section: t("game") });
  if (hasClozeTask(article)) tasks.push({ id: "cloze-word", label: t("cloze"), section: t("game") });
  if (hasMistakeTask(article)) tasks.push({ id: "find-mistake", label: t("mistake"), section: t("game") });
  if (getWordSearchVocabulary(article).length >= 3) tasks.push({ id: "word-search", label: t("wordSearch"), section: t("game") });

  return tasks;
}

function getArticleCompletedTasks(articleId) {
  return state.profileData.completedTasks?.[articleId] || [];
}

function isTaskCompleted(articleId, taskId) {
  return getArticleCompletedTasks(articleId).includes(taskId);
}

function markTaskCompleted(taskId) {
  const article = state.currentArticle;
  if (!article || !taskId) return;

  const completed = new Set(getArticleCompletedTasks(article.id));
  if (completed.has(taskId)) {
    renderArticleTaskProgress();
    return;
  }

  completed.add(taskId);
  state.profileData.completedTasks = {
    ...(state.profileData.completedTasks || {}),
    [article.id]: [...completed]
  };
  saveProfileData();
  renderArticleTaskProgress();
}

function getArticleTaskProgress(article, data = state.profileData) {
  const tasks = getTaskDefinitions(article);
  const completed = data.completedTasks?.[article.id] || [];
  return {
    total: tasks.length,
    done: tasks.filter(task => completed.includes(task.id)).length,
    tasks
  };
}

function renderArticleTaskProgress() {
  const article = state.currentArticle;
  if (!article) return;

  const progress = getArticleTaskProgress(article);
  const allDone = progress.total > 0 && progress.done === progress.total;
  $("articleTaskProgress").innerHTML = `
    <div class="task-progress-line ${allDone ? "complete" : ""}">
      <strong>${allDone ? escapeHtml(t("taskAllDone")) : escapeHtml(t("taskDone"))}</strong>
      <span>${progress.done}/${progress.total}</span>
    </div>
  `;
}

function renderVocabulary() {
  const article = state.currentArticle;
  $("vocabList").innerHTML = getVisibleVocabulary(article)
    .map(v => `<li><strong>${escapeHtml(v.de)}</strong> – ${escapeHtml(getVocabularyTranslation(v))}</li>`)
    .join("");
}

function renderArticleText(article) {
  const inlineVocabulary = getInlineVocabulary(article);
  const lookup = new Map(inlineVocabulary.map(v => [v.de.toLocaleLowerCase("de"), v]));
  const words = inlineVocabulary
    .map(v => v.de)
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);
  let sentenceIndex = 0;

  const renderSentence = (sentence) => {
    const index = sentenceIndex++;

    if (!words.length) {
      return `<span class="reading-sentence" data-sentence-index="${index}">${escapeHtml(sentence)}</span>`;
    }

    const pattern = new RegExp(`(^|[^\\p{L}\\p{N}_])(${words.map(escapeRegExp).join("|")})(?=$|[^\\p{L}\\p{N}_])`, "giu");
    const html = escapeHtml(sentence).replace(pattern, (match, prefix, word) => {
      const vocab = lookup.get(word.toLocaleLowerCase("de"));
      if (!vocab) return match;

      return `${prefix}<button class="inline-word" type="button" data-word="${escapeHtml(vocab.de)}" data-translation="${escapeHtml(getVocabularyTranslation(vocab))}" aria-expanded="false">${word}</button>`;
    });

    return `<span class="reading-sentence" data-sentence-index="${index}">${html}</span>`;
  };

  if (!words.length) {
    $("articleText").innerHTML = article.text
      .map(paragraph => `<p>${(paragraph.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [paragraph]).map(sentence => renderSentence(sentence.trim())).join(" ")}</p>`)
      .join("");
    return;
  }

  $("articleText").innerHTML = article.text
    .map(paragraph => `<p>${(paragraph.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [paragraph]).map(sentence => renderSentence(sentence.trim())).join(" ")}</p>`)
    .join("");
}

function getArticleAnswers(articleId) {
  return state.profileData.answers[articleId] || {};
}

function renderQuestions(article) {
  const answers = getArticleAnswers(article.id);
  $("questionList").innerHTML = article.questions
    .map((question, index) => `
      <li class="true-false-item ${isTaskCompleted(article.id, getQuestionTaskId(index)) ? "task-complete" : ""}">
        <div class="question-text">${escapeHtml(question.statement || question)}</div>
        <div class="true-false-actions">
          <button class="choice-btn ${answers[index] === true ? "selected" : ""}" type="button" data-question-index="${index}" data-answer="true">${escapeHtml(t("trueLabel"))}</button>
          <button class="choice-btn ${answers[index] === false ? "selected" : ""}" type="button" data-question-index="${index}" data-answer="false">${escapeHtml(t("falseLabel"))}</button>
        </div>
        <p class="practice-feedback">${typeof answers[index] === "boolean" ? (answers[index] === Boolean(question.answer) ? escapeHtml(t("correct")) : `${escapeHtml(t("correctIs"))} ${question.answer ? escapeHtml(t("trueLabel").toLocaleLowerCase()) : escapeHtml(t("falseLabel").toLocaleLowerCase())}`) : ""}</p>
      </li>
    `)
    .join("");
}

function setSpeechStatus(message = "") {
  $("speechStatus").textContent = message;
}

function setAudioOnlyMode(isAudioOnly) {
  $("articleView").classList.toggle("audio-only", isAudioOnly);
  $("showTextAfterListeningBtn").classList.add("hidden");
}

function showArticleText() {
  $("articleView").classList.remove("audio-only");
  $("showTextAfterListeningBtn").classList.add("hidden");
  setSpeechStatus("");
}

function clearReadingHighlight() {
  document.querySelectorAll(".reading-sentence.active").forEach(sentence => {
    sentence.classList.remove("active");
  });
}

function highlightSentence(index) {
  clearReadingHighlight();
  const sentence = document.querySelector(`.reading-sentence[data-sentence-index="${index}"]`);
  if (!sentence) return;
  sentence.classList.add("active");
  sentence.scrollIntoView({ behavior: "smooth", block: "center" });
}

function getGermanVoice() {
  const voices = window.speechSynthesis?.getVoices?.() || [];
  return voices.find(voice => voice.lang?.toLocaleLowerCase("de").startsWith("de"))
    || voices.find(voice => voice.lang?.toLocaleLowerCase().startsWith("de"))
    || null;
}

function loadSpeechVoices() {
  if (!("speechSynthesis" in window) || window.speechSynthesis.getVoices().length) {
    return Promise.resolve();
  }

  return new Promise(resolve => {
    const timeout = setTimeout(resolve, 350);
    window.speechSynthesis.onvoiceschanged = () => {
      clearTimeout(timeout);
      resolve();
    };
  });
}

function stopReading() {
  if (state.speech.utterance) {
    state.speech.utterance.onend = null;
    state.speech.utterance.onerror = null;
  }

  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }

  state.speech = {
    sentenceIndex: 0,
    isReading: false,
    utterance: null,
    mode: "text",
    runId: state.speech.runId + 1
  };
  $("readAloudBtn").textContent = t("readText");
  $("pauseReadBtn").textContent = t("pause");
  $("listenOnlyBtn").textContent = t("listenOnly");
  clearReadingHighlight();
  showArticleText();
  setSpeechStatus("");
}

function finishReading(message = t("finishedReading")) {
  const mode = state.speech.mode;
  state.speech.isReading = false;
  state.speech.utterance = null;
  state.speech.sentenceIndex = 0;
  state.speech.runId += 1;
  $("readAloudBtn").textContent = t("readText");
  $("pauseReadBtn").textContent = t("pause");
  $("listenOnlyBtn").textContent = t("listenOnly");
  clearReadingHighlight();
  setSpeechStatus(message);

  if (mode === "audioOnly") {
    $("showTextAfterListeningBtn").classList.remove("hidden");
  }
}

async function readSentence(index = 0, mode = "text") {
  if (!("speechSynthesis" in window)) {
    setSpeechStatus(t("browserNoSpeech"));
    return;
  }

  await loadSpeechVoices();

  const sentences = getArticleSentences(state.currentArticle);
  if (!sentences.length || index >= sentences.length) {
    finishReading();
    return;
  }

  if (state.speech.utterance) {
    state.speech.utterance.onend = null;
    state.speech.utterance.onerror = null;
  }

  window.speechSynthesis.cancel();
  const runId = state.speech.runId + 1;
  state.speech.sentenceIndex = index;
  state.speech.isReading = true;
  state.speech.mode = mode;
  state.speech.runId = runId;
  if (mode === "audioOnly") {
    setAudioOnlyMode(true);
  } else {
    setAudioOnlyMode(false);
    highlightSentence(index);
  }

  const utterance = new SpeechSynthesisUtterance(sentences[index]);
  utterance.lang = "de-DE";
  utterance.rate = Number($("speechRateSelect").value || 1);
  utterance.voice = getGermanVoice();
  utterance.onend = () => {
    if (state.speech.isReading && state.speech.utterance === utterance && state.speech.runId === runId) {
      readSentence(index + 1, state.speech.mode);
    }
  };
  utterance.onerror = (event) => {
    if (state.speech.utterance !== utterance) return;
    if (state.speech.runId !== runId) return;
    if (event.error === "interrupted" || event.error === "canceled") return;

    state.speech.isReading = false;
    setSpeechStatus(t("readingFailed"));
  };

  state.speech.utterance = utterance;
  $("readAloudBtn").textContent = t("restart");
  $("listenOnlyBtn").textContent = mode === "audioOnly" ? t("listening") : t("listenOnly");
  setSpeechStatus(mode === "audioOnly"
    ? t("listenSentence").replace("{current}", index + 1).replace("{total}", sentences.length)
    : t("readingSentence").replace("{current}", index + 1).replace("{total}", sentences.length));
  window.speechSynthesis.speak(utterance);
}

function listenWithoutText() {
  readSentence(0, "audioOnly");
}

function forceStopSpeech() {
  if (state.speech.utterance) {
    state.speech.utterance.onend = null;
    state.speech.utterance.onerror = null;
  }

  state.speech.isReading = false;
  state.speech.utterance = null;
  state.speech.runId += 1;

  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
}

function changeSpeechRate() {
  if (!state.speech.isReading) return;

  const index = state.speech.sentenceIndex;
  const mode = state.speech.mode;

  if (state.speech.utterance) {
    state.speech.utterance.onend = null;
    state.speech.utterance.onerror = null;
  }

  state.speech.runId += 1;
  window.speechSynthesis.cancel();
  setSpeechStatus(t("changingSpeed"));
  setTimeout(() => readSentence(index, mode), 80);
}

function togglePauseReading() {
  if (!("speechSynthesis" in window) || !state.speech.isReading) return;

  if (window.speechSynthesis.paused) {
    window.speechSynthesis.resume();
    $("pauseReadBtn").textContent = t("pause");
    setSpeechStatus(t("continuingReading"));
  } else {
    window.speechSynthesis.pause();
    $("pauseReadBtn").textContent = t("continueReading");
    setSpeechStatus(t("readingPaused"));
  }
}

function startSentenceGame() {
  const candidates = getArticleSentences(state.currentArticle)
    .map(sentence => ({ sentence, words: getSentenceWords(sentence) }))
    .filter(item => item.words.length >= 4 && item.words.length <= 10);
  const selected = shuffle(candidates)[0] || { words: [] };

  state.sentenceGame = {
    solution: selected.words,
    chosen: [],
    bank: shuffle(selected.words.map((word, index) => ({ id: `${index}-${word}`, word })))
  };
  renderSentenceGame();
}

function hasSentenceOrderTask(article) {
  return getArticleSentences(article)
    .map(sentence => getSentenceWords(sentence))
    .some(words => words.length >= 4 && words.length <= 10);
}

function renderSentenceGame() {
  const game = state.sentenceGame;
  $("sentenceTarget").innerHTML = game.chosen.length
    ? game.chosen.map(item => `<button class="word-chip selected" type="button" data-word-id="${escapeHtml(item.id)}">${escapeHtml(item.word)}</button>`).join("")
    : `<span class="muted">${escapeHtml(t("tapWords"))}</span>`;
  $("sentenceWordBank").innerHTML = game.bank
    .map(item => `<button class="word-chip" type="button" data-word-id="${escapeHtml(item.id)}">${escapeHtml(item.word)}</button>`)
    .join("");

  if (!game.solution.length) {
    $("sentenceGameFeedback").textContent = t("sentenceNoTask");
    return;
  }

  if (game.chosen.length !== game.solution.length) {
    $("sentenceGameFeedback").textContent = "";
    return;
  }

  const answer = game.chosen.map(item => item.word).join(" ");
  const solution = game.solution.join(" ");
  const isCorrect = answer === solution;
  $("sentenceGameFeedback").textContent = isCorrect
    ? t("sentenceCorrect")
    : t("sentenceRetry");
  logPractice("sentence-order", { correct: isCorrect, answer, solution });
  if (isCorrect) markTaskCompleted("sentence-order");
}

function chooseSentenceWord(id) {
  const item = state.sentenceGame.bank.find(word => word.id === id);
  if (!item) return;
  state.sentenceGame.bank = state.sentenceGame.bank.filter(word => word.id !== id);
  state.sentenceGame.chosen.push(item);
  renderSentenceGame();
}

function returnSentenceWord(id) {
  const item = state.sentenceGame.chosen.find(word => word.id === id);
  if (!item) return;
  state.sentenceGame.chosen = state.sentenceGame.chosen.filter(word => word.id !== id);
  state.sentenceGame.bank.push(item);
  renderSentenceGame();
}

function startMatchGame() {
  const vocabulary = shuffle(getVisibleVocabulary(state.currentArticle).filter(item => getVocabularyTranslation(item))).slice(0, 6);
  const cards = vocabulary.flatMap((item, index) => [
    { id: `${index}-de`, pairId: String(index), label: item.de, type: "de" },
    { id: `${index}-native`, pairId: String(index), label: getVocabularyTranslation(item), type: "native" }
  ]);

  state.matchGame = {
    cards: shuffle(cards),
    selectedIds: [],
    matchedIds: [],
    loggedComplete: false
  };
  renderMatchGame();
}

function renderMatchGame() {
  const game = state.matchGame;
  $("matchGameBoard").innerHTML = game.cards.map(card => {
    const isSelected = game.selectedIds.includes(card.id);
    const isMatched = game.matchedIds.includes(card.id);
    const classes = ["match-card", isSelected ? "selected" : "", isMatched ? "matched" : ""].filter(Boolean).join(" ");
    return `<button class="${classes}" type="button" data-card-id="${escapeHtml(card.id)}" ${isMatched ? "disabled" : ""}>${escapeHtml(card.label)}</button>`;
  }).join("");

  if (!game.cards.length) {
    $("matchGameFeedback").textContent = t("matchNoVocab");
  } else if (game.matchedIds.length === game.cards.length) {
    $("matchGameFeedback").textContent = t("matchDone");
    if (!game.loggedComplete) {
      game.loggedComplete = true;
      logPractice("match-pairs", { pairs: game.cards.length / 2 });
      markTaskCompleted("match-pairs");
    }
  } else {
    $("matchGameFeedback").textContent = "";
  }
}

function chooseMatchCard(id) {
  const game = state.matchGame;
  const card = game.cards.find(item => item.id === id);
  if (!card || game.selectedIds.length === 2 || game.matchedIds.includes(id) || game.selectedIds.includes(id)) return;

  game.selectedIds = [...game.selectedIds, id].slice(-2);
  renderMatchGame();

  if (game.selectedIds.length < 2) return;

  const [first, second] = game.selectedIds.map(selectedId => game.cards.find(item => item.id === selectedId));
  if (first.pairId === second.pairId && first.type !== second.type) {
    game.matchedIds.push(first.id, second.id);
    game.selectedIds = [];
    renderMatchGame();
  } else {
    $("matchGameFeedback").textContent = t("noPair");
    setTimeout(() => {
      game.selectedIds = [];
      renderMatchGame();
    }, 800);
  }
}

function startVocabChoiceGame() {
  const vocabulary = getPracticeVocabulary(state.currentArticle);
  if (vocabulary.length < 4) {
    state.vocabChoiceGame = null;
    $("vocabChoicePrompt").textContent = "";
    $("vocabChoiceOptions").innerHTML = "";
    $("vocabChoiceFeedback").textContent = t("vocabNeed4");
    return;
  }

  const correct = shuffle(vocabulary)[0];
  const correctTranslation = getVocabularyTranslation(correct);
  const options = shuffle([
    correctTranslation,
    ...shuffle(vocabulary.filter(item => getVocabularyTranslation(item) !== correctTranslation)).slice(0, 3).map(item => getVocabularyTranslation(item))
  ]);
  state.vocabChoiceGame = { correct, correctTranslation, options, answered: false };
  $("vocabChoicePrompt").textContent = correct.de;
  $("vocabChoiceOptions").innerHTML = options
    .map(option => `<button class="quiz-option" type="button" data-answer="${escapeHtml(option)}">${escapeHtml(option)}</button>`)
    .join("");
  $("vocabChoiceFeedback").textContent = "";
}

function answerVocabChoice(answer) {
  const game = state.vocabChoiceGame;
  if (!game || game.answered) return;
  game.answered = true;

  document.querySelectorAll("#vocabChoiceOptions .quiz-option").forEach(button => {
    const isCorrect = button.dataset.answer === game.correctTranslation;
    const isChosen = button.dataset.answer === answer;
    button.classList.toggle("correct", isCorrect);
    button.classList.toggle("wrong", isChosen && !isCorrect);
    button.disabled = true;
  });

  const isCorrect = answer === game.correctTranslation;
  $("vocabChoiceFeedback").textContent = isCorrect ? t("correct") : `${t("correctIs")} ${game.correctTranslation}`;
  logPractice("vocab-choice", { correct: isCorrect, prompt: game.correct.de, answer, expected: game.correctTranslation });
  if (isCorrect) markTaskCompleted("vocab-choice");
}

function findSentenceWithVocabulary(article) {
  const sentences = getArticleSentences(article);
  const vocabulary = getPracticeVocabulary(article);
  const candidates = [];

  vocabulary.forEach(item => {
    if (getSentenceWords(item.de).length !== 1) return;
    const pattern = new RegExp(`(^|[^\\p{L}\\p{N}_])(${escapeRegExp(item.de)})(?=$|[^\\p{L}\\p{N}_])`, "iu");
    sentences.forEach(sentence => {
      if (pattern.test(sentence)) candidates.push({ sentence, item, pattern });
    });
  });

  return shuffle(candidates)[0] || null;
}

function hasClozeTask(article) {
  const vocabulary = getPracticeVocabulary(article).filter(item => getSentenceWords(item.de).length === 1);
  return vocabulary.length >= 4 && Boolean(findSentenceWithVocabulary(article));
}

function hasMistakeTask(article) {
  const candidate = findSentenceWithVocabulary(article);
  const vocabulary = getPracticeVocabulary(article)
    .filter(item => getSentenceWords(item.de).length === 1 && item.de !== candidate?.item.de);
  return Boolean(candidate && vocabulary.length);
}

function startClozeGame() {
  const candidate = findSentenceWithVocabulary(state.currentArticle);
  const vocabulary = getPracticeVocabulary(state.currentArticle).filter(item => getSentenceWords(item.de).length === 1);
  if (!candidate || vocabulary.length < 4) {
    state.clozeGame = null;
    $("clozeSentence").textContent = "";
    $("clozeOptions").innerHTML = "";
    $("clozeFeedback").textContent = t("clozeNeedMore");
    return;
  }

  const options = shuffle([
    candidate.item.de,
    ...shuffle(vocabulary.filter(item => item.de !== candidate.item.de)).slice(0, 3).map(item => item.de)
  ]);
  const sentence = candidate.sentence.replace(candidate.pattern, (match, prefix) => `${prefix}_____`);
  state.clozeGame = { answer: candidate.item.de, sentence, options, answered: false };
  $("clozeSentence").textContent = sentence;
  $("clozeOptions").innerHTML = options
    .map(option => `<button class="quiz-option" type="button" data-answer="${escapeHtml(option)}">${escapeHtml(option)}</button>`)
    .join("");
  $("clozeFeedback").textContent = "";
}

function answerClozeGame(answer) {
  const game = state.clozeGame;
  if (!game || game.answered) return;
  game.answered = true;
  document.querySelectorAll("#clozeOptions .quiz-option").forEach(button => {
    const isCorrect = button.dataset.answer === game.answer;
    const isChosen = button.dataset.answer === answer;
    button.classList.toggle("correct", isCorrect);
    button.classList.toggle("wrong", isChosen && !isCorrect);
    button.disabled = true;
  });
  const isCorrect = answer === game.answer;
  $("clozeFeedback").textContent = isCorrect ? t("correct") : `${t("correctIs")} ${game.answer}`;
  logPractice("cloze-word", { correct: isCorrect, answer, expected: game.answer });
  if (isCorrect) markTaskCompleted("cloze-word");
}

function startMistakeGame() {
  const candidate = findSentenceWithVocabulary(state.currentArticle);
  const vocabulary = getPracticeVocabulary(state.currentArticle)
    .filter(item => getSentenceWords(item.de).length === 1 && item.de !== candidate?.item.de);
  if (!candidate || !vocabulary.length) {
    state.mistakeGame = null;
    $("mistakeSentence").textContent = "";
    $("mistakeOptions").innerHTML = "";
    $("mistakeFeedback").textContent = t("mistakeNeedMore");
    return;
  }

  const wrongWord = shuffle(vocabulary)[0].de;
  const sentence = candidate.sentence.replace(candidate.pattern, (match, prefix) => `${prefix}${wrongWord}`);
  const options = shuffle([...new Set(getSentenceWords(sentence))]).slice(0, 5);
  if (!options.includes(wrongWord)) options[0] = wrongWord;
  state.mistakeGame = { wrongWord, correctWord: candidate.item.de, sentence, answered: false };
  $("mistakeSentence").textContent = sentence;
  $("mistakeOptions").innerHTML = shuffle(options)
    .map(option => `<button class="quiz-option" type="button" data-answer="${escapeHtml(option)}">${escapeHtml(option)}</button>`)
    .join("");
  $("mistakeFeedback").textContent = "";
}

function answerMistakeGame(answer) {
  const game = state.mistakeGame;
  if (!game || game.answered) return;
  game.answered = true;
  document.querySelectorAll("#mistakeOptions .quiz-option").forEach(button => {
    const isCorrect = button.dataset.answer === game.wrongWord;
    const isChosen = button.dataset.answer === answer;
    button.classList.toggle("correct", isCorrect);
    button.classList.toggle("wrong", isChosen && !isCorrect);
    button.disabled = true;
  });
  const isCorrect = answer === game.wrongWord;
  $("mistakeFeedback").textContent = isCorrect
    ? `${t("mistakeCorrect")} ${game.correctWord}`
    : t("mistakeWrong").replace("{wrong}", game.wrongWord).replace("{correct}", game.correctWord);
  logPractice("find-mistake", { correct: isCorrect, answer, expected: game.wrongWord });
  if (isCorrect) markTaskCompleted("find-mistake");
}

function createWordSearchGrid(words) {
  const size = 12;
  const grid = Array.from({ length: size }, () => Array(size).fill(""));
  const directions = [
    [1, 0], [0, 1], [1, 1], [-1, 1],
    [-1, 0], [0, -1], [-1, -1], [1, -1]
  ];

  const placeWord = (item) => {
    const word = item.search;
    for (let attempt = 0; attempt < 120; attempt += 1) {
      const [dx, dy] = shuffle(directions)[0];
      const x = Math.floor(Math.random() * size);
      const y = Math.floor(Math.random() * size);
      const endX = x + dx * (word.length - 1);
      const endY = y + dy * (word.length - 1);
      if (endX < 0 || endX >= size || endY < 0 || endY >= size) continue;

      let fits = true;
      for (let index = 0; index < word.length; index += 1) {
        const cell = grid[y + dy * index][x + dx * index];
        if (cell && cell !== word[index]) fits = false;
      }
      if (!fits) continue;

      for (let index = 0; index < word.length; index += 1) {
        grid[y + dy * index][x + dx * index] = word[index];
      }
      item.cells = Array.from({ length: word.length }, (_, index) => ({
        row: y + dy * index,
        col: x + dx * index
      }));
      return true;
    }
    return false;
  };

  const placed = words.filter(item => placeWord(item));
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      if (!grid[row][col]) grid[row][col] = letters[Math.floor(Math.random() * letters.length)];
    }
  }

  return { grid, placed };
}

function startWordSearchGame() {
  const vocabulary = shuffle(getWordSearchVocabulary(state.currentArticle)).slice(0, 6);
  if (vocabulary.length < 3) {
    state.wordSearchGame = { words: [], found: [], selected: [], grid: [] };
    $("wordSearchHints").innerHTML = "";
    $("wordSearchGrid").innerHTML = "";
    $("wordSearchFeedback").textContent = t("wordSearchNeed3");
    return;
  }

  const { grid, placed } = createWordSearchGrid(vocabulary);
  state.wordSearchGame = { words: placed, found: [], selected: [], foundCells: [], grid };
  renderWordSearchGame();
}

function renderWordSearchGame() {
  const game = state.wordSearchGame;
  $("wordSearchHints").innerHTML = game.words
    .map(item => `<li class="${game.found.includes(item.search) ? "found" : ""}">${escapeHtml(getVocabularyTranslation(item))}</li>`)
    .join("");
  $("wordSearchGrid").innerHTML = game.grid.flatMap((row, rowIndex) =>
    row.map((letter, colIndex) => {
      const key = `${rowIndex}-${colIndex}`;
      const selected = game.selected.some(item => item.key === key);
      const found = game.foundCells?.includes(key);
      return `<button class="letter-cell ${selected ? "selected" : ""} ${found ? "found" : ""}" type="button" data-row="${rowIndex}" data-col="${colIndex}">${letter}</button>`;
    })
  ).join("");
  $("wordSearchFeedback").textContent = game.found.length === game.words.length && game.words.length
    ? t("wordSearchDone")
    : game.selected.length ? game.selected.map(item => item.letter).join("") : "";
}

function chooseWordSearchLetter(row, col) {
  const game = state.wordSearchGame;
  if (!game.grid?.length) return;
  const key = `${row}-${col}`;
  if (game.selected.some(item => item.key === key)) return;
  game.selected.push({ key, letter: game.grid[row][col] });
  const selectedWord = game.selected.map(item => item.letter).join("");
  const foundWord = game.words.find(item => item.search === selectedWord && !game.found.includes(item.search));

  if (foundWord) {
    game.found.push(foundWord.search);
    game.foundCells = [
      ...(game.foundCells || []),
      ...foundWord.cells.map(cell => `${cell.row}-${cell.col}`)
    ];
    game.selected = [];
    logPractice("word-search", { word: foundWord.de });
    if (game.found.length === game.words.length) markTaskCompleted("word-search");
  } else if (!game.words.some(item => item.search.startsWith(selectedWord))) {
    setTimeout(() => {
      game.selected = [];
      renderWordSearchGame();
    }, 450);
  }
  renderWordSearchGame();
}

function markCurrentArticleRead(source = "manual") {
  const article = state.currentArticle;
  if (!article || state.profileData.readIds.includes(article.id)) return;

  state.profileData.readIds.push(article.id);
  saveProfileData();
  $("markReadBtn").textContent = source === "auto"
    ? t("markedRead")
    : t("readDone");
}

function clearArticleReadTimer() {
  if (!state.articleReadTimer) return;
  clearTimeout(state.articleReadTimer);
  state.articleReadTimer = null;
}

function startArticleReadTimer() {
  clearArticleReadTimer();
  const article = state.currentArticle;
  if (!article || state.profileData.readIds.includes(article.id)) return;

  state.articleReadTimer = setTimeout(() => {
    if (state.currentArticle?.id !== article.id || $("articleView").classList.contains("hidden")) return;
    markCurrentArticleRead("auto");
  }, AUTO_READ_DELAY_MS);
}

function openArticle(id) {
  const article = state.articles.find(a => a.id === id);
  if (!article || !canViewArticle(article)) return;

  clearArticleReadTimer();
  stopReading();
  state.currentArticle = article;
  showView("articleView");

  $("articleMeta").textContent = `${article.level} • ${getCategoryLabel(article.category)}`;
  $("articleTitle").textContent = article.title;
  cleanupDiscoveredVocabulary(article);
  renderArticleText(article);
  renderVocabulary();
  renderQuestions(article);
  renderArticleTaskProgress();
  startSentenceGame();
  startMatchGame();
  startVocabChoiceGame();
  startClozeGame();
  startMistakeGame();
  startWordSearchGame();

  $("markReadBtn").textContent = state.profileData.readIds.includes(article.id)
    ? t("readDone")
    : t("markRead");
  startArticleReadTimer();
}

function addDiscoveredVocabulary(word, translation) {
  const article = state.currentArticle;
  if (!article) return;

  const wordKey = normalizeVocabularyKey(word);
  const exists = getVisibleVocabulary(article).some(v => normalizeVocabularyKey(v.de) === wordKey);
  if (!exists) {
    state.profileData.discoveredVocabulary[article.id] = [
      ...getSavedVocabulary(article),
      makeDiscoveredVocabularyItem(article, word, translation)
    ];
    saveProfileData();
    renderVocabulary();
  }
}

function showInlineTranslation(button) {
  const word = button.dataset.word;
  const translation = button.dataset.translation;

  addDiscoveredVocabulary(word, translation);

  document.querySelectorAll(".inline-word.active").forEach(activeButton => {
    if (activeButton !== button) activeButton.classList.remove("active");
  });

  const isOpen = button.classList.toggle("active");
  button.setAttribute("aria-expanded", String(isOpen));
}

function showHome() {
  clearArticleReadTimer();
  stopReading();
  state.currentArticle = null;
  showView("homeView");
  renderCategories();
  renderArticles();
}

function showSettings() {
  showView("settingsView");
}

async function loadProfileData(profile) {
  const localData = JSON.parse(localStorage.getItem(profileDataKey(profile.id)) || "null");
  state.profileData = localData ? { ...emptyProfileData(), ...localData } : emptyProfileData();

  if (localStorage.getItem(LEGACY_MIGRATION_KEY) !== "true") {
    state.profileData.readIds = JSON.parse(localStorage.getItem("readIds") || "[]");
    state.profileData.discoveredVocabulary = JSON.parse(localStorage.getItem("discoveredVocabulary") || "{}");
    localStorage.setItem(LEGACY_MIGRATION_KEY, "true");
  }

  if (!state.remoteReady) {
    localStorage.setItem(profileDataKey(profile.id), JSON.stringify(state.profileData));
    return;
  }

  try {
    const rows = await supabaseRequest(`app_profile_data?profile_id=eq.${encodeURIComponent(profile.id)}&select=data`);
    if (rows?.[0]?.data) {
      state.profileData = { ...emptyProfileData(), ...rows[0].data };
      localStorage.setItem(profileDataKey(profile.id), JSON.stringify(state.profileData));
    } else {
      await saveProfileData();
    }
  } catch (error) {
    console.error(error);
  }
}

async function setCurrentProfile(profile) {
  state.currentProfile = normalizeProfile(profile);
  localStorage.setItem(CURRENT_PROFILE_KEY, profile.id);
  await loadProfileData(state.currentProfile);
  renderNativeLanguageControls();
  renderRoleControls();
  renderCurrentProfileLabel();
  updateStaticTexts();
  $("settingsBtn").classList.remove("hidden");
  $("teacherBtn").classList.toggle("hidden", profile.role !== "teacher");
  showHome();
  showStartupQuiz();
}

function showLogin() {
  clearArticleReadTimer();
  stopReading();
  $("settingsBtn").classList.add("hidden");
  $("teacherBtn").classList.add("hidden");
  renderNativeLanguageControls();
  updateStaticTexts();
  showView(state.profiles.length ? "loginView" : "setupView");
}

function showSetup() {
  clearArticleReadTimer();
  stopReading();
  $("settingsBtn").classList.add("hidden");
  $("teacherBtn").classList.add("hidden");
  renderNativeLanguageControls();
  updateStaticTexts();
  showView("setupView");
}

async function login() {
  const name = normalizeName($("loginNameInput").value);
  const pin = $("loginPinInput").value.trim();
  const profile = state.profiles.find(item => normalizeName(item.name) === name && item.pin === pin);

  if (!profile) {
    $("loginError").textContent = t("loginMismatch");
    return;
  }

  $("loginError").textContent = "";
  $("loginPinInput").value = "";
  const nativeLanguage = $("loginNativeLanguageSelect").value;
  if (isSupportedNativeLanguage(nativeLanguage) && profile.nativeLanguage !== nativeLanguage) {
    profile.nativeLanguage = nativeLanguage;
    state.profiles = state.profiles.map(item => item.id === profile.id ? profile : item);
    await saveProfiles();
  }
  await setCurrentProfile(profile);
}

async function registerProfileFromLogin() {
  const name = $("loginNameInput").value.trim();
  const pin = $("loginPinInput").value.trim();
  const nativeLanguage = $("loginNativeLanguageSelect").value || DEFAULT_NATIVE_LANGUAGE;

  if (!name || !pin) {
    $("loginError").textContent = t("loginFill");
    return;
  }

  if (state.profiles.some(item => normalizeName(item.name) === normalizeName(name))) {
    $("loginError").textContent = t("profileExists");
    return;
  }

  const profile = {
    id: makeProfileId(name),
    name,
    pin,
    role: "student",
    teacherGroupId: makeProfileId(name),
    nativeLanguage
  };

  state.profiles = [...state.profiles, profile];
  await saveProfiles();
  $("loginError").textContent = "";
  $("loginPinInput").value = "";
  await setCurrentProfile(profile);
}

async function createProfiles() {
  const teacherName = $("teacherNameInput").value.trim();
  const teacherPin = $("teacherPinInput").value.trim();
  const teacherRole = $("teacherRoleSelect").value;
  const teacherNativeLanguage = $("teacherNativeLanguageSelect").value || DEFAULT_NATIVE_LANGUAGE;
  const studentName = $("studentNameInput").value.trim();
  const studentPin = $("studentPinInput").value.trim();
  const studentRole = $("studentRoleSelect").value;
  const studentNativeLanguage = $("setupNativeLanguageSelect").value || DEFAULT_NATIVE_LANGUAGE;

  if (!teacherName || !teacherPin || !studentName || !studentPin) {
    $("setupError").textContent = t("setupFill");
    return;
  }

  if (normalizeName(teacherName) === normalizeName(studentName)) {
    $("setupError").textContent = t("setupDifferentNames");
    return;
  }

  if (teacherRole === studentRole) {
    $("setupError").textContent = t("setupDifferentRoles");
    return;
  }

  const existingNames = new Set(state.profiles.map(profile => normalizeName(profile.name)));
  if (existingNames.has(normalizeName(teacherName)) || existingNames.has(normalizeName(studentName))) {
    $("setupError").textContent = t("setupNameExists");
    return;
  }

  const firstProfileId = makeProfileId(teacherName);
  const secondProfileId = makeProfileId(studentName);
  const groupId = teacherRole === "teacher" ? firstProfileId : secondProfileId;
  const newProfiles = [
    { id: firstProfileId, name: teacherName, pin: teacherPin, role: teacherRole, teacherGroupId: groupId, nativeLanguage: teacherNativeLanguage },
    { id: secondProfileId, name: studentName, pin: studentPin, role: studentRole, teacherGroupId: groupId, nativeLanguage: studentNativeLanguage }
  ];
  state.profiles = [...state.profiles, ...newProfiles];
  await saveProfiles();
  $("setupError").textContent = "";
  await setCurrentProfile(newProfiles.find(profile => profile.role === "teacher") || newProfiles[0]);
}

function logout() {
  clearArticleReadTimer();
  stopReading();
  state.currentProfile = null;
  state.profileData = emptyProfileData();
  state.currentArticle = null;
  localStorage.removeItem(CURRENT_PROFILE_KEY);
  $("loginNameInput").value = "";
  $("loginPinInput").value = "";
  showLogin();
}

async function showTeacherOverview() {
  if (!state.currentProfile || state.currentProfile.role !== "teacher") return;
  await renderTeacherOverview();
  renderArticleEditorList();
  showView("teacherView");
}

async function getProfileData(profile) {
  if (state.remoteReady) {
    try {
      const rows = await supabaseRequest(`app_profile_data?profile_id=eq.${encodeURIComponent(profile.id)}&select=data`);
      if (rows?.[0]?.data) return { ...emptyProfileData(), ...rows[0].data };
    } catch (error) {
      console.error(error);
    }
  }

  const localData = JSON.parse(localStorage.getItem(profileDataKey(profile.id)) || "null");
  return localData ? { ...emptyProfileData(), ...localData } : emptyProfileData();
}

function formatPracticeType(type) {
  return {
    "sentence-order": "Zoraď vetu",
    "match-pairs": "Nájdi dvojice",
    "startup-vocabulary": "Úvodné slovíčko",
    "true-false": "Pravda/nepravda",
    "vocab-choice": "4 možnosti",
    "cloze-word": "Doplň slovo",
    "find-mistake": "Nájdi chybné slovo",
    "word-search": "Osemsmerovka"
  }[type] || type;
}

function formatDateTime(value) {
  if (!value) return "";
  return new Date(value).toLocaleString("sk-SK", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function renderNativeLanguageSelect(selectId, value = DEFAULT_NATIVE_LANGUAGE) {
  const select = $(selectId);
  if (!select) return;

  select.innerHTML = Object.entries(NATIVE_LANGUAGES)
    .map(([code, language]) => `<option value="${code}">${escapeHtml(language.label)}</option>`)
    .join("");
  select.value = isSupportedNativeLanguage(value) ? value : DEFAULT_NATIVE_LANGUAGE;
}

function renderNativeLanguageControls() {
  const profileLanguage = getNativeLanguage();
  const loginLanguage = state.currentProfile
    ? profileLanguage
    : isSupportedNativeLanguage(state.preLoginLanguage) ? state.preLoginLanguage : DEFAULT_NATIVE_LANGUAGE;
  renderNativeLanguageSelect("teacherNativeLanguageSelect", DEFAULT_NATIVE_LANGUAGE);
  renderNativeLanguageSelect("setupNativeLanguageSelect", DEFAULT_NATIVE_LANGUAGE);
  renderNativeLanguageSelect("loginNativeLanguageSelect", loginLanguage);
  renderNativeLanguageSelect("settingsNativeLanguageSelect", profileLanguage);
}

function renderRoleControls() {
  if ($("settingsRoleSelect") && state.currentProfile) {
    $("settingsRoleSelect").value = state.currentProfile.role;
  }
}

function renderCurrentProfileLabel() {
  const profile = state.currentProfile;
  if (!profile) return;

  $("currentProfileLabel").textContent = `${profile.name} • ${profile.role === "teacher" ? t("teacher") : t("student")}${state.remoteReady ? ` • ${t("online")}` : ` • ${t("local")}`}`;
}

async function updateCurrentProfileNativeLanguage(language) {
  if (!state.currentProfile || !isSupportedNativeLanguage(language)) return;

  state.currentProfile.nativeLanguage = language;
  state.profiles = state.profiles.map(profile =>
    profile.id === state.currentProfile.id ? { ...profile, nativeLanguage: language } : profile
  );
  await saveProfiles();
  renderNativeLanguageControls();
  updateStaticTexts();

  if (state.currentArticle) {
    renderVocabulary();
    renderArticleText(state.currentArticle);
    renderQuestions(state.currentArticle);
    renderArticleTaskProgress();
    startMatchGame();
    startVocabChoiceGame();
    startWordSearchGame();
  } else {
    renderArticles();
  }
}

async function updateCurrentProfileRole(role) {
  if (!state.currentProfile || !["teacher", "student"].includes(role)) return;

  state.currentProfile.role = role;
  if (role === "teacher" && !state.currentProfile.teacherGroupId) {
    state.currentProfile.teacherGroupId = state.currentProfile.id;
  }
  state.profiles = state.profiles.map(profile =>
    profile.id === state.currentProfile.id ? { ...profile, role, teacherGroupId: state.currentProfile.teacherGroupId } : profile
  );
  await saveProfiles();
  renderRoleControls();
  renderCurrentProfileLabel();
  $("teacherBtn").classList.toggle("hidden", role !== "teacher");
  renderArticles();
}

function linesToList(value) {
  return value.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
}

function parseVocabularyJson(value) {
  const text = value.trim();
  if (!text || (!text.startsWith("[") && !text.startsWith("{"))) return null;

  const parsed = JSON.parse(text);
  const items = Array.isArray(parsed) ? parsed : [parsed];
  return items.map(item => ({
    de: (item.de || "").trim(),
    sk: (item.sk || "").trim(),
    ru: (item.ru || "").trim(),
    pl: (item.pl || "").trim(),
    hu: (item.hu || "").trim()
  })).filter(item => item.de && (item.sk || item.ru || item.pl || item.hu));
}

function parseVocabularyLines(value) {
  const jsonItems = parseVocabularyJson(value);
  if (jsonItems) return jsonItems;

  const language = getNativeLanguage();
  return linesToList(value).map(line => {
    const [de, ...rest] = line.split("=");
    return makeVocabularyItem(de, rest.join("="), language);
  }).filter(item => item.de && getVocabularyTranslation(item, language));
}

function parseVocabularyDraftLines(value) {
  const jsonItems = parseVocabularyJson(value);
  if (jsonItems) return jsonItems;

  const language = getNativeLanguage();
  return linesToList(value).map(line => {
    const [de, ...rest] = line.split("=");
    return makeVocabularyItem(de, rest.join("="), language);
  }).filter(item => item.de);
}

function formatVocabularyLines(items = []) {
  return items.map(item => `${item.de} = ${getVocabularyTranslation(item)}`).join("\n");
}

function mergeVocabularyTranslations(existingItems = [], parsedItems = [], language = getNativeLanguage()) {
  const existingByKey = new Map(existingItems.map(item => [normalizeVocabularyKey(item.de), item]));
  return parsedItems.map(item => {
    const existing = existingByKey.get(normalizeVocabularyKey(item.de)) || {};
    const translations = Object.fromEntries(["sk", "ru", "pl", "hu"]
      .filter(code => item[code])
      .map(code => [code, item[code]]));
    return {
      ...existing,
      ...translations,
      de: item.de,
      ...(item[language] ? { [language]: item[language] } : {})
    };
  });
}

function getMissingVocabularyTranslations(items = []) {
  const seen = new Set();
  return items
    .filter(item => item?.de)
    .map(item => ({
      de: item.de,
      missing: ["sk", "ru", "pl", "hu"].filter(language => !item[language])
    }))
    .filter(item => item.missing.length)
    .filter(item => {
      const key = normalizeVocabularyKey(item.de);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function getEditorVocabularyDraft() {
  const existingArticle = state.articles.find(item => item.id === $("articleEditorSelect")?.value);
  const language = getNativeLanguage();
  const parsedVocabulary = parseVocabularyDraftLines($("articleVocabularyInput").value);
  const parsedInlineVocabulary = parseVocabularyDraftLines($("articleInlineVocabularyInput").value);

  return [
    ...mergeVocabularyTranslations(existingArticle?.vocabulary || [], parsedVocabulary, language),
    ...mergeVocabularyTranslations(getInlineVocabulary(existingArticle || {}), parsedInlineVocabulary, language)
  ];
}

function renderMissingTranslationReport() {
  const root = $("missingTranslationsReport");
  if (!root) return;

  let missing = [];
  try {
    missing = getMissingVocabularyTranslations(getEditorVocabularyDraft());
  } catch (error) {
    root.innerHTML = `<p class="muted">${escapeHtml(error.message)}</p>`;
    return;
  }
  root.innerHTML = missing.length
    ? `<ul class="overview-list">${missing.map(item => `<li><strong>${escapeHtml(item.de)}</strong><span class="muted"> &bull; ${escapeHtml(item.missing.join(", "))}</span></li>`).join("")}</ul>`
    : `<p class="muted">${escapeHtml(t("missingTranslationsEmpty"))}</p>`;
}

function parseQuestionLines(value) {
  return linesToList(value).map(line => {
    const [statement, ...rest] = line.split("=");
    const answerValue = rest.join("=").trim().toLocaleLowerCase("sk");
    return {
      statement: (statement || "").trim(),
      answer: ["true", "pravda", "p", "1", "ano", "áno"].includes(answerValue)
    };
  }).filter(item => item.statement);
}

function formatQuestionLines(items = []) {
  return items.map(item => `${item.statement || item} = ${item.answer ? "true" : "false"}`).join("\n");
}

async function copyTextToClipboard(text, successMessage = t("copied")) {
  if (!text.trim()) {
    $("articleEditorStatus").textContent = t("nothingToCopy");
    return;
  }

  $("generatedPromptOutput").value = text;
  $("generatedPromptWrap").classList.remove("hidden");

  try {
    if (!navigator.clipboard?.writeText) {
      throw new Error("Clipboard API nie je dostupné.");
    }

    await navigator.clipboard.writeText(text);
    $("articleEditorStatus").textContent = successMessage;
  } catch (error) {
    $("generatedPromptOutput").focus();
    $("generatedPromptOutput").select();
    $("articleEditorStatus").textContent = t("copyFailed");
  }
}

function getSelectedArticleText() {
  const input = $("articleTextInput");
  return input.value.slice(input.selectionStart, input.selectionEnd).trim();
}

function appendUniqueLine(textareaId, line) {
  const textarea = $(textareaId);
  const normalizedLine = line.trim();
  if (!normalizedLine) return false;

  const key = normalizeVocabularyKey(normalizedLine.split("=")[0]);
  const existingKeys = linesToList(textarea.value)
    .map(item => normalizeVocabularyKey(item.split("=")[0]));
  if (existingKeys.includes(key)) return false;

  textarea.value = [...linesToList(textarea.value), normalizedLine].join("\n");
  return true;
}

function addSelectedTextToVocabulary(addToVocabulary) {
  const selected = getSelectedArticleText();
  if (!selected) {
    $("articleEditorStatus").textContent = t("selectWordFirst");
    return;
  }

  const line = `${selected} =`;
  const inlineAdded = appendUniqueLine("articleInlineVocabularyInput", line);
  const vocabAdded = addToVocabulary ? appendUniqueLine("articleVocabularyInput", line) : false;
  $("articleEditorStatus").textContent = inlineAdded || vocabAdded
    ? t("selectedAdded")
    : t("expressionExists");
  renderMissingTranslationReport();
}

const PROMPT_TEXT = {
  sk: {
    article: ({ level, category, topic, requiredWords }) => [
      `Napíš krátky článok v nemčine pre úroveň ${level}.`,
      category ? `Kategória/téma: ${category}.` : "",
      topic ? `Konkrétne zadanie: ${topic}` : "",
      requiredWords.length
        ? `Tieto slová alebo frázy musia byť v texte použité každé minimálne 2x a maximálne 4x: ${requiredWords.join(", ")}.`
        : "",
      "Vráť iba názov, krátky nemecký popis a nemecký text rozdelený na odseky."
    ],
    translation: (missing) => [
      "Prelož tieto nemecké slová a frázy do slovenčiny, ruštiny, poľštiny a maďarčiny.",
      "Vráť iba validné JSON pole. Nepíš vysvetlenia navyše.",
      "Každá položka musí mať presne tieto kľúče: de, sk, ru, pl, hu.",
      "Formát jednej položky:",
      "{\"de\":\"die Erfahrung\",\"sk\":\"skúsenosť\",\"ru\":\"опыт\",\"pl\":\"doświadczenie\",\"hu\":\"tapasztalat\"}",
      "",
      missing.join("\n")
    ],
    questions: ({ title, text }) => [
      "Vytvor pravda/nepravda vety k tomuto nemeckému článku.",
      "Vráť 6 až 8 riadkov vo formáte:",
      "nemecká veta = true",
      "nemecká veta = false",
      "Použi mix pravdivých a nepravdivých viet. Nepíš nič navyše.",
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
      "Верни только название, короткое немецкое описание и немецкий текст, разделенный на абзацы."
    ],
    translation: (missing) => [
      "Переведи эти немецкие слова и фразы на словацкий, русский, польский и венгерский.",
      "Верни только валидный JSON-массив. Не добавляй никаких объяснений.",
      "Каждый объект должен иметь ровно эти ключи: de, sk, ru, pl, hu.",
      "Формат одного объекта:",
      "{\"de\":\"die Erfahrung\",\"sk\":\"skúsenosť\",\"ru\":\"опыт\",\"pl\":\"doświadczenie\",\"hu\":\"tapasztalat\"}",
      "",
      missing.join("\n")
    ],
    questions: ({ title, text }) => [
      "Создай предложения true/false к этой немецкой статье.",
      "Верни 6-8 строк в формате:",
      "немецкое предложение = true",
      "немецкое предложение = false",
      "Используй смесь правдивых и ложных предложений. Не добавляй ничего лишнего.",
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
      "Zwróć tylko tytuł, krótki niemiecki opis i niemiecki tekst podzielony na akapity."
    ],
    translation: (missing) => [
      "Przetłumacz te niemieckie słowa i frazy na słowacki, rosyjski, polski i węgierski.",
      "Zwróć tylko poprawną tablicę JSON. Nie dodawaj żadnych wyjaśnień.",
      "Każdy obiekt musi mieć dokładnie te klucze: de, sk, ru, pl, hu.",
      "Format jednego obiektu:",
      "{\"de\":\"die Erfahrung\",\"sk\":\"skúsenosť\",\"ru\":\"опыт\",\"pl\":\"doświadczenie\",\"hu\":\"tapasztalat\"}",
      "",
      missing.join("\n")
    ],
    questions: ({ title, text }) => [
      "Utwórz zdania true/false do tego niemieckiego artykułu.",
      "Zwróć 6-8 wierszy w formacie:",
      "niemieckie zdanie = true",
      "niemieckie zdanie = false",
      "Użyj mieszanki zdań prawdziwych i fałszywych. Nie dodawaj niczego więcej.",
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
      "Csak a címet, egy rövid német leírást és a bekezdésekre tagolt német szöveget add vissza."
    ],
    translation: (missing) => [
      "Fordítsd le ezeket a német szavakat és kifejezéseket szlovákra, oroszra, lengyelre és magyarra.",
      "Csak érvényes JSON tömböt adj vissza. Ne írj semmilyen magyarázatot.",
      "Minden objektumnak pontosan ezek a kulcsai legyenek: de, sk, ru, pl, hu.",
      "Egy objektum formátuma:",
      "{\"de\":\"die Erfahrung\",\"sk\":\"skúsenosť\",\"ru\":\"опыт\",\"pl\":\"doświadczenie\",\"hu\":\"tapasztalat\"}",
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

function getPromptText() {
  return PROMPT_TEXT[getUiLanguage()] || PROMPT_TEXT[DEFAULT_NATIVE_LANGUAGE];
}

function buildArticlePrompt() {
  const topic = $("articlePromptInput").value.trim();
  const level = $("articleLevelInput").value.trim() || "A2-B1";
  const category = $("articleCategoryInput").value.trim();
  const requiredWords = linesToList($("articleRequiredWordsInput").value);
  addRequiredWordsToVocabulary();

  return getPromptText().article({ level, category, topic, requiredWords }).filter(Boolean).join("\n");
}

function addRequiredWordsToVocabulary() {
  const requiredWords = linesToList($("articleRequiredWordsInput").value);
  requiredWords.forEach(word => {
    const line = `${word} =`;
    appendUniqueLine("articleVocabularyInput", line);
    appendUniqueLine("articleInlineVocabularyInput", line);
  });
}

function buildTranslationPrompt() {
  const words = [
    ...parseVocabularyDraftLines($("articleVocabularyInput").value),
    ...parseVocabularyDraftLines($("articleInlineVocabularyInput").value)
  ];
  const seen = new Set();
  const missing = words
    .filter(item => !item.sk || !item.ru || !item.pl || !item.hu)
    .filter(item => {
      const key = normalizeVocabularyKey(item.de);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map(item => `${item.de} =`);

  return getPromptText().translation(missing).join("\n");
}

function buildQuestionsPrompt() {
  const title = $("articleTitleInput").value.trim();
  const text = $("articleTextInput").value.trim();

  return getPromptText().questions({ title, text }).filter(Boolean).join("\n");
}

function renderArticleEditorList(selectedId = $("articleEditorSelect")?.value) {
  const select = $("articleEditorSelect");
  if (!select) return;

  select.innerHTML = [
    '<option value="">-- nový článok --</option>',
    ...getEditableArticles().map(article => `<option value="${escapeHtml(article.id)}">${escapeHtml(article.title)}</option>`)
  ].join("");
  select.value = selectedId && getEditableArticles().some(article => article.id === selectedId) ? selectedId : "";

  const article = state.articles.find(item => item.id === select.value);
  fillArticleEditor(article || null);
}

function fillArticleEditor(article) {
  $("articleTitleInput").value = article?.title || "";
  $("articleIdInput").value = article?.id || "";
  $("articleVisibilitySelect").value = article?.visibility || DEFAULT_ARTICLE_VISIBILITY;
  $("articleApprovalStatusSelect").value = article?.approvalStatus || DEFAULT_ARTICLE_APPROVAL_STATUS;
  $("articleLevelInput").value = article?.level || "A2-B1";
  $("articleCategoryInput").value = article?.category || "";
  $("articleSummaryInput").value = article?.summary || "";
  $("articleTextInput").value = (article?.text || []).join("\n");
  $("articleVocabularyInput").value = formatVocabularyLines(article?.vocabulary || []);
  $("articleInlineVocabularyInput").value = formatVocabularyLines(getInlineVocabulary(article || {}));
  $("articleQuestionsInput").value = formatQuestionLines(article?.questions || []);
  $("articleEditorStatus").textContent = state.remoteReady
    ? ""
    : t("editorNeedsSupabase");
  renderMissingTranslationReport();
}

function readArticleEditor() {
  const existingArticle = state.articles.find(item => item.id === $("articleEditorSelect").value);
  const language = getNativeLanguage();
  const title = $("articleTitleInput").value.trim();
  const id = ($("articleIdInput").value.trim() || makeArticleId(title));
  const visibility = $("articleVisibilitySelect").value || DEFAULT_ARTICLE_VISIBILITY;
  const selectedApprovalStatus = $("articleApprovalStatusSelect").value || DEFAULT_ARTICLE_APPROVAL_STATUS;
  const approvalStatus = visibility === "public"
    ? selectedApprovalStatus
    : DEFAULT_ARTICLE_APPROVAL_STATUS;
  const parsedVocabulary = parseVocabularyLines($("articleVocabularyInput").value);
  const parsedInlineVocabulary = parseVocabularyLines($("articleInlineVocabularyInput").value);
  const article = {
    id,
    ownerProfileId: existingArticle?.ownerProfileId || state.currentProfile?.id || null,
    teacherGroupId: existingArticle?.teacherGroupId || state.currentProfile?.teacherGroupId || state.currentProfile?.id || null,
    visibility,
    approvalStatus,
    title,
    level: $("articleLevelInput").value.trim(),
    category: $("articleCategoryInput").value.trim(),
    summary: $("articleSummaryInput").value.trim(),
    text: linesToList($("articleTextInput").value),
    vocabulary: mergeVocabularyTranslations(existingArticle?.vocabulary || [], parsedVocabulary, language),
    inlineVocabulary: mergeVocabularyTranslations(getInlineVocabulary(existingArticle || {}), parsedInlineVocabulary, language),
    questions: parseQuestionLines($("articleQuestionsInput").value)
  };

  if (!article.title || !article.id || !article.level || !article.category || !article.summary || !article.text.length) {
    throw new Error(t("validationFillArticle"));
  }

  if (!article.questions.length) {
    throw new Error(t("validationQuestion"));
  }

  return article;
}

async function saveArticleFromEditor() {
  try {
    const article = readArticleEditor();
    await saveArticle(article);
    $("articleEditorStatus").textContent = t("articleSaved");
    renderMissingTranslationReport();
  } catch (error) {
    $("articleEditorStatus").textContent = error.message;
  }
}

async function renderTeacherOverview() {
  const students = state.profiles.filter(profile => profile.role === "student" && isInCurrentTeacherGroup(profile));
  const root = $("teacherOverview");
  const sections = await Promise.all(students.map(async student => {
    const data = await getProfileData(student);
    const readArticles = data.readIds
      .map(id => state.articles.find(article => article.id === id)?.title || id);
    const clickedCount = Object.values(data.discoveredVocabulary || {}).reduce((sum, items) => sum + items.length, 0);
    const practiceLog = data.practiceLog || [];
    const articleProgress = state.articles.filter(article => canViewArticle(article, state.currentProfile)).map(article => {
      const progress = getArticleTaskProgress(article, data);
      return { article, ...progress };
    });
    const totalTasks = articleProgress.reduce((sum, item) => sum + item.total, 0);
    const doneTasks = articleProgress.reduce((sum, item) => sum + item.done, 0);
    const progressCards = articleProgress.map(item => `
      <li>
        <strong>${escapeHtml(item.article.title)}</strong>
        <span class="muted"> &bull; ${item.done}/${item.total}</span>
      </li>
    `).join("");
    const practiceCards = practiceLog.slice(0, 8).map(entry => `
      <li>
        <strong>${escapeHtml(formatPracticeType(entry.type))}</strong>
        ${entry.articleTitle ? ` &bull; ${escapeHtml(entry.articleTitle)}` : ""}
        ${typeof entry.correct === "boolean" ? ` &bull; ${entry.correct ? "správne" : "nesprávne"}` : ""}
        <span class="muted"> &bull; ${escapeHtml(formatDateTime(entry.at))}</span>
      </li>
    `).join("");
    const answerCards = Object.entries(data.answers || {}).flatMap(([articleId, answers]) => {
      const article = state.articles.find(item => item.id === articleId);
      if (!article) return [];

      return Object.entries(answers)
        .filter(([, answer]) => answer !== null && answer !== undefined && answer !== "")
        .map(([index, answer]) => `
          <div class="answer-card">
            <p><strong>${escapeHtml(article.title)}</strong></p>
            <p>${escapeHtml(article.questions[Number(index)]?.statement || article.questions[Number(index)] || "")}</p>
            <p>${answer === true ? "Pravda" : answer === false ? "Nepravda" : escapeHtml(answer)}</p>
          </div>
        `);
    }).join("");

    return `
      <section class="overview-section">
        <h3>${escapeHtml(student.name)}</h3>
        <p class="muted">Prečítané texty: ${readArticles.length} • Kliknuté slovíčka/frázy: ${clickedCount} • Cvičenia: ${practiceLog.length} • Splnené úlohy: ${doneTasks}/${totalTasks}</p>
        <ul class="overview-list">
          ${readArticles.length ? readArticles.map(title => `<li>${escapeHtml(title)}</li>`).join("") : "<li>Zatiaľ nič prečítané.</li>"}
        </ul>
        <h3>Progres úloh</h3>
        <ul class="overview-list">
          ${progressCards}
        </ul>
        <h3>Cvičenia</h3>
        <ul class="overview-list">
          ${practiceCards || "<li>Zatiaľ žiadne cvičenie.</li>"}
        </ul>
        <h3>Odpovede</h3>
        ${answerCards || '<p class="muted">Zatiaľ nie sú uložené odpovede.</p>'}
      </section>
    `;
  }));

  root.innerHTML = sections.join("") || `<p class="muted">${escapeHtml(t("noStudentsInGroup"))}</p>`;
}

function saveTrueFalseAnswer(index, answer) {
  const article = state.currentArticle;
  if (!article) return;

  state.profileData.answers[article.id] = {
    ...getArticleAnswers(article.id),
    [index]: answer
  };
  const question = article.questions[Number(index)];
  if (answer === Boolean(question.answer)) {
    markTaskCompleted(getQuestionTaskId(index));
  }
  saveProfileData();
  renderQuestions(article);
  logPractice("true-false", {
    correct: answer === Boolean(question.answer),
    answer,
    expected: Boolean(question.answer)
  });
}

function buildStartupQuizQuestions() {
  const vocabulary = getAllVocabulary();
  if (vocabulary.length < 4) return [];

  const makeQuestion = (direction) => {
    const correct = shuffle(vocabulary)[0];
    const correctTranslation = getVocabularyTranslation(correct);
    const prompt = direction === "de-native" ? correct.de : correctTranslation;
    const answer = direction === "de-native" ? correctTranslation : correct.de;
    const wrongOptions = shuffle(vocabulary.filter(item => {
      const option = direction === "de-native" ? getVocabularyTranslation(item) : item.de;
      return option !== answer;
    }))
      .slice(0, 3)
      .map(item => direction === "de-native" ? getVocabularyTranslation(item) : item.de);

    return {
      direction,
      prompt,
      answer,
      options: shuffle([answer, ...wrongOptions])
    };
  };

  return [makeQuestion("de-native"), makeQuestion("native-de")];
}

function renderStartupQuiz() {
  const quiz = state.startupQuiz;
  const question = quiz.questions[quiz.index];
  if (!question) {
    closeStartupQuiz();
    return;
  }

  quiz.answered = false;
  $("startupQuizTitle").textContent = quiz.index === 0
    ? t("startupQ1")
    : t("startupQ2");
  $("startupQuizPrompt").textContent = question.prompt;
  $("startupQuizFeedback").textContent = "";
  $("nextStartupQuizBtn").classList.add("hidden");
  $("startupQuizOptions").innerHTML = question.options
    .map(option => `<button class="quiz-option" type="button" data-answer="${escapeHtml(option)}">${escapeHtml(option)}</button>`)
    .join("");
  $("startupQuiz").classList.remove("hidden");
}

function showStartupQuiz() {
  if (state.startupQuiz.shown || !state.currentProfile || !state.articles.length) return;
  const questions = buildStartupQuizQuestions();
  if (!questions.length) return;

  state.startupQuiz = {
    questions,
    index: 0,
    answered: false,
    shown: true
  };
  renderStartupQuiz();
}

function closeStartupQuiz() {
  $("startupQuiz").classList.add("hidden");
}

function answerStartupQuiz(answer) {
  const quiz = state.startupQuiz;
  const question = quiz.questions[quiz.index];
  if (!question || quiz.answered) return;

  quiz.answered = true;
  document.querySelectorAll(".quiz-option").forEach(button => {
    const isCorrect = button.dataset.answer === question.answer;
    const isChosen = button.dataset.answer === answer;
    button.classList.toggle("correct", isCorrect);
    button.classList.toggle("wrong", isChosen && !isCorrect);
    button.disabled = true;
  });

  $("startupQuizFeedback").textContent = answer === question.answer
    ? t("correct")
    : `${t("correctIs")} ${question.answer}`;
  logPractice("startup-vocabulary", {
    correct: answer === question.answer,
    direction: question.direction,
    prompt: question.prompt,
    answer,
    expected: question.answer
  });
  $("nextStartupQuizBtn").textContent = quiz.index + 1 >= quiz.questions.length ? t("done") : t("next");
  $("nextStartupQuizBtn").classList.remove("hidden");
}

function nextStartupQuizQuestion() {
  state.startupQuiz.index += 1;
  if (state.startupQuiz.index >= state.startupQuiz.questions.length) {
    closeStartupQuiz();
    return;
  }
  renderStartupQuiz();
}

function loadSettings() {
  const fontSize = localStorage.getItem("fontSize") || "normal";
  const dark = localStorage.getItem("darkMode") === "true";

  renderNativeLanguageControls();
  renderRoleControls();
  $("fontSizeSelect").value = fontSize;
  $("darkModeToggle").checked = dark;

  document.body.classList.toggle("font-large", fontSize === "large");
  document.body.classList.toggle("font-xlarge", fontSize === "xlarge");
  document.body.classList.toggle("dark", dark);
  updateStaticTexts();
  updateNotificationStatus();
}

function updateNotificationStatus(message = "") {
  if (!("Notification" in window)) {
    $("notificationStatus").textContent = t("notificationUnsupported");
    return;
  }

  if (message) {
    $("notificationStatus").textContent = message;
    return;
  }

  const labels = {
    default: t("notificationDefault"),
    granted: t("notificationGranted"),
    denied: t("notificationDenied")
  };
  $("notificationStatus").textContent = labels[Notification.permission] || "";
}

async function showTestNotification() {
  if (!("Notification" in window)) {
    updateNotificationStatus();
    return;
  }

  let permission = Notification.permission;
  if (permission === "default") {
    permission = await Notification.requestPermission();
  }

  if (permission !== "granted") {
    updateNotificationStatus(t("notificationNotAllowed"));
    return;
  }

  const registration = await navigator.serviceWorker?.ready;
  if (!registration?.showNotification) {
    new Notification("Čítanka", {
      body: t("notificationBody"),
      icon: "icons/icon-192.png"
    });
    updateNotificationStatus(t("notificationSent"));
    return;
  }

  await registration.showNotification("Čítanka", {
    body: t("pushBody"),
    icon: "icons/icon-192.png",
    badge: "icons/icon-192.png",
    data: { url: "./index.html" }
  });
  updateNotificationStatus(t("notificationSent"));
}

$("backBtn").onclick = showHome;
$("settingsBackBtn").onclick = showHome;
$("teacherBackBtn").onclick = showHome;
$("settingsBtn").onclick = showSettings;
$("teacherBtn").onclick = showTeacherOverview;
$("refreshBtn").onclick = loadArticles;
$("loginBtn").onclick = login;
$("registerProfileBtn").onclick = registerProfileFromLogin;
$("setupPairBtn").onclick = showSetup;
$("setupBackBtn").onclick = showLogin;
$("createProfilesBtn").onclick = createProfiles;
$("logoutBtn").onclick = logout;
$("readAloudBtn").onclick = () => readSentence(0);
$("listenOnlyBtn").onclick = listenWithoutText;
$("pauseReadBtn").onclick = togglePauseReading;
$("stopReadBtn").onclick = stopReading;
$("showTextAfterListeningBtn").onclick = showArticleText;
$("newSentenceGameBtn").onclick = startSentenceGame;
$("newMatchGameBtn").onclick = startMatchGame;
$("newVocabChoiceBtn").onclick = startVocabChoiceGame;
$("newClozeGameBtn").onclick = startClozeGame;
$("newMistakeGameBtn").onclick = startMistakeGame;
$("newWordSearchBtn").onclick = startWordSearchGame;
$("skipStartupQuizBtn").onclick = closeStartupQuiz;
$("nextStartupQuizBtn").onclick = nextStartupQuizQuestion;
$("testNotificationBtn").onclick = showTestNotification;
$("newArticleBtn").onclick = () => {
  $("articleEditorSelect").value = "";
  fillArticleEditor(null);
};
$("saveArticleBtn").onclick = saveArticleFromEditor;
$("articleEditorSelect").onchange = () => {
  const article = state.articles.find(item => item.id === $("articleEditorSelect").value);
  fillArticleEditor(article || null);
};
$("articleVisibilitySelect").onchange = (event) => {
  if (event.target.value === "public" && $("articleApprovalStatusSelect").value === "draft") {
    $("articleApprovalStatusSelect").value = PUBLIC_ARTICLE_APPROVAL_STATUS;
  }
  if (event.target.value === "private") {
    $("articleApprovalStatusSelect").value = DEFAULT_ARTICLE_APPROVAL_STATUS;
  }
};
$("articleTitleInput").addEventListener("input", () => {
  if (!$("articleEditorSelect").value) {
    $("articleIdInput").value = makeArticleId($("articleTitleInput").value);
  }
});
$("addSelectedVocabularyBtn").onclick = () => addSelectedTextToVocabulary(true);
$("addSelectedInlineBtn").onclick = () => addSelectedTextToVocabulary(false);
["articleVocabularyInput", "articleInlineVocabularyInput"].forEach(id => {
  $(id).addEventListener("input", renderMissingTranslationReport);
});
$("copyArticlePromptBtn").onclick = () => copyTextToClipboard(buildArticlePrompt(), t("promptArticleCopied"));
$("copyTranslationPromptBtn").onclick = () => copyTextToClipboard(buildTranslationPrompt(), t("promptTranslationCopied"));
$("copyQuestionsPromptBtn").onclick = () => copyTextToClipboard(buildQuestionsPrompt(), t("promptQuestionsCopied"));

$("loginPinInput").addEventListener("keydown", event => {
  if (event.key === "Enter") login();
});

$("loginNativeLanguageSelect").onchange = (event) => {
  state.preLoginLanguage = event.target.value;
  updateStaticTexts();
};

$("markReadBtn").onclick = () => {
  markCurrentArticleRead("manual");
};

$("articleText").onclick = (event) => {
  const button = event.target.closest(".inline-word");
  if (!button) return;
  showInlineTranslation(button);
};

$("questionList").addEventListener("click", event => {
  const button = event.target.closest(".choice-btn");
  if (!button) return;
  saveTrueFalseAnswer(button.dataset.questionIndex, button.dataset.answer === "true");
});

$("sentenceWordBank").addEventListener("click", event => {
  const button = event.target.closest(".word-chip");
  if (!button) return;
  chooseSentenceWord(button.dataset.wordId);
});

$("sentenceTarget").addEventListener("click", event => {
  const button = event.target.closest(".word-chip");
  if (!button) return;
  returnSentenceWord(button.dataset.wordId);
});

$("matchGameBoard").addEventListener("click", event => {
  const button = event.target.closest(".match-card");
  if (!button) return;
  chooseMatchCard(button.dataset.cardId);
});

$("vocabChoiceOptions").addEventListener("click", event => {
  const button = event.target.closest(".quiz-option");
  if (!button) return;
  answerVocabChoice(button.dataset.answer);
});

$("clozeOptions").addEventListener("click", event => {
  const button = event.target.closest(".quiz-option");
  if (!button) return;
  answerClozeGame(button.dataset.answer);
});

$("mistakeOptions").addEventListener("click", event => {
  const button = event.target.closest(".quiz-option");
  if (!button) return;
  answerMistakeGame(button.dataset.answer);
});

$("wordSearchGrid").addEventListener("click", event => {
  const button = event.target.closest(".letter-cell");
  if (!button) return;
  chooseWordSearchLetter(Number(button.dataset.row), Number(button.dataset.col));
});

$("speechRateSelect").onchange = () => {
  changeSpeechRate();
};

$("startupQuizOptions").addEventListener("click", event => {
  const button = event.target.closest(".quiz-option");
  if (!button) return;
  answerStartupQuiz(button.dataset.answer);
});

$("fontSizeSelect").onchange = (e) => {
  localStorage.setItem("fontSize", e.target.value);
  loadSettings();
};

$("darkModeToggle").onchange = (e) => {
  localStorage.setItem("darkMode", e.target.checked);
  loadSettings();
};

$("settingsNativeLanguageSelect").onchange = (e) => {
  updateCurrentProfileNativeLanguage(e.target.value);
};

$("settingsRoleSelect").onchange = (e) => {
  updateCurrentProfileRole(e.target.value);
};

window.addEventListener("pagehide", forceStopSpeech);
window.addEventListener("beforeunload", forceStopSpeech);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) forceStopSpeech();
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("service-worker.js");
  });
}

async function init() {
  loadSettings();
  await loadProfiles();
  await loadArticles();

  const savedProfileId = localStorage.getItem(CURRENT_PROFILE_KEY);
  const savedProfile = state.profiles.find(profile => profile.id === savedProfileId);
  if (savedProfile) {
    await setCurrentProfile(savedProfile);
  } else {
    showLogin();
  }
}

init();
