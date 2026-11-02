// ==========================================
// ENTERPRISE B2B ADMIN ENGINE (admin.js)
// Zero Browser Alerts + Step Validation + Master-Sheet Sync
// ==========================================

const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwHdc634lNNW6UkZXPK2tYBSL8ImSPTxHeD3EROsbe8k4Vfguy4If3g8HSfoVESnEtF/exec";
const BASE_DOMAIN = "https://customer-connect-desk.pages.dev";

let currentUser = { name: "", email: "", sessionToken: "" };
let allStoresCache = [];
let pendingDeleteSlug = null;
let statusFilter = "ALL";
let toastTimer = null;
let lastFocus = null;

const $ = id => document.getElementById(id);
const ico = name => `<svg class="i" aria-hidden="true"><use href="#i-${name}"/></svg>`;
const esc = v => String(v == null ? "" : v).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function ensureHomeContentField() {
  const about = $('edit-store-about');
  if (!about) return;
  if (!$('edit-store-home')) {
    const label = document.createElement('label');
    label.textContent = 'Home Page Introduction (separate paragraphs with a blank line)';
    const area = document.createElement('textarea');
    area.id = 'edit-store-home'; area.className = 'form-input'; area.rows = 4;
    area.placeholder = 'Welcome to our shop...';
    area.style.cssText = 'width:100%; margin-bottom:12px;';
    const aboutLabel = about.previousElementSibling;
    about.parentNode.insertBefore(label, aboutLabel || about);
    about.parentNode.insertBefore(area, aboutLabel || about);
  }
  if (!$('edit-store-redirect-url')) {
    const label = document.createElement('label');
    label.textContent = 'After Check-in Redirect URL (optional; HTTPS only)';
    const input = document.createElement('input');
    input.id = 'edit-store-redirect-url'; input.className = 'form-input'; input.type = 'url';
    input.placeholder = 'https://your-shop-website.example';
    input.style.cssText = 'width:100%; margin-bottom:12px;';
    about.parentNode.insertBefore(label, about);
    about.parentNode.insertBefore(input, about);
  }
  if (!$('edit-store-owner-mobile')) {
    const fields = document.createElement('div'); fields.id = 'ccd-admin-contact-fields';
    fields.innerHTML = `<label>Shop Contact Mobile</label><input id="edit-store-owner-mobile" class="form-input" type="tel" inputmode="numeric" maxlength="10" placeholder="10-digit mobile number" style="width:100%;margin-bottom:12px" /><label>Google Review URL</label><input id="edit-store-review-url" class="form-input" type="url" placeholder="https://..." style="width:100%;margin-bottom:12px" /><label>Google Maps Embed URL</label><input id="edit-store-map-url" class="form-input" type="url" placeholder="https://www.google.com/maps/embed?..." style="width:100%;margin-bottom:12px" />`;
    about.parentNode.insertBefore(fields, about);
  }
}

function ensureContentVisibilityControls() {
  const modal = $('edit-content-modal');
  if (!modal || $('ccd-content-visibility')) return;
  const saveButton = modal.querySelector('button[onclick="saveStoreContentChanges()"]');
  if (!saveButton) return;
  const block = document.createElement('section');
  block.id = 'ccd-content-visibility';
  block.style.cssText = 'margin:16px 0;padding:14px;border:1px solid #dbeafe;border-radius:12px;background:#eff6ff;color:#0f172a;';
  block.innerHTML = `<h4 style="margin:0 0 10px">Publish website sections</h4><p style="margin:0 0 10px;color:#475569;font-size:.85rem">Unpublished sections stay hidden from the public website and its navigation.</p><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:9px">${[['homeText','Home introduction'],['aboutText','About'],['services','Services'],['pricing','Pricing'],['contact','Contact']].map(([key,label])=>`<label style="display:flex;align-items:center;gap:8px;font-size:.88rem"><input type="checkbox" id="ccd-publish-${key}" />${label}</label>`).join('')}</div>`;
  saveButton.parentNode.insertBefore(block, saveButton);
}

function ensureGlobalPolicyEditor() {
  if ($('btn-global-policies')) return;
  const anchor = $('btn-top-add') || $('btn-refresh-overview');
  if (!anchor) return;
  const btn = document.createElement('button');
  btn.id = 'btn-global-policies'; btn.type = 'button'; btn.className = 'btn-table';
  btn.textContent = 'Shared Policies';
  btn.style.cssText = 'width:auto;min-height:40px;padding:0 12px;margin-left:8px;white-space:nowrap;';
  btn.addEventListener('click', openGlobalPolicyEditor);
  anchor.insertAdjacentElement('afterend', btn);
}

