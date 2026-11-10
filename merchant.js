const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyoFCx6UgGKFmgDxkQePZOuWhWEGqNn5wro0qXfGvb8d31hhTkzZKjMFnCDB9z93wmi/exec";
const BASE_DOMAIN = "https://ccd.dev";

const $ = id => document.getElementById(id);
let currentSlug = "memonlock";
let merchantToken = "";
let merchantStoreConfig = null;
let merchantCustomerTimer = null;
let merchantPricingInitialized = false;
let merchantIdleTimer=null,merchantHardTimer=null,merchantLastTouchAt=0;
if (window.CCDLoading) window.CCDLoading.hold();

const MERCHANT_THEME_MAP = {
'midnight-blue':['#080d1a','#111c33','#2563eb','#f8fafc','#9fb2d1'],'obsidian-cyan':['#090f12','#142329','#06b6d4','#f1fcff','#9ab6bf'],'slate-indigo':['#111827','#1f2937','#6366f1','#f8fafc','#cbd5e1'],'graphite-blue':['#101820','#1c2b3a','#3b82f6','#f4f8ff','#a9bbd0'],'navy-ice':['#0b1730','#152b4d','#60a5fa','#f3f8ff','#b7c9e6'],'carbon-electric':['#0a0a0b','#1b1b20','#38bdf8','#ffffff','#a1a1aa'],'royal-night':['#15102b','#261b46','#8b5cf6','#fbfaff','#c4b5fd'],'ocean-dark':['#06202b','#0b3542','#14b8a6','#f0fdfa','#99c8c7'],'deep-space':['#080b20','#151a3a','#818cf8','#f5f5ff','#b8bce8'],'steel-blue':['#17212b','#263746','#0ea5e9','#f4f9fc','#b0c1cf'],'arctic-light':['#eaf3f9','#ffffff','#1677c8','#102a43','#57738a'],'cloud-blue':['#f1f6fc','#ffffff','#2563eb','#14243a','#637b99'],'pearl-indigo':['#f5f3ff','#ffffff','#5b4bdb','#211b3b','#77708f'],'frost-cyan':['#effbfc','#ffffff','#0891b2','#12313a','#5e7d84'],'minimal-slate':['#f1f3f5','#ffffff','#475569','#17202a','#697586'],'white-blue':['#f7faff','#ffffff','#1d4ed8','#14213d','#64748b'],'soft-lavender':['#f7f3ff','#ffffff','#7c3aed','#24143d','#7b6b91'],'emerald-night':['#071b16','#102c23','#10b981','#effff8','#9dcbb7'],'teal-studio':['#eaf7f5','#ffffff','#0f766e','#123b39','#5d817d'],'mono-pro':['#151515','#242424','#e5e7eb','#ffffff','#b6b6b6']};
function applyMerchantServiceVisibility(flags){const f=flags||{};const phase1=!!f.customerConnectEnabled,phase2=!!f.websitePricingEnabled;[['merchant-metrics-section',phase1],['merchant-customer-section',phase1],['merchant-approval-section',phase1],['merchant-communication-section',phase1],['status-card-box',phase2],['merchant-promo-section',false],['merchant-contact-section',false],['merchant-pricing-section',false],['preview-storefront-btn',phase2]].forEach(([id,visible])=>{const el=$(id);if(el)el.hidden=!visible;});}
function applyMerchantDashboardTheme(themeId){const t=MERCHANT_THEME_MAP[themeId]||MERCHANT_THEME_MAP['midnight-blue'];const root=document.documentElement;root.style.setProperty('--bg',t[0]);root.style.setProperty('--surface',t[1]);root.style.setProperty('--accent',t[2]);root.style.setProperty('--ink',t[3]);root.style.setProperty('--muted',t[4]);root.style.setProperty('--line',t[4]+'55');root.dataset.ccdTheme=themeId||'midnight-blue';let st=document.getElementById('ccd-theme-overrides');if(!st){st=document.createElement('style');st.id='ccd-theme-overrides';document.head.appendChild(st);}st.textContent=`body{background:var(--bg)!important;color:var(--ink)!important}.merchant-header{background:var(--surface)!important;color:var(--ink)!important;border-color:var(--line)!important}.merchant-brand,.merchant-brand strong,.icon-button{color:var(--ink)!important}.icon-button{background:var(--surface)!important;border-color:var(--line)!important}.brand-icon,.secure-tag{background:var(--accent)!important;color:#fff!important}.card,.metric-card,#merchant-customer-section,#merchant-pricing-section{background:var(--surface)!important;color:var(--ink)!important;border-color:var(--line)!important}.card h1,.card h2,.card h3,.card strong,.metric-card strong,#merchant-customer-section strong,#merchant-approval-section strong,#merchant-communication-section strong{color:var(--ink)!important}.card p,.card small,.card .subtext,.metric-card span,#merchant-customer-section span,#merchant-approval-section div,#merchant-communication-section small{color:var(--muted)!important}.btn-primary,#merchant-save-pricing{background:var(--accent)!important;border-color:var(--accent)!important;color:${['#e5e7eb','#ffffff','#f8fafc','#f4f8ff','#f3f8ff','#ffffff','#fbfaff','#f0fdfa','#f5f5ff','#f4f9fc'].includes(t[2])?'#111827':'#ffffff'}!important}.text-input,.pin-input{background:var(--surface)!important;color:var(--ink)!important;border-color:var(--line)!important}`;}


