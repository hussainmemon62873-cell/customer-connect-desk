const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzNPnuDhiXOrm4-tRJJ7wXpb7PMwifLQfK-i3pbW-QaOrU74fm-PFgh9aT2sntGLZgx/exec";

const BASE_DOMAIN = "https://customer-connect-desk.pages.dev";

const $ = id => document.getElementById(id);
let currentSlug = "memonlock";
let merchantToken = "";
let merchantStoreConfig = null;
let merchantCustomerTimer = null;
let merchantPricingInitialized = false;

function showToast(msg, isError = false) {
  const box = $("toast-box");
  if (!box) return;
  box.textContent = msg;
  box.classList.toggle("is-error", isError);
  box.classList.add("show");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => box.classList.remove("show"), 3200);
}

function escapeHtml(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
}

function ensureMerchantExtraSections() {
  const shell = document.querySelector('.app-shell');
  const metrics = document.querySelector('.metrics-grid');
  if (!shell || !metrics) return;
  let crm = $('merchant-customer-section');
  if (!crm) {
    crm = document.createElement('section');
    crm.id = 'merchant-customer-section';
    crm.className = 'card';
    crm.style.cssText = 'margin:20px 0; padding:18px; background:#fff; border:1px solid #e2e8f0; border-radius:16px; box-shadow:0 8px 24px rgba(15,23,42,.06);';
    crm.innerHTML = `<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap"><div><h2 style="margin:0;font-size:1.12rem;color:#0f172a">Recent Customer Visits</h2><p style="margin:5px 0 0;color:#64748b;font-size:.86rem">Refreshes automatically. WhatsApp messages open as drafts for you to review and send.</p></div><button type="button" id="merchant-refresh-customers" style="border:1px solid #cbd5e1;background:#f8fafc;color:#0f172a;padding:9px 13px;border-radius:10px;font-weight:700">Refresh</button></div><div id="merchant-customer-list" style="margin-top:14px"><p style="color:#64748b">Unlock the dashboard to load recent visits.</p></div>`;
    metrics.insertAdjacentElement('afterend', crm);
    $('merchant-refresh-customers').addEventListener('click', loadMerchantCustomers);
  }
  crm.hidden = !merchantToken;
  let pricing = $('merchant-pricing-section');
  if (!pricing) {
    pricing = document.createElement('section');
    pricing.id = 'merchant-pricing-section';
    pricing.className = 'card';
    pricing.style.cssText = 'margin:20px 0; padding:18px; background:#fff; border:1px solid #e2e8f0; border-radius:16px; box-shadow:0 8px 24px rgba(15,23,42,.06);';
    pricing.innerHTML = `<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap"><div><h2 style="margin:0;font-size:1.12rem;color:#0f172a">Shop Pricing</h2><p style="margin:5px 0 0;color:#64748b;font-size:.86rem">Edit prices only. Changes are recorded in Price History.</p></div><button type="button" id="merchant-add-price" style="border:1px solid #cbd5e1;background:#f8fafc;color:#0f172a;padding:9px 13px;border-radius:10px;font-weight:700">+ Add item</button></div><div id="merchant-pricing-list" style="margin-top:14px"></div><button id="merchant-save-pricing" type="button" style="margin-top:12px;width:100%;border:0;background:#2563eb;color:#fff;padding:12px;border-radius:10px;font-weight:700">Save Pricing</button>`;
    crm.insertAdjacentElement('afterend', pricing);
    $('merchant-add-price').addEventListener('click', () => addMerchantPriceRow());
    $('merchant-save-pricing').addEventListener('click', saveMerchantPricing);
  }
  pricing.hidden = !merchantToken;
  if (!$('ccd-merchant-mobile-styles')) { const style = document.createElement('style'); style.id='ccd-merchant-mobile-styles'; style.textContent='@media(max-width:640px){.merchant-price-row{grid-template-columns:1fr 1fr!important}.merchant-price-row .merchant-price-desc{grid-column:1/-1}.merchant-price-row button{grid-column:1/-1}}'; document.head.appendChild(style); }
}

