/**
 * verification.js
 * Deterministic gift card verification engine.
 *
 * Results are derived from the card ID itself — same ID always
 * produces the same result. No Math.random() used for outcomes.
 */

'use strict';

/* ----------------------------------------------------------
   Card database — known IDs with explicit results
   ---------------------------------------------------------- */
const CARD_DATABASE = {
  // Valid / active cards
  'GC-2024-ALPHA':  { status: 'valid',   balance: 50.00,  currency: 'USD', type: 'Retail',    issued: '2024-01-15', expires: '2026-12-31', issuer: 'GiftCheck Inc.' },
  'GC-2024-BRAVO':  { status: 'valid',   balance: 100.00, currency: 'USD', type: 'Premium',   issued: '2024-03-10', expires: '2027-03-10', issuer: 'GiftCheck Inc.' },
  'GC-2024-CHARLIE':{ status: 'valid',   balance: 25.00,  currency: 'USD', type: 'Retail',    issued: '2024-06-01', expires: '2026-06-01', issuer: 'GiftCheck Inc.' },
  'GC-2025-DELTA':  { status: 'valid',   balance: 200.00, currency: 'USD', type: 'Corporate', issued: '2025-01-01', expires: '2028-01-01', issuer: 'GiftCheck Inc.' },
  'GC-2025-ECHO':   { status: 'valid',   balance: 75.00,  currency: 'USD', type: 'Premium',   issued: '2025-04-20', expires: '2027-04-20', issuer: 'GiftCheck Inc.' },
  'GC-2025-FOXTROT':{ status: 'valid',   balance: 150.00, currency: 'USD', type: 'Corporate', issued: '2025-07-07', expires: '2028-07-07', issuer: 'GiftCheck Inc.' },
  'DEMO-VALID-001': { status: 'valid',   balance: 50.00,  currency: 'USD', type: 'Demo',      issued: '2025-01-01', expires: '2027-01-01', issuer: 'GiftCheck Inc.' },
  'DEMO-VALID-002': { status: 'valid',   balance: 120.00, currency: 'USD', type: 'Demo',      issued: '2025-06-15', expires: '2027-06-15', issuer: 'GiftCheck Inc.' },

  // Expired cards
  'GC-2020-ZULU':   { status: 'expired', balance: 0.00,   currency: 'USD', type: 'Retail',    issued: '2020-03-01', expires: '2022-03-01', issuer: 'GiftCheck Inc.' },
  'GC-2021-YANKEE': { status: 'expired', balance: 0.00,   currency: 'USD', type: 'Retail',    issued: '2021-05-10', expires: '2023-05-10', issuer: 'GiftCheck Inc.' },
  'DEMO-EXPIRED-01':{ status: 'expired', balance: 0.00,   currency: 'USD', type: 'Demo',      issued: '2022-01-01', expires: '2024-01-01', issuer: 'GiftCheck Inc.' },

  // Invalid / fraudulent cards
  'FAKE-CARD-0001': { status: 'invalid', balance: 0.00,   currency: 'USD', type: 'Unknown',   issued: 'N/A',        expires: 'N/A',        issuer: 'Unknown'        },
  'FAKE-CARD-0002': { status: 'invalid', balance: 0.00,   currency: 'USD', type: 'Unknown',   issued: 'N/A',        expires: 'N/A',        issuer: 'Unknown'        },
  'DEMO-INVALID-01':{ status: 'invalid', balance: 0.00,   currency: 'USD', type: 'Unknown',   issued: 'N/A',        expires: 'N/A',        issuer: 'Unknown'        },
};

/* ----------------------------------------------------------
   Deterministic hash — maps unknown IDs to a consistent bucket
   Uses a simple djb2-style hash so the same string always maps
   to the same result without any randomness.
   ---------------------------------------------------------- */

/**
 * Compute a stable 32-bit integer hash from a string (djb2).
 * @param {string} str
 * @returns {number}
 */
function hashString(str) {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) ^ str.charCodeAt(i);
    hash = hash >>> 0; // keep unsigned 32-bit
  }
  return hash;
}

/**
 * Derive a deterministic verification result for IDs not in the database.
 * The outcome bucket (valid / expired / invalid) is driven purely by the
 * hash of the normalised ID — no randomness involved.
 *
 * Distribution: ~40% valid, ~20% expired, ~40% invalid
 *
 * @param {string} rawId
 * @returns {object} result object
 */