function clearMerchantSessionTimers(){if(merchantIdleTimer)clearTimeout(merchantIdleTimer);if(merchantHardTimer)clearTimeout(merchantHardTimer);merchantIdleTimer=null;merchantHardTimer=null;}
function endMerchantSession(message){clearMerchantSessionTimers();if(merchantCustomerTimer){clearInterval(merchantCustomerTimer);merchantCustomerTimer=null;}sessionStorage.removeItem(`merchant_auth_${currentSlug}`);merchantToken='';if($('auth-backdrop'))$('auth-backdrop').classList.add('active');['status-card-box','merchant-metrics-section','merchant-promo-section','merchant-contact-section','merchant-customer-section','merchant-approval-section','merchant-communication-section','merchant-pricing-section'].forEach(id=>{const el=$(id);if(el)el.hidden=true;});if(message)showToast(message,true);}
function resetMerchantIdleTimer(){if(!merchantToken)return;if(merchantIdleTimer)clearTimeout(merchantIdleTimer);merchantIdleTimer=setTimeout(()=>endMerchantSession('Your Merchant session expired after 30 minutes of inactivity. Sign in again.'),30*60*1000);const now=Date.now();if(now-merchantLastTouchAt>60000){merchantLastTouchAt=now;apiPost({action:'merchantTouchSession',shopId:currentSlug,merchantToken}).catch(e=>{if(/session expired/i.test(e.message||''))endMerchantSession(e.message);});}}
function startMerchantSessionTimers(){clearMerchantSessionTimers();merchantHardTimer=setTimeout(()=>endMerchantSession('Your Merchant session reached its 8-hour limit. Sign in again.'),8*60*60*1000);resetMerchantIdleTimer();}
['pointerdown','keydown','touchstart','click'].forEach(name=>document.addEventListener(name,resetMerchantIdleTimer,{passive:true}));

function showToast(msg, isError = false) {
  const box = $("toast-box");
  if (!box) return;
  box.textContent = msg;
  box.classList.toggle("is-error", isError);
  box.classList.add("show");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => box.classList.remove("show"), 3200);
}

function escapeHtml(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
}

