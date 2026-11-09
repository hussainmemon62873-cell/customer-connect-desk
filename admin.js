// ==========================================
if (window.CCDLoading) window.CCDLoading.hold();
// ENTERPRISE B2B ADMIN ENGINE (admin.js)
// Zero Browser Alerts + Step Validation + Master-Sheet Sync
// ==========================================

const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzNPnuDhiXOrm4-tRJJ7wXpb7PMwifLQfK-i3pbW-QaOrU74fm-PFgh9aT2sntGLZgx/exec";
const BASE_DOMAIN = "https://ccd.dev";

let currentUser = { name: "", email: "", sessionToken: "" };
let allStoresCache = [];
let allRegistrationRequestsCache = [];
let pendingDeleteSlug = null;
let pendingLifecycleOperation = "ARCHIVE";
let statusFilter = "ALL";
let toastTimer = null;
let lastFocus = null;

const $ = id => document.getElementById(id);
const ico = name => `<svg class="i" aria-hidden="true"><use href="#i-${name}"/></svg>`;
const esc = v => String(v == null ? "" : v).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));


const CCD_CATEGORY_LABELS = {
  general:'General business', salon:'Beauty salon & wellness', restaurant:'Restaurant & cafe', retail:'Retail & fashion',
  grocery:'Grocery & supermarket', electronics:'Electronics & appliances', clinic:'Clinic & healthcare',
  education:'Education & coaching', 'home-services':'Home services', automotive:'Automotive & garage',
  'real-estate':'Real estate', organic:'Organic & lifestyle', professional:'Professional services'
};
const CCD_NAV_PRESETS = {
  general:[['Home','home'],['Services','services'],['About','about'],['Contact','contact']],
  salon:[['Home','home'],['Treatments','services'],['Packages','pricing'],['Gallery','media'],['About','about'],['Book now','contact']],
  restaurant:[['Home','home'],['Menu','pricing'],['Specials','blog'],['Gallery','media'],['About','about'],['Contact','contact']],
  retail:[['Home','home'],['Products','pricing'],['Offers','blog'],['Gallery','media'],['About','about'],['Contact','contact']],
  grocery:[['Home','home'],['Catalogue','pricing'],['Offers','blog'],['Contact','contact']],
  electronics:[['Home','home'],['Products','pricing'],['Services','services'],['Support','contact']],
  clinic:[['Home','home'],['Treatments','services'],['Fees','pricing'],['About','about'],['Contact','contact']],
  education:[['Home','home'],['Courses','services'],['Fees','pricing'],['About','about'],['Contact','contact']],
  'home-services':[['Home','home'],['Services','services'],['Pricing','pricing'],['Gallery','media'],['Contact','contact']],
  automotive:[['Home','home'],['Services','services'],['Estimates','pricing'],['Gallery','media'],['Contact','contact']],
  'real-estate':[['Home','home'],['Properties','pricing'],['About','about'],['Contact','contact']],
  organic:[['Home','home'],['Products','pricing'],['Our story','about'],['Gallery','media'],['Contact','contact']],
  professional:[['Home','home'],['Expertise','services'],['Fees','pricing'],['About','about'],['Contact','contact']]
};
function ensureStoreExperienceStudio(){
  const modal=$('edit-content-modal'); if(!modal||$('ccd-experience-studio'))return;
  const box=document.createElement('section'); box.id='ccd-experience-studio'; box.className='ccd-experience-studio';
  box.innerHTML=`<div class="ccd-studio-heading"><div><span class="eyebrow">STOREFRONT CONTROL</span><h3>Store Experience Studio</h3><p>Choose the store experience and navigation. CCD automatically positions every section for desktop, tablet and mobile.</p></div><span class="ccd-auto-layout-chip">Auto layout enabled</span></div>
    <div class="ccd-studio-grid"><label>Store activation mode<select id="ccd-experience-mode" class="form-input"><option value="COMMUNICATION_ONLY">1 · Communication only</option><option value="WEBSITE_COMMUNICATION">2 · Website + communication</option><option value="MENU_ONLY">3 · Menu / catalogue only</option></select><small>Mode 1 enables customer communication without a public website. Mode 2 enables the full business website. Mode 3 shows only the catalogue experience.</small></label>
    <label>Business category<select id="ccd-business-category" class="form-input">${Object.entries(CCD_CATEGORY_LABELS).map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}</select><small>The category selects the page structure, typography, spacing and visual treatment.</small></label>
    <label>Navigation preset<select id="ccd-nav-preset" class="form-input"><option value="auto">Recommended for category</option><option value="custom">Custom navigation</option></select><small>Choose a preset or create your own menu below.</small></label></div>
    <div class="ccd-nav-builder"><div class="ccd-nav-builder-head"><div><h4>Navigation Studio</h4><p>Arrange only the menu labels and destinations. The website engine handles the layout and responsive sizing.</p></div><button type="button" class="btn btn-quiet" id="ccd-nav-add">＋ Add item</button></div><div id="ccd-nav-rows"></div></div>
    <p class="ccd-studio-note">Publishing rules: only Admin can change the category, mode, navigation and public content. A menu item is shown only when its destination has published content. Storefront sections are auto-arranged by the selected category template; no manual CSS or page placement is required.</p>`;
  const media=$('ccd-media-editor');
  const save=modal.querySelector('button[onclick="saveStoreContentChanges()"]');
  if(media)media.insertAdjacentElement('afterend',box);else if(save)save.parentNode.insertBefore(box,save);
  $('ccd-business-category').addEventListener('change',()=>{
    const cat=$('ccd-business-category').value;
    if($('edit-store-layout'))$('edit-store-layout').value=cat;
    if($('ccd-nav-preset').value!=='custom')renderAdminNavigationRows(CCD_NAV_PRESETS[cat]||CCD_NAV_PRESETS.general);
  });
  $('ccd-nav-preset').addEventListener('change',()=>{
    if($('ccd-nav-preset').value==='custom')return;
    const cat=$('ccd-business-category').value;
    renderAdminNavigationRows(CCD_NAV_PRESETS[cat]||CCD_NAV_PRESETS.general);
  });
  $('ccd-nav-add').addEventListener('click',()=>{ $('ccd-nav-preset').value='custom'; addAdminNavigationRow({label:'New page',target:'home'}); });
  $('ccd-nav-rows').addEventListener('click',e=>{
    const row=e.target.closest('.ccd-nav-row'); if(!row)return;
    if(e.target.closest('[data-nav-remove]'))row.remove();
    else if(e.target.closest('[data-nav-up]')&&row.previousElementSibling)row.parentNode.insertBefore(row,row.previousElementSibling);
    else if(e.target.closest('[data-nav-down]')&&row.nextElementSibling)row.parentNode.insertBefore(row.nextElementSibling,row);
    $('ccd-nav-preset').value='custom';
  });
}
function addAdminNavigationRow(item={}){
  const wrap=$('ccd-nav-rows');if(!wrap)return;
  const row=document.createElement('div');row.className='ccd-nav-row';
  const target=String(item.target||'home');
  row.innerHTML=`<input class="ccd-nav-label form-input" maxlength="24" aria-label="Navigation label" placeholder="Menu label" value="${esc(item.label||'')}"/><select class="ccd-nav-target form-input" aria-label="Navigation destination"><option value="home">Home</option><option value="services">Services / treatments</option><option value="pricing">Catalogue / pricing</option><option value="about">About</option><option value="blog">Updates / offers</option><option value="media">Gallery</option><option value="contact">Contact / enquiry</option></select><div class="ccd-nav-order"><button type="button" data-nav-up aria-label="Move up">↑</button><button type="button" data-nav-down aria-label="Move down">↓</button><button type="button" data-nav-remove aria-label="Remove item">×</button></div>`;
  wrap.appendChild(row);row.querySelector('.ccd-nav-target').value=target;
}
function renderAdminNavigationRows(items){const wrap=$('ccd-nav-rows');if(!wrap)return;wrap.innerHTML='';(Array.isArray(items)?items:[]).forEach(item=>addAdminNavigationRow(item));}
function readAdminNavigationRows(){return Array.from(document.querySelectorAll('#ccd-nav-rows .ccd-nav-row')).map(row=>({label:row.querySelector('.ccd-nav-label').value.trim(),target:row.querySelector('.ccd-nav-target').value})).filter(item=>item.label).slice(0,10);}
function initAdminExperienceFields(content={}){
  ensureStoreExperienceStudio();
  const category=Object.prototype.hasOwnProperty.call(CCD_CATEGORY_LABELS,content.categoryKey)?content.categoryKey:(Object.prototype.hasOwnProperty.call(CCD_CATEGORY_LABELS,content.layoutStyle)?content.layoutStyle:'general');
  $('ccd-business-category').value=category;
  $('ccd-experience-mode').value=['COMMUNICATION_ONLY','WEBSITE_COMMUNICATION','MENU_ONLY'].includes(content.experienceMode)?content.experienceMode:'WEBSITE_COMMUNICATION';
  const hasCustom=Array.isArray(content.navigation)&&content.navigation.length>0;
  $('ccd-nav-preset').value=hasCustom?'custom':'auto';
  renderAdminNavigationRows(hasCustom?content.navigation:(CCD_NAV_PRESETS[category]||CCD_NAV_PRESETS.general));
}

