const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzNPnuDhiXOrm4-tRJJ7wXpb7PMwifLQfK-i3pbW-QaOrU74fm-PFgh9aT2sntGLZgx/exec";

let globalStoreData = null;
let carouselIndex = 0;
let carouselTimer = null;
const CCD_CATEGORY_META = {general:{accent:'#2563eb',service:'Services',price:'Pricing'},salon:{accent:'#c77b85',service:'Treatments',price:'Packages'},restaurant:{accent:'#b77932',service:'Menu',price:'Menu'},retail:{accent:'#2563eb',service:'Collections',price:'Products'},grocery:{accent:'#27834a',service:'Departments',price:'Catalogue'},electronics:{accent:'#1677c8',service:'Services',price:'Products'},clinic:{accent:'#16847c',service:'Treatments',price:'Fees'},education:{accent:'#5b62c9',service:'Courses',price:'Fees'},'home-services':{accent:'#246eae',service:'Services',price:'Estimates'},automotive:{accent:'#475569',service:'Services',price:'Estimates'},'real-estate':{accent:'#6956a8',service:'Properties',price:'Listings'},organic:{accent:'#4d8659',service:'Collections',price:'Products'},professional:{accent:'#335c91',service:'Expertise',price:'Fees'}};
const CCD_CATEGORY_KEYS = Object.keys(CCD_CATEGORY_META);
if (window.CCDLoading) window.CCDLoading.hold();

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
  style.textContent = '.nav-links{display:flex;gap:8px;}.nav-links .nav-btn{flex:0 0 auto;white-space:nowrap;}@media(max-width:700px){.nav-links{justify-content:flex-start;flex-wrap:nowrap;overflow-x:auto;white-space:nowrap;}.nav-links .nav-btn{font-size:.82rem;padding:8px 10px;}}';
  document.head.appendChild(style);
}

function renderParagraphs(value) {
  return String(value || '').split(/\n\s*\n/).map(part => part.trim()).filter(Boolean)
    .map(part => `<p>${escapeHtml(part).replace(/\n/g, '<br>')}</p>`).join('');
}

