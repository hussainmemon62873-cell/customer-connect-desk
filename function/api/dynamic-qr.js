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
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
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
  if (request.method === 'GET') {
    if (requestUrl.pathname === '/api/dynamic-qr' && requestUrl.searchParams.get('public') === 'content') return publicContentResponse(request, env);
    return jsonResponse({ ok: false, error: 'Method not allowed.' }, 405);
  }
  if (request.method !== 'POST') return jsonResponse({ ok: false, error: 'Method not allowed.' }, 405);
  const origin = request.headers.get('Origin');
  if (origin && origin !== requestUrl.origin) return jsonResponse({ ok: false, error: 'Cross-origin API requests are not allowed.' }, 403);

  let target;
  try { target = validateAppsScriptUrl(env && env.DQR_APPS_SCRIPT_URL); }
  catch (error) { return jsonResponse({ ok: false, error: error.message }, 503); }

  const contentType = String(request.headers.get('content-type') || '').toLowerCase();
  if (!contentType.startsWith('application/x-www-form-urlencoded')) {
    return jsonResponse({ ok: false, error: 'Expected an URL-encoded API request.' }, 415);
  }

  let body;
  try { body = await request.text(); }
  catch (_) { return jsonResponse({ ok: false, error: 'Could not read the API request body.' }, 400); }
  if (!body || body.length > 100000) return jsonResponse({ ok: false, error: 'API request body is empty or too large.' }, 413);

  try {
    const form = new URLSearchParams(body);
    const serialized = form.get('postData');
    if (!serialized) return jsonResponse({ ok: false, error: 'Missing postData request parameter.' }, 400);
    const payload = JSON.parse(serialized);
    if (!payload || typeof payload !== 'object' || Array.isArray(payload) || typeof payload.action !== 'string' || !payload.action) {
      return jsonResponse({ ok: false, error: 'Invalid API request payload.' }, 400);
    }
  } catch (_) {
    return jsonResponse({ ok: false, error: 'The postData parameter must contain valid JSON.' }, 400);
  }

  let upstreamResponse;
  let upstreamText = '';
  try {
    upstreamResponse = await readAppsScriptResponse(target, body);
    upstreamText = await upstreamResponse.text();
  } catch (error) {
    return jsonResponse({ ok: false, error: error && error.message ? error.message : 'The Dynamic QR Apps Script could not be reached. Check its deployment and availability.' }, 502);
  }

  let result;
  try { result = JSON.parse(upstreamText); }
  catch (_) { return jsonResponse({ ok: false, error: 'Apps Script returned a non-JSON response. Verify that the Web App is deployed with access set to Anyone.' }, 502); }

  if (!upstreamResponse.ok) {
    return jsonResponse(result && typeof result === 'object' ? result : { ok: false, error: 'Apps Script request failed.' }, 502);
  }
  return jsonResponse(result, 200);
}
