// ==========================================
// ENTERPRISE B2B ADMIN ENGINE (admin.js)
// Zero Browser Alerts + Step Validation + Master-Sheet Sync
// ==========================================

const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyq5CbrZ5VzrFEcBh-gfs3iy5UewHoNfJT7ZtLxhHXhhW_bs7R_a0roSqYbZehydJCn/exec";
const BASE_DOMAIN = "https://customer-connect-desk.pages.dev";

let currentUser = { name: "", email: "" };
let allStoresCache = [];
let pendingDeleteSlug = null;
let statusFilter = "ALL";
let toastTimer = null;
let lastFocus = null;

const $ = id => document.getElementById(id);
const ico = name => `<svg class="i" aria-hidden="true"><use href="#i-${name}"/></svg>`;
// Escapes HTML special characters to prevent broken markup and XSS
const esc = v => String(v == null ? "" : v).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));


// Opens editor and pre-populates existing data
async function openStoreContentEditor(slug) {
  $("edit-store-slug").value = slug;
  $("edit-modal-title").textContent = `Editing Content: ${slug}`;
  $("edit-services-list").innerHTML = "";
  $("edit-pricing-list").innerHTML = "";

  const res = await fetch(SCRIPT_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ action: "getStoreConfig", slug: slug, shopId: slug })
  });
  const data = await res.json();
  const store = data.store;

  if (store) {
    $("edit-store-tagline").value = store.tagline || "";
    $("edit-store-address").value = store.address || "";
    $("edit-store-banners").value = (store.banners || []).join("\n");
    $("edit-store-about").value = store.aboutText || "";

    (store.services || []).forEach(s => addServiceRow(s.icon, s.title, s.desc));
    (store.pricing || []).forEach(p => addPricingRow(p.item, p.price, p.desc));
  }

  $("edit-content-modal").hidden = false;
}

function addServiceRow(icon = "🔑", title = "", desc = "") {
  const div = document.createElement("div");
  div.className = "service-edit-row";
  div.style.cssText = "display:flex; gap:8px; margin-bottom:8px;";
  div.innerHTML = `
    <input type="text" class="form-input s-icon" value="${icon}" style="width:50px;" />
    <input type="text" class="form-input s-title" value="${title}" placeholder="Title" style="flex:1;" />
    <input type="text" class="form-input s-desc" value="${desc}" placeholder="Description" style="flex:2;" />
    <button type="button" onclick="this.parentElement.remove()" style="background:#ef4444; border:none; color:#fff; border-radius:6px; padding:0 8px; cursor:pointer;">&times;</button>
  `;
  $("edit-services-list").appendChild(div);
}