function ensureHomeContentField() {
  const about = $('edit-store-about');
  if (!about) return;
  if (!$('edit-store-home')) {
    const label = document.createElement('label');
    label.textContent = 'Home Page Introduction (separate paragraphs with a blank line)';
    const area = document.createElement('textarea');
    area.id = 'edit-store-home'; area.className = 'form-input'; area.rows = 4;
    area.placeholder = 'Welcome to our shop...';
    area.style.cssText = 'width:100%; margin-bottom:12px;';
    const aboutLabel = about.previousElementSibling;
    about.parentNode.insertBefore(label, aboutLabel || about);
    about.parentNode.insertBefore(area, aboutLabel || about);
  }
  if (!$('edit-store-redirect-url')) {
    const label = document.createElement('label');
    label.textContent = 'After Check-in Redirect URL (optional; HTTPS only)';
    const input = document.createElement('input');
    input.id = 'edit-store-redirect-url'; input.className = 'form-input'; input.type = 'url';
    input.placeholder = 'https://your-shop-website.example';
    input.style.cssText = 'width:100%; margin-bottom:12px;';
    about.parentNode.insertBefore(label, about);
    about.parentNode.insertBefore(input, about);
  }
  if (!$('edit-store-owner-mobile')) {
    const fields = document.createElement('div'); fields.id = 'ccd-admin-contact-fields';
    fields.innerHTML = `<label>Shop Contact Mobile</label><input id="edit-store-owner-mobile" class="form-input" type="tel" inputmode="numeric" maxlength="10" placeholder="10-digit mobile number" style="width:100%;margin-bottom:12px" /><label>Google Review URL</label><input id="edit-store-review-url" class="form-input" type="url" placeholder="https://..." style="width:100%;margin-bottom:12px" /><label>Google Maps Embed URL</label><input id="edit-store-map-url" class="form-input" type="url" placeholder="https://www.google.com/maps/embed?..." style="width:100%;margin-bottom:12px" />`;
    about.parentNode.insertBefore(fields, about);
  }
}

function ensureContentVisibilityControls() {
  const modal = $('edit-content-modal');
  if (!modal || $('ccd-content-visibility')) return;
  const saveButton = modal.querySelector('button[onclick="saveStoreContentChanges()"]');
  if (!saveButton) return;
  const block = document.createElement('section');
  block.id = 'ccd-content-visibility';
  block.style.cssText = 'margin:16px 0;padding:14px;border:1px solid #dbeafe;border-radius:12px;background:#eff6ff;color:#0f172a;';
  block.innerHTML = `<h4 style="margin:0 0 10px">Publish website sections</h4><p style="margin:0 0 10px;color:#475569;font-size:.85rem">Unpublished sections stay hidden from the public website and its navigation.</p><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:9px">${[['homeText','Home introduction'],['aboutText','About'],['services','Services'],['pricing','Pricing'],['contact','Contact']].map(([key,label])=>`<label style="display:flex;align-items:center;gap:8px;font-size:.88rem"><input type="checkbox" id="ccd-publish-${key}" />${label}</label>`).join('')}</div>`;
  saveButton.parentNode.insertBefore(block, saveButton);
}

function ensureAdminMediaEditor() {
  const modal = $('edit-content-modal'); if (!modal || $('ccd-media-editor')) return;
  const section = document.createElement('section'); section.id='ccd-media-editor';
  section.style.cssText='margin:18px 0;padding:16px;border:1px solid #cbd5e1;border-radius:12px;background:#f8fafc;color:#0f172a';
  section.innerHTML=`<h3 style="margin:0 0 6px">Storefront media studio</h3><p style="color:#64748b;font-size:13px">Admin-only controls. Add public image/video URLs or upload files to Cloudflare R2. Use direct HTTPS media links for URL mode.</p><div id="ccd-media-rows"></div><div class="form-actions"><button type="button" class="btn btn-quiet" id="ccd-media-preview">Open published storefront</button><button type="button" class="btn btn-quiet" id="ccd-media-add-image">＋ Add image URL</button><button type="button" class="btn btn-quiet" id="ccd-media-add-video">＋ Add video URL</button><label class="btn btn-quiet" style="cursor:pointer">Upload media<input id="ccd-media-upload" type="file" accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm" multiple hidden></label></div><p id="ccd-media-status" class="muted" aria-live="polite"></p><p class="muted">Upload endpoint: configure the included Cloudflare Worker and R2 bucket, then set CCD_MEDIA_WORKER_URL below. Upload limit is 25 MB per file.</p>`;
  const saveBtn=modal.querySelector('button[onclick="saveStoreContentChanges()"]'); if(saveBtn) saveBtn.parentNode.insertBefore(section,saveBtn);
  $('ccd-media-preview').addEventListener('click',()=>{const slug=$('edit-store-slug').value;if(slug)window.open(`https://${encodeURIComponent(slug)}.ccd.dev/`,'_blank','noopener');});
  $('ccd-media-add-image').addEventListener('click',()=>addAdminMediaRow({type:'image'}));
  $('ccd-media-add-video').addEventListener('click',()=>addAdminMediaRow({type:'video'}));
  $('ccd-media-upload').addEventListener('change',uploadAdminMediaFiles);
}
function addAdminMediaRow(item={}) {
  const wrap=$('ccd-media-rows'); if(!wrap)return;
  const row=document.createElement('div'); row.className='ccd-media-row'; row.style.cssText='display:grid;grid-template-columns:34px 90px minmax(0,2fr) minmax(0,1fr) auto auto;gap:8px;align-items:center;margin:8px 0;padding:8px;background:#fff;border:1px solid #e2e8f0;border-radius:9px';
  const type=item.type==='video'?'video':'image';
  row.innerHTML=`<button type="button" class="btn btn-quiet ccd-media-up" aria-label="Move media up">↑</button><select class="ccd-media-type" aria-label="Media type"><option value="image" ${type==='image'?'selected':''}>Image</option><option value="video" ${type==='video'?'selected':''}>Video</option></select><input class="ccd-media-url" type="url" placeholder="https://media URL" value="${esc(item.url||'')}" aria-label="Media URL"><input class="ccd-media-caption" placeholder="Caption" value="${esc(item.caption||'')}" aria-label="Caption"><label style="font-size:12px"><input class="ccd-media-visible" type="checkbox" ${item.visible===false?'':'checked'}> Visible</label><div style="display:flex;gap:4px"><button type="button" class="btn btn-quiet ccd-media-down" aria-label="Move media down">↓</button><button type="button" class="btn btn-quiet ccd-media-remove" aria-label="Remove media">Remove</button></div>`;
  row.querySelector('.ccd-media-up').addEventListener('click',()=>{const prev=row.previousElementSibling;if(prev)wrap.insertBefore(row,prev);});
  row.querySelector('.ccd-media-down').addEventListener('click',()=>{const next=row.nextElementSibling;if(next)wrap.insertBefore(next,row);});
  row.querySelector('.ccd-media-remove').addEventListener('click',()=>row.remove()); wrap.appendChild(row);
}
async function uploadAdminMediaFiles(event) {
  const files=Array.from(event.target.files||[]); if(!files.length)return;
  const status=$('ccd-media-status'); const endpoint=(window.CCD_MEDIA_WORKER_URL||'').trim();
  if(!endpoint){status.textContent='Set window.CCD_MEDIA_WORKER_URL in admin.html to your deployed Worker URL before uploading.';event.target.value='';return;}
  for(const file of files){
    if(file.size>25*1024*1024){status.textContent=`${file.name}: exceeds the 25 MB limit.`;continue;}
    if(!/^image\/(jpeg|png|webp|gif)$|^video\/(mp4|webm)$/.test(file.type)){status.textContent=`${file.name}: unsupported media type.`;continue;}
    status.textContent=`Uploading ${file.name}…`;
    try{const response=await fetch(endpoint.replace(/\/$/,'')+'/upload',{method:'POST',headers:{'Authorization':'Bearer '+currentUser.sessionToken,'X-CCD-Shop':$('edit-store-slug').value,'X-File-Name':encodeURIComponent(file.name),'Content-Type':file.type},body:file});const data=await response.json();if(!response.ok||!data.url)throw new Error(data.message||'Upload failed.');addAdminMediaRow({type:file.type.startsWith('video/')?'video':'image',url:data.url,caption:file.name,visible:true});status.textContent=`Uploaded ${file.name}.`;}catch(err){status.textContent=`${file.name}: ${err.message}`;}
  }
  event.target.value='';
}
function readAdminMediaRows(){return Array.from(document.querySelectorAll('.ccd-media-row')).map(row=>({type:row.querySelector('.ccd-media-type').value,url:row.querySelector('.ccd-media-url').value.trim(),caption:row.querySelector('.ccd-media-caption').value.trim(),visible:row.querySelector('.ccd-media-visible').checked})).filter(x=>x.url);}

function ensureGlobalPolicyEditor() {
  if ($('btn-global-policies')) return;
  const anchor = $('btn-top-add') || $('btn-refresh-overview');
  if (!anchor) return;
  const btn = document.createElement('button');
  btn.id = 'btn-global-policies'; btn.type = 'button'; btn.className = 'btn-table';
  btn.textContent = 'Shared Policies';
  btn.style.cssText = 'width:auto;min-height:40px;padding:0 12px;margin-left:8px;white-space:nowrap;';
  btn.addEventListener('click', openGlobalPolicyEditor);
  anchor.insertAdjacentElement('afterend', btn);
}

