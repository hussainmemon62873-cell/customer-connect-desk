// ==========================================
// CUSTOMER DESK ENGINE (desk.js)
// ==========================================

const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyq5CbrZ5VzrFEcBh-gfs3iy5UewHoNfJT7ZtLxhHXhhW_bs7R_a0roSqYbZehydJCn/exec";

const $ = id => document.getElementById(id);

// Get shop slug from URL parameters (e.g. desk.html?shop=memonlock)
const urlParams = new URLSearchParams(window.location.search);
const currentShopId = urlParams.get("shop") || "memonlock";

let cachedStoreData = null;

// 1. On Page Load: Check if browser remembers last used phone number (Cross-Shop Memory)
window.addEventListener("DOMContentLoaded", async () => {
  await fetchStoreThemeAndConfig();

  const savedPhone = localStorage.getItem("ccd_last_phone");
  if (savedPhone && savedPhone.length === 10) {
    $("customer-phone").value = savedPhone;
    // Automatically trigger lookup to see if data exists
    checkCustomerLookup(savedPhone);
  }
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
  $("shop-tagline").textContent = store.tagline;
  if (store.primaryColor) document.documentElement.style.setProperty('--primary', store.primaryColor);
}

// 2. Real-time Lookup when 10 digits are entered
$("customer-phone").addEventListener("input", (e) => {
  const phone = e.target.value.replace(/\D/g, '');
  if (phone.length === 10) {
    checkCustomerLookup(phone);
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
        // Customer exists in system (either at this shop or another shop)
        $("system-notice").style.display = "block";
        $("system-notice").textContent = "Your data exists in our system";
        
        // Prefill hidden/visible fields
        $("customer-name").value = data.customer.name || "";
        $("customer-email").value = data.customer.email || "";
        $("customer-dob").value = data.customer.dob || "";

        // Optional: Hide extra fields if you want 1-tap checkin for returning users
        // $("extra-fields-container").style.display = "none";
      } else {
        $("system-notice").style.display = "none";
        // New customer: clear fields so they can enter info
        $("customer-name").value = "";
        $("customer-email").value = "";
        $("customer-dob").value = "";
      }
    }
  } catch (err) {
    console.error("Lookup failed");
  }
}

// 3. Handle Check-in Submission
$("checkin-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const phone = $("customer-phone").value.replace(/\D/g, '');
  const name = $("customer-name").value.trim();
  const email = $("customer-email").value.trim();
  const dob = $("customer-dob").value.trim();

  if (phone.length !== 10) {
    alert("Please enter a valid 10-digit mobile number.");
    return;
  }

  // Save phone to browser localStorage for cross-shop memory
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

  try {
    const res = await fetch(SCRIPT_URL, {
      method: "POST",
      body: JSON.stringify(payload)
    });
    const data = await res.json();

    if (data.status === "success") {
      showSuccessScreen(data);
    } else {
      alert(data.message);
    }
  } catch (err) {
    alert("Network error during check-in.");
  }
});

function showSuccessScreen(data) {
  $("form-container").style.display = "none";
  $("success-container").style.display = "block";
  
  $("visit-counter").textContent = `Total Visits: ${data.totalVisits}`;

  // Display Google Review Button if review link exists for this store
  if (data.store && data.store.reviewUrl) {
    $("review-btn-wrap").innerHTML = `
      <a href="${data.store.reviewUrl}" target="_blank" class="btn-review">
        ⭐ Leave a Google Review
      </a>
    `;
  }
}
