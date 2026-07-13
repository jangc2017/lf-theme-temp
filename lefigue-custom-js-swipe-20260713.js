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

/* Remove the "Materials" filter facet everywhere (desktop rail, mobile
   drawer, sidebar) by its visible label — the facet's source (metafield
   vs tag) doesn't matter. CSS handles the attribute-bearing cases
   (custom.css Edit #15); this covers containers with no label attribute.
   Runs now + on DOM changes (filters re-render via AJAX). */
(function () {
  var LABEL = 'materials';
  function zap(root) {
    var labels = (root || document).querySelectorAll(
      '.filter-group__label, .filter-drawer__group-toggle-label'
    );
    labels.forEach(function (el) {
      var txt = (el.textContent || '').trim().toLowerCase();
      if (txt.indexOf(LABEL) !== 0) return;
      var grp = el.closest('.filter-group, .filter-drawer__group, [data-filter-group]');
      if (grp) grp.style.display = 'none';
    });
  }
  function init() {
    zap(document);
    var mo = new MutationObserver(function () { zap(document); });
    mo.observe(document.body, { childList: true, subtree: true });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

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
