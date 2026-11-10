// =============================================================================
// CUSTOMER CONNECT DESK - UNIFIED PRODUCTION BACKEND ENGINE
// File: Code.gs
// Architecture: Multi-Tenant Relational CRM & Dynamic Counter Operating System
// Security: Admin email/password, one-time recovery, shop-scoped merchant/customer sessions
// Data Engine: Google Sheets registry, central customer master, tenant visit tabs & annual archive
// =============================================================================


const DEFAULT_FALLBACK_SLUG = "memonlock";
const PUBLIC_BASE_URL = "https://ccd.dev";


function doGet(e) {
  try {
    const shopId = String((e && e.parameter && e.parameter.shop) || '').trim().toLowerCase();
    if (!shopId) {
      return createJsonResponse({
        status: 'success', found: true, isPlatformRoot: true,
        platform: 'Customer Connect Desk', version: 'Unified backend',
        message: 'Customer Connect Desk is active.'
      });
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const master = getOrCreateMasterSheet(ss);
    const found = findStoreRow(master, shopId);
    if (!found) return createJsonResponse({ status: 'error', found: false, message: 'Store not found.' });

    const status = String(found.values[11] || 'PENDING').trim().toUpperCase();
    if (status !== 'ACTIVE') return createJsonResponse({ status: 'error', found: false, message: 'Store is not active.' });

    const response = handleGetStoreConfig({ shopId: shopId, clientType: 'SHOP' });
    const result = JSON.parse(response.getContent());
    result.found = result.status === 'success' && !!result.store;
    return createJsonResponse(result);
  } catch (err) {
    try { Logger.log('CCD public config error: '+String(err&&err.message||'unknown')); } catch (logErr) {}
    return createJsonResponse({ status: 'error', found: false, message: 'Store information is temporarily unavailable.' });
  }
}

const CCD_ADMIN_LOGIN_EMAIL = 'hussainmemon2956@gmail.com';

function adminAuthVersion_() {
  return String(PropertiesService.getScriptProperties().getProperty('ADMIN_AUTH_VERSION') || '1');
}

function handleAdminAuth(data) {
  const email = String(data.email || '').trim().toLowerCase();
  const password = String(data.password || '');
  const props = PropertiesService.getScriptProperties();
  const configured = props.getProperty('ADMIN_SETUP_PASSWORD') || '';
  const cache = CacheService.getScriptCache();
  const failKey = 'ADMIN_LOGIN_FAIL_' + hashNfcValue(CCD_ADMIN_LOGIN_EMAIL);
  const failures = Number(cache.get(failKey) || 0);
  if (failures >= 5) return createJsonResponse({status:'error',message:'Too many unsuccessful login attempts. Try again in 15 minutes.'});
  if (!configured) return createJsonResponse({status:'error',message:'Admin password is not configured. Add ADMIN_SETUP_PASSWORD in Apps Script Script Properties.'});
  if (configured.length < 12) return createJsonResponse({status:'error',message:'ADMIN_SETUP_PASSWORD must contain at least 12 characters. Update it in Apps Script Script Properties.'});
  if (email !== CCD_ADMIN_LOGIN_EMAIL || !constantTimeEquals(password, configured)) {
    cache.put(failKey, String(failures + 1), 900);
    logSecurityEvent(SpreadsheetApp.getActiveSpreadsheet(),'ADMIN_LOGIN_REJECTED','',email,'SUPER_ADMIN','DENIED','Invalid Admin email or password');
    return createJsonResponse({status:'error',message:'Email or password is incorrect.'});
  }
  cache.remove(failKey);
  const now = Date.now();
  const token = createSessionToken('ADMIN_SESSION_', {
    email: CCD_ADMIN_LOGIN_EMAIL, name: 'Super Admin', role: 'SUPER_ADMIN',
    createdAt: now, authVersion: adminAuthVersion_()
  }, ADMIN_SESSION_TTL_SECONDS);
  logSecurityEvent(SpreadsheetApp.getActiveSpreadsheet(),'ADMIN_LOGIN','',CCD_ADMIN_LOGIN_EMAIL,'SUPER_ADMIN','SUCCESS','Email/password authentication');
  return createJsonResponse({status:'success',isSuperAdmin:true,email:CCD_ADMIN_LOGIN_EMAIL,name:'Super Admin',sessionToken:token,expiresIn:ADMIN_SESSION_TTL_SECONDS,maxSessionSeconds:28800});
}

function handleAdminTouchSession(data) {
  const token = String(data && data.adminToken || '');
  const admin = getAdminSession(data);
  if (!admin || !token) return createJsonResponse({status:'error',message:'Admin session expired. Sign in again.'});
  CacheService.getScriptCache().put('ADMIN_SESSION_' + token, JSON.stringify(admin), ADMIN_SESSION_TTL_SECONDS);
  return createJsonResponse({status:'success',expiresIn:ADMIN_SESSION_TTL_SECONDS});
}

function handleAdminLogout(data) {
  const token = String(data && data.adminToken || '');
  if (token) CacheService.getScriptCache().remove('ADMIN_SESSION_' + token);
  return createJsonResponse({status:'success',message:'Admin session closed.'});
}

function handleAdminRecoveryStart(data) {
  const email = String(data.email || '').trim().toLowerCase();
  if (email !== CCD_ADMIN_LOGIN_EMAIL) return createJsonResponse({status:'error',message:'Recovery could not be started for this account.'});
  const cache = CacheService.getScriptCache();
  const rateKey = 'ADMIN_RECOVERY_SEND_' + hashNfcValue(email);
  const sent = Number(cache.get(rateKey) || 0);
  if (sent >= 3) return createJsonResponse({status:'error',message:'Too many recovery codes requested. Try again in 15 minutes.'});
  const otp = makeSecureSixDigitOtp_();
  const salt = createOpaqueToken();
  cache.put('ADMIN_RECOVERY_OTP_' + hashNfcValue(email), JSON.stringify({salt:salt,hash:hashNfcValue(otp + ':' + salt),expiresAt:Date.now()+300000,attempts:0}), 300);
  cache.put(rateKey, String(sent + 1), 900);
  try {
    MailApp.sendEmail({to:email,subject:'Customer Connect Desk Admin password recovery',body:'Your CCD Admin password recovery code is '+otp+'. It expires in 5 minutes. If you did not request this, ignore this email.',htmlBody:'<p>Your CCD Admin password recovery code is:</p><p style="font-size:28px;font-weight:bold;letter-spacing:6px">'+otp+'</p><p>This code expires in 5 minutes and can be used once. If you did not request it, ignore this email.</p>'});
  } catch (err) {
    cache.remove('ADMIN_RECOVERY_OTP_' + hashNfcValue(email));
    return createJsonResponse({status:'error',message:'The recovery email could not be sent. Check Apps Script email authorization and quota.'});
  }
  logSecurityEvent(SpreadsheetApp.getActiveSpreadsheet(),'ADMIN_RECOVERY_OTP_SENT','',email,'SUPER_ADMIN','SUCCESS','Recovery OTP email accepted by MailApp');
  return createJsonResponse({status:'success',message:'A one-time recovery code has been sent to your Admin email.',expiresIn:300});
}

function handleAdminRecoveryVerify(data) {
  const email = String(data.email || '').trim().toLowerCase();
  const otp = String(data.otp || '').trim();
  const nextPassword = String(data.newPassword || '');
  if (email !== CCD_ADMIN_LOGIN_EMAIL) return createJsonResponse({status:'error',message:'Recovery could not be completed.'});
  if (nextPassword.length < 12 || nextPassword.length > 256) return createJsonResponse({status:'error',message:'Choose a new password containing at least 12 characters.'});
  const cache = CacheService.getScriptCache();
  const key = 'ADMIN_RECOVERY_OTP_' + hashNfcValue(email);
  const raw = cache.get(key);
  if (!raw) return createJsonResponse({status:'error',message:'The recovery code has expired. Request a new code.'});
  let record; try { record = JSON.parse(raw); } catch (err) { cache.remove(key); return createJsonResponse({status:'error',message:'The recovery code is invalid. Request a new one.'}); }
  if (Number(record.expiresAt || 0) <= Date.now()) { cache.remove(key); return createJsonResponse({status:'error',message:'The recovery code has expired. Request a new code.'}); }
  if (Number(record.attempts || 0) >= 5) { cache.remove(key); return createJsonResponse({status:'error',message:'Too many incorrect recovery attempts. Request a new code.'}); }
  if (!/^\d{6}$/.test(otp) || !constantTimeEquals(hashNfcValue(otp + ':' + record.salt), String(record.hash || ''))) {
    record.attempts = Number(record.attempts || 0) + 1;
    cache.put(key, JSON.stringify(record), Math.max(1, Math.ceil((Number(record.expiresAt)-Date.now())/1000)));
    return createJsonResponse({status:'error',message:'The recovery code is incorrect.'});
  }
  const props = PropertiesService.getScriptProperties();
  props.setProperty('ADMIN_SETUP_PASSWORD', nextPassword);
  props.setProperty('ADMIN_AUTH_VERSION', String(Number(adminAuthVersion_()) + 1));
  cache.remove(key);
  cache.remove('ADMIN_LOGIN_FAIL_' + hashNfcValue(email));
  logSecurityEvent(SpreadsheetApp.getActiveSpreadsheet(),'ADMIN_PASSWORD_RESET','',email,'SUPER_ADMIN','SUCCESS','Password updated through email OTP recovery; prior sessions invalidated');
  try { MailApp.sendEmail({to:email,subject:'CCD Admin password changed',body:'Your Customer Connect Desk Admin password was changed. All previous Admin sessions have been invalidated. If you did not make this change, secure your Google account and contact support.'}); } catch (err) {}
  return createJsonResponse({status:'success',message:'Admin password updated. All previous Admin sessions have been invalidated.'});
}

function handleGetAdminData(data) {
  const admin = getAdminSession(data);
  if (!admin) return createJsonResponse({ status: 'error', message: 'Admin session expired. Sign in again.' });
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const master = getOrCreateMasterSheet(ss);
  const values = master.getDataRange().getValues();
  const stores = [];
  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    const slug = String(row[0] || '').trim().toLowerCase();
    if (!slug) continue;
    const settingOpen = getStoreSetting(ss, slug, 'isOpen', null);
    const settingTime = getStoreSetting(ss, slug, 'closingTime', null);
    const status = String(row[11] || 'PENDING').trim().toUpperCase();
    const openValue = settingOpen !== null ? settingOpen : row[13];
    const isOpen = openValue !== false && String(openValue).toUpperCase() !== 'CLOSED';
    const tenant = ss.getSheetByName(slug);
    stores.push({
      shopId: slug, shopName: row[1] || '', tagline: row[2] || '', ownerName: row[3] || '', ownerEmail: row[4] || '',
      ownerMobile: String(row[5] || ''),
      primaryColor: row[6] || '#2563eb', bgColor: row[7] || '#ffffff',
      cardBg: row[8] || '#ffffff', textColor: row[9] || '#0f172a',
      reviewUrl: row[10] || '', registrationStatus: status,
      mapEmbedUrl: row[12] || '', isOpen: isOpen,
      closingTime: settingTime || row[14] || '9:00 PM',
      totalCustomers: tenant ? Math.max(0, tenant.getLastRow() - 1) : 0,
      dashboardTheme: String(getStoreSetting(ss, slug, 'dashboardTheme', 'midnight-blue') || 'midnight-blue'),
      services: getShopServiceFlags(ss,slug)
    });
  }
  return createJsonResponse({ status: 'success', isSuperAdmin: true, allStores: stores, registrationRequests:readRegistrationRequests(ss).filter(r=>r.status.toUpperCase()==='PENDING'), myStore: null });
}

function handleSetRegistrationRequestStatus(data){
 const admin=getAdminSession(data);if(!admin)return createJsonResponse({status:'error',message:'Admin session expired.'});
 const requestId=String(data.requestId||''),decision=String(data.decision||'').toUpperCase();if(!requestId||!['APPROVED','REJECTED'].includes(decision))return createJsonResponse({status:'error',message:'Valid request and decision are required.'});
 const ss=SpreadsheetApp.getActiveSpreadsheet(),sh=getOrCreateRegistrationRequestsSheet(ss),rows=sh.getDataRange().getValues();
 for(let i=1;i<rows.length;i++){if(String(rows[i][0])!==requestId)continue;if(String(rows[i][14]).toUpperCase()!=='PENDING')return createJsonResponse({status:'error',message:'This registration request is no longer pending.'});const now=new Date();
  if(decision==='REJECTED'){sh.getRange(i+1,15).setValue('REJECTED');sh.getRange(i+1,18).setValue(now);sh.getRange(i+1,19).setValue(admin.email);sh.getRange(i+1,20).setValue(now);logSecurityEvent(ss,'REGISTRATION_REQUEST_REJECTED',String(rows[i][1]),admin.email,'SUPER_ADMIN','SUCCESS','Request '+requestId);return createJsonResponse({status:'success',message:'Request marked as rejected by Admin.'});}
  const raw=String(data.approvedShopId||rows[i][1]||'').trim().toLowerCase(),slug=raw.replace(/[^a-z0-9]/g,'');if(slug.length<3)return createJsonResponse({status:'error',message:'Enter a valid approved shop ID.'});if(findStoreRow(getOrCreateMasterSheet(ss),slug))return createJsonResponse({status:'error',message:'This shop ID already exists. Enter a different approved shop ID.'});
  const master=getOrCreateMasterSheet(ss),r=[slug,rows[i][2],rows[i][3],rows[i][4],rows[i][5],rows[i][6],rows[i][7],rows[i][8],rows[i][9],rows[i][10],rows[i][11],'ACTIVE',rows[i][12],'OPEN',rows[i][13]];master.getRange(master.getLastRow()+1,1,1,r.length).setValues([r]);getOrCreateStoreSheet(ss,slug);saveInitialStoreExperience(ss,slug,data.experienceMode,data.categoryKey,admin.email);sh.getRange(i+1,15).setValue('APPROVED');sh.getRange(i+1,18).setValue(now);sh.getRange(i+1,19).setValue(admin.email);sh.getRange(i+1,20).setValue(now);sh.getRange(i+1,21).setValue(slug);invalidateStoreConfig(slug);logSecurityEvent(ss,'REGISTRATION_REQUEST_APPROVED',slug,admin.email,'SUPER_ADMIN','SUCCESS','Request '+requestId);return createJsonResponse({status:'success',shopId:slug,message:'Registration approved and shop activated.'});
 }
 return createJsonResponse({status:'error',message:'Registration request not found.'});
}
function handleSetStoreRegistrationStatus(data) {
  if (!getAdminSession(data)) return createJsonResponse({ status: 'error', message: 'Admin session expired. Sign in again.' });
  const slug = String(data.targetShopId || data.shopId || '').trim().toLowerCase();
  const status = String(data.newStatus || '').trim().toUpperCase();
  if (!slug || status!=='ACTIVE') {
    return createJsonResponse({ status: 'error', message: 'This endpoint only approves pending shops. Use the PIN-protected lifecycle controls for suspend, archive or restore.' });
  }
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const master = getOrCreateMasterSheet(ss);
  const row = findStoreRow(master, slug);
  if (!row) return createJsonResponse({ status: 'error', message: 'Store not found.' });
  const currentStatus=String(row.values[11]||'PENDING').toUpperCase();
  if(currentStatus!=='PENDING') return createJsonResponse({status:'error',message:'Only a pending shop can be approved here. Use the PIN-protected Restore action for suspended or archived shops.'});
  master.getRange(row.rowIndex, 12).setValue(status);
  if (status === 'ACTIVE') {
    getOrCreateStoreSheet(ss, slug);
    saveInitialStoreExperience(ss,slug,data.experienceMode,data.categoryKey,(getAdminSession(data)||{}).email||'SUPER_ADMIN');
  }
  invalidateStoreConfig(slug);
  return createJsonResponse({ status: 'success', message: 'Store status updated to ' + status + '.', registrationStatus: status });
}

function handleRegistrationLookup(data){
 const phone=normalizePhone(data.phone||''),email=String(data.email||'').trim().toLowerCase();if(phone.length!==10)return createJsonResponse({status:'error',message:'Enter a valid 10-digit mobile number.'});
 const cache=CacheService.getScriptCache(),key='REG_LOOKUP_'+hashNfcValue(phone);let count=Number(cache.get(key)||0);if(count>=12)return createJsonResponse({status:'error',message:'Too many lookup attempts. Please try again later.'});cache.put(key,String(count+1),3600);
 if(!email)return createJsonResponse({status:'success',nextStep:'EMAIL',message:'Now enter the email address associated with this application.'});
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return createJsonResponse({status:'error',message:'Enter a valid email address.'});
 const ss=SpreadsheetApp.getActiveSpreadsheet(),master=getOrCreateMasterSheet(ss),values=master.getDataRange().getValues();
 for(let i=1;i<values.length;i++)if(String(values[i][4]||'').trim().toLowerCase()===email&&normalizePhone(values[i][5])===phone)return createJsonResponse({status:'success',exists:true,message:'A matching registration exists. Use the original secure status link or contact CCD Admin.'});
 const req=readRegistrationRequests(ss).find(r=>r.ownerEmail.toLowerCase()===email&&normalizePhone(r.ownerMobile)===phone);if(req)return createJsonResponse({status:'success',exists:true,message:'A matching registration exists. Use the original secure status link or contact CCD Admin.'});
 return createJsonResponse({status:'success',exists:false,nextStep:'DETAILS',message:'No exact phone and email match found. Continue with your shop details.'});
}
function ensureHeaderColumn(sheet,headerName){
 const last=Math.max(1,sheet.getLastColumn()),headers=sheet.getRange(1,1,1,last).getValues()[0],found=headers.findIndex(h=>String(h||'').trim()===headerName);
 if(found>=0)return found+1;const next=last+1;sheet.getRange(1,next).setValue(headerName);return next;
}
function getOrCreateRegistrationRequestsSheet(ss){
 let sh=ss.getSheetByName('RegistrationRequests');
 if(!sh){sh=ss.insertSheet('RegistrationRequests');sh.appendRow(['RequestId','ShopIdRequested','ShopName','Tagline','OwnerName','OwnerEmail','OwnerMobile','PrimaryColor','BgColor','CardBg','TextColor','ReviewUrl','MapEmbedUrl','ClosingTime','Status','ConflictFlags','CreatedAt','UpdatedAt','ReviewedBy','ReviewedAt','ApprovedShopId','IdempotencyKey']);}
 ensureHeaderColumn(sh,'StatusTokenHash');ensureHeaderColumn(sh,'StatusTokenIssuedAt');return sh;
}
function getOrCreateStoreContentSheet(ss){
  let sh=ss.getSheetByName('StoreContent');
  if(!sh){sh=ss.insertSheet('StoreContent');sh.appendRow(['ContentId','ShopId','Scope','ContentType','ContentKey','ValueType','Value','Description','DisplayOrder','IsVisible','Language','UpdatedBy','CreatedAt','UpdatedAt']);sh.setFrozenRows(1);}
  return sh;
}
function saveInitialStoreExperience(ss,shopId,modeValue,categoryValue,actor){
  const allowedModes=['COMMUNICATION_ONLY','WEBSITE_COMMUNICATION','MENU_ONLY'];
  const allowedCategories=['general','salon','restaurant','retail','grocery','electronics','clinic','education','home-services','automotive','real-estate','organic','professional'];
  const mode=String(modeValue||'WEBSITE_COMMUNICATION').toUpperCase();
  const category=String(categoryValue||'general').toLowerCase();
  if(!allowedModes.includes(mode))throw new Error('Invalid initial store experience mode.');
  if(!allowedCategories.includes(category))throw new Error('Invalid initial store business category.');
  getOrCreateStoreContentSheet(ss);
  upsertStoreContent(ss,shopId,'experienceMode',mode,'TEXT',actor||'SUPER_ADMIN',20,true);
  upsertStoreContent(ss,shopId,'categoryKey',category,'TEXT',actor||'SUPER_ADMIN',21,true);
  upsertStoreContent(ss,shopId,'layoutStyle',category,'TEXT',actor||'SUPER_ADMIN',22,true);
}

