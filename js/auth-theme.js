/**
 * auth-theme.js - loadTheme, toggleTheme
 */

function loadTheme() {
  const theme = localStorage.getItem(STORAGE_KEYS.THEME);
  if (theme === "light") {
    document.body.classList.add("light-mode");
  } else {
    document.body.classList.remove("light-mode");
  }
}

function toggleTheme() {
  const isLight = document.body.classList.toggle("light-mode");
  localStorage.setItem(STORAGE_KEYS.THEME, isLight ? "light" : "dark");

  const btn = document.getElementById("themeToggleBtn");
  if (btn) {
    btn.textContent = isLight ? "🌙 Dark" : "☀️ Light";
  }
}
