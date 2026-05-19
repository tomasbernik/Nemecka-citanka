// Translation data is split into translations/ui.js, translations/auth.js, and translations/prompts.js.
// Keep this file loaded after them as a small compatibility check for the app.
if (typeof UI_TEXT === "undefined") {
  throw new Error("UI translations are not loaded.");
}

if (typeof PROMPT_TEXT === "undefined") {
  throw new Error("Prompt translations are not loaded.");
}
