// ==========================================
// CUSTOMER DESK ENGINE (desk.js)
// Fast Walk-in Check-in + Direct Review Capture
// ==========================================

const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyq5CbrZ5VzrFEcBh-gfs3iy5UewHoNfJT7ZtLxhHXhhW_bs7R_a0roSqYbZehydJCn/exec";

const $ = id => document.getElementById(id);

const urlParams = new URLSearchParams(window.location.search);
const currentShopId = (urlParams.get("shop") || "memonlock").trim().toLowerCase();

let cachedStoreData = null;
let resetTimer = null;

// 1. Initialize Desk UI & Prefetch Store Profile
window.addEventListener("DOMContentLoaded", async () => {
  setupDobInputs();
  await fetchStoreThemeAndConfig();

  // If a customer revisits on their own device, restore their phone
  const savedPhone = localStorage.getItem("ccd_last_phone");
  if (savedPhone && savedPhone.length === 10 && $("customer-phone")) {
    $("customer-phone").value = savedPhone;
    checkCustomerLookup(savedPhone);
  }
});

async function apiPost(payload) {
  const res = await fetch(SCRIPT_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload)
  });
  return res.json();
}

async function fetchStoreThemeAndConfig() {
  try {
    // Primary: Read store config cleanly without dummy lookup
    let data = await apiPost({ action: "getStoreConfig", shopId: currentShopId, slug: currentShopId });
    let store = data && (data.store || data.config || (data.shopName ? data : null));

    // Fallback: If backend is running older router
    if (!store || !store.shopName) {
      const fallbackData = await apiPost({
        action: "customerCheckin",
        actionType: "lookup",
        shopId: currentShopId,
        phone: "0000000000"
      });
      if (fallbackData && fallbackData.store) {
        store = fallbackData.store;
      }
    }

    if (store && store.shopName) {
      cachedStoreData = store;
      applyStoreTheme(store);
    }
  } catch (e) {
    console.warn("Using offline / default desk config");
  }
}

function applyStoreTheme(store) {
  if ($("shop-title")) $("shop-title").textContent = store.shopName;
  if ($("shop-tagline")) $("shop-tagline").textContent = store.tagline || "Quick Walk-in Counter Check-in";
  
  if (store.primaryColor) {
    document.documentElement.style.setProperty('--accent', store.primaryColor);
  }

  const reviewBox = $("direct-review-box");
  const reviewLink = $("direct-review-link");
  if (store.reviewUrl && reviewBox && reviewLink) {
    reviewLink.href = store.reviewUrl;
    reviewBox.style.display = "block";
  } else if (reviewBox) {
    reviewBox.style.display = "none";
  }
}

// 2. Real-time Customer Lookup on 10 Digits
if ($("customer-phone")) {
  $("customer-phone").addEventListener("input", (e) => {
    const phone = e.target.value.replace(/\D/g, '');
    e.target.value = phone;

    if (phone.length === 10) {
      checkCustomerLookup(phone);
    } else {
      if ($("system-notice")) $("system-notice").style.display = "none";
    }
  });
}

async function checkCustomerLookup(phone) {
  try {
    const data = await apiPost({
      action: "customerCheckin",
      actionType: "lookup",
      shopId: currentShopId,
      phone: phone
    });

    if (data.status === "success") {
      const notice = $("system-notice");
      if (data.exists && data.customer) {
        if (notice) {
          notice.style.display = "block";
          notice.textContent = `Welcome back, ${data.customer.name || 'valued customer'}!`;
        }
        if ($("customer-name") && data.customer.name) $("customer-name").value = data.customer.name;
        if ($("customer-email") && data.customer.email) $("customer-email").value = data.customer.email;
        if (data.customer.dob) parseAndSetDob(data.customer.dob);
      } else {
        if (notice) notice.style.display = "none";
      }
    }
  } catch (err) {
    console.warn("Customer lookup bypassed");
  }
}

// 3. Segmented Date of Birth Handling with Bi-Directional Focus
function setupDobInputs() {
  const dd = $("dob-dd");
  const mm = $("dob-mm");
  const yy = $("dob-yy");
  if (!dd || !mm || !yy) return;

  // Auto-advance
  dd.addEventListener("input", () => {
    dd.value = dd.value.replace(/\D/g, '').slice(0, 2);
    if (dd.value.length === 2) mm.focus();
    updateHiddenDob();
  });

  mm.addEventListener("input", () => {
    mm.value = mm.value.replace(/\D/g, '').slice(0, 2);
    if (mm.value.length === 2) yy.focus();
    updateHiddenDob();
  });

  yy.addEventListener("input", () => {
    yy.value = yy.value.replace(/\D/g, '').slice(0, 4);
    updateHiddenDob();
  });

  // Backspace return
  mm.addEventListener("keydown", (e) => {
    if (e.key === "Backspace" && !mm.value) dd.focus();
  });

  yy.addEventListener("keydown", (e) => {
    if (e.key === "Backspace" && !yy.value) mm.focus();
  });
}

function updateHiddenDob() {
  const dd = $("dob-dd");
  const mm = $("dob-mm");
  const yy = $("dob-yy");
  const hidden = $("customer-dob");
  if (!dd || !mm || !yy || !hidden) return;

  const d = dd.value.trim().padStart(2, '0');
  const m = mm.value.trim().padStart(2, '0');
  const y = yy.value.trim();

  if (d.length === 2 && m.length === 2 && y.length === 4) {
    hidden.value = `${y}-${m}-${d}`;
  } else {
    hidden.value = "";
  }
}

