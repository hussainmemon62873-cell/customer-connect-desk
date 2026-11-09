/**
 * Same-origin Cloudflare Pages API proxy for the independent Dynamic QR Apps Script.
 * Configure DQR_APPS_SCRIPT_URL as a Cloudflare Pages environment variable.
 */
function jsonResponse(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store, max-age=0',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'X-Frame-Options': 'DENY',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
      'Cross-Origin-Resource-Policy': 'same-origin',
      'Strict-Transport-Security': 'max-age=31536000',
      'X-Permitted-Cross-Domain-Policies': 'none',
      ...extraHeaders
    }
  });
}

function validateAppsScriptUrl(value) {
  let url;
  try { url = new URL(String(value || '').trim()); }
  catch (_) { throw new Error('Cloudflare Pages is missing a valid DQR_APPS_SCRIPT_URL environment variable.'); }
  if (url.protocol !== 'https:' || url.hostname !== 'script.google.com' || !/^\/macros\/s\/[^/]+\/exec\/?$/.test(url.pathname) || url.username || url.password || url.search || url.hash) {
    throw new Error('DQR_APPS_SCRIPT_URL must be the HTTPS Google Apps Script Web App URL ending in /exec.');
  }
  return url.toString();
}

function validateProxySecret(value) {
  const secret = String(value || '').trim();
  if (!/^[A-F0-9]{64,128}$/i.test(secret)) {
    throw new Error('Cloudflare Pages is missing a valid DQR_PROXY_HMAC_SECRET secret (64–128 hexadecimal characters).');
  }
  return secret;
}

function toHex(bytes) {
  return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('');
}

async function signProxyEnvelope(envelopeText, secret) {
  if (!globalThis.crypto || !globalThis.crypto.subtle) throw new Error('Secure request signing is not available in this runtime.');
  const key = await globalThis.crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const signature = await globalThis.crypto.subtle.sign('HMAC', key, new TextEncoder().encode(envelopeText));
  return toHex(signature);
}

function createProxyNonce() {
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  return toHex(bytes);
}

function isAllowedContentRedirect(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === 'script.googleusercontent.com' && !url.username && !url.password;
  } catch (_) {
    return false;
  }
}

async function readAppsScriptResponse(target, body) {
  // Do not automatically follow a 302 for the POST: POST has already executed at
  // Apps Script, and the redirect only retrieves its generated ContentService body.
  // Re-POSTing on a transient redirect-content error could duplicate sheet writes.
  let response = await fetch(target, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
      'Accept': 'application/json'
    },
    body,
    redirect: 'manual'
  });

  if ([301, 302, 303, 307, 308].includes(response.status)) {
    const location = response.headers.get('location');
    if (!location || !isAllowedContentRedirect(location)) {
      throw new Error('Apps Script returned an unexpected or unsafe content redirect.');
    }

    let lastResponse = null;
    // Google documents the one-time googleusercontent redirect. A short retry of
    // that GET is safe; the original state-changing POST is never repeated.
    for (let attempt = 0; attempt < 4; attempt++) {
      lastResponse = await fetch(location, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        redirect: 'manual'
      });
      if (lastResponse.status !== 404 && lastResponse.status < 500) break;
      if (attempt < 3) await new Promise(resolve => setTimeout(resolve, 400 * (attempt + 1)));
    }
    response = lastResponse;
  }

  if ([301, 302, 303, 307, 308].includes(response.status)) {
    throw new Error('Apps Script returned an unexpected second redirect.');
  }
  return response;
}

async function readAppsScriptPublicContent(target) {
  const url = new URL(target);
  url.searchParams.set('public', 'content');
  let response = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    response = await fetch(url.toString(), {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      redirect: 'manual'
    });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location');
      if (!location || !isAllowedContentRedirect(location)) {
        throw new Error('Apps Script returned an unexpected or unsafe public-content redirect.');
      }
      response = await fetch(location, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        redirect: 'manual'
      });
    }
    if (response.status !== 404 && response.status < 500) break;
    if (attempt < 2) await new Promise(resolve => setTimeout(resolve, 250 * (attempt + 1)));
  }
  if ([301, 302, 303, 307, 308].includes(response.status)) {
    throw new Error('Apps Script returned an unexpected second redirect.');
  }
  return response;
}