function readRegistrationRequests(ss){const sh=ss.getSheetByName('RegistrationRequests');if(!sh||sh.getLastRow()<2)return [];const rows=sh.getDataRange().getValues(),out=[];for(let i=1;i<rows.length;i++){if(!rows[i][0])continue;out.push({requestId:String(rows[i][0]),shopId:String(rows[i][1]),shopName:String(rows[i][2]),tagline:String(rows[i][3]),ownerName:String(rows[i][4]),ownerEmail:String(rows[i][5]),ownerMobile:String(rows[i][6]),status:String(rows[i][14]||'PENDING'),conflictFlags:String(rows[i][15]||''),createdAt:rows[i][16],approvedShopId:String(rows[i][20]||'')});}return out;}
function handleRegisterStore(data) {
  const publicRequest = data.isPublicRegister === true || data.isPublicRegister === 'true';
  if (!publicRequest && !getAdminSession(data)) {
    return createJsonResponse({ status: 'error', message: 'Admin session expired. Sign in again.' });
  }
  const rawSlug = String(data.shopId || data.slug || '').trim().toLowerCase();
  const slug = rawSlug.replace(/[^a-z0-9]/g, '');
  const name = String(data.shopName || '').trim();
  const email = String(data.ownerEmail || data.email || '').trim().toLowerCase();
  const mobile = String(data.ownerMobile || data.mobile || '').replace(/\D/g, '');
  if (slug.length < 3 || !name || mobile.length !== 10 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return createJsonResponse({ status: 'error', message: 'Enter a valid store slug, business name, 10-digit mobile number and email.' });
  }
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const master = getOrCreateMasterSheet(ss);
  if(publicRequest){
    const values=master.getDataRange().getValues();
    for(let i=1;i<values.length;i++)if(String(values[i][4]||'').trim().toLowerCase()===email&&String(values[i][5]||'').replace(/\D/g,'')===mobile)return createJsonResponse({status:'success',exists:true,message:'A registration already exists for these details. Use the original secure status link or contact CCD Admin.'});
    const reqSheet=getOrCreateRegistrationRequestsSheet(ss),reqRows=reqSheet.getDataRange().getValues();
    for(let i=1;i<reqRows.length;i++){if(String(reqRows[i][5]||'').toLowerCase()===email&&String(reqRows[i][6]||'').replace(/\D/g,'')===mobile)return createJsonResponse({status:'success',exists:true,message:'A matching registration exists. Use the original secure status link or contact CCD Admin.'});}
    const conflicts=[];
    for(let i=1;i<values.length;i++){if(String(values[i][0]||'').toLowerCase()===slug)conflicts.push('SHOP_ID_EXISTS');if(String(values[i][4]||'').toLowerCase()===email)conflicts.push('EMAIL_EXISTS');if(String(values[i][5]||'').replace(/\D/g,'')===mobile)conflicts.push('MOBILE_EXISTS');if(String(values[i][1]||'').trim().toLowerCase()===name.toLowerCase())conflicts.push('SHOP_NAME_EXISTS');}
    const idem=hashNfcValue(String(data.clientRequestId||[slug,email,mobile].join('|')));
    for(let i=1;i<reqRows.length;i++)if(String(reqRows[i][21]||'')===idem)return createJsonResponse({status:'success',exists:true,message:'This submission was already received. Use the original secure status link to check its progress.'});
    const submitRateKey='REG_SUBMIT_'+hashNfcValue(email+'|'+mobile);
    const submitEmailRateKey='REG_SUBMIT_EMAIL_'+hashNfcValue(email);
    if(incrementRateCounter(submitRateKey,3600)>3||incrementRateCounter(submitEmailRateKey,3600)>5)return createJsonResponse({status:'error',message:'Too many registration submissions for these contact details. Please try again later.'});
    const requestId=Utilities.getUuid(),now=new Date(),statusToken=createOpaqueToken();
    reqSheet.appendRow([requestId,slug,name,String(data.tagline||'').trim(),String(data.ownerName||'Merchant').trim(),email,mobile,data.primaryColor||'#2563eb',data.bgColor||'#ffffff',data.cardBg||'#ffffff',data.textColor||'#0f172a',String(data.reviewUrl||'').trim(),String(data.mapEmbedUrl||'').trim(),String(data.closingTime||'9:00 PM').trim(),'PENDING',conflicts.join(','),now,now,'','', '',idem,secureHmacValue('CCD_REG_STATUS_V1|'+statusToken),now]);
    return createJsonResponse({status:'success',message:conflicts.length?'Registration request received for Admin review. Some details need verification.':'Registration request received. Admin approval is pending.',requestId:requestId,statusToken:statusToken,shopId:slug,registrationStatus:'PENDING'});
  }
  const values = master.getDataRange().getValues();
  let existingRow = -1;
  for (let i = 1; i < values.length; i++) {
    const existingSlug = String(values[i][0] || '').trim().toLowerCase();
    const existingEmail = String(values[i][4] || '').trim().toLowerCase();
    const existingMobile = String(values[i][5] || '').replace(/\D/g, '');
    if (existingSlug === slug) {
      if (existingEmail !== email) return createJsonResponse({ status: 'error', message: 'This store ID is already registered to another email.' });
      existingRow = i + 1;
      break;
    }
    if (existingEmail === email) return createJsonResponse({ status: 'error', message: 'This email is already registered to store ' + existingSlug + '.' });
    if (existingMobile && existingMobile === mobile) return createJsonResponse({ status: 'error', message: 'This mobile number is already registered.' });
  }
  const oldStatus = existingRow > 0 ? String(values[existingRow - 1][11] || 'PENDING').toUpperCase() : '';
  if (publicRequest && existingRow > 0 && oldStatus !== 'PENDING') {
    const message = oldStatus === 'ACTIVE'
      ? 'This shop is already approved. Please contact the platform Admin to update its details.'
      : 'This shop registration is ' + oldStatus.toLowerCase() + '. Please contact the platform Admin.';
    return createJsonResponse({ status: 'error', message: message, registrationStatus: oldStatus });
  }
  const status = publicRequest ? (oldStatus || 'PENDING') : 'ACTIVE';
  const rowData = [
    slug, name, String(data.tagline || '').trim(), String(data.ownerName || 'Merchant').trim(), email, mobile,
    data.primaryColor || '#2563eb', data.bgColor || '#ffffff', data.cardBg || '#ffffff', data.textColor || '#0f172a',
    String(data.reviewUrl || '').trim(), status, String(data.mapEmbedUrl || '').trim(), 'OPEN', String(data.closingTime || '9:00 PM').trim()
  ];
  let rowIndex;
  if (existingRow > 0) {
    master.getRange(existingRow, 1, 1, rowData.length).setValues([rowData]);
    rowIndex = existingRow;
  } else {
    rowIndex = master.getLastRow() + 1;
    master.getRange(rowIndex, 1, 1, rowData.length).setValues([rowData]);
  }
  if (status === 'ACTIVE') {
    getOrCreateStoreSheet(ss, slug);
    saveInitialStoreExperience(ss, slug, data.experienceMode, data.categoryKey, (getAdminSession(data) || {}).email || 'SUPER_ADMIN');
  }
  invalidateStoreConfig(slug);
  return createJsonResponse({ status: 'success', message: publicRequest ? 'Registration request saved. Admin approval is pending.' : 'Store registered successfully.', row: rowIndex, shopId: slug, registrationStatus: status });
}

function handleSaveStoreLegacy(data) {
 data.isPublicRegister = false;
 return handleRegisterStore(data);
}


function handleGetOwnerStore(data) {
  // This endpoint returns private merchant profile fields, so it is restricted
  // to an authenticated Super-Admin session rather than trusting a supplied email.
  if (!getAdminSession(data)) {
    return createJsonResponse({ status: 'error', exists: false, message: 'Admin session expired. Sign in again.' });
  }
  const email = String(data.email || '').trim().toLowerCase();
  if (!email) return createJsonResponse({ status: 'error', exists: false, message: 'Email is required.' });
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const master = getOrCreateMasterSheet(ss);
  const rows = master.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][4] || '').trim().toLowerCase() === email) {
      return createJsonResponse({ status: 'success', exists: true, store: storeFromMasterRow(ss, rows[i]) });
    }
  }
  return createJsonResponse({ status: 'success', exists: false });
}

function maskMerchantEmail_(email) {
  const value=String(email||'').trim(); const at=value.indexOf('@');
  if(at<1)return ''; const local=value.slice(0,at),domain=value.slice(at+1);
  return local.slice(0,1)+'***@'+domain;
}
function merchantOtpCacheKey_(slug){return 'CCD_MERCHANT_OTP_'+hashNfcValue(String(slug||'').toLowerCase());}
function handleMerchantOtpStart(data) {
  const slug=String(data.shopId||data.slug||'').trim().toLowerCase();
  const ss=SpreadsheetApp.getActiveSpreadsheet(),found=findStoreRow(getOrCreateMasterSheet(ss),slug);
  if(!found)return createJsonResponse({status:'error',message:'Store not found.'});
  if(String(found.values[11]||'').toUpperCase()!=='ACTIVE')return createJsonResponse({status:'error',message:'Store is not active.'});
  const email=String(found.values[4]||'').trim().toLowerCase();
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return createJsonResponse({status:'error',message:'No valid merchant email is registered for this shop. Contact CCD Admin to update the owner email.'});
  const cache=CacheService.getScriptCache(),rateKey='CCD_MERCHANT_OTP_SEND_'+hashNfcValue(slug),sent=Number(cache.get(rateKey)||0);
  if(sent>=3)return createJsonResponse({status:'error',message:'Too many OTP requests. Try again in 15 minutes.'});
  const otp=makeSecureSixDigitOtp_(),salt=createOpaqueToken();
  cache.put(merchantOtpCacheKey_(slug),JSON.stringify({email:email,salt:salt,hash:hashNfcValue(otp+':'+salt),expiresAt:Date.now()+300000,attempts:0}),300);
  cache.put(rateKey,String(sent+1),900);
  try{MailApp.sendEmail({to:email,subject:'CCD Merchant dashboard sign-in code',body:'Your one-time CCD Merchant dashboard sign-in code is '+otp+'. It expires in 5 minutes. If you did not request this code, ignore this email.',htmlBody:'<p>Your CCD Merchant dashboard sign-in code is:</p><p style="font-size:28px;font-weight:bold;letter-spacing:6px">'+otp+'</p><p>It expires in 5 minutes and can be used once.</p>'});}
  catch(err){cache.remove(merchantOtpCacheKey_(slug));return createJsonResponse({status:'error',message:'The merchant OTP email could not be sent. Check Apps Script email authorization and quota.'});}
  logSecurityEvent(ss,'MERCHANT_OTP_SENT',slug,email,'MERCHANT','SUCCESS','OTP email accepted by MailApp');
  return createJsonResponse({status:'success',maskedEmail:maskMerchantEmail_(email),expiresIn:300,message:'A six-digit sign-in code was sent to '+maskMerchantEmail_(email)+'.'});
}
function handleMerchantOtpVerify(data) {
  const slug=String(data.shopId||data.slug||'').trim().toLowerCase(),otp=String(data.otp||'').trim();
  const ss=SpreadsheetApp.getActiveSpreadsheet(),found=findStoreRow(getOrCreateMasterSheet(ss),slug);
  if(!found)return createJsonResponse({status:'error',authorized:false,message:'Store not found.'});
  if(String(found.values[11]||'').toUpperCase()!=='ACTIVE')return createJsonResponse({status:'error',authorized:false,message:'Store is not active.'});
  const email=String(found.values[4]||'').trim().toLowerCase(),cache=CacheService.getScriptCache(),key=merchantOtpCacheKey_(slug),raw=cache.get(key);
  if(!raw)return createJsonResponse({status:'error',authorized:false,message:'The sign-in code has expired. Request a new code.'});
  let record;try{record=JSON.parse(raw);}catch(err){cache.remove(key);return createJsonResponse({status:'error',authorized:false,message:'The sign-in code is invalid. Request a new code.'});}
  if(record.email!==email||Number(record.expiresAt||0)<=Date.now()){cache.remove(key);return createJsonResponse({status:'error',authorized:false,message:'The sign-in code has expired. Request a new code.'});}
  if(Number(record.attempts||0)>=5){cache.remove(key);return createJsonResponse({status:'error',authorized:false,message:'Too many incorrect code attempts. Request a new code.'});}
  if(!/^\d{6}$/.test(otp)||!constantTimeEquals(hashNfcValue(otp+':'+record.salt),String(record.hash||''))){record.attempts=Number(record.attempts||0)+1;cache.put(key,JSON.stringify(record),Math.max(1,Math.ceil((record.expiresAt-Date.now())/1000)));logSecurityEvent(ss,'MERCHANT_OTP_REJECTED',slug,email,'MERCHANT','DENIED','Incorrect OTP');return createJsonResponse({status:'error',authorized:false,message:'The sign-in code is incorrect.'});}
  cache.remove(key);cache.remove('CCD_MERCHANT_OTP_SEND_'+hashNfcValue(slug));
  const token=createSessionToken('MERCHANT_SESSION_',{shopId:slug,role:'MERCHANT',email:email,createdAt:Date.now()},MERCHANT_SESSION_TTL_SECONDS);
  logSecurityEvent(ss,'MERCHANT_LOGIN',slug,email,'MERCHANT','SUCCESS','Email OTP authentication');
  return createJsonResponse({status:'success',authorized:true,sessionToken:token,expiresIn:MERCHANT_SESSION_TTL_SECONDS,message:'Merchant email verified.'});
}

function handleMerchantTouchSession(data) {
  const token=String(data&&data.merchantToken||data&&data.sessionToken||'');
  const session=getMerchantSession(data);
  if(!session||!token)return createJsonResponse({status:'error',message:'Merchant session expired. Unlock the dashboard again.'});
  const key='MERCHANT_SESSION_'+token,raw=CacheService.getScriptCache().get(key);
  if(!raw)return createJsonResponse({status:'error',message:'Merchant session expired. Unlock the dashboard again.'});
  CacheService.getScriptCache().put(key,raw,MERCHANT_SESSION_TTL_SECONDS);
  return createJsonResponse({status:'success',expiresIn:MERCHANT_SESSION_TTL_SECONDS});
}

function handleVerifyMerchantPin(data) {
  const slug=String(data.shopId||data.slug||'').trim().toLowerCase(),pin=String(data.pin||'').trim();
  const ss=SpreadsheetApp.getActiveSpreadsheet(),found=findStoreRow(getOrCreateMasterSheet(ss),slug);
  if(!found)return createJsonResponse({status:'error',authorized:false,message:'Store not found.'});
  if(String(found.values[11]||'').toUpperCase()!=='ACTIVE')return createJsonResponse({status:'error',authorized:false,message:'Store is not active.'});
  if(!/^\d{6,12}$/.test(pin))return createJsonResponse({status:'error',authorized:false,message:'Enter your 6–12 digit merchant PIN.'});
  const cache=CacheService.getScriptCache(),key='MERCHANT_PIN_FAIL_'+hashNfcValue(slug),attempts=Number(cache.get(key)||0);
  if(attempts>=8)return createJsonResponse({status:'error',authorized:false,message:'Too many incorrect PIN attempts. Try again after 15 minutes.'});
  const storedHash=String(getStoreSetting(ss,slug,'merchantPinHash','')||''),salt=String(getStoreSetting(ss,slug,'merchantPinSalt','')||'');
  if(!storedHash){
    logSecurityEvent(ss,'MERCHANT_PIN_SETUP_REQUIRED',slug,'','MERCHANT','DENIED','Legacy last-four authentication is disabled');
    return createJsonResponse({status:'error',code:'MERCHANT_PIN_SETUP_REQUIRED',authorized:false,message:'A secure merchant PIN has not been configured. Please ask the CCD Admin to set one for this shop.'});
  }
  let valid=false,legacyHash=!salt;
  if(salt) valid=constantTimeEquals(securePinHash(pin,salt),storedHash);
  else valid=constantTimeEquals(hashNfcValue(pin),storedHash); // one-time migration of previously configured custom PINs only
  if(!valid){cache.put(key,String(attempts+1),900);logSecurityEvent(ss,'MERCHANT_PIN_REJECTED',slug,'','MERCHANT','DENIED','Incorrect merchant PIN');return createJsonResponse({status:'error',authorized:false,message:'Incorrect PIN.'});}
  if(legacyHash){const newSalt=createOpaqueToken();setStoreSetting(ss,slug,'merchantPinSalt',newSalt,'TEXT','SECURITY','SYSTEM');setStoreSetting(ss,slug,'merchantPinHash',securePinHash(pin,newSalt),'HASH','SECURITY','SYSTEM');logSecurityEvent(ss,'MERCHANT_PIN_HASH_UPGRADED',slug,'','MERCHANT','SUCCESS','Legacy configured custom PIN migrated to peppered HMAC');}
  cache.remove(key);
  const token=createSessionToken('MERCHANT_SESSION_',{shopId:slug,role:'MERCHANT',createdAt:Date.now()},MERCHANT_SESSION_TTL_SECONDS);
  return createJsonResponse({status:'success',authorized:true,sessionToken:token,expiresIn:MERCHANT_SESSION_TTL_SECONDS,message:'Merchant session verified.'});
}

function handleUpdateStoreStatus(data) {
  const session = getMerchantSession(data);
  if (!session) return createJsonResponse({ status: 'error', message: 'Merchant session expired. Unlock the dashboard again.' });
  if(!getShopServiceFlags(SpreadsheetApp.getActiveSpreadsheet(),session.shopId).websitePricingEnabled)return createJsonResponse({status:'error',message:'Shop Website service is disabled for this shop.'});
  const slug = session.shopId;
  if (data.shopId && String(data.shopId).toLowerCase() !== slug) return createJsonResponse({ status: 'error', message: 'Merchant session does not match this store.' });
  const isOpen = !(data.isOpen === false || String(data.isOpen).toUpperCase() === 'CLOSED');
  const closingTime = String(data.closingTime || '9:00 PM').trim();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const master = getOrCreateMasterSheet(ss);
  const found = findStoreRow(master, slug);
  if (!found) return createJsonResponse({ status: 'error', message: 'Store not found.' });
  // Keep the live-status values in their current legacy positions (N/O).
  master.getRange(found.rowIndex, 14, 1, 2).setValues([[isOpen ? 'OPEN' : 'CLOSED', closingTime]]);
  setStoreSetting(ss, slug, 'isOpen', isOpen, 'BOOLEAN', 'OPERATIONS', 'MERCHANT');
  setStoreSetting(ss, slug, 'closingTime', closingTime, 'TEXT', 'OPERATIONS', 'MERCHANT');
  invalidateStoreConfig(slug);
  return createJsonResponse({ status: 'success', isOpen: isOpen, closingTime: closingTime, message: 'Live store status updated.' });
}

function handleToggleLiveDeskStatusLegacy(data) {
 return handleUpdateStoreStatus(data);
}


function maskEmailAddress(email){const value=String(email||'');const at=value.indexOf('@');if(at<1)return '';const local=value.slice(0,at),domain=value.slice(at+1);return local.slice(0,1)+'***@'+domain;}
function handleCheckCustomerStatusUnified(data) {
  // Profile details are private. A phone number alone is never an authenticator.
  const email = String(data.email || '').trim().toLowerCase();
  const identity = verifyGoogleIdToken(String(data.idToken || ''));
  if (!email || !identity || identity.email !== email) {
    return createJsonResponse({ status: 'error', message: 'Verified Google sign-in is required to access a customer profile.' });
  }
  const requestedPhone = normalizePhone(data.mobile || data.phone || data.rawPhone || '');
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = getOrCreateMasterCustomersSheet(ss);
  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    const rowEmail = String(rows[i][3] || '').trim().toLowerCase();
    if (rowEmail !== identity.email) continue;
    const rowPhone = normalizePhone(rows[i][1]);
    if (requestedPhone && requestedPhone !== rowPhone) {
      return createJsonResponse({ status: 'success', exists: false, message: 'No profile is linked to this verified Google account and mobile number.' });
    }
    return createJsonResponse({ status: 'success', exists: true, customer: {
      phone: rows[i][1] || '', name: rows[i][2] || '', emailMasked: maskEmailAddress(rows[i][3]),
      hasDob: !!rows[i][4], totalVisits: Number(rows[i][6]) || 1
    }});
  }
  return createJsonResponse({ status: 'success', exists: false });
}

