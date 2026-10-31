const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyq5CbrZ5VzrFEcBh-gfs3iy5UewHoNfJT7ZtLxhHXhhW_bs7R_a0roSqYbZehydJCn/exec";

function getShopParam() {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get("shop") || "memonlock";
}

async function loadStoreProfile() {
  const slug = getShopParam();
  const app = document.getElementById("store-app");

  try {
    const res = await fetch(SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action: "getStoreProfile", shopId: slug })
    });
    const store = await res.json();

    if (!store || store.status === "error") {
      app.innerHTML = `
        <div class="brand-card">
          <h2>Store Not Found</h2>
          <p class="store-tagline">Please verify the link or QR stand.</p>
        </div>`;
      return;
    }

    // Apply owner branding variables if available
    if (store.primaryColor) document.documentElement.style.setProperty('--accent', store.primaryColor);
    if (store.bgColor) document.documentElement.style.setProperty('--bg', store.bgColor);
    if (store.cardBg) document.documentElement.style.setProperty('--card-bg', store.cardBg);
    if (store.textColor) document.documentElement.style.setProperty('--text', store.textColor);

    const isOpen = (store.isOpen !== false && store.registrationStatus !== "SUSPENDED");
    const closingTime = store.closingTime || "9:00 PM";
    const statusClass = isOpen ? "open" : "closed";
    const statusText = isOpen ? `OPEN NOW · Closes at ${closingTime}` : "CURRENTLY CLOSED";

    document.title = `${store.shopName} | Official Store`;

    app.innerHTML = `
      <div class="brand-card">
        <h1 class="store-title">${store.shopName}</h1>
        <p class="store-tagline">${store.tagline || 'Local Business & Customer Service'}</p>
        <div class="status-pill ${statusClass}">
          <span class="pulse-dot"></span>
          <span>${statusText}</span>
        </div>
      </div>

      <div class="action-grid">
        <a href="tel:${store.ownerMobile}" class="btn-action btn-call">
          📞 Call Shop
        </a>
        <a href="https://wa.me/91${store.ownerMobile}?text=Hello%20${encodeURIComponent(store.shopName)},%20I%20found%20you%20on%20Google." target="_blank" class="btn-action btn-whatsapp">
          💬 WhatsApp
        </a>
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
        <div class="info-row">
          <span class="info-label">Contact Number</span>
          <span class="info-val">+91 ${store.ownerMobile}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Verification</span>
          <span class="info-val" style="color:var(--ok);">Verified Merchant</span>
        </div>
      </div>
    `;
  } catch (err) {
    app.innerHTML = `
      <div class="brand-card">
        <h2>Unable to load store</h2>
        <p class="store-tagline">Please check your network connection.</p>
      </div>`;
  }
}

window.addEventListener("DOMContentLoaded", loadStoreProfile);