async function openGlobalPolicyEditor() {
  let modal = $('ccd-global-policy-modal');
  if (!modal) {
    modal = document.createElement('div'); modal.id = 'ccd-global-policy-modal';
    modal.style.cssText = 'position:fixed;inset:0;z-index:10050;background:rgba(15,23,42,.62);display:flex;align-items:center;justify-content:center;padding:16px;';
    modal.innerHTML = `<section style="width:min(720px,100%);max-height:90vh;overflow:auto;background:#fff;color:#0f172a;border-radius:16px;padding:20px;box-shadow:0 20px 60px rgba(0,0,0,.25)"><div style="display:flex;justify-content:space-between;align-items:center;gap:12px"><h2 style="margin:0">Shared Policies for All Shops</h2><button id="ccd-policy-close" type="button" style="border:0;background:#e2e8f0;border-radius:8px;padding:8px 12px">Close</button></div><p style="color:#64748b;font-size:.9rem">Edit once here. These policies are shared across all shop websites.</p><label>Privacy Policy</label><textarea id="ccd-policy-privacy" rows="4" style="width:100%;margin:6px 0 14px;padding:10px;border:1px solid #cbd5e1;border-radius:8px"></textarea><label>Terms &amp; Conditions</label><textarea id="ccd-policy-terms" rows="4" style="width:100%;margin:6px 0 14px;padding:10px;border:1px solid #cbd5e1;border-radius:8px"></textarea><label>Cookie Policy</label><textarea id="ccd-policy-cookies" rows="3" style="width:100%;margin:6px 0 14px;padding:10px;border:1px solid #cbd5e1;border-radius:8px"></textarea><label>FAQ (one question and answer per line, separated by |)</label><textarea id="ccd-policy-faq" rows="5" placeholder="How do I contact the shop? | Use the Contact page." style="width:100%;margin:6px 0 14px;padding:10px;border:1px solid #cbd5e1;border-radius:8px"></textarea><button id="ccd-policy-save" type="button" style="width:100%;padding:12px;border:0;border-radius:9px;background:#2563eb;color:#fff;font-weight:700">Save Shared Policies</button></section>`;
    document.body.appendChild(modal);
    $('ccd-policy-close').addEventListener('click', () => modal.remove());
    $('ccd-policy-save').addEventListener('click', saveGlobalPolicies);
  }
  try {
    const result = await apiCall({ action: 'getGlobalPolicies' });
    const policies = result.policies || {};
    $('ccd-policy-privacy').value = policies.privacy || '';
    $('ccd-policy-terms').value = policies.terms || '';
    $('ccd-policy-cookies').value = policies.cookies || '';
    $('ccd-policy-faq').value = (policies.faq || []).map(item => `${item.q || ''} | ${item.a || ''}`).join('\n');
  } catch (err) { showDbToast(err.message || 'Unable to load shared policies.', true); }
}

async function saveGlobalPolicies() {
  const faq = $('ccd-policy-faq').value.split('\n').map(line => line.trim()).filter(Boolean).map(line => {
    const parts = line.split('|'); return { q: (parts.shift() || '').trim(), a: parts.join('|').trim() };
  }).filter(item => item.q && item.a);
  const btn = $('ccd-policy-save'); btn.disabled = true; btn.textContent = 'Saving…';
  try {
    const result = await apiCall({ action: 'updateGlobalPolicies', policies: {
      privacy: $('ccd-policy-privacy').value.trim(), terms: $('ccd-policy-terms').value.trim(),
      cookies: $('ccd-policy-cookies').value.trim(), faq
    }});
    if (result.status !== 'success') throw new Error(result.message || 'Policies were not saved.');
    showDbToast('Shared policies saved for all shops.');
    $('ccd-global-policy-modal').remove();
  } catch (err) { showDbToast(err.message || 'Unable to save shared policies.', true); }
  finally { if (btn) { btn.disabled = false; btn.textContent = 'Save Shared Policies'; } }
}