function addPricingRow(item = "", price = "₹", desc = "") {
  const div = document.createElement("div");
  div.className = "pricing-edit-row";
  div.style.cssText = "display:flex; gap:8px; margin-bottom:8px;";
  div.innerHTML = `
    <input type="text" class="form-input p-item" value="${item}" placeholder="Item Name" style="flex:2;" />
    <input type="text" class="form-input p-price" value="${price}" placeholder="Price" style="width:80px;" />
    <input type="text" class="form-input p-desc" value="${desc}" placeholder="Brief detail" style="flex:2;" />
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
    action: "updateStoreContent",
    slug: slug,
    tagline: $("edit-store-tagline").value.trim(),
    address: $("edit-store-address").value.trim(),
    aboutText: $("edit-store-about").value.trim(),
    banners: banners,
    services: services,
    pricing: pricing
  };

  await fetch(SCRIPT_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload)
  });

  alert("Store content updated!");
  closeEditContentModal();
}

function closeEditContentModal() {
  $("edit-content-modal").hidden = true;
}



// 1. Toast Notification System
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

// 2. Theme Toggle (Dark / Light)
function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", theme === "dark" ? "#000000" : "#ffffff");
  if ($("theme-icon")) $("theme-icon").textContent = theme === "dark" ? "Light" : "Dark";
}

const themeBtn = $("theme-toggle-btn");
if (themeBtn) {
  themeBtn.addEventListener("click", () => {
    const currentTheme = document.documentElement.getAttribute("data-theme") || "dark";
    const newTheme = currentTheme === "dark" ? "light" : "dark";
    localStorage.setItem("ccd_theme", newTheme);
    applyTheme(newTheme);
  });
}

(function initTheme() {
  applyTheme(localStorage.getItem("ccd_theme") || "dark");
})();

// 3. Navigation & Tab Switching
document.querySelectorAll(".nav-item").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".nav-item").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".tab-pane").forEach(p => p.classList.remove("active"));
    btn.classList.add("active");
    const target = btn.getAttribute("data-tab");
    if ($(target)) $(target).classList.add("active");
    window.scrollTo({ top: 0 });
  });
});

if ($("btn-top-add")) {
  $("btn-top-add").addEventListener("click", () => {
    document.querySelector('[data-tab="tab-wizard"]').click();
  });
}

// Account Menu Controls
function setAccountMenu(open) {
  const menu = $("account-menu");
  const btn = $("btn-account");
  if (!menu || !btn) return;
  menu.hidden = !open;
  btn.setAttribute("aria-expanded", String(open));
}

if ($("btn-account")) {
  $("btn-account").addEventListener("click", e => {
    e.stopPropagation();
    setAccountMenu($("account-menu").hidden);
  });
}

document.addEventListener("click", e => {
  if (!e.target.closest(".account")) setAccountMenu(false);
});

// 4. Strict Stepper Navigation with Validation & Visual Hints
function flagInvalid(id, msg) {
  showDbToast(msg, true);
  const el = $(id);
  if (el) {
    el.classList.add("is-invalid");
    el.setAttribute("aria-invalid", "true");
    el.focus();
  }
}

document.querySelectorAll("#wizard-form input").forEach(inp => {
  inp.addEventListener("input", () => {
    inp.classList.remove("is-invalid");
    inp.removeAttribute("aria-invalid");
  });
});

window.goToStep = function(targetStep) {
  const activeSec = document.querySelector(".wizard-section.active");
  const currentStepId = activeSec ? activeSec.id : "wizard-sec-1";

  // Prevent moving past Step 1 if Identity fields are incomplete
  if (currentStepId === "wizard-sec-1" && targetStep > 1) {
    const slug = $("shop-id").value.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    const shopName = $("shop-name").value.trim();
    const tagline = $("shop-tagline").value.trim();

    if (!slug || slug.length < 3) return flagInvalid("shop-id", "Store slug must be at least 3 letters/numbers");
    if (!shopName) return flagInvalid("shop-name", "Store display name is required");
    if (!tagline) return flagInvalid("shop-tagline", "Business tagline is required");
  }

  // Prevent moving past Step 2 if Contact fields are incomplete
  if (currentStepId === "wizard-sec-2" && targetStep > 2) {
    const ownerName = $("owner-name").value.trim();
    const email = $("owner-email").value.trim().toLowerCase();
    const mobile = $("shop-mobile").value.trim().replace(/\D/g, '');

    if (!ownerName) return flagInvalid("owner-name", "Owner full name is required");
    if (!email || !email.includes('@')) return flagInvalid("owner-email", "Valid owner email address is required");
    if (mobile.length !== 10) return flagInvalid("shop-mobile", "Valid 10-digit mobile number required");
  }

  // Update indicators
  document.querySelectorAll(".step-item").forEach(item => {
    const num = parseInt(item.getAttribute("data-step"));
    item.classList.toggle("active", num <= targetStep);
    item.classList.toggle("current", num === targetStep);
    if (num === targetStep) item.setAttribute("aria-current", "step");
    else item.removeAttribute("aria-current");
  });

  // Switch visible section
  document.querySelectorAll(".wizard-section").forEach(sec => sec.classList.remove("active"));
  const nextSec = $(`wizard-sec-${targetStep}`);
  if (nextSec) nextSec.classList.add("active");
  if ($("wizard-heading")) $("wizard-heading").scrollIntoView({ block: "start", behavior: "smooth" });
};

// 5. Intercept "Enter" Key
function handleWizardEnterKey() {
  const wizardForm = $("wizard-form");
  if (!wizardForm) return;

  wizardForm.querySelectorAll("input").forEach(input => {
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        const activeSec = document.querySelector(".wizard-section.active");
        if (!activeSec) return;

        if (activeSec.id === "wizard-sec-1") {
          goToStep(2);
        } else if (activeSec.id === "wizard-sec-2") {
          goToStep(3);
        } else if (activeSec.id === "wizard-sec-3") {
          $("btn-save-store").click();
        }
      }
    });
  });
}

// 6. Password Eye Toggle
if ($("btn-toggle-eye")) {
  $("btn-toggle-eye").addEventListener("click", () => {
    const input = $("admin-pass");
    const show = input.type === "password";
    input.type = show ? "text" : "password";
    $("btn-toggle-eye").setAttribute("aria-pressed", String(show));
    $("btn-toggle-eye").setAttribute("aria-label", show ? "Hide password" : "Show password");
  });
}

// 7. JWT Parser
function parseJwt(token) {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(decodeURIComponent(atob(base64).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join('')));
  } catch (e) { return null; }
}

// 8. Central API Fetch
async function apiCall(body) {
  const res = await fetch(SCRIPT_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(body)
  });
  return res.json();
}

// 9. Super-Admin Authentication Handshake
function setAuthLoading(on) {
  const card = document.querySelector(".auth-gate-card");
  if (card) card.classList.toggle("is-loading", on);
  if ($("auth-status")) $("auth-status").hidden = !on;
}

window.handleAdminLogin = async function(response) {
  const payload = parseJwt(response.credential);
  if (!payload || !payload.email) return;

  const enteredPass = $("admin-pass").value.trim();
  setAuthLoading(true);

  try {
    const authData = await apiCall({
      action: "adminAuth",
      email: payload.email,
      password: enteredPass
    });

    if (authData.status !== "success") {
      showDbToast(authData.message || "Access denied.", true);
      return;
    }

    currentUser.name = payload.name;
    currentUser.email = payload.email.toLowerCase();

    if ($("user-name")) $("user-name").textContent = currentUser.name;
    if ($("user-email")) $("user-email").textContent = currentUser.email;

    $("auth-gate-overlay").classList.add("hidden");
    showDbToast(`Authenticated as Super-Admin: ${currentUser.email}`);

    loadDashboardData();
  } catch (err) {
    showDbToast("Authentication failed: " + err.message, true);
  } finally {
    setAuthLoading(false);
  }
};

// 10. Load Registry Data
function setSyncState(ok) {
  const v = $("stat-sync-state");
  const t = $("stat-sync-time");
  if (v) {
    v.textContent = ok ? "Connected" : "Unreachable";
    v.classList.toggle("is-error", !ok);
  }
  if (t) {
    t.textContent = ok
      ? "Last synced " + new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      : "Last attempt failed. Try refreshing.";
  }
}

async function loadDashboardData() {
  const refreshBtn = $("btn-refresh-overview");
  if (refreshBtn) {
    refreshBtn.classList.add("is-loading");
    refreshBtn.disabled = true;
  }
  if (!allStoresCache.length && $("store-table-body")) {
    $("store-table-body").innerHTML = `<tr><td colspan="5" class="table-loading"><span class="spinner"></span> Loading store registry…</td></tr>`;
  }
  try {
    const data = await apiCall({ action: "getAdminData", email: currentUser.email });
    allStoresCache = data.allStores || [];
    renderDashboard(allStoresCache);
    setSyncState(true);
  } catch (err) {
    setSyncState(false);
    if ($("store-table-body")) {
      $("store-table-body").innerHTML = `<tr><td colspan="5" class="table-empty is-error"><strong>Couldn't load stores</strong>Check your connection, then refresh.</td></tr>`;
    }
    showDbToast("Error retrieving Master-Sheet data.", true);
  } finally {
    if (refreshBtn) {
      refreshBtn.classList.remove("is-loading");
      refreshBtn.disabled = false;
    }
  }
}

