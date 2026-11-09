/**
 * Customer Connect Desk wildcard-host router + Admin-authenticated R2 media upload.
 * Bind MEDIA_BUCKET to an R2 bucket. Configure GAS_URL, PAGES_ORIGIN and PUBLIC_MEDIA_BASE.
 */
const RESERVED = new Set(['www', 'admin', 'register', 'api', 'assets', 'support', 'mail', 'media']);
const ALLOWED_ROOT_HOSTS = new Set(['ccd.dev', 'www.ccd.dev', 'admin.ccd.dev', 'register.ccd.dev', 'media.ccd.dev']);
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm']);
const EXTENSIONS = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'video/mp4': 'mp4', 'video/webm': 'webm' };

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers } });
}
function cors(origin) {
  const allowed = new Set(['https://admin.ccd.dev', 'https://customer-connect-desk.pages.dev']);
  return allowed.has(origin) ? { 'access-control-allow-origin': origin, 'access-control-allow-methods': 'POST, OPTIONS, GET, HEAD', 'access-control-allow-headers': 'Authorization, Content-Type, X-CCD-Shop, X-File-Name', 'vary': 'Origin' } : {};
}
async function callAppsScript(payload, env) {
  if (!env.GAS_URL) return null;
  const form = new URLSearchParams();
  form.set('postData', JSON.stringify(payload));
  const response = await fetch(env.GAS_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded;charset=UTF-8' },
    body: form.toString(),
    redirect: 'follow',
    signal: AbortSignal.timeout(8000)
  });
  if (!response.ok) return null;
  try { return await response.json(); } catch (error) { return null; }
}
async function verifyAdminTarget(token, shopId, env) {
  if (!token || !shopId) return false;
  const result = await callAppsScript({ action: 'verifyAdminUploadTarget', adminToken: token, shopId }, env);
  return !!(result && result.status === 'success' && result.role === 'SUPER_ADMIN' && result.shopId === shopId);
}
function getTenant(host) {
  const suffix = '.ccd.dev';
  if (!host.endsWith(suffix)) return '';
  const sub = host.slice(0, -suffix.length);
  if (RESERVED.has(sub) || !/^[a-z0-9](?:[a-z0-9-]{1,48})[a-z0-9]$/.test(sub)) return '';
  return sub;
}
function applySecurityHeaders(response, host) {
  const out = new Response(response.body, response);
  out.headers.set('x-content-type-options', 'nosniff');
  out.headers.set('referrer-policy', 'strict-origin-when-cross-origin');
  out.headers.set('x-frame-options', 'DENY');
  out.headers.set('strict-transport-security', 'max-age=31536000; includeSubDomains');
  out.headers.set('permissions-policy', 'camera=(), microphone=(), geolocation=()');
  out.headers.set('cross-origin-opener-policy', 'same-origin-allow-popups');
  out.headers.set('cross-origin-resource-policy', 'same-site');
  return out;
}
function mapPath(host, pathname) {
  const path = pathname || '/';
  if (host === 'admin.ccd.dev' && path === '/') return '/admin.html';
  if (host === 'register.ccd.dev' && path === '/') return '/register.html';
  if (host === 'www.ccd.dev' && path === '/') return '/index.html';
  const tenant = getTenant(host);
  if (tenant) {
    const aliases = { '/': '/shop.html', '/desk': '/desk.html', '/merchant': '/merchant.html', '/customer': '/customer.html', '/nfc': '/nfc.html' };
    if (aliases[path]) return aliases[path];
  }
  return path;
}
async function handleUpload(request, env, origin) {
  const headers = cors(origin);
  if (request.method === 'OPTIONS') {
    if (!headers['access-control-allow-origin']) return new Response(null, { status: 403 });
    return new Response(null, { status: 204, headers });
  }
  if (!headers['access-control-allow-origin']) return json({ message: 'Origin is not allowed.' }, 403);
  if (request.method !== 'POST') return json({ message: 'POST required.' }, 405, headers);
  if (!env.MEDIA_BUCKET || !env.PUBLIC_MEDIA_BASE || !env.GAS_URL) return json({ message: 'Media Worker is not fully configured. Check R2 binding and Worker variables.' }, 503, headers);
  const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  const shop = String(request.headers.get('x-ccd-shop') || '').toLowerCase();
  if (!/^[a-z0-9_-]{3,50}$/.test(shop)) return json({ message: 'Invalid shop ID.' }, 400, headers);
  if (!(await verifyAdminTarget(token, shop, env))) return json({ message: 'Admin session expired or shop is not authorized for media upload.' }, 401, headers);
  const type = String(request.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  if (!ALLOWED_TYPES.has(type)) return json({ message: 'Only JPG, PNG, WebP, GIF, MP4 and WebM files are accepted.' }, 415, headers);
  const declared = Number(request.headers.get('content-length') || 0);
  if (declared > MAX_UPLOAD_BYTES) return json({ message: 'File exceeds the 25 MB limit.' }, 413, headers);
  const body = await request.arrayBuffer();
  if (!body.byteLength || body.byteLength > MAX_UPLOAD_BYTES) return json({ message: 'Empty file or file exceeds the 25 MB limit.' }, 413, headers);
  const bytes = new Uint8Array(body);
  const starts = (...values) => values.every((value, index) => bytes[index] === value);
  const ascii = (offset, value) => value.split('').every((ch, index) => bytes[offset + index] === ch.charCodeAt(0));
  const signatureOk = type === 'image/jpeg' ? starts(0xff,0xd8,0xff) : type === 'image/png' ? starts(0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a) : type === 'image/gif' ? (ascii(0,'GIF87a') || ascii(0,'GIF89a')) : type === 'image/webp' ? (ascii(0,'RIFF') && ascii(8,'WEBP')) : type === 'video/mp4' ? ascii(4,'ftyp') : type === 'video/webm' ? starts(0x1a,0x45,0xdf,0xa3) : false;
  if (!signatureOk) return json({ message: 'File contents do not match the selected media type.' }, 415, headers);
  const key = `${shop}/${crypto.randomUUID()}.${EXTENSIONS[type]}`;
  await env.MEDIA_BUCKET.put(key, body, { httpMetadata: { contentType: type, cacheControl: 'public, max-age=31536000, immutable' }, customMetadata: { shopId: shop, uploadedBy: 'SUPER_ADMIN' } });
  const base = String(env.PUBLIC_MEDIA_BASE).replace(/\/$/, '');
  return json({ status: 'success', key, url: `${base}/${key}`, type, size: body.byteLength }, 201, headers);
}
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const host = url.hostname.toLowerCase();
    if (host === 'media.ccd.dev') {
      if (!env.MEDIA_BUCKET) return new Response('Media storage is not configured.', { status: 503 });
      if (request.method !== 'GET' && request.method !== 'HEAD') return new Response('Method not allowed', { status: 405 });
      let key = '';
      try { key = decodeURIComponent(url.pathname.replace(/^\//, '')); } catch (error) { return new Response('Not found', { status: 404 }); }
      if (!key || key.includes('..') || key.startsWith('/') || key.includes('\\')) return new Response('Not found', { status: 404 });
      const object = await env.MEDIA_BUCKET.get(key);
      if (!object) return new Response('Not found', { status: 404 });
      const h = new Headers(); object.writeHttpMetadata(h); h.set('etag', object.httpEtag); h.set('cache-control', 'public, max-age=31536000, immutable');
      h.set('x-content-type-options', 'nosniff'); h.set('cross-origin-resource-policy', 'cross-origin');
      h.set('strict-transport-security', 'max-age=31536000; includeSubDomains');
      h.set('permissions-policy', 'camera=(), microphone=(), geolocation=()');
      h.set('x-frame-options', 'DENY');
      h.set('referrer-policy', 'no-referrer');
      h.set('content-security-policy', "default-src 'none'; sandbox");
      return new Response(request.method === 'HEAD' ? null : object.body, { headers: h });
    }
    if (url.pathname === '/upload' && host === 'admin.ccd.dev') return applySecurityHeaders(await handleUpload(request, env, request.headers.get('origin') || ''), host);
    if (host === 'admin.ccd.dev' && url.pathname === '/upload') return applySecurityHeaders(json({ message: 'Upload endpoint.' }, 405), host);
    if (!ALLOWED_ROOT_HOSTS.has(host) && !getTenant(host)) return applySecurityHeaders(new Response('Unknown CCD host.', { status: 404 }), host);
    if (!env.PAGES_ORIGIN) return applySecurityHeaders(new Response('Worker is missing PAGES_ORIGIN.', { status: 503 }), host);
    const origin = String(env.PAGES_ORIGIN).replace(/\/$/, '');
    const target = new URL(origin + mapPath(host, url.pathname) + url.search);
    const proxyRequest = new Request(target.toString(), request);
    const response = await fetch(proxyRequest);
    return applySecurityHeaders(response, host);
  }
};
