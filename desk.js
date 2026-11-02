// ==========================================
// CUSTOMER DESK ENGINE (desk.js)
// Fast Walk-in Check-in + Direct Review Capture
// ==========================================

const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwHdc634lNNW6UkZXPK2tYBSL8ImSPTxHeD3EROsbe8k4Vfguy4If3g8HSfoVESnEtF/exec";
const $ = id => document.getElementById(id);
const urlParams = new URLSearchParams(window.location.search);
const currentShopId = (urlParams.get("shop") || "memonlock").trim().toLowerCase();
let cachedStoreData = null;
let resetTimer = null;
let matchedCustomer = false;
let lookupSequence = 0;
let pendingRequestId = "";
let pendingRequestPhone = "";

window.addEventListener("DOMContentLoaded", async () => {
  setupDobInputs();
  ensureCheckinWorkflowControls();
  await fetchStoreThemeAndConfig();
  restoreRecentSuccessScreen();
});

async function apiPost(payload) {
  const res = await fetch(SCRIPT_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload)
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch (err) { throw new Error("Server returned an unreadable response."); }
  if (!res.ok || data.status === "error") throw new Error(data.message || "Request failed.");
  return data;
}

async function fetchStoreThemeAndConfig() {
  try {
    let data = await apiPost({ action: "getStoreConfig", shopId: currentShopId, slug: currentShopId });
    let store = data && (data.store || data.config || (data.shopName ? data : null));
    if (!store || !store.shopName) {
      const fallbackData = await apiPost({ action: "customerCheckin", actionType: "lookup", shopId: currentShopId, phone: "0000000000" });
      if (fallbackData && fallbackData.store) store = fallbackData.store;
    }
    if (store && store.shopName) { cachedStoreData = store; applyStoreTheme(store); }
  } catch (e) {
    console.warn("Unable to load Desk configuration:", e);
    showToast("Unable to load this store. Please check the store link.", "error");
  }
}

function safeExternalUrl(value) {
  try { const u = new URL(String(value || "")); return ["https:", "http:"].includes(u.protocol) ? u.href : ""; }
  catch (e) { return ""; }
}

function safeRedirectUrl(value) {
  try {
    const u = new URL(String(value || ''));
    if (u.protocol !== 'https:' || u.username || u.password) return '';
    return u.href;
  } catch (e) { return ''; }
}

function ensureOnPremiseNotice(storeName) {
  const container = $('form-container');
  if (!container) return;
  let note = $('ccd-on-premise-notice');
  if (!note) {
    note = document.createElement('div');
    note.id = 'ccd-on-premise-notice';
    note.style.cssText = 'padding:11px 14px;margin:0 0 14px;background:#f8fafc;border:1px solid #cbd5e1;border-radius:12px;color:#334155;font-size:.84rem;line-height:1.45;';
    const formEl = $('checkin-form');
    container.insertBefore(note, formEl || container.firstChild);
  }
  note.textContent = `This check-in desk is for customers who are currently visiting ${storeName || 'this shop'}. Please complete check-in only while you are at the shop.`;
}

function applyStoreTheme(store) {
  ensureOnPremiseNotice(store.shopName || 'this shop');
  if ($("shop-title")) $("shop-title").textContent = store.shopName;
  if ($("shop-tagline")) $("shop-tagline").textContent = store.tagline || "Quick Walk-in Counter Check-in";
  if (store.primaryColor) document.documentElement.style.setProperty("--accent", store.primaryColor);
  const reviewBox = $("direct-review-box");
  const reviewLink = $("direct-review-link");
  const reviewUrl = safeExternalUrl(store.reviewUrl);
  if (reviewUrl && reviewBox && reviewLink) { reviewLink.href = reviewUrl; reviewBox.style.display = "block"; }
  else if (reviewBox) reviewBox.style.display = "none";
}

function clearCustomerProfileFields() {
  if ($("customer-name")) $("customer-name").value = "";
  if ($("customer-email")) $("customer-email").value = "";
  if ($("dob-dd")) $("dob-dd").value = "";
  if ($("dob-mm")) $("dob-mm").value = "";
  if ($("dob-yy")) $("dob-yy").value = "";
  if ($("customer-dob")) $("customer-dob").value = "";
}