// 11. Render Metrics, Dropdown & Table
function renderDashboard(stores) {
  if ($("badge-total-stores")) $("badge-total-stores").textContent = stores.length;

  const count = st => stores.filter(s => (s.registrationStatus || "PENDING").toUpperCase() === st).length;
  const activeCount = count("ACTIVE");
  const pendingCount = count("PENDING");
  const suspendedCount = count("SUSPENDED");

  if ($("stat-active-stores")) $("stat-active-stores").textContent = activeCount;
  if ($("stat-pending-stores")) $("stat-pending-stores").textContent = pendingCount;
  if ($("stat-suspended-stores")) $("stat-suspended-stores").textContent = suspendedCount;
  if ($("breakdown-total")) $("breakdown-total").textContent = `${stores.length} ${stores.length === 1 ? "store" : "stores"}`;

  const pct = n => stores.length ? (n / stores.length * 100) + "%" : "0%";
  if ($("seg-active")) $("seg-active").style.width = pct(activeCount);
  if ($("seg-pending")) $("seg-pending").style.width = pct(pendingCount);
  if ($("seg-suspended")) $("seg-suspended").style.width = pct(suspendedCount);

  // Selector always lists all stores
  const selector = $("qr-store-selector");
  if (selector) {
    const prev = selector.value;
    selector.innerHTML = `<option value="">-- Choose Store --</option>`;
    stores.forEach(s => {
      const opt = document.createElement("option");
      opt.value = s.shopId;
      opt.textContent = `${s.shopName} (${s.shopId})`;
      selector.appendChild(opt);
    });
    if (prev && stores.some(s => s.shopId === prev)) selector.value = prev;
  }

  renderTable();
}

