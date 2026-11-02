const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzNPnuDhiXOrm4-tRJJ7wXpb7PMwifLQfK-i3pbW-QaOrU74fm-PFgh9aT2sntGLZgx/exec";

let globalStoreData = null;
let carouselIndex = 0;
let carouselTimer = null;

const byId = id => document.getElementById(id);
const escapeHtml = value => String(value == null ? "" : value).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function safeExternalUrl(value) {
  try {
    const url = new URL(String(value || ""), window.location.href);
    return ["https:", "http:"].includes(url.protocol) ? url.href : "";
  } catch (e) { return ""; }
}

function safePhone(value) { return String(value || "").replace(/\D/g, "").slice(-15); }
function ensureResponsiveShopNavigation() {
  if (document.getElementById('ccd-shop-nav-wrap-style')) return;
  const style = document.createElement('style');
  style.id = 'ccd-shop-nav-wrap-style';
  style.textContent = '.nav-links{display:flex;flex-wrap:wrap!important;overflow:visible!important;white-space:normal!important;gap:8px;}.nav-links .nav-btn{flex:0 1 auto;white-space:normal!important;max-width:100%;}@media(max-width:640px){.nav-links{justify-content:center;}.nav-links .nav-btn{font-size:.82rem;padding:8px 10px;}}';
  document.head.appendChild(style);
}

function renderParagraphs(value) {
  return String(value || '').split(/\n\s*\n/).map(part => part.trim()).filter(Boolean)
    .map(part => `<p>${escapeHtml(part).replace(/\n/g, '<br>')}</p>`).join('');
}

function safeColor(value, fallback) { return /^#[0-9a-fA-F]{6}$/.test(String(value || "")) ? value : fallback; }

function getShopParam() {
  const params = new URLSearchParams(window.location.search);
  return (params.get("shop") || "memonlock").trim().toLowerCase();
}

function formatClosingTime(rawTime) {
  if (!rawTime) return "9:00 PM";
  const str = String(rawTime).trim();
  if (!str.includes("1899") && !str.includes("T")) return str;
  try {
    const date = new Date(str);
    if (isNaN(date.getTime())) return "9:00 PM";
    return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", hour12: true });
  } catch (e) { return "9:00 PM"; }
}

async function loadStore() {
  const slug = getShopParam();
  if (byId("footer-year")) byId("footer-year").textContent = new Date().getFullYear();
  try {
    const res = await fetch(SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action: "getStoreConfig", shopId: slug, slug })
    });
    const data = await res.json();
    if (data.status === "success" && data.store) {
      globalStoreData = data.store;
      renderStore(data.store);
    } else {
      if (byId("hero-card")) byId("hero-card").innerHTML = `<h2>Store Not Found</h2><p>Please verify the store link.</p>`;
    }
  } catch (e) {
    if (byId("hero-card")) byId("hero-card").innerHTML = `<h2>Offline</h2><p>Unable to connect to server.</p>`;
  }
}