function addMerchantPriceRow(item = '', price = '', desc = '') {
  const list = $('merchant-pricing-list');
  if (!list) return;
  const row = document.createElement('div');
  row.className = 'merchant-price-row';
  row.style.cssText = 'display:grid;grid-template-columns:minmax(100px,1.2fr) minmax(90px,.7fr) minmax(120px,1.4fr) auto;gap:8px;margin-bottom:9px;align-items:center';
  row.innerHTML = `<input class="merchant-price-name" placeholder="Item or service" value="${escapeHtml(item)}" style="min-width:0;padding:10px;border:1px solid #cbd5e1;border-radius:9px"><input class="merchant-price-value" placeholder="₹ Price" value="${escapeHtml(price)}" style="min-width:0;padding:10px;border:1px solid #cbd5e1;border-radius:9px"><input class="merchant-price-desc" placeholder="Description (optional)" value="${escapeHtml(desc)}" style="min-width:0;padding:10px;border:1px solid #cbd5e1;border-radius:9px"><button type="button" aria-label="Remove price item" style="padding:9px;border:0;border-radius:8px;background:#fee2e2;color:#991b1b" onclick="this.closest('.merchant-price-row').remove()">Remove</button>`;
  list.appendChild(row);
}

function renderMerchantPricing(items) {
  ensureMerchantExtraSections();
  const list = $('merchant-pricing-list');
  if (!list) return;
  list.innerHTML = '';
  (Array.isArray(items) ? items : []).forEach(item => addMerchantPriceRow(item.item, item.price, item.desc));
  if (!list.children.length) list.innerHTML = '<p style="color:#64748b">No prices have been added yet. Use Add item to start a price list.</p>';
  list.addEventListener('click', e => { if (e.target && e.target.matches('button[aria-label="Remove price item"]')) {} }, { once: true });
}

async function saveMerchantPricing() {
  if (!merchantToken) return showToast('Unlock the dashboard again.', true);
  const rows = Array.from(document.querySelectorAll('.merchant-price-row'));
  const pricing = rows.map(row => ({
    item: row.querySelector('.merchant-price-name').value.trim(),
    price: row.querySelector('.merchant-price-value').value.trim(),
    desc: row.querySelector('.merchant-price-desc').value.trim(), currency: 'INR'
  })).filter(item => item.item);
  if (rows.some(row => row.querySelector('.merchant-price-name').value.trim() && !row.querySelector('.merchant-price-value').value.trim())) return showToast('Enter a price for every named item.', true);
  const btn = $('merchant-save-pricing');
  if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }
  try {
    const result = await apiPost({ action: 'updateMerchantPricing', shopId: currentSlug, merchantToken, pricing });
    if (result.status !== 'success') throw new Error(result.message || 'Pricing could not be saved.');
    showToast('Prices saved. Price History has been updated.');
  } catch (err) { showToast(err.message || 'Pricing could not be saved.', true); }
  finally { if (btn) { btn.disabled = false; btn.textContent = 'Save Pricing'; } }
}

