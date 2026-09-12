/**
 * modal.js
 * Modal open / close / render logic.
 * Depends on: verification.js (for GiftsChecker.formatBalance, getStatusCopy)
 */

'use strict';

/* ----------------------------------------------------------
   DOM references (resolved on DOMContentLoaded in main.js)
   ---------------------------------------------------------- */
let _backdrop = null;
let _modal    = null;

/* ----------------------------------------------------------
   Helpers
   ---------------------------------------------------------- */

/**
 * Build the SVG icon markup for each result status.
 * @param {string} status  'valid' | 'expired' | 'invalid'
 * @returns {string} SVG HTML string
 */
function buildStatusIcon(status) {
  if (status === 'valid') {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
              stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>`;
  }
  if (status === 'expired') {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
              stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>`;
  }
  // invalid
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
            stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>`;
}

/**
 * Format a date string for display (ISO → "Jan 15, 2024").
 * Falls back gracefully for 'N/A'.
 * @param {string} dateStr
 * @returns {string}
 */
function formatDate(dateStr) {
  if (!dateStr || dateStr === 'N/A') return 'N/A';
  const d = new Date(dateStr + 'T00:00:00');
  if (isNaN(d)) return dateStr;
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

/**
 * Capitalise the first letter of a string.
 * @param {string} str
 * @returns {string}
 */
function capitalise(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/* ----------------------------------------------------------
   Build modal content
   ---------------------------------------------------------- */

/**
 * Render the result into the modal body and footer.
 * Handles both normal verification results and email error states.
 * @param {object} result  — output of GiftsChecker.verifyCard() OR an error object
 */
function renderResult(result) {
  const statusBlock = _modal.querySelector('.result-status-block');
  const detailsEl   = _modal.querySelector('.result-details');
  const footerBtn   = _modal.querySelector('.modal-verify-again');

  /* ─── Error state (EmailJS / network failure) ─────────── */
  if (result._isError) {
    const errorIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
        stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
        <line x1="12" y1="9" x2="12" y2="13"></line>
        <line x1="12" y1="17" x2="12.01" y2="17"></line>
      </svg>`;

    statusBlock.className = 'result-status-block expired'; // amber colour
    statusBlock.innerHTML = `
      <div class="result-icon-wrap" role="img" aria-label="${result.errorLabel}">
        ${errorIcon}
      </div>
      <p class="result-status-label">${result.errorLabel}</p>
      <p class="result-status-msg">${result.errorMessage}</p>
    `;

    detailsEl.innerHTML = `
      <div class="result-detail-row">
        <span class="result-detail-key">Error Code</span>
        <span class="result-detail-val">${result.errorCode}</span>
      </div>
      <div class="result-detail-row">
        <span class="result-detail-key">Card Entered</span>
        <span class="result-detail-val">${result.cardId || '—'}</span>
      </div>
      <div class="result-detail-row">
        <span class="result-detail-key">Timestamp</span>
        <span class="result-detail-val">${new Date(result.checkedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
      </div>
      <div class="error-support-note">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" width="14" height="14">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
        </svg>
        If this error persists, use the live chat below or contact support.
      </div>
    `;

    if (footerBtn) {
      footerBtn.textContent = result.errorAction || 'Try Again';
      footerBtn.onclick = closeModal;
    }

    const titleEl = _modal.querySelector('.modal-title');
    if (titleEl) titleEl.textContent = 'Verification Error';
    return;
  }

  /* ─── Normal verification result ──────────────────────── */
  const { formatBalance, getStatusCopy } = window.GiftsChecker;
  const { status, balance, currency, type, issued, expires,
          issuer, cardId, checkedAt, verificationId,
          declaredAmount, declaredCurrency, cardBrand } = result;

  const copy       = getStatusCopy(status);
  const statusIcon = buildStatusIcon(status);
  const checkedDate = new Date(checkedAt).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  statusBlock.className = `result-status-block ${status}`;
  statusBlock.innerHTML = `
    <div class="result-icon-wrap" role="img" aria-label="${copy.label}">
      ${statusIcon}
    </div>
    <p class="result-status-label">${copy.label}</p>
    <p class="result-status-msg">${copy.message}</p>
  `;

  const rows = [];
  rows.push({ key: 'Card ID',          val: cardId,   cls: '' });
  rows.push({ key: 'Card Brand',       val: cardBrand ? capitalise(cardBrand.replace(/-/g, ' ')) : 'N/A', cls: '' });
  rows.push({ key: 'Status',           val: capitalise(status),  cls: 'highlight' });
  if (status === 'valid') {
    rows.push({ key: 'Verified Balance', val: formatBalance(balance, currency), cls: 'balance' });
  }
  if (declaredAmount && declaredCurrency) {
    rows.push({ key: 'Declared Amount', val: `${declaredCurrency} ${parseFloat(declaredAmount).toFixed(2)}`, cls: '' });
  }
  rows.push({ key: 'Card Type',  val: type || 'N/A',       cls: '' });
  rows.push({ key: 'Issued',     val: formatDate(issued),  cls: '' });
  rows.push({ key: 'Expires',    val: formatDate(expires), cls: '' });
  rows.push({ key: 'Issuer',     val: issuer || 'N/A',     cls: '' });
  rows.push({ key: 'Checked At', val: checkedDate,         cls: '' });
  rows.push({ key: 'Reference',  val: verificationId,      cls: '' });

  detailsEl.innerHTML = rows.map(r => `
    <div class="result-detail-row">
      <span class="result-detail-key">${r.key}</span>
      <span class="result-detail-val${r.cls ? ' ' + r.cls : ''}">${r.val}</span>
    </div>
  `).join('');

  if (footerBtn) {
    footerBtn.textContent = 'Verify Another Card';
    footerBtn.onclick = closeModal;
  }
}