async function openGlobalPolicyEditor() {
  let modal = $('ccd-global-policy-modal');
  if (!modal) {
    modal = document.createElement('div'); modal.id = 'ccd-global-policy-modal';
    modal.style.cssText = 'position:fixed;inset:0;z-index:10050;background:rgba(15,23,42,.62);display:flex;align-items:center;justify-content:center;padding:16px;';
    modal.innerHTML = `<section style="width:min(720px,100%);max-height:90vh;overflow:auto;background:#fff;color:#0f172a;border-radius:16px;padding:20px;box-shadow:0 20px 60px rgba(0,0,0,.25)"><div style="display:flex;justify-content:space-between;align-items:center;gap:12px"><h2 style="margin:0">Shared Policies for All Shops</h2><button id="ccd-policy-close" type="button" style="border:0;background:#e2e8f0;border-radius:8px;padding:8px 12px">Close</button></div><p style="color:#64748b;font-size:.9rem">Edit once here. These policies are shared across all shop websites.</p><label>Privacy Policy</label><textarea id="ccd-policy-privacy" rows="4" style="width:100%;margin:6px 0 14px;padding:10px;border:1px solid #cbd5e1;border-radius:8px"></textarea><label>Terms &amp; Conditions</label><textarea id="ccd-policy-terms" rows="4" style="width:100%;margin:6px 0 14px;padding:10px;border:1px solid #cbd5e1;border-radius:8px"></textarea><label>Cookie Policy</label><textarea id="ccd-policy-cookies" rows="3" style="width:100%;margin:6px 0 14px;padding:10px;border:1px solid #cbd5e1;border-radius:8px"></textarea><label>FAQ (one question and answer per line, separated by |)</label><textarea id="ccd-policy-faq" rows="5" placeholder="How do I contact the shop? | Use the Contact page." style="width:100%;margin:6px 0 14px;padding:10px;border:1px solid #cbd5e1;border-radius:8px"></textarea><button id="ccd-policy-save" type="button" style="width:100%;padding:12px;border:0;border-radius:9px;background:#2563eb;color:#fff;font-weight:700">Save Shared Policies</button></section>`;
    document.body.appendChild(modal);
    $('ccd-policy-close').addEventListener('click', () => modal.remove());
    $('ccd-policy-save').addEventListener('click', saveGlobalPolicies);
  }
  try {
    const result = await apiCall({ action: 'getGlobalPolicies' });
    const policies = result.policies || {};
    $('ccd-policy-privacy').value = policies.privacy || '';
    $('ccd-policy-terms').value = policies.terms || '';
    $('ccd-policy-cookies').value = policies.cookies || '';
    $('ccd-policy-faq').value = (policies.faq || []).map(item => `${item.q || ''} | ${item.a || ''}`).join('\n');
  } catch (err) { showDbToast(err.message || 'Unable to load shared policies.', true); }
}

async function saveGlobalPolicies() {
  const faq = $('ccd-policy-faq').value.split('\n').map(line => line.trim()).filter(Boolean).map(line => {
    const parts = line.split('|'); return { q: (parts.shift() || '').trim(), a: parts.join('|').trim() };
  }).filter(item => item.q && item.a);
  const btn = $('ccd-policy-save'); btn.disabled = true; btn.textContent = 'Saving…';
  try {
    const result = await apiCall({ action: 'updateGlobalPolicies', policies: {
      privacy: $('ccd-policy-privacy').value.trim(), terms: $('ccd-policy-terms').value.trim(),
      cookies: $('ccd-policy-cookies').value.trim(), faq
    }});
    if (result.status !== 'success') throw new Error(result.message || 'Policies were not saved.');
    showDbToast('Shared policies saved for all shops.');
    $('ccd-global-policy-modal').remove();
  } catch (err) { showDbToast(err.message || 'Unable to save shared policies.', true); }
  finally { if (btn) { btn.disabled = false; btn.textContent = 'Save Shared Policies'; } }
}

const CCD_DASHBOARD_THEMES = [
  ['midnight-blue','Midnight Blue','#080d1a','#111c33','#2563eb','#f8fafc','#9fb2d1'],
  ['obsidian-cyan','Obsidian Cyan','#090f12','#142329','#06b6d4','#f1fcff','#9ab6bf'],
  ['slate-indigo','Slate Indigo','#111827','#1f2937','#6366f1','#f8fafc','#cbd5e1'],
  ['graphite-blue','Graphite Blue','#101820','#1c2b3a','#3b82f6','#f4f8ff','#a9bbd0'],
  ['navy-ice','Navy Ice','#0b1730','#152b4d','#60a5fa','#f3f8ff','#b7c9e6'],
  ['carbon-electric','Carbon Electric','#0a0a0b','#1b1b20','#38bdf8','#ffffff','#a1a1aa'],
  ['royal-night','Royal Night','#15102b','#261b46','#8b5cf6','#fbfaff','#c4b5fd'],
  ['ocean-dark','Ocean Dark','#06202b','#0b3542','#14b8a6','#f0fdfa','#99c8c7'],
  ['deep-space','Deep Space','#080b20','#151a3a','#818cf8','#f5f5ff','#b8bce8'],
  ['steel-blue','Steel Blue','#17212b','#263746','#0ea5e9','#f4f9fc','#b0c1cf'],
  ['arctic-light','Arctic Light','#eaf3f9','#ffffff','#1677c8','#102a43','#57738a'],
  ['cloud-blue','Cloud Blue','#f1f6fc','#ffffff','#2563eb','#14243a','#637b99'],
  ['pearl-indigo','Pearl Indigo','#f5f3ff','#ffffff','#5b4bdb','#211b3b','#77708f'],
  ['frost-cyan','Frost Cyan','#effbfc','#ffffff','#0891b2','#12313a','#5e7d84'],
  ['minimal-slate','Minimal Slate','#f1f3f5','#ffffff','#475569','#17202a','#697586'],
  ['white-blue','White Blue','#f7faff','#ffffff','#1d4ed8','#14213d','#64748b'],
  ['soft-lavender','Soft Lavender','#f7f3ff','#ffffff','#7c3aed','#24143d','#7b6b91'],
  ['emerald-night','Emerald Night','#071b16','#102c23','#10b981','#effff8','#9dcbb7'],
  ['teal-studio','Teal Studio','#eaf7f5','#ffffff','#0f766e','#123b39','#5d817d'],
  ['mono-pro','Mono Pro','#151515','#242424','#e5e7eb','#ffffff','#b6b6b6']
];
function ensureDashboardThemeEditor(slug) {
  const modal=$('edit-content-modal'); if(!modal || $('ccd-theme-editor')) return;
  const section=document.createElement('section'); section.id='ccd-theme-editor';
  section.style.cssText='margin:18px 0;padding:16px;border:1px solid #cbd5e1;border-radius:12px;background:#f8fafc;color:#0f172a';
  section.innerHTML=`<h3 style="margin:0 0 6px">Shopkeeper dashboard colour theme</h3><p style="margin:0 0 12px;color:#64748b;font-size:13px">Choose one of 20 coordinated palettes. This changes the merchant dashboard navbar, background, cards, text and accent colours.</p><label for="ccd-dashboard-theme">Theme</label><select id="ccd-dashboard-theme" style="width:100%;padding:10px;border:1px solid #cbd5e1;border-radius:8px;margin:6px 0 10px">${CCD_DASHBOARD_THEMES.map(t=>`<option value="${t[0]}">${t[1]}</option>`).join('')}</select><div id="ccd-theme-preview" style="height:54px;border-radius:10px;border:1px solid #cbd5e1;margin-bottom:10px"></div><label for="ccd-theme-pin">Admin security PIN</label><input id="ccd-theme-pin" type="password" autocomplete="off" placeholder="Enter ADMIN_SECURITY_PIN" style="width:100%;padding:10px;border:1px solid #cbd5e1;border-radius:8px;margin:6px 0 10px"><button id="ccd-theme-save" type="button" class="btn btn-primary">Save dashboard theme</button><p id="ccd-theme-status" class="muted" aria-live="polite"></p><hr style="margin:16px 0;border:0;border-top:1px solid #cbd5e1"><h3 style="margin:0 0 8px">Shop service permissions</h3><label style="display:flex;gap:9px;align-items:center;margin:8px 0"><input type="checkbox" id="ccd-service-phase1"> Phase 1 — Customer Connect, visits and follow-ups</label><label style="display:flex;gap:9px;align-items:center;margin:8px 0"><input type="checkbox" id="ccd-service-phase2"> Phase 2 — Shop Website and Pricing (enabled/disabled together)</label><button id="ccd-services-save" type="button" class="btn btn-quiet">Save service permissions</button><p id="ccd-services-status" class="muted" aria-live="polite"></p><hr style="margin:16px 0;border:0;border-top:1px solid #cbd5e1"><h3 style="margin:0 0 8px">Shopkeeper access PIN</h3><label for="ccd-merchant-pin">Set a new 6–12 digit merchant PIN</label><input id="ccd-merchant-pin" type="password" inputmode="numeric" maxlength="12" autocomplete="new-password" placeholder="6 to 12 digits" style="width:100%;padding:10px;border:1px solid #cbd5e1;border-radius:8px;margin:6px 0 10px"><button id="ccd-merchant-pin-save" type="button" class="btn btn-quiet">Save merchant PIN</button><p id="ccd-merchant-pin-status" class="muted" aria-live="polite"></p>`;
  const saveBtn=modal.querySelector('button[onclick="saveStoreContentChanges()"]');
  if(saveBtn) saveBtn.parentNode.insertBefore(section,saveBtn); else modal.querySelector('.modal-card')?.appendChild(section);
  const select=$('ccd-dashboard-theme'), preview=$('ccd-theme-preview');
  const paint=()=>{const t=CCD_DASHBOARD_THEMES.find(x=>x[0]===select.value)||CCD_DASHBOARD_THEMES[0];preview.style.background=`linear-gradient(90deg,${t[2]} 0 25%,${t[3]} 25% 50%,${t[4]} 50% 75%,${t[5]} 75% 100%)`;};
  select.addEventListener('change',paint); paint();
  const currentStore=allStoresCache.find(x=>x.shopId===slug);
  if($('ccd-service-phase1')) $('ccd-service-phase1').checked=!!(currentStore&&currentStore.services&&currentStore.services.customerConnectEnabled);
  if($('ccd-service-phase2')) $('ccd-service-phase2').checked=!!(currentStore&&currentStore.services&&currentStore.services.websitePricingEnabled);
  $('ccd-merchant-pin-save').addEventListener('click',async()=>{const b=$('ccd-merchant-pin-save');b.disabled=true;b.textContent='Saving…';try{const r=await apiCall({action:'setMerchantAccessPin',shopId:slug,merchantPin:$('ccd-merchant-pin').value,securityPin:$('ccd-theme-pin').value});if(r.status!=='success')throw new Error(r.message||'Merchant PIN was not saved.');$('ccd-merchant-pin-status').textContent=r.message;$('ccd-merchant-pin').value='';}catch(e){$('ccd-merchant-pin-status').textContent=e.message;}finally{b.disabled=false;b.textContent='Save merchant PIN';}});
  $('ccd-services-save').addEventListener('click',async()=>{const b=$('ccd-services-save');b.disabled=true;b.textContent='Saving…';try{const r=await apiCall({action:'setShopServices',shopId:slug,customerConnectEnabled:$('ccd-service-phase1').checked,websitePricingEnabled:$('ccd-service-phase2').checked,securityPin:$('ccd-theme-pin').value});if(r.status!=='success')throw new Error(r.message||'Service permissions were not saved.');if(currentStore)currentStore.services={customerConnectEnabled:$('ccd-service-phase1').checked,websitePricingEnabled:$('ccd-service-phase2').checked,configured:true};$('ccd-services-status').textContent='Saved. Changes are enforced by the backend immediately.';loadDashboardData();}catch(e){$('ccd-services-status').textContent=e.message;}finally{b.disabled=false;b.textContent='Save service permissions';}});
  $('ccd-theme-save').addEventListener('click',async()=>{const btn=$('ccd-theme-save');btn.disabled=true;btn.textContent='Saving…';try{const r=await apiCall({action:'setShopDashboardTheme',shopId:slug,themeId:select.value,securityPin:$('ccd-theme-pin').value});if(r.status!=='success')throw new Error(r.message||'Theme was not saved.');$('ccd-theme-status').textContent='Saved. The shopkeeper dashboard will use this theme after refresh.';const store=allStoresCache.find(x=>x.shopId===slug);if(store)store.dashboardTheme=select.value;}catch(e){$('ccd-theme-status').textContent=e.message;}finally{btn.disabled=false;btn.textContent='Save dashboard theme';}});
}
function requestEnableWebsiteAndView(slug,name){pendingDeleteSlug=slug;pendingLifecycleOperation='ENABLE_WEBSITE_VIEW';lastFocus=document.activeElement;$('modal-title').textContent=`Enable Phase 2 and view ${name || slug}?`;$('modal-desc').innerHTML=`Phase 2 enables the public shop website and pricing together. The change is saved for this shop and can be disabled later.<br><br><label for="lifecycle-security-pin">Admin security PIN</label><input id="lifecycle-security-pin" type="password" autocomplete="off" style="display:block;width:100%;padding:11px;margin-top:7px;border:1px solid #cbd5e1;border-radius:8px" placeholder="Enter ADMIN_SECURITY_PIN">`;$('btn-modal-confirm').textContent='Enable and view website';$('confirm-modal').classList.add('active');$('btn-modal-cancel').focus();}
function requestLifecycle(slug, operation, name) {
  pendingDeleteSlug=slug; pendingLifecycleOperation=operation; lastFocus=document.activeElement;
  const labels={SUSPEND:'Suspend',ARCHIVE:'Archive / delete',RESTORE:'Restore'};
  $('modal-title').textContent=`${labels[operation]} shop: ${name}?`;
  $('modal-desc').innerHTML=`This action preserves the shop record and customer history. You can restore it later.<br><br><label for="lifecycle-security-pin">Admin security PIN</label><input id="lifecycle-security-pin" type="password" autocomplete="off" style="display:block;width:100%;padding:11px;margin-top:7px;border:1px solid #cbd5e1;border-radius:8px" placeholder="Enter ADMIN_SECURITY_PIN">`;
  $('btn-modal-confirm').textContent=labels[operation]; $('confirm-modal').classList.add('active'); $('btn-modal-cancel').focus();
}

