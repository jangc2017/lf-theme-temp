/* ============================================================
   LE FIGUE — custom behaviour
   Loaded via <script defer> in layout/theme.liquid.
   ============================================================ */

/* Header overrides search: hovering (or focusing) a primary nav item
   closes the open full-width search bar, so the two never show at once.
   Scoped to the nav links only — NOT the search icon — so opening
   search doesn't immediately close itself. */
(function () {
  var NAV_SELECTOR = '.header__links-primary';
  var TRIGGER_SELECTOR = 'a, button, [data-link]';

  function searchIsOpen() {
    var qs = document.querySelector('.quick-search');
    return !!qs && (
      qs.classList.contains('quick-search--visible') ||
      document.body.getAttribute('quick-search-open') === 'true'
    );
  }

  function closeSearch() {
    if (!searchIsOpen()) return;
    var qs = document.querySelector('.quick-search');
    if (!qs) return;
    // Use the theme's own close handler for a clean teardown.
    var closeBtn = qs.querySelector('[data-close-icon], .quick-search__close');
    if (closeBtn) { closeBtn.click(); return; }
    var overlay = qs.querySelector('[data-overlay]');
    if (overlay) overlay.click();
  }

  function onNavInteract(e) {
    if (!searchIsOpen()) return;
    var nav = e.target.closest(NAV_SELECTOR);
    if (!nav) return;
    if (e.target.closest(TRIGGER_SELECTOR)) closeSearch();
  }

  // Delegated on document so it survives theme-editor re-renders.
  document.addEventListener('mouseover', onNavInteract);
  document.addEventListener('focusin', onNavInteract);
})();

/* Materials filter zap — REMOVED 2026-07-14. The facet was hidden here
   (label-match) + custom.css Edit #15 while custom.material held garbled
   free-text values; the metafield is now bulk-standardized to the four
   material-collection values, so the facet renders clean and stays on. */

/* Product cards — mobile swipe dots. custom.css (Edit #16) turns cards
   that have a second hover image into a 2-slide scroll-snap carousel on
   touch devices; this module adds the dots and highlights the active
   slide. MutationObserver covers AJAX-rendered grids (filtering,
   pagination, sliders, quick search). */