function makeCustomerWhatsAppLink(customer) {
  let digits = String(customer.fullNumber || customer.formattedPhone || customer.phone || '').replace(/\D/g, '');
  if (digits.length === 10) digits = '91' + digits;
  if (digits.length < 11) return '';
  const shopName = merchantStoreConfig && merchantStoreConfig.shopName || currentSlug;
  const shopUrl = `${BASE_DOMAIN}/shop.html?shop=${encodeURIComponent(currentSlug)}`;
  const message = `Hello ${customer.name || 'there'}, thank you for visiting ${shopName}! Your visit has been recorded successfully. We look forward to seeing you again.\n\nOur shop: ${shopUrl}`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

async function loadMerchantCustomers() {
  if (!merchantToken) return;
  const list = $('merchant-customer-list');
  if (list && !list.dataset.loading) list.dataset.loading = '1';
  try {
    const data = await apiPost({ action: 'getMerchantData', shopId: currentSlug, merchantToken });
    if (!merchantPricingInitialized && Array.isArray(data.pricing)) { renderMerchantPricing(data.pricing); merchantPricingInitialized = true; }
    const customers = Array.isArray(data.customers) ? data.customers.slice().reverse() : [];
    const latest = customers.slice(0, 50);
    const today = new Date().toDateString();
    const todayCount = customers.filter(c => c.timestamp && new Date(c.timestamp).toDateString() === today).length;
    const uniqueCount = new Set(customers.map(c => String(c.phone || '').replace(/\D/g, '')).filter(Boolean)).size;
    if ($('stat-today-visits')) $('stat-today-visits').textContent = String(todayCount);
    if ($('stat-total-customers')) $('stat-total-customers').textContent = String(data.uniqueCustomers == null ? uniqueCount : data.uniqueCustomers);
    if (list) {
      if (!latest.length) list.innerHTML = '<p style="color:#64748b">No customer visits have been recorded for this shop yet.</p>';
      else list.innerHTML = latest.map(c => {
        const opted = String(c.whatsappOptIn || '').toUpperCase() === 'YES';
        const link = opted ? makeCustomerWhatsAppLink(c) : '';
        const when = c.timestamp ? new Date(c.timestamp).toLocaleString() : 'Visit date unavailable';
        return `<article style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;padding:12px 0;border-bottom:1px solid #e2e8f0"><div style="min-width:170px;flex:1"><strong style="display:block;color:#0f172a">${escapeHtml(c.name || 'Customer')}</strong><span style="display:block;color:#64748b;font-size:.85rem">${escapeHtml(c.phone || '')} · ${escapeHtml(when)}</span><span style="display:block;color:#64748b;font-size:.78rem">WhatsApp consent: ${opted ? 'Yes' : 'No'}</span></div>${link ? `<a href="${link}" target="_blank" rel="noopener noreferrer" style="display:inline-block;background:#0f766e;color:#fff;text-decoration:none;border-radius:9px;padding:9px 12px;font-weight:700">Send WhatsApp</a>` : '<span style="font-size:.8rem;color:#94a3b8">No WhatsApp consent</span>'}</article>`;
      }).join('');
    }
  } catch (err) {
    if (list) list.innerHTML = `<p style="color:#b91c1c">${escapeHtml(err.message || 'Unable to load customer visits.')}</p>`;
    if (/session expired/i.test(err.message || '')) {
      sessionStorage.removeItem(`merchant_auth_${currentSlug}`);
      merchantToken = '';
      if ($('auth-backdrop')) $('auth-backdrop').classList.add('active');
      if ($('pin-input')) { $('pin-input').value = ''; $('pin-input').focus(); }
      const customerSection = $('merchant-customer-section');
      const pricingSection = $('merchant-pricing-section');
      if (customerSection) customerSection.hidden = true;
      if (pricingSection) pricingSection.hidden = true;
      if (merchantCustomerTimer) { clearInterval(merchantCustomerTimer); merchantCustomerTimer = null; }
    }
  } finally { if (list) delete list.dataset.loading; }
}

async function apiPost(payload) {
  const res = await fetch(SCRIPT_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload)
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); }
  catch (err) { throw new Error("Server returned an unreadable response."); }
  if (!res.ok || data.status === "error") throw new Error(data.message || "Request failed.");
  return data;
}

function verifyAuth() {
  merchantToken = sessionStorage.getItem(`merchant_auth_${currentSlug}`) || "";
  const overlay = $("auth-backdrop");
  if (!merchantToken && overlay) {
    overlay.classList.add("active");
    if ($("pin-input")) {
      $("pin-input").value = "";
      $("pin-input").focus();
    }
  }
}

const statusToggle = $("status-toggle");
const statusCard = $("status-card-box");
const statusHeadline = $("status-headline");

