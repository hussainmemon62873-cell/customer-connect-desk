/**
 * Customer Connect Desk wildcard router, media upload gateway and public SEO renderer.
 * Runtime source only: configure PAGES_ORIGIN, PUBLIC_MEDIA_BASE and GAS_URL,
 * and bind MEDIA_BUCKET. Public SEO is read from an allow-listed Apps Script API.
 */
const RESERVED = new Set(['www', 'admin', 'register', 'api', 'assets', 'support', 'mail', 'media']);
const ALLOWED_ROOT_HOSTS = new Set(['ccd.dev', 'www.ccd.dev', 'admin.ccd.dev', 'register.ccd.dev', 'media.ccd.dev']);
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
const SEO_PAGE_SIZE = 5000;
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm']);
const EXTENSIONS = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'video/mp4': 'mp4', 'video/webm': 'webm' };

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers } });
}
function xml(body, status = 200) {
  return new Response(body, { status, headers: { 'content-type': 'application/xml; charset=utf-8', 'cache-control': 'public, max-age=300, s-maxage=900, stale-while-revalidate=3600', 'x-content-type-options': 'nosniff' } });
}
function text(body, status = 200, headers = {}) {
  return new Response(body, { status, headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'public, max-age=300, s-maxage=900', 'x-content-type-options': 'nosniff', ...headers } });
}
function cors(origin) {
  const allowed = new Set(['https://admin.ccd.dev', 'https://customer-connect-desk.pages.dev']);
  return allowed.has(origin) ? { 'access-control-allow-origin': origin, 'access-control-allow-methods': 'POST, OPTIONS, GET, HEAD', 'access-control-allow-headers': 'Authorization, Content-Type, X-CCD-Shop, X-File-Name', 'vary': 'Origin' } : {};
}
async function callAppsScript(payload, env) {
  if (!env.GAS_URL || !/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(String(env.GAS_URL))) return null;
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

// First-party API gateway for browser clients. This prevents browser fetch() from
// receiving a Google Apps Script login/redirect page and keeps GAS_URL server-side.
function apiCorsHeaders(request, host) {
  const origin = request.headers.get('origin') || '';
  if (!origin) return { allowed: true, headers: {} };
  const requestOrigin = new URL(request.url).origin;
  const pagesFallbackOrigin = host === 'admin.ccd.dev' && origin === 'https://customer-connect-desk.pages.dev';
  if (origin !== requestOrigin && !pagesFallbackOrigin) return { allowed: false, headers: {} };
  return { allowed: true, headers: {
    'access-control-allow-origin': origin,
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'access-control-allow-headers': 'Content-Type',
    'access-control-max-age': '86400',
    'vary': 'Origin'
  }};
}
function isValidCcdApiHost(host) {
  return host !== 'media.ccd.dev' && (ALLOWED_ROOT_HOSTS.has(host) || !!getTenant(host));
}
function googleDeploymentError(response, body) {
  const finalHost = (() => { try { return new URL(response.url).hostname.toLowerCase(); } catch (err) { return ''; } })();
  const sample = String(body || '').slice(0, 6000);
  return finalHost === 'accounts.google.com' || /accounts\.google\.com|ServiceLogin|Sign in to continue|Google Accounts|identifierNext|passwordNext/i.test(sample);
}
async function readAppsScriptJson(response) {
  const body = await response.text();
  let parsed = null;
  try { parsed = JSON.parse(body); } catch (err) {}
  return { body, parsed };
}
async function handleApiHealth(request, env, host) {
  const corsResult = apiCorsHeaders(request, host);
  if (!corsResult.allowed) return json({ status: 'error', code: 'ORIGIN_DENIED', message: 'This webpage origin is not allowed to call the CCD API.' }, 403);
  const headers = corsResult.headers;
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (request.method !== 'GET') return json({ status: 'error', message: 'GET required for the connection check.' }, 405, headers);
  if (!env.GAS_URL || !/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(String(env.GAS_URL))) {
    return json({ status: 'error', code: 'GAS_URL_MISSING', message: 'The Cloudflare Worker GAS_URL variable is missing or invalid.' }, 503, headers);
  }
  try {
    const response = await fetch(env.GAS_URL, { method: 'GET', redirect: 'follow', headers: { accept: 'application/json' }, signal: AbortSignal.timeout(15000) });
    const { body, parsed } = await readAppsScriptJson(response);
    if (!response.ok || !parsed || typeof parsed !== 'object' || Array.isArray(parsed) || parsed.status !== 'success' || parsed.isPlatformRoot !== true) {
      if (googleDeploymentError(response, body)) return json({ status: 'error', code: 'GOOGLE_AUTH_REQUIRED', message: 'Google Apps Script is requesting Google sign-in instead of returning the public CCD response. Set the Web App to Execute as: Me and Who has access: Anyone, then deploy a new version.' }, 502, headers);
      return json({ status: 'error', code: 'GAS_HEALTH_FAILED', message: 'Apps Script did not return the expected CCD health response. Confirm that GAS_URL points to the current CCD /exec deployment.' }, 502, headers);
    }
    return json({ status: 'success', gateway: 'Cloudflare Worker', backend: 'Google Apps Script', reachable: true, message: 'Cloudflare API gateway and Google Apps Script are reachable.' }, 200, headers);
  } catch (error) {
    return json({ status: 'error', code: 'GAS_UNREACHABLE', message: 'Cloudflare could not reach Google Apps Script. Check the GAS_URL Worker variable and Apps Script deployment.' }, 502, headers);
  }
}
async function handleApiGateway(request, env, host) {
  const corsResult = apiCorsHeaders(request, host);
  if (!corsResult.allowed) return json({ status: 'error', code: 'ORIGIN_DENIED', message: 'This webpage origin is not allowed to call the CCD API.' }, 403);
  const headers = corsResult.headers;
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (request.method !== 'POST') return json({ status: 'error', message: 'POST required for CCD API actions.' }, 405, headers);
  if (!env.GAS_URL || !/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(String(env.GAS_URL))) {
    return json({ status: 'error', code: 'GAS_URL_MISSING', message: 'The Cloudflare Worker GAS_URL variable is missing or invalid.' }, 503, headers);
  }
  let raw = '';
  let payload;
  try {
    raw = await request.text();
    if (new TextEncoder().encode(raw).byteLength > 500000) return json({ status: 'error', message: 'Request is too large.' }, 413, headers);
    payload = JSON.parse(raw);
  } catch (error) {
    return json({ status: 'error', message: 'The CCD API request must contain valid JSON.' }, 400, headers);
  }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload) || typeof payload.action !== 'string' || !payload.action.trim()) {
    return json({ status: 'error', message: 'A valid CCD API action is required.' }, 400, headers);
  }
  const form = new URLSearchParams();
  form.set('postData', JSON.stringify(payload));
  try {
    const response = await fetch(env.GAS_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded;charset=UTF-8', accept: 'application/json' },
      body: form.toString(),
      redirect: 'follow',
      signal: AbortSignal.timeout(55000)
    });
    const { body, parsed } = await readAppsScriptJson(response);
    if (!response.ok || !parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      if (googleDeploymentError(response, body)) return json({ status: 'error', code: 'GOOGLE_AUTH_REQUIRED', message: 'Google Apps Script is requesting Google sign-in. Set the Web App to Execute as: Me and Who has access: Anyone, then deploy a new version.' }, 502, headers);
      return json({ status: 'error', code: 'GAS_BAD_RESPONSE', message: 'Google Apps Script did not return readable JSON. Check the deployment and Apps Script execution log.' }, 502, headers);
    }
    return json(parsed, 200, headers);
  } catch (error) {
    const timedOut = /timeout|aborted/i.test(String(error && error.message || error));
    return json({ status: 'error', code: timedOut ? 'GAS_TIMEOUT' : 'GAS_UNREACHABLE', message: timedOut ? 'The CCD backend took too long to respond. Retry the request.' : 'Cloudflare could not reach Google Apps Script. Check the Worker route and GAS_URL.' }, 502, headers);
  }
}

