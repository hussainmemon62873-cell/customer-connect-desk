let ownerToken='',ownerSession='',customerSession='',dashboard=null,lastAllocation=null,publicConfig=null,ownerRefreshTimer=null,ownerExpiryTimer=null,ownerExpiryAt=0,ownerGoogleWaitTimer=null,verifiedOwnerEmail='',publicContentCache=null,publicContentCacheAt=0,pendingAllocationRequestId='',customerExpiryTimer=null,customerExpiryAt=0;
try{pendingAllocationRequestId=sessionStorage.getItem('dqr_pending_allocation_request')||'';}catch(e){}
const $=id=>document.getElementById(id);
function getApiUrl(){const raw=window.DQR_CONFIG&&window.DQR_CONFIG.API_PATH?String(window.DQR_CONFIG.API_PATH).trim():'';if(raw!=='/api/dynamic-qr')throw new Error('The same-origin Dynamic QR Pages Function is not configured. Check dynamic-qr/config.js and the functions/api/dynamic-qr.js deployment.');return raw;}
async function api(p){const payload={...p,idToken:ownerToken,ownerSession,customerSession};const form=new URLSearchParams();form.set('postData',JSON.stringify(payload));let response;try{response=await fetch(getApiUrl(),{method:'POST',body:form,cache:'no-store',credentials:'same-origin'});}catch(e){throw new Error('Could not reach the same-origin Dynamic QR API. Confirm the Cloudflare Pages Function is deployed and DQR_APPS_SCRIPT_URL is configured.');}let text;try{text=await response.text();}catch(e){throw new Error('The Dynamic QR API response could not be read. Check the network connection and retry safely.');}let result;try{result=JSON.parse(text);}catch(e){throw new Error('The Dynamic QR API returned a non-JSON response. Check the Cloudflare Function and Apps Script deployment.');}if(!result||typeof result!=='object'||Array.isArray(result)||typeof result.ok!=='boolean')throw new Error('The Dynamic QR API returned an invalid JSON response format. Check the Cloudflare Function and Apps Script deployment.');if(!response.ok||result.ok===false){const message=typeof result.error==='string'&&result.error?result.error:'Request failed ('+response.status+').';if(p&&/^owner/.test(String(p.action||''))&&isOwnerGoogleAuthFailure_(message)){restartOwnerGoogleSignIn_();const authError=new Error('Your Google sign-in expired or was rejected. Sign in with the authorized Google account again.');authError.ownerGoogleAuthFailure=true;throw authError;}throw new Error(message);}return Object.prototype.hasOwnProperty.call(result,'data')?result.data:result;}
function isOwnerGoogleAuthFailure_(message){return /Owner Google sign-in required|Google sign-in could not be verified|This Google account is not authorized|Owner setup is incomplete/i.test(String(message||''));}
function restartOwnerGoogleSignIn_(){ownerToken='';ownerSession='';verifiedOwnerEmail='';if(ownerRefreshTimer)clearInterval(ownerRefreshTimer);ownerRefreshTimer=null;if(ownerExpiryTimer)clearTimeout(ownerExpiryTimer);ownerExpiryTimer=null;ownerExpiryAt=0;showOwner();toast('Google sign-in expired. Verify the authorized account again.');}
function toast(s){$('toast').textContent=s;$('toast').classList.add('show');setTimeout(()=>$('toast').classList.remove('show'),3200)}
function modal(html){$('modalContent').innerHTML=html;$('modal').classList.remove('hidden')}function closeModal(){$('modal').classList.add('hidden')}
function showPortal(){
  const root=$('customerRoot');
  if(!root){modal(`<span class="eyebrow">CUSTOMER ACCESS</span><h2>Your QR collection</h2><p class="muted">Enter your reference number and registered email. We will verify your access before showing your QR codes.</p><label>Reference number<input id="portalRef" placeholder="REF-XXXXXXXXXX" maxlength="14"></label><label>Registered email<input id="portalEmail" type="email" placeholder="you@example.com" maxlength="254"></label><button class="primary full" id="requestOtpBtn" onclick="sendOtp()">Send verification code</button><p id="portalMsg" class="msg" role="status" aria-live="polite"></p>`);return;}
  root.style.display='block';
  root.innerHTML=`<section class="customer-access-card"><span class="eyebrow">SECURE CUSTOMER ACCESS</span><h2>Open your QR dashboard</h2><p class="muted">Enter the reference number and registered email shared with your allocation. We will email a one-time verification code before displaying your QR collection.</p><div class="customer-access-form"><label>Reference number<input id="portalRef" autocomplete="off" placeholder="REF-XXXXXXXXXX" maxlength="14"></label><label>Registered email<input id="portalEmail" type="email" autocomplete="email" placeholder="you@example.com" maxlength="254"></label></div><button class="primary" id="requestOtpBtn" onclick="sendOtp()">Send verification code</button><p id="portalMsg" class="msg" role="status" aria-live="polite"></p><p class="muted small">Your reference number is not a password. Email verification is required every time you sign in.</p></section>`;
}
async function sendOtp(){
  const button=$('requestOtpBtn'),message=$('portalMsg');
  if(button&&button.disabled)return;
  const ref=$('portalRef').value.trim().toUpperCase(),email=$('portalEmail').value.trim().toLowerCase();
  if(!/^REF-[A-Z0-9]{10}$/.test(ref)){if(message)message.textContent='Enter your complete allocation reference.';return;}
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){if(message)message.textContent='Enter the registered email address.';return;}
  if(button){button.disabled=true;button.textContent='Sending…';}
  if(message)message.textContent='Requesting a one-time email code…';
  try{
    await api({action:'requestOtp',reference:ref,email});
    window.pendingPortalRef=ref;window.pendingPortalEmail=email;
    const root=$('customerRoot');
    if(root){root.innerHTML=`<section class="customer-access-card"><span class="eyebrow">EMAIL VERIFICATION</span><h2>Check your inbox</h2><p class="muted">A six-digit one-time code was sent to the registered email address. Enter it below to open your dashboard.</p><label>Verification code<input id="otpCode" inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="[0-9]{6}" placeholder="000000"></label><button class="primary" id="verifyOtpBtn" onclick="verifyOtpFromForm()">Verify & continue</button><button class="secondary" onclick="showPortal()">Back to reference sign-in</button><p id="otpMsg" class="msg" role="status" aria-live="polite"></p></section>`;}
    else modal(`<span class="eyebrow">EMAIL VERIFICATION</span><h2>Check your inbox</h2><p class="muted">Enter the six-digit code sent to your registered email.</p><input id="otpCode" inputmode="numeric" maxlength="6" pattern="[0-9]{6}" placeholder="000000"><button class="primary full" id="verifyOtpBtn" onclick="verifyOtpFromForm()">Verify & continue</button><p id="otpMsg" class="msg" role="status" aria-live="polite"></p>`);
  }catch(e){if(message)message.textContent=e.message||'Could not send the verification code.';else toast(e.message||'Could not send the verification code.');}
  finally{if(button){button.disabled=false;button.textContent='Send verification code';}}
}
async function verifyOtp(ref,email){
  const codeField=$('otpCode'),button=$('verifyOtpBtn'),msg=$('otpMsg'),otp=codeField?codeField.value.trim():'';
  if(!/^\d{6}$/.test(otp)){if(msg)msg.textContent='Enter the six-digit verification code.';return;}
  if(button){button.disabled=true;button.textContent='Verifying…';}
  try{const r=await api({action:'verifyOtp',reference:ref,email,otp});startCustomerSession(r.customerSession,r.expiresIn||21600);if(!r.dashboard)throw new Error('Email verified, but the customer dashboard response is missing. Refresh and verify again.');renderCustomer(r.dashboard);}
  catch(e){if(msg)msg.textContent=e.message||'Email verification failed.';}
  finally{if(button){button.disabled=false;button.textContent='Verify & continue';}}
}
function startCustomerSession(token,expiresIn){
  if(customerExpiryTimer)clearTimeout(customerExpiryTimer);
  customerSession=String(token||'');
  customerExpiryAt=Date.now()+Math.max(1000,Number(expiresIn||21600)*1000);
  customerExpiryTimer=setTimeout(()=>lockCustomerDashboard('Your customer session expired. Verify your email again to reopen your QR collection.'),Math.max(1000,customerExpiryAt-Date.now()));
}
function lockCustomerDashboard(message){
  const revoke=customerSession?api({action:'customerLock'}):Promise.resolve();
  customerSession='';customerExpiryAt=0;window.customerData=null;
  if(customerExpiryTimer)clearTimeout(customerExpiryTimer);customerExpiryTimer=null;
  const root=$('customerRoot');if(root){root.innerHTML='';root.style.display='none';}
  showPortal();
  if(message)toast(message);
  Promise.resolve(revoke).catch(error=>console.warn('Customer session revocation request failed; the server session will still expire automatically.',error));
}
async function verifyOtpFromForm(){return verifyOtp(window.pendingPortalRef,window.pendingPortalEmail)}
function renderCustomer(d){
  window.customerData=d;
  const refNav=$('customerReferenceNav');
  if(refNav){refNav.textContent='Reference: '+d.customer.reference;refNav.hidden=false;}
  const root=$('customerRoot');
  const rows=d.qrCodes.map(q=>`<article class="customer-qr-card"><div class="customer-qr-art"><div class="customerqr" id="custqr-${esc(q.qrRecordId)}"></div><b>${esc(q.serial)}</b></div><div class="customer-qr-details"><span class="eyebrow">YOUR QR CODE</span><h3>${esc(q.serial)}</h3><p class="customer-destination">${esc(q.destinationUrl||'Destination not configured yet')}</p><span class="status-pill">${esc(q.destinationStatus||'PENDING')}</span><button class="mini" onclick="downloadCustomerPng('${esc(q.qrRecordId)}','${esc(q.serial)}')">Download PNG</button></div></article>`).join('');
  const form=d.canSubmit?`<section class="customer-panel"><span class="eyebrow">NEXT STEP</span><h2>Set your QR destinations</h2><p>Enter one HTTPS destination for each QR code. Submit the complete allocation together; the owner reviews and approves the collection once.</p><label>Apply the same URL to every QR (optional)<input id="sameUrl" type="url" placeholder="https://your-website.com" oninput="applySameUrl()"></label><div class="customer-url-grid">${d.qrCodes.map(q=>`<label>${esc(q.serial)}<input data-qri="${esc(q.qrRecordId)}" data-qrs="${esc(q.serial)}" type="url" placeholder="https://example.com" required></label>`).join('')}</div><label class="check"><input id="customerAdultConfirmed" type="checkbox" required> I confirm that I am at least 18 years old.</label><button class="primary" id="submitInitialUrlsBtn" onclick="submitInitialUrls()">Submit all destinations for approval</button><p class="msg" id="customerSubmitMsg" role="status" aria-live="polite"></p></section>`:`<section class="customer-panel"><span class="eyebrow">ALLOCATION STATUS</span><h2>${d.approval&&d.approval.status==='PENDING_OWNER_REVIEW'?'Waiting for owner approval':d.approval&&d.approval.status==='APPROVED'?'Your QR collection is approved':'Your QR collection status'}</h2><p>${d.approval&&d.approval.status==='PENDING_OWNER_REVIEW'?'Your submitted destinations are saved. The owner will review this complete allocation once.':d.approval&&d.approval.status==='APPROVED'?'Your QR codes are approved. Destination URL changes are managed by the platform owner to protect your printed QR codes.':'Your allocation is not currently accepting destination submissions. Contact support for assistance.'}</p></section>`;
  const html=`<div class="customer-dashboard"><section class="customer-welcome"><div><span class="eyebrow">CUSTOMER DASHBOARD</span><h2>Welcome, ${esc(d.customer.name)}</h2><p>Manage your allocated QR codes, download print-ready files, and follow the approval status of your destinations.</p></div><div class="reference-card"><small>YOUR ALLOCATION REFERENCE</small><strong>${esc(d.customer.reference)}</strong><button class="mini" onclick="GenUICopyReference()">Copy reference</button><button class="mini" onclick="lockCustomerDashboard('You have securely locked your customer dashboard.')">Lock dashboard</button></div></section><div class="customer-summary"><div><small>QR codes allocated</small><strong>${d.qrCodes.length}</strong></div><div><small>Allocation status</small><strong>${esc(d.approval&&d.approval.status==='APPROVED'?'Approved':d.approval&&d.approval.status==='PENDING_OWNER_REVIEW'?'In review':d.canSubmit?'Action needed':'Processing')}</strong></div><div><small>Access security</small><strong>Email verified</strong></div></div><div class="customer-section-heading"><div><span class="eyebrow">YOUR INVENTORY</span><h2>My QR codes</h2><p>Each code keeps its own scan link and printed serial label.</p></div><div class="exportrow"><button class="secondary" onclick="downloadCustomerCsv()">Download CSV</button><button class="secondary" onclick="downloadCustomerZip()">Download all QR files</button></div></div><div class="customer-qr-grid">${rows||'<p>No QR codes are currently attached to this allocation.</p>'}</div>${form}<section class="customer-help-strip"><div><b>Need help with your QR collection?</b><p>Read the setup guide or contact platform support.</p></div><a class="secondary" href="dynamic-qr-guide.html">QR setup guide</a><a class="secondary" id="customerDashboardContact" href="#">Contact support</a></section></div>`;
  if(root){root.innerHTML=html;root.style.display='block';}
  else {modal(html);}
  const contact=$('customerDashboardContact');if(contact&&publicConfig&&publicConfig.supportEmail)contact.href='mailto:'+publicConfig.supportEmail;else if(contact)contact.hidden=true;
  d.qrCodes.forEach(q=>{const target=$('custqr-'+q.qrRecordId);if(target&&window.QRCode)new QRCode(target,{text:q.scanUrl,width:130,height:130,correctLevel:QRCode.CorrectLevel.H});});
}
function GenUICopyReference(){const ref=window.customerData&&window.customerData.customer?window.customerData.customer.reference:'';if(!ref)return;if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(ref).then(()=>toast('Reference copied.')).catch(()=>toast('Select and copy your reference from the screen.'));}else toast('Your reference is shown above.');}
async function downloadCustomerZip(){
  try{
    const d=window.customerData;
    if(!d||!Array.isArray(d.qrCodes)||!d.qrCodes.length)throw new Error('No customer QR collection is available to export. Reopen your dashboard and try again.');
    if(typeof JSZip==='undefined')throw new Error('The ZIP export library did not load. Refresh the page and try again.');
    const zip=new JSZip();
    for(const q of d.qrCodes){
      const source=await qrImageSource_('custqr-'+q.qrRecordId);
      const canvas=drawLabeledQr_(source,q.serial,500,560,300,300,100,25,250,375,30);
      zip.file(String(q.serial)+'.png',await canvasToBlob_(canvas));
      zip.file(String(q.serial)+'.txt',String(q.scanUrl||'')+'\nQR ID: '+String(q.serial));
    }
    const blob=await zip.generateAsync({type:'blob'});
    saveExportBlob_(blob,'customer-qr-images.zip');
  }catch(e){notifyExportError_(e);}
}async function downloadCustomerPng(id,serial){
  try{
    const source=await qrImageSource_('custqr-'+id);
    const canvas=drawLabeledQr_(source,serial,500,560,300,300,100,25,250,375,30);
    saveExportBlob_(await canvasToBlob_(canvas),String(serial||'customer-qr')+'.png');
  }catch(e){notifyExportError_(e);}
}function applySameUrl(){const v=$('sameUrl').value;document.querySelectorAll('[data-qri]').forEach(x=>x.value=v)}
async function submitInitialUrls(){
  const button=$('submitInitialUrlsBtn'),message=$('customerSubmitMsg');
  if(button&&button.disabled)return;
  const fields=[...document.querySelectorAll('[data-qri]')];
  const mapping=fields.map(x=>({qrRecordId:x.dataset.qri,qrSerialId:x.dataset.qrs||'',url:x.value.trim()}));
  try{
    if(!fields.length)throw Error('No QR destination fields were found. Refresh your customer dashboard and try again.');
    if(!window.customerData||mapping.length!==window.customerData.qrCodes.length)throw Error('The QR list changed. Refresh your customer dashboard before submitting.');
    if(new Set(mapping.map(x=>x.qrRecordId)).size!==mapping.length)throw Error('A QR destination field is duplicated. Refresh your dashboard and try again.');
    for(let i=0;i<mapping.length;i++){
      if(!mapping[i].url)throw Error('Enter a destination URL for every QR code.');
      let parsed;try{parsed=new URL(mapping[i].url);}catch(e){throw Error('Enter a valid HTTPS URL for '+window.customerData.qrCodes[i].serial+'.');}
      if(parsed.protocol!=='https:'||!parsed.hostname)throw Error('Use an HTTPS website address for '+window.customerData.qrCodes[i].serial+'.');
    }
    if(!$('customerAdultConfirmed')||!$('customerAdultConfirmed').checked)throw Error('Confirm that you are at least 18 years old.');
    if(button){button.disabled=true;button.textContent='Submitting…';}
    if(message)message.textContent='Submitting the complete QR mapping…';
    const r=await api({action:'customerSubmitUrls',mapping,adultConfirmed:true});
    const status=r.approvalStatus||'PENDING_OWNER_REVIEW';
    // Render from the successful submission response. A separate dashboard request is not required
    // for a committed submission to be shown as complete.
    const current=window.customerData;
    if(current)renderCustomer(Object.assign({},current,{canSubmit:false,approval:{status,customerSubmissionStatus:'SUBMITTED'}}));
    toast(r.message||'Your complete QR allocation was submitted.');
  }catch(e){
    if(message)message.textContent=e.message||'The QR mapping could not be submitted.';
    toast(e.message||'The QR mapping could not be submitted.');
  }finally{
    if(button){button.disabled=false;button.textContent='Submit all destinations for approval';}
  }
}
function downloadCustomerCsv(){try{const d=window.customerData;if(!d||!Array.isArray(d.qrCodes)||!d.qrCodes.length)throw new Error('No customer QR collection is available to export. Reopen your dashboard and try again.');downloadText('my-qr-codes.csv','QR ID,Destination URL,Status\n'+d.qrCodes.map(q=>[q.serial,q.destinationUrl,q.destinationStatus].map(csv).join(',')).join('\n'),'text/csv');}catch(e){notifyExportError_(e);}}async function showOwner(){
  clearTimeout(ownerGoogleWaitTimer);
  ownerSession='';verifiedOwnerEmail='';
  modal(`<span class="eyebrow">OWNER CONSOLE</span><h2>Secure owner sign in</h2><p class="muted">First verify the Google account configured for this platform. Your private dashboard also requires the owner PIN.</p><div id="googleButton"></div><p id="ownerMsg" class="msg" aria-live="polite">Loading secure sign-in…</p>`);
  try{
    if(!publicConfig)publicConfig=await api({action:'publicConfig'});
    if(!publicConfig.googleClientId)throw new Error('Owner sign-in is not configured. Set GOOGLE_CLIENT_ID in Apps Script Script Properties.');
    let attempts=0;
    const wait=()=>{
      if(!document.getElementById('googleButton'))return;
      if(window.google&&google.accounts&&google.accounts.id){
        google.accounts.id.initialize({client_id:publicConfig.googleClientId,callback:onGoogleCredential,auto_select:false});
        google.accounts.id.renderButton($('googleButton'),{type:'standard',size:'large',theme:'outline',text:'signin_with',shape:'rectangular'});
        const m=$('ownerMsg');if(m)m.textContent='';
        return;
      }
      attempts++;
      if(attempts>=40){const m=$('ownerMsg');if(m)m.textContent='Google sign-in did not load. Check your connection, allow accounts.google.com, then refresh this page.';return;}
      ownerGoogleWaitTimer=setTimeout(wait,250);
    };
    wait();
  }catch(e){const m=$('ownerMsg');if(m)m.textContent=e.message;}
}
async function onGoogleCredential(r){
  if(!r||!r.credential){const m=$('ownerMsg');if(m)m.textContent='Google did not return a sign-in credential. Please try again.';return;}
  ownerToken=r.credential;ownerSession='';
  try{
    const pin=await api({action:'ownerPinStatus'});
    verifiedOwnerEmail=pin.ownerEmail||'';
    if(pin.repairRequired){
      modal(`<span class="eyebrow">SECURITY CONFIGURATION ERROR</span><h2>Owner PIN setup needs repair</h2><p class="muted">Google account verified${verifiedOwnerEmail?' for '+esc(verifiedOwnerEmail):''}. The stored owner PIN hash and salt are incomplete. For safety, the website will not overwrite a partial PIN setup. Ask the platform operator to verify and repair both OWNER_PIN_HASH and OWNER_PIN_SALT in the Dynamic QR Apps Script Script Properties.</p><button class="secondary full" onclick="signOutOwner()">Sign out of Google</button>`);
      return;
    }
    if(!pin.configured){
      modal(`<span class="eyebrow">FIRST-TIME SECURITY SETUP</span><h2>Create owner PIN</h2><p class="muted">Google account verified${verifiedOwnerEmail?' for '+esc(verifiedOwnerEmail):''}. Create a private 8–12 digit numeric PIN with at least four different digits. Avoid repeated, patterned or sequential numbers. It protects customer details, QR inventory, destination URLs and all owner actions. There is no shared or default password.</p><label>New owner PIN<input id="newOwnerPin" type="password" inputmode="numeric" autocomplete="new-password" minlength="8" maxlength="12" pattern="[0-9]{8,12}" required placeholder="8–12 digits"></label><button class="primary full" id="saveFirstPinBtn" onclick="saveFirstPin()">Save security PIN</button><p id="pinMsg" class="msg" aria-live="polite"></p>`);
      return;
    }
    if(pin.upgradeRequired){showOwnerPinUpgradeGate();return;}
    showOwnerPinGate();
  }catch(e){const m=$('ownerMsg');if(m)m.textContent=e.message;else toast(e.message);}
}
window.onGoogleCredential=onGoogleCredential;
function showOwnerPinGate(message=''){
  clearInterval(ownerRefreshTimer);ownerRefreshTimer=null;clearTimeout(ownerExpiryTimer);ownerExpiryTimer=null;ownerExpiryAt=0;ownerSession='';dashboard=null;window.ownerData=null;
  modal(`<span class="eyebrow">SECOND-LAYER SECURITY</span><h2>Unlock private dashboard</h2><p class="muted">Google account verified${verifiedOwnerEmail?' for '+esc(verifiedOwnerEmail):''}. Enter your owner PIN to access customer records, QR inventory, destination URLs and analytics.</p><label>Owner PIN<input id="ownerPinInput" type="password" inputmode="numeric" autocomplete="current-password" minlength="8" maxlength="12" pattern="[0-9]{8,12}" placeholder="Enter 8–12 digit PIN"></label><button class="primary full" id="ownerUnlockBtn" onclick="unlockOwner()">Unlock private dashboard</button><p id="ownerPinMsg" class="msg" aria-live="polite">${esc(message)}</p><button class="secondary full" onclick="signOutOwner()">Sign out of Google</button>`);
}
function showOwnerPinUpgradeGate(message=''){
  clearInterval(ownerRefreshTimer);ownerRefreshTimer=null;clearTimeout(ownerExpiryTimer);ownerExpiryTimer=null;ownerExpiryAt=0;ownerSession='';dashboard=null;window.ownerData=null;
  modal(`<span class="eyebrow">REQUIRED SECURITY UPGRADE</span><h2>Update your owner PIN</h2><p class="muted">Your existing PIN uses an older security policy. Enter it once, then create a new 8–12 digit PIN with at least four different digits. Repeated, patterned and sequential PINs are not accepted. Private dashboard access stays locked until this upgrade is complete.</p><label>Current owner PIN<input id="legacyOwnerPin" type="password" inputmode="numeric" autocomplete="current-password" minlength="6" maxlength="12" pattern="[0-9]{6,12}" required></label><label>New owner PIN<input id="upgradeOwnerPin" type="password" inputmode="numeric" autocomplete="new-password" minlength="8" maxlength="12" pattern="[0-9]{8,12}" required></label><label>Confirm new owner PIN<input id="confirmUpgradeOwnerPin" type="password" inputmode="numeric" autocomplete="new-password" minlength="8" maxlength="12" pattern="[0-9]{8,12}" required></label><button class="primary full" id="upgradeOwnerPinBtn" onclick="upgradeOwnerPin()">Upgrade security PIN</button><p id="upgradeOwnerPinMsg" class="msg" aria-live="polite">${esc(message)}</p><button class="secondary full" onclick="signOutOwner()">Sign out of Google</button>`);
}
async function upgradeOwnerPin(){
  const current=$('legacyOwnerPin'),next=$('upgradeOwnerPin'),confirm=$('confirmUpgradeOwnerPin'),button=$('upgradeOwnerPinBtn'),msg=$('upgradeOwnerPinMsg');
  const currentPin=current?current.value.trim():'',newPin=next?next.value.trim():'',confirmPin=confirm?confirm.value.trim():'';
  if(!/^\d{6,12}$/.test(currentPin)){if(msg)msg.textContent='Enter your current 6–12 digit PIN.';return;}
  if(!/^\d{8,12}$/.test(newPin)){if(msg)msg.textContent='New PIN must contain 8–12 digits.';return;}
  if(new Set(newPin.split('')).size<4||/^(\d)\1+$/.test(newPin)){if(msg)msg.textContent='Choose a PIN with at least four different digits and no repeated-digit pattern.';return;}
  for(let size=1;size<=Math.floor(newPin.length/2);size++){if(newPin.length%size===0&&newPin.slice(0,size).repeat(newPin.length/size)===newPin){if(msg)msg.textContent='Do not use a repeating PIN pattern.';return;}}
  const sequences=['012345678901234567890123','987654321098765432109876'];if(sequences.some(sequence=>Array.from({length:11},(_,i)=>sequence.slice(i,i+newPin.length)).includes(newPin))){if(msg)msg.textContent='Do not use a sequential PIN pattern.';return;}
  if(newPin!==confirmPin){if(msg)msg.textContent='The new PIN and confirmation do not match.';return;}
  if(newPin===currentPin){if(msg)msg.textContent='Choose a different PIN from the current one.';return;}
  if(button){button.disabled=true;button.textContent='Updating…';}
  try{await api({action:'ownerSetPin',currentPin,newPin});if(current)current.value='';if(next)next.value='';if(confirm)confirm.value='';showOwnerPinGate('Your owner PIN has been upgraded. Enter the new PIN to unlock the private dashboard.');}
  catch(e){if(msg)msg.textContent=e.message;if(button){button.disabled=false;button.textContent='Upgrade security PIN';}}
}
async function saveFirstPin(){
  const field=$('newOwnerPin'),button=$('saveFirstPinBtn'),msg=$('pinMsg');
  if(!field||!field.checkValidity()){if(msg)msg.textContent='Enter a numeric PIN containing 8–12 digits.';return;}
  if(button){button.disabled=true;button.textContent='Saving…';}
  try{await api({action:'ownerSetPin',newPin:field.value});field.value='';showOwnerPinGate('PIN created successfully. Enter it to unlock the private dashboard.');}
  catch(e){if(msg)msg.textContent=e.message;if(button){button.disabled=false;button.textContent='Save security PIN';}}
}
function ownerHealthHtml(h){
  if(!h)return '';
  const rows=[['Required configuration',h.missingProperties.length?'Missing: '+h.missingProperties.join(', '):'Present'],['Google Sheet database',h.databaseConnected?(h.missingSheets.length?'Missing tabs: '+h.missingSheets.join(', '):'Connected'):'Unavailable'],['Database columns',h.schemaMissing.length?h.schemaMissing.map(x=>x.sheet+': '+x.columns.join(', ')).join(' · '):'All expected columns found'],['Cache service',h.cacheAvailable?'Available':'Unavailable'],['Scan endpoint URL',h.scanEndpointValid?'Valid HTTPS Apps Script URL':'Invalid / missing'],['Customer portal URL',h.publicPortalUrlValid?'Valid HTTPS portal URL':'Invalid / missing'],['Email quota',h.mailQuotaRemaining===null?'Not reported':String(h.mailQuotaRemaining)+' recipients remaining']];
  const security=(h.securityControls||[]).map(item=>`<div class="security-control-row"><span><b>${esc(item.name)}</b><small>${esc(item.detail||'')}</small></span><strong class="${item.configured?'security-ready':'security-missing'}">${item.configured?'Configured':'Action required'}</strong></div>`).join('');
  return `<section class="owner-health"><div><b>System diagnostics · ${esc(h.status)}</b><small>Checked ${esc(h.checkedAt)}</small></div><div class="owner-health-grid">${rows.map(x=>`<div><small>${esc(x[0])}</small><span>${esc(x[1])}</span></div>`).join('')}</div><details class="security-control-list" open><summary>Authentication &amp; secret configuration (${(h.securityControls||[]).filter(x=>!x.configured).length} action(s) required)</summary>${security||'<p class="muted">No security configuration checks returned.</p>'}</details>${(h.warnings||[]).map(x=>`<p class="muted">${esc(x)}</p>`).join('')}<details><summary>Checks that still require live verification</summary><ul>${(h.liveChecksNotPerformed||[]).map(x=>`<li>${esc(x)}</li>`).join('')}</ul></details></section>`;
}
function renderOwner(d){modal(`<span class="eyebrow">OWNER DASHBOARD</span><h2>QR management centre</h2>${ownerHealthHtml(d.health)}<div class="owner-identity"><span>Signed in as <b>${esc(d.ownerEmail||'Configured owner account')}</b></span><button class="mini" onclick="signOutOwner()">Lock &amp; sign out</button><small>${d.emailQuotaRemaining===null||d.emailQuotaRemaining===undefined?'Email quota unavailable':'Remaining daily email recipients: '+esc(d.emailQuotaRemaining)}</small></div><div class="stats">${[['Customers',d.stats.customers],['Registrations',d.stats.registrations],['Active QR',d.stats.active],['Reusable IDs',d.stats.reusable],['Pending approvals',d.stats.pending],['Not configured',d.stats.notConfigured]].map(x=>`<div class="stat"><small>${x[0]}</small><b>${x[1]}</b></div>`).join('')}</div><div class="ownerbar"><button class="secondary" onclick="beginChangeOwnerPin()">Change PIN</button><button class="secondary" onclick="lockOwnerDashboard()">🔒 Lock dashboard</button><button class="secondary" onclick="loadOwner()">Refresh</button></div><div class="tabs"><button class="tab active" onclick="ownerTab('allocate',this)">Allocate</button><button class="tab" onclick="ownerTab('approvals',this)">Approvals</button><button class="tab" onclick="ownerTab('active',this)">Active QR</button><button class="tab" onclick="ownerTab('deleted',this)">Reusable IDs</button><button class="tab" onclick="ownerTab('customers',this)">Customers</button><button class="tab" onclick="ownerTab('content',this)">Site content</button><button class="tab" onclick="ownerTab('messages',this)">Message Centre</button><button class="tab" onclick="ownerTab('analytics',this)">Scan Analytics</button><button class="tab" onclick="ownerTab('audit',this)">Audit Log</button></div><div id="ownerPane">${ownerAllocateHtml(d)}</div>`);window.ownerData=d;}
function ownerTab(t,b){window.currentOwnerTab=t;document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));b.classList.add('active');const d=window.ownerData;const pane=$('ownerPane');if(t==='allocate')pane.innerHTML=ownerAllocateHtml(d);if(t==='approvals')pane.innerHTML=ownerApprovalsHtml(d);if(t==='active')pane.innerHTML=ownerActiveHtml(d);if(t==='deleted')pane.innerHTML=ownerDeletedHtml(d);if(t==='customers')pane.innerHTML=ownerCustomersHtml(d);if(t==='content')pane.innerHTML=ownerContentHtml(d);if(t==='messages')pane.innerHTML=ownerMessagesHtml(d);if(t==='analytics')pane.innerHTML=ownerAnalyticsHtml(d);if(t==='audit')pane.innerHTML=ownerAuditHtml(d);}
function ownerAllocateHtml(d){return `<h3>Register customer & allocate QR codes</h3><div class="formgrid"><label>Full name<input id="cName" autocomplete="name" maxlength="100" required></label><label>Mobile<input id="cMobile" inputmode="tel" autocomplete="tel" maxlength="18" required></label><label>Email<input id="cEmail" type="email" autocomplete="email" maxlength="254" required></label><label>Customer age (18+)<input id="cAge" type="number" min="18" max="120" step="1" required inputmode="numeric"></label><label>QR quantity<input id="cCount" type="number" min="1" max="250" step="1" value="5" required></label></div><label class="check"><input id="adultConfirmed" type="checkbox" required> I confirm the customer has stated that they are at least 18 years old.</label><p class="muted">Registrations are limited to adults aged 18 or older. Do not enter a registration for a person under 18. Choose reusable serials from the clean reusable pool. Remaining quantity receives new sequential IDs.</p><div class="reuselist"><b>Reusable IDs available: ${d.reusableQr.length}</b>${d.reusableQr.length?d.reusableQr.map(x=>`<label class="check"><input type="checkbox" value="${esc(x.qr_serial_id)}"> ${esc(x.qr_serial_id)}</label>`).join(''):'<p class="muted">No reusable QR IDs available.</p>'}</div><button class="primary" id="createAllocationBtn" onclick="createAllocation()">Create allocation</button><p id="allocationMsg" class="msg" role="status" aria-live="polite"></p><div id="allocResult" aria-live="polite"></div>`}
function renderAllocationResult(r){
  if(!r||!r.registrationId||!Array.isArray(r.qrCodes)||!r.qrCodes.length)throw new Error('The allocation response is incomplete. Check the owner dashboard before submitting a new allocation.');
  lastAllocation=r;
  $('allocResult').innerHTML=`<div class="notice"><b>Created ${r.qrCodes.length} QR codes</b><br>Reference: ${esc(r.reference)}<br>Share this reference and the registered email with the customer.</div><div class="exportrow"><button class="secondary" onclick="downloadAllocationPng()">Download PNGs / ZIP</button><button class="secondary" onclick="downloadAllocationSvg()">SVG files</button><button class="secondary" onclick="printAllocation()">Print / Save PDF</button><button class="secondary" onclick="downloadAllocationCsv()">CSV</button><button class="secondary" onclick="downloadAllocationXlsx()">XLSX</button><button class="secondary" onclick="downloadAllocationDoc()">DOCX</button><button class="secondary" onclick="shareWhatsApp()">Prepare WhatsApp</button><button class="secondary" id="allocationEmailBtn" onclick="sendAllocationEmail()">Send allocation email</button></div><div id="allocationQr" class="qrtiles">${r.qrCodes.map(q=>`<div class="qrtile"><div id="qr-${esc(q.qrRecordId)}"></div><b>${esc(q.serial)}</b></div>`).join('')}</div>`;
  let rendered=0;
  r.qrCodes.forEach(q=>{try{if(typeof QRCode==='function'){new QRCode($('qr-'+q.qrRecordId),{text:q.scanUrl,width:180,height:180,correctLevel:QRCode.CorrectLevel.H});rendered++;}}catch(error){console.warn('QR preview render failed for '+q.serial,error);}});
  if(rendered!==r.qrCodes.length){$('allocResult').insertAdjacentHTML('afterbegin','<p class="notice">Your allocation is saved. Some QR previews could not render because the QR library did not load correctly. Refresh this page before using image or print export.</p>');}
}
function ownerApprovalsHtml(d){return `<h3>Customer URL approval requests</h3><p class="muted">Each request is reviewed as one complete customer allocation. Review every QR ID and destination, then explicitly confirm the complete mapping before approving once.</p>${d.approvals.filter(x=>x.owner_approval_status==='PENDING_OWNER_REVIEW').map(a=>{const qs=d.activeQr.filter(q=>q.registration_id===a.registration_id),maps=d.urlChanges.filter(c=>c.registration_id===a.registration_id),reg=d.registrations.find(r=>r.registration_id===a.registration_id)||{},customer=d.customers.find(c=>c.customer_id===a.customer_id)||{},complete=qs.length>0&&qs.length===maps.length;return `<article class="record approval-record"><div><b>${esc(customer.full_name||'Customer')}</b><span>${esc(a.reference_number)} · ${qs.length} allocated QR codes</span><small>${esc(customer.email||'')} · ${esc(customer.mobile||'')}</small><small>Submitted: ${esc(a.submitted_at||reg.created_at||'')}</small></div><details open><summary>Review all ${maps.length} submitted destination URLs</summary><div class="tablewrap"><table><thead><tr><th>QR ID</th><th>Submitted destination URL</th></tr></thead><tbody>${maps.map(m=>`<tr><td>${esc(m.qr_serial_id)}</td><td class="urlcell"><a href="${esc(m.submitted_url)}" target="_blank" rel="noopener noreferrer">${esc(m.submitted_url)}</a></td></tr>`).join('')||'<tr><td colspan="2">No submitted URL rows found.</td></tr>'}</tbody></table></div></details>${complete?`<label class="check approval-confirm"><input type="checkbox" id="approvalReviewed-${esc(a.registration_id)}"> I reviewed every QR ID and its submitted destination URL for this allocation.</label>`:`<p class="msg error" role="alert">Mapping count mismatch: ${qs.length} active QR codes and ${maps.length} submitted URL rows. Do not approve until the data is corrected.</p>`}<button class="primary" ${complete?'':'disabled'} onclick="approveWhole('${esc(a.registration_id)}')">Approve entire allocation once</button></article>`}).join('')||'<p class="muted">No pending whole-allocation approval requests.</p>'}` }
function ownerActiveHtml(d){return `<h3>Active QR records · URLs locked by default</h3><input id="activeSearch" placeholder="Search QR ID, customer reference or URL" oninput="filterActiveQr()"><p class="muted">Unlock owner controls with your PIN before editing, suspending, restoring or deleting a destination. A QR with an active URL redirects directly without an Active status page.</p><div class="tablewrap"><table><thead><tr><th>QR ID</th><th>Reference</th><th>Destination URL 🔒</th><th>Status</th><th>Actions</th></tr></thead><tbody id="activeRows">${d.activeQr.map(q=>`<tr><td>${esc(q.qr_serial_id)}</td><td>${esc(q.reference_number)}</td><td class="urlcell"><input class="locked-url" id="url-${esc(q.qr_record_id)}" value="${esc(q.destination_url||'')}" placeholder="Not configured" ${ownerSession?'':'disabled'}><span class="lockhint">${ownerSession?'🔓 PIN unlocked':'🔒 Locked'}</span></td><td>${esc(q.destination_status)}</td><td><button class="mini" ${ownerSession?'':'disabled'} onclick="saveQrUrl('${esc(q.qr_record_id)}')">Save URL</button> <button class="mini" ${ownerSession?'':'disabled'} onclick="suspendQr('${esc(q.qr_record_id)}')">Suspend</button> <button class="mini" ${ownerSession?'':'disabled'} onclick="restoreQr('${esc(q.qr_record_id)}')">Restore</button> <button class="mini" ${ownerSession?'':'disabled'} onclick="deleteUrlQr('${esc(q.qr_record_id)}')">Delete URL</button> <button class="mini danger" ${ownerSession?'':'disabled'} onclick="deleteQr('${esc(q.qr_record_id)}')">Delete QR</button></td></tr>`).join('')}</tbody></table></div><button class="secondary" onclick="exportOwnerXlsx()">Export XLSX</button><button class="secondary" onclick="exportOwnerCsv()">Export CSV</button>`}
function ownerDeletedHtml(d){return `<h3>Deleted / Reusable QR IDs</h3><p class="muted">This list contains only currently reusable IDs. When selected for allocation, the ID is removed from this list and transferred to Active. History remains preserved separately.</p>${d.reusableQr.map(x=>`<div class="record"><b>${esc(x.qr_serial_id)}</b><span>Deleted ${esc(x.deleted_at)}</span><small>Previous reference: ${esc(x.previous_reference_number)}</small></div>`).join('')||'<p class="muted">No reusable IDs.</p>'}`}
function ownerContentHtml(d){
  const pages=(d.websiteContent||[]).filter(x=>/^[a-z0-9-]{1,40}$/.test(String(x.page_key||'')));
  return `<h3>Website policies & public content</h3><p class="muted">This editor changes database-backed website pages. It does not rewrite static HTML files such as privacy-policy.html or terms-and-conditions.html. Keep both sets consistent before launch. Each saved draft creates a content-history version. Publishing is blocked while known launch placeholders remain.</p>${pages.map(x=>{const key=String(x.page_key),status=String(x.published||'DRAFT').toUpperCase()==='TRUE'?'PUBLISHED':'DRAFT';return `<section class="record content-editor"><div><b>${esc(x.page_title)}</b><span>Version ${esc(x.content_version||1)} · ${status}</span></div><textarea id="content-${key}" rows="9" maxlength="20000" oninput="document.getElementById('contentReview-${key}').checked=false">${esc(x.page_content)}</textarea><div class="ownerbar"><button class="secondary" onclick="saveWebsiteContent('${key}')">Save draft</button><button class="secondary" onclick="loadWebsiteContentHistory('${key}')">View saved versions</button><label class="check"><input type="checkbox" id="contentReview-${key}"> I reviewed this complete page, removed launch placeholders and verified its legal and contact details.</label><button class="primary" onclick="publishWebsiteContent('${key}')">Publish reviewed page</button></div><div id="contentHistory-${key}" class="content-history"></div></section>`;}).join('')||'<p class="muted">No valid editable website pages are available.</p>'}`;
}
async function saveWebsiteContent(key){
  try{
    if(!ownerSession)throw Error('Unlock owner controls with your PIN first.');
    if(!/^[a-z0-9-]{1,40}$/.test(String(key||'')))throw Error('Invalid website page key.');
    const field=$('content-'+key);if(!field)throw Error('The selected page editor is no longer available. Refresh the dashboard.');
    if(field.value.length>20000)throw Error('Page content must be 20,000 characters or fewer.');
    const r=await api({action:'ownerUpdateContent',ownerSession,pageKey:key,content:field.value});toast(r.message||'Page saved as draft.');
    try{await loadOwner();}catch(refreshError){toast('Draft saved successfully, but the owner dashboard could not refresh. Use Refresh to confirm the saved version.');}
  }catch(e){toast(e.message||'Could not save the page draft.');}
}
async function publishWebsiteContent(key){
  const reviewed=$('contentReview-'+key);if(!reviewed||!reviewed.checked){toast('Review the complete page and tick its publishing acknowledgement first.');return;}
  if(!window.confirm('Publish this website page now? The page must contain the correct legal identity, contact details and required disclosures.'))return;
  try{
    if(!ownerSession)throw Error('Unlock owner controls with your PIN first.');
    if(!/^[a-z0-9-]{1,40}$/.test(String(key||'')))throw Error('Invalid website page key.');
    const r=await api({action:'ownerPublishContent',ownerSession,pageKey:key});toast(r.message||'Page published.');publicContentCache=null;publicContentCacheAt=0;
    try{await getPublicContent(true);await loadPublicContent();}catch(refreshError){toast('Page was published, but the public preview could not refresh. Reload the page to verify it.');}
    try{await loadOwner();}catch(refreshError){toast('Page was published, but the owner dashboard could not refresh. Use Refresh to confirm status.');}
  }catch(e){toast(e.message||'Could not publish this page.');}
}
async function loadWebsiteContentHistory(key){
  const host=$('contentHistory-'+key);if(!host)return;
  try{
    if(!ownerSession)throw Error('Unlock owner controls with your PIN first.');
    if(!/^[a-z0-9-]{1,40}$/.test(String(key||'')))throw Error('Invalid website page key.');
    host.innerHTML='<p class="muted">Loading saved versions…</p>';
    const r=await api({action:'ownerGetContentHistory',ownerSession,pageKey:key});
    const entries=Array.isArray(r.entries)?r.entries:[];
    host.innerHTML=entries.length?`<h4>Saved versions for ${esc(r.pageTitle||key)}</h4>${entries.map(x=>`<article class="record"><div><b>${esc(x.changedAt||'Saved version')}</b><small>${esc(x.changedBy||'OWNER')} · ${esc(x.contentLength||0)} characters</small></div><p>${esc(x.contentPreview||'').slice(0,320)}${Number(x.contentLength||0)>320?'…':''}</p><button class="mini" onclick="restoreWebsiteContentVersion('${esc(key)}','${esc(x.versionId)}')">Restore as new draft</button></article>`).join('')}`:'<p class="muted">No saved versions are available for this page yet.</p>';
  }catch(e){host.textContent=e.message||'Could not load content history.';}
}
async function restoreWebsiteContentVersion(key,versionId){
  if(!/^[a-z0-9-]{1,40}$/.test(String(key||''))||!/^WEB-[A-Za-z0-9_-]{8,40}$/.test(String(versionId||''))){toast('Invalid content history selection.');return;}
  if(!window.confirm('Restore this saved version as a new draft? The current version will remain in history, and the restored content will not be published automatically.'))return;
  try{
    if(!ownerSession)throw Error('Unlock owner controls with your PIN first.');
    const r=await api({action:'ownerRestoreContentVersion',ownerSession,versionId});toast(r.message||'Saved version restored as a draft.');
    try{await loadOwner();}catch(refreshError){toast('Version restored as a draft, but the dashboard could not refresh. Use Refresh to inspect it.');}
  }catch(e){toast(e.message||'Could not restore the selected version.');}
}
async function getPublicContent(force=false){if(!force&&publicContentCache&&Date.now()-publicContentCacheAt<300000)return publicContentCache;let response;try{response=await fetch(getApiUrl()+'?public=content',{method:'GET',credentials:'same-origin'});}catch(e){throw new Error('Public information is temporarily unavailable.');}const raw=await response.text();let result;try{result=JSON.parse(raw);}catch(e){throw new Error('The public content service returned an invalid response.');}if(!response.ok||!result||result.ok===false)throw new Error(result&&result.error?result.error:'Public content could not be loaded.');const r=result.data||result;publicContentCache=r;publicContentCacheAt=Date.now();return r;}
async function loadPublicContent(){try{const r=await getPublicContent();const hosts=[document.querySelector('.footlinks'),$('customerPolicyLinks')].filter(Boolean);hosts.forEach(host=>{host.querySelectorAll('[data-policy-link]').forEach(x=>x.remove());const links=(r.pages||[]).map(p=>`<a data-policy-link href="#" onclick="showPublicPage('${esc(p.key)}');return false">${esc(p.title)}</a>`).join('');host.insertAdjacentHTML('beforeend',links);});}catch(e){}}
async function showPublicPage(key){try{const r=await getPublicContent();const p=(r.pages||[]).find(x=>x.key===key);if(!p)throw Error('This page is not published yet. Please contact support if you need a copy.');modal(`<span class="eyebrow">${esc(p.title)}</span><h2>${esc(p.title)}</h2><p class="policytext">${esc(p.content).replace(/\n/g,'<br>')}</p><small>Content version ${esc(p.version)} · Review date: ${new Date().toLocaleDateString()}</small>`);}catch(e){toast(e.message)}}
function showCustomerHome(){if(window.customerData){renderCustomer(window.customerData);return;}showPortal();const root=$('customerRoot');if(root)root.scrollIntoView({behavior:'smooth',block:'start'});}