function ensureMerchantExtraSections() {
  const shell = document.querySelector('.app-shell');
  const metrics = document.querySelector('.metrics-grid');
  if (!shell || !metrics) return;
  let crm = $('merchant-customer-section');
  if (!crm) {
    crm = document.createElement('section');
    crm.id = 'merchant-customer-section';
    crm.className = 'card';
    crm.style.cssText = 'margin:20px 0; padding:18px; background:#fff; border:1px solid #e2e8f0; border-radius:16px; box-shadow:0 8px 24px rgba(15,23,42,.06);';
    crm.innerHTML = `<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap"><div><h2 style="margin:0;font-size:1.12rem;color:#0f172a">Recent Customer Visits</h2><p style="margin:5px 0 0;color:#64748b;font-size:.86rem">Refreshes automatically. WhatsApp messages open as drafts for you to review and send.</p></div><button type="button" id="merchant-refresh-customers" style="border:1px solid #cbd5e1;background:#f8fafc;color:#0f172a;padding:9px 13px;border-radius:10px;font-weight:700">Refresh</button></div><div id="merchant-customer-list" style="margin-top:14px"><p style="color:#64748b">Unlock the dashboard to load recent visits.</p></div>`;
    metrics.insertAdjacentElement('afterend', crm);
    $('merchant-refresh-customers').addEventListener('click', loadMerchantCustomers);
  }
  crm.hidden = !merchantToken;
  let pricing = $('merchant-pricing-section');
  if (!pricing) {
    pricing = document.createElement('section');
    pricing.id = 'merchant-pricing-section';
    pricing.className = 'card';
    pricing.style.cssText = 'margin:20px 0; padding:18px; background:#fff; border:1px solid #e2e8f0; border-radius:16px; box-shadow:0 8px 24px rgba(15,23,42,.06);';
    pricing.innerHTML = `<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap"><div><h2 style="margin:0;font-size:1.12rem;color:#0f172a">Shop Pricing</h2><p style="margin:5px 0 0;color:#64748b;font-size:.86rem">Edit prices only. Changes are recorded in Price History.</p></div><button type="button" id="merchant-add-price" style="border:1px solid #cbd5e1;background:#f8fafc;color:#0f172a;padding:9px 13px;border-radius:10px;font-weight:700">+ Add item</button></div><div id="merchant-pricing-list" style="margin-top:14px"></div><button id="merchant-save-pricing" type="button" style="margin-top:12px;width:100%;border:0;background:#2563eb;color:#fff;padding:12px;border-radius:10px;font-weight:700">Save Pricing</button>`;
    crm.insertAdjacentElement('afterend', pricing);
    $('merchant-add-price').addEventListener('click', () => addMerchantPriceRow());
    $('merchant-save-pricing').addEventListener('click', saveMerchantPricing);
  }
  pricing.hidden = true;
  let approvals=$('merchant-approval-section');
  if(!approvals){approvals=document.createElement('section');approvals.id='merchant-approval-section';approvals.className='card';approvals.style.cssText='margin:20px 0;padding:18px;background:#fff;border:1px solid #e2e8f0;border-radius:16px';approvals.innerHTML='<div><h2 style="margin:0">Recent-visit approval requests</h2><p style="margin:5px 0 0;color:#64748b;font-size:.86rem">Requests expire automatically after five minutes.</p></div><div id="merchant-approval-list" style="margin-top:14px">No pending requests.</div>';pricing.insertAdjacentElement('afterend',approvals);approvals.addEventListener('click',async e=>{const b=e.target.closest('button[data-approval]');if(!b)return;b.disabled=true;try{const r=await apiPost({action:'nfcDecision',shopId:currentSlug,merchantToken,requestId:b.dataset.id,decision:b.dataset.approval});if(r.status!=='success')throw new Error(r.message||'Decision failed.');showToast(r.message);await loadMerchantCustomers();}catch(err){showToast(err.message,true);}finally{b.disabled=false;}});}
  approvals.hidden=!merchantToken;
  let comm=$('merchant-communication-section');
  if(!comm){comm=document.createElement('section');comm.id='merchant-communication-section';comm.className='card';comm.style.cssText='margin:20px 0;padding:18px;background:#fff;border:1px solid #e2e8f0;border-radius:16px';comm.innerHTML='<h2 style="margin:0">Email & WhatsApp status</h2><p style="margin:5px 0 0;color:#64748b;font-size:.86rem">SENT means Apps Script accepted the email request, not confirmed inbox delivery. WhatsApp drafts are not marked sent automatically.</p><div id="merchant-communication-list" style="margin-top:14px">No messages recorded.</div>';approvals.insertAdjacentElement('afterend',comm);}
  comm.hidden=!merchantToken;
  if (!$('ccd-merchant-mobile-styles')) { const style = document.createElement('style'); style.id='ccd-merchant-mobile-styles'; style.textContent='@media(max-width:640px){.merchant-price-row{grid-template-columns:1fr 1fr!important}.merchant-price-row .merchant-price-desc{grid-column:1/-1}.merchant-price-row button{grid-column:1/-1}}'; document.head.appendChild(style); }
}

function addMerchantPriceRow(item = '', price = '', desc = '') {
  const list = $('merchant-pricing-list');
  if (!list) return;
  const row = document.createElement('div');
  row.className = 'merchant-price-row';
  row.style.cssText = 'display:grid;grid-template-columns:minmax(100px,1.2fr) minmax(90px,.7fr) minmax(120px,1.4fr) auto;gap:8px;margin-bottom:9px;align-items:center';
  row.innerHTML = `<input class="merchant-price-name" placeholder="Item or service" value="${escapeHtml(item)}" style="min-width:0;padding:10px;border:1px solid #cbd5e1;border-radius:9px"><input class="merchant-price-value" placeholder="₹ Price" value="${escapeHtml(price)}" style="min-width:0;padding:10px;border:1px solid #cbd5e1;border-radius:9px"><input class="merchant-price-desc" placeholder="Description (optional)" value="${escapeHtml(desc)}" style="min-width:0;padding:10px;border:1px solid #cbd5e1;border-radius:9px"><button type="button" aria-label="Remove price item" style="padding:9px;border:0;border-radius:8px;background:#fee2e2;color:#991b1b" onclick="this.closest('.merchant-price-row').remove()">Remove</button>`;
  list.appendChild(row);
}