function renderTable() {
  const searchInput = $("global-store-search");
  const query = searchInput ? searchInput.value.toLowerCase().trim() : "";
  const tbody = $("store-table-body");
  if (!tbody) return;

  const filtered = allStoresCache.filter(s => {
    const status = (s.registrationStatus || "PENDING").toUpperCase();
    if (statusFilter !== "ALL" && status !== statusFilter) return false;
    return !query ||
      (s.shopName || "").toLowerCase().includes(query) ||
      (s.shopId || "").toLowerCase().includes(query) ||
      (s.ownerName || "").toLowerCase().includes(query) ||
      (s.ownerMobile && String(s.ownerMobile).includes(query)) ||
      (s.ownerEmail && s.ownerEmail.toLowerCase().includes(query));
  });

  if ($("store-result-count")) {
    $("store-result-count").textContent = allStoresCache.length
      ? `${filtered.length} of ${allStoresCache.length}` : "";
  }

  if (filtered.length === 0) {
    tbody.innerHTML = allStoresCache.length === 0
      ? `<tr><td colspan="5" class="table-empty"><strong>No stores yet</strong>No registered stores found in Master-Sheet.<br/><button class="btn-step-next" data-action="register" style="margin-top:1rem;">${ico("plus")} Register a store</button></td></tr>`
      : `<tr><td colspan="5" class="table-empty"><strong>No matching stores</strong>Try a different search or status filter.</td></tr>`;
    return;
  }

  tbody.innerHTML = "";
  filtered.forEach(s => {
    const tr = document.createElement("tr");
    const status = (s.registrationStatus || "PENDING").toUpperCase();
    const statusClass = status.toLowerCase();
    const id = esc(s.shopId);

    tr.innerHTML = `
      <td class="cell-store">
        <div class="store-name">${esc(s.shopName)}</div>
        <code class="store-slug">${id}</code>
      </td>
      <td data-label="Owner">
        ${esc(s.ownerName || 'Merchant')}
        <span class="owner-meta">📞 ${esc(s.ownerMobile || 'N/A')}</span>
        <span class="owner-meta">✉️ ${esc(s.ownerEmail || 'N/A')}</span>
      </td>
      <td data-label="Tagline">${esc(s.tagline || '—')}</td>
      <td class="cell-status"><span class="status-badge ${statusClass}">${esc(status.toLowerCase())}</span></td>
      <td class="cell-actions">
        <div class="table-action-btns">
          ${status !== 'ACTIVE' ? `<button class="btn-table success" data-action="approve" data-id="${id}">Approve</button>` : ''}
          ${status === 'ACTIVE' ? `<button class="btn-table warning" data-action="suspend" data-id="${id}">Suspend</button>` : ''}
          <button class="btn-table" data-action="qr" data-id="${id}">QR codes</button>
          <button class="btn-table danger" data-action="delete" data-id="${id}" data-name="${esc(s.shopName)}">Delete</button>
        </div>
      </td>`;
    tbody.appendChild(tr);
  });
}

// Row Action Event Delegation
if ($("store-table-body")) {
  $("store-table-body").addEventListener("click", e => {
    const btn = e.target.closest("button[data-action]");
    if (!btn) return;
    const { action, id, name } = btn.dataset;
    if (action === "register") {
      const regTab = document.querySelector('[data-tab="tab-wizard"]');
      if (regTab) regTab.click();
    } else if (action === "approve") {
      setStatus(id, "ACTIVE");
    } else if (action === "suspend") {
      setStatus(id, "SUSPENDED");
    } else if (action === "qr") {
      openStudioForStore(id);
    } else if (action === "delete") {
      confirmDeleteStore(id, name);
    }
  });
}

