# GiftsChecker Theme System

## Overview

GiftsChecker now supports **two complete themes**: **Light** (default white) and **Dark**. Both themes are fully maintained and can be easily switched at runtime.

---

## Theme Modes

### Light Theme (Default)
- **Primary Background**: `#ffffff` (white)
- **Card Background**: `#f5f7fa` (light blue-gray)
- **Text**: `#0d1b2a` (dark navy)
- **Accent**: `#f77f00` (orange)
- Best for: Day viewing, professional appearance, high contrast

### Dark Theme
- **Primary Background**: `#0d1b2a` (deep navy)
- **Card Background**: `#142840` (lighter navy)
- **Text**: `#f0f4f8` (off-white)
- **Accent**: `#f77f00` (orange)
- Best for: Night viewing, reduced eye strain, modern aesthetic

---

## How to Use

### 1. **Via UI Toggle Button**

A theme toggle button appears in the navigation bar (top-right, next to "Verify Now" button).

- **Moon icon** = Currently in dark theme, click to switch to light
- **Sun icon** = Currently in light theme, click to switch to dark

User preference is automatically saved to localStorage.

### 2. **Programmatically (JavaScript)**

The theme system is available globally via `window.theme`:

```javascript
// Get current theme
const current = window.theme.getCurrent(); // Returns 'dark' or 'light'

// Toggle theme
window.theme.toggle();

// Set specific theme
window.theme.setDark();
window.theme.setLight();

// Apply a theme programmatically
window.theme.apply('dark');

// Check system preference
const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

// Listen for theme changes
document.addEventListener('themechange', (e) => {
  console.log('Theme changed to:', e.detail.theme);
});
```

### 3. **In Code (CSS Variables)**

All colors are CSS custom properties, automatically updated when theme changes:

```css
/* Light theme (default in :root) */
--color-bg-primary: #ffffff;
--color-text-primary: #0d1b2a;
--color-accent: #f77f00;

/* Dark theme (in [data-theme="dark"]) */
[data-theme="dark"] {
  --color-bg-primary: #0d1b2a;
  --color-text-primary: #f0f4f8;
  --color-accent: #f77f00; /* Same accent */
}
```

---

## Technical Details

### File Structure

```
giftcheck/
├── css/
│   ├── style.css          ← Contains both dark & light theme tokens
│   └── responsive.css
├── js/
│   ├── theme.js           ← Theme management system (NEW)
│   ├── main.js            ← UI initialization, includes theme toggle
│   ├── modal.js
│   └── verification.js
└── index.html             ← Includes theme.js script + toggle button
```

### How It Works

1. **Initialization** (`theme.js`)
   - On page load, theme system checks for saved preference in localStorage
   - Falls back to system preference (OS light/dark mode)
   - Defaults to **light theme** if no preference found

2. **Application** (`<html data-theme="light|dark">`)
   - Theme is set via `data-theme` attribute on `<html>` element
   - All CSS variables update automatically
   - Custom `themechange` event fires for listeners

3. **Persistence** (localStorage)
   - User preference stored as `"giftcheck-theme"` key
   - Survives page refreshes
   - Can be cleared: `localStorage.removeItem('giftcheck-theme')`

4. **System Watch**
   - Monitors OS theme preference changes
   - Auto-switches only if no saved preference exists
   - Respects user intent

---

## Customizing Themes

### To Add a New Color

1. **Define in both themes** (`css/style.css`):

```css
:root {
  /* Dark theme */
  --my-custom-color: #1e3a5f;
}

[data-theme="light"] {
  --my-custom-color: #f0f5ff;
}
```

2. **Use in CSS**:

```css
.my-element {
  color: var(--my-custom-color);
}
```

### To Modify Theme Tokens

Edit `css/style.css`:

```css
/* Dark theme — lines 19-68 */
:root {
  --color-bg-primary: #0d1b2a; /* Change here */
  /* ... */
}

/* Light theme — lines 70-100 */
[data-theme="light"] {
  --color-bg-primary: #ffffff; /* And here */
  /* ... */
}
```

Changes apply instantly across the entire site.

---

## Browser Support

- **Modern browsers**: ✓ (Chrome, Firefox, Safari, Edge)
- **localStorage**: Required for preference persistence
- **CSS custom properties**: Required (all modern browsers)
- **System preference detection**: Uses `prefers-color-scheme` media query
  - Not supported in older browsers; falls back gracefully

---

## Performance Notes

- **No runtime performance cost** — pure CSS variables
- **Instant switching** — 250ms smooth transition (CSS `--transition-base`)
- **No flash of wrong theme** — script runs before DOM renders
- **localStorage size** — minimal (just 1 string key)

---

## Testing Themes

### Manual

1. Click the theme toggle button in the navigation
2. Refresh the page — preference persists
3. Check browser DevTools: `localStorage.getItem('giftcheck-theme')`

### System Preference

**macOS/Linux**:
```bash
# Switch system to light mode, observe site auto-adapts
# (only if no saved preference)
```

**DevTools**:
- Chrome: DevTools → ⋮ → More tools → Rendering → Emulate CSS media feature prefers-color-scheme

---

## API Reference

### `window.theme` Object

| Method | Returns | Description |
|--------|---------|-------------|
| `init()` | — | Re-initialize theme system (rarely needed) |
| `apply(theme)` | — | Apply 'dark' or 'light' theme |
| `getCurrent()` | `string` | Get current theme ('dark' or 'light') |
| `toggle()` | — | Switch between dark and light |
| `setDark()` | — | Force dark theme |
| `setLight()` | — | Force light theme |
| `systemPrefersLight()` | `boolean` | Check if OS is in light mode |

### Events

```javascript
document.addEventListener('themechange', (e) => {
  const theme = e.detail.theme; // 'dark' or 'light'
});
```

---

## Troubleshooting

### Theme not persisting after refresh
- Check if `js/theme.js` is loading (check DevTools console)
- Verify localStorage is enabled in browser
- Check if any script is overriding the attribute

### System preference not detected
- Only works in modern browsers (Chrome 76+, Firefox 67+, Safari 12.1+)
- DevTools Rendering tab can simulate preferences
- Falls back to dark theme if detection fails

### Buttons/text hard to see in light theme
- Check color contrast in `[data-theme="light"]` section
- Adjust `--color-text-primary` or `--color-text-secondary` as needed
- Use WCAG contrast checker tool

---

## Changelog

### v1.0 (Initial Release)
- ✓ Dark theme (default fintech-inspired design)
- ✓ Light theme (white, professional)
- ✓ Toggle button in navigation
- ✓ localStorage persistence
- ✓ System preference detection
- ✓ All components themed (forms, modals, cards, etc.)

---

## Future Enhancements

Potential improvements (not implemented yet):

- [ ] Additional themes (e.g., high-contrast, sepia)
- [ ] Per-component theme overrides
- [ ] Theme scheduling (auto-switch at specific times)
- [ ] Theme export/import for custom themes
- [ ] Theme animation options

---

## Questions?

For issues or suggestions related to theming, refer to the main README.md or contact support.