if (statusToggle) {
  statusToggle.addEventListener("change", () => {
    if (statusCard) statusCard.classList.toggle("closed", !statusToggle.checked);
    if (statusHeadline) statusHeadline.textContent = statusToggle.checked ? "STORE IS OPEN" : "STORE IS CLOSED";
  });
}

document.querySelectorAll(".time-chip").forEach(chip => {
  chip.addEventListener("click", () => {
    if ($("closing-time-input")) $("closing-time-input").value = chip.getAttribute("data-time") || "";
  });
});

async function initDashboard() {
  const params = new URLSearchParams(window.location.search);
  currentSlug = (params.get("shop") || "memonlock").trim().toLowerCase();
  if (!/^[a-z0-9_-]{3,50}$/.test(currentSlug)) currentSlug = "memonlock";

  if ($("dash-shop-slug")) $("dash-shop-slug").textContent = `slug: ${currentSlug}`;
  if ($("preview-storefront-btn")) $("preview-storefront-btn").href = `shop.html?shop=${encodeURIComponent(currentSlug)}`;
  if ($("preview-desk-btn")) $("preview-desk-btn").href = `desk.html?shop=${encodeURIComponent(currentSlug)}`;
  verifyAuth();

  try {
    const data = await apiPost({ action: "getStoreConfig", shopId: currentSlug });
    if (!data.store) throw new Error("Store profile is unavailable.");
    const s = data.store;
    merchantStoreConfig = s;
    ensureMerchantExtraSections();
    renderMerchantPricing(s.pricing || []);
    if ($("dash-shop-name")) $("dash-shop-name").textContent = s.shopName || currentSlug;
    if ($("page-title")) $("page-title").textContent = `${s.shopName || currentSlug} | Dashboard`;
    if ($("merchant-review-url")) $("merchant-review-url").value = s.reviewUrl || "";
    if ($("merchant-phone")) $("merchant-phone").value = s.ownerMobile || "";
    if (statusToggle) statusToggle.checked = s.isOpen !== false;
    if (statusCard) statusCard.classList.toggle("closed", s.isOpen === false);
    if (statusHeadline) statusHeadline.textContent = s.isOpen === false ? "STORE IS CLOSED" : "STORE IS OPEN";
    if ($("closing-time-input")) $("closing-time-input").value = s.closingTime || "9:00 PM";
    if ($("promo-toggle")) $("promo-toggle").checked = !!s.promoEnabled;
    if ($("promo-headline-input")) $("promo-headline-input").value = s.promoHeadline || "";
    if ($("promo-code-input")) $("promo-code-input").value = s.promoCode || "";
    if ($("promo-desc-input")) $("promo-desc-input").value = s.promoDescription || "";
    if ($("stat-today-visits")) $("stat-today-visits").textContent = s.totalCustomers || "0";
    if ($("stat-total-customers")) $("stat-total-customers").textContent = s.totalCustomers || "0";
  } catch (err) {
    console.warn("Unable to load store configuration:", err);
    showToast(err.message || "Unable to load store data.", true);
  }
  if (merchantToken) {
    ensureMerchantExtraSections();
    await loadMerchantCustomers();
    if (merchantCustomerTimer) clearInterval(merchantCustomerTimer);
    merchantCustomerTimer = setInterval(() => { if (merchantToken && !document.hidden) loadMerchantCustomers(); }, 15000);
  }
}

const unlockBtn = $("btn-unlock");
if (unlockBtn) {
  unlockBtn.addEventListener("click", async () => {
    const pin = $("pin-input") ? $("pin-input").value.trim() : "";
    if (!/^\d{4}$/.test(pin)) return showToast("Please enter a 4-digit PIN.", true);
    unlockBtn.disabled = true;
    unlockBtn.textContent = "Verifying...";
    try {
      const result = await apiPost({ action: "verifyMerchantPin", shopId: currentSlug, pin });
      if (!result.authorized || !result.sessionToken) throw new Error(result.message || "PIN verification failed.");
      merchantToken = result.sessionToken;
      sessionStorage.setItem(`merchant_auth_${currentSlug}`, merchantToken);
      if ($("auth-backdrop")) $("auth-backdrop").classList.remove("active");
      ensureMerchantExtraSections();
      await loadMerchantCustomers();
      if (merchantCustomerTimer) clearInterval(merchantCustomerTimer);
      merchantCustomerTimer = setInterval(() => { if (merchantToken && !document.hidden) loadMerchantCustomers(); }, 15000);
      showToast("Dashboard unlocked successfully.");
    } catch (err) {
      showToast(err.message || "Verification error. Check your connection.", true);
      if ($("pin-input")) { $("pin-input").value = ""; $("pin-input").focus(); }
    } finally {
      unlockBtn.disabled = false;
      unlockBtn.textContent = "Unlock Dashboard";
    }
  });
}

