# GiftCheck — Gift Card Verification Website

A polished, responsive gift card authenticity verification landing page built with semantic HTML5, modern CSS3, and Vanilla JavaScript. No frameworks, no build tools, no dependencies — open `index.html` in a browser and it works.

---

## Project Structure

```
giftcheck/
│
├── index.html                  # Main entry point
│
├── css/
│   ├── style.css               # Design tokens, base styles, all components
│   └── responsive.css          # Media queries (1024 / 768 / 640 / 480 px)
│
├── js/
│   ├── verification.js         # Deterministic card lookup + hash engine
│   ├── modal.js                # Modal open/close, result rendering, focus trap
│   └── main.js                 # Form handling, nav, FAQ, scroll reveal, boot
│
├── assets/
│   ├── images/
│   │   └── gift-card.svg       # Hero gift card illustration
│   ├── icons/
│   │   └── favicon.svg         # Browser tab icon
│   └── logo/
│       └── logo.svg            # GiftCheck wordmark
│
├── README.md
└── .gitignore
```

---

## Quick Start

No installation or build step required.

```bash
# Clone or download the repo, then simply open:
open index.html          # macOS
xdg-open index.html      # Linux
start index.html         # Windows
```

Or serve locally with any static file server:

```bash
# Python 3
python -m http.server 8080

# Node (npx)
npx serve .
```

Then visit `http://localhost:8080`.

---

## Demo Card IDs

Use these IDs in the verification form to test each outcome:

| Card ID           | Result   | Balance  |
|-------------------|----------|----------|
| `DEMO-VALID-001`  | ✅ Valid  | $50.00   |
| `DEMO-VALID-002`  | ✅ Valid  | $120.00  |
| `GC-2025-DELTA`   | ✅ Valid  | $200.00  |
| `GC-2025-ECHO`    | ✅ Valid  | $75.00   |
| `DEMO-EXPIRED-01` | ⏱ Expired | $0.00  |
| `GC-2020-ZULU`    | ⏱ Expired | $0.00  |
| `DEMO-INVALID-01` | ✗ Invalid | —      |
| `FAKE-CARD-0001`  | ✗ Invalid | —      |

Any other card ID produces a **deterministic** result derived from a djb2 hash of the normalised ID — the same ID always returns the same result.

---

## Technical Notes

### Verification Logic (`js/verification.js`)

- **Known cards**: 20 explicit entries in `CARD_DATABASE` with fixed outcomes.
- **Unknown cards**: A djb2 hash of the uppercased card ID maps to one of three buckets — 40% valid, 20% expired, 40% invalid. No `Math.random()` is used anywhere in the result path.
- **ID validation**: Allows letters, digits, and hyphens; 4–32 characters.
- All functions are exposed on the `window.GiftCheck` namespace.

### Modal (`js/modal.js`)

- Opens/closes with CSS class toggling (`modal-open`) for smooth transitions.
- Focus is trapped inside the modal while open (Tab / Shift+Tab cycling).
- Escape key closes the modal.
- Clicking the backdrop closes the modal.
- Focus returns to the verify button on close.
- No `alert()` or `confirm()` used anywhere.

### Form (`js/main.js`)

- `event.preventDefault()` stops default browser submission.
- Validates on submit; also validates on `blur` (debounced 200 ms).
- Button transitions to `Checking…` + spinner, disabled for exactly **1 500 ms**.
- Input auto-uppercases and strips invalid characters as the user types.
- Shake animation provides tactile feedback on invalid submission.

### CSS Architecture

- All design values live in CSS custom properties (`:root`) in `style.css`.
- `responsive.css` contains only overrides — no duplicated base rules.
- `prefers-reduced-motion` disables all animations and transitions.
- Scrollbar, selection colour, and focus rings are all themed.

---

## Browser Support

| Browser        | Version |
|----------------|---------|
| Chrome / Edge  | 90+     |
| Firefox        | 88+     |
| Safari         | 14+     |
| Mobile Safari  | 14+     |
| Samsung Internet | 14+  |

Uses: CSS custom properties, CSS Grid, CSS backdrop-filter, IntersectionObserver, Intl.NumberFormat. No polyfills included; IntersectionObserver falls back to showing all revealed elements immediately.

---

## Accessibility

- Semantic HTML5 landmarks (`<header>`, `<main>`, `<footer>`, `<nav>`, `<section>`).
- All interactive elements have `aria-label` or associated `<label>`.
- Modal uses `role="dialog"`, `aria-modal`, and a focus trap.
- Inline validation uses `role="alert"` and `aria-live="polite"`.
- FAQ uses proper `<dt>` / `<dd>` structure with `aria-expanded` toggling.
- `:focus-visible` outline styled for keyboard navigation.

---

## License

MIT — free to use, modify, and distribute.