(function () {
  if (!window.matchMedia || !matchMedia('(hover: none)').matches) return;

  function initCard(media) {
    if (media.dataset.lfDots) return;
    var link = media.querySelector('.product-item__image-link');
    if (!link || link.children.length < 2) return;
    media.dataset.lfDots = '1';

    var dots = document.createElement('div');
    dots.className = 'lf-card-dots';
    var spans = [];
    for (var i = 0; i < link.children.length; i++) {
      var s = document.createElement('span');
      if (i === 0) s.className = 'on';
      dots.appendChild(s);
      spans.push(s);
    }
    media.appendChild(dots);

    var ticking = false;
    link.addEventListener('scroll', function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () {
        ticking = false;
        var idx = Math.round(link.scrollLeft / Math.max(link.clientWidth, 1));
        if (idx < 0) idx = 0;
        if (idx > spans.length - 1) idx = spans.length - 1;
        for (var j = 0; j < spans.length; j++) {
          spans[j].classList.toggle('on', j === idx);
        }
      });
    }, { passive: true });
  }

  function scan() {
    document.querySelectorAll('.product-item__media--multiple-images').forEach(initCard);
  }

  function init() {
    scan();
    new MutationObserver(scan).observe(document.body, { childList: true, subtree: true });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

/* Back-button scroll restoration for product lists. Opening a product
   and hitting Back should land the shopper where they left off in the
   grid. When the browser serves the list from bfcache it restores
   position natively (we do nothing); on a normal back/forward reload we
   restore the saved offset ourselves, re-correcting briefly while
   lazy-loaded content settles. Keyed per URL (path + query) so each
   collection/filter state remembers its own spot. */
(function () {
  function key() {
    return 'lf-scroll:' + location.pathname + location.search;
  }

  // Save the list position whenever a product link is opened.
  document.addEventListener('click', function (e) {
    var a = e.target.closest('a[href*="/products/"]');
    if (!a) return;
    try {
      sessionStorage.setItem(key(), String(Math.round(window.scrollY || window.pageYOffset || 0)));
    } catch (err) { /* storage unavailable — skip */ }
  }, true);

  window.addEventListener('pageshow', function (ev) {
    if (ev.persisted) return; // bfcache already restored everything
    var nav = (performance.getEntriesByType && performance.getEntriesByType('navigation')[0]) || null;
    var isBack = nav
      ? nav.type === 'back_forward'
      : (performance.navigation && performance.navigation.type === 2);
    if (!isBack) return;

    var y = null;
    try { y = sessionStorage.getItem(key()); } catch (err) { return; }
    if (y === null) return;
    y = parseInt(y, 10);
    if (!y || y < 1) return;

    var tries = 0;
    (function attempt() {
      window.scrollTo(0, y);
      tries++;
      if (Math.abs((window.scrollY || 0) - y) > 2 && tries < 20) {
        setTimeout(attempt, 100);
      }
    })();
  });
})();

/* Wishlist (LF Edit #17). Client-side store — localStorage "lf:wishlist"
   holds [{h: product handle, t: saved-at ms}], newest first. Exposed as
   window.LFWishlist for the wishlist page (sections/lefigue-wishlist.liquid).
   Any element with [data-lf-wish="handle"] becomes a toggle: clicks are
   delegated on document (survives AJAX grid re-renders), saved state paints
   as .on + aria-pressed. Heart markup lives in snippets/product-item.liquid,
   styles in custom.css Edit #17. */
(function () {
  var KEY = 'lf:wishlist';

  function read() {
    try {
      var v = JSON.parse(localStorage.getItem(KEY) || '[]');
      return Array.isArray(v) ? v : [];
    } catch (e) { return []; }
  }
  function write(list) {
    try { localStorage.setItem(KEY, JSON.stringify(list)); } catch (e) {}
    document.dispatchEvent(new CustomEvent('lf:wishlist:change', { detail: { list: list } }));
  }

  var api = {
    list: read,
    has: function (h) {
      return read().some(function (x) { return x.h === h; });
    },
    add: function (h) {
      var l = read();
      if (!l.some(function (x) { return x.h === h; })) {
        l.unshift({ h: h, t: Date.now() });
        write(l);
      }
    },
    remove: function (h) {
      write(read().filter(function (x) { return x.h !== h; }));
    },
    toggle: function (h) {
      if (api.has(h)) { api.remove(h); return false; }
      api.add(h);
      return true;
    }
  };
  window.LFWishlist = api;

  function paint(root) {
    (root || document).querySelectorAll('[data-lf-wish]').forEach(function (btn) {
      var on = api.has(btn.getAttribute('data-lf-wish'));
      btn.classList.toggle('on', on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    // Header heart (Edit #18) is a nav LINK to /pages/wishlist, not a toggle
    // (data-lf-wish-nav, so the click delegation above never intercepts it).
    // Fill it gold whenever anything is saved.
    var filled = read().length > 0;
    (root || document).querySelectorAll('[data-lf-wish-nav]').forEach(function (el) {
      el.classList.toggle('on', filled);
    });
  }

  // Capture phase so the card's image-link never navigates on a heart tap.
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-lf-wish]');
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    api.toggle(btn.getAttribute('data-lf-wish'));
  }, true);

  document.addEventListener('lf:wishlist:change', function () { paint(); });

  function init() {
    paint();
    new MutationObserver(function () { paint(); })
      .observe(document.body, { childList: true, subtree: true });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

/* Packaging choice (2026-07-21; v2 pricing model same day). Per-ORDER:
   Full packaging (included in price, default) vs Reduced (−$2 off).
   v2: choosing Reduced earns discount code REDUCED-PACKAGING ($2 off
   order, combines with product/shipping discounts), auto-applied when
   the customer clicks Checkout. Full = untouched native flow. The v1
   hidden $2 "Full Packaging" product is retired (DRAFT) — scrub() still
   removes legacy lines of it from old carts. The displayed subtotal is
   bumped −$2 in place while Reduced is selected (idempotent dataset
   guards; theme re-renders re-adjusted via the observer). Choice lives
   in localStorage "lf:packaging" (absent = full). Chooser markup in
   snippets/lefigue-packaging-choice.liquid; styles custom.css #26. */
(function () {
  var LEGACY_VARIANT = 52110086013226;
  var CODE = 'REDUCED-PACKAGING';
  var KEY = 'lf:packaging';

  function pref() {
    try { return localStorage.getItem(KEY) === 'reduced' ? 'reduced' : 'full'; } catch (e) { return 'full'; }
  }
  function paint() {
    var p = pref();
    document.querySelectorAll('[data-lf-pack] input[type="radio"]').forEach(function (r) {
      r.checked = (r.value === p);
    });
  }

  function adjust() {
    var want = pref() === 'reduced' && !!document.querySelector('[data-lf-pack]');
    document.querySelectorAll('.quick-cart__footer-subtotal span, .cart__footer-subtotal span').forEach(function (el) {
      var txt = el.textContent.trim();
      if (el.dataset.lfAdj === txt) {
        if (!want) {
          el.textContent = el.dataset.lfBase;
          delete el.dataset.lfAdj;
          delete el.dataset.lfBase;
        }
        return;
      }
      delete el.dataset.lfAdj;
      delete el.dataset.lfBase;
      if (!want) return;
      var m = txt.match(/(\d[\d,]*(?:\.\d{2})?)/);
      if (!m) return;
      var num = parseFloat(m[1].replace(/,/g, ''));
      if (isNaN(num) || num < 2) return;
      var hasCents = m[1].indexOf('.') >= 0;
      var adjNum = (num - 2).toLocaleString('en-US', {
        minimumFractionDigits: hasCents ? 2 : 0,
        maximumFractionDigits: 2
      });
      var adjTxt = txt.replace(m[1], adjNum);
      el.dataset.lfBase = txt;
      el.dataset.lfAdj = adjTxt;
      el.textContent = adjTxt;
    });
  }

  document.addEventListener('change', function (e) {
    var r = e.target.closest('[data-lf-pack] input[type="radio"]');
    if (!r) return;
    try { localStorage.setItem(KEY, r.value === 'reduced' ? 'reduced' : 'full'); } catch (err) {}
    paint();
    adjust();
  });

  // Remove legacy v1 "Full Packaging" lines from carts created before the
  // pricing-model switch.
  function scrub() {
    fetch('/cart.js', { credentials: 'same-origin' })
      .then(function (r) { return r.json(); })
      .then(function (c) {
        var has = (c.items || []).some(function (i) { return i.variant_id === LEGACY_VARIANT; });
        if (!has) return;
        var updates = {};
        updates[LEGACY_VARIANT] = 0;
        return fetch('/cart/update.js', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ updates: updates })
        });
      })
      .catch(function () {});
  }

  // Checkout intercept — Reduced only. Full is the native flow, untouched.
  // On the cart page, quantity edits + the order note are saved first so
  // the discount redirect doesn't lose them.
  document.addEventListener('submit', function (e) {
    var form = e.target;
    if (!form.matches || !form.matches('.quick-cart__form, .cart__form')) return;
    var submitter = e.submitter;
    if (!submitter || submitter.name !== 'checkout') return;
    if (!document.querySelector('[data-lf-pack]')) return;
    if (pref() !== 'reduced') return;
    e.preventDefault();
    var go = function () { window.location.href = '/checkout?discount=' + CODE; };
    if (form.matches('.cart__form')) {
      fetch('/cart', { method: 'POST', credentials: 'same-origin', body: new FormData(form) })
        .catch(function () {})
        .then(go);
    } else {
      go();
    }
  }, true);

  function init() {
    paint();
    adjust();
    scrub();
    new MutationObserver(function () { paint(); adjust(); })
      .observe(document.body, { childList: true, subtree: true });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();