function renderMerchantPricing(items) {
  ensureMerchantExtraSections();
  const list = $('merchant-pricing-list');
  if (!list) return;
  list.innerHTML = '';
  (Array.isArray(items) ? items : []).forEach(item => addMerchantPriceRow(item.item, item.price, item.desc));
  if (!list.children.length) list.innerHTML = '<p style="color:#64748b">No prices have been added yet. Use Add item to start a price list.</p>';
  list.addEventListener('click', e => { if (e.target && e.target.matches('button[aria-label="Remove price item"]')) {} }, { once: true });
}

async function saveMerchantPricing() {
  if (!merchantToken) return showToast('Unlock the dashboard again.', true);
  const rows = Array.from(document.querySelectorAll('.merchant-price-row'));
  const pricing = rows.map(row => ({
    item: row.querySelector('.merchant-price-name').value.trim(),
    price: row.querySelector('.merchant-price-value').value.trim(),
    desc: row.querySelector('.merchant-price-desc').value.trim(), currency: 'INR'
  })).filter(item => item.item);
  if (rows.some(row => row.querySelector('.merchant-price-name').value.trim() && !row.querySelector('.merchant-price-value').value.trim())) return showToast('Enter a price for every named item.', true);
  const btn = $('merchant-save-pricing');
  if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }
  try {
    const result = await apiPost({ action: 'updateMerchantPricing', shopId: currentSlug, merchantToken, pricing });
    if (result.status !== 'success') throw new Error(result.message || 'Pricing could not be saved.');
    showToast('Prices saved. Price History has been updated.');
  } catch (err) { showToast(err.message || 'Pricing could not be saved.', true); }
  finally { if (btn) { btn.disabled = false; btn.textContent = 'Save Pricing'; } }
}