function renderStore(store) {
  const shopName = escapeHtml(store.shopName || "Store");
  if (byId("nav-brand")) byId("nav-brand").textContent = store.shopName || "Store";
  if (byId("footer-name")) byId("footer-name").textContent = store.shopName || "Store";
  if (byId("shop-name")) byId("shop-name").textContent = store.shopName || "Store";
  document.title = `${store.shopName || "Store"} | Official Store`;

  document.documentElement.style.setProperty("--accent", safeColor(store.primaryColor, "#2563eb"));
  document.documentElement.style.setProperty("--bg", safeColor(store.bgColor, "#ffffff"));
  document.documentElement.style.setProperty("--card-bg", safeColor(store.cardBg, "#ffffff"));

  const taglineEl = byId("shop-tagline");
  if (taglineEl) {
    if (store.tagline && store.tagline !== "Dbbdndn") { taglineEl.textContent = store.tagline; taglineEl.style.display = "block"; }
    else taglineEl.style.display = "none";
  }

  const closingFormatted = formatClosingTime(store.closingTime);
  const status = String(store.registrationStatus || "ACTIVE").toUpperCase();
  const isSuspended = status !== "ACTIVE";
  const isOpen = store.isOpen !== false && store.isOpen !== "CLOSED" && !isSuspended;
  const pill = byId("shop-status-pill"), pillText = byId("shop-status-text");
  if (pill) pill.className = `status-pill ${isOpen ? "open" : "closed"}`;
  if (pillText) pillText.textContent = isOpen ? `OPEN NOW · Closes at ${closingFormatted}` : "CURRENTLY CLOSED";
  if (byId("info-closing-time")) byId("info-closing-time").textContent = closingFormatted;
  const heroCard = byId("hero-card");
  if (heroCard) {
    let homeContent = byId("home-content");
    if (!homeContent) { homeContent = document.createElement("div"); homeContent.id = "home-content"; homeContent.style.marginTop = "16px"; heroCard.appendChild(homeContent); }
    const homeVisible = !store.contentVisibility || store.contentVisibility.homeText !== false;
    homeContent.innerHTML = homeVisible ? renderParagraphs(store.homeText || "") : "";
    homeContent.style.display = homeVisible && store.homeText && String(store.homeText).trim() ? "block" : "none";
  }

  const phone = safePhone(store.ownerMobile || "");
  if (phone) {
    if (byId("info-phone")) byId("info-phone").textContent = `+91 ${phone}`;
  } else if (byId("row-phone")) byId("row-phone").style.display = "none";

  const mapUrl = safeExternalUrl(store.mapEmbedUrl);
  const reviewUrl = safeExternalUrl(store.reviewUrl);
  const actionsWrap = byId("shop-actions");
  if (actionsWrap) {
    actionsWrap.innerHTML = `
      ${phone ? `<a href="tel:${phone}" class="btn-action btn-call">📞 Call Shop</a>` : ""}
      ${phone ? `<a href="https://wa.me/91${phone}?text=Hello%20${encodeURIComponent(store.shopName || "Store")},%20I%20found%20you%20online." target="_blank" rel="noopener noreferrer" class="btn-action btn-whatsapp">💬 WhatsApp</a>` : ""}
      ${mapUrl ? `<a href="${escapeHtml(mapUrl)}" target="_blank" rel="noopener noreferrer" class="btn-action btn-directions">📍 Get Directions</a>` : ""}
      ${reviewUrl ? `<a href="${escapeHtml(reviewUrl)}" target="_blank" rel="noopener noreferrer" class="btn-action btn-review">⭐ Leave 5-Star Review</a>` : ""}
      ${store.promoEnabled && (store.promoHeadline || store.promoCode) ? `<div class="btn-action" style="display:block; flex-basis:100%; background:#fff7ed; color:#9a3412; border:1px solid #fed7aa; padding:12px 14px;"><strong>${escapeHtml(store.promoHeadline || "Special offer")}</strong>${store.promoDescription ? `<div>${escapeHtml(store.promoDescription)}</div>` : ""}${store.promoCode ? `<div>Use code: <strong>${escapeHtml(store.promoCode)}</strong></div>` : ""}</div>` : ""}
    `;
  }

  renderCarousel(Array.isArray(store.banners) ? store.banners : []);
  buildNavigationAndTabs(store);
}

