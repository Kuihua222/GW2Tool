/**
 * GW2 Toolbox - Cloudflare Worker Backend
 * Features: Static asset serving, API proxy, KV data persistence
 */

// ===== CORS Headers =====
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders,
    },
  });
}

function errorResponse(message, status = 400) {
  return jsonResponse({ error: message }, status);
}

// ===== Static Assets (Embedded) =====
// In production, these are served by Cloudflare Pages or external storage
// For Workers-only deployment, we serve the SPA and let it fetch from CDN

// ===== KV Data API =====
async function handleDataRequest(request, env, userId) {
  const url = new URL(request.url);
  const path = url.pathname;
  const key = path.replace('/api/data/', '');

  if (!key || key.includes('..')) {
    return errorResponse('Invalid key', 400);
  }

  const kvKey = `user:${userId}:${key}`;

  switch (request.method) {
    case 'GET': {
      const value = await env.GW2_DATA.get(kvKey);
      if (value === null) {
        return jsonResponse({ data: null });
      }
      try {
        return jsonResponse({ data: JSON.parse(value) });
      } catch {
        return jsonResponse({ data: value });
      }
    }

    case 'POST':
    case 'PUT': {
      const body = await request.text();
      if (!body) {
        return errorResponse('Empty body', 400);
      }
      // Validate JSON
      try {
        JSON.parse(body);
      } catch {
        return errorResponse('Invalid JSON', 400);
      }
      await env.GW2_DATA.put(kvKey, body);
      return jsonResponse({ success: true });
    }

    case 'DELETE': {
      await env.GW2_DATA.delete(kvKey);
      return jsonResponse({ success: true });
    }

    default:
      return errorResponse('Method not allowed', 405);
  }
}

// ===== API Proxy =====
async function handleApiProxy(request) {
  const url = new URL(request.url);
  const targetPath = url.pathname.replace('/gw2api', '');
  const targetUrl = `https://gw2.wishingstarmoye.com/gw2api${targetPath}${url.search}`;

  try {
    const response = await fetch(targetUrl, {
      method: request.method,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'GW2-Toolbox-Worker/1.0',
      },
    });

    const data = await response.text();
    return new Response(data, {
      status: response.status,
      headers: {
        'Content-Type': response.headers.get('Content-Type') || 'application/json',
        ...corsHeaders,
      },
    });
  } catch (error) {
    return errorResponse('Proxy error: ' + error.message, 502);
  }
}

// ===== Auth Helpers =====
function getUserId(request) {
  const url = new URL(request.url);
  const token = url.searchParams.get('token') || request.headers.get('Authorization')?.replace('Bearer ', '');
  // Simple token-based auth: token is the user ID itself (or a hash)
  // In production, you should use JWT or Cloudflare Access
  return token || 'anonymous';
}

// ===== Export/Import API =====
async function handleExport(request, env, userId) {
  const prefix = `user:${userId}:`;
  const list = await env.GW2_DATA.list({ prefix });

  const data = {};
  for (const key of list.keys) {
    const value = await env.GW2_DATA.get(key.name);
    try {
      data[key.name.replace(prefix, '')] = JSON.parse(value);
    } catch {
      data[key.name.replace(prefix, '')] = value;
    }
  }

  return jsonResponse({
    exportedAt: new Date().toISOString(),
    version: '2.0',
    ...data,
  });
}

async function handleImport(request, env, userId) {
  const body = await request.json();
  const prefix = `user:${userId}:`;

  const keys = ['projects', 'trades', 'todos', 'daily_progress', 'theme', 'daily_preview_type'];
  for (const key of keys) {
    if (body[key] !== undefined) {
      await env.GW2_DATA.put(`${prefix}${key}`, JSON.stringify(body[key]));
    }
  }

  return jsonResponse({ success: true });
}

// ===== Main Request Handler =====
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // API Routes
    if (url.pathname.startsWith('/api/')) {
      const userId = getUserId(request);

      if (url.pathname === '/api/export') {
        return handleExport(request, env, userId);
      }

      if (url.pathname === '/api/import') {
        return handleImport(request, env, userId);
      }

      if (url.pathname.startsWith('/api/data/')) {
        return handleDataRequest(request, env, userId);
      }

      return errorResponse('Not found', 404);
    }

    // Proxy GW2 API
    if (url.pathname.startsWith('/gw2api/')) {
      return handleApiProxy(request);
    }

    // Serve static assets - try to get from KV first, then fallback to embedded
    const path = url.pathname === '/' ? '/index.html' : url.pathname;

    // Try to serve from KV storage (for deployed assets)
    try {
      const asset = await env.GW2_DATA.get(`__asset__${path}`, 'arrayBuffer');
      if (asset) {
        const contentType = getContentType(path);
        return new Response(asset, {
          headers: {
            'Content-Type': contentType,
            'Cache-Control': 'public, max-age=3600',
            ...corsHeaders,
          },
        });
      }
    } catch {
      // Fall through to embedded assets
    }

    // Fallback: return SPA for client-side routing
    // In production with Pages, this is handled automatically
    return new Response('GW2 Toolbox Worker is running. Please deploy frontend assets to Cloudflare Pages or use wrangler pages deploy.', {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        ...corsHeaders,
      },
    });
  },
};

function getContentType(path) {
  const ext = path.split('.').pop()?.toLowerCase();
  const types = {
    html: 'text/html; charset=utf-8',
    css: 'text/css; charset=utf-8',
    js: 'application/javascript; charset=utf-8',
    json: 'application/json',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    svg: 'image/svg+xml',
    ico: 'image/x-icon',
    woff2: 'font/woff2',
    woff: 'font/woff',
  };
  return types[ext] || 'application/octet-stream';
}