function deriveResult(rawId) {
  const id = rawId.trim().toUpperCase();
  const h  = hashString(id);
  const bucket = h % 10; // 0–9

  if (bucket <= 3) {
    // 40% — valid
    const balances  = [10, 15, 20, 25, 30, 40, 50, 60, 75, 100];
    const balance   = balances[h % balances.length];
    const issuedYear = 2023 + (h % 3);
    const expiresYear = issuedYear + 2 + (h % 2);
    const month = String((h % 12) + 1).padStart(2, '0');
    const day   = String((h % 28) + 1).padStart(2, '0');
    return {
      status:   'valid',
      balance,
      currency: 'USD',
      type:     ['Retail', 'Premium', 'Corporate'][(h % 3)],
      issued:   `${issuedYear}-${month}-${day}`,
      expires:  `${expiresYear}-${month}-${day}`,
      issuer:   'GiftCheck Inc.',
    };
  }

  if (bucket <= 5) {
    // 20% — expired
    return {
      status:   'expired',
      balance:  0.00,
      currency: 'USD',
      type:     ['Retail', 'Premium'][(h % 2)],
      issued:   `${2020 + (h % 3)}-${String((h % 12) + 1).padStart(2, '0')}-01`,
      expires:  `${2022 + (h % 2)}-${String((h % 12) + 1).padStart(2, '0')}-01`,
      issuer:   'GiftCheck Inc.',
    };
  }

  // 40% — invalid
  return {
    status:   'invalid',
    balance:  0.00,
    currency: 'USD',
    type:     'Unknown',
    issued:   'N/A',
    expires:  'N/A',
    issuer:   'Unknown',
  };
}

/* ----------------------------------------------------------
   Public API
   ---------------------------------------------------------- */

/**
 * Normalise a card ID for consistent lookup.
 * Trims whitespace and upper-cases.
 * @param {string} id
 * @returns {string}
 */
function normaliseId(id) {
  return id.trim().toUpperCase();
}

/**
 * Validate the format of a card ID before submission.
 * Allows letters, digits, and hyphens; 4–32 characters.
 * @param {string} id
 * @returns {{ valid: boolean, message: string }}
 */
function validateCardId(id) {
  const trimmed = id.trim();

  if (!trimmed) {
    return { valid: false, message: 'Redemption code is required.' };
  }

  if (trimmed.length < 8) {
    return { valid: false, message: `Code too short — minimum 8 characters (${trimmed.length} entered).` };
  }

  if (trimmed.length > 32) {
    return { valid: false, message: 'Code must not exceed 32 characters.' };
  }

  if (!/^[A-Za-z0-9\-]+$/.test(trimmed)) {
    return { valid: false, message: 'Only letters, numbers, and hyphens are allowed.' };
  }

  return { valid: true, message: '' };
}

/**
 * Perform a deterministic card lookup.
 * Returns a result object with status, balance, and metadata.
 *
 * @param {string} cardId    Raw card ID string from the form
 * @param {string} cardType  Selected card type ('retail'|'premium'|'corporate')
 * @returns {object} result
 */
function verifyCard(cardId, cardType) {
  const normId  = normaliseId(cardId);
  const dbEntry = CARD_DATABASE[normId];
  const result  = dbEntry ? { ...dbEntry } : deriveResult(normId);

  // Attach request metadata
  result.cardId    = normId;
  result.cardType  = cardType || 'retail';
  result.checkedAt = new Date().toISOString();
  result.verificationId = generateVerificationId(normId);

  return result;
}

/**
 * Generate a stable, human-readable verification reference number.
 * Looks like: VRF-4A2B-9F1C
 * @param {string} normId
 * @returns {string}
 */
function generateVerificationId(normId) {
  const h = hashString(normId);
  const seg1 = ((h >>> 16) & 0xFFFF).toString(16).toUpperCase().padStart(4, '0');
  const seg2 = (h & 0xFFFF).toString(16).toUpperCase().padStart(4, '0');
  return `VRF-${seg1}-${seg2}`;
}

/**
 * Format a currency amount for display.
 * @param {number} amount
 * @param {string} currency
 * @returns {string}
 */
function formatBalance(amount, currency = 'USD') {
  return new Intl.NumberFormat('en-US', {
    style:    'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

/**
 * Map a status string to human-readable copy for the modal.
 * @param {string} status
 * @returns {{ label: string, message: string }}
 */
function getStatusCopy(status) {
  const map = {
    valid: {
      label:   'Card Verified',
      message: 'This gift card is authentic and has an available balance.',
    },
    expired: {
      label:   'Card Expired',
      message: 'This gift card exists but its validity period has ended.',
    },
    invalid: {
      label:   'Card Not Found',
      message: 'We could not verify this card. It may be counterfeit or incorrectly entered.',
    },
  };
  return map[status] || map.invalid;
}

/* Expose to other modules via the global GiftCheck namespace */
window.GiftCheck = window.GiftCheck || {};
Object.assign(window.GiftCheck, {
  verifyCard,
  validateCardId,
  formatBalance,
  getStatusCopy,
  normaliseId,
});
