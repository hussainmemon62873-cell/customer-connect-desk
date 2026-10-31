const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzNt9UcAPPSRYP5M9pXhqcBy9gLlqK1-DDajTrcoC-FfCa1psTwlhmSQRygCvxgXUJb/exec";


let globalStoreData = null;
let carouselIndex = 0;
let carouselTimer = null;

function getShopParam() {
  const urlParams = new URLSearchParams(window.location.search);
  return (urlParams.get("shop") || "memonlock").trim().toLowerCase();
}

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

async function loadStore() {
  const slug = getShopParam();
  document.getElementById("footer-year").textContent = new Date().getFullYear();

  try {
    const res = await fetch(SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action: "getStoreConfig", shopId: slug, slug: slug })
    });
    const data = await res.json();
    if (data.status === "success" && data.store) {
      globalStoreData = data.store;
      renderStore(data.store);
    } else {
      document.getElementById("hero-card").innerHTML = `<h2>Store Not Found</h2><p>Please verify the slug.</p>`;
    }
  } catch (e) {
    document.getElementById("hero-card").innerHTML = `<h2>Offline</h2><p>Unable to connect to server.</p>`;
  }
}

function renderStore(store) {
  // Brand Header & Title
  document.getElementById("nav-brand").textContent = store.shopName;
  document.getElementById("footer-name").textContent = store.shopName;
  document.getElementById("shop-name").textContent = store.shopName;
  document.title = `${store.shopName} | Official Store`;

  // Apply colors
  if (store.primaryColor) document.documentElement.style.setProperty('--accent', store.primaryColor);
  if (store.bgColor) document.documentElement.style.setProperty('--bg', store.bgColor);
  if (store.cardBg) document.documentElement.style.setProperty('--card-bg', store.cardBg);

  // Tagline (Omit if empty)
  const taglineEl = document.getElementById("shop-tagline");
  if (store.tagline && store.tagline !== "Dbbdndn") {
    taglineEl.textContent = store.tagline;
    taglineEl.style.display = "block";
  } else {
    taglineEl.style.display = "none";
  }

  // Open/Close Pill & Timing
  const closingFormatted = formatClosingTime(store.closingTime);
  const isSuspended = String(store.registrationStatus).toUpperCase() === "SUSPENDED";
  const isOpen = store.isOpen !== false && store.isOpen !== "CLOSED" && !isSuspended;

  const pill = document.getElementById("shop-status-pill");
  const pillText = document.getElementById("shop-status-text");
  pill.className = `status-pill ${isOpen ? 'open' : 'closed'}`;
  pillText.textContent = isOpen ? `OPEN NOW · Closes at ${closingFormatted}` : "CURRENTLY CLOSED";

  document.getElementById("info-closing-time").textContent = closingFormatted;
  const phone = store.ownerMobile || "";
  if (phone) {
    document.getElementById("info-phone").textContent = `+91 ${phone}`;
  } else {
    document.getElementById("row-phone").style.display = "none";
  }

  // Action Buttons
  const actionsWrap = document.getElementById("shop-actions");
  actionsWrap.innerHTML = `
    ${phone ? `<a href="tel:${phone}" class="btn-action btn-call">📞 Call Shop</a>` : ''}
    ${phone ? `<a href="https://wa.me/91${phone}?text=Hello%20${encodeURIComponent(store.shopName)},%20I%20found%20you%20online." target="_blank" class="btn-action btn-whatsapp">💬 WhatsApp</a>` : ''}
    ${store.mapEmbedUrl ? `<a href="${store.mapEmbedUrl}" target="_blank" class="btn-action btn-directions">📍 Get Directions</a>` : ''}
    ${store.reviewUrl ? `<a href="${store.reviewUrl}" target="_blank" class="btn-action btn-review">⭐ Leave 5-Star Review</a>` : ''}
  `;

  // Render Carousel if banners exist
  renderCarousel(store.banners);

  // Render Dynamic Sections & Build Navigation Bar
  buildNavigationAndTabs(store);
}

function renderCarousel(banners) {
  const wrap = document.getElementById("carousel-wrap");
  const track = document.getElementById("carousel-track");
  const dots = document.getElementById("carousel-dots");

  if (!banners || banners.length === 0) {
    wrap.style.display = "none";
    return;
  }

  wrap.style.display = "block";
  track.innerHTML = banners.map(img => `<img src="${img}" class="carousel-slide" alt="Banner" />`).join('');
  dots.innerHTML = banners.map((_, i) => `<span class="dot ${i === 0 ? 'active' : ''}"></span>`).join('');

  if (banners.length > 1) {
    clearInterval(carouselTimer);
    carouselTimer = setInterval(() => {
      carouselIndex = (carouselIndex + 1) % banners.length;
      track.style.transform = `translateX(-${carouselIndex * 100}%)`;
      document.querySelectorAll(".dot").forEach((d, i) => d.classList.toggle("active", i === carouselIndex));
    }, 3500);
  }
}