function ownerCustomersHtml(d){return `<h3>Customer registrations</h3><p class="muted">You can securely regenerate an allocation’s QR image bundle after a refresh. Scan links are retrieved only after owner PIN verification.</p>${d.registrations.map(r=>{const c=d.customers.find(x=>x.customer_id===r.customer_id)||{},sent=(d.messageLog||[]).some(x=>String(x.reference_number)===String(r.reference_number)&&x.template_key==='email_allocation'&&x.status==='SENT');return `<div class="record"><b>${esc(c.full_name||'Customer')}</b><span>${esc(r.reference_number)} · ${r.allocated_qr_count} QR · ${esc(r.registration_status)}</span><small>${esc(c.mobile||'')} · ${esc(c.email||'')}</small><button class="mini" onclick="downloadRegistrationQrFiles('${esc(r.registration_id)}')" ${ownerSession?'':'disabled'}>Download QR files</button><button class="mini" id="email-reg-${esc(r.registration_id)}" onclick="sendRegistrationEmail('${esc(r.registration_id)}')" ${sent?'disabled':''}>${sent?'Sent ✓':'Send allocation email'}</button></div>`}).join('')||'<p>No registrations yet.</p>'}`;}
async function downloadRegistrationQrFiles(registrationId){if(!ownerSession){toast('Unlock owner controls with your PIN first.');return;}const previous=lastAllocation;let scratch=null;try{const result=await api({action:'ownerGetAllocationQrCodes',registrationId});if(!result||!Array.isArray(result.qrCodes)||!result.qrCodes.length)throw Error('No active QR files were returned for this registration.');lastAllocation=result;scratch=document.createElement('div');scratch.style.cssText='position:fixed;left:-10000px;top:0;width:1px;height:1px;overflow:hidden';document.body.appendChild(scratch);result.qrCodes.forEach(q=>{const el=document.createElement('div');el.id='qr-'+q.qrRecordId;scratch.appendChild(el);new QRCode(el,{text:q.scanUrl,width:180,height:180,correctLevel:QRCode.CorrectLevel.H});});await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));const exported=await downloadAllocationPng();if(!exported)throw Error('QR image export did not complete. Resolve the export warning and try again.');toast('QR image bundle generated from the saved active inventory.');}catch(e){toast(e.message||'Could not regenerate QR files.');}finally{if(scratch)scratch.remove();lastAllocation=previous;}}
async function sendRegistrationEmail(registrationId){const b=$('email-reg-'+registrationId);if(b){b.disabled=true;b.textContent='Sending…';}try{const r=await api({action:'ownerSendAllocationEmail',registrationId});toast(r.message||'Email sent successfully.');const d=await api({action:'ownerDashboard'});window.ownerData=d;const tab=[...document.querySelectorAll('.tab')].find(x=>x.textContent.includes('Customers'));if(tab)ownerTab('customers',tab);}catch(e){if(b){b.disabled=false;b.textContent='Retry email';}toast(e.message);}}
function beginChangeOwnerPin(){
  if(!ownerToken||!ownerSession){toast('Unlock the owner dashboard before changing the PIN.');return;}
  modal(`<span class="eyebrow">ACCOUNT SECURITY</span><h2>Change owner PIN</h2><p class="muted">Enter your current PIN, then choose a new numeric PIN. All active owner PIN sessions will be invalidated after this change.</p><label>Current PIN<input id="currentOwnerPin" type="password" inputmode="numeric" autocomplete="current-password" maxlength="12" required></label><label>New PIN<input id="replacementOwnerPin" type="password" inputmode="numeric" autocomplete="new-password" minlength="8" maxlength="12" pattern="[0-9]{8,12}" required></label><label>Confirm new PIN<input id="confirmOwnerPin" type="password" inputmode="numeric" autocomplete="new-password" minlength="8" maxlength="12" pattern="[0-9]{8,12}" required></label><button class="primary full" id="changeOwnerPinBtn" onclick="changeOwnerPin()">Update PIN</button><button class="secondary full" onclick="loadOwner()">Cancel</button><p id="changePinMsg" class="msg" aria-live="polite"></p>`);
}
async function changeOwnerPin(){
  const current=$('currentOwnerPin'),next=$('replacementOwnerPin'),confirm=$('confirmOwnerPin'),button=$('changeOwnerPinBtn'),msg=$('changePinMsg');
  const currentPin=current?current.value.trim():'',newPin=next?next.value.trim():'',confirmPin=confirm?confirm.value.trim():'';
  if(!/^\d{6,12}$/.test(currentPin)){if(msg)msg.textContent='Enter your current 6–12 digit PIN.';return;}
  if(!/^\d{8,12}$/.test(newPin)){if(msg)msg.textContent='New PIN must contain 8–12 digits.';return;}
  if(new Set(newPin.split('')).size<4||/^(\d)\1+$/.test(newPin)){if(msg)msg.textContent='Choose a PIN with at least four different digits and no repeated-digit pattern.';return;}
  for(let size=1;size<=Math.floor(newPin.length/2);size++){if(newPin.length%size===0&&newPin.slice(0,size).repeat(newPin.length/size)===newPin){if(msg)msg.textContent='Do not use a repeating PIN pattern.';return;}}
  const sequences=['012345678901234567890123','987654321098765432109876'];if(sequences.some(sequence=>Array.from({length:11},(_,i)=>sequence.slice(i,i+newPin.length)).includes(newPin))){if(msg)msg.textContent='Do not use a sequential PIN pattern.';return;}
  if(newPin!==confirmPin){if(msg)msg.textContent='The new PIN and confirmation do not match.';return;}
  if(newPin===currentPin){if(msg)msg.textContent='Choose a different PIN from the current one.';return;}
  if(button){button.disabled=true;button.textContent='Updating…';}
  if(current)current.value='';if(next)next.value='';if(confirm)confirm.value='';
  try{
    await api({action:'ownerSetPin',currentPin,newPin});
    ownerSession='';showOwnerPinGate('PIN changed successfully. All previous PIN sessions are now invalid. Enter your new PIN to continue.');
  }catch(e){if(msg)msg.textContent=e.message;if(button){button.disabled=false;button.textContent='Update PIN';}}
}
async function lockOwnerDashboard(){
  try{if(ownerToken)await api({action:'ownerLock'});}catch(e){console.warn('Owner PIN session invalidation failed; the server session will still expire automatically.',e);}
  showOwnerPinGate('Dashboard locked. Enter your PIN to continue.');
}
async function signOutOwner(){
  try{if(ownerToken)await api({action:'ownerLock'});}catch(e){console.warn('Owner lock request failed; clearing this browser session anyway.',e);}
  finally{
    ownerToken='';ownerSession='';verifiedOwnerEmail='';dashboard=null;window.ownerData=null;
    if(ownerRefreshTimer)clearInterval(ownerRefreshTimer);ownerRefreshTimer=null;
    if(ownerExpiryTimer)clearTimeout(ownerExpiryTimer);ownerExpiryTimer=null;
    if(window.google&&google.accounts&&google.accounts.id&&typeof google.accounts.id.disableAutoSelect==='function')google.accounts.id.disableAutoSelect();
    showOwner();
  }
}
async function unlockOwner(){
  const field=$('ownerPinInput'),button=$('ownerUnlockBtn'),msg=$('ownerPinMsg');
  const pin=field?field.value.trim():'';
  if(!/^\d{8,12}$/.test(pin)){if(msg)msg.textContent='Enter your 8–12 digit owner PIN.';return;}
  if(button){button.disabled=true;button.textContent='Verifying…';}
  if(field)field.value='';
  try{
    const r=await api({action:'ownerUnlock',pin});
    if(!r||!r.ownerSession)throw new Error('The server did not create a valid owner session. Please try again.');
    ownerSession=r.ownerSession;
    await loadOwner();
    if(ownerExpiryTimer)clearTimeout(ownerExpiryTimer);
    ownerExpiryTimer=setTimeout(()=>{showOwnerPinGate('Your owner PIN session expired. Sign in with your PIN again.');toast('Private dashboard locked automatically.');},Math.max(1000,Number(r.expiresIn||600)*1000));
    startOwnerAutoRefresh();
    toast('Private dashboard unlocked.');
  }catch(e){ownerSession='';if(e&&e.ownerGoogleAuthFailure)return;showOwnerPinGate(e.message);}
}
async function createAllocation(){
  const button=$('createAllocationBtn'),message=$('allocationMsg');
  if(button&&button.disabled)return;
  const name=$('cName').value.trim(),mobile=$('cMobile').value.trim().replace(/\s+/g,''),email=$('cEmail').value.trim().toLowerCase(),age=Number($('cAge').value),count=Number($('cCount').value),reuseIds=[...document.querySelectorAll('.reuselist input:checked')].map(x=>x.value);
  const emailPattern=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if(name.length<2){if(message)message.textContent='Enter the customer’s full name.';return;}
  if(!/^[+0-9()\-]{8,18}$/.test(mobile)){if(message)message.textContent='Enter a valid mobile number.';return;}
  if(!emailPattern.test(email)){if(message)message.textContent='Enter a valid customer email address.';return;}
  if(!Number.isInteger(age)||age<18||age>120){if(message)message.textContent='Registrations are limited to customers aged 18–120.';return;}
  if(!Number.isInteger(count)||count<1||count>250){if(message)message.textContent='Choose between 1 and 250 QR codes.';return;}
  if(reuseIds.length>count){if(message)message.textContent='Selected reusable IDs cannot exceed the requested QR quantity.';return;}
  if(!$('adultConfirmed').checked){if(message)message.textContent='Confirm that the customer has stated they are at least 18 years old.';return;}
  if(!ownerSession){if(message)message.textContent='Unlock owner controls with your PIN first.';return;}
  if(!pendingAllocationRequestId){pendingAllocationRequestId=(window.crypto&&crypto.randomUUID?crypto.randomUUID():('REQ-'+Date.now()+'-'+Math.random().toString(36).slice(2)));try{sessionStorage.setItem('dqr_pending_allocation_request',pendingAllocationRequestId);}catch(e){}}
  if(button){button.disabled=true;button.textContent='Creating allocation…';}
  if(message)message.textContent='Validating customer details and issuing QR codes…';
  try{
    const r=await api({action:'createAllocation',ownerSession,requestId:pendingAllocationRequestId,count,reuseIds,customer:{name,mobile,email,age,adultConfirmed:true}});
    renderAllocationResult(r);
    pendingAllocationRequestId='';try{sessionStorage.removeItem('dqr_pending_allocation_request');}catch(e){}
    if(message)message.textContent='Allocation saved successfully. Export, print or share the QR codes below.';
    toast('Allocation created.');
  }catch(e){
    if(message)message.textContent=e.message||'Allocation could not be completed.';
    toast(e.message||'Allocation could not be completed.');
  }finally{
    if(button){button.disabled=false;button.textContent='Create allocation';}
  }
}