async function openStoreContentEditor(slug) {
  ensureHomeContentField();
  ensureContentVisibilityControls();
  ensureAdminMediaEditor();
  ensureStoreExperienceStudio();
  $('ccd-media-rows').innerHTML='';
  ensureGlobalPolicyEditor();
  $('ccd-theme-editor')?.remove();
  $('edit-store-slug').value = slug;
  $('edit-modal-title').textContent = `Editing Content: ${slug}`;
  $('edit-services-list').innerHTML = '';
  $('edit-pricing-list').innerHTML = '';
  try {
    const data = await apiCall({ action: 'getStoreContentAdmin', slug, shopId: slug });
    if (data.status !== 'success' || !data.store) throw new Error(data.message || 'Store content could not be loaded.');
    const store = data.store, content = data.content || {}, visibility = data.visibility || {};
    ensureDashboardThemeEditor(slug);
    if ($('ccd-dashboard-theme')) $('ccd-dashboard-theme').value = (allStoresCache.find(x=>x.shopId===slug)?.dashboardTheme || store.dashboardTheme || 'midnight-blue');
    if ($('ccd-theme-preview')) $('ccd-dashboard-theme').dispatchEvent(new Event('change'));
    if ($('ccd-theme-pin')) $('ccd-theme-pin').value = '';
    if ($('ccd-theme-status')) $('ccd-theme-status').textContent = '';
    if ($('ccd-merchant-pin')) $('ccd-merchant-pin').value='';if ($('ccd-merchant-pin-status')) $('ccd-merchant-pin-status').textContent='';
    $('edit-store-tagline').value = content.tagline || store.tagline || '';
    if ($('edit-store-layout')) $('edit-store-layout').value = content.layoutStyle || content.categoryKey || 'general';
    initAdminExperienceFields(content);
    $('edit-store-address').value = content.address || '';
    if ($('edit-store-home')) $('edit-store-home').value = content.homeText || '';
    if ($('edit-store-redirect-url')) $('edit-store-redirect-url').value = store.redirectUrl || '';
    if ($('edit-store-owner-mobile')) $('edit-store-owner-mobile').value = store.ownerMobile || '';
    if ($('edit-store-review-url')) $('edit-store-review-url').value = store.reviewUrl || '';
    if ($('edit-store-map-url')) $('edit-store-map-url').value = store.mapEmbedUrl || '';
    $('edit-store-banners').value = (content.banners || []).join('\n');
    $('edit-store-about').value = content.aboutText || '';
    (content.media || []).forEach(item => addAdminMediaRow(item));
    (content.services || []).forEach(item => addServiceRow(item.icon, item.title, item.desc));
    (content.pricing || []).forEach(item => addPricingRow(item.item, item.price, item.desc));
    const defaults = { homeText: !!content.homeText, aboutText: !!content.aboutText, services: !!(content.services || []).length, pricing: !!(content.pricing || []).length, contact: true };
    Object.keys(defaults).forEach(key => { const checkbox = $(`ccd-publish-${key}`); if (checkbox) checkbox.checked = visibility[key] === undefined ? defaults[key] : visibility[key] === true; });
    $('edit-content-modal').hidden = false;
  } catch (err) {
    showDbToast(err.message || 'Unable to load store content.', true);
  }
}
function addServiceRow(icon = "🔑", title = "", desc = "") {
  const div = document.createElement("div");
  div.className = "service-edit-row";
  div.style.cssText = "display:flex; gap:8px; margin-bottom:8px;";
  div.innerHTML = `
    <input type="text" class="form-input s-icon" value="${esc(icon)}" style="width:50px;" />
    <input type="text" class="form-input s-title" value="${esc(title)}" placeholder="Title" style="flex:1;" />
    <input type="text" class="form-input s-desc" value="${esc(desc)}" placeholder="Description" style="flex:2;" />
    <button type="button" onclick="this.parentElement.remove()" style="background:#ef4444; border:none; color:#fff; border-radius:6px; padding:0 8px; cursor:pointer;">&times;</button>
  `;
  $("edit-services-list").appendChild(div);
}

function addPricingRow(item = "", price = "₹", desc = "") {
  const div = document.createElement("div");
  div.className = "pricing-edit-row";
  div.style.cssText = "display:flex; gap:8px; margin-bottom:8px;";
  div.innerHTML = `
    <input type="text" class="form-input p-item" value="${esc(item)}" placeholder="Item Name" style="flex:2;" />
    <input type="text" class="form-input p-price" value="${esc(price)}" placeholder="Price" style="width:80px;" />
    <input type="text" class="form-input p-desc" value="${esc(desc)}" placeholder="Brief detail" style="flex:2;" />
    <button type="button" onclick="this.parentElement.remove()" style="background:#ef4444; border:none; color:#fff; border-radius:6px; padding:0 8px; cursor:pointer;">&times;</button>
  `;
  $("edit-pricing-list").appendChild(div);
}

async function saveStoreContentChanges() {
  const slug = $("edit-store-slug").value;
  const banners = $("edit-store-banners").value.split("\n").map(s => s.trim()).filter(Boolean);
  const services = Array.from(document.querySelectorAll(".service-edit-row")).map(row => ({
    icon: row.querySelector(".s-icon").value.trim(),
    title: row.querySelector(".s-title").value.trim(),
    desc: row.querySelector(".s-desc").value.trim()
  })).filter(s => s.title);
  const pricing = Array.from(document.querySelectorAll(".pricing-edit-row")).map(row => ({
    item: row.querySelector(".p-item").value.trim(),
    price: row.querySelector(".p-price").value.trim(),
    desc: row.querySelector(".p-desc").value.trim()
  })).filter(p => p.item);
  const payload = {
    action: "updateStoreContent", slug,
    tagline: $("edit-store-tagline").value.trim(),
    layoutStyle: $("ccd-business-category") ? $("ccd-business-category").value : ($("edit-store-layout") ? $("edit-store-layout").value : 'general'),
    categoryKey: $("ccd-business-category") ? $("ccd-business-category").value : 'general',
    experienceMode: $("ccd-experience-mode") ? $("ccd-experience-mode").value : 'WEBSITE_COMMUNICATION',
    navigation: readAdminNavigationRows(),
    address: $("edit-store-address").value.trim(),
    homeText: $("edit-store-home") ? $("edit-store-home").value.trim() : "",
    aboutText: $("edit-store-about").value.trim(),
    redirectUrl: $("edit-store-redirect-url") ? $("edit-store-redirect-url").value.trim() : "",
    ownerMobile: $("edit-store-owner-mobile") ? $("edit-store-owner-mobile").value.trim() : "",
    reviewUrl: $("edit-store-review-url") ? $("edit-store-review-url").value.trim() : "",
    mapEmbedUrl: $("edit-store-map-url") ? $("edit-store-map-url").value.trim() : "",
    banners, services, pricing, media: readAdminMediaRows(),
    visibility: {
      homeText: !!$("ccd-publish-homeText")?.checked,
      aboutText: !!$("ccd-publish-aboutText")?.checked,
      services: !!$("ccd-publish-services")?.checked,
      pricing: !!$("ccd-publish-pricing")?.checked,
      contact: !!$("ccd-publish-contact")?.checked
    }
  };
  try {
    const result = await apiCall(payload);
    if (result.status !== "success") throw new Error(result.message || "Store content was not saved.");
    const mode = payload.experienceMode;
    const phase1 = mode !== 'MENU_ONLY';
    const phase2 = mode !== 'COMMUNICATION_ONLY';
    const securityPin = $('ccd-theme-pin') ? $('ccd-theme-pin').value.trim() : '';
    const serviceResult = await apiCall({action:'setShopServices',shopId:slug,customerConnectEnabled:phase1,websitePricingEnabled:phase2,securityPin});
    if (serviceResult.status !== 'success') throw new Error('Content saved, but activation mode was not applied: ' + (serviceResult.message || 'Admin security PIN is required.'));
    showDbToast("Store experience, navigation and activation mode saved.");
    closeEditContentModal();
  } catch (err) {
    showDbToast(err.message || "Unable to save store content.", true);
  }
}