async function openStoreContentEditor(slug) {
  ensureHomeContentField();
  ensureContentVisibilityControls();
  ensureGlobalPolicyEditor();
  $('edit-store-slug').value = slug;
  $('edit-modal-title').textContent = `Editing Content: ${slug}`;
  $('edit-services-list').innerHTML = '';
  $('edit-pricing-list').innerHTML = '';
  try {
    const data = await apiCall({ action: 'getStoreContentAdmin', slug, shopId: slug });
    if (data.status !== 'success' || !data.store) throw new Error(data.message || 'Store content could not be loaded.');
    const store = data.store, content = data.content || {}, visibility = data.visibility || {};
    $('edit-store-tagline').value = content.tagline || store.tagline || '';
    $('edit-store-address').value = content.address || '';
    if ($('edit-store-home')) $('edit-store-home').value = content.homeText || '';
    if ($('edit-store-redirect-url')) $('edit-store-redirect-url').value = store.redirectUrl || '';
    if ($('edit-store-owner-mobile')) $('edit-store-owner-mobile').value = store.ownerMobile || '';
    if ($('edit-store-review-url')) $('edit-store-review-url').value = store.reviewUrl || '';
    if ($('edit-store-map-url')) $('edit-store-map-url').value = store.mapEmbedUrl || '';
    $('edit-store-banners').value = (content.banners || []).join('\n');
    $('edit-store-about').value = content.aboutText || '';
    (content.services || []).forEach(item => addServiceRow(item.icon, item.title, item.desc));
    (content.pricing || []).forEach(item => addPricingRow(item.item, item.price, item.desc));
    const defaults = { homeText: !!content.homeText, aboutText: !!content.aboutText, services: !!(content.services || []).length, pricing: !!(content.pricing || []).length, contact: true };
    Object.keys(defaults).forEach(key => { const checkbox = $(`ccd-publish-${key}`); if (checkbox) checkbox.checked = visibility[key] === undefined ? defaults[key] : visibility[key] === true; });
    $('edit-content-modal').hidden = false;
  } catch (err) {
    showDbToast(err.message || 'Unable to load store content.', true);
  }
}
function addServiceRow(icon = "🔑", title = "", desc = "") {
  const div = document.createElement("div");
  div.className = "service-edit-row";
  div.style.cssText = "display:flex; gap:8px; margin-bottom:8px;";
  div.innerHTML = `
    <input type="text" class="form-input s-icon" value="${esc(icon)}" style="width:50px;" />
    <input type="text" class="form-input s-title" value="${esc(title)}" placeholder="Title" style="flex:1;" />
    <input type="text" class="form-input s-desc" value="${esc(desc)}" placeholder="Description" style="flex:2;" />
    <button type="button" onclick="this.parentElement.remove()" style="background:#ef4444; border:none; color:#fff; border-radius:6px; padding:0 8px; cursor:pointer;">&times;</button>
  `;
  $("edit-services-list").appendChild(div);
}

function addPricingRow(item = "", price = "₹", desc = "") {
  const div = document.createElement("div");
  div.className = "pricing-edit-row";
  div.style.cssText = "display:flex; gap:8px; margin-bottom:8px;";
  div.innerHTML = `
    <input type="text" class="form-input p-item" value="${esc(item)}" placeholder="Item Name" style="flex:2;" />
    <input type="text" class="form-input p-price" value="${esc(price)}" placeholder="Price" style="width:80px;" />
    <input type="text" class="form-input p-desc" value="${esc(desc)}" placeholder="Brief detail" style="flex:2;" />
    <button type="button" onclick="this.parentElement.remove()" style="background:#ef4444; border:none; color:#fff; border-radius:6px; padding:0 8px; cursor:pointer;">&times;</button>
  `;
  $("edit-pricing-list").appendChild(div);
}

async function saveStoreContentChanges() {
  const slug = $("edit-store-slug").value;
  const banners = $("edit-store-banners").value.split("\n").map(s => s.trim()).filter(Boolean);
  const services = Array.from(document.querySelectorAll(".service-edit-row")).map(row => ({
    icon: row.querySelector(".s-icon").value.trim(),
    title: row.querySelector(".s-title").value.trim(),
    desc: row.querySelector(".s-desc").value.trim()
  })).filter(s => s.title);
  const pricing = Array.from(document.querySelectorAll(".pricing-edit-row")).map(row => ({
    item: row.querySelector(".p-item").value.trim(),
    price: row.querySelector(".p-price").value.trim(),
    desc: row.querySelector(".p-desc").value.trim()
  })).filter(p => p.item);
  const payload = {
    action: "updateStoreContent", slug,
    tagline: $("edit-store-tagline").value.trim(),
    address: $("edit-store-address").value.trim(),
    homeText: $("edit-store-home") ? $("edit-store-home").value.trim() : "",
    aboutText: $("edit-store-about").value.trim(),
    redirectUrl: $("edit-store-redirect-url") ? $("edit-store-redirect-url").value.trim() : "",
    ownerMobile: $("edit-store-owner-mobile") ? $("edit-store-owner-mobile").value.trim() : "",
    reviewUrl: $("edit-store-review-url") ? $("edit-store-review-url").value.trim() : "",
    mapEmbedUrl: $("edit-store-map-url") ? $("edit-store-map-url").value.trim() : "",
    banners, services, pricing,
    visibility: {
      homeText: !!$("ccd-publish-homeText")?.checked,
      aboutText: !!$("ccd-publish-aboutText")?.checked,
      services: !!$("ccd-publish-services")?.checked,
      pricing: !!$("ccd-publish-pricing")?.checked,
      contact: !!$("ccd-publish-contact")?.checked
    }
  };
  try {
    const result = await apiCall(payload);
    if (result.status !== "success") throw new Error(result.message || "Store content was not saved.");
    showDbToast("Store content saved successfully.");
    closeEditContentModal();
  } catch (err) {
    showDbToast(err.message || "Unable to save store content.", true);
  }
}

function closeEditContentModal() { $("edit-content-modal").hidden = true; }