function makeCustomerWhatsAppLink(customer) {
  let digits = String(customer.fullNumber || customer.formattedPhone || customer.phone || '').replace(/\D/g, '');
  if (digits.length === 10) digits = '91' + digits;
  if (digits.length < 11) return '';
  const shopName = merchantStoreConfig && merchantStoreConfig.shopName || currentSlug;
  const shopUrl = `https://${currentSlug}.ccd.dev/`;
  const tpl=merchantStoreConfig&&merchantStoreConfig.customerWhatsAppTemplate;
  if(!tpl||!tpl.body)return '';
  const vars={customerName:customer.name||'there',customerMobile:customer.phone||'',shopName:shopName,shopId:currentSlug,shopUrl:shopUrl,totalVisits:customer.totalVisits||'',ownerName:merchantStoreConfig&&merchantStoreConfig.ownerName||''};
  const message=String(tpl.body).replace(/\{\{([a-zA-Z0-9_]+)\}\}/g,(_,k)=>String(vars[k]===undefined?'':vars[k]));
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

function renderMerchantCommunications(items){const box=$('merchant-communication-list');if(!box)return;const rows=Array.isArray(items)?items:[];box.innerHTML=rows.length?rows.map(x=>`<div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;padding:9px 0;border-bottom:1px solid #e2e8f0"><span><strong>${escapeHtml(x.channel||'')}</strong> · ${escapeHtml(x.type||'')}<small style="display:block;color:#64748b">${escapeHtml(x.recipient||'')} · ${escapeHtml(x.templateKey||'')}</small></span><span><strong>${escapeHtml(x.status||'UNKNOWN')}</strong><small style="display:block;color:#64748b">${x.sentAt?escapeHtml(new Date(x.sentAt).toLocaleString()):''}</small></span></div>`).join(''):'<p style="color:#64748b">No email or WhatsApp activity recorded yet.</p>';}

let merchantApprovalCountdownTimer=null;
function updateMerchantApprovalCountdowns(){document.querySelectorAll('[data-approval-expiry]').forEach(el=>{const seconds=Math.max(0,Math.ceil((Number(el.dataset.approvalExpiry)-Date.now())/1000));el.textContent=seconds>0?`expires in ${seconds}s`:'expired';if(seconds<=0){const article=el.closest('article');if(article)article.remove();}});}
function renderMerchantApprovals(items){
 const section=$('merchant-approval-section'),list=$('merchant-approval-list');if(!section||!list)return;const active=Array.isArray(items)?items:[];section.hidden=!merchantToken;
 list.innerHTML=active.length?active.map(r=>`<article style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;padding:12px 0;border-bottom:1px solid #e2e8f0"><div><strong>${escapeHtml(r.customerName||'Customer')}</strong><div style="color:#64748b;font-size:.85rem">${escapeHtml(r.mobile||'')} · <span data-approval-expiry="${new Date(r.expiresAt).getTime()}">expires in ${Math.max(0,Math.ceil((r.remainingMs||0)/1000))}s</span></div></div><div style="display:flex;gap:8px"><button type="button" data-approval="APPROVED" data-id="${escapeHtml(r.requestId)}" style="background:#059669;color:white;border:0;border-radius:8px;padding:9px 12px">Approve</button><button type="button" data-approval="REJECTED" data-id="${escapeHtml(r.requestId)}" style="background:#dc2626;color:white;border:0;border-radius:8px;padding:9px 12px">Reject</button></div></article>`).join(''):'<p style="color:#64748b">No pending approval requests.</p>';
 updateMerchantApprovalCountdowns();if(!merchantApprovalCountdownTimer)merchantApprovalCountdownTimer=setInterval(updateMerchantApprovalCountdowns,1000);
}

async function loadMerchantCustomers() {
  if (!merchantToken) return;
  const list = $('merchant-customer-list');
  if (list && !list.dataset.loading) list.dataset.loading = '1';
  try {
    const data = await apiPost({ action: 'getMerchantData', shopId: currentSlug, merchantToken });
    if(data.dashboardTheme) applyMerchantDashboardTheme(data.dashboardTheme);
    if(merchantStoreConfig) merchantStoreConfig.customerWhatsAppTemplate=data.customerWhatsAppTemplate||null;
    renderMerchantCommunications(data.communications||[]);
    const serviceFlags=data.services||{};
    applyMerchantServiceVisibility(serviceFlags);
    renderMerchantApprovals(data.approvalRequests||[]);
    if (!merchantPricingInitialized && Array.isArray(data.pricing)) { renderMerchantPricing(data.pricing); merchantPricingInitialized = true; }
    const customers = Array.isArray(data.customers) ? data.customers.slice().reverse() : [];
    const latest = customers.slice(0, 50);
    const today = new Date().toDateString();
    const todayCount = customers.filter(c => c.timestamp && new Date(c.timestamp).toDateString() === today).length;
    const uniqueCount = new Set(customers.map(c => String(c.phone || '').replace(/\D/g, '')).filter(Boolean)).size;
    if ($('stat-today-visits')) $('stat-today-visits').textContent = String(todayCount);
    if ($('stat-total-customers')) $('stat-total-customers').textContent = String(data.uniqueCustomers == null ? uniqueCount : data.uniqueCustomers);
    if (list && !list.dataset.waHandler) { list.dataset.waHandler='1'; list.addEventListener('click',async e=>{const b=e.target.closest('button[data-customer-wa]');if(!b)return;const popup=window.open('about:blank','_blank');b.disabled=true;try{const r=await apiPost({action:'logMerchantWhatsAppDraft',shopId:currentSlug,merchantToken,phone:b.dataset.customerWa});if(r.status!=='success')throw new Error(r.message||'Could not prepare WhatsApp message.');if(popup)popup.location.href=b.dataset.waUrl;showToast('WhatsApp draft prepared. Press Send in WhatsApp.');await loadMerchantCustomers();}catch(err){if(popup)popup.close();showToast(err.message,true);}finally{b.disabled=false;}}); }
    if (list) {
      if (!latest.length) list.innerHTML = '<p style="color:#64748b">No customer visits have been recorded for this shop yet.</p>';
      else list.innerHTML = latest.map(c => {
        const opted = String(c.whatsappOptIn || '').toUpperCase() === 'YES';
        const link = opted ? makeCustomerWhatsAppLink(c) : '';
        const when = c.timestamp ? new Date(c.timestamp).toLocaleString() : 'Visit date unavailable';
        return `<article style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;padding:12px 0;border-bottom:1px solid #e2e8f0"><div style="min-width:170px;flex:1"><strong style="display:block;color:#0f172a">${escapeHtml(c.name || 'Customer')}</strong><span style="display:block;color:#64748b;font-size:.85rem">${escapeHtml(c.phone || '')} · ${escapeHtml(when)}</span><span style="display:block;color:#64748b;font-size:.78rem">WhatsApp consent: ${opted ? 'Yes' : 'No'}</span></div>${link ? `<button type="button" data-customer-wa="${escapeHtml(c.phone||'')}" data-wa-url="${escapeHtml(link)}" style="display:inline-block;background:#0f766e;color:#fff;border:0;border-radius:9px;padding:9px 12px;font-weight:700">Send WhatsApp</button>` : '<span style="font-size:.8rem;color:#94a3b8">No WhatsApp consent</span>'}</article>`;
      }).join('');
    }
  } catch (err) {
    if (list) list.innerHTML = `<p style="color:#b91c1c">${escapeHtml(err.message || 'Unable to load customer visits.')}</p>`;
    if (/session expired/i.test(err.message || '')) {
      endMerchantSession('Your Merchant session expired. Verify your email or use your shop PIN again.');
      if ($('auth-backdrop')) $('auth-backdrop').classList.add('active');
      if ($('pin-input')) { $('pin-input').value = ''; $('pin-input').focus(); }
      const customerSection = $('merchant-customer-section');
      const pricingSection = $('merchant-pricing-section');
      if (customerSection) customerSection.hidden = true;
      if (pricingSection) pricingSection.hidden = true;
      if (merchantCustomerTimer) { clearInterval(merchantCustomerTimer); merchantCustomerTimer = null; }
    }
  } finally { if (list) delete list.dataset.loading; }
}

async function apiPost(payload) {
  const res = await fetch(SCRIPT_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload)
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); }
  catch (err) { throw new Error("Server returned an unreadable response."); }
  if (!res.ok || data.status === "error") throw new Error(data.message || "Request failed.");
  return data;
}