function renderCarousel(banners) {
  const wrap = byId("carousel-wrap"), track = byId("carousel-track"), dots = byId("carousel-dots");
  if (!wrap || !track || !dots) return;
  const safeBanners = (banners || []).map(safeExternalUrl).filter(Boolean);
  if (!safeBanners.length) { wrap.style.display = "none"; track.innerHTML = ""; dots.innerHTML = ""; return; }
  wrap.style.display = "block";
  track.innerHTML = safeBanners.map(url => `<img src="${escapeHtml(url)}" class="carousel-slide" alt="Banner" loading="lazy" />`).join("");
  dots.innerHTML = safeBanners.map((_, i) => `<span class="dot ${i === 0 ? "active" : ""}"></span>`).join("");
  carouselIndex = 0;
  clearInterval(carouselTimer);
  if (safeBanners.length > 1) {
    carouselTimer = setInterval(() => {
      carouselIndex = (carouselIndex + 1) % safeBanners.length;
      track.style.transform = `translateX(-${carouselIndex * 100}%)`;
      document.querySelectorAll(".dot").forEach((dot, i) => dot.classList.toggle("active", i === carouselIndex));
    }, 3500);
  }
}

function buildNavigationAndTabs(store) {
  const nav = byId("dynamic-nav");
  if (!nav) return;
  nav.innerHTML = `<button type="button" class="nav-btn active" onclick="switchTab('home')">Home</button>`;

  const visibility = store.contentVisibility || {};
  const services = Array.isArray(store.services) ? store.services : [];
  if (services.length && visibility.services !== false) {
    nav.innerHTML += `<button type="button" class="nav-btn" onclick="switchTab('services')">Services</button>`;
    if (byId("services-container")) byId("services-container").innerHTML = services.map(s => `
      <div class="service-card"><span class="service-icon">${escapeHtml(s.icon || "🔑")}</span><div class="service-body"><h3>${escapeHtml(s.title || "")}</h3><p>${escapeHtml(s.desc || "")}</p></div></div>
    `).join("");
  }

  if (store.aboutText && String(store.aboutText).trim() && visibility.aboutText !== false) {
    nav.innerHTML += `<button type="button" class="nav-btn" onclick="switchTab('about')">About</button>`;
    if (byId("about-container")) byId("about-container").innerHTML = renderParagraphs(store.aboutText);
  }

  const pricing = Array.isArray(store.pricing) ? store.pricing : [];
  if (pricing.length && visibility.pricing !== false) {
    nav.innerHTML += `<button type="button" class="nav-btn" onclick="switchTab('pricing')">Pricing</button>`;
    if (byId("pricing-container")) byId("pricing-container").innerHTML = pricing.map(p => `
      <div class="pricing-card"><div><h3>${escapeHtml(p.item || "")}</h3><p>${escapeHtml(p.desc || "")}</p></div><div class="price-tag">${escapeHtml(p.price || "")}</div></div>
    `).join("");
  }

  const blog = Array.isArray(store.blog) ? store.blog : [];
  if (blog.length && visibility.blog !== false) {
    nav.innerHTML += `<button type="button" class="nav-btn" onclick="switchTab('blog')">Blog</button>`;
    if (byId("blog-container")) byId("blog-container").innerHTML = blog.map(b => `
      <div class="blog-card"><div><span style="font-size:0.75rem; color:var(--text-muted);">${escapeHtml(b.date || "")}</span><h3>${escapeHtml(b.title || "")}</h3><p>${escapeHtml(b.content || "")}</p></div></div>
    `).join("");
  }

  const contactMapUrl = safeExternalUrl(store.mapEmbedUrl);
  const contactReviewUrl = safeExternalUrl(store.reviewUrl);
  const hasContact = visibility.contact !== false && Boolean(
    String(store.address || "").trim() || String(store.ownerMobile || "").trim() ||
    contactMapUrl || contactReviewUrl
  );
  const contactView = byId("view-contact");
  if (hasContact) {
    nav.innerHTML += `<button type="button" class="nav-btn" onclick="switchTab('contact')">Contact</button>`;
    if (byId("contact-container")) {
      byId("contact-container").innerHTML = `
        ${String(store.address || "").trim() ? `<p><strong>Physical Address:</strong> ${escapeHtml(store.address)}</p>` : ""}
        ${String(store.ownerMobile || "").trim() ? `<p style="margin-top:6px;"><strong>Phone:</strong> ${phoneDisplay(store.ownerMobile)}</p>` : ""}
        ${contactMapUrl ? `<p style="margin-top:10px;"><a href="${escapeHtml(contactMapUrl)}" target="_blank" rel="noopener noreferrer">Open location in Maps</a></p>` : ""}
        ${contactMapUrl && /^https:\/\/(www\.)?google\.com\/maps\/embed(?:[/?#]|$)/i.test(contactMapUrl) ? `<iframe class="map-frame" src="${escapeHtml(contactMapUrl)}" title="${escapeHtml(store.shopName || 'Shop')} map" loading="lazy" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>` : ""}
        ${contactReviewUrl ? `<p style="margin-top:10px;"><a href="${escapeHtml(contactReviewUrl)}" target="_blank" rel="noopener noreferrer">Write a Google review</a></p>` : ""}
      `;
    }
  } else {
    if (contactView) contactView.classList.remove("active");
    if (byId("contact-container")) byId("contact-container").innerHTML = "";
  }
}