function showDbToast(msg, isError = false) {
  const toast = $("db-toast");
  if (!toast) return;
  toast.classList.toggle("is-error", isError);
  toast.innerHTML = `<span class="toast-icon">${ico(isError ? "alert" : "check")}</span><span class="toast-msg"></span>`;
  toast.querySelector(".toast-msg").textContent = msg;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 4200);
}

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", theme === "dark" ? "#000000" : "#ffffff");
  if ($("theme-icon")) $("theme-icon").textContent = theme === "dark" ? "Light" : "Dark";
}

const themeBtn = $("theme-toggle-btn");
if (themeBtn) themeBtn.addEventListener("click", () => {
  const currentTheme = document.documentElement.getAttribute("data-theme") || "light";
  const newTheme = currentTheme === "dark" ? "light" : "dark";
  localStorage.setItem("ccd_theme", newTheme);
  applyTheme(newTheme);
});
(function initTheme() { applyTheme(localStorage.getItem("ccd_theme") || "light"); })();

document.querySelectorAll(".nav-item").forEach(btn => btn.addEventListener("click", () => {
  document.querySelectorAll(".nav-item").forEach(b => b.classList.remove("active"));
  document.querySelectorAll(".tab-pane").forEach(p => p.classList.remove("active"));
  btn.classList.add("active");
  const target = btn.getAttribute("data-tab");
  if ($(target)) $(target).classList.add("active");
  window.scrollTo({ top: 0 });
}));

if ($("btn-top-add")) $("btn-top-add").addEventListener("click", () => {
  const tab = document.querySelector('[data-tab="tab-wizard"]');
  if (tab) tab.click();
});

function setAccountMenu(open) {
  const menu = $("account-menu"), btn = $("btn-account");
  if (!menu || !btn) return;
  menu.hidden = !open;
  btn.setAttribute("aria-expanded", String(open));
}
if ($("btn-account")) $("btn-account").addEventListener("click", e => {
  e.stopPropagation();
  setAccountMenu($("account-menu").hidden);
});
document.addEventListener("click", e => { if (!e.target.closest(".account")) setAccountMenu(false); });

function flagInvalid(id, msg) {
  showDbToast(msg, true);
  const el = $(id);
  if (el) { el.classList.add("is-invalid"); el.setAttribute("aria-invalid", "true"); el.focus(); }
}

document.querySelectorAll("#wizard-form input").forEach(inp => inp.addEventListener("input", () => {
  inp.classList.remove("is-invalid");
  inp.removeAttribute("aria-invalid");
}));

window.goToStep = function(targetStep) {
  const activeSec = document.querySelector(".wizard-section.active");
  const currentStepId = activeSec ? activeSec.id : "wizard-sec-1";
  if (currentStepId === "wizard-sec-1" && targetStep > 1) {
    const slug = $("shop-id").value.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
    const shopName = $("shop-name").value.trim();
    const tagline = $("shop-tagline").value.trim();
    if (!slug || slug.length < 3) return flagInvalid("shop-id", "Store slug must be at least 3 letters/numbers");
    if (!shopName) return flagInvalid("shop-name", "Store display name is required");
    if (!tagline) return flagInvalid("shop-tagline", "Business tagline is required");
  }
  if (currentStepId === "wizard-sec-2" && targetStep > 2) {
    const ownerName = $("owner-name").value.trim();
    const email = $("owner-email").value.trim().toLowerCase();
    const mobile = $("shop-mobile").value.trim().replace(/\D/g, "");
    if (!ownerName) return flagInvalid("owner-name", "Owner full name is required");
    if (!email || !email.includes("@")) return flagInvalid("owner-email", "Valid owner email address is required");
    if (mobile.length !== 10) return flagInvalid("shop-mobile", "Valid 10-digit mobile number required");
  }
  document.querySelectorAll(".step-item").forEach(item => {
    const num = parseInt(item.getAttribute("data-step"));
    item.classList.toggle("active", num <= targetStep);
    item.classList.toggle("current", num === targetStep);
    if (num === targetStep) item.setAttribute("aria-current", "step");
    else item.removeAttribute("aria-current");
  });
  document.querySelectorAll(".wizard-section").forEach(sec => sec.classList.remove("active"));
  const nextSec = $(`wizard-sec-${targetStep}`);
  if (nextSec) nextSec.classList.add("active");
  if ($("wizard-heading")) $("wizard-heading").scrollIntoView({ block: "start", behavior: "smooth" });
};

function handleWizardEnterKey() {
  const wizardForm = $("wizard-form");
  if (!wizardForm) return;
  wizardForm.querySelectorAll("input").forEach(input => input.addEventListener("keydown", e => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const activeSec = document.querySelector(".wizard-section.active");
    if (!activeSec) return;
    if (activeSec.id === "wizard-sec-1") goToStep(2);
    else if (activeSec.id === "wizard-sec-2") goToStep(3);
    else if (activeSec.id === "wizard-sec-3") $("btn-save-store").click();
  }));
}

if ($("btn-toggle-eye")) $("btn-toggle-eye").addEventListener("click", () => {
  const input = $("admin-pass");
  const show = input.type === "password";
  input.type = show ? "text" : "password";
  $("btn-toggle-eye").setAttribute("aria-pressed", String(show));
  $("btn-toggle-eye").setAttribute("aria-label", show ? "Hide password" : "Show password");
});