function verifyAuth() {
  merchantToken = sessionStorage.getItem(`merchant_auth_${currentSlug}`) || "";
  const overlay = $("auth-backdrop");
  if (!merchantToken && overlay) {
    overlay.classList.add("active");
    if ($("merchant-email-otp")) $("merchant-email-otp").value = "";
  }
}

const statusToggle = $("status-toggle");
const statusCard = $("status-card-box");
const statusHeadline = $("status-headline");

if (statusToggle) {
  statusToggle.addEventListener("change", () => {
    if (statusCard) statusCard.classList.toggle("closed", !statusToggle.checked);
    if (statusHeadline) statusHeadline.textContent = statusToggle.checked ? "STORE IS OPEN" : "STORE IS CLOSED";
  });
}

document.querySelectorAll(".time-chip").forEach(chip => {
  chip.addEventListener("click", () => {
    if ($("closing-time-input")) $("closing-time-input").value = chip.getAttribute("data-time") || "";
  });
});

async function initDashboard() {
  const params = new URLSearchParams(window.location.search);
  const host = String(location.hostname || '').toLowerCase();
  const hostSlug = host.endsWith('.ccd.dev') ? host.slice(0, -'.ccd.dev'.length) : '';
  const reserved = ['www','admin','register','api','assets','support','mail'];
  currentSlug = (params.get('shop') || (hostSlug && !reserved.includes(hostSlug) ? hostSlug : '') || 'memonlock').trim().toLowerCase();
  if (!/^[a-z0-9_-]{3,50}$/.test(currentSlug)) currentSlug = "memonlock";

  if ($("dash-shop-slug")) $("dash-shop-slug").textContent = `slug: ${currentSlug}`;
  if ($("preview-storefront-btn")) $("preview-storefront-btn").href = `https://${currentSlug}.ccd.dev/`;

  verifyAuth();
  if(merchantToken)startMerchantSessionTimers();

  try {
    const data = await apiPost({ action: "getStoreConfig", shopId: currentSlug, clientType: "MERCHANT_BOOTSTRAP" });
    if (!data.store) throw new Error("Store profile is unavailable.");
    const s = data.store;
    merchantStoreConfig = s;
    applyMerchantDashboardTheme(s.dashboardTheme || "midnight-blue");
    applyMerchantServiceVisibility(s.services||{});
    if($('preview-storefront-btn'))$('preview-storefront-btn').href=`https://${currentSlug}.ccd.dev/`;
    ensureMerchantExtraSections();
    renderMerchantPricing(s.pricing || []);
    if ($("dash-shop-name")) $("dash-shop-name").textContent = s.shopName || currentSlug;
    if ($("page-title")) $("page-title").textContent = `${s.shopName || currentSlug} | Dashboard`;
    if ($("merchant-review-url")) $("merchant-review-url").value = s.reviewUrl || "";
    if ($("merchant-phone")) $("merchant-phone").value = s.ownerMobile || "";
    if (statusToggle) statusToggle.checked = s.isOpen !== false;
    if (statusCard) statusCard.classList.toggle("closed", s.isOpen === false);
    if (statusHeadline) statusHeadline.textContent = s.isOpen === false ? "STORE IS CLOSED" : "STORE IS OPEN";
    if ($("closing-time-input")) $("closing-time-input").value = s.closingTime || "9:00 PM";
    if ($("promo-toggle")) $("promo-toggle").checked = !!s.promoEnabled;
    if ($("promo-headline-input")) $("promo-headline-input").value = s.promoHeadline || "";
    if ($("promo-code-input")) $("promo-code-input").value = s.promoCode || "";
    if ($("promo-desc-input")) $("promo-desc-input").value = s.promoDescription || "";
    if ($("stat-today-visits")) $("stat-today-visits").textContent = s.totalCustomers || "0";
    if ($("stat-total-customers")) $("stat-total-customers").textContent = s.totalCustomers || "0";
  } catch (err) {
    console.warn("Unable to load store configuration:", err);
    showToast(err.message || "Unable to load store data.", true);
  }
  if (merchantToken) {
    ensureMerchantExtraSections();
    await loadMerchantCustomers();
    if (merchantCustomerTimer) clearInterval(merchantCustomerTimer);
    merchantCustomerTimer = setInterval(() => { if (merchantToken && !document.hidden) loadMerchantCustomers(); }, 15000);
  }
}