async function publicContentResponse(request, env) {
  let target;
  try { target = validateAppsScriptUrl(env && env.DQR_APPS_SCRIPT_URL); }
  catch (error) { return jsonResponse({ ok: false, error: error.message }, 503); }

  const requestUrl = new URL(request.url);
  const cacheKey = new Request(new URL('/api/dynamic-qr?public=content', requestUrl.origin).toString(), { method: 'GET' });
  const edgeCache = typeof caches !== 'undefined' ? caches.default : null;
  if (edgeCache) {
    try {
      const cached = await edgeCache.match(cacheKey);
      if (cached) {
        const headers = new Headers(cached.headers);
        headers.set('X-DQR-Cache', 'HIT');
        return new Response(cached.body, { status: cached.status, headers });
      }
    } catch (_) { /* Edge cache is optional; origin data remains authoritative. */ }
  }

  let upstream;
  try { upstream = await readAppsScriptPublicContent(target); }
  catch (error) {
    return jsonResponse({ ok: false, error: error && error.message ? error.message : 'Public content service unavailable.' }, 502);
  }

  let result;
  try { result = JSON.parse(await upstream.text()); }
  catch (_) { return jsonResponse({ ok: false, error: 'Apps Script returned invalid public-content JSON.' }, 502); }
  if (!upstream.ok || !result || result.ok !== true || !result.data || !Array.isArray(result.data.pages)) {
    return jsonResponse({ ok: false, error: 'Public content could not be loaded.' }, 502);
  }

  const response = jsonResponse(result, 200, {
    'Cache-Control': 'public, max-age=30, s-maxage=60, stale-while-revalidate=120',
    'X-DQR-Cache': 'MISS'
  });
  if (edgeCache) {
    try { await edgeCache.put(cacheKey, response.clone()); }
    catch (_) { /* Cache failure must never block public page rendering. */ }
  }
  return response;
}

export async function onRequest({ request, env }) {
  const requestUrl = new URL(request.url);
  if (requestUrl.pathname !== '/api/dynamic-qr') return jsonResponse({ ok: false, error: 'Not found.' }, 404);
  if (request.method === 'GET') {
    if (requestUrl.searchParams.get('public') === 'content') return publicContentResponse(request, env);
    return jsonResponse({ ok: false, error: 'Method not allowed.' }, 405);
  }
  if (request.method !== 'POST') return jsonResponse({ ok: false, error: 'Method not allowed.' }, 405);

  // POST is a browser-only same-origin API. Reject missing Origin as well as
  // cross-site requests so HTML forms and other CSRF-style requests cannot use it.
  const origin = request.headers.get('Origin');
  const fetchSite = String(request.headers.get('Sec-Fetch-Site') || '').toLowerCase();
  if (!origin || origin !== requestUrl.origin || (fetchSite && !['same-origin', 'none'].includes(fetchSite))) {
    return jsonResponse({ ok: false, error: 'Same-origin API requests are required.' }, 403);
  }

  let target, proxySecret;
  try {
    target = validateAppsScriptUrl(env && env.DQR_APPS_SCRIPT_URL);
    proxySecret = validateProxySecret(env && env.DQR_PROXY_HMAC_SECRET);
  } catch (error) { return jsonResponse({ ok: false, error: error.message }, 503); }

  const contentType = String(request.headers.get('content-type') || '').toLowerCase();
  if (!contentType.startsWith('application/x-www-form-urlencoded')) {
    return jsonResponse({ ok: false, error: 'Expected an URL-encoded API request.' }, 415);
  }

  let body;
  try { body = await request.text(); }
  catch (_) { return jsonResponse({ ok: false, error: 'Could not read the API request body.' }, 400); }
  // 250 QR destinations can approach 512 KB at the 2,048-character URL limit.
  if (!body || body.length > 750000) return jsonResponse({ ok: false, error: 'API request body is empty or too large.' }, 413);

  let serialized = '';
  try {
    const form = new URLSearchParams(body);
    serialized = form.get('postData') || '';
    if (!serialized) return jsonResponse({ ok: false, error: 'Missing postData request parameter.' }, 400);
    const payload = JSON.parse(serialized);
    if (!payload || typeof payload !== 'object' || Array.isArray(payload) || typeof payload.action !== 'string' || !/^[A-Za-z][A-Za-z0-9]{0,63}$/.test(payload.action)) {
      return jsonResponse({ ok: false, error: 'Invalid API request payload.' }, 400);
    }
  } catch (_) {
    return jsonResponse({ ok: false, error: 'The postData parameter must contain valid JSON.' }, 400);
  }

  let signedBody;
  try {
    const timestamp = Math.floor(Date.now() / 1000);
    const envelope = JSON.stringify({ version: 1, timestamp, nonce: createProxyNonce(), payload: serialized });
    const signature = await signProxyEnvelope(envelope, proxySecret);
    signedBody = new URLSearchParams({ dqrEnvelope: envelope, dqrSignature: signature }).toString();
  } catch (error) {
    return jsonResponse({ ok: false, error: error && error.message ? error.message : 'Could not sign the API request.' }, 503);
  }

  let upstreamResponse;
  let upstreamText = '';
  try {
    upstreamResponse = await readAppsScriptResponse(target, signedBody);
    upstreamText = await upstreamResponse.text();
  } catch (error) {
    return jsonResponse({ ok: false, error: error && error.message ? error.message : 'The Dynamic QR Apps Script could not be reached. Check its deployment and availability.' }, 502);
  }

  let result;
  try { result = JSON.parse(upstreamText); }
  catch (_) { return jsonResponse({ ok: false, error: 'Apps Script returned a non-JSON response. Verify that the Web App is deployed with access set to Anyone.' }, 502); }

  if (!result || typeof result !== 'object' || Array.isArray(result) || typeof result.ok !== 'boolean') {
    return jsonResponse({ ok: false, error: 'Apps Script returned an invalid JSON response format. Verify the deployed backend version.' }, 502);
  }
  if (!upstreamResponse.ok) {
    return jsonResponse(result, 502);
  }
  return jsonResponse(result, 200);
}