function buildNavigationAndTabs(store) {
  const nav = document.getElementById("dynamic-nav");
  nav.innerHTML = `<button type="button" class="nav-btn active" onclick="switchTab('home')">Home</button>`;

  // Services
  if (store.services && store.services.length > 0) {
    nav.innerHTML += `<button type="button" class="nav-btn" onclick="switchTab('services')">Services</button>`;
    document.getElementById("services-container").innerHTML = store.services.map(s => `
      <div class="service-card">
        <span class="service-icon">${s.icon || '🔑'}</span>
        <div class="service-body">
          <h3>${s.title}</h3>
          <p>${s.desc}</p>
        </div>
      </div>
    `).join('');
  }

  // About
  if (store.aboutText && store.aboutText.trim()) {
    nav.innerHTML += `<button type="button" class="nav-btn" onclick="switchTab('about')">About</button>`;
    document.getElementById("about-container").innerHTML = `<p>${store.aboutText}</p>`;
  }

  // Pricing
  if (store.pricing && store.pricing.length > 0) {
    nav.innerHTML += `<button type="button" class="nav-btn" onclick="switchTab('pricing')">Pricing</button>`;
    document.getElementById("pricing-container").innerHTML = store.pricing.map(p => `
      <div class="pricing-card">
        <div>
          <h3>${p.item}</h3>
          <p>${p.desc || ''}</p>
        </div>
        <div class="price-tag">${p.price}</div>
      </div>
    `).join('');
  }

  // Blog
  if (store.blog && store.blog.length > 0) {
    nav.innerHTML += `<button type="button" class="nav-btn" onclick="switchTab('blog')">Blog</button>`;
    document.getElementById("blog-container").innerHTML = store.blog.map(b => `
      <div class="blog-card">
        <div>
          <span style="font-size:0.75rem; color:var(--text-muted);">${b.date || ''}</span>
          <h3>${b.title}</h3>
          <p>${b.content}</p>
        </div>
      </div>
    `).join('');
  }

  // Contact
  nav.innerHTML += `<button type="button" class="nav-btn" onclick="switchTab('contact')">Contact</button>`;
  document.getElementById("contact-container").innerHTML = `
    <p><strong>Physical Address:</strong> ${store.address || 'Local Shop Address, Nadiad'}</p>
    <p style="margin-top:6px;"><strong>Phone:</strong> +91 ${store.ownerMobile || '9979955386'}</p>
    <p style="margin-top:6px;"><strong>Status:</strong> Verified Retailer</p>
  `;
}

function switchTab(tabName) {
  document.querySelectorAll(".tab-view").forEach(el => el.classList.remove("active"));
  document.querySelectorAll(".nav-btn").forEach(btn => btn.classList.remove("active"));

  const targetView = document.getElementById(`view-${tabName}`);
  if (targetView) targetView.classList.add("active");

  const matchingBtn = Array.from(document.querySelectorAll(".nav-btn")).find(b => b.textContent.toLowerCase() === tabName);
  if (matchingBtn) matchingBtn.classList.add("active");

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Global Policy Modal Engine
function openPolicyModal(type) {
  if (!globalStoreData || !globalStoreData.policies) return;
  const p = globalStoreData.policies;
  const modal = document.getElementById("policy-modal");
  const title = document.getElementById("modal-title");
  const body = document.getElementById("modal-content");

  if (type === "privacy") {
    title.textContent = "Privacy Policy";
    body.innerHTML = `<p>${p.privacy || "We respect user privacy and adhere to data protection guidelines."}</p>`;
  } else if (type === "terms") {
    title.textContent = "Terms & Conditions";
    body.innerHTML = `<p>${p.terms || "Standard business terms apply for walk-in services and estimates."}</p>`;
  } else if (type === "cookies") {
    title.textContent = "Cookie Policy";
    body.innerHTML = `<p>${p.cookies || "This site uses essential session tokens and no tracking cookies."}</p>`;
  } else if (type === "faq") {
    title.textContent = "Frequently Asked Questions";
    body.innerHTML = (p.faq || []).map(f => `<div style="margin-bottom:12px;"><strong>${f.q}</strong><p>${f.a}</p></div>`).join('');
  }
  modal.hidden = false;
}

function closePolicyModal() {
  document.getElementById("policy-modal").hidden = true;
}

window.addEventListener("DOMContentLoaded", loadStore);