const sendMerchantOtpBtn = $('btn-send-email-otp');
if (sendMerchantOtpBtn) sendMerchantOtpBtn.addEventListener('click', async () => {
  sendMerchantOtpBtn.disabled=true;sendMerchantOtpBtn.textContent='Sending OTP…';
  try {
    const r=await apiPost({action:'merchantOtpStart',shopId:currentSlug});
    if(r.status!=='success')throw new Error(r.message||'Could not send merchant OTP.');
    if($('merchant-email-otp-step'))$('merchant-email-otp-step').hidden=false;
    if($('merchant-otp-destination'))$('merchant-otp-destination').textContent=r.message||('Code sent to '+(r.maskedEmail||'registered email'));
    if($('merchant-email-otp'))$('merchant-email-otp').focus();
    showToast(r.message||'Merchant OTP sent.');
  } catch(e) {showToast(e.message||'Could not send email OTP.',true);}
  finally {sendMerchantOtpBtn.disabled=false;sendMerchantOtpBtn.textContent='Resend email OTP';}
});
const verifyMerchantOtpBtn=$('btn-verify-email-otp');
if(verifyMerchantOtpBtn)verifyMerchantOtpBtn.addEventListener('click',async()=>{
  const otp=$('merchant-email-otp')?$('merchant-email-otp').value.trim():'';
  if(!/^\d{6}$/.test(otp))return showToast('Enter the six-digit code sent to the registered merchant email.',true);
  verifyMerchantOtpBtn.disabled=true;verifyMerchantOtpBtn.textContent='Verifying…';
  try{
    const result=await apiPost({action:'merchantOtpVerify',shopId:currentSlug,otp});
    if(!result.authorized||!result.sessionToken)throw new Error(result.message||'Email OTP verification failed.');
    merchantToken=result.sessionToken;sessionStorage.setItem(`merchant_auth_${currentSlug}`,merchantToken);startMerchantSessionTimers();
    if($('auth-backdrop'))$('auth-backdrop').classList.remove('active');
    ensureMerchantExtraSections();await loadMerchantCustomers();
    if(merchantCustomerTimer)clearInterval(merchantCustomerTimer);
    merchantCustomerTimer=setInterval(()=>{if(merchantToken&&!document.hidden)loadMerchantCustomers();},15000);
    showToast('Merchant email verified. Dashboard unlocked.');
  }catch(e){showToast(e.message||'OTP verification failed.',true);if($('merchant-email-otp')){$('merchant-email-otp').value='';$('merchant-email-otp').focus();}}
  finally{verifyMerchantOtpBtn.disabled=false;verifyMerchantOtpBtn.textContent='Verify OTP & unlock';}
});
if($('use-pin-login'))$('use-pin-login').addEventListener('click',()=>{if($('pin-login-panel'))$('pin-login-panel').hidden=false;if($('pin-input'))$('pin-input').focus();});
const unlockBtn = $('btn-unlock');
if (unlockBtn) unlockBtn.addEventListener('click', async () => {
  const pin = $('pin-input') ? $('pin-input').value.trim() : '';
  if (!/^\d{6,12}$/.test(pin)) return showToast('Enter the 6–12 digit merchant PIN configured by CCD Admin.', true);
  unlockBtn.disabled = true; unlockBtn.textContent = 'Verifying…';
  try {
    const result = await apiPost({ action: 'verifyMerchantPin', shopId: currentSlug, pin });
    if (!result.authorized || !result.sessionToken) throw new Error(result.message || 'PIN verification failed.');
    merchantToken = result.sessionToken;sessionStorage.setItem(`merchant_auth_${currentSlug}`, merchantToken);startMerchantSessionTimers();
    if ($('auth-backdrop')) $('auth-backdrop').classList.remove('active');
    ensureMerchantExtraSections();await loadMerchantCustomers();
    if (merchantCustomerTimer) clearInterval(merchantCustomerTimer);
    merchantCustomerTimer = setInterval(() => { if (merchantToken && !document.hidden) loadMerchantCustomers(); }, 15000);
    showToast('Dashboard unlocked successfully.');
  } catch (err) {showToast(err.message || 'Verification error. Check your connection.', true);if ($('pin-input')) { $('pin-input').value = ''; $('pin-input').focus(); }}
  finally {unlockBtn.disabled = false;unlockBtn.textContent = 'Unlock with PIN';}
});