function phoneDisplay(value) {
  const phone = safePhone(value);
  return phone ? `+91 ${escapeHtml(phone)}` : "Not provided";
}

function switchTab(tabName) {
  document.querySelectorAll(".tab-view").forEach(el => el.classList.remove("active"));
  document.querySelectorAll(".nav-btn").forEach(btn => btn.classList.remove("active"));
  const target = byId(`view-${tabName}`);
  if (target) target.classList.add("active");
  const matchingBtn = Array.from(document.querySelectorAll(".nav-btn")).find(btn => btn.textContent.trim().toLowerCase() === tabName);
  if (matchingBtn) matchingBtn.classList.add("active");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function openPolicyModal(type) {
  if (!globalStoreData || !globalStoreData.policies) return;
  const policies = globalStoreData.policies;
  const modal = byId("policy-modal"), title = byId("modal-title"), body = byId("modal-content");
  if (!modal || !title || !body) return;
  if (type === "privacy") { title.textContent = "Privacy Policy"; body.innerHTML = renderParagraphs(policies.privacy || "We respect user privacy and follow applicable data protection requirements."); }
  else if (type === "terms") { title.textContent = "Terms & Conditions"; body.innerHTML = renderParagraphs(policies.terms || "Standard business terms apply for walk-in services and estimates."); }
  else if (type === "cookies") { title.textContent = "Cookie Policy"; body.innerHTML = renderParagraphs(policies.cookies || "This site uses essential functionality only."); }
  else if (type === "faq") {
    title.textContent = "Frequently Asked Questions";
    body.innerHTML = (Array.isArray(policies.faq) ? policies.faq : []).map(f => `<div style="margin-bottom:12px;"><strong>${escapeHtml(f.q || "")}</strong><p>${escapeHtml(f.a || "")}</p></div>`).join("");
  } else return;
  modal.hidden = false;
}

function closePolicyModal() { if (byId("policy-modal")) byId("policy-modal").hidden = true; }
function ensureStorePresentationStyles() {
  if (document.getElementById('ccd-store-presentation-styles')) return;
  const style = document.createElement('style');
  style.id = 'ccd-store-presentation-styles';
  style.textContent = `
    body { background:#f8fafc !important; color:#0f172a !important; }
    .store-container { background:transparent !important; }
    .nav-links { display:flex !important; flex-wrap:wrap !important; justify-content:flex-end; gap:6px 10px !important; overflow:visible !important; white-space:normal !important; }
    .nav-btn { flex:0 1 auto; white-space:normal !important; }
    .content-box p { margin:0 0 12px; line-height:1.7; }
    #home-content p { margin:0 0 10px; line-height:1.7; }
    @media (max-width:640px) { .nav-links { justify-content:flex-start !important; gap:6px !important; } .nav-btn { font-size:.82rem !important; padding:7px 9px !important; } }
  `;
  document.head.appendChild(style);
}

window.addEventListener("DOMContentLoaded", () => { ensureStorePresentationStyles(); loadStore(); });