function safeColor(value, fallback) { return /^#[0-9a-fA-F]{6}$/.test(String(value || "")) ? value : fallback; }

function getShopParam() {
  const params = new URLSearchParams(window.location.search);
  const host = String(window.location.hostname || '').toLowerCase();
  const base = 'ccd.dev';
  const hostSlug = host.endsWith('.' + base) ? host.slice(0, -(base.length + 1)) : '';
  const reserved = ['www','admin','register','api','assets','support','mail'];
  const slug = (params.get('shop') || (hostSlug && !reserved.includes(hostSlug) ? hostSlug : '') || 'memonlock').trim().toLowerCase();
  return /^[a-z0-9_-]{3,50}$/.test(slug) ? slug : 'memonlock';
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
      body: JSON.stringify({ action: "getStoreConfig", shopId: slug, slug, clientType: "SHOP" })
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

function renderDynamicMedia(items) {
  const list = Array.isArray(items) ? items.filter(x => x && x.visible !== false && safeExternalUrl(x.url)) : [];
  let section = document.getElementById('view-media');
  if (!section) {
    section = document.createElement('section'); section.id = 'view-media'; section.dataset.ccdDynamicMedia = '1';
    section.className = 'tab-view'; section.innerHTML = '<h2 class="section-heading">Gallery & videos</h2><div class="ccd-media-grid" id="ccd-media-grid"></div>';
    const main = document.querySelector('.store-container'); if (main) main.appendChild(section);
    const nav = document.getElementById('dynamic-nav');
    if (nav && !nav.querySelector('[data-tab="media"]')) { const b=document.createElement('button'); b.type='button'; b.className='nav-btn'; b.dataset.tab='media'; b.textContent='Gallery'; b.addEventListener('click',()=>switchTab('media')); nav.appendChild(b); }
    if (!document.getElementById('ccd-media-style')) { const st=document.createElement('style'); st.id='ccd-media-style'; st.textContent='.ccd-media-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px}.ccd-media-card{overflow:hidden;border-radius:16px;background:var(--card-bg,#fff);box-shadow:0 6px 24px #0f172a12}.ccd-media-card img,.ccd-media-card video{display:block;width:100%;max-height:420px;object-fit:cover;background:#0f172a}.ccd-media-caption{padding:12px;font-weight:600}'; document.head.appendChild(st); }
  }
  const grid = document.getElementById('ccd-media-grid'); if (!grid) return;
  grid.innerHTML = list.map(item => { const url=escapeHtml(safeExternalUrl(item.url)); const caption=escapeHtml(item.caption||''); const type=String(item.type||'image').toLowerCase(); const media=type==='video' ? `<video controls playsinline preload="metadata" src="${url}"></video>` : `<img loading="lazy" src="${url}" alt="${caption||'Shop gallery image'}">`; return `<article class="ccd-media-card">${media}${caption?`<div class="ccd-media-caption">${caption}</div>`:''}</article>`; }).join('');
  section.style.display = list.length ? '' : 'none';
}

function renderStore(store) {
  const shopName = escapeHtml(store.shopName || "Store");
  document.getElementById("ccd-seo-snapshot")?.remove();
  updateShopShareMetadata(store);
  if (byId("nav-brand")) byId("nav-brand").textContent = store.shopName || "Store";
  if (byId("footer-name")) byId("footer-name").textContent = store.shopName || "Store";
  if (byId("shop-name")) byId("shop-name").textContent = store.shopName || "Store";
  document.title = `${store.shopName || "Store"} | Official Store`;
  const categoryKey = String(store.categoryKey || store.layoutStyle || 'general').toLowerCase();
  const layout = CCD_CATEGORY_KEYS.includes(categoryKey) ? categoryKey : 'general';
  const categoryMeta = CCD_CATEGORY_META[layout] || CCD_CATEGORY_META.general;
  document.documentElement.dataset.ccdLayout = layout;
  document.documentElement.dataset.ccdExperience = String(store.experienceMode || 'WEBSITE_COMMUNICATION').toLowerCase();
  store.experienceMode = String(store.experienceMode || 'WEBSITE_COMMUNICATION').toUpperCase();

  const savedAccent = safeColor(store.primaryColor, categoryMeta.accent);
  const accent = savedAccent.toLowerCase() === '#2563eb' && layout !== 'general' ? categoryMeta.accent : savedAccent;
  document.documentElement.style.setProperty("--accent", accent);
  document.documentElement.style.setProperty("--category-accent", categoryMeta.accent);
  document.documentElement.style.setProperty("--bg", safeColor(store.bgColor, "#ffffff"));
  document.documentElement.style.setProperty("--card-bg", safeColor(store.cardBg, "#ffffff"));
  const heroBanner = Array.isArray(store.banners) ? safeExternalUrl(store.banners[0]) : '';
  if (heroBanner) document.documentElement.style.setProperty('--ccd-hero-image', 'url(' + JSON.stringify(heroBanner) + ')');
  else document.documentElement.style.removeProperty('--ccd-hero-image');

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
      ${phone && store.whatsappContactTemplate && store.whatsappContactTemplate.body ? `<a href="https://wa.me/91${phone}?text=${encodeURIComponent(String(store.whatsappContactTemplate.body).replace(/\{\{([a-zA-Z0-9_]+)\}\}/g,(_,k)=>({shopName:store.shopName||'Store',shopId:store.shopId||'',shopUrl:`https://${encodeURIComponent(store.shopId||'')}.ccd.dev/` }[k]||'')))}" target="_blank" rel="noopener noreferrer" class="btn-action btn-whatsapp">💬 WhatsApp</a>` : ""}
      ${mapUrl ? `<a href="${escapeHtml(mapUrl)}" target="_blank" rel="noopener noreferrer" class="btn-action btn-directions">📍 Get Directions</a>` : ""}
      ${reviewUrl ? `<a href="${escapeHtml(reviewUrl)}" target="_blank" rel="noopener noreferrer" class="btn-action btn-review">⭐ Leave 5-Star Review</a>` : ""}
      <button type="button" class="btn-action btn-share" id="ccd-share-shop">↗ Share this shop</button>
      ${store.promoEnabled && (store.promoHeadline || store.promoCode) ? `<div class="btn-action" style="display:block; flex-basis:100%; background:#fff7ed; color:#9a3412; border:1px solid #fed7aa; padding:12px 14px;"><strong>${escapeHtml(store.promoHeadline || "Special offer")}</strong>${store.promoDescription ? `<div>${escapeHtml(store.promoDescription)}</div>` : ""}${store.promoCode ? `<div>Use code: <strong>${escapeHtml(store.promoCode)}</strong></div>` : ""}</div>` : ""}
    `;
    const shareButton = byId("ccd-share-shop");
    if (shareButton) shareButton.addEventListener("click", shareShopPage);
  }

  renderCarousel(Array.isArray(store.banners) ? store.banners : []);
  renderDynamicMedia(store.media || store.mediaItems || []);
  buildNavigationAndTabs(store);
  if (window.CCDAdsense && typeof window.CCDAdsense.refresh === "function") window.CCDAdsense.refresh();
}

function setMeta(selector, attribute, value, createName, createAttribute) {
  let element = document.querySelector(selector);
  if (!element && createName) {
    element = document.createElement('meta');
    element.setAttribute(createAttribute || 'name', createName);
    document.head.appendChild(element);
  }
  if (element) element.setAttribute(attribute, String(value || ''));
}

function updateShopShareMetadata(store) {
  const name = String(store.shopName || 'Local business').trim();
  const category = String(store.categoryKey || store.layoutStyle || 'local business').replace(/[-_]/g, ' ');
  const visibility = store.contentVisibility || {};
  const publicHome = visibility.homeText === false ? '' : store.homeText;
  const publicAbout = visibility.aboutText === false ? '' : store.aboutText;
  const description = [store.tagline, publicHome, publicAbout].filter(Boolean).join(' ').replace(/\s+/g, ' ').slice(0, 220) ||
    `Explore ${name}'s official business page on Customer Connect Desk.`;
  const url = window.location.hostname.endsWith('.ccd.dev') ? `https://${window.location.hostname}/` : `https://${getShopParam()}.ccd.dev/`;
  const title = `${name} | ${category} | Customer Connect Desk`;
  document.title = title;
  setMeta('meta[name="description"]', 'content', description, 'description', 'name');
  setMeta('meta[property="og:title"]', 'content', title, 'og:title', 'property');
  setMeta('meta[property="og:description"]', 'content', description, 'og:description', 'property');
  setMeta('meta[property="og:url"]', 'content', url, 'og:url', 'property');
  setMeta('meta[name="twitter:title"]', 'content', title, 'twitter:title', 'name');
  setMeta('meta[name="twitter:description"]', 'content', description, 'twitter:description', 'name');
}

async function shareShopPage() {
  const store = globalStoreData || {};
  const name = String(store.shopName || 'Local business').trim();
  const visibility = store.contentVisibility || {};
  const tagline = String(store.tagline || '').trim();
  const publicHome = visibility.homeText === false ? '' : String(store.homeText || '').trim();
  const category = String(store.categoryKey || store.layoutStyle || 'local business').replace(/[-_]/g, ' ').trim();
  const detail = tagline || publicHome;
  const slug = getShopParam();
  const url = window.location.hostname.endsWith('.ccd.dev') ? `https://${window.location.hostname}/` : `https://${slug}.ccd.dev/`;
  const title = `${name} | Official ${category} page`;
  const text = `${name}${detail ? ' — ' + detail : ''}. Explore the official ${category} page on Customer Connect Desk for published business information, services and contact details.`;
  try {
    if (navigator.share) {
      await navigator.share({ title, text, url });
      return;
    }
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(`${text}\n${url}`);
      const button = byId('ccd-share-shop');
      if (button) { const previous = button.textContent; button.textContent = '✓ Link copied'; setTimeout(() => { button.textContent = previous; }, 2200); }
      return;
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}`, '_blank', 'noopener,noreferrer');
  } catch (error) {
    if (error && error.name !== 'AbortError') {
      window.open(`https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}`, '_blank', 'noopener,noreferrer');
    }
  }
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
  const pricing = Array.isArray(store.pricing) ? store.pricing : [];
  const blog = Array.isArray(store.blog) ? store.blog : [];
  const media = Array.isArray(store.media || store.mediaItems) ? (store.media || store.mediaItems).filter(item => item && item.visible !== false && safeExternalUrl(item.url)) : [];
  const availableTargets = new Set(['home']);
  if (services.length && visibility.services !== false) availableTargets.add('services');
  if (pricing.length && visibility.pricing !== false) availableTargets.add('pricing');
  if (store.aboutText && String(store.aboutText).trim() && visibility.aboutText !== false) availableTargets.add('about');
  if (blog.length && visibility.blog !== false) availableTargets.add('blog');
  if (media.length) availableTargets.add('media');
  if (visibility.contact !== false && (String(store.address || '').trim() || String(store.ownerMobile || '').trim() || safeExternalUrl(store.mapEmbedUrl) || safeExternalUrl(store.reviewUrl))) availableTargets.add('contact');
  if (services.length && visibility.services !== false) {
    const serviceLabel = (CCD_CATEGORY_META[String(store.categoryKey || store.layoutStyle || 'general').toLowerCase()] || CCD_CATEGORY_META.general).service;
    nav.innerHTML += `<button type="button" class="nav-btn" onclick="switchTab('services')">${serviceLabel}</button>`;
    if (byId("services-container")) byId("services-container").innerHTML = services.map(s => `
      <div class="service-card"><span class="service-icon">${escapeHtml(s.icon || "🔑")}</span><div class="service-body"><h3>${escapeHtml(s.title || "")}</h3><p>${escapeHtml(s.desc || "")}</p></div></div>
    `).join("");
  }

  if (store.aboutText && String(store.aboutText).trim() && visibility.aboutText !== false) {
    nav.innerHTML += `<button type="button" class="nav-btn" onclick="switchTab('about')">About</button>`;
    if (byId("about-container")) byId("about-container").innerHTML = renderParagraphs(store.aboutText);
  }

  if (pricing.length && visibility.pricing !== false) {
    const priceLabel = (CCD_CATEGORY_META[String(store.categoryKey || store.layoutStyle || 'general').toLowerCase()] || CCD_CATEGORY_META.general).price;
    nav.innerHTML += `<button type="button" class="nav-btn" onclick="switchTab('pricing')">${priceLabel}</button>`;
    if (byId("pricing-container")) byId("pricing-container").innerHTML = pricing.map(p => `
      <div class="pricing-card"><div><h3>${escapeHtml(p.item || "")}</h3><p>${escapeHtml(p.desc || "")}</p></div><div class="price-tag">${escapeHtml(p.price || "")}</div></div>
    `).join("");
  }

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

  const mode = String(store.experienceMode || 'WEBSITE_COMMUNICATION').toUpperCase();
  if (mode === 'MENU_ONLY') {
    document.querySelectorAll('.tab-view').forEach(view => view.classList.remove('active'));
    const menuView = byId('view-pricing');
    if (menuView) menuView.classList.add('active');
    nav.innerHTML = '<button type="button" class="nav-btn active" data-tab="pricing">' + escapeHtml((CCD_CATEGORY_META[String(store.categoryKey || store.layoutStyle || 'general').toLowerCase()] || CCD_CATEGORY_META.general).price) + '</button>';
    nav.querySelector('[data-tab="pricing"]')?.addEventListener('click', () => switchTab('pricing'));
    const intro = byId('view-home'); if (intro) intro.classList.remove('active');
    document.querySelectorAll('.tab-view').forEach(view => { if (view.id !== 'view-pricing') view.dataset.menuHidden = '1'; });
    return;
  }

  if (media.length) nav.innerHTML += '<button type="button" class="nav-btn" data-tab="media">Gallery</button>';
  const configured = Array.isArray(store.navigation) ? store.navigation : [];
  if (configured.length) {
    const customItems = configured.filter(item => item && String(item.label || '').trim() && availableTargets.has(String(item.target || '')) && byId('view-' + item.target));
    if (customItems.length) {
      const unique = [], seen = new Set();
      customItems.forEach(item => { const key = String(item.target); if (!seen.has(key)) { seen.add(key); unique.push(item); } });
      nav.innerHTML = unique.map((item, index) => `<button type="button" class="nav-btn${index===0?' active':''}" data-tab="${escapeHtml(item.target)}">${escapeHtml(item.label)}</button>`).join('');
      nav.querySelectorAll('[data-tab]').forEach(button => button.addEventListener('click', () => switchTab(button.dataset.tab)));
    }
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
  const matchingBtn = Array.from(document.querySelectorAll(".nav-btn")).find(btn => (btn.dataset.tab || btn.textContent.trim().toLowerCase()) === tabName);
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
    .nav-links { display:flex !important; flex-wrap:nowrap !important; justify-content:flex-end; gap:6px 10px !important; overflow-x:auto !important; white-space:nowrap !important; }
    .nav-btn { flex:0 0 auto; white-space:nowrap !important; }
    .content-box p { margin:0 0 12px; line-height:1.7; }
    #home-content p { margin:0 0 10px; line-height:1.7; }
    @media (max-width:700px) { .nav-links { justify-content:flex-start !important; gap:6px !important; overflow-x:auto !important; } .nav-btn { flex:0 0 auto; font-size:.82rem !important; padding:7px 9px !important; } }
  `;
  document.head.appendChild(style);
}

window.addEventListener("DOMContentLoaded", () => { ensureStorePresentationStyles(); loadStore().finally(() => window.CCDLoading && window.CCDLoading.finish()); });