if ($("pin-input")) $("pin-input").addEventListener("keydown", e => { if (e.key === "Enter" && unlockBtn) unlockBtn.click(); });
if ($("btn-logout")) $("btn-logout").addEventListener("click", () => {
  sessionStorage.removeItem(`merchant_auth_${currentSlug}`);
  merchantToken = "";
  location.reload();
});

if ($("save-status-btn")) {
  $("save-status-btn").addEventListener("click", async () => {
    if (!merchantToken) return showToast("Unlock the dashboard again.", true);
    const btn = $("save-status-btn");
    btn.disabled = true;
    const idle = btn.innerHTML;
    btn.textContent = "Saving...";
    try {
      await apiPost({
        action: "updateStoreStatus", shopId: currentSlug, merchantToken,
        isOpen: !!(statusToggle && statusToggle.checked),
        closingTime: $("closing-time-input") ? $("closing-time-input").value.trim() : "9:00 PM"
      });
      showToast("Live store status updated.");
    } catch (err) {
      if (/session expired/i.test(err.message)) {
        sessionStorage.removeItem(`merchant_auth_${currentSlug}`);
        merchantToken = "";
      }
      showToast(err.message || "Update failed. Please try again.", true);
    } finally {
      btn.disabled = false;
      btn.innerHTML = idle;
    }
  });
}

if ($("save-promo-btn")) {
  $("save-promo-btn").addEventListener("click", async () => {
    if (!merchantToken) return showToast("Unlock the dashboard again.", true);
    const btn = $("save-promo-btn");
    btn.disabled = true;
    try {
      await apiPost({
        action: "updateMerchantPromo", shopId: currentSlug, merchantToken,
        promoEnabled: !!($("promo-toggle") && $("promo-toggle").checked),
        promoHeadline: $("promo-headline-input") ? $("promo-headline-input").value.trim() : "",
        promoCode: $("promo-code-input") ? $("promo-code-input").value.trim() : "",
        promoDescription: $("promo-desc-input") ? $("promo-desc-input").value.trim() : ""
      });
      showToast("Offer settings saved to Google Sheets.");
    } catch (err) {
      showToast(err.message || "Unable to save offer settings.", true);
    } finally { btn.disabled = false; }
  });
}

if ($("save-profile-btn")) {
  $("save-profile-btn").addEventListener("click", async () => {
    if (!merchantToken) return showToast("Unlock the dashboard again.", true);
    const btn = $("save-profile-btn");
    btn.disabled = true;
    try {
      await apiPost({
        action: "updateMerchantProfile", shopId: currentSlug, merchantToken,
        reviewUrl: $("merchant-review-url") ? $("merchant-review-url").value.trim() : "",
        ownerMobile: $("merchant-phone") ? $("merchant-phone").value.trim() : ""
      });
      showToast("Contact details saved to Google Sheets.");
    } catch (err) {
      showToast(err.message || "Unable to save contact details.", true);
    } finally { btn.disabled = false; }
  });
}

if ($("btn-refresh")) $("btn-refresh").addEventListener("click", () => {
  showToast("Refreshing latest numbers...");
  if (merchantToken) loadMerchantCustomers();
  setTimeout(() => location.reload(), 400);
});

window.addEventListener("DOMContentLoaded", () => Promise.resolve(initDashboard()).finally(() => window.CCDLoading && window.CCDLoading.finish()));