// 12. Search & Status Filtering
if ($("global-store-search")) {
  $("global-store-search").addEventListener("input", () => {
    if (!$("tab-stores").classList.contains("active")) {
      const dirTab = document.querySelector('[data-tab="tab-stores"]');
      if (dirTab) dirTab.click();
    }
    renderTable();
  });
}

document.querySelectorAll(".filter-chips .chip").forEach(chip => {
  chip.addEventListener("click", () => {
    statusFilter = chip.dataset.filter;
    document.querySelectorAll(".filter-chips .chip").forEach(c => c.classList.toggle("active", c === chip));
    renderTable();
  });
});

// 13. Lifecycle Status Updates
window.setStatus = async function(slug, status) {
  try {
    const res = await apiCall({
      action: "setStoreRegistrationStatus",
      email: currentUser.email,
      targetShopId: slug,
      newStatus: status
    });
    showDbToast(`Status updated: ${slug} is now ${status}`);
    loadDashboardData();
  } catch (err) {
    showDbToast("Failed to update status", true);
  }
};

// 14. Permanent Delete Confirmation Modal
function closeModal() {
  $("confirm-modal").classList.remove("active");
  if (lastFocus) lastFocus.focus();
}

window.confirmDeleteStore = function(slug, name) {
  pendingDeleteSlug = slug;
  lastFocus = document.activeElement;
  $("modal-title").textContent = `Delete store: ${name}?`;
  $("modal-desc").textContent = `This will permanently delete '${slug}' from Master-Sheet and remove its dedicated database tab. This cannot be undone.`;
  $("confirm-modal").classList.add("active");
  $("btn-modal-cancel").focus();
};

if ($("btn-modal-cancel")) {
  $("btn-modal-cancel").addEventListener("click", () => {
    closeModal();
    pendingDeleteSlug = null;
  });
}

if ($("confirm-modal")) {
  $("confirm-modal").addEventListener("click", e => {
    if (e.target === $("confirm-modal")) $("btn-modal-cancel").click();
  });
}

document.addEventListener("keydown", e => {
  if (e.key === "Escape") {
    if ($("confirm-modal") && $("confirm-modal").classList.contains("active")) {
      $("btn-modal-cancel").click();
    }
    setAccountMenu(false);
  }
});

if ($("btn-modal-confirm")) {
  $("btn-modal-confirm").addEventListener("click", async () => {
    if (!pendingDeleteSlug) return;
    const target = pendingDeleteSlug;
    closeModal();

    try {
      const res = await apiCall({
        action: "deleteStore",
        email: currentUser.email,
        targetShopId: target
      });
      if (res.status === "success") {
        showDbToast(`Deleted: Store '${target}' removed completely.`);
        loadDashboardData();
      } else {
        showDbToast(res.message || "Delete failed", true);
      }
    } catch (e) {
      showDbToast("Error deleting store", true);
    } finally {
      pendingDeleteSlug = null;
    }
  });
}

// 15. Wizard Form Submission (Preserves closingTime & All Master-Sheet Row Columns)
const wizardForm = $("wizard-form");
if (wizardForm) {
  wizardForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const slug = $("shop-id").value.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    const shopName = $("shop-name").value.trim();
    const tagline = $("shop-tagline").value.trim();
    const ownerName = $("owner-name").value.trim();
    const email = $("owner-email").value.trim().toLowerCase();
    const mobile = $("shop-mobile").value.trim().replace(/\D/g, '');

    if (slug.length < 3) {
      showDbToast("Store slug must be at least 3 letters/numbers", true);
      goToStep(1);
      return;
    }
    if (!shopName || !tagline) {
      showDbToast("Please fill all identity fields in Step 1", true);
      goToStep(1);
      return;
    }
    if (!ownerName || !email || mobile.length !== 10) {
      showDbToast("Please verify owner contact details in Step 2", true);
      goToStep(2);
      return;
    }

    const payload = {
      action: "registerStore",
      shopId: slug,
      shopName: shopName,
      tagline: tagline,
      ownerName: ownerName,
      ownerEmail: email,
      ownerMobile: mobile,
      primaryColor: $("col-primary") ? $("col-primary").value : "#2563eb",
      bgColor: $("col-bg") ? $("col-bg").value : "#0f172a",
      cardBg: $("col-card") ? $("col-card").value : "#ffffff",
      textColor: $("col-text") ? $("col-text").value : "#0f172a",
      reviewUrl: $("shop-review-url") ? $("shop-review-url").value.trim() : "",
      mapEmbedUrl: $("shop-map-url") ? $("shop-map-url").value.trim() : "",
      closingTime: $("shop-closing-time") ? ($("shop-closing-time").value.trim() || "9:00 PM") : "9:00 PM",
      isPublicRegister: false
    };

    const btn = $("btn-save-store");
    const idleHtml = btn ? btn.innerHTML : "Save";
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `<span class="spinner"></span><span>Writing to Master-Sheet…</span>`;
    }

    try {
      const res = await apiCall(payload);
      if (res.status === "success") {
        showDbToast(`Verified: Stored in Master-Sheet Row #${res.row || ''} with Tab '${slug}'`);
        wizardForm.reset();
        goToStep(1);
        loadDashboardData();
        openStudioForStore(slug);
      } else {
        showDbToast(res.message || "Registration failed", true);
      }
    } catch (err) {
      showDbToast("Network error syncing with Google Sheets.", true);
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = idleHtml;
      }
    }
  });
}

