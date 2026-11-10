/* Small, isolated Admin auth-page controls. Runs independently of admin.js. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const host = String(location.hostname || '').toLowerCase();
  const apiUrl = host === 'customer-connect-desk.pages.dev'
    ? 'https://admin.ccd.dev/api'
    : new URL('/api', location.origin).toString();

  function bindPasswordToggle() {
    const input = $('admin-pass');
    const button = $('btn-toggle-eye');
    if (!input || !button || button.dataset.eyeToggleBound === 'true') return;
    button.dataset.eyeToggleBound = 'true';
    button.addEventListener('click', () => {
      const showing = input.type === 'password';
      input.type = showing ? 'text' : 'password';
      button.textContent = showing ? 'Hide' : 'Show';
      button.setAttribute('aria-pressed', String(showing));
      button.setAttribute('aria-label', showing ? 'Hide password' : 'Show password');
    });
  }

  async function checkBackendConnection() {
    const button = $('btn-admin-connection-check');
    const status = $('admin-connection-status');
    if (button) { button.disabled = true; button.textContent = 'Checking…'; }
    if (status) { status.textContent = 'Checking Cloudflare gateway and Google Apps Script…'; status.dataset.state = 'checking'; }
    try {
      const response = await fetch(apiUrl.replace(/\/$/, '') + '/health', {
        method: 'GET', cache: 'no-store', headers: { accept: 'application/json' }
      });
      const raw = await response.text();
      let result;
      try { result = JSON.parse(raw); }
      catch (error) { throw new Error('The API gateway returned a webpage instead of JSON. Deploy the updated Cloudflare Worker.'); }
      if (!response.ok || !result || result.status !== 'success' || result.reachable !== true) {
        throw new Error(result.message || 'The Google Apps Script connection check failed.');
      }
      if (status) {
        status.textContent = 'Connected — Cloudflare Worker reached Google Apps Script. Admin credentials are checked separately when you sign in.';
        status.dataset.state = 'success';
      }
    } catch (error) {
      if (status) { status.textContent = error.message || 'Connection check failed.'; status.dataset.state = 'error'; }
    } finally {
      if (button) { button.disabled = false; button.textContent = 'Check connection'; }
    }
  }

  function init() {
    bindPasswordToggle();
    const button = $('btn-admin-connection-check');
    if (button && button.dataset.connectionCheckBound !== 'true') {
      button.dataset.connectionCheckBound = 'true';
      button.addEventListener('click', checkBackendConnection);
    }
    checkBackendConnection();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