async function approveWhole(reg){try{if(!ownerSession)throw Error('Unlock owner controls with your PIN first.');const reviewed=$('approvalReviewed-'+reg);if(!reviewed||!reviewed.checked)throw Error('Review the complete QR-to-URL mapping and tick the confirmation box before approving.');if(!window.confirm('Approve every destination in this complete allocation? Scans will begin using the approved destinations.'))return;const r=await api({action:'approveAllocation',ownerSession,registrationId:reg});toast(r.notification&&r.notification.status==='FAILED'?'Approved, but customer email notification failed. Check Message Centre.':'Entire allocation approved once. Customer notification: '+(r.notification&&r.notification.status||'not confirmed')+'.');await loadOwner();}catch(e){toast(e.message)}}
async function qrAction(id,mode,url){if(!ownerSession)throw Error('Unlock owner controls with your PIN first.');return api({action:'ownerQrAction',ownerSession,qrRecordId:id,mode,url});}
function filterActiveQr(){const q=$('activeSearch').value.toLowerCase();document.querySelectorAll('#activeRows tr').forEach(r=>r.style.display=r.innerText.toLowerCase().includes(q)?'':'none')}
async function saveQrUrl(id){const url=$('url-'+id).value.trim();try{await qrAction(id,'EDIT_URL',url);toast('Destination updated.');await loadOwner();}catch(e){toast(e.message)}}
async function suspendQr(id){if(!window.confirm('Suspend this destination now? Scans of this QR will stop redirecting until it is restored.'))return;try{await qrAction(id,'SUSPEND');toast('Destination suspended.');await loadOwner();}catch(e){toast(e.message)}}
async function deleteUrlQr(id){if(!window.confirm('Delete this destination URL? The QR code will remain allocated but its destination will become unavailable.'))return;try{await qrAction(id,'DELETE_URL');toast('Destination URL deleted.');await loadOwner();}catch(e){toast(e.message)}}
async function restoreQr(id){if(!window.confirm('Restore this saved destination URL and resume redirects for this QR?'))return;try{await qrAction(id,'RESTORE');toast('Destination restored.');await loadOwner();}catch(e){toast(e.message)}}
async function deleteQr(id){if(!window.confirm('Retire this QR and move its visible serial to Deleted / Reusable inventory? Its old scan link will stop working, and the serial may later be assigned to a new customer.'))return;const promptedReason=window.prompt('Deletion reason (optional). Press OK to continue or Cancel to stop.','');if(promptedReason===null)return;try{if(!ownerSession)throw Error('Unlock owner controls with your PIN first.');await api({action:'deleteQr',ownerSession,qrRecordId:id,reason:promptedReason.trim()});toast('QR moved to reusable inventory.');await loadOwner();}catch(e){toast(e.message)}}
async function loadOwner(){if(!ownerToken||!ownerSession)throw new Error('Verify Google sign-in and unlock the owner PIN before loading private records.');if(ownerExpiryAt&&Date.now()>=ownerExpiryAt){showOwnerPinGate('Your owner PIN session expired. Enter your PIN again.');throw new Error('Owner PIN session expired. Unlock again with your PIN.');}const selected=window.currentOwnerTab||'allocate';const d=await api({action:'ownerDashboard'});window.ownerData=d;renderOwner(d);if(selected!=='allocate'){const tab=[...document.querySelectorAll('.tab')].find(x=>(x.getAttribute('onclick')||'').includes("'"+selected+"'"));if(tab)ownerTab(selected,tab);}}
function startOwnerAutoRefresh(){if(ownerRefreshTimer)clearInterval(ownerRefreshTimer);ownerRefreshTimer=setInterval(()=>{if(ownerToken&&ownerSession&&document.body&&document.body.dataset.page==='admin')loadOwner().catch(e=>{if(/PIN session expired|unlock again|Google sign-in/i.test(e.message))showOwnerPinGate('Your private owner session expired. Enter your PIN again.');else console.warn('Dashboard refresh failed:',e);});},30000);}
function csv(v){return '"'+String(v??'').replace(/"/g,'""')+'"'}function downloadText(n,t,m){
  try{saveExportBlob_(new Blob([String(t??'')],{type:m||'text/plain;charset=utf-8'}),n);}
  catch(e){notifyExportError_(e);}
}
function saveExportBlob_(blob,name){
  if(!(blob instanceof Blob)||!blob.size)throw new Error('The export file is empty or could not be generated.');
  const url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download=String(name||'download');a.style.display='none';
  (document.body||document.documentElement).appendChild(a);
  try{a.click();}finally{a.remove();setTimeout(()=>URL.revokeObjectURL(url),15000);}
}
function notifyExportError_(error){
  const message=error&&error.message?error.message:'The export could not be created. Refresh the page and try again.';
  if(typeof toast==='function')toast(message);else console.error(message,error);
}
function requireAllocation_(){
  if(!lastAllocation||!Array.isArray(lastAllocation.qrCodes)||!lastAllocation.qrCodes.length)throw new Error('No allocation is available. Create or reopen an allocation before exporting.');
  const serials=new Set(),records=new Set();
  for(const q of lastAllocation.qrCodes){
    if(!q||!q.serial||!q.qrRecordId||!/^https:\/\//i.test(String(q.scanUrl||'')))throw new Error('The allocation contains an incomplete QR record. Refresh the allocation before exporting.');
    if(serials.has(String(q.serial))||records.has(String(q.qrRecordId)))throw new Error('The allocation contains duplicate QR identifiers. Refresh the allocation before exporting.');
    serials.add(String(q.serial));records.add(String(q.qrRecordId));
  }
  return lastAllocation;
}
function qrImageSource_(containerId){
  const container=$(containerId);if(!container)throw new Error('The QR preview is not available. Reopen the dashboard and try again.');
  const source=container.querySelector('canvas')||container.querySelector('img');
  if(!source)throw new Error('The QR image has not finished rendering. Refresh the dashboard and try again.');
  if(source.tagName==='IMG'&&!source.complete){return new Promise((resolve,reject)=>{source.onload=()=>resolve(source);source.onerror=()=>reject(new Error('The QR image could not be loaded.'));});}
  if(source.tagName==='IMG'&&(!source.naturalWidth||!source.naturalHeight))throw new Error('The QR image is empty or unavailable.');
  if(source.tagName==='CANVAS'&&(!source.width||!source.height))throw new Error('The QR canvas is empty.');
  return Promise.resolve(source);
}
function drawLabeledQr_(source,serial,width,height,drawWidth,drawHeight,x,y,textX,textY,fontSize){
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
  const ctx=canvas.getContext('2d');if(!ctx)throw new Error('This browser cannot create a QR export image.');
  ctx.fillStyle='#fff';ctx.fillRect(0,0,width,height);ctx.drawImage(source,x,y,drawWidth,drawHeight);
  ctx.fillStyle='#111';ctx.font='bold '+fontSize+'px Arial';ctx.textAlign='center';ctx.fillText(String(serial||''),textX,textY);
  return canvas;
}
function canvasToBlob_(canvas){
  return new Promise((resolve,reject)=>{
    if(!canvas||typeof canvas.toBlob!=='function'){reject(new Error('PNG export is not supported by this browser.'));return;}
    try{canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('The browser could not encode the QR image as PNG.')),'image/png');}
    catch(e){reject(new Error('The QR image could not be exported. It may be blocked by browser image-security rules.'));}
  });
}function exportOwnerCsv(){try{const d=window.ownerData;if(!d||!Array.isArray(d.activeQr))throw new Error('Owner inventory is not loaded. Unlock and refresh the dashboard first.');downloadText('active-qr-inventory.csv','QR ID,Reference,Destination,Status\n'+d.activeQr.map(q=>[q.qr_serial_id,q.reference_number,q.destination_url,q.destination_status].map(csv).join(',')).join('\n'),'text/csv');}catch(e){notifyExportError_(e);}}function exportOwnerXlsx(){try{const d=window.ownerData;if(!d||!Array.isArray(d.activeQr)||!Array.isArray(d.reusableQr))throw new Error('Owner inventory is not loaded. Unlock and refresh the dashboard first.');if(typeof XLSX==='undefined'||!XLSX.utils)throw new Error('The spreadsheet export library did not load. Refresh the page and try again.');const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(d.activeQr),'Active QR');XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(d.reusableQr),'Deleted Reusable');XLSX.writeFile(wb,'dynamic-qr-inventory.xlsx');}catch(e){notifyExportError_(e);}}function templateFill(t,vars){return String(t||'').replace(/\{\{([a-zA-Z]+)\}\}/g,(m,k)=>vars[k]===undefined?m:String(vars[k]));}
async function shareWhatsApp(){const d=lastAllocation;if(!d)return;const name=$('cName').value.trim(),raw=$('cMobile').value.trim().replace(/\D/g,''),phone=raw.length===10?'91'+raw:raw,t=(window.ownerData&&window.ownerData.messageTemplates||{}).whatsapp_allocation||{},text=templateFill(t.body,{name,reference:d.reference,count:d.qrCodes.length,portal:(publicConfig&&publicConfig.portalUrl)||location.href});if(!phone){toast('Enter a valid customer mobile number first.');return;}const win=window.open('about:blank','_blank');if(!win){toast('Allow pop-ups for this site, then try WhatsApp again.');return;}try{await api({action:'ownerLogWhatsAppPrepared',registrationId:d.registrationId});win.location.href='https://wa.me/'+phone+'?text='+encodeURIComponent(text);toast('WhatsApp draft prepared. Confirm sending inside WhatsApp.');}catch(e){win.close();toast(e.message);}}
async function sendAllocationEmail(){const d=lastAllocation;if(!d||!d.registrationId)return;const b=$('allocationEmailBtn');b.disabled=true;b.textContent='Sending…';try{const r=await api({action:'ownerSendAllocationEmail',registrationId:d.registrationId});b.textContent='Sent ✓';b.disabled=true;toast(r.message||'Email sent successfully.');await loadOwner();}catch(e){b.disabled=false;b.textContent='Retry email';toast(e.message);}}
function ownerAnalyticsHtml(d){const rows=d.scanAnalytics||[];return `<h3>Scan Analytics</h3><p class="muted">${esc(d.stats.scanEvents||0)} scan events recorded. The latest ${rows.length} events are shown. Scan logging is best-effort under high concurrency; analytics may undercount scans. No IP address is collected by the Apps Script redirect handler.</p><button class="secondary" onclick="downloadOwnerActivityCsv('scans')">Export recent scan events CSV</button><div class="tablewrap"><table><thead><tr><th>QR ID</th><th>Scan time</th><th>Result</th><th>Device</th><th>Country</th><th>Referrer</th></tr></thead><tbody>${rows.map(x=>`<tr><td>${esc(x.qr_serial_id)}</td><td>${esc(x.scan_time)}</td><td>${esc(x.result_type)}</td><td>${esc(x.device_category||'UNKNOWN')}</td><td>${esc(x.country_code||'')}</td><td>${esc(x.referrer||'')}</td></tr>`).join('')||'<tr><td colspan="6">No scan events have been recorded.</td></tr>'}</tbody></table></div>`;}
function ownerAuditHtml(d){const rows=d.auditLog||[];return `<h3>Owner & system audit history</h3><p class="muted">${esc(d.stats.auditEvents||0)} audit events recorded. The latest ${rows.length} events are shown. This is an operational audit trail, not a guarantee that every read-only page view or external action is logged.</p><button class="secondary" onclick="downloadOwnerActivityCsv('audit')">Export recent audit events CSV</button><div class="tablewrap"><table><thead><tr><th>Time</th><th>Actor</th><th>Action</th><th>Entity</th><th>Entity ID</th><th>Details</th></tr></thead><tbody>${rows.map(x=>`<tr><td>${esc(x.timestamp)}</td><td>${esc(x.actor_type)} · ${esc(x.actor_id)}</td><td>${esc(x.action)}</td><td>${esc(x.entity_type)}</td><td>${esc(x.entity_id)}</td><td><small>${esc(x.details_json)}</small></td></tr>`).join('')||'<tr><td colspan="6">No audit events have been recorded.</td></tr>'}</tbody></table></div>`;}
function downloadOwnerActivityCsv(kind){try{const d=window.ownerData||{};if(!['scans','audit'].includes(kind))throw new Error('Unknown activity export type.');const rows=kind==='scans'?(d.scanAnalytics||[]):(d.auditLog||[]),keys=kind==='scans'?['qr_serial_id','scan_time','result_type','device_category','country_code','referrer']:['timestamp','actor_type','actor_id','action','entity_type','entity_id','details_json'];downloadText('dynamic-qr-'+kind+'-recent.csv',keys.map(csv).join(',')+'\n'+rows.map(r=>keys.map(k=>csv(r[k])).join(',')).join('\n'),'text/csv');}catch(e){notifyExportError_(e);}}function ownerMessageRowHtml(x){
  const when=x.sent_at?Date.parse(x.sent_at):0;
  const retryable=['email_owner_submission','email_customer_approval'].includes(x.template_key)&&(x.status==='FAILED'||(x.status==='SENDING'&&when&&Date.now()-when>600000));
  const action=retryable?`<button class="mini" onclick="retryOwnerNotification('${esc(x.template_key)}','${esc(x.reference_number)}')">Retry</button>`:'—';
  return `<tr><td>${esc(x.channel)}</td><td>${esc(x.template_key)}</td><td>${esc(x.recipient)}</td><td>${esc(x.reference_number)}</td><td><b class="${x.status==='SENT'?'msg-sent':(x.status==='FAILED'?'msg-failed':'msg-prepared')}">${esc(x.status)}</b>${x.error_message?`<small>${esc(x.error_message)}</small>`:''}</td><td>${esc(x.sent_at)}</td><td>${action}</td></tr>`;
}
function ownerMessagesHtml(d){const t=d.messageTemplates||{};const logs=d.messageLog||[];const field=(key,label,preview=false)=>`<section class="message-template"><h4>${label}</h4>${key!=='whatsapp_allocation'?`<label>Subject<input id="msg-${key}-subject" value="${esc((t[key]||{}).subject||'')}"></label>`:''}<label>Message body<textarea id="msg-${key}-body" rows="7">${esc((t[key]||{}).body||'')}</textarea></label>${preview?`<button class="secondary" onclick="previewMessageTemplate('${key}')">Send test preview to my owner email</button>`:''}</section>`;return `<h3>Message Centre</h3><p class="muted">All templates below are editable by you. Changes apply to future messages only. Test previews go to your configured owner email. Email status means the mail service accepted the request, not proof of inbox delivery. Failed automatic owner/customer notification emails can be retried here after the cooldown.</p>${field('whatsapp_allocation','WhatsApp allocation message')}<small class="muted">Placeholders: {{name}}, {{reference}}, {{count}}, {{portal}}. WhatsApp opens a prefilled chat; you or your staff must press Send. No automatic WhatsApp/SMS gateway is connected.</small>${field('email_allocation','Customer allocation email',true)}<small class="muted">Placeholders: {{name}}, {{reference}}, {{count}}, {{portal}}.</small>${field('email_otp','Customer OTP verification email',true)}<small class="muted">Required security placeholders: {{otp}} and {{expiry}}. Also available: {{name}}, {{reference}}. The server controls code generation, one-time use and expiry.</small>${field('email_owner_submission','Owner notification — customer submitted URLs',true)}<small class="muted">Placeholders: {{name}}, {{reference}}, {{count}}, {{admin}}.</small>${field('email_customer_approval','Customer notification — allocation approved',true)}<small class="muted">Placeholders: {{name}}, {{reference}}, {{count}}, {{portal}}.</small><button class="primary" id="saveMessageTemplatesBtn" onclick="saveMessageTemplates()">Save all templates</button><h3 style="margin-top:28px">Message history</h3><div class="tablewrap"><table><thead><tr><th>Channel</th><th>Type</th><th>Recipient</th><th>Reference</th><th>Status</th><th>Time</th><th>Action</th></tr></thead><tbody>${logs.map(ownerMessageRowHtml).join('')||'<tr><td colspan="7">No messages have been sent yet.</td></tr>'}</tbody></table></div>`;}

