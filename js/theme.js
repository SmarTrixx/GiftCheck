/* ============================================================
   theme.js — Theme Management System
   Handles dark/light theme switching with localStorage persistence
   ============================================================ */

const THEME_STORAGE_KEY = 'giftcheck-theme';
const THEME_ATTRIBUTE = 'data-theme';
const DARK_THEME = 'dark';
const LIGHT_THEME = 'light';

/**
 * Initialize the theme system
 * - Restores saved preference from localStorage
 * - Falls back to system preference if no saved preference
 * - Defaults to light theme if system preference cannot be determined
 */
function initTheme() {
  const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
  let theme;

  if (savedTheme) {
    // Use saved preference
    theme = savedTheme;
  } else {
    // Check system preference
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      theme = DARK_THEME;
    } else {
      theme = LIGHT_THEME; // Default to light
    }
  }

  applyTheme(theme);
}

/**
 * Apply a theme to the document
 * @param {string} theme - 'dark' or 'light'
 */
function applyTheme(theme) {
  if (![DARK_THEME, LIGHT_THEME].includes(theme)) {
    console.warn(`Invalid theme: ${theme}. Using light.`);
    theme = LIGHT_THEME;
  }

  // Set the attribute on html element
  document.documentElement.setAttribute(THEME_ATTRIBUTE, theme);

  // Save to localStorage
  localStorage.setItem(THEME_STORAGE_KEY, theme);

  // Dispatch custom event for other scripts to listen to
  document.dispatchEvent(new CustomEvent('themechange', { detail: { theme } }));
}

/**
 * Get the currently active theme
 * @returns {string} 'dark' or 'light'
 */
function getCurrentTheme() {
  return document.documentElement.getAttribute(THEME_ATTRIBUTE) || LIGHT_THEME;
}

/**
 * Toggle between dark and light themes
 */
function toggleTheme() {
  const current = getCurrentTheme();
  const newTheme = current === DARK_THEME ? LIGHT_THEME : DARK_THEME;
  applyTheme(newTheme);
}

/**
 * Set theme to dark
 */
function setDarkTheme() {
  applyTheme(DARK_THEME);
}

/**
 * Set theme to light
 */
function setLightTheme() {
  applyTheme(LIGHT_THEME);
}

/**
 * Check if system prefers light mode
 * @returns {boolean}
 */
function systemPrefersLight() {
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches;
}

/**
 * Watch for system theme preference changes
 * Auto-switches theme if no saved preference exists
 */
function watchSystemThemePreference() {
  if (!window.matchMedia) return;

  const darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');
  
  darkModeQuery.addEventListener('change', (e) => {
    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    
    // Only auto-switch if no saved preference
    if (!savedTheme) {
      applyTheme(e.matches ? DARK_THEME : LIGHT_THEME);
    }
  });
}

// Initialize theme on page load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initTheme);
} else {
  initTheme();
}

// Watch for system preference changes
watchSystemThemePreference();

// Expose functions globally for easy access
window.theme = {
  init: initTheme,
  apply: applyTheme,
  getCurrent: getCurrentTheme,
  toggle: toggleTheme,
  setDark: setDarkTheme,
  setLight: setLightTheme,
  systemPrefersLight: systemPrefersLight,
};
