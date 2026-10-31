const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzNt9UcAPPSRYP5M9pXhqcBy9gLlqK1-DDajTrcoC-FfCa1psTwlhmSQRygCvxgXUJb/exec";


const $ = id => document.getElementById(id);

function showToast(msg) {
  const t = $("toast-box");
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 3400);
}

// Keep color preview text in sync with color swatch picker
$("primary-color").addEventListener("input", (e) => {
  $("color-code").textContent = e.target.value;
});

// Auto-clean slug input as typed
$("shop-slug").addEventListener("input", (e) => {
  e.target.value = e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '');
});

// Submit Form Handler
$("register-form").addEventListener("submit", async (e) => {
  e.preventDefault();

  const shopName = $("shop-name").value.trim();
  const slug = $("shop-slug").value.trim().toLowerCase();
  const tagline = $("shop-tagline").value.trim();
  const ownerName = $("owner-name").value.trim();
  const mobile = $("owner-mobile").value.trim().replace(/[^0-9]/g, '');
  const email = $("owner-email").value.trim().toLowerCase();
  const reviewUrl = $("review-url").value.trim();
  const mapUrl = $("map-url").value.trim();
  const color = $("primary-color").value;
  const btn = $("btn-submit");

  if (!shopName || !slug || !ownerName || !mobile || !email) {
    showToast("Please complete all required fields (*)");
    return;
  }
  if (slug.length < 3) {
    showToast("Slug must be at least 3 letters/numbers");
    return;
  }
  if (mobile.length !== 10) {
    showToast("Valid 10-digit mobile number required");
    return;
  }

  btn.disabled = true;
  btn.innerHTML = `<span>⏳ Submitting Application...</span>`;

  try {
    const res = await fetch(SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({
        action: "registerStore",
        shopId: slug,
        shopName: shopName,
        tagline: tagline,
        ownerName: ownerName,
        ownerMobile: mobile,
        ownerEmail: email,
        reviewUrl: reviewUrl,
        mapEmbedUrl: mapUrl,
        primaryColor: color,
        isPublicRegister: true
      })
    });
    const result = await res.json();

    if (result.status === "success") {
      showToast("Application submitted! Admin approval pending.");
      $("register-form").reset();
      $("color-code").textContent = "#2563eb";
    } else {
      showToast(result.message || "Registration failed. Try again.");
    }
  } catch (err) {
    showToast("Network error. Check connection.");
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<span>🚀 Submit Registration Application</span>`;
  }
});
