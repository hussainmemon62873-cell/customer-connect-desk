const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwHdc634lNNW6UkZXPK2tYBSL8ImSPTxHeD3EROsbe8k4Vfguy4If3g8HSfoVESnEtF/exec";
const $ = id => document.getElementById(id);

function showToast(msg) {
  const t = $("toast-box");
  if (!t) return;
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 3400);
}

async function apiPost(payload) {
  const res = await fetch(SCRIPT_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload)
  });
  const text = await res.text();
  let result;
  try { result = JSON.parse(text); } catch (err) { throw new Error("Server returned an unreadable response."); }
  if (!res.ok || result.status === "error") throw new Error(result.message || "Request failed.");
  return result;
}

$("primary-color").addEventListener("input", e => {
  if ($("color-code")) $("color-code").textContent = e.target.value;
});

$("shop-slug").addEventListener("input", e => {
  e.target.value = e.target.value.toLowerCase().replace(/[^a-z0-9]/g, "");
});

async function restoreRegistrationStatus() {
  let saved;
  try { saved = JSON.parse(localStorage.getItem("ccd_registration_request") || "null"); } catch (err) { saved = null; }
  if (!saved || !saved.shopId || !saved.email) return;
  try {
    const status = await apiPost({ action: "getRegistrationStatus", shopId: saved.shopId, email: saved.email });
    if (!status.exists) {
      localStorage.removeItem("ccd_registration_request");
      return;
    }
    if (status.registrationStatus === "PENDING") {
      showToast(`Application for ${saved.shopId} is still pending Admin approval.`);
      if ($("btn-submit")) {
        $("btn-submit").disabled = true;
        $("btn-submit").textContent = "Application Pending";
      }
    } else if (status.registrationStatus === "ACTIVE") {
      localStorage.removeItem("ccd_registration_request");
      showToast(`Your store ${saved.shopId} has been approved. You can now use the store link.`);
    } else {
      showToast(`Application status: ${status.registrationStatus}. Contact the platform Admin for help.`);
    }
  } catch (err) {
    console.warn("Could not restore registration status:", err);
  }
}

$("register-form").addEventListener("submit", async e => {
  e.preventDefault();
  const shopName = $("shop-name").value.trim();
  const slug = $("shop-slug").value.trim().toLowerCase();
  const tagline = $("shop-tagline").value.trim();
  const ownerName = $("owner-name").value.trim();
  const mobile = $("owner-mobile").value.trim().replace(/[^0-9]/g, "");
  const email = $("owner-email").value.trim().toLowerCase();
  const reviewUrl = $("review-url").value.trim();
  const mapUrl = $("map-url").value.trim();
  const color = $("primary-color").value;
  const btn = $("btn-submit");

  if (!shopName || !slug || !ownerName || !mobile || !email) return showToast("Please complete all required fields (*).");
  if (slug.length < 3) return showToast("Slug must be at least 3 letters/numbers.");
  if (mobile.length !== 10) return showToast("Valid 10-digit mobile number required.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return showToast("Enter a valid email address.");

  btn.disabled = true;
  btn.textContent = "Submitting Application...";
  try {
    const result = await apiPost({
      action: "registerStore", shopId: slug, shopName, tagline, ownerName,
      ownerMobile: mobile, ownerEmail: email, reviewUrl, mapEmbedUrl: mapUrl,
      primaryColor: color, isPublicRegister: true
    });
    if (result.status === "success") {
      localStorage.setItem("ccd_registration_request", JSON.stringify({ shopId: slug, email }));
      showToast(result.message || "Application submitted. Admin approval is pending.");
      $("register-form").reset();
      if ($("color-code")) $("color-code").textContent = "#2563eb";
      btn.disabled = true;
      btn.textContent = "Application Pending";
    }
  } catch (err) {
    showToast(err.message || "Registration failed. Try again.");
    btn.disabled = false;
    btn.textContent = "🚀 Submit Registration Application";
  }
});

window.addEventListener("DOMContentLoaded", restoreRegistrationStatus);
