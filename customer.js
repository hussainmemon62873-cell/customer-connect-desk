// Customer Hub: email OTP verified profile access. No profile data or token is persisted.
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyoFCx6UgGKFmgDxkQePZOuWhWEGqNn5wro0qXfGvb8d31hhTkzZKjMFnCDB9z93wmi/exec";

const $ = id => document.getElementById(id);
let toastTimer = null;
let customerToken = "";
let otpRequested = false;
let submitting = false;

function showToast(message) {
  const box = $("toast-box");
  if (!box) return;
  box.textContent = message;
  box.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => box.classList.remove("show"), 3600);
}
function showLoginError(message) {
  const error = $("login-error");
  if (error) { error.textContent = message; error.hidden = false; }
}
function clearLoginError() {
  const error = $("login-error");
  if (error) error.hidden = true;
}
async function apiPost(payload) {
  const response = await fetch(SCRIPT_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    cache: "no-store",
    body: JSON.stringify(payload)
  });
  const result = await response.json();
  if (!response.ok || result.status === "error") throw new Error(result.message || "Request failed.");
  return result;
}

const themeBtn = $("btn-theme");
if (themeBtn) {
  themeBtn.addEventListener("click", () => {
    const next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try { localStorage.setItem("ccd_customer_theme", next); } catch (error) {}
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", next === "dark" ? "#000000" : "#ffffff");
    themeBtn.setAttribute("aria-label", next === "dark" ? "Switch to light mode" : "Switch to dark mode");
  });
  try {
    const savedTheme = localStorage.getItem("ccd_customer_theme");
    if (savedTheme === "dark" || savedTheme === "light") document.documentElement.setAttribute("data-theme", savedTheme);
  } catch (error) {}
}

["cust-phone", "cust-otp"].forEach(id => {
  const input = $(id);
  if (input) input.addEventListener("input", event => {
    event.target.value = event.target.value.replace(/\D/g, "");
    clearLoginError();
  });
});

const sendOtpBtn = $("btn-send-otp");
if (sendOtpBtn) sendOtpBtn.addEventListener("click", async () => {
  const phone = $("cust-phone").value.trim().replace(/\D/g, "");
  const email = $("cust-email").value.trim().toLowerCase();
  if (!/^\d{10}$/.test(phone)) return showLoginError("Enter your registered 10-digit mobile number.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return showLoginError("Enter the email address saved on your customer profile.");
  sendOtpBtn.disabled = true;
  sendOtpBtn.textContent = "Sending…";
  clearLoginError();
  try {
    const result = await apiPost({ action: "customerAuthStart", phone, email });
    otpRequested = true;
    $("otp-field-wrap").hidden = false;
    $("btn-cust-login").disabled = false;
    $("cust-otp").focus();
    showToast(result.message || "Check your registered email for a verification code.");
  } catch (error) {
    showLoginError(error.message || "Unable to request a verification code.");
  } finally {
    sendOtpBtn.disabled = false;
    sendOtpBtn.textContent = otpRequested ? "Resend verification code" : "Send verification code";
  }
});

function displayCustomerProfile(customer) {
  $("login-card").hidden = true;
  $("profile-card").hidden = false;
  $("cust-welcome").textContent = `Welcome, ${customer.name || "Valued Visitor"}!`;
  $("cust-phone-display").textContent = `+91 ${customer.phone}`;
  $("stat-cust-visits").textContent = customer.totalVisits || "0";
  $("stat-cust-store").textContent = customer.firstStore || customer.firstShopId || "DESK";
  $("stat-cust-tier").textContent = customer.tier || "Verified Member";
  window.scrollTo({ top: 0 });
  $("cust-welcome").focus({ preventScroll: true });
}

const loginForm = $("login-form");
if (loginForm) loginForm.addEventListener("submit", async event => {
  event.preventDefault();
  if (submitting) return;
  if (!otpRequested) return showLoginError("Send a verification code first.");
  const phone = $("cust-phone").value.trim().replace(/\D/g, "");
  const email = $("cust-email").value.trim().toLowerCase();
  const code = $("cust-otp").value.trim();
  if (!/^\d{10}$/.test(phone)) return showLoginError("Enter your registered 10-digit mobile number.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return showLoginError("Enter your registered email address.");
  if (!/^\d{6}$/.test(code)) return showLoginError("Enter the 6-digit verification code.");
  const button = $("btn-cust-login");
  submitting = true;
  button.disabled = true;
  button.textContent = "Verifying…";
  clearLoginError();
  try {
    const verified = await apiPost({ action: "customerAuthVerify", phone, email, code });
    customerToken = verified.customerToken || "";
    if (!customerToken) throw new Error("Verification did not create a customer session.");
    const result = await apiPost({ action: "getCustomerDashboardData", customerToken });
    if (result.status !== "success" || !result.customer) throw new Error(result.message || "Customer profile could not be loaded.");
    displayCustomerProfile(result.customer);
  } catch (error) {
    customerToken = "";
    showLoginError(error.message || "Verification failed. Request a new code and try again.");
  } finally {
    submitting = false;
    button.disabled = !otpRequested;
    button.textContent = "Verify and view rewards";
  }
});

const logoutBtn = $("btn-cust-logout");
if (logoutBtn) logoutBtn.addEventListener("click", () => {
  customerToken = "";
  otpRequested = false;
  $("profile-card").hidden = true;
  $("login-card").hidden = false;
  $("cust-otp").value = "";
  $("cust-otp").blur();
  $("otp-field-wrap").hidden = true;
  $("btn-cust-login").disabled = true;
  $("btn-send-otp").textContent = "Send verification code";
  ["cust-welcome", "cust-phone-display"].forEach(id => { $(id).textContent = ""; });
  $("stat-cust-visits").textContent = "0";
  $("stat-cust-store").textContent = "--";
  $("cust-phone").focus();
});
