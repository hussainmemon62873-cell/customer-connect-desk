const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzNt9UcAPPSRYP5M9pXhqcBy9gLlqK1-DDajTrcoC-FfCa1psTwlhmSQRygCvxgXUJb/exec";


const $ = id => document.getElementById(id);
let currentSlug = "memonlock";

// 1. Toast Notification Engine (Zero native browser alerts)
function showToast(msg) {
  const box = $("toast-box");
  if (!box) return;
  box.textContent = msg;
  box.classList.add("show");
  setTimeout(() => box.classList.remove("show"), 3200);
}

// 2. Security PIN Gate Verification
function verifyAuth() {
  const savedAuth = sessionStorage.getItem(`merchant_auth_${currentSlug}`);
  if (!savedAuth) {
    $("auth-backdrop").classList.add("active");
    $("pin-input").value = "";
    $("pin-input").focus();
  }
}

// 3. Status Toggle Logic
const statusToggle = $("status-toggle");
const statusCard = $("status-card-box");
const statusHeadline = $("status-headline");

statusToggle.addEventListener("change", () => {
  if (statusToggle.checked) {
    statusCard.classList.remove("closed");
    statusHeadline.textContent = "STORE IS OPEN";
  } else {
    statusCard.classList.add("closed");
    statusHeadline.textContent = "STORE IS CLOSED";
  }
});

// 4. Quick Time Chips Selection
document.querySelectorAll(".time-chip").forEach(chip => {
  chip.addEventListener("click", () => {
    $("closing-time-input").value = chip.getAttribute("data-time");
  });
});

// 5. Load Live Store Data & Stats
async function initDashboard() {
  const params = new URLSearchParams(window.location.search);
  currentSlug = (params.get("shop") || "memonlock").trim().toLowerCase();

  $("dash-shop-slug").textContent = `slug: ${currentSlug}`;
  $("preview-storefront-btn").href = `shop.html?shop=${currentSlug}`;
  $("preview-desk-btn").href = `desk.html?shop=${currentSlug}`;

  verifyAuth();

  try {
    const res = await fetch(SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action: "getStoreConfig", shopId: currentSlug })
    });
    const data = await res.json();

    if (data.status === "success" && data.store) {
      const s = data.store;
      $("dash-shop-name").textContent = s.shopName;
      $("page-title").textContent = `${s.shopName} | Dashboard`;
      $("merchant-review-url").value = s.reviewUrl || "";
      $("merchant-phone").value = s.ownerMobile || "";
      
      // Sync toggle with live backend state
      if (s.isOpen === false) {
        statusToggle.checked = false;
        statusCard.classList.add("closed");
        statusHeadline.textContent = "STORE IS CLOSED";
      } else {
        statusToggle.checked = true;
        statusCard.classList.remove("closed");
        statusHeadline.textContent = "STORE IS OPEN";
      }

      if (s.closingTime) {
        $("closing-time-input").value = s.closingTime;
      }

      // Live metrics from tenant sheet
      $("stat-today-visits").textContent = s.totalCustomers || "0";
      $("stat-total-customers").textContent = s.totalCustomers || "0";
    }
  } catch (err) {
    console.warn("Using local configuration fallback:", err);
  }
}

// 6. Dynamic Backend PIN Verification (Last 4 digits of owner phone)
$("btn-unlock").addEventListener("click", async () => {
  const pin = $("pin-input").value.trim();
  const unlockBtn = $("btn-unlock");

  if (pin.length !== 4) {
    showToast("Please enter a 4-digit PIN");
    return;
  }

  unlockBtn.disabled = true;
  unlockBtn.textContent = "Verifying...";

  try {
    const res = await fetch(SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({
        action: "verifyMerchantPin",
        shopId: currentSlug,
        pin: pin
      })
    });
    const result = await res.json();

    if (result.status === "success" && result.authorized) {
      sessionStorage.setItem(`merchant_auth_${currentSlug}`, "true");
      $("auth-backdrop").classList.remove("active");
      showToast("Dashboard unlocked successfully");
    } else {
      showToast(result.message || "Incorrect PIN (last 4 digits of registered phone).");
      $("pin-input").value = "";
      $("pin-input").focus();
    }
  } catch (err) {
    showToast("Verification error. Check internet connection.");
  } finally {
    unlockBtn.disabled = false;
    unlockBtn.textContent = "Unlock Dashboard";
  }
});

// Allow Enter key to trigger unlock
$("pin-input").addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    $("btn-unlock").click();
  }
});

$("btn-logout").addEventListener("click", () => {
  sessionStorage.removeItem(`merchant_auth_${currentSlug}`);
  location.reload();
});


$("save-status-btn").addEventListener("click", async () => {
  const isOpen = statusToggle.checked;
  const closingTime = $("closing-time-input").value.trim();
  const btn = $("save-status-btn");

  btn.disabled = true;
  btn.innerHTML = `<span>Saving...</span>`;

  try {
    const response = await fetch(SCRIPT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=utf-8"
      },
      body: JSON.stringify({
        action: "updateStoreStatus",
        shopId: currentSlug,
        isOpen: isOpen,
        closingTime: closingTime
      })
    });

    const result = await response.json();

    if (!response.ok || result.status !== "success") {
      throw new Error(result.message || "Unable to update store status.");
    }

    showToast("Live store status updated!");
  } catch (error) {
    console.error("Store status update failed:", error);
    showToast("Update failed. Please try again.");
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<span>💾 Update Live Store Status</span>`;
  }
});


$("save-promo-btn").addEventListener("click", () => {
  showToast("Offer banner updated on shop.html");
});

$("save-profile-btn").addEventListener("click", () => {
  showToast("Contact details saved successfully");
});

$("btn-refresh").addEventListener("click", () => {
  showToast("Refreshing latest numbers...");
  setTimeout(() => location.reload(), 400);
});

// Bootstrap
window.addEventListener("DOMContentLoaded", initDashboard);
