window.NC_THEME = {
  // Change this value to try another palette from the list below.
  activePalette: "iconBlue",
  palettes: {
    icon: {
      accent: "#27c7c0",
      accentDark: "#116d9b",
      accentText: "#081b22",
      accentRgb: "39, 199, 192",
      accentDarkRgb: "17, 109, 155",
      support: "#ffbd2f",
      supportDark: "#b56f00",
      supportRgb: "255, 189, 47",
      background: "#f5fbff",
      card: "#ffffff",
      text: "#13202d",
      muted: "#627386",
      border: "rgba(19, 32, 45, 0.12)",
      shadow: "0 18px 45px rgba(17, 109, 155, 0.13)",
      note: "Main proposal based on the current app icon: turquoise/blue with a warm yellow support accent."
    },
    iconWarm: {
      accent: "#ffbd2f",
      accentDark: "#b56f00",
      accentText: "#231702",
      accentRgb: "255, 189, 47",
      accentDarkRgb: "181, 111, 0",
      support: "#27c7c0",
      supportDark: "#116d9b",
      supportRgb: "39, 199, 192",
      background: "#fff8ed",
      card: "#ffffff",
      text: "#241a10",
      muted: "#746554",
      border: "rgba(36, 26, 16, 0.12)",
      shadow: "0 18px 45px rgba(80, 50, 10, 0.12)",
      note: "Warmer variant close to the original app colors, with icon turquoise as support."
    },
    iconBlue: {
      accent: "#3388f4",
      accentDark: "#3154c9",
      accentText: "#ffffff",
      accentRgb: "51, 136, 244",
      accentDarkRgb: "49, 84, 201",
      support: "#ffbd2f",
      supportDark: "#b56f00",
      supportRgb: "255, 189, 47",
      background: "#f5f8ff",
      card: "#ffffff",
      text: "#162033",
      muted: "#63708a",
      border: "rgba(22, 32, 51, 0.12)",
      shadow: "0 18px 45px rgba(49, 84, 201, 0.13)",
      note: "Cooler blue/purple variant, closer to the right side of the icon."
    }
  }
};

(function applyAppTheme() {
  const theme = window.NC_THEME;
  const palette = theme.palettes[theme.activePalette] || theme.palettes.icon;
  const root = document.documentElement;
  const metaThemeColor = document.querySelector('meta[name="theme-color"]');

  root.style.setProperty("--bg", palette.background);
  root.style.setProperty("--card", palette.card);
  root.style.setProperty("--text", palette.text);
  root.style.setProperty("--muted", palette.muted);
  root.style.setProperty("--accent", palette.accent);
  root.style.setProperty("--accent-dark", palette.accentDark);
  root.style.setProperty("--accent-text", palette.accentText);
  root.style.setProperty("--accent-rgb", palette.accentRgb);
  root.style.setProperty("--accent-dark-rgb", palette.accentDarkRgb);
  root.style.setProperty("--support", palette.support);
  root.style.setProperty("--support-dark", palette.supportDark);
  root.style.setProperty("--support-rgb", palette.supportRgb);
  root.style.setProperty("--border", palette.border);
  root.style.setProperty("--shadow", palette.shadow);

  if (metaThemeColor) metaThemeColor.setAttribute("content", palette.accent);
})();