function closeEditContentModal() { $("edit-content-modal").hidden = true; }

function showDbToast(msg, isError = false) {
  const toast = $("db-toast");
  if (!toast) return;
  toast.classList.toggle("is-error", isError);
  toast.innerHTML = `<span class="toast-icon">${ico(isError ? "alert" : "check")}</span><span class="toast-msg"></span>`;
  toast.querySelector(".toast-msg").textContent = msg;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 4200);
}

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", theme === "dark" ? "#000000" : "#ffffff");
  if ($("theme-icon")) $("theme-icon").textContent = theme === "dark" ? "Light" : "Dark";
}

const themeBtn = $("theme-toggle-btn");
if (themeBtn) themeBtn.addEventListener("click", () => {
  const currentTheme = document.documentElement.getAttribute("data-theme") || "light";
  const newTheme = currentTheme === "dark" ? "light" : "dark";
  localStorage.setItem("ccd_theme", newTheme);
  applyTheme(newTheme);
});
(function initTheme() { applyTheme(localStorage.getItem("ccd_theme") || "light"); })();

document.querySelectorAll(".nav-item").forEach(btn => btn.addEventListener("click", () => {
  document.querySelectorAll(".nav-item").forEach(b => b.classList.remove("active"));
  document.querySelectorAll(".tab-pane").forEach(p => p.classList.remove("active"));
  btn.classList.add("active");
  const target = btn.getAttribute("data-tab");
  if ($(target)) $(target).classList.add("active");
  if(target==='tab-price-history') loadPriceHistory();
  window.scrollTo({ top: 0 });
}));
$('price-history-refresh')?.addEventListener('click',loadPriceHistory);
$('price-history-shop')?.addEventListener('change',loadPriceHistory);


if ($("btn-top-add")) $("btn-top-add").addEventListener("click", () => {
  const tab = document.querySelector('[data-tab="tab-wizard"]');
  if (tab) tab.click();
});

function setAccountMenu(open) {
  const menu = $("account-menu"), btn = $("btn-account");
  if (!menu || !btn) return;
  menu.hidden = !open;
  btn.setAttribute("aria-expanded", String(open));
}
if ($("btn-account")) $("btn-account").addEventListener("click", e => {
  e.stopPropagation();
  setAccountMenu($("account-menu").hidden);
});
document.addEventListener("click", e => { if (!e.target.closest(".account")) setAccountMenu(false); });

function flagInvalid(id, msg) {
  showDbToast(msg, true);
  const el = $(id);
  if (el) { el.classList.add("is-invalid"); el.setAttribute("aria-invalid", "true"); el.focus(); }
}

document.querySelectorAll("#wizard-form input").forEach(inp => inp.addEventListener("input", () => {
  inp.classList.remove("is-invalid");
  inp.removeAttribute("aria-invalid");
}));

window.goToStep = function(targetStep) {
  const activeSec = document.querySelector(".wizard-section.active");
  const currentStepId = activeSec ? activeSec.id : "wizard-sec-1";
  if (currentStepId === "wizard-sec-1" && targetStep > 1) {
    const slug = $("shop-id").value.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
    const shopName = $("shop-name").value.trim();
    const tagline = $("shop-tagline").value.trim();
    if (!slug || slug.length < 3) return flagInvalid("shop-id", "Store slug must be at least 3 letters/numbers");
    if (!shopName) return flagInvalid("shop-name", "Store display name is required");
    if (!tagline) return flagInvalid("shop-tagline", "Business tagline is required");
  }
  if (currentStepId === "wizard-sec-2" && targetStep > 2) {
    const ownerName = $("owner-name").value.trim();
    const email = $("owner-email").value.trim().toLowerCase();
    const mobile = $("shop-mobile").value.trim().replace(/\D/g, "");
    if (!ownerName) return flagInvalid("owner-name", "Owner full name is required");
    if (!email || !email.includes("@")) return flagInvalid("owner-email", "Valid owner email address is required");
    if (mobile.length !== 10) return flagInvalid("shop-mobile", "Valid 10-digit mobile number required");
  }
  document.querySelectorAll(".step-item").forEach(item => {
    const num = parseInt(item.getAttribute("data-step"));
    item.classList.toggle("active", num <= targetStep);
    item.classList.toggle("current", num === targetStep);
    if (num === targetStep) item.setAttribute("aria-current", "step");
    else item.removeAttribute("aria-current");
  });
  document.querySelectorAll(".wizard-section").forEach(sec => sec.classList.remove("active"));
  const nextSec = $(`wizard-sec-${targetStep}`);
  if (nextSec) nextSec.classList.add("active");
  if ($("wizard-heading")) $("wizard-heading").scrollIntoView({ block: "start", behavior: "smooth" });
};

function handleWizardEnterKey() {
  const wizardForm = $("wizard-form");
  if (!wizardForm) return;
  wizardForm.querySelectorAll("input").forEach(input => input.addEventListener("keydown", e => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const activeSec = document.querySelector(".wizard-section.active");
    if (!activeSec) return;
    if (activeSec.id === "wizard-sec-1") goToStep(2);
    else if (activeSec.id === "wizard-sec-2") goToStep(3);
    else if (activeSec.id === "wizard-sec-3") $("btn-save-store").click();
  }));
}

if ($("btn-toggle-eye")) $("btn-toggle-eye").addEventListener("click", () => {
  const input = $("admin-pass");
  const show = input.type === "password";
  input.type = show ? "text" : "password";
  $("btn-toggle-eye").setAttribute("aria-pressed", String(show));
  $("btn-toggle-eye").setAttribute("aria-label", show ? "Hide password" : "Show password");
});

function parseJwt(token) {
  try {
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(decodeURIComponent(atob(base64).split("").map(c => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2)).join("")));
  } catch (e) { return null; }
}

async function apiCall(body) {
  const payload = Object.assign({}, body);
  if (payload.action !== "adminAuth" && currentUser.sessionToken) payload.adminToken = currentUser.sessionToken;
  const formPayload = new URLSearchParams();
  formPayload.append("postData", JSON.stringify(payload));
  const res = await fetch(SCRIPT_URL, { method: "POST", body: formPayload, redirect: "follow" });
  const responseText = await res.text();
  try { return JSON.parse(responseText); }
  catch (err) { throw new Error("Invalid server response: " + responseText.slice(0, 100)); }
}

function setAuthLoading(on) {
  const card = document.querySelector(".auth-gate-card");
  if (card) card.classList.toggle("is-loading", on);
  if ($("auth-status")) $("auth-status").hidden = !on;
}

window.handleAdminLogin = async function(response) {
  const payload = parseJwt(response.credential);
  if (!payload || !payload.email || !response.credential) return;
  const enteredPass = $("admin-pass") ? $("admin-pass").value.trim() : "";
  setAuthLoading(true);
  try {
    const authData = await apiCall({ action: "adminAuth", idToken: response.credential, email: payload.email, password: enteredPass });
    if (authData.status !== "success" || !authData.sessionToken) {
      showDbToast(authData.message || "Access denied.", true);
      return;
    }
    currentUser.name = payload.name || "Super Admin";
    currentUser.email = payload.email.toLowerCase();
    currentUser.sessionToken = authData.sessionToken;
    if ($("user-name")) $("user-name").textContent = currentUser.name;
    if ($("user-email")) $("user-email").textContent = currentUser.email;
    $("auth-gate-overlay").classList.add("hidden");
    showDbToast(`Authenticated as Super-Admin: ${currentUser.email}`);
    loadDashboardData();
    initMessageCentre();
    loadMessageTemplates().catch(err => { if ($("msg-action-status")) $("msg-action-status").textContent = err.message; });
  } catch (err) {
    showDbToast("Authentication failed: " + err.message, true);
  } finally { setAuthLoading(false); }
};

function setSyncState(ok) {
  const v = $("stat-sync-state"), t = $("stat-sync-time");
  if (v) { v.textContent = ok ? "Connected" : "Unreachable"; v.classList.toggle("is-error", !ok); }
  if (t) t.textContent = ok ? "Last synced " + new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "Last attempt failed. Try refreshing.";
}