function handleRecordCustomerVisitUnified(data) {
  const email = String(data.email || '').trim().toLowerCase();
  const identity = verifyGoogleIdToken(String(data.idToken || ''));
  if (!identity || identity.email !== email) {
    return createJsonResponse({ status: 'error', message: 'Verified Google sign-in is required to save this customer check-in.' });
  }
  const copy = Object.assign({}, data, {
    phone: data.phone || data.mobile || data.rawPhone || '',
    actionType: 'submit'
  });
  return handleCustomerCheckin(copy);
}

function handleLogReviewOnly(data) {
  const email = String(data.email || '').trim().toLowerCase();
  const identity = verifyGoogleIdToken(String(data.idToken || ''));
  if (!identity || identity.email !== email) {
    return createJsonResponse({ status: 'error', message: 'Verified Google sign-in is required to record this visit.' });
  }
  const sheet = getOrCreateMasterCustomersSheet(SpreadsheetApp.getActiveSpreadsheet());
  const rows = sheet.getDataRange().getValues();
  let phone = '';
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][3] || '').trim().toLowerCase() === email) { phone = normalizePhone(rows[i][1]); break; }
  }
  if (phone.length !== 10) return createJsonResponse({ status: 'error', message: 'No customer profile is linked to this Google account.' });
  const copy = Object.assign({}, data, { phone: phone, visitType: 'Repeat Review Visit', actionType: 'submit', customerConfirmed: true });
  return handleCustomerCheckin(copy);
}

