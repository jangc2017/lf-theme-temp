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