async function loadDashboardData() {
  const refreshBtn = $("btn-refresh-overview");
  if (refreshBtn) { refreshBtn.classList.add("is-loading"); refreshBtn.disabled = true; }
  if (!allStoresCache.length && $("store-table-body")) $("store-table-body").innerHTML = `<tr><td colspan="5" class="table-loading"><span class="spinner"></span> Loading store registry…</td></tr>`;
  try {
    const data = await apiCall({ action: "getAdminData", email: currentUser.email });
    if (data.status !== "success") throw new Error(data.message || "Could not load store data.");
    allStoresCache = data.allStores || [];
    allRegistrationRequestsCache = data.registrationRequests || [];
    renderDashboard(allStoresCache);
    fillMessageShopSelect();
    fillPriceHistoryShopSelect();
    renderRegistrationRequests(allRegistrationRequestsCache);
    setSyncState(true);
  } catch (err) {
    setSyncState(false);
    if ($("store-table-body")) $("store-table-body").innerHTML = `<tr><td colspan="5" class="table-empty is-error"><strong>Couldn't load stores</strong>Check your connection, then refresh.</td></tr>`;
    showDbToast(err.message || "Error retrieving Master-Sheet data.", true);
  } finally {
    if (refreshBtn) { refreshBtn.classList.remove("is-loading"); refreshBtn.disabled = false; }
  }
}


// Persistent message centre. Template edits require the separately configured ADMIN_SECURITY_PIN.
let messageTemplatesCache=[];
function messageVarsForShop(shop){return {ownerName:shop.ownerName||'Shop owner',shopName:shop.shopName||shop.shopId,shopId:shop.shopId,ownerEmail:shop.ownerEmail||'',ownerMobile:shop.ownerMobile||'',deskUrl:`https://${shop.shopId}.ccd.dev/nfc`,shopUrl:`https://${shop.shopId}.ccd.dev/`,merchantUrl:`https://${shop.shopId}.ccd.dev/merchant`,registrationStatus:shop.registrationStatus||'PENDING'};}
function fillMessageShopSelect(){const sel=$('msg-shop-select');if(!sel)return;const old=sel.value;sel.innerHTML='<option value="">Select a shop</option>';allStoresCache.forEach(s=>{const o=document.createElement('option');o.value=s.shopId;o.textContent=`${s.shopName} (${s.shopId})`;sel.appendChild(o)});if(old)sel.value=old;}
function getSelectedMessageTemplate(){const channel=$('msg-channel').value,key=$('msg-template-key').value.trim();return messageTemplatesCache.find(t=>t.channel===channel&&t.templateKey===key);}
async function loadMessageTemplates(){const r=await apiCall({action:'getMessageTemplates'});if(r.status!=='success')throw new Error(r.message||'Could not load templates');messageTemplatesCache=r.templates||[];const t=getSelectedMessageTemplate();if(t){$('msg-subject').value=t.subject||'';$('msg-body').value=t.body||'';}fillMessageShopSelect();}
async function loadCommunicationLog(){const slug=$('msg-shop-select').value;if(!slug)return;const r=await apiCall({action:'getCommunicationStatus',shopId:slug});if(r.status!=='success')throw new Error(r.message||'Could not load message status');const body=$('msg-log-body');body.innerHTML='';(r.communications||[]).forEach(c=>{const tr=document.createElement('tr');const date=c.sentAt||c.queuedAt;tr.innerHTML=`<td>${esc(c.channel)}</td><td>${esc(c.recipient)}</td><td>${esc(c.templateKey)}</td><td><strong>${esc(c.status)}</strong></td><td>${date?esc(new Date(date).toLocaleString()):'—'}</td>`;body.appendChild(tr)});if(!body.children.length)body.innerHTML='<tr><td colspan="5">No messages recorded for this shop.</td></tr>';const latestEmail=(r.communications||[]).find(c=>c.channel==='EMAIL'&&c.type==='ADMIN_OWNER_MESSAGE');const sendBtn=$('msg-send-email');if(sendBtn){sendBtn.textContent=latestEmail&&latestEmail.status==='SENT'?'Sent':'Send email';sendBtn.dataset.lastStatus=latestEmail?latestEmail.status:'NONE';}}
function initMessageCentre(){
 if(!$('msg-save-template'))return;
 $('msg-channel').addEventListener('change',()=>{const t=getSelectedMessageTemplate();$('msg-subject').value=t?.subject||'';$('msg-body').value=t?.body||'';});
 $('msg-template-key').addEventListener('change',()=>{const t=getSelectedMessageTemplate();$('msg-subject').value=t?.subject||'';$('msg-body').value=t?.body||'';});
 $('msg-shop-select').addEventListener('change',()=>loadCommunicationLog().catch(e=>$('msg-action-status').textContent=e.message));
 $('msg-refresh-log').addEventListener('click',()=>loadCommunicationLog().catch(e=>$('msg-action-status').textContent=e.message));
 $('msg-save-template').addEventListener('click',async()=>{try{const r=await apiCall({action:'saveMessageTemplate',templateKey:$('msg-template-key').value.trim(),channel:$('msg-channel').value,subject:$('msg-subject').value,body:$('msg-body').value,securityPin:$('msg-security-pin').value});if(r.status!=='success')throw new Error(r.message);$('msg-action-status').textContent='Template saved. Future sends use this saved version.';await loadMessageTemplates();}catch(e){$('msg-action-status').textContent=e.message;}});
 $('msg-send-email').addEventListener('click',async e=>{
  const btn=e.currentTarget,slug=$('msg-shop-select').value,key=$('msg-template-key').value.trim();
  if(!slug)return $('msg-action-status').textContent='Select a shop first.';
  if(key!=='OWNER_STATUS'||$('msg-channel').value!=='EMAIL')return $('msg-action-status').textContent='Choose OWNER_STATUS and Email to send an owner email. Customer and public shop templates apply automatically.';
  btn.disabled=true;btn.textContent='Saving & sending…';
  try{const saved=await apiCall({action:'saveMessageTemplate',templateKey:key,channel:'EMAIL',subject:$('msg-subject').value,body:$('msg-body').value,securityPin:$('msg-security-pin').value});if(saved.status!=='success')throw new Error(saved.message||'Template could not be saved.');const r=await apiCall({action:'sendOwnerEmail',shopId:slug,templateKey:key,securityPin:$('msg-security-pin').value});if(r.status!=='success')throw new Error(r.message);btn.textContent='Sent';$('msg-action-status').textContent='SENT: Apps Script accepted the send request; inbox delivery is not confirmed.';await loadCommunicationLog();}
  catch(err){btn.textContent='Send email';$('msg-action-status').textContent='Not sent: '+err.message;await loadCommunicationLog().catch(()=>{});}
  finally{btn.disabled=false;}
 });
 $('msg-open-whatsapp').addEventListener('click',async()=>{
  const shop=allStoresCache.find(s=>s.shopId===$('msg-shop-select').value),key=$('msg-template-key').value.trim();
  if(!shop)return $('msg-action-status').textContent='Select a shop first.';
  if(key!=='OWNER_STATUS'||$('msg-channel').value!=='WHATSAPP')return $('msg-action-status').textContent='Choose OWNER_STATUS and WhatsApp to prepare an owner message. Customer and public shop templates apply automatically.';
  const mobile=String(shop.ownerMobile||'').replace(/\D/g,'');if(mobile.length<10)return $('msg-action-status').textContent='Shop owner mobile number is invalid.';
  const popup=window.open('about:blank','_blank');if(!popup)return $('msg-action-status').textContent='Allow pop-ups to open the WhatsApp draft.';
  try{
   const bodyText=$('msg-body').value;const saved=await apiCall({action:'saveMessageTemplate',templateKey:key,channel:'WHATSAPP',subject:'',body:bodyText,securityPin:$('msg-security-pin').value});if(saved.status!=='success')throw new Error(saved.message||'Template could not be saved.');
   const vars=messageVarsForShop(shop),body=bodyText.replace(/\{\{([a-zA-Z0-9_]+)\}\}/g,(_,k)=>vars[k]||'');
   const r=await apiCall({action:'logWhatsAppDraft',shopId:shop.shopId,templateKey:key,securityPin:$('msg-security-pin').value});if(r.status!=='success')throw new Error(r.message);
   popup.location.href=`https://wa.me/${mobile.length===10?'91'+mobile:mobile}?text=${encodeURIComponent(body)}`;$('msg-action-status').textContent='WhatsApp draft prepared. Review it and press Send in WhatsApp; it is not marked as sent.';await loadCommunicationLog();
  }catch(err){popup.close();$('msg-action-status').textContent=err.message;await loadCommunicationLog().catch(()=>{});}
 });
}

function fillPriceHistoryShopSelect(){const sel=$('price-history-shop');if(!sel)return;const old=sel.value;sel.innerHTML='<option value="">All shops</option>';allStoresCache.forEach(s=>{const o=document.createElement('option');o.value=s.shopId;o.textContent=`${s.shopName} (${s.shopId})`;sel.appendChild(o)});if(old)sel.value=old;}
async function loadPriceHistory(){const body=$('price-history-body');if(!body)return;body.innerHTML='<tr><td colspan="7">Loading price history…</td></tr>';try{const r=await apiCall({action:'getPriceHistory',shopId:$('price-history-shop')?.value||''});if(r.status!=='success')throw new Error(r.message||'Could not load price history.');const rows=r.history||[];body.innerHTML=rows.length?rows.map(x=>`<tr><td>${esc(x.shopName)}<small style="display:block;color:#64748b">${esc(x.shopId)}</small></td><td>${esc(x.itemName)}</td><td>${esc(x.oldPrice==null?'—':x.currency+' '+x.oldPrice)}</td><td><strong>${esc(x.newPrice==null?'—':x.currency+' '+x.newPrice)}</strong></td><td>${x.changedAt?esc(new Date(x.changedAt).toLocaleString()):'—'}</td><td>${esc(x.changedBy)}<small style="display:block;color:#64748b">${esc(x.role)}</small></td><td>${esc(x.source)}</td></tr>`).join(''):'<tr><td colspan="7">No price changes recorded.</td></tr>';}catch(e){body.innerHTML=`<tr><td colspan="7">${esc(e.message)}</td></tr>`;}}