function parseJwt(token) {
  try {
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(decodeURIComponent(atob(base64).split("").map(c => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2)).join("")));
  } catch (e) { return null; }
}

async function apiCall(body) {
  const payload = Object.assign({}, body);
  if (payload.action !== "adminAuth" && currentUser.sessionToken) payload.adminToken = currentUser.sessionToken;
  const formPayload = new URLSearchParams();
  formPayload.append("postData", JSON.stringify(payload));
  const res = await fetch(SCRIPT_URL, { method: "POST", body: formPayload, redirect: "follow" });
  const responseText = await res.text();
  try { return JSON.parse(responseText); }
  catch (err) { throw new Error("Invalid server response: " + responseText.slice(0, 100)); }
}

function setAuthLoading(on) {
  const card = document.querySelector(".auth-gate-card");
  if (card) card.classList.toggle("is-loading", on);
  if ($("auth-status")) $("auth-status").hidden = !on;
}

window.handleAdminLogin = async function(response) {
  const payload = parseJwt(response.credential);
  if (!payload || !payload.email || !response.credential) return;
  const enteredPass = $("admin-pass") ? $("admin-pass").value.trim() : "";
  setAuthLoading(true);
  try {
    const authData = await apiCall({ action: "adminAuth", idToken: response.credential, email: payload.email, password: enteredPass });
    if (authData.status !== "success" || !authData.sessionToken) {
      showDbToast(authData.message || "Access denied.", true);
      return;
    }
    currentUser.name = payload.name || "Super Admin";
    currentUser.email = payload.email.toLowerCase();
    currentUser.sessionToken = authData.sessionToken;
    if ($("user-name")) $("user-name").textContent = currentUser.name;
    if ($("user-email")) $("user-email").textContent = currentUser.email;
    $("auth-gate-overlay").classList.add("hidden");
    showDbToast(`Authenticated as Super-Admin: ${currentUser.email}`);
    loadDashboardData();
  } catch (err) {
    showDbToast("Authentication failed: " + err.message, true);
  } finally { setAuthLoading(false); }
};

function setSyncState(ok) {
  const v = $("stat-sync-state"), t = $("stat-sync-time");
  if (v) { v.textContent = ok ? "Connected" : "Unreachable"; v.classList.toggle("is-error", !ok); }
  if (t) t.textContent = ok ? "Last synced " + new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "Last attempt failed. Try refreshing.";
}

async function loadDashboardData() {
  const refreshBtn = $("btn-refresh-overview");
  if (refreshBtn) { refreshBtn.classList.add("is-loading"); refreshBtn.disabled = true; }
  if (!allStoresCache.length && $("store-table-body")) $("store-table-body").innerHTML = `<tr><td colspan="5" class="table-loading"><span class="spinner"></span> Loading store registry…</td></tr>`;
  try {
    const data = await apiCall({ action: "getAdminData", email: currentUser.email });
    if (data.status !== "success") throw new Error(data.message || "Could not load store data.");
    allStoresCache = data.allStores || [];
    renderDashboard(allStoresCache);
    setSyncState(true);
  } catch (err) {
    setSyncState(false);
    if ($("store-table-body")) $("store-table-body").innerHTML = `<tr><td colspan="5" class="table-empty is-error"><strong>Couldn't load stores</strong>Check your connection, then refresh.</td></tr>`;
    showDbToast(err.message || "Error retrieving Master-Sheet data.", true);
  } finally {
    if (refreshBtn) { refreshBtn.classList.remove("is-loading"); refreshBtn.disabled = false; }
  }
}

function renderDashboard(stores) {
  if ($("badge-total-stores")) $("badge-total-stores").textContent = stores.length;
  const count = st => stores.filter(s => (s.registrationStatus || "PENDING").toUpperCase() === st).length;
  const activeCount = count("ACTIVE"), pendingCount = count("PENDING"), suspendedCount = count("SUSPENDED");
  if ($("stat-active-stores")) $("stat-active-stores").textContent = activeCount;
  if ($("stat-pending-stores")) $("stat-pending-stores").textContent = pendingCount;
  if ($("stat-suspended-stores")) $("stat-suspended-stores").textContent = suspendedCount;
  if ($("breakdown-total")) $("breakdown-total").textContent = `${stores.length} ${stores.length === 1 ? "store" : "stores"}`;
  const pct = n => stores.length ? (n / stores.length * 100) + "%" : "0%";
  if ($("seg-active")) $("seg-active").style.width = pct(activeCount);
  if ($("seg-pending")) $("seg-pending").style.width = pct(pendingCount);
  if ($("seg-suspended")) $("seg-suspended").style.width = pct(suspendedCount);
  const selector = $("qr-store-selector");
  if (selector) {
    const prev = selector.value;
    selector.innerHTML = `<option value="">-- Choose Store --</option>`;
    stores.filter(s => (s.registrationStatus || "PENDING").toUpperCase() === "ACTIVE").forEach(s => { const opt = document.createElement("option"); opt.value = s.shopId; opt.textContent = `${s.shopName} (${s.shopId})`; selector.appendChild(opt); });
    if (prev && stores.some(s => s.shopId === prev)) selector.value = prev;
  }
  renderTable();
}