async function cachedAppsScript(payload, cacheKey, ttlSeconds, env) {
  const keyRequest = new Request('https://seo-cache.ccd.dev/' + encodeURIComponent(cacheKey));
  let cache = null;
  try { cache = caches.default; } catch (err) {}
  if (cache) {
    try {
      const hit = await cache.match(keyRequest);
      if (hit) return await hit.json();
    } catch (err) {}
  }
  const result = await callAppsScript(payload, env);
  if (result && result.status === 'success' && cache) {
    try {
      await cache.put(keyRequest, new Response(JSON.stringify(result), {
        headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=' + Math.max(60, ttlSeconds) }
      }));
    } catch (err) {}
  }
  return result;
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
  if ((host === 'ccd.dev' || host === 'www.ccd.dev') && path === '/') return '/platform.html';
  if ((host === 'ccd.dev' || host === 'www.ccd.dev') && path === '/acceptable-use') return '/acceptable-use.html';
  if ((host === 'ccd.dev' || host === 'www.ccd.dev') && path === '/checkin') return '/index.html';
  if (host === 'admin.ccd.dev' && path === '/') return '/admin.html';
  if (host === 'register.ccd.dev' && path === '/') return '/register.html';
  const tenant = getTenant(host);
  if (tenant) {
    const aliases = { '/': '/shop.html', '/desk': '/desk.html', '/merchant': '/merchant.html', '/customer': '/customer.html', '/nfc': '/nfc.html', '/acceptable-use': '/acceptable-use.html' };
    if (aliases[path]) return aliases[path];
  }
  return path;
}
function escHtml(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}
function cleanText(value, max = 800) {
  return String(value == null ? '' : value).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}