function renderRegistrationRequests(requests){
 const body=$('registration-request-body');if(!body)return;const rows=Array.isArray(requests)?requests:[];
 if($('badge-registration-requests'))$('badge-registration-requests').textContent=String(rows.length);
 if(!rows.length){body.innerHTML='<tr><td colspan="7">No pending registration requests.</td></tr>';return;}
 const modeOptions=[['WEBSITE_COMMUNICATION','Website + communication'],['COMMUNICATION_ONLY','Communication only'],['MENU_ONLY','Menu / catalogue only']];
 body.innerHTML=rows.map(r=>`<tr>
  <td><strong>${esc(r.shopName)}</strong><small style="display:block;color:#64748b">Requested ID: ${esc(r.shopId)}</small></td>
  <td>${esc(r.ownerName)}<small style="display:block;color:#64748b">${esc(r.ownerMobile)} · ${esc(r.ownerEmail)}</small></td>
  <td>${esc(r.conflictFlags||'No detected conflicts')}</td>
  <td><input data-approved-slug="${esc(r.requestId)}" value="${esc(r.shopId)}" maxlength="40" aria-label="Approved shop ID"></td>
  <td><select data-approved-mode="${esc(r.requestId)}" aria-label="Initial experience">${modeOptions.map(([v,l])=>`<option value="${v}">${l}</option>`).join('')}</select></td>
  <td><select data-approved-category="${esc(r.requestId)}" aria-label="Business category">${Object.entries(CCD_CATEGORY_LABELS).map(([v,l])=>`<option value="${v}">${esc(l)}</option>`).join('')}</select></td>
  <td><button class="btn-table success" data-reg-action="APPROVED" data-request-id="${esc(r.requestId)}">Approve</button> <button class="btn-table danger" data-reg-action="REJECTED" data-request-id="${esc(r.requestId)}">Reject</button></td>
 </tr>`).join('');
}
if($('registration-request-body'))$('registration-request-body').addEventListener('click',async e=>{
 const b=e.target.closest('button[data-reg-action]');if(!b)return;const id=b.dataset.requestId,decision=b.dataset.regAction;
 const findByRequest=(attr)=>Array.from(document.querySelectorAll(`[${attr}]`)).find(el=>el.getAttribute(attr)===id);
 const field=findByRequest('data-approved-slug'),modeField=findByRequest('data-approved-mode'),categoryField=findByRequest('data-approved-category');
 const approvedShopId=field?field.value.trim():'';b.disabled=true;
 try{
  const selectedMode=modeField?modeField.value:'WEBSITE_COMMUNICATION',selectedCategory=categoryField?categoryField.value:'general';
  const r=await apiCall({action:'setRegistrationRequestStatus',requestId:id,decision,approvedShopId,experienceMode:selectedMode,categoryKey:selectedCategory});
  if(r.status!=='success')throw new Error(r.message||'Request could not be updated.');
  showDbToast(r.message);await loadDashboardData();
  if(decision==='APPROVED'&&approvedShopId)openStudioForStore(approvedShopId);
 } catch(err){showDbToast(err.message,true);}finally{b.disabled=false;}
});

function renderDashboard(stores) {
  if ($("badge-total-stores")) $("badge-total-stores").textContent = stores.length;
  const count = st => stores.filter(s => (s.registrationStatus || "PENDING").toUpperCase() === st).length;
  const activeCount = count("ACTIVE"), pendingCount = count("PENDING"), suspendedCount = count("SUSPENDED");
  if ($("stat-active-stores")) $("stat-active-stores").textContent = activeCount;
  if ($("stat-pending-stores")) $("stat-pending-stores").textContent = pendingCount;
  if ($("stat-suspended-stores")) $("stat-suspended-stores").textContent = suspendedCount;
  if ($("breakdown-total")) $("breakdown-total").textContent = `${stores.length} ${stores.length === 1 ? "store" : "stores"}`;
  const pct = n => stores.length ? (n / stores.length * 100) + "%" : "0%";
  if ($("seg-active")) $("seg-active").style.width = pct(activeCount);
  if ($("seg-pending")) $("seg-pending").style.width = pct(pendingCount);
  if ($("seg-suspended")) $("seg-suspended").style.width = pct(suspendedCount);
  const selector = $("qr-store-selector");
  if (selector) {
    const prev = selector.value;
    selector.innerHTML = `<option value="">-- Choose Store --</option>`;
    stores.filter(s => (s.registrationStatus || "PENDING").toUpperCase() === "ACTIVE").forEach(s => { const opt = document.createElement("option"); opt.value = s.shopId; opt.textContent = `${s.shopName} (${s.shopId})`; selector.appendChild(opt); });
    if (prev && stores.some(s => s.shopId === prev)) selector.value = prev;
  }
  renderTable();
  fillMessageShopSelect();
}

function renderTable() {
  const searchInput = $("global-store-search"), query = searchInput ? searchInput.value.toLowerCase().trim() : "";
  const tbody = $("store-table-body");
  if (!tbody) return;
  const filtered = allStoresCache.filter(s => {
    const status = (s.registrationStatus || "PENDING").toUpperCase();
    if (statusFilter !== "ALL" && status !== statusFilter) return false;
    return !query || (s.shopName || "").toLowerCase().includes(query) || (s.shopId || "").toLowerCase().includes(query) || (s.ownerName || "").toLowerCase().includes(query) || (s.ownerMobile && String(s.ownerMobile).includes(query)) || (s.ownerEmail && s.ownerEmail.toLowerCase().includes(query));
  });
  if ($("store-result-count")) $("store-result-count").textContent = allStoresCache.length ? `${filtered.length} of ${allStoresCache.length}` : "";
  if (!filtered.length) {
    tbody.innerHTML = allStoresCache.length === 0
      ? `<tr><td colspan="5" class="table-empty"><strong>No stores yet</strong>No registered stores found in Master-Sheet.<br/><button class="btn-step-next" data-action="register" style="margin-top:1rem;">${ico("plus")} Register a store</button></td></tr>`
      : `<tr><td colspan="5" class="table-empty"><strong>No matching stores</strong>Try a different search or status filter.</td></tr>`;
    return;
  }
  tbody.innerHTML = "";
  filtered.forEach(s => {
    const tr = document.createElement("tr"), status = (s.registrationStatus || "PENDING").toUpperCase(), statusClass = status.toLowerCase(), id = esc(s.shopId);
    tr.innerHTML = `
      <td class="cell-store"><div class="store-name">${esc(s.shopName)}</div><code class="store-slug">${id}</code></td>
      <td data-label="Owner">${esc(s.ownerName || "Merchant")}<span class="owner-meta">📞 ${esc(s.ownerMobile || "N/A")}</span><span class="owner-meta">✉️ ${esc(s.ownerEmail || "N/A")}</span></td>
      <td data-label="Tagline">${esc(s.tagline || "—")}</td>
      <td class="cell-status"><span class="status-badge ${statusClass}">${esc(status.toLowerCase())}</span></td>
      <td class="cell-actions"><div class="table-action-btns">
        ${status === "PENDING" ? `<button class="btn-table success" data-action="approve" data-id="${id}">Approve</button>` : ""}
        ${status === "ACTIVE" ? `<button class="btn-table" data-action="edit-content" data-id="${id}">Edit website / theme</button><button class="btn-table" data-action="view-site" data-id="${id}" data-name="${esc(s.shopName)}">View Website</button><button class="btn-table warning" data-action="suspend" data-id="${id}" data-name="${esc(s.shopName)}">Suspend</button><button class="btn-table" data-action="qr" data-id="${id}">QR codes</button><button class="btn-table success" data-action="send-setup" data-id="${id}">Send Desk + Shop</button><button class="btn-table" data-action="send-site" data-id="${id}">Share Website</button>` : ""}
        ${status === "SUSPENDED" || status === "ARCHIVED" || status === "CANCELLED" ? `<button class="btn-table success" data-action="restore" data-id="${id}" data-name="${esc(s.shopName)}">Restore</button>` : ""}
        ${status !== "ARCHIVED" && status !== "CANCELLED" ? `<button class="btn-table danger" data-action="delete" data-id="${id}" data-name="${esc(s.shopName)}">Archive</button>` : ""}
      </div></td>`;
    tbody.appendChild(tr);
  });
}

if ($("store-table-body")) $("store-table-body").addEventListener("click", e => {
  const btn = e.target.closest("button[data-action]");
  if (!btn) return;
  const { action, id, name } = btn.dataset;
  if (action === "register") { const regTab = document.querySelector('[data-tab="tab-wizard"]'); if (regTab) regTab.click(); }
  else if (action === "approve") setStatus(id, "ACTIVE");
  else if (action === "suspend") requestLifecycle(id, "SUSPEND", name || id);
  else if (action === "restore") requestLifecycle(id, "RESTORE", name || id);
  else if (action === "view-site") { const st=allStoresCache.find(x=>x.shopId===id); if(st&&st.services&&st.services.websitePricingEnabled) window.open(`https://${id}.ccd.dev/` ,"_blank","noopener"); else requestEnableWebsiteAndView(id,name||id); }
  else if (action === "edit-content") openStoreContentEditor(id);
  else if (action === "qr") openStudioForStore(id);
  else if (action === "send-setup") sendOwnerLinks(id, true);
  else if (action === "send-site") sendOwnerLinks(id, false);
  else if (action === "delete") requestLifecycle(id, "ARCHIVE", name || id);
});

if ($("global-store-search")) $("global-store-search").addEventListener("input", () => {
  if (!$(("tab-stores")).classList.contains("active")) { const tab = document.querySelector('[data-tab="tab-stores"]'); if (tab) tab.click(); }
  renderTable();
  fillMessageShopSelect();
});

document.querySelectorAll(".filter-chips .chip").forEach(chip => chip.addEventListener("click", () => {
  statusFilter = chip.dataset.filter;
  document.querySelectorAll(".filter-chips .chip").forEach(c => c.classList.toggle("active", c === chip));
  renderTable();
  fillMessageShopSelect();
}));

