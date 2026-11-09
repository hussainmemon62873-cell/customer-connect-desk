(function () {
  'use strict';
  let completed = false;
  let held = false;
  let failSafe = null;
  function finish() {
    if (completed) return;
    completed = true;
    if (failSafe) clearTimeout(failSafe);
    const loader = document.getElementById('ccd-brand-loader');
    if (!loader) return;
    loader.classList.add('ccd-loader-hidden');
    window.setTimeout(() => loader.remove(), 520);
  }
  window.CCDLoading = {
    hold() { held = true; },
    finish,
    isVisible() { return !completed; }
  };
  document.addEventListener('DOMContentLoaded', () => {
    failSafe = window.setTimeout(finish, 12000);
    if (!held) window.setTimeout(finish, 650);
  }, { once: true });
  window.addEventListener('load', () => {
    if (!held) window.setTimeout(finish, 220);
  }, { once: true });
})();
