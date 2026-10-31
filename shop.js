const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyq5CbrZ5VzrFEcBh-gfs3iy5UewHoNfJT7ZtLxhHXhhW_bs7R_a0roSqYbZehydJCn/exec";

function getShopParam() {
  const urlParams = new URLSearchParams(window.location.search);
  return (urlParams.get("shop") || "memonlock").trim().toLowerCase();
}

async function fetchStoreConfig(slug) {
  // Try 'getStoreConfig' first (desk & shop public action), fallback to 'getStoreProfile'
  const actions = ["getStoreConfig", "getStoreProfile"];
  
  for (const action of actions) {
    try {
      const res = await fetch(SCRIPT_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({
          action: action,
          shopId: slug,
          slug: slug
        })
      });
      const data = await res.json();
      if (data && data.status !== "error") {
        // Extract store data whether nested under .store, .config, or directly at root
        const storeData = data.store || data.config || (data.shopName ? data : null);
        if (storeData && storeData.shopName) {
          return storeData;
        }
      }
    } catch (e) {
      console.warn(`Attempt with action "${action}" failed:`, e);
    }
  }
  return null;
}

async function loadStoreProfile() {
  const slug = getShopParam();
  const app = document.getElementById("store-app");

  const store = await fetchStoreConfig(slug);

  if (!store) {
    app.innerHTML = `
      <div class="brand-card">
        <h2 style="font-size: 1.4rem; font-weight: 800; margin-bottom: 6px;">Store Not Found</h2>
        <p class="store-tagline" style="margin-bottom: 12px;">No active store found for slug: <code style="color:var(--text);">${slug}</code></p>
        <span style="font-size: 0.8rem; color: var(--text-muted);">Please check the store slug or verify it is marked ACTIVE in the admin directory.</span>
      </div>`;
    return;
  }

  // Apply merchant branding variables if present
  if (store.primaryColor) document.documentElement.style.setProperty('--accent', store.primaryColor);
  if (store.bgColor) document.documentElement.style.setProperty('--bg', store.bgColor);
  if (store.cardBg) document.documentElement.style.setProperty('--card-bg', store.cardBg);
  if (store.textColor) document.documentElement.style.setProperty('--text', store.textColor);

  const isSuspended = String(store.registrationStatus || "").toUpperCase() === "SUSPENDED";
  const isOpen = store.isOpen !== false && store.isOpen !== "CLOSED" && !isSuspended;
  const closingTime = store.closingTime || "9:00 PM";
  const statusClass = isOpen ? "open" : "closed";
  const statusText = isOpen ? `OPEN NOW · Closes at ${closingTime}` : "CURRENTLY CLOSED";
  const phone = store.ownerMobile || store.mobile || store.phone || "";

  document.title = `${store.shopName} | Official Store`;

  app.innerHTML = `
    <div class="brand-card">
      <h1 class="store-title">${store.shopName}</h1>
      <p class="store-tagline">${store.tagline || 'Computerized Key Making & Sensor Locks'}</p>
      <div class="status-pill ${statusClass}">
        <span class="pulse-dot"></span>
        <span>${statusText}</span>
      </div>
    </div>

    <div class="action-grid">
      ${phone ? `
        <a href="tel:${phone}" class="btn-action btn-call">
          📞 Call Shop
        </a>
        <a href="https://wa.me/91${phone}?text=Hello%20${encodeURIComponent(store.shopName)},%20I%20found%20you%20on%20Google." target="_blank" class="btn-action btn-whatsapp">
          💬 WhatsApp
        </a>
      ` : ''}
      ${store.mapEmbedUrl ? `
        <a href="${store.mapEmbedUrl}" target="_blank" class="btn-action btn-directions">
          📍 Get Directions on Google Maps
        </a>
      ` : ''}
      ${store.reviewUrl ? `
        <a href="${store.reviewUrl}" target="_blank" class="btn-action btn-review">
          ⭐ Leave a 5-Star Review
        </a>
      ` : ''}
    </div>

    <div class="info-card">
      <div class="info-row">
        <span class="info-label">Today's Closing Time</span>
        <span class="info-val">${closingTime}</span>
      </div>
      ${phone ? `
        <div class="info-row">
          <span class="info-label">Contact Number</span>
          <span class="info-val">+91 ${phone}</span>
        </div>
      ` : ''}
      <div class="info-row">
        <span class="info-label">Status</span>
        <span class="info-val" style="color:var(--ok);">Verified Merchant</span>
      </div>
    </div>
  `;
}

window.addEventListener("DOMContentLoaded", loadStoreProfile);