window.setStatus = async function(slug, status) {
  try {
    const res = await apiCall({ action: "setStoreRegistrationStatus", targetShopId: slug, newStatus: status });
    if (res.status !== "success") throw new Error(res.message || "Status update failed.");
    showDbToast(`Status updated: ${slug} is now ${status}`);
    loadDashboardData();
    initMessageCentre();
    loadMessageTemplates().catch(err => { if ($("msg-action-status")) $("msg-action-status").textContent = err.message; });
  } catch (err) { showDbToast(err.message || "Failed to update status", true); }
};

function closeModal() { $("confirm-modal").classList.remove("active"); if (lastFocus) lastFocus.focus(); }
window.confirmDeleteStore = function(slug, name) { requestLifecycle(slug, "ARCHIVE", name || slug); };
if ($("btn-modal-cancel")) $("btn-modal-cancel").addEventListener("click", () => { closeModal(); pendingDeleteSlug = null; });
if ($("confirm-modal")) $("confirm-modal").addEventListener("click", e => { if (e.target === $("confirm-modal")) $("btn-modal-cancel").click(); });
document.addEventListener("keydown", e => {
  if (e.key === "Escape") {
    if ($("confirm-modal") && $("confirm-modal").classList.contains("active")) $("btn-modal-cancel").click();
    setAccountMenu(false);
  }
});
if ($("btn-modal-confirm")) $("btn-modal-confirm").addEventListener("click", async () => {
  if (!pendingDeleteSlug) return;
  const target=pendingDeleteSlug, operation=pendingLifecycleOperation, pin=$('lifecycle-security-pin')?.value||'';
  const btn=$('btn-modal-confirm'); btn.disabled=true;
  try {
    if(operation==='ENABLE_WEBSITE_VIEW'){
      const popup=window.open('about:blank','_blank');const st=allStoresCache.find(x=>x.shopId===target),r=await apiCall({action:'setShopServices',shopId:target,customerConnectEnabled:!!(st&&st.services&&st.services.customerConnectEnabled),websitePricingEnabled:true,securityPin:pin});
      if(r.status!=='success')throw new Error(r.message||'Phase 2 could not be enabled.');if(popup)popup.location.href=`https://${target}.ccd.dev/`;showDbToast('Phase 2 enabled. Website opened.');closeModal();pendingDeleteSlug=null;loadDashboardData();return;
    }
    const res=await apiCall({action:'setShopLifecycle',shopId:target,operation,securityPin:pin});
    if(res.status!=='success') throw new Error(res.message||'Lifecycle action failed.');
    showDbToast(res.message||'Shop updated.'); closeModal(); pendingDeleteSlug=null; loadDashboardData();
  } catch(e) { showDbToast(e.message||'Action failed.',true); }
  finally { btn.disabled=false; }
});

const wizardForm = $("wizard-form");
if (wizardForm) wizardForm.addEventListener("submit", async e => {
  e.preventDefault();
  const slug = $("shop-id").value.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  const shopName = $("shop-name").value.trim(), tagline = $("shop-tagline").value.trim();
  const ownerName = $("owner-name").value.trim(), email = $("owner-email").value.trim().toLowerCase();
  const mobile = $("shop-mobile").value.trim().replace(/\D/g, "");
  if (slug.length < 3) { showDbToast("Store slug must be at least 3 letters/numbers", true); goToStep(1); return; }
  if (!shopName || !tagline) { showDbToast("Please fill all identity fields in Step 1", true); goToStep(1); return; }
  if (!ownerName || !email || mobile.length !== 10) { showDbToast("Please verify owner contact details in Step 2", true); goToStep(2); return; }
  const payload = {
    action: "registerStore", shopId: slug, shopName, tagline, ownerName, ownerEmail: email, ownerMobile: mobile,
    primaryColor: $("col-primary") ? $("col-primary").value : "#2563eb",
    bgColor: $("col-bg") ? $("col-bg").value : "#ffffff",
    cardBg: $("col-card") ? $("col-card").value : "#ffffff",
    textColor: $("col-text") ? $("col-text").value : "#0f172a",
    reviewUrl: $("shop-review-url") ? $("shop-review-url").value.trim() : "",
    mapEmbedUrl: $("shop-map-url") ? $("shop-map-url").value.trim() : "",
    closingTime: $("shop-closing-time") ? ($("shop-closing-time").value.trim() || "9:00 PM") : "9:00 PM",
    experienceMode: $("wizard-experience-mode") ? $("wizard-experience-mode").value : "WEBSITE_COMMUNICATION",
    categoryKey: $("wizard-category") ? $("wizard-category").value : "general",
    isPublicRegister: false
  };
  const btn = $("btn-save-store"), idleHtml = btn ? btn.innerHTML : "Save";
  if (btn) { btn.disabled = true; btn.innerHTML = `<span class="spinner"></span><span>Writing to Master-Sheet…</span>`; }
  try {
    const res = await apiCall(payload);
    if (res.status === "success") {
      showDbToast(`Store saved in Master-Sheet row #${res.row || ""}.`);
      wizardForm.reset(); goToStep(1); await loadDashboardData(); openStudioForStore(slug);
    } else showDbToast(res.message || "Registration failed", true);
  } catch (err) { showDbToast(err.message || "Network error syncing with Google Sheets.", true); }
  finally { if (btn) { btn.disabled = false; btn.innerHTML = idleHtml; } }
});

window.sendOwnerLinks = async function(slug, includeDesk) {
  const store=allStoresCache.find(s=>s.shopId===slug&&(s.registrationStatus||'PENDING').toUpperCase()==='ACTIVE');
  if(!store)return showDbToast('Approve this shop before preparing owner messages.',true);
  const nav=document.querySelector('[data-tab="tab-messages"]');if(nav)nav.click();
  if($('msg-shop-select'))$('msg-shop-select').value=slug;
  if($('msg-channel'))$('msg-channel').value='WHATSAPP';
  if($('msg-template-key'))$('msg-template-key').value='OWNER_STATUS';
  try{await loadMessageTemplates();$('msg-channel').value='WHATSAPP';$('msg-template-key').value='OWNER_STATUS';const t=getSelectedMessageTemplate();if(t){$('msg-subject').value=t.subject||'';$('msg-body').value=t.body||'';}await loadCommunicationLog();showDbToast('Owner WhatsApp template loaded. Review/edit it, enter your security PIN, then prepare the draft.');}catch(e){showDbToast(e.message||'Could not load message template.',true);}
};

window.openStudioForStore = function(slug) {
  const qrTab = document.querySelector('[data-tab="tab-qr"]');
  if (qrTab) qrTab.click();
  const selector = $("qr-store-selector");
  if (selector) selector.value = slug;
  renderQrStudio(slug);
};
if ($("qr-store-selector")) $("qr-store-selector").addEventListener("change", e => renderQrStudio(e.target.value));

function renderQrStudio(slug) {
  const standBox = $("box-stand-qr"), publicBox = $("box-public-qr");
  if (!standBox || !publicBox) return;
  standBox.innerHTML = ""; publicBox.innerHTML = "";
  ["btn-copy-stand", "btn-dl-stand", "btn-copy-public", "btn-dl-public"].forEach(id => { if ($(id)) $(id).disabled = !slug; });
  if (!slug) {
    if ($("chip-stand-url")) $("chip-stand-url").textContent = "Select a store to view URL";
    if ($("chip-public-url")) $("chip-public-url").textContent = "Select a store to view URL";
    return;
  }
  const approvedStore = allStoresCache.find(s => s.shopId === slug && (s.registrationStatus || "PENDING").toUpperCase() === "ACTIVE");
  if (!approvedStore) {
    if ($("chip-stand-url")) $("chip-stand-url").textContent = "QR is available after Admin approval";
    if ($("chip-public-url")) $("chip-public-url").textContent = "QR is available after Admin approval";
    ["btn-copy-stand", "btn-dl-stand", "btn-copy-public", "btn-dl-public"].forEach(id => { if ($(id)) $(id).disabled = true; });
    return;
  }
  const standUrl = `https://${slug}.ccd.dev/nfc`;
  const publicUrl = `https://${slug}.ccd.dev/`;
  if ($("chip-stand-url")) $("chip-stand-url").textContent = standUrl;
  if ($("chip-public-url")) $("chip-public-url").textContent = publicUrl;
  new QRCode(standBox, { text: standUrl, width: 220, height: 220, correctLevel: QRCode.CorrectLevel.M });
  new QRCode(publicBox, { text: publicUrl, width: 220, height: 220, correctLevel: QRCode.CorrectLevel.M });
}

window.copyStudioLink = async function(type) {
  const chip = $(`chip-${type}-url`), text = chip ? chip.textContent : "";
  if (!text || text.includes("Select a store")) return;
  try { await navigator.clipboard.writeText(text); showDbToast("Link copied to clipboard!"); }
  catch (err) { showDbToast("Couldn't copy automatically. Tap and hold the URL to copy.", true); }
};

window.downloadStudioQr = function(type) {
  const box = document.querySelector(`#box-${type}-qr`);
  if (!box) return;
  const canvas = box.querySelector("canvas"), img = box.querySelector("img");
  let href = null;
  if (canvas) { try { href = canvas.toDataURL("image/png"); } catch (e) {} }
  if (!href && img && img.src && img.src.startsWith("data:")) href = img.src;
  if (href) {
    const a = document.createElement("a"); a.href = href; a.download = `${type}-qr-stand.png`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); showDbToast("QR Code downloaded.");
  } else showDbToast("QR Code rendering, please try again in a moment.", true);
};

if ($("btn-refresh-overview")) $("btn-refresh-overview").addEventListener("click", () => { showDbToast("Refreshing Master-Sheet data..."); loadDashboardData(); });
if ($("btn-logout")) $("btn-logout").addEventListener("click", () => { currentUser.sessionToken = ""; location.reload(); });
window.addEventListener("DOMContentLoaded", () => { handleWizardEnterKey(); ensureGlobalPolicyEditor(); if (window.CCDLoading) window.CCDLoading.finish(); });
