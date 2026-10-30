// ==========================================
// ENTERPRISE B2B ADMIN ENGINE (admin.js)
// Zero Browser Alerts + Step Validation + Master-Sheet Sync
// ==========================================

const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyq5CbrZ5VzrFEcBh-gfs3iy5UewHoNfJT7ZtLxhHXhhW_bs7R_a0roSqYbZehydJCn/exec";
const BASE_DOMAIN = "https://customer-connect-desk.pages.dev";

let currentUser = { name: "", email: "" };
let allStoresCache = [];
let pendingDeleteSlug = null;

const $ = id => document.getElementById(id);

// 1. Toast Notification System
function showDbToast(msg, isError = false) {
  const toast = $("db-toast");
  if (!toast) return;
  toast.style.borderColor = isError ? "var(--danger)" : "var(--success)";
  toast.innerHTML = `<span>${isError ? '❌' : '✅'}</span> <span>${msg}</span>`;
  toast.style.display = "flex";
  setTimeout(() => { toast.style.display = "none"; }, 4200);
}

// 2. Theme Toggle (Dark / Light)
const themeBtn = $("theme-toggle-btn");
if (themeBtn) {
  themeBtn.addEventListener("click", () => {
    const currentTheme = document.documentElement.getAttribute("data-theme") || "dark";
    const newTheme = currentTheme === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", newTheme);
    localStorage.setItem("ccd_theme", newTheme);
    $("theme-icon").textContent = newTheme === "dark" ? "☀️ Light" : "🌙 Dark";
  });
}

(function initTheme() {
  const saved = localStorage.getItem("ccd_theme") || "dark";
  document.documentElement.setAttribute("data-theme", saved);
  if ($("theme-icon")) $("theme-icon").textContent = saved === "dark" ? "☀️ Light" : "🌙 Dark";
})();

// 3. Navigation & Tab Switching
document.querySelectorAll(".nav-item").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".nav-item").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".tab-pane").forEach(p => p.classList.remove("active"));
    btn.classList.add("active");
    const target = btn.getAttribute("data-tab");
    if ($(target)) $(target).classList.add("active");
  });
});

if ($("btn-top-add")) {
  $("btn-top-add").addEventListener("click", () => {
    document.querySelector('[data-tab="tab-wizard"]').click();
  });
}

// 4. Strict Stepper Navigation with Per-Step Validation
window.goToStep = function(targetStep) {
  const activeSec = document.querySelector(".wizard-section.active");
  const currentStepId = activeSec ? activeSec.id : "wizard-sec-1";

  // Prevent moving past Step 1 if Identity fields are incomplete
  if (currentStepId === "wizard-sec-1" && targetStep > 1) {
    const slug = $("shop-id").value.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    const shopName = $("shop-name").value.trim();
    const tagline = $("shop-tagline").value.trim();

    if (!slug || slug.length < 3) {
      showDbToast("Store slug must be at least 3 letters/numbers", true);
      $("shop-id").focus();
      return;
    }
    if (!shopName) {
      showDbToast("Store display name is required", true);
      $("shop-name").focus();
      return;
    }
    if (!tagline) {
      showDbToast("Business tagline is required", true);
      $("shop-tagline").focus();
      return;
    }
  }

  // Prevent moving past Step 2 if Contact fields are incomplete
  if (currentStepId === "wizard-sec-2" && targetStep > 2) {
    const ownerName = $("owner-name").value.trim();
    const email = $("owner-email").value.trim().toLowerCase();
    const mobile = $("shop-mobile").value.trim().replace(/\D/g, '');

    if (!ownerName) {
      showDbToast("Owner full name is required", true);
      $("owner-name").focus();
      return;
    }
    if (!email || !email.includes('@')) {
      showDbToast("Valid owner email address is required", true);
      $("owner-email").focus();
      return;
    }
    if (mobile.length !== 10) {
      showDbToast("Valid 10-digit mobile number required", true);
      $("shop-mobile").focus();
      return;
    }
  }

  // Update indicators
  document.querySelectorAll(".step-item").forEach(item => {
    const num = parseInt(item.getAttribute("data-step"));
    if (num <= targetStep) item.classList.add("active");
    else item.classList.remove("active");
  });

  // Switch visible section
  document.querySelectorAll(".wizard-section").forEach(sec => sec.classList.remove("active"));
  $(`wizard-sec-${targetStep}`).classList.add("active");
};

