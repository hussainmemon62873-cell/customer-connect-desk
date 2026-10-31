// ==========================================
// CUSTOMER CONNECT DESK (customer.js)
// Customer Rewards & Verified Visits Engine
// ==========================================

const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyq5CbrZ5VzrFEcBh-gfs3iy5UewHoNfJT7ZtLxhHXhhW_bs7R_a0roSqYbZehydJCn/exec";

const $ = id => document.getElementById(id);
let toastTimer = null;
let submitting = false;

function showToast(msg) {
  const t = $("toast-box");
  if (!t) return;
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 3200);
}

// Inline error handling + toast alert
function showLoginError(msg, fieldId) {
  const el = $("login-error");
  if (el) {
    el.textContent = msg;
    el.hidden = false;
  }
  document.querySelectorAll("#login-form .text-input").forEach(i => i.classList.remove("is-invalid"));
  if (fieldId && $(fieldId)) {
    $(fieldId).classList.add("is-invalid");
    $(fieldId).focus();
  }
  showToast(msg);
}

function clearLoginError() {
  const el = $("login-error");
  if (el) el.hidden = true;
  document.querySelectorAll("#login-form .text-input").forEach(i => i.classList.remove("is-invalid"));
}

// Theme handling
const themeBtn = $("btn-theme");
if (themeBtn) {
  themeBtn.addEventListener("click", () => {
    const next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try { localStorage.setItem("ccd_customer_theme", next); } catch (e) {}
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", next === "dark" ? "#000000" : "#ffffff");
    themeBtn.setAttribute("aria-label", next === "dark" ? "Switch to light mode" : "Switch to dark mode");
  });
  themeBtn.setAttribute("aria-label", document.documentElement.getAttribute("data-theme") === "dark" ? "Switch to light mode" : "Switch to dark mode");
}

// Strip non-digits automatically
["cust-phone", "cust-pin"].forEach(id => {
  const el = $(id);
  if (el) {
    el.addEventListener("input", e => {
      e.target.value = e.target.value.replace(/\D/g, "");
      clearLoginError();
    });
  }
});

// Show / hide PIN toggle
const pinEyeBtn = $("btn-pin-eye");
if (pinEyeBtn) {
  pinEyeBtn.addEventListener("click", () => {
    const input = $("cust-pin");
    if (!input) return;
    const show = input.type === "password";
    input.type = show ? "text" : "password";
    pinEyeBtn.setAttribute("aria-pressed", String(show));
    pinEyeBtn.setAttribute("aria-label", show ? "Hide PIN" : "Show PIN");
  });
}

function displayCustomerProfile(customer) {
  $("login-card").hidden = true;
  $("profile-card").hidden = false;

  // textContent protection prevents markup injection
  $("cust-welcome").textContent = `Welcome, ${customer.name || 'Valued Visitor'}!`;
  $("cust-phone-display").textContent = `+91 ${customer.phone}`;
  $("stat-cust-visits").textContent = customer.totalVisits || "0";
  $("stat-cust-store").textContent = customer.firstStore || "DESK";
  $("stat-cust-tier").textContent = customer.tier || "Verified Member";

  window.scrollTo({ top: 0 });
  $("cust-welcome").focus({ preventScroll: true });
}

// Unified Form Submission (Buttons and Enter key)
const loginForm = $("login-form");
if (loginForm) {
  loginForm.addEventListener("submit", async e => {
    e.preventDefault();
    if (submitting) return;

    const phone = $("cust-phone").value.trim().replace(/\D/g, '');
    const pin = $("cust-pin").value.trim();
    const btn = $("btn-cust-login");

    if (phone.length !== 10) {
      showLoginError("Enter a valid 10-digit mobile number", "cust-phone");
      return;
    }
    if (pin.length !== 4) {
      showLoginError("Enter your 4-digit PIN", "cust-pin");
      return;
    }
    if (pin !== phone.slice(-4)) {
      showLoginError("Security PIN must be the last 4 digits of your phone", "cust-pin");
      return;
    }

    clearLoginError();
    submitting = true;
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner" aria-hidden="true"></span><span>Verifying…</span>`;

    try {
      const res = await fetch(SCRIPT_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({
          action: "getCustomerDashboardData",
          phone: phone,
          pin: pin
        })
      });
      const result = await res.json();

      if (result.status === "success" && result.customer) {
        try {
          sessionStorage.setItem("ccd_active_customer", JSON.stringify(result.customer));
        } catch (err) {}

        displayCustomerProfile(result.customer);
      } else {
        showLoginError(result.message || "No visit history found for this number.");
      }
    } catch (err) {
      showLoginError("Connection issue. Please retry.");
    } finally {
      submitting = false;
      btn.disabled = false;
      btn.innerHTML = `<span>Verify &amp; view rewards</span>`;
    }
  });
}

// Logout
const logoutBtn = $("btn-cust-logout");
if (logoutBtn) {
  logoutBtn.addEventListener("click", () => {
    try { sessionStorage.removeItem("ccd_active_customer"); } catch (e) {}
    $("profile-card").hidden = true;
    $("login-card").hidden = false;
    $("cust-pin").value = "";
    $("cust-pin").type = "password";
    if (pinEyeBtn) pinEyeBtn.setAttribute("aria-pressed", "false");
    ["cust-welcome", "cust-phone-display"].forEach(id => { $(id).textContent = ""; });
    $("stat-cust-visits").textContent = "0";
    $("stat-cust-store").textContent = "--";
    $("cust-phone").focus();
  });
}

// Session restoration on page refresh
window.addEventListener("DOMContentLoaded", () => {
  try {
    const cached = sessionStorage.getItem("ccd_active_customer");
    if (cached) {
      const customer = JSON.parse(cached);
      if (customer && customer.phone) {
        displayCustomerProfile(customer);
      }
    }
  } catch (e) {}
});
