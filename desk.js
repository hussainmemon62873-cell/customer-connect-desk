// ==========================================
// CUSTOMER DESK ENGINE (desk.js)
// ==========================================

const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyq5CbrZ5VzrFEcBh-gfs3iy5UewHoNfJT7ZtLxhHXhhW_bs7R_a0roSqYbZehydJCn/exec";

const $ = id => document.getElementById(id);

// Get shop slug from URL parameters (e.g. desk.html?shop=memonlock)
const urlParams = new URLSearchParams(window.location.search);
const currentShopId = urlParams.get("shop") || "memonlock";

let cachedStoreData = null;

// 1. On Page Load: Check browser memory & fetch store branding
window.addEventListener("DOMContentLoaded", async () => {
  await fetchStoreThemeAndConfig();

  const savedPhone = localStorage.getItem("ccd_last_phone");
  if (savedPhone && savedPhone.length === 10) {
    $("customer-phone").value = savedPhone;
    checkCustomerLookup(savedPhone);
  }

  // Setup segmented DOB auto-jumping
  setupDobInputs();
});

async function fetchStoreThemeAndConfig() {
  try {
    const res = await fetch(SCRIPT_URL, {
      method: "POST",
      body: JSON.stringify({ action: "customerCheckin", actionType: "lookup", shopId: currentShopId, phone: "0000000000" })
    });
    const data = await res.json();
    if (data.status === "success" && data.store) {
      cachedStoreData = data.store;
      applyStoreTheme(data.store);
    }
  } catch (e) {
    console.error("Error loading store config");
  }
}

function applyStoreTheme(store) {
  $("shop-title").textContent = store.shopName;
  $("shop-tagline").textContent = store.tagline || "Welcome! Quick check-in counter.";
  if (store.primaryColor) {
    document.documentElement.style.setProperty('--accent', store.primaryColor);
  }

  // Display Google Review banner immediately upon NFC/QR scan if reviewUrl is present
  if (store.reviewUrl) {
    $("direct-review-link").href = store.reviewUrl;
    $("direct-review-box").style.display = "block";
  } else {
    $("direct-review-box").style.display = "none";
  }
}

// 2. Real-time Lookup when 10 digits are entered
$("customer-phone").addEventListener("input", (e) => {
  const phone = e.target.value.replace(/\D/g, '');
  if (phone.length === 10) {
    checkCustomerLookup(phone);
  } else {
    $("system-notice").style.display = "none";
  }
});

async function checkCustomerLookup(phone) {
  try {
    const res = await fetch(SCRIPT_URL, {
      method: "POST",
      body: JSON.stringify({ action: "customerCheckin", actionType: "lookup", shopId: currentShopId, phone: phone })
    });
    const data = await res.json();

    if (data.status === "success") {
      if (data.exists) {
        $("system-notice").style.display = "block";
        $("system-notice").textContent = "Welcome back! Your data exists in our system.";
        
        $("customer-name").value = data.customer.name || "";
        $("customer-email").value = data.customer.email || "";
        
        // Populate segmented DOB if present
        if (data.customer.dob) {
          parseAndSetDob(data.customer.dob);
        }
      } else {
        $("system-notice").style.display = "none";
        $("customer-name").value = "";
        $("customer-email").value = "";
        $("dob-dd").value = "";
        $("dob-mm").value = "";
        $("dob-yy").value = "";
      }
    }
  } catch (err) {
    console.error("Lookup failed");
  }
}

// 3. Segmented DOB logic & auto-tabbing
function setupDobInputs() {
  const dd = $("dob-dd");
  const mm = $("dob-mm");
  const yy = $("dob-yy");

  dd.addEventListener("input", () => {
    if (dd.value.length === 2) mm.focus();
    updateHiddenDob();
  });
  mm.addEventListener("input", () => {
    if (mm.value.length === 2) yy.focus();
    updateHiddenDob();
  });
  yy.addEventListener("input", () => {
    updateHiddenDob();
  });
}

function updateHiddenDob() {
  const d = $("dob-dd").value.padStart(2, '0');
  const m = $("dob-mm").value.padStart(2, '0');
  const y = $("dob-yy").value;
  if (d.length === 2 && m.length === 2 && y.length === 4) {
    $("customer-dob").value = `${y}-${m}-${d}`;
  } else {
    $("customer-dob").value = "";
  }
}

function parseAndSetDob(dobStr) {
  try {
    if (!dobStr) return;
    // Strip ISO timestamp part (e.g. "2008-04-11T18:30:00.000Z" -> "2008-04-11")
    const cleanDate = String(dobStr).split('T')[0];
    const parts = cleanDate.split(/[-/]/);
    
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        $("dob-yy").value = parts[0];
        $("dob-mm").value = parts[1];
        $("dob-dd").value = parts[2];
      } else {
        $("dob-dd").value = parts[0];
        $("dob-mm").value = parts[1];
        $("dob-yy").value = parts[2];
      }
      $("customer-dob").value = cleanDate;
    }
  } catch (e) {
    console.error("DOB parse error", e);
  }
}

// 4. Handle Check-in Submission
$("checkin-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const phone = $("customer-phone").value.replace(/\D/g, '');
  const name = $("customer-name").value.trim();
  const email = $("customer-email").value.trim();
  updateHiddenDob();
  const dob = $("customer-dob").value.trim();

  if (phone.length !== 10) {
    showToast("Please enter a valid 10-digit mobile number.", "error");
    return;
  }

  localStorage.setItem("ccd_last_phone", phone);

  const payload = {
    action: "customerCheckin",
    actionType: "submit",
    shopId: currentShopId,
    phone: phone,
    name: name,
    email: email,
    dob: dob
  };

  const submitBtn = $("submit-btn");
  submitBtn.disabled = true;
  submitBtn.textContent = "Processing...";

  try {
    const res = await fetch(SCRIPT_URL, {
      method: "POST",
      body: JSON.stringify(payload)
    });
    const data = await res.json();

    if (data.status === "success") {
      showSuccessScreen(data);
    } else {
      showToast(data.message || "Check-in failed", "error");
      submitBtn.disabled = false;
      submitBtn.textContent = "Complete Check-In";
    }
  } catch (err) {
    showToast("Network error during check-in.", "error");
    submitBtn.disabled = false;
    submitBtn.textContent = "Complete Check-In";
  }
});

function showSuccessScreen(data) {
  $("form-container").style.display = "none";
  $("success-container").style.display = "block";
  
  $("visit-counter").textContent = `Total Visits: ${data.totalVisits}`;

  if (data.store && data.store.reviewUrl) {
    $("review-btn-wrap").innerHTML = `
      <a href="${data.store.reviewUrl}" target="_blank" class="btn-review">
        ⭐ Leave a Google Review
      </a>
    `;
  }
}

function showToast(message, type = "success") {
  const wrap = $("toast-wrap");
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  wrap.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}