// 5. Intercept "Enter" Key so fields do not trigger unexpected jumps
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
    input.type = input.type === "password" ? "text" : "password";
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
window.handleAdminLogin = async function(response) {
  const payload = parseJwt(response.credential);
  if (!payload || !payload.email) return;

  const enteredPass = $("admin-pass").value.trim();

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

    $("user-name").textContent = currentUser.name;
    $("user-email").textContent = currentUser.email;

    $("auth-gate-overlay").classList.add("hidden");
    showDbToast(`Authenticated as Super-Admin: ${currentUser.email}`);

    loadDashboardData();
  } catch (err) {
    showDbToast("Authentication failed: " + err.message, true);
  }
};

// 10. Load Registry Data
async function loadDashboardData() {
  try {
    const data = await apiCall({ action: "getAdminData", email: currentUser.email });
    allStoresCache = data.allStores || [];
    renderDashboard(allStoresCache);
  } catch (err) {
    showDbToast("Error retrieving Master-Sheet data.", true);
  }
}

// 11. Render Metrics & Table
function renderDashboard(stores) {
  $("badge-total-stores").textContent = stores.length;

  const activeCount = stores.filter(s => s.registrationStatus === "ACTIVE").length;
  const pendingCount = stores.filter(s => s.registrationStatus === "PENDING").length;

  $("stat-active-stores").textContent = activeCount;
  $("stat-pending-stores").textContent = pendingCount;

  const tbody = $("store-table-body");
  tbody.innerHTML = "";

  const selector = $("qr-store-selector");
  selector.innerHTML = `<option value="">-- Choose Store --</option>`;

  if (stores.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="table-loading">No registered stores found in Master-Sheet.</td></tr>`;
    return;
  }

  stores.forEach(s => {
    const opt = document.createElement("option");
    opt.value = s.shopId;
    opt.textContent = `${s.shopName} (${s.shopId})`;
    selector.appendChild(opt);

    const tr = document.createElement("tr");
    const statusClass = (s.registrationStatus || 'PENDING').toLowerCase();

    tr.innerHTML = `
      <td>
        <strong>${s.shopName}</strong><br/>
        <code style="font-size:0.75rem; color:var(--text-muted);">${s.shopId}</code>
      </td>
      <td>
        ${s.ownerName || 'Merchant'}<br/>
        <span style="font-size:0.75rem; color:var(--text-muted);">📞 ${s.ownerMobile || 'N/A'} | ✉️ ${s.ownerEmail || 'N/A'}</span>
      </td>
      <td><span style="font-size:0.82rem;">${s.tagline || '—'}</span></td>
      <td><span class="status-badge ${statusClass}">${s.registrationStatus}</span></td>
      <td>
        <div class="table-action-btns">
          ${s.registrationStatus !== 'ACTIVE' ? `<button class="btn-table success" onclick="setStatus('${s.shopId}', 'ACTIVE')">Approve</button>` : ''}
          ${s.registrationStatus === 'ACTIVE' ? `<button class="btn-table warning" onclick="setStatus('${s.shopId}', 'SUSPENDED')">Suspend</button>` : ''}
          <button class="btn-table" onclick="openStudioForStore('${s.shopId}')">QR</button>
          <button class="btn-table danger" onclick="confirmDeleteStore('${s.shopId}', '${s.shopName}')">Delete</button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// 12. Search Filtering
$("global-store-search").addEventListener("input", (e) => {
  const query = e.target.value.toLowerCase().trim();
  const filtered = allStoresCache.filter(s => 
    s.shopName.toLowerCase().includes(query) ||
    s.shopId.toLowerCase().includes(query) ||
    (s.ownerMobile && s.ownerMobile.includes(query)) ||
    (s.ownerEmail && s.ownerEmail.toLowerCase().includes(query))
  );
  renderDashboard(filtered);
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
window.confirmDeleteStore = function(slug, name) {
  pendingDeleteSlug = slug;
  $("modal-title").textContent = `Delete Store: ${name}?`;
  $("modal-desc").textContent = `This will permanently delete '${slug}' from Master-Sheet and remove its dedicated database tab. This cannot be undone.`;
  $("confirm-modal").classList.add("active");
};

$("btn-modal-cancel").addEventListener("click", () => {
  $("confirm-modal").classList.remove("active");
  pendingDeleteSlug = null;
});

$("btn-modal-confirm").addEventListener("click", async () => {
  if (!pendingDeleteSlug) return;
  $("confirm-modal").classList.remove("active");
  
  try {
    const res = await apiCall({
      action: "deleteStore",
      email: currentUser.email,
      targetShopId: pendingDeleteSlug
    });
    if (res.status === "success") {
      showDbToast(`Deleted: Store '${pendingDeleteSlug}' removed completely.`);
      loadDashboardData();
    } else {
      showDbToast(res.message, true);
    }
  } catch (e) {
    showDbToast("Error deleting store", true);
  } finally {
    pendingDeleteSlug = null;
  }
});

// 15. Wizard Form Submission (Final Step 3 Only)
$("wizard-form").addEventListener("submit", async (e) => {
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
    primaryColor: $("col-primary").value,
    bgColor: $("col-bg").value,
    cardBg: $("col-card").value,
    textColor: $("col-text").value,
    reviewUrl: $("shop-review-url").value.trim(),
    mapEmbedUrl: $("shop-map-url").value.trim(),
    isPublicRegister: false
  };

  const btn = $("btn-save-store");
  btn.disabled = true;
  btn.textContent = "Writing to Master-Sheet...";

  try {
    const res = await apiCall(payload);
    if (res.status === "success") {
      showDbToast(`Verified: Stored in Master-Sheet Row #${res.row} with Tab '${slug}'`);
      $("wizard-form").reset();
      goToStep(1);
      loadDashboardData();
      openStudioForStore(slug);
    } else {
      showDbToast(res.message, true);
    }
  } catch (err) {
    showDbToast("Network error syncing with Google Sheets.", true);
  } finally {
    btn.disabled = false;
    btn.textContent = "💾 Save to Master-Sheet & Provision Tab";
  }
});

// 16. QR & Stand Studio Controller
window.openStudioForStore = function(slug) {
  document.querySelector('[data-tab="tab-qr"]').click();
  $("qr-store-selector").value = slug;
  renderQrStudio(slug);
};

$("qr-store-selector").addEventListener("change", (e) => {
  renderQrStudio(e.target.value);
});

function renderQrStudio(slug) {
  if (!slug) return;

  const standUrl = `${BASE_DOMAIN}/desk.html?shop=${slug}`;
  const publicUrl = `${BASE_DOMAIN}/shop.html?shop=${slug}`;

  $("chip-stand-url").textContent = standUrl;
  $("chip-public-url").textContent = publicUrl;

  const standBox = $("box-stand-qr");
  const publicBox = $("box-public-qr");
  standBox.innerHTML = "";
  publicBox.innerHTML = "";

  new QRCode(standBox, { text: standUrl, width: 140, height: 140 });
  new QRCode(publicBox, { text: publicUrl, width: 140, height: 140 });
}

window.copyStudioLink = function(type) {
  const text = $(`chip-${type}-url`).textContent;
  if (!text || text.includes("Select a store")) return;
  navigator.clipboard.writeText(text);
  showDbToast("Link copied to clipboard!");
};

window.downloadStudioQr = function(type) {
  const img = document.querySelector(`#box-${type}-qr img`);
  if (img && img.src) {
    const a = document.createElement("a");
    a.href = img.src;
    a.download = `${type}-qr-stand.png`;
    a.click();
    showDbToast("QR Code downloaded.");
  }
};

if ($("btn-refresh-overview")) {
  $("btn-refresh-overview").addEventListener("click", () => {
    showDbToast("Refreshing Master-Sheet cache...");
    loadDashboardData();
  });
}

if ($("btn-logout")) {
  $("btn-logout").addEventListener("click", () => location.reload());
}

window.addEventListener("DOMContentLoaded", () => {
  handleWizardEnterKey();
});