function safePublicUrl(value) {
  try {
    const url = new URL(String(value || ''));
    if (url.protocol !== 'https:' || url.username || url.password) return '';
    return url.href;
  } catch (err) { return ''; }
}
function jsonForHtml(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
}
function buildBusinessSchema(store, canonical) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: store.name,
    url: canonical,
    description: store.description,
    image: [store.image]
  };
  if (store.telephone) schema.telephone = store.telephone;
  if (store.address) schema.address = { '@type': 'PostalAddress', streetAddress: store.address };
  const catalog = [];
  (store.services || []).slice(0, 30).forEach(item => catalog.push({ '@type': 'Offer', itemOffered: { '@type': 'Service', name: item.name, description: item.description || undefined } }));
  (store.offers || []).slice(0, 30).forEach(item => {
    const offer = { '@type': 'Offer', itemOffered: { '@type': 'Product', name: item.name, description: item.description || undefined } };
    if (item.price && /^[\d,.₹$ ]+$/.test(item.price)) offer.description = 'Listed price: ' + item.price;
    catalog.push(offer);
  });
  if (catalog.length) schema.hasOfferCatalog = { '@type': 'OfferCatalog', name: 'Products and services', itemListElement: catalog };
  return schema;
}
function buildTenantSeoHtml(store, canonical) {
  const title = cleanText(store.name, 160) + ' | ' + cleanText(store.categoryLabel || 'Local business', 80) + ' | Customer Connect Desk';
  const description = cleanText(store.description || (store.name + ' on Customer Connect Desk.'), 300);
  const image = safePublicUrl(store.image) || 'https://ccd.dev/assets/ccd-social-preview.png';
  const schema = buildBusinessSchema(store, canonical);
  const tags = [
    '<meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1">',
    '<link rel="canonical" href="' + escHtml(canonical) + '">',
    '<meta property="og:type" content="website">',
    '<meta property="og:site_name" content="Customer Connect Desk">',
    '<meta property="og:title" content="' + escHtml(title) + '">',
    '<meta property="og:description" content="' + escHtml(description) + '">',
    '<meta property="og:url" content="' + escHtml(canonical) + '">',
    '<meta property="og:image" content="' + escHtml(image) + '">',
    '<meta property="og:image:alt" content="' + escHtml(store.name + ' — official business website') + '">',
    '<meta property="og:locale" content="en_IN">',
    '<meta name="twitter:card" content="summary_large_image">',
    '<meta name="twitter:title" content="' + escHtml(title) + '">',
    '<meta name="twitter:description" content="' + escHtml(description) + '">',
    '<meta name="twitter:image" content="' + escHtml(image) + '">',
    '<meta name="twitter:image:alt" content="' + escHtml(store.name + ' — official business website') + '">',
    '<script type="application/ld+json">' + jsonForHtml(schema) + '</script>'
  ].join('');
  const paragraphs = [];
  if (store.tagline) paragraphs.push('<p>' + escHtml(store.tagline) + '</p>');
  if (store.homeText) paragraphs.push('<p>' + escHtml(cleanText(store.homeText, 1800)) + '</p>');
  if (store.aboutText) paragraphs.push('<h3>About ' + escHtml(store.name) + '</h3><p>' + escHtml(cleanText(store.aboutText, 1800)) + '</p>');
  const serviceItems = (store.services || []).slice(0, 15).map(item => '<li><strong>' + escHtml(item.name) + '</strong>' + (item.description ? ' — ' + escHtml(item.description) : '') + '</li>').join('');
  const offerItems = (store.offers || []).slice(0, 15).map(item => '<li><strong>' + escHtml(item.name) + '</strong>' + (item.description ? ' — ' + escHtml(item.description) : '') + (item.price ? ' · ' + escHtml(item.price) : '') + '</li>').join('');
  const blogItems = (store.blog || []).slice(0, 10).map(item => '<li><strong>' + escHtml(item.title) + '</strong>' + (item.date ? ' · ' + escHtml(item.date) : '') + (item.description ? ' — ' + escHtml(item.description) : '') + '</li>').join('');
  const contact = [store.address ? '<p><strong>Address:</strong> ' + escHtml(store.address) + '</p>' : '', store.telephone ? '<p><strong>Phone:</strong> ' + escHtml(store.telephone) + '</p>' : '', store.mapUrl ? '<p><a href="' + escHtml(store.mapUrl) + '">View business location</a></p>' : '', store.reviewUrl ? '<p><a href="' + escHtml(store.reviewUrl) + '">View or leave a business review</a></p>' : ''].join('');
  const snapshot = '<section id="ccd-seo-snapshot" class="ccd-seo-snapshot" aria-label="Public business information" style="max-width:1120px;margin:18px auto;padding:18px 22px;border:1px solid #e2e8f0;border-radius:18px;background:#fff;color:#172033;font:15px/1.65 system-ui,sans-serif">' +
    '<p style="margin:0 0 6px;color:#64748b;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase">' + escHtml(store.categoryLabel || 'Local business') + '</p>' +
    '<h2 style="margin:0 0 8px;font-size:22px">' + escHtml(store.name) + '</h2>' + paragraphs.join('') +
    (serviceItems ? '<h3>Services</h3><ul>' + serviceItems + '</ul>' : '') +
    (offerItems ? '<h3>Products and pricing</h3><ul>' + offerItems + '</ul>' : '') +
    (blogItems ? '<h3>Latest updates</h3><ul>' + blogItems + '</ul>' : '') + contact +
    '<p style="margin-bottom:0;color:#64748b;font-size:12px">Official public information published by this business through Customer Connect Desk.</p></section>';
  return { title, description, tags, snapshot };
}
async function renderTenantSeo(response, store, canonical) {
  const seo = buildTenantSeoHtml(store, canonical);
  return new HTMLRewriter()
    .on('title', { element(element) { element.setInnerContent(seo.title); } })
    .on('meta[name="description"]', { element(element) { element.setAttribute('content', seo.description); } })
    .on('meta[name="robots"]', { element(element) { element.setAttribute('content', 'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1'); } })
    .on('head', { element(element) { element.append(seo.tags, { html: true }); } })
    .on('main', { element(element) { element.prepend(seo.snapshot, { html: true }); } })
    .transform(response);
}
const ROBOTS_COMMON = [
  'User-agent: Googlebot', 'Allow: /', 'Disallow: /checkin', 'Disallow: /index.html', '',
  'User-agent: Bingbot', 'Allow: /', 'Disallow: /checkin', 'Disallow: /index.html', '',
  // Google-Extended is separate from Google Search; block it by default to keep Gemini app/Vertex grounding and model-training uses opted out.
  // Google Search and its AI Overviews/AI Mode remain crawlable through Googlebot.
  'User-agent: Google-Extended', 'Disallow: /', '',
  'User-agent: OAI-SearchBot', 'Allow: /', '',
  'User-agent: ChatGPT-User', 'Allow: /', '',
  'User-agent: PerplexityBot', 'Allow: /', '',
  'User-agent: Perplexity-User', 'Allow: /', '',
  'User-agent: Claude-SearchBot', 'Allow: /', '',
  'User-agent: Claude-User', 'Allow: /', '',
  'User-agent: facebookexternalhit', 'Allow: /', '',
  'User-agent: Facebot', 'Allow: /', '',
  'User-agent: LinkedInBot', 'Allow: /', '',
  'User-agent: Twitterbot', 'Allow: /', '',
  'User-agent: WhatsApp', 'Allow: /', '',
  'User-agent: GPTBot', 'Disallow: /', '',
  'User-agent: ClaudeBot', 'Disallow: /', '',
  'User-agent: *', 'Allow: /', 'Disallow: /admin', 'Disallow: /merchant', 'Disallow: /customer', 'Disallow: /desk', 'Disallow: /nfc', 'Disallow: /register', 'Disallow: /checkin', 'Disallow: /index.html', ''
].join('\n');
function robotsForHost(host) {
  if (host === 'admin.ccd.dev' || host === 'register.ccd.dev') {
    return 'User-agent: *\nDisallow: /\n';
  }
  // The media hostname serves public business images/videos used by storefronts
  // and social preview cards. Crawlers need to fetch these assets for previews.
  if (host === 'media.ccd.dev') {
    return [
      'User-agent: Googlebot', 'Allow: /', '',
      'User-agent: Google-Extended', 'Disallow: /', '',
      'User-agent: Bingbot', 'Allow: /', '',
      'User-agent: OAI-SearchBot', 'Allow: /', '',
      'User-agent: PerplexityBot', 'Allow: /', '',
      'User-agent: Claude-SearchBot', 'Allow: /', '',
      'User-agent: facebookexternalhit', 'Allow: /', '',
      'User-agent: Facebot', 'Allow: /', '',
      'User-agent: LinkedInBot', 'Allow: /', '',
      'User-agent: Twitterbot', 'Allow: /', '',
      'User-agent: GPTBot', 'Disallow: /', '',
      'User-agent: ClaudeBot', 'Disallow: /', '',
      'User-agent: *', 'Allow: /', '',
      'Content-Signal: search=yes, ai-input=yes, ai-train=no'
    ].join('\n') + '\n';
  }
  const tenant = getTenant(host);
  const sitemap = tenant ? 'https://' + host + '/sitemap.xml' : 'https://ccd.dev/sitemap.xml';
  return ROBOTS_COMMON + '\nContent-Signal: search=yes, ai-input=yes, ai-train=no\n\nSitemap: ' + sitemap + '\n';
}
function sitemapUrl(loc, lastmod) {
  return '<url><loc>' + escHtml(loc) + '</loc>' + (lastmod ? '<lastmod>' + escHtml(lastmod) + '</lastmod>' : '') + '</url>';
}
async function handleRootSitemap(env) {
  const result = await cachedAppsScript({ action: 'getPublicSeoDirectory', offset: 0, limit: 1 }, 'seo-directory-count', 600, env);
  const total = result && result.status === 'success' ? Number(result.total || 0) : 0;
  const chunks = Math.ceil(total / SEO_PAGE_SIZE);
  const locations = ['https://ccd.dev/sitemap-main.xml'];
  for (let i = 1; i <= chunks; i++) locations.push('https://ccd.dev/sitemap-shops-' + i + '.xml');
  const body = '<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' + locations.map(loc => '<sitemap><loc>' + escHtml(loc) + '</loc></sitemap>').join('') + '</sitemapindex>';
  return xml(body, result && result.status === 'success' ? 200 : 503);
}
async function handleShopSitemap(env, pageNumber) {
  const page = Math.max(1, Math.min(100000, Number(pageNumber) || 1));
  const offset = (page - 1) * SEO_PAGE_SIZE;
  const result = await cachedAppsScript({ action: 'getPublicSeoDirectory', offset, limit: SEO_PAGE_SIZE }, 'seo-directory-page-' + page, 600, env);
  if (!result || result.status !== 'success') return xml('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>', 503);
  const urls = (result.stores || []).filter(item => item && /^[a-z0-9_-]{3,50}$/.test(String(item.shopId || ''))).map(item => sitemapUrl('https://' + item.shopId + '.ccd.dev/', item.lastmod || ''));
  return xml('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' + urls.join('') + '</urlset>');
}
async function handleMainSitemap() {
  const pages = ['https://ccd.dev/', 'https://ccd.dev/acceptable-use'];
  return xml('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' + pages.map(url => sitemapUrl(url, '')).join('') + '</urlset>');
}
async function handleTenantSitemap(host, env) {
  const slug = getTenant(host);
  const result = await cachedAppsScript({ action: 'getPublicStoreSEO', shopId: slug }, 'seo-shop-' + slug, 600, env);
  if (!result || result.status !== 'success' || !result.store) return xml('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>', 404);
  return xml('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' + sitemapUrl('https://' + slug + '.ccd.dev/', '') + '</urlset>');
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
    if (host === 'www.ccd.dev' && url.pathname !== '/api' && url.pathname !== '/api/health') {
      const next = new URL(request.url);
      next.hostname = 'ccd.dev';
      return Response.redirect(next.toString(), 301);
    }
    if (host === 'media.ccd.dev') {
      if (url.pathname === '/robots.txt' && (request.method === 'GET' || request.method === 'HEAD')) {
        return applySecurityHeaders(text(robotsForHost(host), 200), host);
      }
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
    if ((url.pathname === '/api' || url.pathname === '/api/health') && isValidCcdApiHost(host)) {
      const apiResponse = url.pathname === '/api/health'
        ? await handleApiHealth(request, env, host)
        : await handleApiGateway(request, env, host);
      const securedApiResponse = applySecurityHeaders(apiResponse, host);
      if (apiResponse.headers.has('access-control-allow-origin')) securedApiResponse.headers.set('cross-origin-resource-policy', 'cross-origin');
      return securedApiResponse;
    }
    if (!ALLOWED_ROOT_HOSTS.has(host) && !getTenant(host)) return applySecurityHeaders(new Response('Unknown CCD host.', { status: 404 }), host);
    if (!env.PAGES_ORIGIN) return applySecurityHeaders(new Response('Worker is missing PAGES_ORIGIN.', { status: 503 }), host);
    if (request.method === 'GET' || request.method === 'HEAD') {
      if (url.pathname === '/robots.txt') return applySecurityHeaders(text(robotsForHost(host), 200), host);
      if (url.pathname === '/sitemap.xml') {
        if (getTenant(host)) return applySecurityHeaders(await handleTenantSitemap(host, env), host);
        return applySecurityHeaders(await handleRootSitemap(env), host);
      }
      if (host === 'ccd.dev' && url.pathname === '/sitemap-main.xml') return applySecurityHeaders(await handleMainSitemap(), host);
      const shopsMatch = host === 'ccd.dev' ? url.pathname.match(/^\/sitemap-shops-(\d+)\.xml$/) : null;
      if (shopsMatch) return applySecurityHeaders(await handleShopSitemap(env, shopsMatch[1]), host);
    }
    const tenant = getTenant(host);
    const privatePaths = new Set(['/desk', '/merchant', '/customer', '/nfc', '/index.html', '/checkin', '/acceptable-use']);
    if (host === 'admin.ccd.dev' || host === 'register.ccd.dev' || (tenant && privatePaths.has(url.pathname))) {
      // The explicit noindex header is separate from robots.txt: the URL must remain crawlable
      // so compliant search engines can see and process the noindex directive.
    }
    const origin = String(env.PAGES_ORIGIN).replace(/\/$/, '');
    const target = new URL(origin + mapPath(host, url.pathname) + url.search);
    const proxyRequest = new Request(target.toString(), request);
    let response = await fetch(proxyRequest);
    if (tenant && url.pathname === '/' && request.method === 'GET' && response.ok) {
      const result = await cachedAppsScript({ action: 'getPublicStoreSEO', shopId: tenant }, 'seo-shop-' + tenant, 600, env);
      if (result && result.status === 'success' && result.store) {
        try { response = await renderTenantSeo(response, result.store, 'https://' + tenant + '.ccd.dev/'); }
        catch (err) { response = new Response(response.body, response); }
        response.headers.set('cache-control', 'public, max-age=0, s-maxage=300, stale-while-revalidate=600');
      }
    }
    if (host === 'admin.ccd.dev' || host === 'register.ccd.dev' || (tenant && privatePaths.has(url.pathname)) || (host === 'ccd.dev' && (url.pathname === '/checkin' || url.pathname === '/index.html'))) {
      const privateResponse = new Response(response.body, response);
      privateResponse.headers.set('x-robots-tag', 'noindex, nofollow, noarchive');
      response = privateResponse;
    }
    return applySecurityHeaders(response, host);
  }
};
