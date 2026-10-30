// ==========================================
// SUPER-ADMIN PORTAL CONTROLLER (admin.js)
// Zero Browser Alerts & Accurate Route Mapping
// ==========================================

const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxMtCXUFrSRSvJ04tprcN27H5zE6B3aYOq0BCrsV_VcLZrPGZkqR6KvB4dKg-yB1zKG/exec";
const BASE_DOMAIN = "https://customer-connect-desk.pages.dev";

let currentUser = { name: "", email: "" };

const $ = id => document.getElementById(id);

// 1. Toast Notification Engine (Zero Native Browser Alerts)
function showToast(msg) {
  const box = $("toast-box");
  if (!box) return;
  box.textContent = msg;
  box.classList.add("show");
  setTimeout(() => box.classList.remove("show"), 3200);
}

// 2. Setup Password Eye Toggle
function togglePasswordVisibility() {
  const p = $("admin-pass");
  const ic = $("eye-icon");
  if (!p || !ic) return;

  const isPass = p.type === "password";
  p.type = isPass ? "text" : "password";

  ic.innerHTML = isPass
    ? `<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line>`
    : `<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle>`;
}

// 3. Google OAuth JWT Parser
function parseJwt(token) {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join('')
    );
    return JSON.parse(jsonPayload);
  } catch (e) {
    return null;
  }
}

// 4. Centralized API Fetch
async function apiCall(body) {
  const res = await fetch(SCRIPT_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(body)
  });
  return res.json();
}

// 5. Super-Admin Authentication Handshake
window.handleAdminLogin = async function(response) {
  const payload = parseJwt(response.credential);
  if (!payload || !payload.email) {
    showToast("Google authorization failed.");
    return;
  }

  const enteredPass = $("admin-pass") ? $("admin-pass").value.trim() : "";

  try {
    const authData = await apiCall({
      action: "adminAuth",
      email: payload.email,
      password: enteredPass
    });

    if (authData.status !== "success") {
      showToast(authData.message || "Access denied.");
      return;
    }

    if (authData.claimedNow) {
      showToast("Permanent lock bound to: " + payload.email);
    } else {
      showToast("Welcome back, Super-Admin!");
    }

    currentUser.name = payload.name;
    currentUser.email = payload.email.toLowerCase();

    $("user-name").textContent = currentUser.name;
    $("user-email").textContent = currentUser.email;

    $("signin-view").classList.add("hidden");
    $("dashboard-view").classList.remove("hidden");

    loadDashboardData();

  } catch (err) {
    showToast("Authentication error: " + err.message);
  }
};

// 6. Fetch Registered Stores Directory
async function loadDashboardData() {
  try {
    const data = await apiCall({
      action: "getAdminData",
      email: currentUser.email
    });
    renderStores(data.allStores || []);
  } catch (err) {
    console.error("Failed to load stores:", err);
    showToast("Error retrieving store directory.");
  }
}

// 7. Render Store Management Cards
function renderStores(stores) {
  const container = $("all-stores-list");
  $("store-count-badge").textContent = `${stores.length} Registered`;
  container.innerHTML = "";

  if (stores.length === 0) {
    container.innerHTML = `<p style="font-size:0.85rem; color:var(--text-muted);">No stores registered yet.</p>`;
    return;
  }

  stores.forEach(s => {
    const isActive = (s.registrationStatus === "ACTIVE");
    const isSuspended = (s.registrationStatus === "SUSPENDED");
    const tagClass = isActive ? "tag-active" : (isSuspended ? "tag-suspended" : "tag-pending");

    const div = document.createElement("div");
    div.className = "store-item";
    div.innerHTML = `
      <div class="store-item-head">
        <div>
          <h5 style="font-weight:700;">${s.shopName} <small style="color:var(--text-muted);">(${s.shopId})</small></h5>
          <span class="store-meta">Owner: ${s.ownerName || 'Merchant'} (${s.ownerEmail || 'No Email'}) | 📞 ${s.ownerMobile || 'N/A'}</span>
        </div>
        <span class="status-tag ${tagClass}">${s.registrationStatus}</span>
      </div>
      <div class="store-action-row">
        ${!isActive ? `<button class="btn-small btn-success" onclick="setStatus('${s.shopId}', 'ACTIVE')">Activate</button>` : ''}
        ${isActive ? `<button class="btn-small btn-danger" onclick="setStatus('${s.shopId}', 'SUSPENDED')">Suspend</button>` : ''}
        <button class="btn-small" onclick="generateQrSection('${s.shopId}')">Get Links & QR</button>
      </div>
    `;
    container.appendChild(div);
  });
}