if ($("customer-phone")) $("customer-phone").addEventListener("input", e => {
  const phone = e.target.value.replace(/\D/g, "");
  e.target.value = phone;
  if (phone.length === 10) checkCustomerLookup(phone);
  else {
    lookupSequence++;
    const wasReturningCustomer = matchedCustomer;
    resetCustomerConfirmation();
    if (wasReturningCustomer) clearCustomerProfileFields();
    if ($("system-notice")) $("system-notice").style.display = "none";
  }
});

function ensureCheckinWorkflowControls() {
  const form = $('checkin-form');
  const submit = $('submit-btn');
  if (!form || !submit) return;
  if (!$('ccd-returning-confirm')) {
    const wrap = document.createElement('label');
    wrap.id = 'ccd-returning-confirm';
    wrap.hidden = true;
    wrap.style.cssText = 'display:none; align-items:flex-start; gap:10px; padding:12px 14px; margin-top:14px; border:1px solid #bfdbfe; border-radius:12px; background:#eff6ff; color:#1e3a8a; font-size:0.9rem; line-height:1.45;';
    wrap.innerHTML = '<input id="ccd-confirm-details" type="checkbox" style="margin-top:3px; width:18px; height:18px; flex:0 0 auto;" /><span>I have checked my saved details and confirm that they are correct.</span>';
    submit.parentNode.insertBefore(wrap, submit);
    $('ccd-confirm-details').addEventListener('change', () => { submit.disabled = matchedCustomer && !$('ccd-confirm-details').checked; });
  }
  if (!$('ccd-whatsapp-consent')) {
    const wrap = document.createElement('label');
    wrap.id = 'ccd-whatsapp-consent';
    wrap.style.cssText = 'display:flex; align-items:flex-start; gap:10px; padding:11px 13px; margin-top:12px; border:1px solid #e2e8f0; border-radius:12px; color:#334155; font-size:0.86rem; line-height:1.4;';
    wrap.innerHTML = '<input id="ccd-whatsapp-optin" type="checkbox" style="margin-top:2px; width:17px; height:17px; flex:0 0 auto;" /><span>I agree to receive visit-related WhatsApp follow-up messages from this shop. This is optional.</span>';
    submit.parentNode.insertBefore(wrap, submit);
  }
}

function resetCustomerConfirmation() {
  matchedCustomer = false;
  const wrap = $('ccd-returning-confirm'), checkbox = $('ccd-confirm-details'), submit = $('submit-btn');
  if (wrap) wrap.hidden = true;
  if (wrap) wrap.style.display = 'none';
  if (checkbox) checkbox.checked = false;
  if (submit) submit.disabled = false;
  const optin = $('ccd-whatsapp-optin');
  if (optin) optin.checked = false;
}

async function checkCustomerLookup(phone) {
  const thisLookup = ++lookupSequence;
  const wasReturningCustomer = matchedCustomer;
  resetCustomerConfirmation();
  try {
    const data = await apiPost({ action: 'customerCheckin', actionType: 'lookup', shopId: currentShopId, phone });
    if (thisLookup !== lookupSequence) return;
    const notice = $('system-notice');
    if (data.exists && data.customer) {
      matchedCustomer = true;
      if (notice) {
        notice.style.display = 'block';
        notice.textContent = `Welcome back, ${data.customer.name || 'valued customer'}! Your saved details are shown below. Please confirm them before check-in.`;
      }
      if ($('customer-name')) $('customer-name').value = data.customer.name || '';
      if ($('customer-email')) $('customer-email').value = data.customer.email || '';
      if (data.customer.dob) parseAndSetDob(data.customer.dob);
      const confirmWrap = $('ccd-returning-confirm');
      const confirmBox = $('ccd-confirm-details');
      const submit = $('submit-btn');
      if (confirmWrap) { confirmWrap.hidden = false; confirmWrap.style.display = 'flex'; }
      if (confirmBox) confirmBox.checked = false;
      if (submit) submit.disabled = true;
      if ($('ccd-whatsapp-optin')) $('ccd-whatsapp-optin').checked = String(data.customer.whatsAppOptIn || 'NO').toUpperCase() === 'YES';
    } else {
      if (notice) notice.style.display = 'none';
      if (wasReturningCustomer) clearCustomerProfileFields();
      matchedCustomer = false;
      if ($('submit-btn')) $('submit-btn').disabled = false;
    }
  } catch (err) {
    console.warn('Customer lookup failed:', err);
  }
}

