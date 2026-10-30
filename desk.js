// ==========================================
// COUNTER CHECK-IN CONTROLLER (desk.js)
// Zero-Friction Intake + 3-Box DOB + Storefront Redirect
// ==========================================

const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxMtCXUFrSRSvJ04tprcN27H5zE6B3aYOq0BCrsV_VcLZrPGZkqR6KvB4dKg-yB1zKG/exec";

let storeData = null;
let customerProfile = { name: "", email: "" };
let activeSlug = "memonlock";

const $ = id => document.getElementById(id);

// 1. Toast Notification Utility (Zero Native Alerts)
function toast(text, type = "info") {
  const wrap = $("toast-wrap");
  if (!wrap) return;

  const el = document.createElement("div");
  el.className = `toast toast-${type}`;
  el.innerHTML = `<span>${text}</span>`;
  wrap.appendChild(el);

  setTimeout(() => {
    el.style.opacity = "0";
    el.style.transform = "translateY(-15px)";
    el.style.transition = "all 0.25s ease";
    setTimeout(() => el.remove(), 250);
  }, 3500);
}

// 2. Google Identity Services JWT Parser
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

// 3. Smart 3-Segment DOB Engine (Single-Digit Backspace Deletion)
function initSmartDobInputs() {
  const dayInput = $("dob-day");
  const monthInput = $("dob-month");
  const yearInput = $("dob-year");

  if (!dayInput || !monthInput || !yearInput) return;

  function setupSegment(input, nextInput, prevInput, maxLength) {
    input.addEventListener("input", () => {
      input.value = input.value.replace(/[^0-9]/g, '');
      if (input.value.length >= maxLength && nextInput) {
        nextInput.focus();
        nextInput.select();
      }
    });

    input.addEventListener("keydown", (e) => {
      if (e.key === "Backspace") {
        if (input.value.length === 0 && prevInput) {
          e.preventDefault();
          prevInput.focus();
          const len = prevInput.value.length;
          prevInput.setSelectionRange(len, len);
        }
      }
    });
  }

  setupSegment(dayInput, monthInput, null, 2);
  setupSegment(monthInput, yearInput, dayInput, 2);
  setupSegment(yearInput, null, monthInput, 4);
}

function getAssembledDob() {
  const d = $("dob-day").value.trim().padStart(2, '0');
  const m = $("dob-month").value.trim().padStart(2, '0');
  const y = $("dob-year").value.trim();

  if (d && m && y && y.length === 4) {
    return `${y}-${m}-${d}`;
  }
  return "";
}

// 4. Desk Bootstrap & Store Config Fetch
async function initDesk() {
  initSmartDobInputs();

  const params = new URLSearchParams(window.location.search);
  activeSlug = (params.get("shop") || "").trim().toLowerCase();

  if (!activeSlug) {
    showError("No store identifier detected. Please scan your counter stand QR.");
    return;
  }

  try {
    const res = await fetch(SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action: "getStoreConfig", shopId: activeSlug })
    });
    const data = await res.json();

    if (data.status !== "success" || !data.store) {
      showError(data.message || "Store is inactive or does not exist.");
      return;
    }

    storeData = data.store;
    setupUI(storeData);
  } catch (err) {
    showError("Failed to connect to desk server. Please refresh.");
  }
}

function setupUI(store) {
  document.title = `${store.shopName} | Check-In Desk`;
  $("desk-page-title").textContent = `${store.shopName} | Check-In Desk`;
  $("shop-title").textContent = store.shopName;
  $("shop-sub").textContent = store.tagline || "Quick 1-Tap Counter Check-In & Rewards";
  $("desk-badge").textContent = store.shopId.toUpperCase();

  if (store.primaryColor) {
    document.documentElement.style.setProperty("--accent", store.primaryColor);
  }

  $("loading-panel").classList.add("hidden");
  $("desk-content").classList.remove("hidden");
}

function showError(msg) {
  $("loading-panel").classList.add("hidden");
  $("error-msg").textContent = msg;
  $("error-panel").classList.remove("hidden");
  toast(msg, "error");
}

// 5. Google 1-Tap Auth Handler
window.handleCustomerAuth = async function(response) {
  const payload = parseJwt(response.credential);
  if (!payload || !payload.email) return;

  customerProfile.name = payload.name || "";
  customerProfile.email = payload.email.toLowerCase();

  $("cust-name").value = customerProfile.name;
  $("cust-email").value = customerProfile.email;

  $("auth-section").classList.add("hidden");
  $("checkin-form").classList.remove("hidden");
  $("cust-phone").focus();

  toast("Profile connected! Enter your mobile number.", "info");

  try {
    const checkRes = await fetch(SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({
        action: "checkCustomerStatus",
        email: customerProfile.email
      })
    });
    const checkData = await checkRes.json();

    if (checkData.exists && checkData.customer) {
      const c = checkData.customer;
      if (c.phone) $("cust-phone").value = c.phone.slice(-10);
      if (c.dob && c.dob.includes('-')) {
        const parts = c.dob.split('-');
        if (parts.length === 3) {
          $("dob-year").value = parts[0];
          $("dob-month").value = parts[1];
          $("dob-day").value = parts[2];
        }
      }
      toast(`Welcome back, ${c.name || 'Friend'}! Tap submit to check in.`, "success");
    }
  } catch (e) {
    // Non-blocking lookup fallback
  }
};

// 6. Check-In Submission & Auto-Forward to shop.html
$("checkin-form").addEventListener("submit", async (e) => {
  e.preventDefault();

  const name = $("cust-name").value.trim();
  const phone = $("cust-phone").value.trim().replace(/[^0-9]/g, '');
  const email = $("cust-email").value.trim().toLowerCase();
  const dob = getAssembledDob();
  const optIn = $("cust-optin").checked;
  const btn = $("submit-btn");

  if (!name) {
    toast("Please enter your name", "error");
    $("cust-name").focus();
    return;
  }

  if (phone.length !== 10) {
    toast("Please enter a valid 10-digit mobile number", "error");
    $("cust-phone").focus();
    return;
  }

  btn.disabled = true;
  btn.innerHTML = `<span>Saving Visit...</span>`;

  const payload = {
    action: "recordCustomerVisit",
    shopId: storeData.shopId,
    name: name,
    mobile: phone,
    email: customerProfile.email || email,
    dob: dob,
    visitType: "Counter Check-In",
    whatsappOptIn: optIn
  };

  try {
    await fetch(SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload)
    });

    $("checkin-form").classList.add("hidden");
    $("shop-title").classList.add("hidden");
    $("shop-sub").classList.add("hidden");
    $("desk-badge").classList.add("hidden");

    $("success-panel").classList.remove("hidden");
    toast("Check-in successful! Welcome to " + storeData.shopName, "success");

    const storefrontUrl = `shop.html?shop=${storeData.shopId}`;
    $("store-redirect-btn").href = storefrontUrl;

    if (storeData.reviewUrl && storeData.reviewUrl.trim().length > 5) {
      $("review-btn").href = storeData.reviewUrl.trim();
      $("review-btn").classList.remove("hidden");
    }

    setTimeout(() => {
      window.location.href = storefrontUrl;
    }, 2800);
  } catch (err) {
    toast("Visit recorded locally! Forwarding to store...", "info");
    setTimeout(() => {
      window.location.href = `shop.html?shop=${storeData.shopId}`;
    }, 2000);
  }
});

window.addEventListener("DOMContentLoaded", initDesk);