function parseAndSetDob(dobStr) {
  try {
    if (!dobStr) return;
    const cleanDate = String(dobStr).split('T')[0];
    const parts = cleanDate.split(/[-/]/);

    if (parts.length === 3) {
      let year, month, day;
      if (parts[0].length === 4) {
        year = parts[0];
        month = parts[1];
        day = parts[2];
      } else {
        day = parts[0];
        month = parts[1];
        year = parts[2];
      }

      if ($("dob-dd")) $("dob-dd").value = (day && day !== '00') ? day.padStart(2, '0') : "";
      if ($("dob-mm")) $("dob-mm").value = (month && month !== '00') ? month.padStart(2, '0') : "";
      if ($("dob-yy")) $("dob-yy").value = (year && year !== '0000') ? year : "";
      updateHiddenDob();
    }
  } catch (e) {
    console.error("DOB parse error", e);
  }
}

// 4. Form Submission (Mobile Number Anchor)
const form = $("checkin-form");
if (form) {
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const phone = $("customer-phone").value.replace(/\D/g, '');
    const name = $("customer-name") ? $("customer-name").value.trim() : "";
    const email = $("customer-email") ? $("customer-email").value.trim() : "";
    updateHiddenDob();
    const dob = $("customer-dob") ? $("customer-dob").value.trim() : "";

    if (phone.length !== 10) {
      showToast("Please enter a valid 10-digit mobile number.", "error");
      $("customer-phone").focus();
      return;
    }

    localStorage.setItem("ccd_last_phone", phone);

    const payload = {
      action: "customerCheckin",
      actionType: "submit",
      shopId: currentShopId,
      phone: phone,
      name: name || "Valued Customer",
      email: email,
      dob: dob
    };

    const submitBtn = $("submit-btn");
    const originalText = submitBtn ? submitBtn.textContent : "Check-in";
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = "Checking in…";
    }

    try {
      const data = await apiPost(payload);

      if (data.status === "success") {
        showSuccessScreen(data);
      } else {
        showToast(data.message || "Check-in failed. Please retry.", "error");
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = originalText;
        }
      }
    } catch (err) {
      showToast("Network error. Please check internet connection.", "error");
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
      }
    }
  });
}

// 5. Success Screen & Rapid Counter Reset
function showSuccessScreen(data) {
  if ($("form-container")) $("form-container").style.display = "none";
  const successBox = $("success-container");
  if (successBox) successBox.style.display = "block";

  if ($("visit-counter")) {
    $("visit-counter").textContent = `Total Visits: ${data.totalVisits || 1}`;
  }

  const reviewWrap = $("review-btn-wrap");
  const reviewUrl = (data.store && data.store.reviewUrl) || (cachedStoreData && cachedStoreData.reviewUrl);
  if (reviewWrap) {
    if (reviewUrl) {
      reviewWrap.innerHTML = `
        <a href="${reviewUrl}" target="_blank" class="btn-review" style="display:inline-flex; align-items:center; justify-content:center; gap:8px; width:100%; min-height:50px; background:#2563eb; color:#fff; border-radius:12px; font-weight:700; text-decoration:none; margin-top:12px;">
          ⭐ Leave a 5-Star Google Review
        </a>
      `;
    } else {
      reviewWrap.innerHTML = "";
    }
  }

  // Inject 'Next Customer' button for fast reset at busy counters
  let nextBtn = $("btn-next-customer");
  if (!nextBtn && successBox) {
    nextBtn = document.createElement("button");
    nextBtn.id = "btn-next-customer";
    nextBtn.textContent = "Next Customer Check-in";
    nextBtn.style.cssText = "width:100%; min-height:46px; margin-top:12px; background:transparent; border:1px solid #cbd5e1; border-radius:12px; font-weight:600; cursor:pointer;";
    nextBtn.onclick = resetDeskForm;
    successBox.appendChild(nextBtn);
  }

  // Auto-reset form after 15 seconds if unhandled
  clearTimeout(resetTimer);
  resetTimer = setTimeout(resetDeskForm, 15000);
}

function resetDeskForm() {
  clearTimeout(resetTimer);
  if (form) form.reset();
  if ($("customer-dob")) $("customer-dob").value = "";
  if ($("system-notice")) $("system-notice").style.display = "none";

  const submitBtn = $("submit-btn");
  if (submitBtn) {
    submitBtn.disabled = false;
    submitBtn.textContent = "Complete Check-In";
  }

  if ($("success-container")) $("success-container").style.display = "none";
  if ($("form-container")) $("form-container").style.display = "block";

  if ($("customer-phone")) $("customer-phone").focus();
}

function showToast(message, type = "success") {
  let wrap = $("toast-wrap");
  if (!wrap) {
    wrap = document.createElement("div");
    wrap.id = "toast-wrap";
    wrap.style.cssText = "position:fixed; bottom:20px; left:50%; transform:translateX(-50%); z-index:9999; display:flex; flex-direction:column; gap:8px;";
    document.body.appendChild(wrap);
  }
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.style.cssText = `background:${type === 'error' ? '#ef4444' : '#10b981'}; color:#ffffff; padding:10px 18px; border-radius:10px; font-weight:600; font-size:0.9rem; box-shadow:0 4px 12px rgba(0,0,0,0.15);`;
  toast.textContent = message;
  wrap.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}