function renderTable() {
  const searchInput = $("global-store-search"), query = searchInput ? searchInput.value.toLowerCase().trim() : "";
  const tbody = $("store-table-body");
  if (!tbody) return;
  const filtered = allStoresCache.filter(s => {
    const status = (s.registrationStatus || "PENDING").toUpperCase();
    if (statusFilter !== "ALL" && status !== statusFilter) return false;
    return !query || (s.shopName || "").toLowerCase().includes(query) || (s.shopId || "").toLowerCase().includes(query) || (s.ownerName || "").toLowerCase().includes(query) || (s.ownerMobile && String(s.ownerMobile).includes(query)) || (s.ownerEmail && s.ownerEmail.toLowerCase().includes(query));
  });
  if ($("store-result-count")) $("store-result-count").textContent = allStoresCache.length ? `${filtered.length} of ${allStoresCache.length}` : "";
  if (!filtered.length) {
    tbody.innerHTML = allStoresCache.length === 0
      ? `<tr><td colspan="5" class="table-empty"><strong>No stores yet</strong>No registered stores found in Master-Sheet.<br/><button class="btn-step-next" data-action="register" style="margin-top:1rem;">${ico("plus")} Register a store</button></td></tr>`
      : `<tr><td colspan="5" class="table-empty"><strong>No matching stores</strong>Try a different search or status filter.</td></tr>`;
    return;
  }
  tbody.innerHTML = "";
  filtered.forEach(s => {
    const tr = document.createElement("tr"), status = (s.registrationStatus || "PENDING").toUpperCase(), statusClass = status.toLowerCase(), id = esc(s.shopId);
    tr.innerHTML = `
      <td class="cell-store"><div class="store-name">${esc(s.shopName)}</div><code class="store-slug">${id}</code></td>
      <td data-label="Owner">${esc(s.ownerName || "Merchant")}<span class="owner-meta">📞 ${esc(s.ownerMobile || "N/A")}</span><span class="owner-meta">✉️ ${esc(s.ownerEmail || "N/A")}</span></td>
      <td data-label="Tagline">${esc(s.tagline || "—")}</td>
      <td class="cell-status"><span class="status-badge ${statusClass}">${esc(status.toLowerCase())}</span></td>
      <td class="cell-actions"><div class="table-action-btns">
        ${status !== "ACTIVE" ? `<button class="btn-table success" data-action="approve" data-id="${id}">Approve</button>` : ""}
        ${status === "ACTIVE" ? `<button class="btn-table" data-action="edit-content" data-id="${id}">Edit website</button><button class="btn-table warning" data-action="suspend" data-id="${id}">Suspend</button><button class="btn-table" data-action="qr" data-id="${id}">QR codes</button><button class="btn-table success" data-action="send-setup" data-id="${id}">Send Desk + Shop</button><button class="btn-table" data-action="send-site" data-id="${id}">Share Website</button>` : ""}
        <button class="btn-table danger" data-action="delete" data-id="${id}" data-name="${esc(s.shopName)}">Deactivate</button>
      </div></td>`;
    tbody.appendChild(tr);
  });
}

if ($("store-table-body")) $("store-table-body").addEventListener("click", e => {
  const btn = e.target.closest("button[data-action]");
  if (!btn) return;
  const { action, id, name } = btn.dataset;
  if (action === "register") { const regTab = document.querySelector('[data-tab="tab-wizard"]'); if (regTab) regTab.click(); }
  else if (action === "approve") setStatus(id, "ACTIVE");
  else if (action === "suspend") setStatus(id, "SUSPENDED");
  else if (action === "edit-content") openStoreContentEditor(id);
  else if (action === "qr") openStudioForStore(id);
  else if (action === "send-setup") sendOwnerLinks(id, true);
  else if (action === "send-site") sendOwnerLinks(id, false);
  else if (action === "delete") confirmDeleteStore(id, name);
});

if ($("global-store-search")) $("global-store-search").addEventListener("input", () => {
  if (!$(("tab-stores")).classList.contains("active")) { const tab = document.querySelector('[data-tab="tab-stores"]'); if (tab) tab.click(); }
  renderTable();
});

document.querySelectorAll(".filter-chips .chip").forEach(chip => chip.addEventListener("click", () => {
  statusFilter = chip.dataset.filter;
  document.querySelectorAll(".filter-chips .chip").forEach(c => c.classList.toggle("active", c === chip));
  renderTable();
}));