/* ----------------------------------------------------------
   Open / Close
   ---------------------------------------------------------- */

/**
 * Open the modal and render verification results.
 * @param {object} result  — output of GiftsChecker.verifyCard()
 */
function openModal(result) {
  if (!_backdrop || !_modal) return;

  renderResult(result);

  // Title is set inside renderResult for error states; set for normal results here
  if (!result._isError) {
    const titleEl = _modal.querySelector('.modal-title');
    if (titleEl) titleEl.textContent = 'Verification Result';
  }

  // Show
  _backdrop.classList.add('modal-open');
  _backdrop.removeAttribute('aria-hidden');
  _backdrop.setAttribute('aria-modal', 'true');

  // Move focus to close button for accessibility
  const closeBtn = _modal.querySelector('.modal-close');
  if (closeBtn) {
    // Slight delay to allow CSS transition to start
    setTimeout(() => closeBtn.focus(), 50);
  }

  // Prevent body scroll
  document.body.style.overflow = 'hidden';
}

/**
 * Close the modal and restore body scroll.
 */
function closeModal() {
  if (!_backdrop) return;

  _backdrop.classList.remove('modal-open');
  _backdrop.setAttribute('aria-hidden', 'true');
  _backdrop.removeAttribute('aria-modal');

  document.body.style.overflow = '';

  // Return focus to verify button
  const verifyBtn = document.getElementById('verify-btn');
  if (verifyBtn) {
    setTimeout(() => verifyBtn.focus(), 50);
  }
}

/* ----------------------------------------------------------
   Focus trap inside modal
   ---------------------------------------------------------- */
function trapFocus(e) {
  if (!_backdrop || !_backdrop.classList.contains('modal-open')) return;

  const focusable = _modal.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );
  const first = focusable[0];
  const last  = focusable[focusable.length - 1];

  if (e.key === 'Tab') {
    if (e.shiftKey) {
      if (document.activeElement === first) {
        e.preventDefault();
        last.focus();
      }
    } else {
      if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  if (e.key === 'Escape') {
    closeModal();
  }
}

/* ----------------------------------------------------------
   Initialise
   ---------------------------------------------------------- */

/**
 * Wire up modal DOM references and event listeners.
 * Called once from main.js after DOMContentLoaded.
 */
function initModal() {
  _backdrop = document.getElementById('result-modal-backdrop');
  _modal    = document.getElementById('result-modal');

  if (!_backdrop || !_modal) {
    console.warn('GiftsChecker: modal elements not found in DOM.');
    return;
  }

  // Close button
  const closeBtn = _modal.querySelector('.modal-close');
  if (closeBtn) closeBtn.addEventListener('click', closeModal);

  // "Verify Another Card" button in footer
  const footerBtn = _modal.querySelector('.modal-verify-again');
  if (footerBtn) footerBtn.addEventListener('click', closeModal);

  // Click outside modal to close
  _backdrop.addEventListener('click', (e) => {
    if (e.target === _backdrop) closeModal();
  });

  // Keyboard: Escape + focus trap
  document.addEventListener('keydown', trapFocus);
}

/* Expose to GiftsChecker namespace */
window.GiftsChecker = window.GiftsChecker || {};
Object.assign(window.GiftsChecker, {
  initModal,
  openModal,
  closeModal,
});