async function retryOwnerNotification(templateKey,reference){
  try{if(!ownerSession)throw Error('Unlock owner controls with your PIN first.');const registration=(window.ownerData&&window.ownerData.registrations||[]).find(x=>String(x.reference_number)===String(reference));if(!registration)throw Error('Registration not found in the current owner dashboard.');const r=await api({action:'ownerRetryNotification',templateKey,registrationId:registration.registration_id});toast(r.message||('Notification status: '+(r.status||'unknown')));await loadOwner();const tab=[...document.querySelectorAll('.tab')].find(x=>x.textContent.includes('Message Centre'));if(tab)tab.click();}catch(e){toast(e.message||'Could not retry notification.');}
}
async function previewMessageTemplate(key){try{if(!ownerSession)throw Error('Unlock owner controls with your PIN first.');if(!['email_allocation','email_otp','email_owner_submission','email_customer_approval'].includes(key))throw Error('Choose a valid email template.');const r=await api({action:'ownerSendTemplatePreview',ownerSession,templateKey:key});toast(r.message||'Test preview accepted by the email service.');loadOwner().catch(()=>console.warn('Preview was sent, but the dashboard refresh failed.'));}catch(e){toast(e.message)}}
function requiredTemplateTokens(){return{whatsapp_allocation:['name','reference','count','portal'],email_allocation:['name','reference','count','portal'],email_otp:['otp','expiry','reference'],email_owner_submission:['name','reference','count','admin'],email_customer_approval:['name','reference','count','portal']};}
async function saveMessageTemplates(){
  const button=$('saveMessageTemplatesBtn');if(button&&button.disabled)return;
  const templates={},required=requiredTemplateTokens();
  try{
    for(const key of Object.keys(required)){
      const bodyField=$('msg-'+key+'-body');if(!bodyField)throw Error('The '+key.replace(/_/g,' ')+' editor is missing. Reopen Message Centre and try again.');
      const body=bodyField.value;if(body.length>5000)throw Error('The '+key.replace(/_/g,' ')+' template must be 5,000 characters or fewer.');
      const missing=required[key].filter(token=>!body.includes('{{'+token+'}}'));if(missing.length)throw Error('The '+key.replace(/_/g,' ')+' template must include '+missing.map(token=>'{{'+token+'}}').join(', ')+'.');
      templates[key]={body};const subject=$('msg-'+key+'-subject');if(subject)templates[key].subject=subject.value;
    }
    if(button){button.disabled=true;button.textContent='Saving…';}
    const r=await api({action:'ownerSaveMessageTemplates',templates});toast(r.message||'Message templates saved.');
    try{await loadOwner();document.querySelectorAll('.tab').forEach(b=>{if(b.textContent.includes('Message Centre'))b.click();});}catch(refreshError){if(button){button.disabled=false;button.textContent='Saved ✓';}toast('Templates were saved, but the dashboard could not refresh. Use Refresh to verify the saved templates.');}
  }catch(e){toast(e.message||'Could not save message templates.');if(button){button.disabled=false;button.textContent='Save all templates';}}
}
function allocationRows(){const allocation=requireAllocation_();return allocation.qrCodes.map(q=>({qrId:q.serial,scanUrl:q.scanUrl}));}function downloadAllocationCsv(){try{downloadText('qr-allocation.csv','QR ID,Scan URL\n'+allocationRows().map(x=>[x.qrId,x.scanUrl].map(csv).join(',')).join('\n'),'text/csv');}catch(e){notifyExportError_(e);}}function downloadAllocationXlsx(){
  try{const rows=allocationRows();if(typeof XLSX==='undefined'||!XLSX.utils)throw new Error('The spreadsheet export library did not load. Refresh the page and try again.');const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(rows),'QR Allocation');XLSX.writeFile(wb,'qr-allocation.xlsx');}
  catch(e){notifyExportError_(e);}
}function xmlEsc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;')}
async function downloadAllocationDoc(){
  try{
    const rows=allocationRows();if(typeof JSZip==='undefined')throw new Error('The document export library did not load. Refresh the page and try again.');
    const paragraphs=rows.map(x=>`<w:p><w:r><w:t xml:space="preserve">${xmlEsc(x.qrId+' — '+x.scanUrl)}</w:t></w:r></w:p>`).join('');
    const doc=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${paragraphs}<w:sectPr/></w:body></w:document>`;
    const zip=new JSZip();zip.file('[Content_Types].xml','<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
    zip.folder('_rels').file('.rels','<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');zip.folder('word').file('document.xml',doc);
    saveExportBlob_(await zip.generateAsync({type:'blob'}),'qr-allocation.docx');
  }catch(e){notifyExportError_(e);}
}async function downloadAllocationSvg(){
  try{
    const allocation=requireAllocation_();if(typeof JSZip==='undefined')throw new Error('The ZIP export library did not load. Refresh the page and try again.');if(typeof qrcode!=='function')throw new Error('The SVG QR library did not load. Refresh the page and try again.');
    const zip=new JSZip();
    for(const q of allocation.qrCodes){const qr=qrcode(0,'H');qr.addData(q.scanUrl);qr.make();let svg=qr.createSvgTag(8,4);const vb=svg.match(/viewBox="0 0 (\d+) (\d+)"/);if(!vb)throw new Error('The QR library returned an invalid SVG image.');const w=Number(vb[1]),h=Number(vb[2]);svg=svg.replace(vb[0],`viewBox="0 0 ${w} ${h+42}"`).replace(/height="[^"]+"/,`height="${h+42}px"`).replace('</svg>',`<text x="${w/2}" y="${h+30}" text-anchor="middle" font-family="Arial" font-size="24" font-weight="bold">${xmlEsc(q.serial)}</text></svg>`);zip.file(String(q.serial)+'.svg',svg);}
    saveExportBlob_(await zip.generateAsync({type:'blob'}),'qr-svg-files.zip');
  }catch(e){notifyExportError_(e);}
}async function downloadAllocationPng(){
  try{
    const allocation=requireAllocation_();if(typeof JSZip==='undefined')throw new Error('The ZIP export library did not load. Refresh the page and try again.');const zip=new JSZip();
    for(const q of allocation.qrCodes){const source=await qrImageSource_('qr-'+q.qrRecordId);const canvas=drawLabeledQr_(source,q.serial,600,680,400,400,100,30,300,500,42);zip.file(String(q.serial)+'.png',await canvasToBlob_(canvas));zip.file(String(q.serial)+'.txt',q.scanUrl+'\nQR ID: '+q.serial);}
    zip.file('allocation.csv','QR ID,Scan URL\n'+allocationRows().map(x=>[x.qrId,x.scanUrl].map(csv).join(',')).join('\n'));
    saveExportBlob_(await zip.generateAsync({type:'blob'}),'qr-images-and-links.zip');return true;
  }catch(e){notifyExportError_(e);return false;}
}async function printAllocation(){
  let printWindow=null;
  try{
    const allocation=requireAllocation_();
    printWindow=window.open('','_blank');
    if(!printWindow)throw new Error('The print window was blocked. Allow pop-ups for this site, then try again.');
    const tiles=[];
    for(const q of allocation.qrCodes){
      const source=await qrImageSource_('qr-'+q.qrRecordId);let imageUrl;
      if(source.tagName==='CANVAS')imageUrl=source.toDataURL('image/png');
      else imageUrl=source.src;
      if(!imageUrl)throw new Error('A QR image is unavailable for '+q.serial+'. Refresh the allocation and try again.');
      tiles.push(`<div class="tile"><img alt="QR ${esc(q.serial)}" src="${esc(imageUrl)}"><b>${esc(q.serial)}</b></div>`);
    }
    printWindow.document.open();
    printWindow.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>QR Print Sheet</title><style>body{font-family:Arial;margin:15mm}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12mm}.tile{break-inside:avoid;text-align:center;border:1px solid #ddd;padding:7mm}.tile img{width:38mm;height:38mm;object-fit:contain}.tile b{display:block;margin-top:3mm}@page{size:A4;margin:12mm}</style></head><body><h2>QR Allocation — ${esc(allocation.reference)}</h2><div class="grid">${tiles.join('')}</div><script>window.addEventListener('load',()=>setTimeout(()=>{window.focus();window.print();},150));<\/script></body></html>`);
    printWindow.document.close();
  }catch(e){if(printWindow&&!printWindow.closed)printWindow.close();notifyExportError_(e);}
}function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
async function initDynamicQr(){const year=$('year');if(year)year.textContent=new Date().getFullYear();const page=document.body&&document.body.dataset?document.body.dataset.page:'home';try{publicConfig=await api({action:'publicConfig'});window.dqrPublicConfig=publicConfig;const support=$('supportLink');if(support){if(publicConfig.supportEmail){support.href='mailto:'+publicConfig.supportEmail;support.hidden=false;}else support.hidden=true;}const footerSupport=$('customerFooterContact');if(footerSupport){if(publicConfig.supportEmail){footerSupport.href='mailto:'+publicConfig.supportEmail;footerSupport.hidden=false;}else footerSupport.hidden=true;}if(page==='home'||page==='customer')await loadPublicContent();}catch(e){const notice=$('systemNotice');if(notice){notice.hidden=false;notice.textContent=e.message;}else console.error(e);}try{const hero=$('heroQr');if(hero&&window.QRCode)new QRCode(hero,{text:'https://example.com',width:180,height:180});}catch(e){console.warn('Hero QR preview unavailable:',e);}if(page==='admin'){showOwner();}else if(page==='customer'){showPortal();}}
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'){if(ownerExpiryAt&&Date.now()>=ownerExpiryAt&&ownerToken)showOwnerPinGate('Your owner PIN session expired. Enter your PIN again.');if(customerExpiryAt&&Date.now()>=customerExpiryAt&&customerSession)lockCustomerDashboard('Your customer session expired. Verify your email again to reopen your QR collection.');}});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initDynamicQr,{once:true});else initDynamicQr();