window.setStatus = async function(slug, status) {
  try {
    const res = await apiCall({ action: "setStoreRegistrationStatus", targetShopId: slug, newStatus: status });
    if (res.status !== "success") throw new Error(res.message || "Status update failed.");
    showDbToast(`Status updated: ${slug} is now ${status}`);
    loadDashboardData();
  } catch (err) { showDbToast(err.message || "Failed to update status", true); }
};

function closeModal() { $("confirm-modal").classList.remove("active"); if (lastFocus) lastFocus.focus(); }
window.confirmDeleteStore = function(slug, name) {
  pendingDeleteSlug = slug;
  lastFocus = document.activeElement;
  $("modal-title").textContent = `Deactivate store: ${name}?`;
  $("modal-desc").textContent = `This will mark '${slug}' as cancelled while preserving its visit tab and customer history. It will not permanently erase data.`;
  $("confirm-modal").classList.add("active");
  $("btn-modal-cancel").focus();
};
if ($("btn-modal-cancel")) $("btn-modal-cancel").addEventListener("click", () => { closeModal(); pendingDeleteSlug = null; });
if ($("confirm-modal")) $("confirm-modal").addEventListener("click", e => { if (e.target === $("confirm-modal")) $("btn-modal-cancel").click(); });
document.addEventListener("keydown", e => {
  if (e.key === "Escape") {
    if ($("confirm-modal") && $("confirm-modal").classList.contains("active")) $("btn-modal-cancel").click();
    setAccountMenu(false);
  }
});
if ($("btn-modal-confirm")) $("btn-modal-confirm").addEventListener("click", async () => {
  if (!pendingDeleteSlug) return;
  const target = pendingDeleteSlug;
  closeModal();
  try {
    const res = await apiCall({ action: "deleteStore", targetShopId: target });
    if (res.status === "success") { showDbToast(`Store '${target}' deactivated. Existing records were preserved.`); loadDashboardData(); }
    else showDbToast(res.message || "Deactivation failed", true);
  } catch (e) { showDbToast(e.message || "Error deactivating store", true); }
  finally { pendingDeleteSlug = null; }
});

const wizardForm = $("wizard-form");
if (wizardForm) wizardForm.addEventListener("submit", async e => {
  e.preventDefault();
  const slug = $("shop-id").value.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  const shopName = $("shop-name").value.trim(), tagline = $("shop-tagline").value.trim();
  const ownerName = $("owner-name").value.trim(), email = $("owner-email").value.trim().toLowerCase();
  const mobile = $("shop-mobile").value.trim().replace(/\D/g, "");
  if (slug.length < 3) { showDbToast("Store slug must be at least 3 letters/numbers", true); goToStep(1); return; }
  if (!shopName || !tagline) { showDbToast("Please fill all identity fields in Step 1", true); goToStep(1); return; }
  if (!ownerName || !email || mobile.length !== 10) { showDbToast("Please verify owner contact details in Step 2", true); goToStep(2); return; }
  const payload = {
    action: "registerStore", shopId: slug, shopName, tagline, ownerName, ownerEmail: email, ownerMobile: mobile,
    primaryColor: $("col-primary") ? $("col-primary").value : "#2563eb",
    bgColor: $("col-bg") ? $("col-bg").value : "#ffffff",
    cardBg: $("col-card") ? $("col-card").value : "#ffffff",
    textColor: $("col-text") ? $("col-text").value : "#0f172a",
    reviewUrl: $("shop-review-url") ? $("shop-review-url").value.trim() : "",
    mapEmbedUrl: $("shop-map-url") ? $("shop-map-url").value.trim() : "",
    closingTime: $("shop-closing-time") ? ($("shop-closing-time").value.trim() || "9:00 PM") : "9:00 PM",
    isPublicRegister: false
  };
  const btn = $("btn-save-store"), idleHtml = btn ? btn.innerHTML : "Save";
  if (btn) { btn.disabled = true; btn.innerHTML = `<span class="spinner"></span><span>Writing to Master-Sheet…</span>`; }
  try {
    const res = await apiCall(payload);
    if (res.status === "success") {
      showDbToast(`Store saved in Master-Sheet row #${res.row || ""}.`);
      wizardForm.reset(); goToStep(1); await loadDashboardData(); openStudioForStore(slug);
    } else showDbToast(res.message || "Registration failed", true);
  } catch (err) { showDbToast(err.message || "Network error syncing with Google Sheets.", true); }
  finally { if (btn) { btn.disabled = false; btn.innerHTML = idleHtml; } }
});

