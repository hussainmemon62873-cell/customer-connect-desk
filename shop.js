const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyq5CbrZ5VzrFEcBh-gfs3iy5UewHoNfJT7ZtLxhHXhhW_bs7R_a0roSqYbZehydJCn/exec";

function getShopParam() {
  const urlParams = new URLSearchParams(window.location.search);
  return (urlParams.get("shop") || "memonlock").trim().toLowerCase();
}

// Cleans epoch dates (1899-12-30...) into clean 12-hour timestamps
function formatClosingTime(rawTime) {
  if (!rawTime) return "9:00 PM";
  const str = String(rawTime).trim();
  if (!str.includes("1899") && !str.includes("T")) return str;
  try {
    const d = new Date(str);
    if (isNaN(d.getTime())) return "9:00 PM";
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
  } catch (e) {
    return "9:00 PM";
  }
}

async function fetchStoreConfig(slug) {
  const actions = ["getStoreConfig", "getStoreProfile"];
  for (const action of actions) {
    try {
      const res = await fetch(SCRIPT_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ action: action, shopId: slug, slug: slug })
      });
      const data = await res.json();
      if (data && data.status !== "error") {
        const storeData = data.store || data.config || (data.shopName ? data : null);
        if (storeData && storeData.shopName) return storeData;
      }
    } catch (e) {}
  }
  return null;
}

async function loadStoreProfile() {
  const slug = getShopParam();
  const app = document.getElementById("store-app");
  document.getElementById("current-year").textContent = new Date().getFullYear();

  const store = await fetchStoreConfig(slug);

  if (!store) {
    app.innerHTML = `
      <h2 style="font-size: 1.4rem; font-weight: 800; margin-bottom: 6px;">Store Not Found</h2>
      <p class="store-tagline">Please verify your store URL key.</p>`;
    return;
  }

  // Bind Store Names across UI
  document.getElementById("nav-brand").textContent = store.shopName;
  document.getElementById("footer-brand").textContent = store.shopName;
  document.title = `${store.shopName} | Verified Local Store`;

  // Apply Merchant Custom Color Tokens if set
  if (store.primaryColor) document.documentElement.style.setProperty('--accent', store.primaryColor);
  if (store.bgColor) document.documentElement.style.setProperty('--bg', store.bgColor);
  if (store.cardBg) document.documentElement.style.setProperty('--card-bg', store.cardBg);
  if (store.textColor) document.documentElement.style.setProperty('--text', store.textColor);

  const isSuspended = String(store.registrationStatus || "").toUpperCase() === "SUSPENDED";
  const isOpen = store.isOpen !== false && store.isOpen !== "CLOSED" && !isSuspended;
  const closingTime = formatClosingTime(store.closingTime);
  const statusClass = isOpen ? "open" : "closed";
  const statusText = isOpen ? `OPEN NOW · Closes at ${closingTime}` : "CURRENTLY CLOSED";
  const phone = store.ownerMobile || store.mobile || store.phone || "9979955386";
  const tagline = (store.tagline && store.tagline !== "Dbbdndn") 
    ? store.tagline 
    : "Computerized Key Making & Sensor Locks Specialist";

  // Bind Contact details
  if (document.getElementById("contact-phone")) document.getElementById("contact-phone").textContent = `+91 ${phone}`;
  if (document.getElementById("contact-hours")) document.getElementById("contact-hours").textContent = `Daily, Closes at ${closingTime}`;

  // Populate Hero / Main Action Area
  app.innerHTML = `
    <h1 class="store-title">${store.shopName}</h1>
    <p class="store-tagline">${tagline}</p>
    <div class="status-pill ${statusClass}">
      <span class="pulse-dot"></span>
      <span>${statusText}</span>
    </div>

    <div class="action-grid">
      <a href="tel:${phone}" class="btn-action btn-call">
        📞 Call Shop
      </a>
      <a href="https://wa.me/91${phone}?text=Hello%20${encodeURIComponent(store.shopName)},%20I%20found%20you%20online." target="_blank" class="btn-action btn-whatsapp">
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
  `;
}

// Built-in Policy Modal Engine (Zero External Redirects)
const policies = {
  privacy: {
    title: "Privacy Policy",
    body: `
      <h4>1. Information Collection</h4>
      <p>We respect your privacy. This storefront website does not store tracking cookies or sell personal data. When you call or send inquiries via WhatsApp, your contact details remain strictly between you and the verified store owner.</p>
      <h4>2. Counter Check-in Data</h4>
      <p>If you participate in customer desk check-ins, your mobile number is stored securely for visit logging and verification purposes only.</p>
    `
  },
  terms: {
    title: "Terms of Service",
    body: `
      <h4>1. Operating Standards</h4>
      <p>All services displayed (including key cutting, sensor lock programming, and hardware fittings) are fulfilled by the merchant directly at the counter.</p>
      <h4>2. Accuracy of Timings</h4>
      <p>Store opening and closing times are updated directly by the merchant. In unforeseen situations, please contact the store via telephone before visiting.</p>
    `
  },
  disclaimer: {
    title: "Disclaimer",
    body: `
      <p>This page serves as a verified storefront on the Customer Connect Desk network. Products, services, warranties, and key hardware are guaranteed directly by the respective independent business owner.</p>
    `
  }
};

window.openPolicy = function(type) {
  const p = policies[type];
  if (!p) return;
  document.getElementById("modal-policy-title").textContent = p.title;
  document.getElementById("modal-policy-body").innerHTML = p.body;
  document.getElementById("policy-modal").hidden = false;
};

window.closePolicy = function() {
  document.getElementById("policy-modal").hidden = true;
};

document.getElementById("policy-modal").addEventListener("click", (e) => {
  if (e.target.id === "policy-modal") closePolicy();
});

window.addEventListener("DOMContentLoaded", loadStoreProfile);