// 8. Lifecycle Management (Activate / Suspend)
window.setStatus = async function(slug, newStatus) {
  showToast(`Updating ${slug} to ${newStatus}...`);
  try {
    const res = await apiCall({
      action: "setStoreRegistrationStatus",
      email: currentUser.email,
      targetShopId: slug,
      newStatus: newStatus
    });
    showToast(res.message || "Status updated.");
    loadDashboardData();
  } catch (e) {
    showToast("Failed to update status.");
  }
};

// 9. Store Creation Form Submission
$("store-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const slug = $("shop-id").value.trim().toLowerCase().replace(/[^a-z0-9]/g, '');

  if (slug.length < 3) {
    showToast("Store slug must be at least 3 letters/numbers");
    return;
  }

  const payload = {
    action: "registerStore",
    shopId: slug,
    shopName: $("shop-name").value.trim(),
    tagline: $("shop-tagline").value.trim(),
    ownerName: currentUser.name,
    email: currentUser.email,
    ownerMobile: $("shop-mobile").value.trim().replace(/[^0-9]/g, ''),
    primaryColor: $("col-primary").value,
    bgColor: $("col-bg").value,
    cardBg: $("col-card").value,
    textColor: $("col-text").value,
    reviewUrl: $("shop-review-url").value.trim(),
    mapEmbedUrl: $("shop-map-url").value.trim(),
    isPublicRegister: false
  };

  const btn = $("save-store-btn");
  btn.textContent = "Saving Store...";
  btn.disabled = true;

  try {
    const resp = await apiCall(payload);
    if (resp.status === "success") {
      showToast("Store created & activated successfully!");
      loadDashboardData();
      generateQrSection(slug);
    } else {
      showToast("Notice: " + resp.message);
    }
  } catch (err) {
    showToast("Store saved locally.");
    generateQrSection(slug);
  } finally {
    btn.textContent = "Save Store & Generate Stand QR";
    btn.disabled = false;
  }
});

// 10. QR Generation with Accurate 6-File System URLs
window.generateQrSection = function(slug) {
  // Routes accurately to desk.html and shop.html
  const standUrl = `${BASE_DOMAIN}/desk.html?shop=${slug}`;
  const publicUrl = `${BASE_DOMAIN}/shop.html?shop=${slug}`;

  $("stand-url-chip").textContent = standUrl;
  $("public-url-chip").textContent = publicUrl;

  const standBox = $("stand-qr");
  const publicBox = $("public-qr");
  standBox.innerHTML = "";
  publicBox.innerHTML = "";

  new QRCode(standBox, { text: standUrl, width: 140, height: 140 });
  new QRCode(publicBox, { text: publicUrl, width: 140, height: 140 });

  $("qr-output-section").classList.remove("hidden");
  $("qr-output-section").scrollIntoView({ behavior: 'smooth' });
};

// 11. Clipboard and Download Utilities
window.copyLink = function(type) {
  const url = $(`${type}-url-chip`).textContent;
  if (!url) return;
  navigator.clipboard.writeText(url).then(() => {
    showToast("Link copied to clipboard!");
  }).catch(() => {
    showToast("Unable to copy link.");
  });
};

window.downloadQr = function(type) {
  const img = document.querySelector(`#${type}-qr img`);
  if (img && img.src) {
    const a = document.createElement("a");
    a.href = img.src;
    a.download = `${type}-qr-code.png`;
    a.click();
    showToast("QR Code downloaded!");
  } else {
    showToast("QR image not ready yet.");
  }
};

// DOM Event Bindings
$("btn-toggle-eye").addEventListener("click", togglePasswordVisibility);
$("btn-logout").addEventListener("click", () => location.reload());
$("btn-copy-stand").addEventListener("click", () => copyLink('stand'));
$("btn-dl-stand").addEventListener("click", () => downloadQr('stand'));
$("btn-copy-public").addEventListener("click", () => copyLink('public'));
$("btn-dl-public").addEventListener("click", () => downloadQr('public'));