window.sendOwnerLinks = function(slug, includeDesk) {
  const store = allStoresCache.find(s => s.shopId === slug && (s.registrationStatus || 'PENDING').toUpperCase() === 'ACTIVE');
  if (!store) return showDbToast('Approve this shop before sending its links.', true);
  const mobile = String(store.ownerMobile || '').replace(/\D/g, '');
  if (mobile.length < 10) return showDbToast('A valid shopkeeper mobile number is missing.', true);
  const waNumber = mobile.length === 10 ? '91' + mobile : mobile;
  const deskUrl = `${BASE_DOMAIN}/desk.html?shop=${encodeURIComponent(slug)}`;
  const shopUrl = `${BASE_DOMAIN}/shop.html?shop=${encodeURIComponent(slug)}`;
  const merchantUrl = `${BASE_DOMAIN}/merchant.html?shop=${encodeURIComponent(slug)}`;
  const greeting = `Hello ${store.ownerName || 'there'}, your shop ${store.shopName || slug} is approved on Customer Connect Desk.`;
  const message = includeDesk
    ? `${greeting}\n\nCustomer Check-in Desk: ${deskUrl}\nShopkeeper Dashboard: ${merchantUrl}\nPublic Shop Website: ${shopUrl}\n\nUse the Desk link for customers visiting your shop. Open the Shopkeeper Dashboard to manage store status, offers, customer visit messages and prices. Your Desk and website QR codes are available in the Admin dashboard.`
    : `Hello ${store.ownerName || 'there'}, your ${store.shopName || slug} website is ready to share:\n${shopUrl}\n\nShopkeeper Dashboard: ${merchantUrl}\n\nThank you for using Customer Connect Desk.`;
  const url = `https://wa.me/${waNumber}?text=${encodeURIComponent(message)}`;
  window.open(url, '_blank', 'noopener,noreferrer');
};

window.openStudioForStore = function(slug) {
  const qrTab = document.querySelector('[data-tab="tab-qr"]');
  if (qrTab) qrTab.click();
  const selector = $("qr-store-selector");
  if (selector) selector.value = slug;
  renderQrStudio(slug);
};
if ($("qr-store-selector")) $("qr-store-selector").addEventListener("change", e => renderQrStudio(e.target.value));

function renderQrStudio(slug) {
  const standBox = $("box-stand-qr"), publicBox = $("box-public-qr");
  if (!standBox || !publicBox) return;
  standBox.innerHTML = ""; publicBox.innerHTML = "";
  ["btn-copy-stand", "btn-dl-stand", "btn-copy-public", "btn-dl-public"].forEach(id => { if ($(id)) $(id).disabled = !slug; });
  if (!slug) {
    if ($("chip-stand-url")) $("chip-stand-url").textContent = "Select a store to view URL";
    if ($("chip-public-url")) $("chip-public-url").textContent = "Select a store to view URL";
    return;
  }
  const approvedStore = allStoresCache.find(s => s.shopId === slug && (s.registrationStatus || "PENDING").toUpperCase() === "ACTIVE");
  if (!approvedStore) {
    if ($("chip-stand-url")) $("chip-stand-url").textContent = "QR is available after Admin approval";
    if ($("chip-public-url")) $("chip-public-url").textContent = "QR is available after Admin approval";
    ["btn-copy-stand", "btn-dl-stand", "btn-copy-public", "btn-dl-public"].forEach(id => { if ($(id)) $(id).disabled = true; });
    return;
  }
  const standUrl = `${BASE_DOMAIN}/desk.html?shop=${encodeURIComponent(slug)}`;
  const publicUrl = `${BASE_DOMAIN}/shop.html?shop=${encodeURIComponent(slug)}`;
  if ($("chip-stand-url")) $("chip-stand-url").textContent = standUrl;
  if ($("chip-public-url")) $("chip-public-url").textContent = publicUrl;
  new QRCode(standBox, { text: standUrl, width: 220, height: 220, correctLevel: QRCode.CorrectLevel.M });
  new QRCode(publicBox, { text: publicUrl, width: 220, height: 220, correctLevel: QRCode.CorrectLevel.M });
}

window.copyStudioLink = async function(type) {
  const chip = $(`chip-${type}-url`), text = chip ? chip.textContent : "";
  if (!text || text.includes("Select a store")) return;
  try { await navigator.clipboard.writeText(text); showDbToast("Link copied to clipboard!"); }
  catch (err) { showDbToast("Couldn't copy automatically. Tap and hold the URL to copy.", true); }
};

window.downloadStudioQr = function(type) {
  const box = document.querySelector(`#box-${type}-qr`);
  if (!box) return;
  const canvas = box.querySelector("canvas"), img = box.querySelector("img");
  let href = null;
  if (canvas) { try { href = canvas.toDataURL("image/png"); } catch (e) {} }
  if (!href && img && img.src && img.src.startsWith("data:")) href = img.src;
  if (href) {
    const a = document.createElement("a"); a.href = href; a.download = `${type}-qr-stand.png`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); showDbToast("QR Code downloaded.");
  } else showDbToast("QR Code rendering, please try again in a moment.", true);
};

if ($("btn-refresh-overview")) $("btn-refresh-overview").addEventListener("click", () => { showDbToast("Refreshing Master-Sheet data..."); loadDashboardData(); });
if ($("btn-logout")) $("btn-logout").addEventListener("click", () => { currentUser.sessionToken = ""; location.reload(); });
window.addEventListener("DOMContentLoaded", () => { handleWizardEnterKey(); ensureGlobalPolicyEditor(); });
