/*
 * Customer Connect Desk — AdSense loader
 *
 * Ads are OFF by default. Do not enable until Google has approved the publisher
 * account and real publisher/slot IDs have been configured by the site owner.
 * Only public platform/storefront pages are eligible; private dashboards and
 * customer/registration flows are always excluded.
 *
 * Configure before this script loads:
 * window.CCD_ADSENSE_CONFIG = {
 *   enabled: false,
 *   publisherId: 'YOUR_APPROVED_PUBLISHER_ID',
 *   slots: { platform_top: 'YOUR_REAL_AD_SLOT_ID', shop_footer: 'YOUR_REAL_AD_SLOT_ID' }
 * };
 * Add an empty <div data-adsense-slot="platform_top"></div> where an ad is
 * intended to appear. No ad placeholder is rendered without a valid slot.
 */
(function () {
  'use strict';

  var config = window.CCD_ADSENSE_CONFIG || {};
  if (config.enabled !== true) return;

  var host = String(window.location.hostname || '').toLowerCase();
  var path = String(window.location.pathname || '/').toLowerCase();
  var isRoot = host === 'ccd.dev' || host === 'www.ccd.dev';
  var isTenant = /^[a-z0-9](?:[a-z0-9-]{1,48})[a-z0-9]\.ccd\.dev$/.test(host);
  var privatePath = /^\/(admin|merchant|customer|desk|nfc|register|checkin)(\/|$)/.test(path) ||
    /\/(admin|merchant|customer|desk|nfc|register)\.html$/.test(path) ||
    path === '/index.html';
  if ((!isRoot && !isTenant) || privatePath) return;

  var publisherId = String(config.publisherId || '').trim();
  if (!/^ca-pub-\d{16}$/.test(publisherId)) {
    console.warn('CCD AdSense is enabled but the publisher ID is missing or invalid. Ads remain disabled.');
    return;
  }

  var slots = config.slots && typeof config.slots === 'object' ? config.slots : {};
  var scriptStarted = false;

  function refresh() {
    var placeholders = Array.prototype.slice.call(document.querySelectorAll('[data-adsense-slot]'));
    var valid = placeholders.map(function (element) {
      var key = String(element.getAttribute('data-adsense-slot') || '').trim();
      var slotId = String(slots[key] || '').trim();
      return { element: element, slotId: slotId };
    }).filter(function (item) { return /^\d{8,20}$/.test(item.slotId); });
    if (!valid.length) return;

    if (!scriptStarted) {
      scriptStarted = true;
      var script = document.createElement('script');
      script.async = true;
      script.crossOrigin = 'anonymous';
      script.dataset.ccdAdsense = '1';
      script.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=' + encodeURIComponent(publisherId);
      document.head.appendChild(script);
    }

    valid.forEach(function (item) {
      if (item.element.dataset.ccdAdsenseMounted === '1') return;
      item.element.dataset.ccdAdsenseMounted = '1';
      item.element.hidden = false;
      var ad = document.createElement('ins');
      ad.className = 'adsbygoogle';
      ad.style.display = 'block';
      ad.style.minHeight = '90px';
      ad.setAttribute('data-ad-client', publisherId);
      ad.setAttribute('data-ad-slot', item.slotId);
      ad.setAttribute('data-ad-format', 'auto');
      ad.setAttribute('data-full-width-responsive', 'true');
      item.element.appendChild(ad);
      try {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
      } catch (error) {
        item.element.textContent = '';
        item.element.dataset.ccdAdsenseMounted = '0';
        console.warn('CCD AdSense slot could not be initialized.', error);
      }
    });
  }

  window.CCDAdsense = window.CCDAdsense || {};
  window.CCDAdsense.refresh = refresh;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', refresh, { once: true });
  else refresh();
})();