// 16. QR & Stand Studio Controller
window.openStudioForStore = function(slug) {
  const qrTab = document.querySelector('[data-tab="tab-qr"]');
  if (qrTab) qrTab.click();
  const selector = $("qr-store-selector");
  if (selector) selector.value = slug;
  renderQrStudio(slug);
};

if ($("qr-store-selector")) {
  $("qr-store-selector").addEventListener("change", (e) => {
    renderQrStudio(e.target.value);
  });
}

function renderQrStudio(slug) {
  const standBox = $("box-stand-qr");
  const publicBox = $("box-public-qr");
  if (!standBox || !publicBox) return;

  standBox.innerHTML = "";
  publicBox.innerHTML = "";

  ["btn-copy-stand", "btn-dl-stand", "btn-copy-public", "btn-dl-public"].forEach(id => {
    if ($(id)) $(id).disabled = !slug;
  });

  if (!slug) {
    if ($("chip-stand-url")) $("chip-stand-url").textContent = "Select a store to view URL";
    if ($("chip-public-url")) $("chip-public-url").textContent = "Select a store to view URL";
    return;
  }

  const standUrl = `${BASE_DOMAIN}/desk.html?shop=${slug}`;
  const publicUrl = `${BASE_DOMAIN}/shop.html?shop=${slug}`;

  if ($("chip-stand-url")) $("chip-stand-url").textContent = standUrl;
  if ($("chip-public-url")) $("chip-public-url").textContent = publicUrl;

  new QRCode(standBox, { text: standUrl, width: 220, height: 220, correctLevel: QRCode.CorrectLevel.M });
  new QRCode(publicBox, { text: publicUrl, width: 220, height: 220, correctLevel: QRCode.CorrectLevel.M });
}

window.copyStudioLink = async function(type) {
  const chip = $(`chip-${type}-url`);
  const text = chip ? chip.textContent : "";
  if (!text || text.includes("Select a store")) return;
  try {
    await navigator.clipboard.writeText(text);
    showDbToast("Link copied to clipboard!");
  } catch (err) {
    showDbToast("Couldn't copy automatically. Tap and hold the URL to copy.", true);
  }
};

window.downloadStudioQr = function(type) {
  const box = document.querySelector(`#box-${type}-qr`);
  if (!box) return;
  const canvas = box.querySelector("canvas");
  const img = box.querySelector("img");

  let href = null;
  if (canvas) {
    try {
      href = canvas.toDataURL("image/png");
    } catch (e) {}
  }
  if (!href && img && img.src && img.src.startsWith("data:")) {
    href = img.src;
  }

  if (href) {
    const a = document.createElement("a");
    a.href = href;
    a.download = `${type}-qr-stand.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showDbToast("QR Code downloaded.");
  } else {
    showDbToast("QR Code rendering, please try again in a moment.", true);
  }
};

// 17. Topbar Global Controls
if ($("btn-refresh-overview")) {
  $("btn-refresh-overview").addEventListener("click", () => {
    showDbToast("Refreshing Master-Sheet data...");
    loadDashboardData();
  });
}

if ($("btn-logout")) {
  $("btn-logout").addEventListener("click", () => location.reload());
}

window.addEventListener("DOMContentLoaded", () => {
  handleWizardEnterKey();
});