function setupDobInputs() {
  const dd = $("dob-dd"), mm = $("dob-mm"), yy = $("dob-yy");
  if (!dd || !mm || !yy) return;
  dd.addEventListener("input", () => { dd.value = dd.value.replace(/\D/g, "").slice(0, 2); if (dd.value.length === 2) mm.focus(); updateHiddenDob(); });
  mm.addEventListener("input", () => { mm.value = mm.value.replace(/\D/g, "").slice(0, 2); if (mm.value.length === 2) yy.focus(); updateHiddenDob(); });
  yy.addEventListener("input", () => { yy.value = yy.value.replace(/\D/g, "").slice(0, 4); updateHiddenDob(); });
  mm.addEventListener("keydown", e => { if (e.key === "Backspace" && !mm.value) dd.focus(); });
  yy.addEventListener("keydown", e => { if (e.key === "Backspace" && !yy.value) mm.focus(); });
}

function updateHiddenDob() {
  const dd = $("dob-dd"), mm = $("dob-mm"), yy = $("dob-yy"), hidden = $("customer-dob");
  if (!dd || !mm || !yy || !hidden) return;
  const d = dd.value.trim().padStart(2, "0"), m = mm.value.trim().padStart(2, "0"), y = yy.value.trim();
  hidden.value = d.length === 2 && m.length === 2 && y.length === 4 ? `${y}-${m}-${d}` : "";
}

function parseAndSetDob(dobStr) {
  try {
    if (!dobStr) return;
    const parts = String(dobStr).split("T")[0].split(/[-/]/);
    if (parts.length !== 3) return;
    let year, month, day;
    if (parts[0].length === 4) [year, month, day] = parts;
    else [day, month, year] = parts;
    if ($("dob-dd")) $("dob-dd").value = day && day !== "00" ? day.padStart(2, "0") : "";
    if ($("dob-mm")) $("dob-mm").value = month && month !== "00" ? month.padStart(2, "0") : "";
    if ($("dob-yy")) $("dob-yy").value = year && year !== "0000" ? year : "";
    updateHiddenDob();
  } catch (e) { console.error("DOB parse error", e); }
}

