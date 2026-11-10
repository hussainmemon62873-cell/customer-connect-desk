const SCRIPT_URL = location.hostname === 'customer-connect-desk.pages.dev' ? 'https://admin.ccd.dev/api' : new URL('/api', location.origin).toString();
const $ = id => document.getElementById(id);
let registrationPhone = '';
function showToast(message) {
  const toast = $('toast-box');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3400);
}
function showRegistrationStatus(message, status) {
  const box = $('registration-status-panel');
  if (!box) return;
  box.hidden = false;
  box.textContent = status ? `${message} Status: ${status}.` : message;
  if (status) box.dataset.status = status;
  else delete box.dataset.status;
}
async function apiPost(payload) {
  const response = await fetch(SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    cache: 'no-store',
    body: JSON.stringify(payload)
  });
  const text = await response.text();
  let result;
  try { result = JSON.parse(text); } catch (error) { throw new Error('Server returned an unreadable response.'); }
  if (!response.ok || result.status === 'error') throw new Error(result.message || 'Request failed.');
  return result;
}
if ($('primary-color')) $('primary-color').addEventListener('input', event => {
  if ($('color-code')) $('color-code').textContent = event.target.value;
});
if ($('shop-slug')) $('shop-slug').addEventListener('input', event => {
  event.target.value = event.target.value.toLowerCase().replace(/[^a-z0-9]/g, '');
});
$('mobile-lookup-form').addEventListener('submit', async event => {
  event.preventDefault();
  const phone = $('owner-mobile-lookup').value.replace(/\D/g, '');
  if (phone.length !== 10) return showToast('Enter a valid 10-digit mobile number.');
  const button = $('btn-mobile-continue');
  button.disabled = true;
  button.textContent = 'Checking…';
  try {
    const result = await apiPost({ action: 'registrationLookup', phone });
    registrationPhone = phone;
    $('registration-contact-step').hidden = true;
    $('registration-email-step').hidden = false;
    $('owner-email-lookup').focus();
    showToast(result.message || 'Now enter your email address.');
  } catch (error) {
    showToast(error.message);
  } finally {
    button.disabled = false;
    button.textContent = 'Continue';
  }
});
$('btn-email-back').addEventListener('click', () => {
  $('registration-email-step').hidden = true;
  $('registration-contact-step').hidden = false;
});
$('email-lookup-form').addEventListener('submit', async event => {
  event.preventDefault();
  const email = $('owner-email-lookup').value.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return showToast('Enter a valid email address.');
  const button = $('btn-email-continue');
  button.disabled = true;
  button.textContent = 'Verifying…';
  try {
    const result = await apiPost({ action: 'registrationLookup', phone: registrationPhone, email });
    if (result.exists) {
      $('registration-email-step').hidden = true;
      showRegistrationStatus(result.message || 'A matching application exists. Use the original secure status link or contact CCD Admin.');
      return;
    }
    $('owner-mobile').value = registrationPhone;
    $('owner-email').value = email;
    $('registration-email-step').hidden = true;
    $('registration-details-step').hidden = false;
    $('shop-name').focus();
    showToast(result.message || 'Continue with your shop details.');
  } catch (error) {
    showToast(error.message);
  } finally {
    button.disabled = false;
    button.textContent = 'Verify and continue';
  }
});
async function restoreRegistrationStatus() {
  let saved;
  try { saved = JSON.parse(sessionStorage.getItem('ccd_registration_request') || 'null'); }
  catch (error) { saved = null; }
  if (!saved || !saved.requestId || !saved.statusToken) return;
  try {
    const result = await apiPost({ action: 'getRegistrationStatus', requestId: saved.requestId, statusToken: saved.statusToken });
    if (!result.exists) return;
    if ($('registration-contact-step')) $('registration-contact-step').hidden = true;
    if ($('registration-email-step')) $('registration-email-step').hidden = true;
    if ($('registration-details-step')) $('registration-details-step').hidden = true;
    showRegistrationStatus(`Application ${result.shopId || ''} status is`, result.registrationStatus);
  } catch (error) {
    console.warn('Secure registration status could not be restored.');
  }
}
$('register-form').addEventListener('submit', async event => {
  event.preventDefault();
  const shopName = $('shop-name').value.trim();
  const slug = $('shop-slug').value.trim().toLowerCase();
  const tagline = $('shop-tagline').value.trim();
  const ownerName = $('owner-name').value.trim();
  const mobile = $('owner-mobile').value.trim().replace(/\D/g, '');
  const email = $('owner-email').value.trim().toLowerCase();
  const reviewUrl = $('review-url').value.trim();
  const mapUrl = $('map-url').value.trim();
  const color = $('primary-color').value;
  const button = $('btn-submit');
  if (!shopName || !slug || !ownerName || !mobile || !email) return showToast('Please complete all required fields.');
  if (slug.length < 3) return showToast('Slug must be at least 3 letters/numbers.');
  if (mobile.length !== 10) return showToast('Valid 10-digit mobile number required.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return showToast('Enter a valid email address.');
  button.disabled = true;
  button.textContent = 'Submitting Application…';
  try {
    const result = await apiPost({
      action: 'registerStore', shopId: slug, shopName, tagline, ownerName,
      ownerMobile: mobile, ownerEmail: email, reviewUrl, mapEmbedUrl: mapUrl,
      primaryColor: color, isPublicRegister: true,
      clientRequestId: `${mobile}|${email}|${slug}`
    });
    if (result.status === 'success') {
      if (result.requestId && result.statusToken) {
        sessionStorage.setItem('ccd_registration_request', JSON.stringify({ requestId: result.requestId, statusToken: result.statusToken }));
      }
      $('registration-details-step').hidden = true;
      showRegistrationStatus(result.message || 'Application submitted. Admin approval is pending.', result.registrationStatus || 'PENDING');
      showToast(result.message || 'Application submitted.');
    }
  } catch (error) {
    showToast(error.message || 'Registration failed. Try again.');
    button.disabled = false;
    button.textContent = 'Submit registration application';
  }
});
window.addEventListener('DOMContentLoaded', restoreRegistrationStatus);