if ($("pin-input")) $("pin-input").addEventListener("keydown", e => { if (e.key === "Enter" && unlockBtn) unlockBtn.click(); });
if ($("btn-logout")) $("btn-logout").addEventListener("click", () => {
  sessionStorage.removeItem(`merchant_auth_${currentSlug}`);
  merchantToken = "";
  location.reload();
});

if ($("save-status-btn")) {
  $("save-status-btn").addEventListener("click", async () => {
    if (!merchantToken) return showToast("Unlock the dashboard again.", true);
    const btn = $("save-status-btn");
    btn.disabled = true;
    const idle = btn.innerHTML;
    btn.textContent = "Saving...";
    try {
      await apiPost({
        action: "updateStoreStatus", shopId: currentSlug, merchantToken,
        isOpen: !!(statusToggle && statusToggle.checked),
        closingTime: $("closing-time-input") ? $("closing-time-input").value.trim() : "9:00 PM"
      });
      showToast("Live store status updated.");
    } catch (err) {
      if (/session expired/i.test(err.message)) {
        sessionStorage.removeItem(`merchant_auth_${currentSlug}`);
        merchantToken = "";
      }
      showToast(err.message || "Update failed. Please try again.", true);
    } finally {
      btn.disabled = false;
      btn.innerHTML = idle;
    }
  });
}

if ($("save-promo-btn")) {
  $("save-promo-btn").addEventListener("click", async () => {
    if (!merchantToken) return showToast("Unlock the dashboard again.", true);
    const btn = $("save-promo-btn");
    btn.disabled = true;
    try {
      await apiPost({
        action: "updateMerchantPromo", shopId: currentSlug, merchantToken,
        promoEnabled: !!($("promo-toggle") && $("promo-toggle").checked),
        promoHeadline: $("promo-headline-input") ? $("promo-headline-input").value.trim() : "",
        promoCode: $("promo-code-input") ? $("promo-code-input").value.trim() : "",
        promoDescription: $("promo-desc-input") ? $("promo-desc-input").value.trim() : ""
      });
      showToast("Offer settings saved to Google Sheets.");
    } catch (err) {
      showToast(err.message || "Unable to save offer settings.", true);
    } finally { btn.disabled = false; }
  });
}

if ($("save-profile-btn")) {
  $("save-profile-btn").addEventListener("click", async () => {
    if (!merchantToken) return showToast("Unlock the dashboard again.", true);
    const btn = $("save-profile-btn");
    btn.disabled = true;
    try {
      await apiPost({
        action: "updateMerchantProfile", shopId: currentSlug, merchantToken,
        reviewUrl: $("merchant-review-url") ? $("merchant-review-url").value.trim() : "",
        ownerMobile: $("merchant-phone") ? $("merchant-phone").value.trim() : ""
      });
      showToast("Contact details saved to Google Sheets.");
    } catch (err) {
      showToast(err.message || "Unable to save contact details.", true);
    } finally { btn.disabled = false; }
  });
}

if ($("btn-refresh")) $("btn-refresh").addEventListener("click", () => {
  showToast("Refreshing latest numbers...");
  if (merchantToken) loadMerchantCustomers();
  setTimeout(() => location.reload(), 400);
});

window.addEventListener("DOMContentLoaded", initDashboard);
