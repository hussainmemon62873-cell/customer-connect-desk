const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxMtCXUFrSRSvJ04tprcN27H5zE6B3aYOq0BCrsV_VcLZrPGZkqR6KvB4dKg-yB1zKG/exec";

const $ = id => document.getElementById(id);

function showToast(msg) {
  const t = $("toast-box");
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 3200);
}

$("btn-cust-login").addEventListener("click", async () => {
  const phone = $("cust-phone").value.trim().replace(/[^0-9]/g, '');
  const pin = $("cust-pin").value.trim();
  const btn = $("btn-cust-login");

  if (phone.length !== 10) {
    showToast("Enter a valid 10-digit mobile number");
    return;
  }
  if (pin !== phone.slice(-4)) {
    showToast("Security PIN must be the last 4 digits of your phone");
    return;
  }

  btn.disabled = true;
  btn.innerHTML = `<span>⏳ Verifying...</span>`;

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
      const c = result.customer;
      $("login-card").style.display = "none";
      $("profile-card").style.display = "flex";

      $("cust-welcome").textContent = `Welcome, ${c.name || 'Valued Visitor'}!`;
      $("cust-phone-display").textContent = `+91 ${c.phone}`;
      $("stat-cust-visits").textContent = c.totalVisits;
      $("stat-cust-store").textContent = c.firstStore || "DESK";
      $("stat-cust-tier").textContent = c.tier || "Verified Member";
    } else {
      showToast(result.message || "No visit history found for this number.");
    }
  } catch (err) {
    showToast("Connection issue. Please retry.");
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<span>Verify & View Rewards</span>`;
  }
});

$("btn-cust-logout").addEventListener("click", () => {
  $("profile-card").style.display = "none";
  $("login-card").style.display = "flex";
  $("cust-pin").value = "";
});