function findCustomerMasterRecord(ss,phone,email){
 const sheet=getOrCreateMasterCustomersSheet(ss);if(sheet.getLastRow()<2)return null;
 const rows=sheet.getDataRange().getValues();
 for(let i=1;i<rows.length;i++)if(normalizePhone(rows[i][1])===phone){
  const savedEmail=String(rows[i][3]||'').trim().toLowerCase();
  if(email&&savedEmail!==String(email).trim().toLowerCase())return null;
  return {row:rows[i],rowIndex:i+1,email:savedEmail};
 }
 return null;
}
function customerOtpCacheKey(phone,email){return 'CCD_CUSTOMER_OTP_'+hashNfcValue(normalizePhone(phone)+'|'+String(email).trim().toLowerCase());}
function makeNumericOtp(){let digits='';while(digits.length<6)digits+=Utilities.getUuid().replace(/\D/g,'');return digits.slice(0,6);}
function handleCustomerAuthStart(data){
 const phone=normalizePhone(data.phone||data.mobile||''),email=String(data.email||'').trim().toLowerCase();
 if(phone.length!==10||! /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return createJsonResponse({status:'error',message:'Enter your registered 10-digit mobile number and email address.'});
 const ss=SpreadsheetApp.getActiveSpreadsheet(),match=findCustomerMasterRecord(ss,phone,email);
 // Generic response prevents account enumeration. Send only to the email already stored on the profile.
 if(match){
  const reqKey='CUSTOMER_OTP_RATE_'+hashNfcValue(phone+'|'+email),rate=incrementRateCounter(reqKey,900);
  const emailKey='CUSTOMER_OTP_EMAIL_RATE_'+hashNfcValue(email),emailRate=incrementRateCounter(emailKey,900);
  if(rate<=3&&emailRate<=5){
   const code=makeNumericOtp(),challenge={hash:secureCustomerOtpHash(code,phone,email),createdAt:Date.now(),attempts:0};
   CacheService.getScriptCache().put(customerOtpCacheKey(phone,email),JSON.stringify(challenge),CUSTOMER_OTP_TTL_SECONDS);
   try{MailApp.sendEmail({to:email,subject:'Your Customer Connect Desk verification code',body:'Your Customer Hub verification code is '+code+'. It expires in 10 minutes. Do not share this code with anyone. If you did not request it, you can ignore this email.'});
    logSecurityEvent(ss,'CUSTOMER_OTP_SENT','',email,'CUSTOMER','SUCCESS','Customer Hub email verification code sent');
   }catch(err){CacheService.getScriptCache().remove(customerOtpCacheKey(phone,email));logSecurityEvent(ss,'CUSTOMER_OTP_SEND_FAILED','',email,'CUSTOMER','FAILED','Customer Hub verification email failed');}
  }
 }
 return createJsonResponse({status:'success',message:'If the mobile number and email match a customer profile, a verification code has been sent to the registered email address.'});
}
function getCustomerSession(data){
 const token=String(data&&data.customerToken||'');if(!token)return null;
 const raw=CacheService.getScriptCache().get('CUSTOMER_SESSION_'+token);if(!raw)return null;
 try{const session=JSON.parse(raw);if(session.role!=='CUSTOMER'||!/^\d{10}$/.test(String(session.phone||''))||!session.email)return null;return session;}catch(err){return null;}
}
function handleCustomerAuthVerify(data){
 const phone=normalizePhone(data.phone||data.mobile||''),email=String(data.email||'').trim().toLowerCase(),code=String(data.code||data.otp||'').trim();
 if(phone.length!==10||! /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||!/^[0-9]{6}$/.test(code))return createJsonResponse({status:'error',message:'Enter your mobile number, email and 6-digit verification code.'});
 const cache=CacheService.getScriptCache(),key=customerOtpCacheKey(phone,email),raw=cache.get(key);if(!raw)return createJsonResponse({status:'error',message:'Verification code expired or not found. Request a new code.'});
 let challenge;try{challenge=JSON.parse(raw);}catch(err){cache.remove(key);return createJsonResponse({status:'error',message:'Verification code expired. Request a new code.'});}
 if(Date.now()-Number(challenge.createdAt||0)>CUSTOMER_OTP_TTL_SECONDS*1000){cache.remove(key);return createJsonResponse({status:'error',message:'Verification code expired. Request a new code.'});}
 if(Number(challenge.attempts||0)>=5){cache.remove(key);return createJsonResponse({status:'error',message:'Too many incorrect codes. Request a new verification code.'});}
 if(!constantTimeEquals(secureCustomerOtpHash(code,phone,email),challenge.hash)){challenge.attempts=Number(challenge.attempts||0)+1;cache.put(key,JSON.stringify(challenge),Math.max(1,CUSTOMER_OTP_TTL_SECONDS-Math.floor((Date.now()-challenge.createdAt)/1000)));return createJsonResponse({status:'error',message:'Incorrect verification code.'});}
 const ss=SpreadsheetApp.getActiveSpreadsheet(),match=findCustomerMasterRecord(ss,phone,email);if(!match){cache.remove(key);return createJsonResponse({status:'error',message:'Customer profile is no longer available.'});}
 cache.remove(key);
 const token=createSessionToken('CUSTOMER_SESSION_',{role:'CUSTOMER',phone:phone,email:email},CUSTOMER_SESSION_TTL_SECONDS);
 logSecurityEvent(ss,'CUSTOMER_AUTH_SUCCESS','',email,'CUSTOMER','SUCCESS','Customer Hub authenticated by email OTP');
 return createJsonResponse({status:'success',customerToken:token,expiresIn:CUSTOMER_SESSION_TTL_SECONDS,message:'Customer profile verified.'});
}
function handleGetCustomerDashboardData(data) {
 const session=getCustomerSession(data);if(!session)return createJsonResponse({status:'error',code:'CUSTOMER_SESSION_EXPIRED',message:'Customer session expired. Verify your email again.'});
 const match=findCustomerMasterRecord(SpreadsheetApp.getActiveSpreadsheet(),session.phone,session.email);
 if(!match)return createJsonResponse({status:'error',message:'Customer profile not found.'});
 const row=match.row;
 return createJsonResponse({status:'success',customer:{name:row[2]||'',phone:row[1]||session.phone,email:match.email,firstShopId:row[5]||'',firstStore:row[5]||'',totalVisits:Number(row[6])||1,lastVisitTimestamp:row[7]||null,whatsAppOptIn:row[8]||'NO'}});
}

function runAnnualPreYearEndBackup() {
 const now = new Date();
 const currentYear = now.getFullYear();


 const activeSs = SpreadsheetApp.getActiveSpreadsheet();
 const ssFile = DriveApp.getFileById(activeSs.getId());


 const backupTitle = "Customer_Connect_Archive_YearEnd_" + currentYear;
 const backupFile = ssFile.makeCopy(backupTitle);


 let logSheet = activeSs.getSheetByName("System-Logs");
 if (!logSheet) {
   logSheet = activeSs.insertSheet("System-Logs");
   logSheet.appendRow(["Timestamp", "EventType", "TargetYear", "ArchiveFileId", "ArchiveUrl"]);
 }


 logSheet.appendRow([
   now,
   "ANNUAL_PRE_YEAR_END_BACKUP",
   currentYear,
   backupFile.getId(),
   backupFile.getUrl()
 ]);


 const master = getOrCreateMasterSheet(activeSs);
 const superAdminEmail = getLockedSuperAdminEmail(activeSs, master);


 if (superAdminEmail) {
   const backupTemplate=getMessageTemplateRecord(activeSs,'SYSTEM_BACKUP','EMAIL');
   if(backupTemplate){const vars={year:currentYear,backupTitle:backupTitle,backupUrl:backupFile.getUrl(),ownerName:'Super Administrator',shopName:'Customer Connect Desk'};MailApp.sendEmail({to:superAdminEmail,subject:renderMessageTemplate(backupTemplate.subject,vars),body:renderMessageTemplate(backupTemplate.body,vars)});}
 }
}


function setupDec21AnnualTrigger() {
 const triggers = ScriptApp.getProjectTriggers();
 for (let i = 0; i < triggers.length; i++) {
   if (triggers[i].getHandlerFunction() === "runAnnualPreYearEndBackup") {
     ScriptApp.deleteTrigger(triggers[i]);
   }
 }


 ScriptApp.newTrigger("runAnnualPreYearEndBackup")
   .timeBased()
   .onMonthDay(21)
   .atHour(9)
   .create();
}


function getOrCreateMasterSheet(ss) {
  let sheet = ss.getSheetByName('Master-Sheet');
  if (!sheet) {
    sheet = ss.insertSheet('Master-Sheet');
    sheet.getRange(1, 1, 1, 20).setValues([[
      'ShopId','ShopName','Tagline','OwnerName','OwnerEmail','OwnerMobile',
      'PrimaryColor','BgColor','CardBg','TextColor','ReviewUrl','RegistrationStatus',
      'MapEmbedUrl','IsOpen','ClosingTime','Reserved1','Reserved2','Reserved3','Reserved4','SUPER_ADMIN_LOCKED'
    ]]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function getOrCreateMasterCustomersSheet(ss) {
  let sheet = ss.getSheetByName('Master-Customers');
  if (!sheet) {
    sheet = ss.insertSheet('Master-Customers');
    sheet.getRange(1, 1, 1, 9).setValues([[
      'CustomerKey','Phone','Name','Email','DOB','FirstShopId','TotalVisits','LastVisitTimestamp','WhatsAppOptIn'
    ]]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function getOrCreateStoreSheet(ss, slug) {
  let sheet = ss.getSheetByName(slug);
  if (!sheet) {
    sheet = ss.insertSheet(slug);
    sheet.getRange(1, 1, 1, 12).setValues([[
      'Timestamp','Name','Email','Mobile','DOB','VisitType','WhatsAppOptIn',
      'CountryCode','FormattedPhone','FullNumber','Age','Status'
    ]]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function getLockedSuperAdminEmail(ss, master) {
 const prop = PropertiesService.getScriptProperties().getProperty("SUPER_ADMIN_EMAIL");
 if (prop) return prop.trim().toLowerCase();


 const val = master.getRange("T2").getValue();
 if (val) return val.toString().trim().toLowerCase();


 return "";
}


function setLockedSuperAdminEmail(ss, master, email) {
 const cleanEmail = email.trim().toLowerCase();
 PropertiesService.getScriptProperties().setProperty("SUPER_ADMIN_EMAIL", cleanEmail);
 master.getRange("T1").setValue("SUPER_ADMIN_LOCKED");
 master.getRange("T2").setValue(cleanEmail);
}


function createJsonResponse(obj) {
 return ContentService.createTextOutput(JSON.stringify(obj))
   .setMimeType(ContentService.MimeType.JSON);
}
function getOrCreateStoreLifecycleSheet(ss) {
  let sh = ss.getSheetByName('StoreLifecycle');
  if (!sh) { sh = ss.insertSheet('StoreLifecycle'); sh.appendRow(['ShopId','LifecycleStatus','PreviousStatus','ChangedAt','ChangedBy','Reason']); }
  return sh;
}
function handleSetShopLifecycle(data) {
  const auth = requireAdminPin(data);
  if (!auth.ok) return createJsonResponse({status:'error', message:auth.message});
  const slug = String(data.shopId || data.targetShopId || '').trim().toLowerCase();
  const operation = String(data.operation || '').trim().toUpperCase();
  if (!slug || !['SUSPEND','ARCHIVE','RESTORE'].includes(operation)) return createJsonResponse({status:'error',message:'Valid shop and lifecycle operation are required.'});
  const ss = SpreadsheetApp.getActiveSpreadsheet(), master = getOrCreateMasterSheet(ss), found = findStoreRow(master, slug);
  if (!found) return createJsonResponse({status:'error',message:'Shop not found.'});
  const current = String(found.values[11] || 'PENDING').toUpperCase();
  const sh = getOrCreateStoreLifecycleSheet(ss), rows = sh.getDataRange().getValues();
  let lifecycleRow = -1;
  for (let i=rows.length-1;i>=1;i--) if (String(rows[i][0]).toLowerCase()===slug) { lifecycleRow=i+1; break; }
  let next = current, previous = current, reason = String(data.reason || '').slice(0,500);
  if (operation === 'SUSPEND') { if (current === 'ARCHIVED') return createJsonResponse({status:'error',message:'Archived shop must be restored before suspension.'}); next='SUSPENDED'; }
  if (operation === 'ARCHIVE') { if (current === 'ARCHIVED') return createJsonResponse({status:'success',message:'Shop is already archived.',registrationStatus:'ARCHIVED'}); next='ARCHIVED'; }
  if (operation === 'RESTORE') {
    if (current !== 'ARCHIVED' && current !== 'SUSPENDED' && current !== 'CANCELLED') return createJsonResponse({status:'error',message:'Shop is not suspended or archived.'});
    let restoreTo = 'ACTIVE';
    if (current === 'ARCHIVED' && lifecycleRow > 0) restoreTo = String(rows[lifecycleRow-1][2] || 'ACTIVE').toUpperCase();
    else if (current === 'SUSPENDED') { for(let j=rows.length-1;j>=1;j--) if(String(rows[j][0]).toLowerCase()===slug && String(rows[j][1]).toUpperCase()==='SUSPEND'){restoreTo=String(rows[j][2]||'ACTIVE').toUpperCase();break;} }
    if (!['ACTIVE','PENDING','SUSPENDED'].includes(restoreTo)) restoreTo='ACTIVE';
    next = restoreTo;
  }
  if (operation === 'ARCHIVE') previous = current;
  else if (operation === 'SUSPEND') previous = current === 'SUSPENDED' ? (lifecycleRow>0?String(rows[lifecycleRow-1][2]||'ACTIVE'):'ACTIVE') : current;
  else previous = next;
  master.getRange(found.rowIndex,12).setValue(next);
  const logRow=[slug,operation==='RESTORE'?'RESTORED':operation,operation==='RESTORE'?current:previous,new Date(),getAdminSession(data).email,reason];
  if (lifecycleRow>0) sh.appendRow(logRow); else sh.appendRow(logRow);
  invalidateStoreConfig(slug);
  logSecurityEvent(ss,'SHOP_'+operation,slug,getAdminSession(data).email,'SUPER_ADMIN','SUCCESS',reason);
  return createJsonResponse({status:'success',shopId:slug,registrationStatus:next,message:operation==='ARCHIVE'?'Shop archived. Data and history are preserved; it can be restored later.':operation==='SUSPEND'?'Shop suspended. Data is preserved.':'Shop restored.'});
}
function handleDeleteStore(data) {
  data.operation = 'ARCHIVE';
  return handleSetShopLifecycle(data);
}
function handleSetMerchantAccessPin(data){
 const auth=requireAdminPin(data);if(!auth.ok)return createJsonResponse({status:'error',message:auth.message});
 const slug=String(data.shopId||'').trim().toLowerCase(),pin=String(data.merchantPin||'').trim();
 if(!slug||!/^[0-9]{6,12}$/.test(pin))return createJsonResponse({status:'error',message:'Set a 6–12 digit numeric merchant PIN.'});
 const ss=SpreadsheetApp.getActiveSpreadsheet();if(!findStoreRow(getOrCreateMasterSheet(ss),slug))return createJsonResponse({status:'error',message:'Shop not found.'});
 const salt=createOpaqueToken();setStoreSetting(ss,slug,'merchantPinSalt',salt,'TEXT','SECURITY',auth.admin.email);setStoreSetting(ss,slug,'merchantPinHash',securePinHash(pin,salt),'HASH','SECURITY',auth.admin.email);
 logSecurityEvent(ss,'MERCHANT_PIN_CHANGED',slug,auth.admin.email,'SUPER_ADMIN','SUCCESS','Salted HMAC merchant PIN configured');
 return createJsonResponse({status:'success',message:'Secure merchant PIN updated. The previous phone-number PIN is no longer accepted.'});
}
function handleSetShopDashboardTheme(data) {
  const auth = requireAdminPin(data);
  if (!auth.ok) return createJsonResponse({status:'error',message:auth.message});
  const slug=String(data.shopId||'').trim().toLowerCase(), theme=String(data.themeId||'').trim();
  const allowed=['midnight-blue','obsidian-cyan','slate-indigo','graphite-blue','navy-ice','carbon-electric','royal-night','ocean-dark','deep-space','steel-blue','arctic-light','cloud-blue','pearl-indigo','frost-cyan','minimal-slate','white-blue','soft-lavender','emerald-night','teal-studio','mono-pro'];
  if(!slug || !allowed.includes(theme)) return createJsonResponse({status:'error',message:'Select a valid dashboard theme and shop.'});
  const ss=SpreadsheetApp.getActiveSpreadsheet(), master=getOrCreateMasterSheet(ss);
  if(!findStoreRow(master,slug)) return createJsonResponse({status:'error',message:'Shop not found.'});
  setStoreSetting(ss,slug,'dashboardTheme',theme,'TEXT','DASHBOARD_THEME',getAdminSession(data).email);
  invalidateStoreConfig(slug);logSecurityEvent(ss,'SHOP_DASHBOARD_THEME_CHANGED',slug,getAdminSession(data).email,'SUPER_ADMIN','SUCCESS',theme);
  return createJsonResponse({status:'success',shopId:slug,themeId:theme,message:'Shopkeeper dashboard theme saved.'});
}

function getOrCreateCustomerProfilesSheet(ss){let sh=ss.getSheetByName('CustomerProfiles');if(!sh){sh=ss.insertSheet('CustomerProfiles');sh.appendRow(['CustomerKey','Phone','Name','Email','DOB','FirstShopId','TotalVisits','LastVisitTimestamp','WhatsAppOptIn','EmailOptIn','CreatedAt','UpdatedAt','ProfileStatus','PreferredLanguage','DataSource']);}return sh;}
function getCustomerEmailOptIn(ss,phone){const sh=ss.getSheetByName('CustomerProfiles');if(!sh||sh.getLastRow()<2)return 'NO';const rows=sh.getDataRange().getValues();for(let i=1;i<rows.length;i++)if(normalizePhone(rows[i][1])===phone)return String(rows[i][9]||'NO').toUpperCase()==='YES'?'YES':'NO';return 'NO';}
function upsertCustomerProfile(ss,profile){const sh=getOrCreateCustomerProfilesSheet(ss),rows=sh.getDataRange().getValues();let row=-1,createdAt=new Date();for(let i=1;i<rows.length;i++)if(normalizePhone(rows[i][1])===normalizePhone(profile.phone)){row=i+1;createdAt=rows[i][10]||createdAt;break;}const now=new Date(),values=[profile.customerKey,profile.phone,profile.name,profile.email,profile.dob,profile.firstShopId,profile.totalVisits,now,profile.whatsAppOptIn,profile.emailOptIn,createdAt,now,'ACTIVE','en','DESK'];if(row>0)sh.getRange(row,1,1,values.length).setValues([values]);else sh.appendRow(values);}
function handleCustomerCheckin(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const slug = String(data.shopId || '').trim().toLowerCase();
  const phone = normalizePhone(data.phone || data.mobile || '');
  if (!slug || phone.length !== 10) return createJsonResponse({ status: 'error', message: 'Valid store ID and 10-digit mobile number are required.' });

  const master = getOrCreateMasterSheet(ss);
  const storeRow = findStoreRow(master, slug);
  if (!storeRow || String(storeRow.values[11] || '').toUpperCase() !== 'ACTIVE') {
    return createJsonResponse({ status: 'error', message: 'Store not found or not active.' });
  }
  if(!getShopServiceFlags(ss,slug).customerConnectEnabled) return createJsonResponse({status:'error',message:'Customer Connect service is disabled for this shop.'});
  const store = storeFromMasterRow(ss, storeRow.values);
  const cache = CacheService.getScriptCache();
  const cacheKey = 'CUST_' + phone;
  const customerSheet = getOrCreateMasterCustomersSheet(ss);
  let customer = getCachedCustomer(phone);
  let customerRow = customer && customer.rowIndex ? Number(customer.rowIndex) : -1;
  // CacheService can outlive a manual row sort or deletion. Validate the cached
  // row's phone before trusting its row index so another customer's record is
  // never overwritten by a stale cache entry.
  if (customer && customerRow >= 2) {
    const cachedRowPhone = normalizePhone(customerSheet.getRange(customerRow, 2).getValue());
    if (cachedRowPhone !== phone) { customer = null; customerRow = -1; }
  }

  if (!customer || customerRow < 2) {
    customer = null;
    customerRow = -1;
    const rows = customerSheet.getDataRange().getValues();
    for (let i = 1; i < rows.length; i++) {
      if (normalizePhone(rows[i][1]) === phone) {
        customerRow = i + 1;
        customer = {
          customerKey: rows[i][0], phone: rows[i][1], name: rows[i][2], email: rows[i][3], dob: rows[i][4],
          firstShopId: rows[i][5], totalVisits: Number(rows[i][6]) || 1,
          whatsAppOptIn: String(rows[i][8] || 'NO').toUpperCase(), rowIndex: customerRow
        };
        break;
      }
    }
  }

  if (customer) customer.emailOptIn = getCustomerEmailOptIn(ss,phone);
  if (String(data.actionType || '').toLowerCase() === 'lookup') {
    const lookupRateKey='DESK_LOOKUP_'+hashNfcValue(slug+'|'+phone);
    if(incrementRateCounter(lookupRateKey,600)>12)return createJsonResponse({status:'error',message:'Too many lookup attempts for this number. Please wait a few minutes or ask the shop staff for help.'});
    if (customer) setCachedCustomer(phone, customer);
    // A public phone-only lookup must not disclose the customer's name, email,
    // birthday, visit totals or communication preferences.
    const safeCustomer=customer?{requiresNameConfirmation:true}:{};
    return createJsonResponse({ status: 'success', exists: !!customer, customer: safeCustomer, store: filterStoreConfigForClient(store,'DESK') });
  }

  // A public walk-in desk may record a return visit, but it must not reveal
  // stored profile data. Require the customer to re-enter the saved name and
  // explicitly confirm; identity changes remain locked to verified flows.
  const submittedName=String(data.name||'').trim();
  if (customer) {
    const confirmed=(data.customerConfirmed === true || String(data.customerConfirmed).toLowerCase() === 'true');
    const canonicalSaved=String(customer.name||'').replace(/\s+/g,' ').trim().toLowerCase();
    const canonicalSubmitted=submittedName.replace(/\s+/g,' ').trim().toLowerCase();
    if(!confirmed||!canonicalSubmitted||!constantTimeEquals(canonicalSaved,canonicalSubmitted))return createJsonResponse({status:'error',message:'The details could not be confirmed. Check the name you entered or ask the shop staff for help.'});
  }

  const requestId = String(data.requestId || '').trim().slice(0, 120);
  const auditSheet = ss.getSheetByName('AuditLog');
  if (requestId && auditSheet && auditSheet.getLastRow() > 1) {
    const requestRange = auditSheet.getRange(2, 12, auditSheet.getLastRow() - 1, 1);
    const duplicateRequest = requestRange.createTextFinder(requestId).matchEntireCell(true).findNext();
    if (duplicateRequest) {
      const savedVisits = customer ? Number(customer.totalVisits) || 1 : 1;
      return createJsonResponse({ status: 'success', duplicate: true, message: 'Your check-in has already been saved.', totalVisits: savedVisits, store: filterStoreConfigForClient(store,'DESK') });
    }
  }

  // Retain a short duplicate guard for older clients that do not send a request ID.
  const requestKey = 'VISIT_' + slug + '_' + phone;
  if (!requestId) {
    const prior = cache.get(requestKey);
    if (prior) {
      let saved; try { saved = JSON.parse(prior); } catch (err) { saved = null; }
      if (saved) return createJsonResponse({ status: 'success', duplicate: true, message: 'This check-in was already recorded.', totalVisits: saved.totalVisits, store: filterStoreConfigForClient(store,'DESK') });
    }
  }

  // Returning customer identity is immutable through the public Desk endpoint.
  // Changes require a separately verified customer-authentication flow.
  const name = String((customer && customer.name) || submittedName || '').trim();
  const email = String((customer && customer.email) || data.email || '').trim().toLowerCase();
  const dob = String((customer && customer.dob) || data.dob || '').trim();
  if (!name) return createJsonResponse({ status: 'error', message: 'Customer name is required.' });
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return createJsonResponse({ status: 'error', message: 'Enter a valid email address.' });
  const visitType = String(data.visitType || 'General Visit').trim();
  const hasNewWhatsAppChoice = Object.prototype.hasOwnProperty.call(data, 'whatsappOptIn') && data.whatsappOptIn !== undefined && data.whatsappOptIn !== null;
  const optIn = hasNewWhatsAppChoice
    ? (data.whatsappOptIn === true || String(data.whatsappOptIn).toUpperCase() === 'YES' ? 'YES' : 'NO')
    : (customer && String(customer.whatsAppOptIn || 'NO').toUpperCase() === 'YES' ? 'YES' : 'NO');
  const hasNewEmailChoice=Object.prototype.hasOwnProperty.call(data,'emailOptIn') && data.emailOptIn!==undefined && data.emailOptIn!==null;
  const emailOptIn=email?(hasNewEmailChoice?(data.emailOptIn===true||String(data.emailOptIn).toUpperCase()==='YES'?'YES':'NO'):(customer&&String(customer.emailOptIn||'NO').toUpperCase()==='YES'?'YES':'NO')):'NO';
  const countryCode = String(data.countryCode || '+91').trim();
  const formattedPhone = countryCode + ' ' + phone;
  const fullPhone = countryCode + phone;
  const age = data.age || (dob && /^\d{4}/.test(dob) ? new Date().getFullYear() - Number(dob.slice(0, 4)) : '');
  const now = new Date();
  let totalVisits;
  let isNew = !customer;

  if (customerRow > 0) {
    totalVisits = Math.max(1, Number(customer.totalVisits) || 1) + 1;
    customerSheet.getRange(customerRow, 7, 1, 3).setValues([[totalVisits, now, optIn]]);
  } else {
    totalVisits = 1;
    customerRow = customerSheet.getLastRow() + 1;
    customerSheet.getRange(customerRow, 1, 1, 9).setValues([['IN:' + phone, phone, name, email, dob, slug, totalVisits, now, optIn]]);
  }

  const tenant = getOrCreateStoreSheet(ss, slug);
  tenant.appendRow([now, name, email, phone, dob, visitType, optIn, countryCode, formattedPhone, fullPhone, age, 'PROCESSED']);

  // The existing central Visits tab records activity across every participating shop.
  // Preserve the exact CustomerKey already stored in Master-Customers for legacy profiles.
  const centralVisits = ss.getSheetByName('Visits');
  const visitId = Utilities.getUuid();
  const storedCustomerKey = customer && customer.customerKey ? customer.customerKey : (customerRow > 0 ? customerSheet.getRange(customerRow, 1).getValue() : '');
  const customerKey = storedCustomerKey || ('IN:' + phone);
  upsertCustomerProfile(ss,{customerKey:customerKey,phone:phone,name:name,email:email,dob:dob,firstShopId:customer&&customer.firstShopId?customer.firstShopId:slug,totalVisits:totalVisits,whatsAppOptIn:optIn,emailOptIn:emailOptIn});
  if (centralVisits) {
    centralVisits.appendRow([visitId, slug, customerKey, now, name, email, phone, dob, visitType, optIn, countryCode, formattedPhone, age, 'PROCESSED', 'desk.html', now]);
  }

  // Store request identity in the existing AuditLog.RequestReference field for retry safety.
  if (auditSheet && requestId) {
    auditSheet.appendRow([Utilities.getUuid(), 'CUSTOMER', phone, slug, 'CUSTOMER_CHECKIN', 'VISIT', visitId, '', JSON.stringify({ totalVisits: totalVisits }), now, 'desk.html', requestId]);
  }

  const updated = { customerKey: customerKey, phone: phone, name: name, email: email, dob: dob, totalVisits: totalVisits, rowIndex: customerRow, whatsAppOptIn: optIn, emailOptIn: emailOptIn, firstShopId: customer && customer.firstShopId ? customer.firstShopId : slug };
  setCachedCustomer(phone, updated);
  if (!requestId) cache.put(requestKey, JSON.stringify({ totalVisits: totalVisits }), 60);

  let emailSent = false;
  if (email && emailOptIn === 'YES') {
    const template=getMessageTemplateRecord(ss,'CUSTOMER_VISIT','EMAIL');
    const commLog=getOrCreateCommunicationsLogSheet(ss),commId=Utilities.getUuid(),commNow=new Date();
    const vars={customerName:name,customerEmail:email,customerMobile:phone,shopName:store.shopName||slug,shopId:slug,shopUrl:'https://'+slug+'.ccd.dev/',totalVisits:totalVisits,visitDate:now};
    try {
      if(!template) throw new Error('Customer visit email template is disabled or missing.');
      MailApp.sendEmail({to:email,subject:renderMessageTemplate(template.subject,vars),body:renderMessageTemplate(template.body,vars)});
      emailSent=true;
      commLog.appendRow([commId,slug,customerKey,visitId,'EMAIL','CUSTOMER_VISIT_CONFIRMATION',email,'YES',commNow, 'CUSTOMER_VISIT','SENT','',commNow,commNow,'','','','',1,commNow]);
    } catch (mailError) {
      Logger.log('Customer confirmation email was not sent: '+mailError.message);
      try{commLog.appendRow([commId,slug,customerKey,visitId,'EMAIL','CUSTOMER_VISIT_CONFIRMATION',email,'YES',commNow, 'CUSTOMER_VISIT','FAILED','',commNow,'','','','MAIL_SEND_ERROR',String(mailError.message||mailError),1,commNow]);}catch(logError){Logger.log('Customer email failure log could not be saved: '+logError.message);}
    }
  } else if(email && emailOptIn !== 'YES') {
    try{getOrCreateCommunicationsLogSheet(ss).appendRow([Utilities.getUuid(),slug,customerKey,visitId,'EMAIL','CUSTOMER_VISIT_CONFIRMATION',email,'NO','', 'CUSTOMER_VISIT','SKIPPED_CONSENT','',new Date(),'','','','','',0,new Date()]);}catch(logError){Logger.log('Could not log skipped email: '+logError.message);}
  }

  return createJsonResponse({
    status: 'success', isNew: isNew, totalVisits: totalVisits, store: filterStoreConfigForClient(store,'DESK'),
    message: 'Your details are in our system and your visit has been recorded successfully.',
    emailSent: emailSent, emailOptIn:emailOptIn
  });
}

function handleUpdateCoupon(data) {
  return handleUpdateMerchantPromo(data);
}

function handleGetMerchantData(data) {
  const session = getMerchantSession(data);
  if (!session) return createJsonResponse({ status: 'error', message: 'Merchant session expired. Unlock the dashboard again.' });
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(session.shopId);
  const customers = [];
  let totalVisits = 0;
  let uniqueCustomers = 0;
  if (sheet && sheet.getLastRow() > 1) {
    const lastRow = sheet.getLastRow();
    totalVisits = lastRow - 1;
    const phones = sheet.getRange(2, 4, totalVisits, 1).getValues();
    uniqueCustomers = new Set(phones.map(row => normalizePhone(row[0])).filter(Boolean)).size;
    const rowCount = Math.min(200, totalVisits);
    const startRow = lastRow - rowCount + 1;
    const rows = sheet.getRange(startRow, 1, rowCount, Math.min(12, sheet.getLastColumn())).getValues();
    for (let i = 0; i < rows.length; i++) customers.push({
      timestamp: rows[i][0], name: rows[i][1], email: rows[i][2], phone: rows[i][3], dob: rows[i][4],
      visitType: rows[i][5], whatsappOptIn: rows[i][6], countryCode: rows[i][7],
      formattedPhone: rows[i][8], fullNumber: rows[i][9], age: rows[i][10], status: rows[i][11]
    });
  }
  const serviceFlags=getShopServiceFlags(ss,session.shopId);
  if(!serviceFlags.customerConnectEnabled){customers.length=0;totalVisits=0;uniqueCustomers=0;}
  const approvalSheet=ss.getSheetByName('ApprovalRequests'), approvals=[];
  if(serviceFlags.customerConnectEnabled&&approvalSheet&&approvalSheet.getLastRow()>1){const ar=approvalSheet.getDataRange().getValues(),now=Date.now();for(let i=ar.length-1;i>=1&&approvals.length<30;i--){if(String(ar[i][1]).toLowerCase()!==session.shopId||String(ar[i][9]).toUpperCase()!=='PENDING')continue;const exp=new Date(ar[i][8]).getTime();if(!exp||exp<=now)continue;approvals.push({requestId:String(ar[i][0]),customerName:String(ar[i][3]||'Customer'),mobile:String(ar[i][4]||''),createdAt:ar[i][7],expiresAt:ar[i][8],remainingMs:Math.max(0,exp-now)});}}
  const commSheet=ss.getSheetByName('CommunicationsLog'),communications=[];if(serviceFlags.customerConnectEnabled&&commSheet&&commSheet.getLastRow()>1){const cr=commSheet.getDataRange().getValues();for(let i=cr.length-1;i>=1&&communications.length<50;i--)if(String(cr[i][1]).toLowerCase()===session.shopId)communications.push({channel:String(cr[i][4]),type:String(cr[i][5]),recipient:String(cr[i][6]),templateKey:String(cr[i][9]),status:String(cr[i][10]),sentAt:cr[i][13]||cr[i][12],error:String(cr[i][17]||'')});}
  const customerWhatsAppTemplate=getMessageTemplateRecord(ss,'CUSTOMER_VISIT','WHATSAPP');
  const content = readStoreContent(ss, session.shopId, true);
  const pricingVisibility = (() => {
    const contentSheet = ss.getSheetByName('StoreContent');
    if (!contentSheet || contentSheet.getLastRow() < 2) return true;
    const values = contentSheet.getDataRange().getValues();
    for (let i = values.length - 1; i >= 1; i--) {
      if (String(values[i][1] || '').trim().toLowerCase() === session.shopId && String(values[i][4] || '').trim() === 'pricing') {
        return String(values[i][9]).toLowerCase() !== 'false';
      }
    }
    return true;
  })();
  return createJsonResponse({ status: 'success', customers: customers, totalVisits: totalVisits, uniqueCustomers: uniqueCustomers, pricing: serviceFlags.websitePricingEnabled ? (content.pricing || []) : [], pricingVisible: serviceFlags.websitePricingEnabled && pricingVisibility, services:serviceFlags, approvalRequests:approvals, communications:communications, customerWhatsAppTemplate:customerWhatsAppTemplate, dashboardTheme: String(getStoreSetting(ss, session.shopId, 'dashboardTheme', 'midnight-blue') || 'midnight-blue') });
}

function getCachedStoreConfig(shopId) {
  const raw = CacheService.getScriptCache().get('STORE_' + String(shopId).toLowerCase());
  if (!raw) return null;
  try { return JSON.parse(raw); } catch (err) { return null; }
}

function setCachedStoreConfig(shopId, config) {
  CacheService.getScriptCache().put('STORE_' + String(shopId).toLowerCase(), JSON.stringify(config), CACHE_TTL_SECONDS);
}

function getCachedCustomer(phone) {
  const cache = CacheService.getScriptCache();
  const cached = cache.get('CUST_' + phone);
  if (!cached) return null;
  try { return JSON.parse(cached); } catch (err) { cache.remove('CUST_' + phone); return null; }
}


function setCachedCustomer(phone, customerData) {
 const cache = CacheService.getScriptCache();
 cache.put("CUST_" + phone, JSON.stringify(customerData), CACHE_TTL_SECONDS);
}


function invalidateStoreConfig(shopId) {
  const id = String(shopId || '').trim().toLowerCase();
  if (!id) return;
  const cache = CacheService.getScriptCache();
  cache.remove('STORE_' + id);
  cache.remove('store_config_' + id);
  cache.remove('shop_' + id);
  cache.remove('SEO_PUBLIC_' + id);
}

function getOrCreateShopServicesSheet(ss) {
  let sh=ss.getSheetByName('ShopServices');
  if(!sh){sh=ss.insertSheet('ShopServices');sh.appendRow(['ShopServiceId','ShopId','CustomerConnectEnabled','WebsitePricingEnabled','CreatedByUserId','CreatedAt','UpdatedByUserId','UpdatedByName','UpdatedAt','EnabledAt','DisabledAt','AdminNotes']);}
  return sh;
}
function getShopServiceFlags(ss,shopId) {
  const sh=ss.getSheetByName('ShopServices');
  if(!sh||sh.getLastRow()<2) return {customerConnectEnabled:false,websitePricingEnabled:false,configured:false};
  const rows=sh.getDataRange().getValues();
  for(let i=rows.length-1;i>=1;i--) if(String(rows[i][1]||'').toLowerCase()===String(shopId).toLowerCase()) return {customerConnectEnabled:rows[i][2]===true||String(rows[i][2]).toLowerCase()==='true',websitePricingEnabled:rows[i][3]===true||String(rows[i][3]).toLowerCase()==='true',configured:true};
  return {customerConnectEnabled:false,websitePricingEnabled:false,configured:false};
}
function handleSetShopServices(data) {
  const auth=requireAdminPin(data); if(!auth.ok)return createJsonResponse({status:'error',message:auth.message});
  const slug=String(data.shopId||'').trim().toLowerCase(); if(!slug)return createJsonResponse({status:'error',message:'Shop is required.'});
  const ss=SpreadsheetApp.getActiveSpreadsheet(), master=getOrCreateMasterSheet(ss), found=findStoreRow(master,slug); if(!found)return createJsonResponse({status:'error',message:'Shop not found.'});
  const sh=getOrCreateShopServicesSheet(ss), rows=sh.getDataRange().getValues(); let row=-1;
  for(let i=rows.length-1;i>=1;i--)if(String(rows[i][1]||'').toLowerCase()===slug){row=i+1;break;}
  const cc=data.customerConnectEnabled===true||String(data.customerConnectEnabled).toLowerCase()==='true';
  const wp=data.websitePricingEnabled===true||String(data.websitePricingEnabled).toLowerCase()==='true';
  const now=new Date(), admin=getAdminSession(data), values=[row>0?rows[row-1][0]:Utilities.getUuid(),slug,cc,wp,row>0?rows[row-1][4]||admin.email:admin.email,row>0?rows[row-1][5]||now:now,admin.email,admin.name||admin.email,now,(cc||wp)?now:'',(!cc&&!wp)?now:'',String(data.adminNotes||'').slice(0,500)];
  if(row>0)sh.getRange(row,1,1,values.length).setValues([values]);else sh.appendRow(values);
  invalidateStoreConfig(slug);logSecurityEvent(ss,'SHOP_SERVICES_CHANGED',slug,admin.email,'SUPER_ADMIN','SUCCESS',JSON.stringify({customerConnectEnabled:cc,websitePricingEnabled:wp}));
  return createJsonResponse({status:'success',shopId:slug,customerConnectEnabled:cc,websitePricingEnabled:wp,message:'Shop service permissions updated.'});
}

function filterStoreConfigForClient(store,clientType){
 if(clientType==='DESK'){const keys=['shopId','shopName','primaryColor','bgColor','cardBg','textColor','reviewUrl','mapEmbedUrl','isOpen','closingTime'];const safe={};keys.forEach(k=>{if(store[k]!==undefined)safe[k]=store[k];});return safe;}
 if(clientType==='MERCHANT_BOOTSTRAP' && !(store.services&&store.services.websitePricingEnabled)){const keys=['shopId','shopName','primaryColor','bgColor','cardBg','textColor','dashboardTheme','services'];const safe={};keys.forEach(k=>{if(store[k]!==undefined)safe[k]=store[k];});return safe;}
 if(clientType==='MERCHANT')return store;
 const safe=Object.assign({},store);delete safe.ownerEmail;delete safe.ownerName;return safe;
}

function handleGetStoreConfig(data) {
  const slug = String(data.shopId || data.slug || DEFAULT_FALLBACK_SLUG).trim().toLowerCase();
  if (!/^[a-z0-9_-]{3,50}$/.test(slug)) return createJsonResponse({ status: 'error', message: 'Invalid store ID.' });
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const master = getOrCreateMasterSheet(ss);
  const found = findStoreRow(master, slug);
  if (!found) return createJsonResponse({ status: 'error', message: 'Store not found.' });
  const row = found.values;
  const status = String(row[11] || 'PENDING').trim().toUpperCase();
  if (status !== 'ACTIVE') return createJsonResponse({ status: 'error', message: 'This store is not currently active.' });
  const serviceFlags=getShopServiceFlags(ss,slug);
  const clientType=String(data.clientType||'').toUpperCase();
  if(clientType==='DESK' && !serviceFlags.customerConnectEnabled) return createJsonResponse({status:'error',message:'Customer Connect service is disabled for this shop.'});
  if(clientType==='MERCHANT' && (!getMerchantSession(data)||getMerchantSession(data).shopId!==slug)) return createJsonResponse({status:'error',message:'A valid shopkeeper session is required.'});
  if(clientType==='MERCHANT' && !serviceFlags.websitePricingEnabled) return createJsonResponse({status:'error',message:'Shop Website service is disabled for this shop.'});
  if((clientType==='MERCHANT'||clientType==='MERCHANT_BOOTSTRAP') && !serviceFlags.customerConnectEnabled && !serviceFlags.websitePricingEnabled) return createJsonResponse({status:'error',message:'Both shop services are currently disabled.'});
  if(clientType!=='MERCHANT' && clientType!=='MERCHANT_BOOTSTRAP' && clientType!=='DESK' && !serviceFlags.websitePricingEnabled) return createJsonResponse({status:'error',message:'Shop Website service is disabled for this shop.'});
  const cached = getCachedStoreConfig(slug);
  if (cached) return createJsonResponse({ status: 'success', store: filterStoreConfigForClient(cached,clientType) });
  const store = storeFromMasterRow(ss, row);
  const content = readStoreContent(ss, slug, false);
  Object.keys(content).forEach(k => { store[k] = content[k]; });
  const visibleContent = {};
  const contentSheet = ss.getSheetByName('StoreContent');
  if (contentSheet && contentSheet.getLastRow() > 1) {
    const contentRows = contentSheet.getDataRange().getValues();
    for (let i = 1; i < contentRows.length; i++) {
      if (String(contentRows[i][1] || '').trim().toLowerCase() === slug) {
        const key = String(contentRows[i][4] || '').trim();
        if (key) visibleContent[key] = String(contentRows[i][9]).toLowerCase() !== 'false';
      }
    }
  }
  store.contentVisibility = {
    homeText: visibleContent.homeText === true,
    aboutText: visibleContent.aboutText === true,
    services: visibleContent.services === true,
    pricing: visibleContent.pricing === true,
    blog: visibleContent.blog === true,
    contact: getStoreSetting(ss, slug, 'contactVisible', true) !== false && String(getStoreSetting(ss, slug, 'contactVisible', true)).toLowerCase() !== 'false'
  };
  const isOpenSetting = getStoreSetting(ss, slug, 'isOpen', null);
  const closingSetting = getStoreSetting(ss, slug, 'closingTime', null);
  const openValue = isOpenSetting !== null ? isOpenSetting : row[13];
  store.isOpen = openValue !== false && String(openValue).toUpperCase() !== 'CLOSED';
  store.closingTime = closingSetting || row[14] || '9:00 PM';
  store.promoEnabled = getStoreSetting(ss, slug, 'promoEnabled', false) === true || String(getStoreSetting(ss, slug, 'promoEnabled', false)).toLowerCase() === 'true';
  store.promoHeadline = getStoreSetting(ss, slug, 'promoHeadline', '');
  store.promoCode = getStoreSetting(ss, slug, 'promoCode', '');
  store.promoDescription = getStoreSetting(ss, slug, 'promoDescription', '');
  store.redirectUrl = getStoreSetting(ss, slug, 'redirectUrl', '');
  store.dashboardTheme = String(getStoreSetting(ss, slug, 'dashboardTheme', 'midnight-blue') || 'midnight-blue');
  store.services = getShopServiceFlags(ss,slug);
  store.whatsappContactTemplate = getMessageTemplateRecord(ss,'SHOP_CONTACT','WHATSAPP');
  store.totalCustomers = Math.max(0, (ss.getSheetByName(slug) || { getLastRow: () => 1 }).getLastRow() - 1);
  store.policies = getGlobalPoliciesInternal(ss);
  setCachedStoreConfig(slug, store);
  return createJsonResponse({ status: 'success', store: store });
}

/**
 * Public SEO snapshot for one ACTIVE shop. This is deliberately a strict
 * allow-list: never expose customer records, owner email, owner name, visits,
 * registration metadata, Admin fields, merchant sessions or internal settings.
 */
function seoCleanText(value, maxLength) {
  return String(value == null ? '' : value).replace(/\u0000/g, '').trim().slice(0, maxLength || 5000);
}
function seoPublicHttpsUrl(value) {
  const text = String(value || '').trim();
  if (!text || text.length > 2048 || !/^https:\/\//i.test(text)) return '';
  try {
    const url = new URL(text);
    if (!['https:'].includes(url.protocol) || url.username || url.password) return '';
    return url.href;
  } catch (err) { return ''; }
}
/**
 * SEO-only sheet readers deliberately fetch only the columns needed for public
 * discovery. They avoid loading private owner/customer columns into memory.
 */
function findStoreRowForSEO(master, slug) {
  const last = master.getLastRow();
  if (last < 2) return null;
  const ids = master.getRange(2, 1, last - 1, 1).getValues();
  for (let i = 0; i < ids.length; i++) {
    if (String(ids[i][0] || '').trim().toLowerCase() === slug) {
      const rowIndex = i + 2;
      return { rowIndex: rowIndex, values: master.getRange(rowIndex, 1, 1, Math.max(15, master.getLastColumn())).getValues()[0] };
    }
  }
  return null;
}
function getShopServiceFlagsForSEO(ss, shopId) {
  const sh = ss.getSheetByName('ShopServices');
  if (!sh || sh.getLastRow() < 2) return { customerConnectEnabled: false, websitePricingEnabled: false, configured: false };
  const rows = sh.getRange(2, 2, sh.getLastRow() - 1, 3).getValues(); // ShopId, CustomerConnectEnabled, WebsitePricingEnabled
  for (let i = rows.length - 1; i >= 0; i--) {
    if (String(rows[i][0] || '').trim().toLowerCase() === shopId) {
      return {
        customerConnectEnabled: rows[i][1] === true || String(rows[i][1]).toLowerCase() === 'true',
        websitePricingEnabled: rows[i][2] === true || String(rows[i][2]).toLowerCase() === 'true',
        configured: true
      };
    }
  }
  return { customerConnectEnabled: false, websitePricingEnabled: false, configured: false };
}
function readPublicStoreContentForSEO(ss, shopId) {
  const result = {};
  const sheet = ss.getSheetByName('StoreContent');
  if (!sheet || sheet.getLastRow() < 2) return result;
  const last = sheet.getLastRow();
  const shopIds = sheet.getRange(2, 2, last - 1, 1).getValues();
  for (let i = 0; i < shopIds.length; i++) {
    if (String(shopIds[i][0] || '').trim().toLowerCase() !== shopId) continue;
    const row = sheet.getRange(i + 2, 5, 1, 6).getValues()[0]; // ContentKey, ContentType, ContentValue, ..., IsVisible
    if (String(row[5]).toLowerCase() === 'false') continue;
    const key = String(row[0] || '').trim();
    if (!key) continue;
    if (String(row[1] || '').toUpperCase() === 'JSON') {
      try { result[key] = JSON.parse(row[2] || 'null'); }
      catch (err) { result[key] = Array.isArray(row[2]) ? row[2] : []; }
    } else result[key] = row[2] || '';
  }
  return result;
}

function handleGetPublicStoreSEO(data) {
  const slug = String(data.shopId || data.slug || '').trim().toLowerCase();
  if (!/^[a-z0-9_-]{3,50}$/.test(slug)) return createJsonResponse({status:'error',message:'Invalid shop ID.'});
  const cache = CacheService.getScriptCache();
  const cacheKey = 'SEO_PUBLIC_' + slug;
  const cached = cache.get(cacheKey);
  if (cached) {
    try { return createJsonResponse({status:'success',store:JSON.parse(cached),cached:true}); }
    catch (err) { cache.remove(cacheKey); }
  }
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const master = getOrCreateMasterSheet(ss);
  const found = findStoreRowForSEO(master, slug);
  if (!found || String(found.values[11] || '').trim().toUpperCase() !== 'ACTIVE') {
    return createJsonResponse({status:'error',message:'Public shop page is unavailable.'});
  }
  const flags = getShopServiceFlagsForSEO(ss, slug);
  if (!flags.websitePricingEnabled) return createJsonResponse({status:'error',message:'Public website is not enabled for this shop.'});
  const base = storeFromMasterRow(ss, found.values);
  const content = readStoreContent(ss, slug, false);
  const contactVisibleRaw = getStoreSetting(ss, slug, 'contactVisible', true);
  const contactVisible = contactVisibleRaw !== false && String(contactVisibleRaw).toLowerCase() !== 'false';
  const visible = {};
  const contentSheet = ss.getSheetByName('StoreContent');
  if (contentSheet && contentSheet.getLastRow() > 1) {
    const count = contentSheet.getLastRow() - 1;
    const ids = contentSheet.getRange(2, 2, count, 1).getValues();
    const keys = contentSheet.getRange(2, 5, count, 1).getValues();
    const shown = contentSheet.getRange(2, 10, count, 1).getValues();
    for (let i = 0; i < ids.length; i++) {
      if (String(ids[i][0] || '').trim().toLowerCase() === slug) {
        const key = String(keys[i][0] || '').trim();
        if (key) visible[key] = String(shown[i][0]).toLowerCase() !== 'false';
      }
    }
  }
  const category = seoCleanText(content.categoryKey || content.layoutStyle || 'general', 40).toLowerCase();
  const homeText = visible.homeText === false ? '' : seoCleanText(content.homeText, 2500);
  const aboutText = visible.aboutText === false ? '' : seoCleanText(content.aboutText, 2500);
  const tagline = seoCleanText(base.tagline, 240);
  const services = visible.services === false || !Array.isArray(content.services) ? [] : content.services.slice(0, 40).map(item => ({
    name: seoCleanText(item && (item.title || item.name), 120),
    description: seoCleanText(item && (item.desc || item.description), 500)
  })).filter(item => item.name);
  const offers = visible.pricing === false || !Array.isArray(content.pricing) ? [] : content.pricing.slice(0, 40).map(item => ({
    name: seoCleanText(item && (item.item || item.name || item.title), 120),
    description: seoCleanText(item && (item.desc || item.description), 500),
    price: seoCleanText(item && item.price, 80)
  })).filter(item => item.name);
  const blog = visible.blog === false || !Array.isArray(content.blog) ? [] : content.blog.slice(0, 20).map(item => ({
    title: seoCleanText(item && item.title, 160),
    description: seoCleanText(item && (item.content || item.description), 700),
    date: seoCleanText(item && item.date, 40)
  })).filter(item => item.title);
  const address = contactVisible ? seoCleanText(content.address, 300) : '';
  const phone = contactVisible ? seoCleanText(base.ownerMobile, 30).replace(/[^0-9+]/g, '') : '';
  const mapUrl = contactVisible ? seoPublicHttpsUrl(base.mapEmbedUrl) : '';
  const reviewUrl = contactVisible ? seoPublicHttpsUrl(base.reviewUrl) : '';
  const banners = Array.isArray(content.banners) ? content.banners : [];
  const media = Array.isArray(content.media || content.mediaItems) ? (content.media || content.mediaItems) : [];
  let image = '';
  for (let i = 0; i < banners.length && !image; i++) image = seoPublicHttpsUrl(banners[i]);
  for (let i = 0; i < media.length && !image; i++) {
    const item = media[i];
    if (item && item.visible !== false && String(item.type || 'image').toLowerCase() !== 'video') image = seoPublicHttpsUrl(item.url);
  }
  if (!image) image = 'https://ccd.dev/assets/ccd-social-preview.png';
  const name = seoCleanText(base.shopName || slug, 160);
  const categoryLabels = {
    general:'Local business',salon:'Beauty salon and wellness',restaurant:'Restaurant and cafe',retail:'Retail store',
    grocery:'Grocery store',electronics:'Electronics store',clinic:'Clinic and healthcare',education:'Education and coaching',
    'home-services':'Home services',automotive:'Automotive services','real-estate':'Real estate',organic:'Organic and lifestyle store',professional:'Professional services'
  };
  const categoryLabel = categoryLabels[category] || 'Local business';
  const offerSummary = offers.map(x => x.name + (x.description ? ': ' + x.description : '') + (x.price ? ' — ' + x.price : '')).join('. ');
  const blogSummary = blog.map(x => x.title + (x.description ? ': ' + x.description : '')).join('. ');
  const descriptionParts = [tagline, homeText, aboutText, services.map(x => x.name + (x.description ? ': ' + x.description : '')).join('. '), offerSummary, blogSummary];
  const description = seoCleanText(descriptionParts.filter(Boolean).join(' '), 600) || (name + ' — ' + categoryLabel + ' on Customer Connect Desk.');
  const publicStore = {
    shopId: slug,
    name: name,
    tagline: tagline,
    categoryKey: category,
    categoryLabel: categoryLabel,
    description: description,
    homeText: homeText,
    aboutText: aboutText,
    address: address,
    telephone: phone,
    mapUrl: mapUrl,
    reviewUrl: reviewUrl,
    image: image,
    canonicalUrl: 'https://' + slug + '.ccd.dev/',
    services: services,
    offers: offers,
    blog: blog,
    isOpen: base.isOpen !== false
  };
  const serialized = JSON.stringify(publicStore);
  if (serialized.length < 95000) cache.put(cacheKey, serialized, 600);
  return createJsonResponse({status:'success',store:publicStore,cached:false});
}

/** Paginated list of ACTIVE stores with public websites, for sitemap generation only. */
function handleGetPublicSeoDirectory(data) {
  const offset = Math.max(0, Math.min(1000000, parseInt(data.offset || 0, 10) || 0));
  const limit = Math.max(1, Math.min(5000, parseInt(data.limit || 5000, 10) || 5000));
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const master = getOrCreateMasterSheet(ss);
  // Read only the shop ID/status and public-service columns. This avoids
  // loading owner/customer/reserved columns while building large sitemaps.
  const masterLast = master.getLastRow();
  const shopIds = masterLast > 1 ? master.getRange(2, 1, masterLast - 1, 1).getValues() : [];
  const statuses = masterLast > 1 ? master.getRange(2, 12, masterLast - 1, 1).getValues() : [];
  const serviceMap = {};
  const serviceSheet = ss.getSheetByName('ShopServices');
  if (serviceSheet && serviceSheet.getLastRow() > 1) {
    const rows = serviceSheet.getRange(2, 2, serviceSheet.getLastRow() - 1, 3).getValues();
    for (let i = 0; i < rows.length; i++) {
      const id = String(rows[i][0] || '').trim().toLowerCase();
      if (id) serviceMap[id] = rows[i][2] === true || String(rows[i][2]).toLowerCase() === 'true';
    }
  }
  const updates = {};
  const contentSheet = ss.getSheetByName('StoreContent');
  if (contentSheet && contentSheet.getLastRow() > 1) {
    const contentLast = contentSheet.getLastRow();
    const ids = contentSheet.getRange(2, 2, contentLast - 1, 1).getValues();
    const dates = contentSheet.getRange(2, 14, contentLast - 1, 1).getValues();
    for (let i = 0; i < ids.length; i++) {
      const id = String(ids[i][0] || '').trim().toLowerCase();
      const dt = dates[i][0] instanceof Date ? dates[i][0] : new Date(dates[i][0]);
      if (id && !isNaN(dt.getTime()) && (!updates[id] || dt > updates[id])) updates[id] = dt;
    }
  }
  const eligible = [];
  for (let i = 0; i < shopIds.length; i++) {
    const id = String(shopIds[i][0] || '').trim().toLowerCase();
    if (!id || String(statuses[i][0] || '').trim().toUpperCase() !== 'ACTIVE' || serviceMap[id] !== true) continue;
    eligible.push({shopId:id,lastmod:updates[id] ? updates[id].toISOString().slice(0,10) : ''});
  }
  return createJsonResponse({status:'success',total:eligible.length,offset:offset,limit:limit,stores:eligible.slice(offset,offset+limit)});
}

function handleUpdateStoreContent(data) {
  const admin = getAdminSession(data);
  if (!admin) return createJsonResponse({ status: 'error', message: 'Admin session expired. Sign in again.' });
  const slug = String(data.slug || data.shopId || '').trim().toLowerCase();
  if (!/^[a-z0-9_-]{3,50}$/.test(slug)) return createJsonResponse({ status: 'error', message: 'Invalid store ID.' });
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const master = getOrCreateMasterSheet(ss);
  const found = findStoreRow(master, slug);
  if (!found) return createJsonResponse({ status: 'error', message: 'Store not found.' });
  const oldContent = readStoreContent(ss, slug, true);
  const redirectUrl = data.redirectUrl === undefined ? undefined : String(data.redirectUrl || '').trim();
  if (redirectUrl && !/^https:\/\//i.test(redirectUrl)) return createJsonResponse({ status: 'error', message: 'Redirect URL must start with https://.' });
  if (redirectUrl && (!/^https:\/\/[a-z0-9.-]+(?::[0-9]{1,5})?(?:[/?#][^\s]*)?$/i.test(redirectUrl) || /https:\/\/[^/]*@/i.test(redirectUrl))) {
    return createJsonResponse({ status: 'error', message: 'Enter a valid HTTPS redirect URL without embedded credentials.' });
  }
  if (data.ownerMobile !== undefined) {
    const checkMobile = String(data.ownerMobile || '').replace(/\D/g, '');
    if (checkMobile && checkMobile.length !== 10) return createJsonResponse({ status: 'error', message: 'Owner contact must be a valid 10-digit number.' });
  }
  const visibility = data.visibility && typeof data.visibility === 'object' ? data.visibility : {};
  if (data.experienceMode !== undefined && !['COMMUNICATION_ONLY','WEBSITE_COMMUNICATION','MENU_ONLY'].includes(String(data.experienceMode).toUpperCase())) return createJsonResponse({ status: 'error', message: 'Invalid store activation mode.' });
  if (data.categoryKey !== undefined && !/^(general|salon|restaurant|retail|grocery|electronics|clinic|education|home-services|automotive|real-estate|organic|professional)$/.test(String(data.categoryKey))) return createJsonResponse({ status: 'error', message: 'Invalid business category.' });
  if (data.navigation !== undefined && (!Array.isArray(data.navigation) || data.navigation.length > 10 || data.navigation.some(item => !item || typeof item.label !== 'string' || !/^(home|services|pricing|about|blog|media|contact)$/.test(String(item.target || ''))))) return createJsonResponse({ status: 'error', message: 'Invalid navigation configuration.' });
  const fields = ['tagline','address','homeText','aboutText','banners','services','pricing','blog','media','layoutStyle','categoryKey','experienceMode','navigation'];
  fields.forEach((key, index) => {
    if (data[key] === undefined) return;
    const contentHasValue = Array.isArray(data[key]) ? data[key].length > 0 : String(data[key] || '').trim() !== '';
    const visible = Object.prototype.hasOwnProperty.call(visibility, key) ? visibility[key] === true : contentHasValue;
    if (key === 'pricing') logPriceHistoryChanges(ss, slug, oldContent.pricing || [], data.pricing || [], admin, 'SUPER_ADMIN', 'ADMIN_CONTENT_EDITOR');
    upsertStoreContent(ss, slug, key, data[key], Array.isArray(data[key]) ? 'JSON' : 'TEXT', admin.email, index + 1, visible);
  });
  if (visibility.contact !== undefined) {
    setStoreSetting(ss, slug, 'contactVisible', visibility.contact === true, 'BOOLEAN', 'CONTENT', admin.email);
  }
  if (redirectUrl !== undefined) setStoreSetting(ss, slug, 'redirectUrl', redirectUrl, 'TEXT', 'CHECKIN', admin.email);
  if (data.tagline !== undefined) master.getRange(found.rowIndex, 3).setValue(String(data.tagline || '').trim());
  if (data.address !== undefined) {
    // Address is kept in StoreContent; existing Master-Sheet N/O legacy values are not changed.
  }
  if (data.ownerMobile !== undefined) {
    const mobile = String(data.ownerMobile || '').replace(/\D/g, '');
    master.getRange(found.rowIndex, 6).setValue(mobile);
  }
  if (data.reviewUrl !== undefined) master.getRange(found.rowIndex, 11).setValue(String(data.reviewUrl || '').trim());
  if (data.mapEmbedUrl !== undefined) master.getRange(found.rowIndex, 13).setValue(String(data.mapEmbedUrl || '').trim());
  invalidateStoreConfig(slug);
  return createJsonResponse({ status: 'success', message: 'Store content and publishing settings saved.' });
}


function handleVerifyAdminUploadTarget(data){
 const admin=getAdminSession(data);if(!admin)return createJsonResponse({status:'error',message:'Admin session expired.'});
 const slug=String(data.shopId||'').trim().toLowerCase();
 if(!/^[a-z0-9_-]{3,50}$/.test(slug))return createJsonResponse({status:'error',message:'Invalid shop ID.'});
 const found=findStoreRow(getOrCreateMasterSheet(SpreadsheetApp.getActiveSpreadsheet()),slug);
 if(!found)return createJsonResponse({status:'error',message:'Shop not found.'});
 const status=String(found.values[11]||'PENDING').toUpperCase();
 if(status!=='ACTIVE')return createJsonResponse({status:'error',message:'Media uploads are available only for active shops.'});
 return createJsonResponse({status:'success',role:'SUPER_ADMIN',shopId:slug,registrationStatus:status});
}

function handleVerifyAdminSession(data) {
  const admin = getAdminSession(data);
  if (!admin) return createJsonResponse({ status: 'error', message: 'Admin session expired.' });
  return createJsonResponse({ status: 'success', role: 'SUPER_ADMIN', email: admin.email || '' });
}

function handleGetStoreContentAdmin(data) {
  const admin = getAdminSession(data);
  if (!admin) return createJsonResponse({ status: 'error', message: 'Admin session expired. Sign in again.' });
  const slug = String(data.slug || data.shopId || '').trim().toLowerCase();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const found = findStoreRow(getOrCreateMasterSheet(ss), slug);
  if (!found) return createJsonResponse({ status: 'error', message: 'Store not found.' });
  const content = readStoreContent(ss, slug, true);
  const store = storeFromMasterRow(ss, found.values);
  store.redirectUrl = getStoreSetting(ss, slug, 'redirectUrl', '');
  store.dashboardTheme = String(getStoreSetting(ss, slug, 'dashboardTheme', 'midnight-blue') || 'midnight-blue');
  store.services = getShopServiceFlags(ss,slug);
  store.whatsappContactTemplate = getMessageTemplateRecord(ss,'SHOP_CONTACT','WHATSAPP');
  const visibility = {};
  const sheet = ss.getSheetByName('StoreContent');
  if (sheet && sheet.getLastRow() > 1) {
    const rows = sheet.getDataRange().getValues();
    for (let i = 1; i < rows.length; i++) {
      if (String(rows[i][1] || '').trim().toLowerCase() === slug) {
        const key = String(rows[i][4] || '').trim();
        if (key) visibility[key] = String(rows[i][9]).toLowerCase() !== 'false';
      }
    }
  }
  visibility.contact = getStoreSetting(ss, slug, 'contactVisible', true) !== false && String(getStoreSetting(ss, slug, 'contactVisible', true)).toLowerCase() !== 'false';
  return createJsonResponse({ status: 'success', store: store, content: content, visibility: visibility });
}

function getGlobalPoliciesInternal(ss) {
  const result = { privacy: '', terms: '', cookies: '', faq: [] };
  const sheet = ss.getSheetByName('StorePolicies');
  if (!sheet || sheet.getLastRow() < 2) return result;
  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    const scope = String(rows[i][1] || '').trim().toUpperCase();
    if (scope !== 'GLOBAL' && scope !== '__GLOBAL__') continue;
    const key = String(rows[i][2] || '').trim().toLowerCase();
    const content = rows[i][4] || '';
    if (key === 'privacy' || key === 'privacy_policy') result.privacy = content;
    else if (key === 'terms' || key === 'terms_conditions') result.terms = content;
    else if (key === 'cookies' || key === 'cookie_policy') result.cookies = content;
    else if (key === 'faq') { try { result.faq = JSON.parse(content); } catch (err) { result.faq = []; } }
  }
  return result;
}

function handleGetPriceHistory(data){
 if(!getAdminSession(data))return createJsonResponse({status:'error',message:'Admin session expired.'});
 const ss=SpreadsheetApp.getActiveSpreadsheet(),sh=ss.getSheetByName('PriceHistory');if(!sh||sh.getLastRow()<2)return createJsonResponse({status:'success',history:[]});
 const filter=String(data.shopId||'').trim().toLowerCase(),rows=sh.getDataRange().getValues(),master=getOrCreateMasterSheet(ss).getDataRange().getValues(),names={};for(let i=1;i<master.length;i++)names[String(master[i][0]||'').toLowerCase()]=String(master[i][1]||master[i][0]||'');
 const out=[];for(let i=rows.length-1;i>=1&&out.length<500;i--){const shop=String(rows[i][1]||'').toLowerCase();if(filter&&shop!==filter)continue;out.push({shopId:shop,shopName:names[shop]||shop,itemName:String(rows[i][3]||''),oldPrice:rows[i][4],newPrice:rows[i][5],currency:String(rows[i][6]||'INR'),changedBy:String(rows[i][8]||rows[i][7]||''),role:String(rows[i][9]||''),changedAt:rows[i][10],source:String(rows[i][11]||''),reason:String(rows[i][12]||'')});}
 return createJsonResponse({status:'success',history:out});
}
function handleGetGlobalPolicies(data) {
  if (!getAdminSession(data)) return createJsonResponse({ status: 'error', message: 'Admin session expired. Sign in again.' });
  return createJsonResponse({ status: 'success', policies: getGlobalPoliciesInternal(SpreadsheetApp.getActiveSpreadsheet()) });
}

function handleUpdateGlobalPolicies(data) {
  const admin = getAdminSession(data);
  if (!admin) return createJsonResponse({ status: 'error', message: 'Admin session expired. Sign in again.' });
  const policies = data.policies || {};
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('StorePolicies');
  if (!sheet) return createJsonResponse({ status: 'error', message: 'StorePolicies sheet is missing; no sheet was created.' });
  const values = [
    ['privacy', 'Privacy Policy', policies.privacy || ''],
    ['terms', 'Terms & Conditions', policies.terms || ''],
    ['cookies', 'Cookie Policy', policies.cookies || ''],
    ['faq', 'Frequently Asked Questions', JSON.stringify(policies.faq || [])]
  ];
  values.forEach((item, i) => upsertGlobalPolicy(sheet, item[0], item[1], item[2], admin.email, i + 1));
  const master = getOrCreateMasterSheet(ss);
  const storeRows = master.getDataRange().getValues();
  for (let i = 1; i < storeRows.length; i++) {
    const slug = String(storeRows[i][0] || '').trim().toLowerCase();
    if (slug) invalidateStoreConfig(slug);
  }
  return createJsonResponse({ status: 'success', message: 'Shared policies saved.' });
}


// =============================================================================
// ADMIN MESSAGE CENTRE: persistent editable templates and auditable send status
// Sensitive Admin actions re-verify ADMIN_SETUP_PASSWORD from Script Properties.
// =============================================================================
function logSecurityEvent(ss,eventType,shopId,actorEmail,actorRole,outcome,details){
 try{let sh=ss.getSheetByName('SecurityEvents');if(!sh){sh=ss.insertSheet('SecurityEvents');sh.appendRow(['EventId','Timestamp','ActorEmail','ActorRole','ShopId','EventType','Outcome','Details','Source']);}
 const headers=sh.getRange(1,1,1,Math.max(1,sh.getLastColumn())).getValues()[0],values={eventid:Utilities.getUuid(),id:Utilities.getUuid(),timestamp:new Date(),createdat:new Date(),eventtimestamp:new Date(),actoremail:actorEmail||'',useremail:actorEmail||'',actorrole:actorRole||'',role:actorRole||'',shopid:shopId||'',storeid:shopId||'',eventtype:eventType||'',action:eventType||'',actiontype:eventType||'',outcome:outcome||'',result:outcome||'',status:outcome||'',details:details||'',description:details||'',source:'Code.gs'};
 const row=headers.map(h=>values[String(h||'').toLowerCase().replace(/[^a-z]/g,'')]??'');if(row.every(v=>v===''))row.splice(0,row.length,Utilities.getUuid(),new Date(),actorEmail||'',actorRole||'',shopId||'',eventType||'',outcome||'',details||'','Code.gs');sh.appendRow(row);
 }catch(err){Logger.log('Security event log failed: '+err.message);}
}
function requireAdminPin(data) {
  const admin=getAdminSession(data);if(!admin)return {ok:false,message:'Admin session expired. Sign in again.'};
  const configured=PropertiesService.getScriptProperties().getProperty('ADMIN_SETUP_PASSWORD')||'';
  if(!configured)return {ok:false,message:'ADMIN_SETUP_PASSWORD is not configured in Script Properties.'};
  const cache=CacheService.getScriptCache(),key='ADMIN_REAUTH_FAIL_'+hashNfcValue(admin.email||'admin'),attempts=Number(cache.get(key)||0);
  if(attempts>=5)return {ok:false,message:'Too many incorrect Admin password attempts. Try again after 15 minutes.'};
  const supplied=String(data.adminPassword || data.securityPin || '');
  if(!constantTimeEquals(supplied,configured)){cache.put(key,String(attempts+1),900);logSecurityEvent(SpreadsheetApp.getActiveSpreadsheet(),'ADMIN_PASSWORD_REAUTH_REJECTED','',admin.email,'SUPER_ADMIN','DENIED','Incorrect Admin password for sensitive action');return {ok:false,message:'Admin password is incorrect.'};}
  cache.remove(key);return {ok:true,admin:admin};
}
function getOrCreateMessageTemplatesSheet(ss) {
  let sh=ss.getSheetByName('MessageTemplates');
  if(!sh){ sh=ss.insertSheet('MessageTemplates'); sh.appendRow(['TemplateKey','Channel','Subject','Body','UpdatedAt','UpdatedBy','Enabled']); }
  return sh;
}
function getOrCreateCommunicationsLogSheet(ss) {
  let sh=ss.getSheetByName('CommunicationsLog');
  if(!sh){ sh=ss.insertSheet('CommunicationsLog'); sh.appendRow(['CommunicationId','ShopId','CustomerKey','VisitId','Channel','MessageType','RecipientSnapshot','ConsentStatus','ConsentCapturedAt','TemplateKey','MessageStatus','ProviderMessageId','QueuedAt','SentAt','DeliveredAt','FailedAt','ErrorCode','ErrorDetails','AttemptCount','LastAttemptAt']); }
  return sh;
}
function seedDefaultMessageTemplates(ss){
 const sh=getOrCreateMessageTemplatesSheet(ss),rows=sh.getDataRange().getValues();
 const defaults=[
 ['OWNER_STATUS','EMAIL','Customer Connect Desk update for {{shopName}}','Hello {{ownerName}},\n\nYour shop {{shopName}} ({{shopId}}) status is {{registrationStatus}}.\n\nShopkeeper Dashboard: {{merchantUrl}}\nCustomer Desk: {{deskUrl}}\nPublic Website: {{shopUrl}}\n\nRegards,\nCustomer Connect Desk'],
 ['OWNER_STATUS','WHATSAPP','','Hello {{ownerName}}, your shop {{shopName}} status is {{registrationStatus}}.\nDashboard: {{merchantUrl}}\nDesk: {{deskUrl}}\nWebsite: {{shopUrl}}'],
 ['CUSTOMER_VISIT','EMAIL','Visit confirmation - {{shopName}}','Hello {{customerName}},\n\nYour visit to {{shopName}} has been recorded successfully.\nTotal visits: {{totalVisits}}\nShop website: {{shopUrl}}\n\nThank you for visiting us.'],
 ['CUSTOMER_VISIT','WHATSAPP','','Hello {{customerName}}, thank you for visiting {{shopName}}. Your visit has been recorded. Total visits: {{totalVisits}}. Visit us: {{shopUrl}}'],
 ['SHOP_CONTACT','WHATSAPP','','Hello, I found {{shopName}} online and would like to know more. {{shopUrl}}'],
 ['SYSTEM_BACKUP','EMAIL','CCD annual backup completed for {{year}}','Hello {{ownerName}},\n\nThe annual backup {{backupTitle}} for {{year}} is complete.\nBackup file: {{backupUrl}}\n\nCustomer Connect Desk']
 ];
 for(const d of defaults){let exists=false;for(let i=1;i<rows.length;i++)if(String(rows[i][0])===d[0]&&String(rows[i][1]).toUpperCase()===d[1]){exists=true;break;}if(!exists)sh.appendRow([d[0],d[1],d[2],d[3],new Date(),'SYSTEM',true]);}
 return sh;
}
function getMessageTemplateRecord(ss,key,channel){const sh=ss.getSheetByName('MessageTemplates');if(!sh||sh.getLastRow()<2)return null;const rows=sh.getDataRange().getValues();for(let i=1;i<rows.length;i++)if(String(rows[i][0])===key&&String(rows[i][1]).toUpperCase()===channel&&String(rows[i][6]).toLowerCase()!=='false')return {templateKey:key,channel:channel,subject:String(rows[i][2]||''),body:String(rows[i][3]||'')};return null;}
function handleGetMessageTemplates(data){
  if(!getAdminSession(data)) return createJsonResponse({status:'error',message:'Admin session expired.'});
  const ss=SpreadsheetApp.getActiveSpreadsheet(),sh=seedDefaultMessageTemplates(ss);
  const master=getOrCreateMasterSheet(ss),storeRows=master.getDataRange().getValues();for(let i=1;i<storeRows.length;i++)if(storeRows[i][0])invalidateStoreConfig(String(storeRows[i][0]));
  const rows=sh.getDataRange().getValues(), templates=[];
  for(let i=1;i<rows.length;i++) if(rows[i][0]) templates.push({templateKey:String(rows[i][0]),channel:String(rows[i][1]),subject:String(rows[i][2]||''),body:String(rows[i][3]||''),enabled:String(rows[i][6]).toLowerCase()!=='false'});
  return createJsonResponse({status:'success',templates:templates,placeholders:['{{ownerName}}','{{shopName}}','{{shopId}}','{{ownerEmail}}','{{ownerMobile}}','{{deskUrl}}','{{shopUrl}}','{{merchantUrl}}','{{registrationStatus}}','{{customerName}}','{{customerEmail}}','{{customerMobile}}','{{totalVisits}}','{{visitDate}}','{{year}}','{{backupTitle}}','{{backupUrl}}']});
}
function handleSaveMessageTemplate(data){
  const auth=requireAdminPin(data); if(!auth.ok) return createJsonResponse({status:'error',message:auth.message});
  const key=String(data.templateKey||'').trim(), channel=String(data.channel||'').toUpperCase(), subject=String(data.subject||''), body=String(data.body||'');
  if(!key || !['EMAIL','WHATSAPP'].includes(channel) || !body.trim()) return createJsonResponse({status:'error',message:'Template key, valid channel and message body are required.'});
  if(body.length>10000 || subject.length>300) return createJsonResponse({status:'error',message:'Template is too long.'});
  const sh=getOrCreateMessageTemplatesSheet(SpreadsheetApp.getActiveSpreadsheet()), rows=sh.getDataRange().getValues(); let row=-1;
  for(let i=1;i<rows.length;i++) if(String(rows[i][0])===key && String(rows[i][1]).toUpperCase()===channel){row=i+1;break;}
  const values=[key,channel,subject,body,new Date(),getAdminSession(data).email,data.enabled===false?false:true];
  if(row>0) sh.getRange(row,1,1,values.length).setValues([values]); else sh.appendRow(values);
  if(key==='SHOP_CONTACT'){const master=getOrCreateMasterSheet(SpreadsheetApp.getActiveSpreadsheet()),stores=master.getDataRange().getValues();for(let i=1;i<stores.length;i++)if(stores[i][0])invalidateStoreConfig(String(stores[i][0]));}
  logSecurityEvent(SpreadsheetApp.getActiveSpreadsheet(),'MESSAGE_TEMPLATE_UPDATED','',getAdminSession(data).email,'SUPER_ADMIN','SUCCESS',key+' / '+channel);
  return createJsonResponse({status:'success',message:'Template saved and will be reused for future sends.',templateKey:key,channel:channel});
}
function renderMessageTemplate(text, vars){ return String(text||'').replace(/\{\{([a-zA-Z0-9_]+)\}\}/g,(m,k)=>String(vars[k]===undefined?'':vars[k])); }
function handleSendOwnerEmail(data){
  const auth=requireAdminPin(data); if(!auth.ok) return createJsonResponse({status:'error',message:auth.message});
  const slug=String(data.shopId||'').trim().toLowerCase(); const ss=SpreadsheetApp.getActiveSpreadsheet(); const master=getOrCreateMasterSheet(ss); const found=findStoreRow(master,slug);
  if(!found) return createJsonResponse({status:'error',message:'Shop not found.'});
  const row=found.values, recipient=String(row[4]||'').trim(); if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) return createJsonResponse({status:'error',message:'Shop owner email is missing or invalid.'});
  const key=String(data.templateKey||'OWNER_STATUS');if(key!=='OWNER_STATUS')return createJsonResponse({status:'error',message:'Owner email sends must use the OWNER_STATUS template. Edit CUSTOMER_VISIT for customer notifications.'});const sh=getOrCreateMessageTemplatesSheet(ss), t=sh.getDataRange().getValues(); let tpl=null;
  for(let i=1;i<t.length;i++) if(String(t[i][0])===key && String(t[i][1]).toUpperCase()==='EMAIL' && String(t[i][6]).toLowerCase()!=='false'){tpl={subject:t[i][2],body:t[i][3]};break;}
  if(!tpl) return createJsonResponse({status:'error',message:'Enabled email template not found. Save it first.'});
  const vars={ownerName:row[3]||'Shop owner',shopName:row[1]||slug,shopId:slug,ownerEmail:recipient,ownerMobile:row[5]||'',deskUrl:'https://'+slug+'.ccd.dev/nfc',shopUrl:'https://'+slug+'.ccd.dev/',merchantUrl:'https://'+slug+'.ccd.dev/merchant',registrationStatus:String(row[11]||'PENDING')};
  const subject=renderMessageTemplate(tpl.subject,vars), body=renderMessageTemplate(tpl.body,vars), log=getOrCreateCommunicationsLogSheet(ss), id=Utilities.getUuid(), now=new Date();
  try { MailApp.sendEmail({to:recipient,subject:subject,body:body}); }
  catch(err){ try { log.appendRow([id,slug,'','', 'EMAIL','ADMIN_OWNER_MESSAGE',recipient,'NOT_APPLICABLE','',key,'FAILED','',now,'','','', 'MAIL_SEND_ERROR',String(err&&err.message||err),1,now]); } catch(logErr) { Logger.log('Could not write failed email status: '+logErr.message); } return createJsonResponse({status:'error',communicationId:id,messageStatus:'FAILED',message:String(err&&err.message||err)}); }
  try { log.appendRow([id,slug,'','', 'EMAIL','ADMIN_OWNER_MESSAGE',recipient,'NOT_APPLICABLE','',key,'SENT','',now,now,'','','','',1,now]); }
  catch(logErr) { Logger.log('Email accepted by MailApp but CommunicationsLog write failed: '+logErr.message); return createJsonResponse({status:'success',communicationId:id,messageStatus:'SENT',logStatus:'FAILED',recipient:recipient,message:'Apps Script accepted the email request, but the status log could not be saved. Do not resend until checked.'}); }
  return createJsonResponse({status:'success',communicationId:id,messageStatus:'SENT',recipient:recipient,message:'Apps Script accepted the email send request.'});
}
function handleLogWhatsAppDraft(data){
  const auth=requireAdminPin(data); if(!auth.ok) return createJsonResponse({status:'error',message:auth.message});
  const slug=String(data.shopId||'').trim().toLowerCase(), ss=SpreadsheetApp.getActiveSpreadsheet(), master=getOrCreateMasterSheet(ss), found=findStoreRow(master,slug);
  if(!found) return createJsonResponse({status:'error',message:'Shop not found.'});
  if(String(data.templateKey||'OWNER_STATUS')!=='OWNER_STATUS')return createJsonResponse({status:'error',message:'Owner WhatsApp drafts must use the OWNER_STATUS template.'});
  const mobile=String(found.values[5]||'').replace(/\D/g,''); if(mobile.length<10) return createJsonResponse({status:'error',message:'Shop owner mobile is missing.'});
  const sh=getOrCreateCommunicationsLogSheet(ss), id=Utilities.getUuid(), now=new Date();
  sh.appendRow([id,slug,'','', 'WHATSAPP','ADMIN_OWNER_MESSAGE',mobile,'NOT_APPLICABLE','',String(data.templateKey||'OWNER_STATUS'),'PREPARED','',now,'','','','','',0,now]);
  return createJsonResponse({status:'success',communicationId:id,messageStatus:'PREPARED',mobile:mobile,message:'WhatsApp draft prepared. The sender must press Send in WhatsApp.'});
}
function handleLogMerchantWhatsAppDraft(data){
 const session=getMerchantSession(data);if(!session)return createJsonResponse({status:'error',message:'Merchant session expired.'});
 const phone=normalizePhone(data.phone||''),ss=SpreadsheetApp.getActiveSpreadsheet(),tenant=ss.getSheetByName(session.shopId);if(!getShopServiceFlags(ss,session.shopId).customerConnectEnabled)return createJsonResponse({status:'error',message:'Customer Connect service is disabled for this shop.'});if(phone.length!==10||!tenant||tenant.getLastRow()<2)return createJsonResponse({status:'error',message:'Customer visit record not found.'});
 const rows=tenant.getDataRange().getValues();let found=null;for(let i=1;i<rows.length;i++)if(normalizePhone(rows[i][3])===phone&&String(rows[i][6]||'').toUpperCase()==='YES'){found=rows[i];break;}if(!found)return createJsonResponse({status:'error',message:'WhatsApp consent is not recorded for this customer.'});
 const profile=getCentralCustomerByPhone(ss,phone),sh=getOrCreateCommunicationsLogSheet(ss),id=Utilities.getUuid(),now=new Date();sh.appendRow([id,session.shopId,profile?profile.customerKey:'','', 'WHATSAPP','CUSTOMER_VISIT_FOLLOWUP',phone,'YES',now,'CUSTOMER_VISIT','PREPARED','',now,'','','','','',0,now]);return createJsonResponse({status:'success',communicationId:id,messageStatus:'PREPARED',message:'WhatsApp draft prepared. Press Send in WhatsApp to send it.'});
}
function handleGetCommunicationStatus(data){
  if(!getAdminSession(data)) return createJsonResponse({status:'error',message:'Admin session expired.'});
  const slug=String(data.shopId||'').trim().toLowerCase(), sh=SpreadsheetApp.getActiveSpreadsheet().getSheetByName('CommunicationsLog');
  if(!sh||sh.getLastRow()<2) return createJsonResponse({status:'success',communications:[]});
  const rows=sh.getDataRange().getValues(), out=[];
  for(let i=rows.length-1;i>=1 && out.length<100;i--){if(!slug||String(rows[i][1])===slug) out.push({id:rows[i][0],shopId:rows[i][1],channel:rows[i][4],type:rows[i][5],recipient:rows[i][6],templateKey:rows[i][9],status:rows[i][10],queuedAt:rows[i][12],sentAt:rows[i][13],deliveredAt:rows[i][14],error:rows[i][17]});}
  return createJsonResponse({status:'success',communications:out});
}


function getOrCreateApprovalRequestsSheet(ss){let sh=ss.getSheetByName('ApprovalRequests');if(!sh){sh=ss.insertSheet('ApprovalRequests');sh.appendRow(['RequestId','ShopId','CustomerKey','CustomerNameSnapshot','MobileNumber','MobileHash','NFCSessionId','RequestCreatedAt','ExpiresAt','Status','RespondedAt','RespondedByUserId','RespondedByName','DecisionReason','IdempotencyKey','LastUpdatedAt','RequestSource']);}return sh;}
function getOrCreateNfcSessionsSheet(ss){let sh=ss.getSheetByName('NFC_Sessions');if(!sh){sh=ss.insertSheet('NFC_Sessions');sh.appendRow(['SessionId','ShopId','TokenHash','CreatedAt','ExpiresAt','SessionStatus','CustomerKey','MobileHash','ApprovalRequestId','LastStep','LastSeenAt','ConsumedAt','IdempotencyKey','SourcePage']);}return sh;}
function hashNfcValue(value){const bytes=Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,String(value),Utilities.Charset.UTF_8);return Utilities.base64EncodeWebSafe(bytes).replace(/=+$/,'');}
function constantTimeEquals(a,b){
 const left=String(a==null?'':a),right=String(b==null?'':b);let diff=left.length^right.length;
 const length=Math.max(left.length,right.length);
 for(let i=0;i<length;i++)diff|=(left.charCodeAt(i%Math.max(1,left.length))||0)^(right.charCodeAt(i%Math.max(1,right.length))||0);
 return diff===0;
}
function getCcdSecurityPepper(){
 const props=PropertiesService.getScriptProperties();let pepper=props.getProperty('CCD_AUTH_PEPPER')||'';
 if(!pepper){pepper=Utilities.getUuid()+Utilities.getUuid()+Utilities.getUuid();props.setProperty('CCD_AUTH_PEPPER',pepper);}
 return pepper;
}
function secureHmacValue(value){
 const signature=Utilities.computeHmacSha256Signature(String(value),getCcdSecurityPepper());
 return Utilities.base64EncodeWebSafe(signature).replace(/=+$/,'');
}
function securePinHash(pin,salt){return secureHmacValue('CCD_MERCHANT_PIN_V1|'+String(salt)+'|'+String(pin));}
function secureCustomerOtpHash(code,phone,email){return secureHmacValue('CCD_CUSTOMER_OTP_V1|'+normalizePhone(phone)+'|'+String(email).toLowerCase()+'|'+String(code));}
function makeSecureSixDigitOtp_(){let digits='';while(digits.length<6)digits+=Utilities.getUuid().replace(/\D/g,'');return digits.slice(0,6);}
function createOpaqueToken(){return Utilities.getUuid().replace(/-/g,'')+Utilities.getUuid().replace(/-/g,'');}
function incrementRateCounter(key,ttl){const cache=CacheService.getScriptCache(),count=Number(cache.get(key)||0)+1;cache.put(key,String(count),ttl||900);return count;}

function getCentralCustomerByPhone(ss,phone){const sh=ss.getSheetByName('Master-Customers');if(!sh||sh.getLastRow()<2)return null;const rows=sh.getDataRange().getValues();for(let i=1;i<rows.length;i++)if(normalizePhone(rows[i][1])===phone)return {customerKey:String(rows[i][0]||''),name:String(rows[i][2]||''),email:String(rows[i][3]||''),dob:String(rows[i][4]||'')};return null;}
function getLastShopVisit(ss,shopId,phone){const sh=ss.getSheetByName(shopId);if(!sh||sh.getLastRow()<2)return null;const rows=sh.getDataRange().getValues();let latest=null;for(let i=1;i<rows.length;i++){if(normalizePhone(rows[i][3])!==phone)continue;const d=rows[i][0] instanceof Date?rows[i][0]:new Date(rows[i][0]);if(!isNaN(d.getTime())&&(!latest||d>latest))latest=d;}return latest;}
function handleNfcStart(data){
 const ss=SpreadsheetApp.getActiveSpreadsheet(),slug=String(data.shopId||'').trim().toLowerCase(),phone=normalizePhone(data.phone||data.mobile||'');
 if(!slug||phone.length!==10)return createJsonResponse({status:'error',message:'Enter a valid 10-digit mobile number.'});
 const found=findStoreRow(getOrCreateMasterSheet(ss),slug);if(!found||String(found.values[11]||'').toUpperCase()!=='ACTIVE')return createJsonResponse({status:'error',message:'This shop is not currently active.'});
 if(!getShopServiceFlags(ss,slug).customerConnectEnabled)return createJsonResponse({status:'error',message:'Customer Connect service is disabled for this shop.'});
 const profile=getCentralCustomerByPhone(ss,phone),name=String(data.name||(profile&&profile.name)||'').trim(),lastVisit=getLastShopVisit(ss,slug,phone),now=new Date();
 const within=!!lastVisit&&(now.getTime()-lastVisit.getTime())<=25*60*1000;
 if(!within)return createJsonResponse({status:'success',state:'ALLOWED',allowed:true,redirectUrl:'https://'+slug+'.ccd.dev/desk',message:'You can continue to customer check-in.'});
 const mobileHash=hashNfcValue(slug+'|'+phone),ar=getOrCreateApprovalRequestsSheet(ss),rows=ar.getDataRange().getValues();
 for(let i=rows.length-1;i>=1;i--){if(String(rows[i][1]).toLowerCase()!==slug||String(rows[i][5])!==mobileHash)continue;const created=new Date(rows[i][7]).getTime();if(!created||now.getTime()-created>25*60*1000)break;let state=String(rows[i][9]||'').toUpperCase(),expires=new Date(rows[i][8]).getTime();if(state==='PENDING'&&(!expires||expires<=now.getTime())){state='EXPIRED';ar.getRange(i+1,10).setValue('EXPIRED');ar.getRange(i+1,16).setValue(now);const nfcSheet=ss.getSheetByName('NFC_Sessions');if(nfcSheet&&nfcSheet.getLastRow()>1){const ns=nfcSheet.getDataRange().getValues();for(let k=1;k<ns.length;k++)if(String(ns[k][8])===String(rows[i][0])){nfcSheet.getRange(k+1,6).setValue('EXPIRED');nfcSheet.getRange(k+1,11).setValue(now);break;}}}if(state==='APPROVED')return createJsonResponse({status:'success',state:'APPROVED',allowed:true,redirectUrl:'https://'+slug+'.ccd.dev/desk',message:'Shopkeeper approved your check-in.'});if(state==='PENDING')return createJsonResponse({status:'success',state:'PENDING',allowed:false,requestId:String(rows[i][0]),expiresAt:rows[i][8],remainingMs:Math.max(0,expires-now.getTime()),message:'Waiting for shopkeeper approval.'});if(state==='REJECTED'||state==='EXPIRED')return createJsonResponse({status:'success',state:state,allowed:false,message:state==='REJECTED'?'Shopkeeper did not approve this check-in.':'The approval request expired. Please ask the shopkeeper for help.'});}
 if(!name)return createJsonResponse({status:'success',state:'NEED_NAME',needsName:true,message:'Please enter your name to request shopkeeper approval.'});
 const requestId=Utilities.getUuid(),sessionId=Utilities.getUuid(),expiresAt=new Date(now.getTime()+5*60*1000),idem=hashNfcValue(slug+'|'+phone+'|'+lastVisit.toISOString());
 getOrCreateNfcSessionsSheet(ss).appendRow([sessionId,slug,hashNfcValue(sessionId),now,expiresAt,'PENDING',profile?profile.customerKey:'',mobileHash,requestId,'APPROVAL_REQUEST',now,'',idem,'nfc.html']);
 ar.appendRow([requestId,slug,profile?profile.customerKey:'',name,phone,mobileHash,sessionId,now,expiresAt,'PENDING','','','','',idem,now,'NFC']);
 return createJsonResponse({status:'success',state:'PENDING',allowed:false,requestId:requestId,expiresAt:expiresAt,remainingMs:300000,message:'Approval request sent to the shopkeeper.'});
}
function handleNfcDecision(data){
 const session=getMerchantSession(data);if(!session)return createJsonResponse({status:'error',message:'Shopkeeper session expired. Unlock the dashboard again.'});
 const requestId=String(data.requestId||''),decision=String(data.decision||'').toUpperCase();if(!requestId||!['APPROVED','REJECTED'].includes(decision))return createJsonResponse({status:'error',message:'A valid request and decision are required.'});
 const ss=SpreadsheetApp.getActiveSpreadsheet();if(!getShopServiceFlags(ss,session.shopId).customerConnectEnabled)return createJsonResponse({status:'error',message:'Customer Connect service is disabled for this shop.'});const sh=getOrCreateApprovalRequestsSheet(ss),rows=sh.getDataRange().getValues();
 for(let i=1;i<rows.length;i++){if(String(rows[i][0])!==requestId)continue;if(String(rows[i][1]).toLowerCase()!==session.shopId)return createJsonResponse({status:'error',message:'This approval request belongs to another shop.'});if(String(rows[i][9]).toUpperCase()!=='PENDING')return createJsonResponse({status:'error',message:'This request is no longer pending.'});const expiry=new Date(rows[i][8]).getTime(),now=new Date();if(!expiry||expiry<=now.getTime()){sh.getRange(i+1,10).setValue('EXPIRED');sh.getRange(i+1,16).setValue(now);return createJsonResponse({status:'error',message:'Approval request has expired.'});}sh.getRange(i+1,10).setValue(decision);sh.getRange(i+1,11,1,3).setValues([[now,session.shopId,session.shopId]]);sh.getRange(i+1,14).setValue(String(data.reason||'').slice(0,300));sh.getRange(i+1,16).setValue(now);const nfc=ss.getSheetByName('NFC_Sessions');if(nfc&&nfc.getLastRow()>1){const nr=nfc.getDataRange().getValues();for(let j=1;j<nr.length;j++)if(String(nr[j][8])===requestId){nfc.getRange(j+1,6).setValue(decision);nfc.getRange(j+1,11).setValue(now);break;}}logSecurityEvent(ss,'NFC_APPROVAL_'+decision,session.shopId,session.shopId,'MERCHANT','SUCCESS','Request '+requestId);return createJsonResponse({status:'success',requestId:requestId,state:decision,message:'Customer request '+decision.toLowerCase()+'.'});}
 return createJsonResponse({status:'error',message:'Approval request not found.'});
}

function doPost(e) {
  let data = null;
  let lock = null;
  const writeActions = new Set([
    'adminAuth','adminRecoveryStart','adminRecoveryVerify','adminTouchSession','adminLogout','merchantOtpStart','merchantOtpVerify','merchantTouchSession','registrationLookup','customerAuthStart','customerAuthVerify','setStoreRegistrationStatus','setRegistrationRequestStatus','registerStore','deleteStore','saveStore','updateStoreStatus',
    'saveUser','recordCustomerVisit','logReviewOnly','customerCheckin','getCustomerDashboardData','verifyMerchantPin','updateCoupon',
    'updateStoreContent','updateGlobalPolicies','setShopServices','nfcStart','nfcDecision','logMerchantWhatsAppDraft','setShopLifecycle','deleteStore','setShopDashboardTheme','setMerchantAccessPin','updateMerchantProfile','updateMerchantPromo','updateMerchantPricing','getMessageTemplates','saveMessageTemplate','sendOwnerEmail','logWhatsAppDraft'
  ]);
  try {
    if (!e) return createJsonResponse({ status: 'error', message: 'Empty request received.' });
    if (e.parameter && e.parameter.postData) {
      try { data = typeof e.parameter.postData === 'object' ? e.parameter.postData : JSON.parse(e.parameter.postData); } catch (err) { data = null; }
    }
    if (!data && e.postData && e.postData.contents) {
      let raw = e.postData.contents;
      if (typeof raw === 'string' && raw.indexOf('postData=') === 0) {
        try { raw = decodeURIComponent(raw.substring(9).replace(/\+/g, ' ')); } catch (err) {}
      }
      try { data = typeof raw === 'object' ? raw : JSON.parse(raw); }
      catch (err) { return createJsonResponse({ status: 'error', message: 'Malformed request payload.' }); }
    }
    if (!data && e.parameter && Object.keys(e.parameter).length) data = e.parameter;
    if (!data || typeof data !== 'object') return createJsonResponse({ status: 'error', message: 'No readable data payload in request.' });
    if (JSON.stringify(data).length > 500000) return createJsonResponse({status:'error',message:'Request is too large. Upload media separately.'});
    const action = String(data.action || '').trim();
    if (!action) return createJsonResponse({ status: 'error', message: 'Missing action.' });
    const isCustomerLookup = action === 'customerCheckin' && String(data.actionType || '').toLowerCase() === 'lookup';
    if (writeActions.has(action) && !isCustomerLookup) {
      lock = LockService.getScriptLock();
      if (!lock.tryLock(15000)) return createJsonResponse({ status: 'error', message: 'The sheet is busy. Please retry.' });
    }
    switch (action) {
      case 'adminAuth': return handleAdminAuth(data);
      case 'adminRecoveryStart': return handleAdminRecoveryStart(data);
      case 'adminRecoveryVerify': return handleAdminRecoveryVerify(data);
      case 'adminTouchSession': return handleAdminTouchSession(data);
      case 'adminLogout': return handleAdminLogout(data);
      case 'merchantOtpStart': return handleMerchantOtpStart(data);
      case 'merchantOtpVerify': return handleMerchantOtpVerify(data);
      case 'merchantTouchSession': return handleMerchantTouchSession(data);
      case 'registrationLookup': return handleRegistrationLookup(data);
      case 'getMessageTemplates': return handleGetMessageTemplates(data);
      case 'saveMessageTemplate': return handleSaveMessageTemplate(data);
      case 'sendOwnerEmail': return handleSendOwnerEmail(data);
      case 'logWhatsAppDraft': return handleLogWhatsAppDraft(data);
      case 'logMerchantWhatsAppDraft': return handleLogMerchantWhatsAppDraft(data);
      case 'getCommunicationStatus': return handleGetCommunicationStatus(data);
      case 'getAdminData': return handleGetAdminData(data);
      case 'setStoreRegistrationStatus': return handleSetStoreRegistrationStatus(data);
      case 'setRegistrationRequestStatus': return handleSetRegistrationRequestStatus(data);
      case 'registerStore': return handleRegisterStore(data);
      case 'deleteStore': return handleDeleteStore(data);
      case 'setShopLifecycle': return handleSetShopLifecycle(data);
      case 'setShopDashboardTheme': return handleSetShopDashboardTheme(data);
      case 'setMerchantAccessPin': return handleSetMerchantAccessPin(data);
      case 'setShopServices': return handleSetShopServices(data);
      case 'nfcStart': return handleNfcStart(data);
      case 'nfcDecision': return handleNfcDecision(data);
      case 'saveStore': return handleSaveStoreLegacy(data);
      case 'getOwnerStore': return handleGetOwnerStore(data);
      case 'getStoreConfig':
      case 'getStoreProfile': return handleGetStoreConfig(data);
      case 'getPublicStoreSEO': return handleGetPublicStoreSEO(data);
      case 'getPublicSeoDirectory': return handleGetPublicSeoDirectory(data);
      case 'verifyMerchantPin': return handleVerifyMerchantPin(data);
      case 'updateStoreStatus':
      case 'toggleLiveDeskStatus': return handleUpdateStoreStatus(data);
      case 'checkUser':
      case 'checkCustomerStatus': return handleCheckCustomerStatusUnified(data);
      case 'saveUser':
      case 'recordCustomerVisit': return handleRecordCustomerVisitUnified(data);
      case 'logReviewOnly': return handleLogReviewOnly(data);
      case 'customerAuthStart': return handleCustomerAuthStart(data);
      case 'customerAuthVerify': return handleCustomerAuthVerify(data);
      case 'getCustomerDashboardData': return handleGetCustomerDashboardData(data);
      case 'customerCheckin': return handleCustomerCheckin(data);
      case 'updateCoupon': return handleUpdateCoupon(data);
      case 'getMerchantData': return handleGetMerchantData(data);
      case 'getStoreContentAdmin': return handleGetStoreContentAdmin(data);
      case 'verifyAdminSession': return handleVerifyAdminSession(data);
      case 'verifyAdminUploadTarget': return handleVerifyAdminUploadTarget(data);
      case 'updateStoreContent': return handleUpdateStoreContent(data);
      case 'getGlobalPolicies': return handleGetGlobalPolicies(data);
      case 'getPriceHistory': return handleGetPriceHistory(data);
      case 'updateGlobalPolicies': return handleUpdateGlobalPolicies(data);
      case 'updateMerchantProfile': return handleUpdateMerchantProfile(data);
      case 'updateMerchantPromo': return handleUpdateMerchantPromo(data);
      case 'updateMerchantPricing': return handleUpdateMerchantPricing(data);
      case 'getRegistrationStatus': return handleGetRegistrationStatus(data);
      default: return createJsonResponse({ status: 'error', message: 'Unrecognized endpoint action.' });
    }
  } catch (err) {
    try { Logger.log('CCD API internal error: '+String(err&&err.message||'unknown')); } catch (logErr) {}
    return createJsonResponse({ status: 'error', message: 'The request could not be completed. Please retry or contact CCD support.' });
  } finally {
    if (lock) { try { lock.releaseLock(); } catch (err) {} }
  }
}



// =============================================================================
// CUSTOMER CONNECT DESK - SAFE SHEET ACCESS, AUTHENTICATION AND CONTENT HELPERS
// The existing Google Spreadsheet remains the only data store. No tabs are
// renamed or deleted; the existing StoreContent / StoreSettings / StorePolicies
// tabs are used according to their current headers.
// =============================================================================
const CACHE_TTL_SECONDS = 21600;
const ADMIN_SESSION_TTL_SECONDS = 1800;
const MERCHANT_SESSION_TTL_SECONDS = 1800;
const CUSTOMER_SESSION_TTL_SECONDS = 600;
const CUSTOMER_OTP_TTL_SECONDS = 600;
const GOOGLE_IDENTITY_CLIENT_ID = '913181271941-qvtfqq8l2c2imgpsnsh4k1gbdafr0t8e.apps.googleusercontent.com';

function normalizePhone(value) {
  return String(value || '').replace(/\D/g, '').slice(-10);
}

function findStoreRow(master, slug) {
  const wanted = String(slug || '').trim().toLowerCase();
  if (!wanted || master.getLastRow() < 2) return null;
  const values = master.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][0] || '').trim().toLowerCase() === wanted) return { rowIndex: i + 1, values: values[i] };
  }
  return null;
}

function storeFromMasterRow(ss, row) {
  const slug = String(row[0] || '').trim().toLowerCase();
  const isOpenSetting = getStoreSetting(ss, slug, 'isOpen', null);
  const timeSetting = getStoreSetting(ss, slug, 'closingTime', null);
  const openValue = isOpenSetting !== null ? isOpenSetting : row[13];
  return {
    shopId: slug, shopName: row[1] || '', tagline: row[2] || '', ownerName: row[3] || '',
    ownerMobile: String(row[5] || ''),
    primaryColor: row[6] || '#2563eb', bgColor: row[7] || '#ffffff',
    cardBg: row[8] || '#ffffff', textColor: row[9] || '#0f172a',
    reviewUrl: row[10] || '', registrationStatus: row[11] || 'PENDING',
    mapEmbedUrl: row[12] || '', isOpen: openValue !== false && String(openValue).toUpperCase() !== 'CLOSED',
    closingTime: timeSetting || row[14] || '9:00 PM'
  };
}

function getStoreSetting(ss, shopId, key, fallback) {
  const sheet = ss.getSheetByName('StoreSettings');
  if (!sheet || sheet.getLastRow() < 2) return fallback;
  const values = sheet.getDataRange().getValues();
  for (let i = values.length - 1; i >= 1; i--) {
    if (String(values[i][1] || '').trim().toLowerCase() === String(shopId).toLowerCase() &&
        String(values[i][2] || '').trim() === key && String(values[i][6]).toLowerCase() !== 'false') {
      const value = values[i][3];
      if (String(values[i][4]).toUpperCase() === 'BOOLEAN') return value === true || String(value).toLowerCase() === 'true';
      return value;
    }
  }
  return fallback;
}

function setStoreSetting(ss, shopId, key, value, valueType, category, updatedBy) {
  const sheet = ss.getSheetByName('StoreSettings');
  if (!sheet) throw new Error('StoreSettings sheet is missing.');
  const rows = sheet.getDataRange().getValues();
  const now = new Date();
  for (let i = rows.length - 1; i >= 1; i--) {
    if (String(rows[i][1] || '').toLowerCase() === String(shopId).toLowerCase() && String(rows[i][2] || '') === key) {
      sheet.getRange(i + 1, 4, 1, 6).setValues([[value, valueType || 'TEXT', category || 'GENERAL', true, updatedBy || 'SYSTEM', now]]);
      return;
    }
  }
  sheet.appendRow([Utilities.getUuid(), shopId, key, value, valueType || 'TEXT', category || 'GENERAL', true, updatedBy || 'SYSTEM', now]);
}

function readStoreContent(ss, shopId, includeHidden) {
  const result = {};
  const sheet = ss.getSheetByName('StoreContent');
  if (!sheet || sheet.getLastRow() < 2) return result;
  const values = sheet.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][1] || '').trim().toLowerCase() !== String(shopId).toLowerCase()) continue;
    if (!includeHidden && String(values[i][9]).toLowerCase() === 'false') continue;
    const key = String(values[i][4] || '').trim();
    if (!key) continue;
    const raw = values[i][6];
    if (String(values[i][5]).toUpperCase() === 'JSON') {
      try { result[key] = JSON.parse(raw || 'null'); } catch (err) { result[key] = Array.isArray(raw) ? raw : []; }
    } else result[key] = raw || '';
  }
  return result;
}

function upsertStoreContent(ss, shopId, key, value, type, updatedBy, order, visible) {
  const sheet = getOrCreateStoreContentSheet(ss);
  const rows = sheet.getDataRange().getValues();
  const now = new Date();
  const serialized = type === 'JSON' ? JSON.stringify(value) : String(value == null ? '' : value);
  for (let i = rows.length - 1; i >= 1; i--) {
    if (String(rows[i][1] || '').toLowerCase() === String(shopId).toLowerCase() && String(rows[i][4] || '') === key) {
      sheet.getRange(i + 1, 3, 1, 12).setValues([['shop', 'content', key, type, serialized, '', order || 0, visible !== false, 'en', updatedBy || '', rows[i][12] || now, now]]);
      return;
    }
  }
  sheet.appendRow([Utilities.getUuid(), shopId, 'shop', 'content', key, type, serialized, '', order || 0, visible !== false, 'en', updatedBy || '', now, now]);
}

function upsertGlobalPolicy(sheet, key, title, content, updatedBy, order) {
  const rows = sheet.getDataRange().getValues();
  const now = new Date();
  for (let i = rows.length - 1; i >= 1; i--) {
    const scope = String(rows[i][1] || '').toUpperCase();
    if ((scope === 'GLOBAL' || scope === '__GLOBAL__') && String(rows[i][2] || '').toLowerCase() === key) {
      sheet.getRange(i + 1, 2, 1, 8).setValues([['GLOBAL', key, title, content, true, order, updatedBy, now]]);
      return;
    }
  }
  sheet.appendRow([Utilities.getUuid(), 'GLOBAL', key, title, content, true, order, updatedBy, now]);
}

function verifyGoogleIdToken(idToken) {
  if (!idToken) return null;
  try {
    const url = 'https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(idToken);
    const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    if (response.getResponseCode() !== 200) return null;
    const info = JSON.parse(response.getContentText());
    const issuer = String(info.iss || '');
    const validIssuer = issuer === 'accounts.google.com' || issuer === 'https://accounts.google.com';
    if (!validIssuer || info.aud !== GOOGLE_IDENTITY_CLIENT_ID || String(info.email_verified).toLowerCase() !== 'true') return null;
    if (Number(info.exp) <= Math.floor(Date.now() / 1000)) return null;
    return { email: String(info.email || '').trim().toLowerCase(), name: info.name || '' };
  } catch (err) { return null; }
}

function createSessionToken(prefix,data,ttlSeconds) {
  const token=createOpaqueToken();
  CacheService.getScriptCache().put(prefix+token,JSON.stringify(data),Math.max(60,Math.min(Number(ttlSeconds)||CACHE_TTL_SECONDS,CACHE_TTL_SECONDS)));
  return token;
}

function getAdminSession(data) {
  const token = String(data && data.adminToken || '');
  if (!token) return null;
  const cache = CacheService.getScriptCache();
  const raw = cache.get('ADMIN_SESSION_' + token);
  if (!raw) return null;
  try {
    const session = JSON.parse(raw);
    if (session.role !== 'SUPER_ADMIN' || session.email !== CCD_ADMIN_LOGIN_EMAIL || String(session.authVersion || '') !== adminAuthVersion_()) return null;
    if (!Number.isFinite(Number(session.createdAt)) || Date.now() - Number(session.createdAt) > 28800000) { cache.remove('ADMIN_SESSION_' + token); return null; }
    return session;
  } catch (err) { return null; }
}

function getMerchantSession(data) {
  const token=String(data&&data.merchantToken||data&&data.sessionToken||'');if(!token)return null;
  const raw=CacheService.getScriptCache().get('MERCHANT_SESSION_'+token);if(!raw)return null;
  try{const session=JSON.parse(raw);if(session.role!=='MERCHANT')return null;if(session.createdAt&&Date.now()-Number(session.createdAt)>28800000){CacheService.getScriptCache().remove('MERCHANT_SESSION_'+token);return null;}const ss=SpreadsheetApp.getActiveSpreadsheet(),found=findStoreRow(getOrCreateMasterSheet(ss),String(session.shopId||'').toLowerCase());if(!found||String(found.values[11]||'').toUpperCase()!=='ACTIVE')return null;const flags=getShopServiceFlags(ss,session.shopId);if(!flags.customerConnectEnabled&&!flags.websitePricingEnabled)return null;return session;}catch(err){return null;}
}

function handleUpdateMerchantProfile(data) {
  const session = getMerchantSession(data);
  if (!session) return createJsonResponse({ status: 'error', message: 'Merchant session expired.' });
  return createJsonResponse({ status: 'error', message: 'Storefront content is managed by Customer Connect Desk Admin.' });
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if(!getShopServiceFlags(ss,session.shopId).websitePricingEnabled)return createJsonResponse({status:'error',message:'Shop Website service is disabled for this shop.'});
  const master = getOrCreateMasterSheet(ss);
  const found = findStoreRow(master, session.shopId);
  if (!found) return createJsonResponse({ status: 'error', message: 'Store not found.' });
  if (data.ownerMobile !== undefined) {
    const mobile = String(data.ownerMobile).replace(/\D/g, '');
    if (mobile.length !== 10) return createJsonResponse({ status: 'error', message: 'Enter a valid 10-digit contact number.' });
    master.getRange(found.rowIndex, 6).setValue(mobile);
  }
  if (data.reviewUrl !== undefined) master.getRange(found.rowIndex, 11).setValue(String(data.reviewUrl || '').trim());
  invalidateStoreConfig(session.shopId);
  return createJsonResponse({ status: 'success', message: 'Contact details saved.' });
}

function handleUpdateMerchantPromo(data) {
  const session = getMerchantSession(data);
  if (!session) return createJsonResponse({ status: 'error', message: 'Merchant session expired.' });
  return createJsonResponse({ status: 'error', message: 'Storefront content is managed by Customer Connect Desk Admin.' });
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if(!getShopServiceFlags(ss,session.shopId).websitePricingEnabled)return createJsonResponse({status:'error',message:'Shop Website service is disabled for this shop.'});
  setStoreSetting(ss, session.shopId, 'promoEnabled', !!data.promoEnabled, 'BOOLEAN', 'PROMOTION', 'MERCHANT');
  setStoreSetting(ss, session.shopId, 'promoHeadline', String(data.promoHeadline || '').trim(), 'TEXT', 'PROMOTION', 'MERCHANT');
  setStoreSetting(ss, session.shopId, 'promoCode', String(data.promoCode || '').trim(), 'TEXT', 'PROMOTION', 'MERCHANT');
  setStoreSetting(ss, session.shopId, 'promoDescription', String(data.promoDescription || '').trim(), 'TEXT', 'PROMOTION', 'MERCHANT');
  invalidateStoreConfig(session.shopId);
  return createJsonResponse({ status: 'success', message: 'Offer settings saved.' });
}

function logPriceHistoryChanges(ss, shopId, oldItems, newItems, actor, role, source) {
  const history = ss.getSheetByName('PriceHistory');
  if (!history) return;
  const before = new Map();
  (Array.isArray(oldItems) ? oldItems : []).forEach(item => {
    const name = String(item && (item.item || item.title || item.name) || '').trim();
    if (name) before.set(name.toLowerCase(), item);
  });
  (Array.isArray(newItems) ? newItems : []).forEach(item => {
    const name = String(item && (item.item || item.title || item.name) || '').trim();
    if (!name) return;
    const oldItem = before.get(name.toLowerCase());
    const oldPrice = oldItem ? String(oldItem.price == null ? '' : oldItem.price) : '';
    const newPrice = String(item.price == null ? '' : item.price);
    if (oldPrice === newPrice) return;
    history.appendRow([
      Utilities.getUuid(), shopId, String(item.itemId || item.id || name.toLowerCase().replace(/[^a-z0-9]+/g, '-')),
      name, oldPrice, newPrice, String(item.currency || 'INR'),
      String(actor && actor.email || ''), String(actor && actor.name || ''), role || 'ADMIN',
      new Date(), source || 'CONTENT_EDITOR', oldPrice ? 'Price updated' : 'Price added'
    ]);
  });
}

function handleUpdateMerchantPricing(data) {
  const session = getMerchantSession(data);
  if (!session) return createJsonResponse({ status: 'error', message: 'Merchant session expired.' });
  return createJsonResponse({ status: 'error', message: 'Storefront content is managed by Customer Connect Desk Admin.' });
  if (!getShopServiceFlags(SpreadsheetApp.getActiveSpreadsheet(),session.shopId).websitePricingEnabled) return createJsonResponse({status:'error',message:'Website & Pricing service is disabled for this shop.'});
  if (!Array.isArray(data.pricing)) return createJsonResponse({ status: 'error', message: 'Pricing items are required.' });
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const master = getOrCreateMasterSheet(ss);
  const found = findStoreRow(master, session.shopId);
  if (!found) return createJsonResponse({ status: 'error', message: 'Store not found.' });
  const previous = readStoreContent(ss, session.shopId, true).pricing || [];
  const contentSheet = ss.getSheetByName('StoreContent');
  let pricingVisible = true;
  if (contentSheet && contentSheet.getLastRow() > 1) {
    const rows = contentSheet.getDataRange().getValues();
    for (let i = rows.length - 1; i >= 1; i--) {
      if (String(rows[i][1] || '').trim().toLowerCase() === session.shopId && String(rows[i][4] || '').trim() === 'pricing') {
        pricingVisible = String(rows[i][9]).toLowerCase() !== 'false';
        break;
      }
    }
  }
  const next = data.pricing.map(item => ({
    item: String(item.item || '').trim(), price: String(item.price || '').trim(), desc: String(item.desc || '').trim(), currency: String(item.currency || 'INR')
  })).filter(item => item.item);
  logPriceHistoryChanges(ss, session.shopId, previous, next, { email: found.values[4] || '', name: found.values[3] || 'Merchant' }, 'MERCHANT', 'MERCHANT_DASHBOARD');
  upsertStoreContent(ss, session.shopId, 'pricing', next, 'JSON', 'MERCHANT', 6, pricingVisible);
  invalidateStoreConfig(session.shopId);
  return createJsonResponse({ status: 'success', message: 'Pricing updated and price history recorded.' });
}

function handleGetRegistrationStatus(data) {
 const requestId=String(data.requestId||'').trim(),token=String(data.statusToken||'').trim();
 if(!requestId||token.length<32)return createJsonResponse({status:'error',message:'A valid secure registration status link is required.'});
 const sh=getOrCreateRegistrationRequestsSheet(SpreadsheetApp.getActiveSpreadsheet()),rows=sh.getDataRange().getValues();
 const hashColumn=ensureHeaderColumn(sh,'StatusTokenHash')-1;
 for(let i=1;i<rows.length;i++)if(String(rows[i][0])===requestId){
  const savedHash=String(rows[i][hashColumn]||'');
  if(!savedHash||!constantTimeEquals(secureHmacValue('CCD_REG_STATUS_V1|'+token),savedHash))return createJsonResponse({status:'error',message:'Secure registration status link is invalid or expired.'});
  return createJsonResponse({status:'success',exists:true,registrationStatus:String(rows[i][14]||'PENDING').toUpperCase(),requestId:requestId,shopId:String(rows[i][20]||rows[i][1]||'')});
 }
 return createJsonResponse({status:'error',message:'Registration request not found.'});
}