const form = $('checkin-form');
if (form) form.addEventListener('submit', async e => {
  e.preventDefault();
  const phone = $('customer-phone').value.replace(/\D/g, '');
  const name = $('customer-name') ? $('customer-name').value.trim() : '';
  const email = $('customer-email') ? $('customer-email').value.trim() : '';
  updateHiddenDob();
  const dob = $('customer-dob') ? $('customer-dob').value.trim() : '';
  const confirmed = !!($('ccd-confirm-details') && $('ccd-confirm-details').checked);
  if (phone.length !== 10) { showToast('Please enter a valid 10-digit mobile number.', 'error'); $('customer-phone').focus(); return; }
  if (!name) { showToast('Please enter your full name.', 'error'); $('customer-name').focus(); return; }
  if (matchedCustomer && !confirmed) { showToast('Please confirm your saved details before check-in.', 'error'); return; }
  // Keep the retry key in memory only; do not store a customer's phone in browser storage.
  if (!pendingRequestId || pendingRequestPhone !== phone) {
    pendingRequestId = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : `ccd-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    pendingRequestPhone = phone;
  }
  const requestId = pendingRequestId;
  const payload = {
    action: 'customerCheckin', actionType: 'submit', shopId: currentShopId, phone, name, email, dob,
    customerConfirmed: confirmed, whatsappOptIn: !!($('ccd-whatsapp-optin') && $('ccd-whatsapp-optin').checked),
    requestId: requestId, sourcePage: 'desk.html'
  };
  const submitBtn = $('submit-btn');
  const originalText = submitBtn ? submitBtn.textContent : 'Check-in';
  if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Checking in…'; }
  try {
    const data = await apiPost(payload);
    if (data.status === 'success') {
      pendingRequestId = "";
      pendingRequestPhone = "";
      sessionStorage.setItem(`ccd_last_success_${currentShopId}`, JSON.stringify({
        createdAt: Date.now(), totalVisits: data.totalVisits || 1,
        message: data.message || 'Your details are in our system and your visit has been recorded successfully.'
      }));
      showSuccessScreen(data);
      showToast(data.message || 'Your details are in our system. Your visit has been recorded. Thank you!', 'success');
      const redirectUrl = safeRedirectUrl(data.store && data.store.redirectUrl || cachedStoreData && cachedStoreData.redirectUrl);
      if (redirectUrl) {
        clearTimeout(resetTimer);
        resetTimer = setTimeout(() => { window.location.assign(redirectUrl); }, 2500);
      }
    } else {
      showToast(data.message || 'Check-in failed. Please retry.', 'error');
      if (submitBtn) { submitBtn.disabled = matchedCustomer && !$('ccd-confirm-details').checked; submitBtn.textContent = originalText; }
    }
  } catch (err) {
    showToast(err.message || 'Network error. Please check internet connection.', 'error');
    if (submitBtn) { submitBtn.disabled = matchedCustomer && !$('ccd-confirm-details').checked; submitBtn.textContent = originalText; }
  }
});

function showSuccessScreen(data) {
  if ($("form-container")) $("form-container").style.display = "none";
  const successBox = $("success-container");
  if (successBox) successBox.style.display = "block";
  if ($("visit-counter")) $("visit-counter").textContent = `Total Visits: ${data.totalVisits || 1}`;
  const successTitle = successBox ? successBox.querySelector(".success-title") : null;
  const successSub = successBox ? successBox.querySelector(".success-sub") : null;
  if (successTitle) successTitle.textContent = "Your Visit Is Recorded!";
  if (successSub) successSub.textContent = data.message || "Your details are in our system. Thank you for visiting!";
  const reviewWrap = $("review-btn-wrap");
  const reviewUrl = safeExternalUrl((data.store && data.store.reviewUrl) || (cachedStoreData && cachedStoreData.reviewUrl));
  if (reviewWrap) {
    reviewWrap.innerHTML = reviewUrl ? `<a href="${reviewUrl}" target="_blank" rel="noopener noreferrer" class="btn-review" style="display:inline-flex; align-items:center; justify-content:center; gap:8px; width:100%; min-height:50px; background:#2563eb; color:#fff; border-radius:12px; font-weight:700; text-decoration:none; margin-top:12px;">⭐ Leave a 5-Star Google Review</a>` : "";
  }
  let nextBtn = $("btn-next-customer");
  if (!nextBtn && successBox) {
    nextBtn = document.createElement("button");
    nextBtn.id = "btn-next-customer";
    nextBtn.textContent = "Next Customer Check-in";
    nextBtn.style.cssText = "width:100%; min-height:46px; margin-top:12px; background:transparent; border:1px solid #cbd5e1; border-radius:12px; font-weight:600; cursor:pointer;";
    nextBtn.onclick = resetDeskForm;
    successBox.appendChild(nextBtn);
  }
  clearTimeout(resetTimer);
  resetTimer = setTimeout(resetDeskForm, 15000);
}

function restoreRecentSuccessScreen() {
  const key = `ccd_last_success_${currentShopId}`;
  let saved = null;
  try { saved = JSON.parse(sessionStorage.getItem(key) || 'null'); } catch (err) { saved = null; }
  if (!saved || !saved.createdAt) return false;
  const remaining = 15000 - (Date.now() - Number(saved.createdAt));
  if (remaining <= 0) { sessionStorage.removeItem(key); return false; }
  showSuccessScreen({ totalVisits: saved.totalVisits, message: saved.message, store: cachedStoreData });
  clearTimeout(resetTimer);
  resetTimer = setTimeout(resetDeskForm, remaining);
  return true;
}

function resetDeskForm() {
  clearTimeout(resetTimer);
  sessionStorage.removeItem(`ccd_last_success_${currentShopId}`);
  if (form) form.reset();
  pendingRequestId = "";
  pendingRequestPhone = "";
  resetCustomerConfirmation();
  if ($("customer-dob")) $("customer-dob").value = "";
  if ($("system-notice")) $("system-notice").style.display = "none";
  const submitBtn = $("submit-btn");
  if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = "Complete Check-In"; }
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
  toast.style.cssText = `background:${type === "error" ? "#ef4444" : "#10b981"}; color:#ffffff; padding:10px 18px; border-radius:10px; font-weight:600; font-size:0.9rem; box-shadow:0 4px 12px rgba(0,0,0,0.15);`;
  toast.textContent = message;
  wrap.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}
