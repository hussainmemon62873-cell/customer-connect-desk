// ==========================================
// DYNAMIC STOREFRONT CONTROLLER (shop.js)
// Google Ads Ready & Live Open/Close Sync
// ==========================================

const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxMtCXUFrSRSvJ04tprcN27H5zE6B3aYOq0BCrsV_VcLZrPGZkqR6KvB4dKg-yB1zKG/exec";

let storeData = null;
const $ = id => document.getElementById(id);

// 1. Toast Notification Utility (Zero Native Alerts)
function showToast(message) {
  const box = $("toast-box");
  if (!box) return;
  box.textContent = message;
  box.classList.add("show");
  setTimeout(() => box.classList.remove("show"), 3000);
}

// 2. Navigation Drawer Management
const drawerBackdrop = $("drawer-backdrop");
const navDrawer = $("nav-drawer");

function openDrawer() {
  if (drawerBackdrop && navDrawer) {
    drawerBackdrop.classList.add("open");
    navDrawer.classList.add("open");
    document.body.style.overflow = "hidden";
  }
}

function closeDrawer() {
  if (drawerBackdrop && navDrawer) {
    drawerBackdrop.classList.remove("open");
    navDrawer.classList.remove("open");
    document.body.style.overflow = "";
  }
}

if ($("menu-toggle-btn")) $("menu-toggle-btn").addEventListener("click", openDrawer);
if ($("drawer-close-btn")) $("drawer-close-btn").addEventListener("click", closeDrawer);
if (drawerBackdrop) drawerBackdrop.addEventListener("click", closeDrawer);

document.querySelectorAll(".menu-item").forEach(link => {
  link.addEventListener("click", closeDrawer);
});

// 3. Google Ads Compliance Legal Modals
const legalModal = $("legal-modal-backdrop");

function openLegalModal(type) {
  closeDrawer();
  if (!legalModal) return;

  if (type === "privacy") {
    $("modal-title").textContent = "Privacy Policy";
    $("modal-body").innerHTML = `
      <p>We respect your privacy. Counter desk check-ins and inquiries collected via this portal are strictly used to provide digital invoices, warranty updates, and customer loyalty discount privileges.</p>
      <p>We never sell, rent, or distribute personal information to external telemarketers. Customers can opt out of digital WhatsApp updates at any time by replying "STOP".</p>
    `;
  } else {
    $("modal-title").textContent = "Terms of Service";
    $("modal-body").innerHTML = `
      <p>Commercial lock services, key cutting duplication, and automotive transponder programming are performed according to certified manufacturer calibration tolerances.</p>
      <p>Customers are responsible for testing duplicate key operation before primary deployment. Emergency lock opening assistance requires legitimate proof of property ownership or identification.</p>
    `;
  }
  legalModal.classList.add("open");
}

if ($("modal-close-btn")) {
  $("modal-close-btn").addEventListener("click", () => {
    if (legalModal) legalModal.classList.remove("open");
  });
}

if (legalModal) {
  legalModal.addEventListener("click", e => {
    if (e.target === legalModal) legalModal.classList.remove("open");
  });
}

if ($("footer-privacy-btn")) $("footer-privacy-btn").addEventListener("click", () => openLegalModal("privacy"));
if ($("footer-terms-btn")) $("footer-terms-btn").addEventListener("click", () => openLegalModal("terms"));
if ($("drawer-privacy-btn")) $("drawer-privacy-btn").addEventListener("click", () => openLegalModal("privacy"));
if ($("drawer-terms-btn")) $("drawer-terms-btn").addEventListener("click", () => openLegalModal("terms"));

// 4. Promo Code Copy Utility
if ($("copy-promo-btn")) {
  $("copy-promo-btn").addEventListener("click", () => {
    const codeElem = $("promo-code");
    const code = codeElem ? codeElem.textContent.trim() : "DESK15";
    navigator.clipboard.writeText(code).then(() => {
      showToast("Promo code copied: " + code);
    }).catch(() => {
      showToast("Code: " + code);
    });
  });
}

// 5. Dynamic Storefront Loader
async function loadShopData() {
  if ($("current-year")) $("current-year").textContent = new Date().getFullYear();

  const params = new URLSearchParams(window.location.search);
  const slug = (params.get("shop") || "memonlock").trim().toLowerCase();

  try {
    const res = await fetch(SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action: "getStoreConfig", shopId: slug })
    });
    const data = await res.json();

    if (data.status === "success" && data.store) {
      storeData = data.store;
      renderStorefront(storeData);
    }
  } catch (err) {
    console.warn("Using offline fallback data:", err);
  }
}

function renderStorefront(store) {
  document.title = `${store.shopName} | Verified Local Merchant`;
  if ($("page-title")) $("page-title").textContent = `${store.shopName} | Verified Local Merchant`;
  if ($("nav-brand-name")) $("nav-brand-name").textContent = store.shopName;
  if ($("shop-name")) $("shop-name").textContent = store.shopName;
  if ($("footer-shop-name")) $("footer-shop-name").textContent = store.shopName;

  if (store.tagline && $("shop-tagline")) {
    $("shop-tagline").textContent = store.tagline;
  }

  // Real-time Open/Closed status sync
  const statusPill = $("live-status-pill");
  const statusText = $("live-status-text");
  if (statusPill && statusText) {
    if (store.isOpen === false) {
      statusPill.classList.add("closed");
      statusText.textContent = "Currently Closed";
    } else {
      statusPill.classList.remove("closed");
      statusText.textContent = `Open • Closes ${store.closingTime || '9:00 PM'}`;
    }
  }

  // Google Review CTA
  if (store.reviewUrl && store.reviewUrl.length > 5 && $("google-review-btn")) {
    $("google-review-btn").href = store.reviewUrl;
  }

  // Direct Phone & WhatsApp Actions
  if (store.ownerMobile) {
    const cleanMobile = store.ownerMobile.replace(/[^0-9]/g, '');
    if ($("call-btn")) $("call-btn").href = `tel:+91${cleanMobile}`;
    if ($("call-btn-text")) $("call-btn-text").textContent = `Call Shop: +91 ${cleanMobile}`;

    const defaultWaMsg = encodeURIComponent(`Hello ${store.shopName}, I am contacting you from your digital counter desk.`);
    if ($("whatsapp-btn")) $("whatsapp-btn").href = `https://wa.me/91${cleanMobile}?text=${defaultWaMsg}`;

    // Connect service inquiry buttons to WhatsApp
    document.querySelectorAll(".service-inquire-trigger").forEach(btn => {
      const serviceName = btn.getAttribute("data-service") || "your services";
      const inquiryMsg = encodeURIComponent(`Hello ${store.shopName}, I would like to inquire about: ${serviceName}.`);
      btn.href = `https://wa.me/91${cleanMobile}?text=${inquiryMsg}`;
      btn.target = "_blank";
      btn.rel = "noopener noreferrer";
    });
  }

  // Map Iframe & 1-Tap Driving Directions
  if (store.mapEmbedUrl && store.mapEmbedUrl.length > 10) {
    if ($("map-frame")) $("map-frame").src = store.mapEmbedUrl;
    if ($("directions-btn")) $("directions-btn").href = store.mapEmbedUrl;
  }
}

window.addEventListener("DOMContentLoaded", loadShopData);
