/**
 * GW2 Toolbox - Cloudflare Worker
 * Provides KV-based data persistence with password authentication
 */

const HEADER_PASSWORD = "x-gw2-password";
const HEADER_TOKEN = "x-gw2-token";
const KV_DATA_PREFIX = "gw2_data_";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === "/favicon.ico") {
      return new Response(null, { status: 204 });
    }

    if (url.pathname.startsWith("/api/")) {
      return await handleAPI(request, env);
    }

    if (url.pathname === "/" || url.pathname.endsWith(".html") || url.pathname.endsWith(".js") || url.pathname.endsWith(".css")) {
      return await handleStatic(request, env);
    }

    return new Response("GW2 Toolbox Worker is running", {
      headers: { "Content-Type": "text/plain" }
    });
  }
};

async function handleStatic(request, env) {
  const url = new URL(request.url);
  let path = url.pathname;

  if (path === "/" || path === "/index.html") {
    path = "/index.html";
  }

  const cacheKey = `static_${path}`;
  const cached = await env.KV.get(cacheKey);
  if (cached) {
    return new Response(cached.body, {
      headers: {
        "Content-Type": getContentType(path),
        "Cache-Control": "public, max-age=86400"
      }
    });
  }

  const objectKey = path.substring(1);
  const object = await env.ASSETS.get(objectKey);

  if (object) {
    const body = await object.text();
    await env.KV.put(cacheKey, body, { expirationTtl: 86400 });
    return new Response(body, {
      headers: {
        "Content-Type": getContentType(path),
        "Cache-Control": "public, max-age=86400"
      }
    });
  }

  return new Response("Not Found", { status: 404 });
}

function getContentType(path) {
  if (path.endsWith(".html")) return "text/html; charset=utf-8";
  if (path.endsWith(".js")) return "application/javascript";
  if (path.endsWith(".css")) return "text/css";
  if (path.endsWith(".ico")) return "image/x-icon";
  return "text/plain";
}

async function handleAPI(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;

  if (path === "/api/auth") {
    return await handleAuth(request, env);
  }

  const token = request.headers.get(HEADER_TOKEN);
  if (!token) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  const valid = await verifyToken(token, env);
  if (!valid) {
    return jsonResponse({ error: "Invalid token" }, 401);
  }

  if (path === "/api/data" && request.method === "GET") {
    return await getAllData(env);
  }

  if (path.startsWith("/api/data/")) {
    const key = path.substring("/api/data/".length);
    return await handleDataRequest(request, env, key);
  }

  if (path === "/api/export") {
    return await exportAllData(env);
  }

  return jsonResponse({ error: "Not found" }, 404);
}

async function handleAuth(request, env) {
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON" }, 400);
  }

  const { password, action } = body;

  if (!password) {
    return jsonResponse({ error: "Password required" }, 400);
  }

  if (action === "check") {
    const storedHash = await env.KV.get("gw2_password_hash");
    if (!storedHash) {
      return jsonResponse({ exists: false });
    }
    const isValid = await verifyPassword(password, storedHash);
    if (isValid) {
      const token = generateToken();
      await storeToken(token, env);
      return jsonResponse({ authenticated: true, token });
    }
    return jsonResponse({ authenticated: false });
  }

  if (action === "setup") {
    const exists = await env.KV.get("gw2_password_hash");
    if (exists) {
      return jsonResponse({ error: "Already configured" }, 403);
    }

    const hash = await hashPassword(password);
    await env.KV.put("gw2_password_hash", hash);

    const token = generateToken();
    await storeToken(token, env);

    return jsonResponse({ success: true, token });
  }

  if (action === "login") {
    const storedHash = await env.KV.get("gw2_password_hash");
    if (!storedHash) {
      return jsonResponse({ error: "Not configured" }, 400);
    }

    const isValid = await verifyPassword(password, storedHash);
    if (!isValid) {
      return jsonResponse({ error: "Invalid password" }, 401);
    }

    const token = generateToken();
    await storeToken(token, env);

    return jsonResponse({ success: true, token });
  }

  return jsonResponse({ error: "Invalid action" }, 400);
}

async function handleDataRequest(request, env, key) {
  const fullKey = KV_DATA_PREFIX + key;

  if (request.method === "GET") {
    const value = await env.KV.get(fullKey);
    if (value === null) {
      return jsonResponse({ data: null });
    }
    try {
      return jsonResponse({ data: JSON.parse(value) });
    } catch {
      return jsonResponse({ data: value });
    }
  }

  if (request.method === "POST") {
    let body;
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ error: "Invalid JSON" }, 400);
    }

    if (body === null || body === undefined) {
      return jsonResponse({ error: "No data provided" }, 400);
    }

    const value = JSON.stringify(body);
    await env.KV.put(fullKey, value);
    return jsonResponse({ success: true });
  }

  if (request.method === "DELETE") {
    await env.KV.delete(fullKey);
    return jsonResponse({ success: true });
  }

  return jsonResponse({ error: "Method not allowed" }, 405);
}

async function getAllData(env) {
  const keys = ["projects", "trades", "todos", "daily_progress", "theme", "daily_preview_type"];
  const result = {};

  for (const key of keys) {
    const fullKey = KV_DATA_PREFIX + key;
    const value = await env.KV.get(fullKey);
    if (value !== null) {
      try {
        result[key] = JSON.parse(value);
      } catch {
        result[key] = value;
      }
    }
  }

  return jsonResponse({ data: result });
}

async function exportAllData(env) {
  const keys = ["projects", "trades", "todos", "daily_progress", "theme", "daily_preview_type"];
  const result = {
    exportedAt: new Date().toISOString(),
    version: "2.0"
  };

  for (const key of keys) {
    const fullKey = KV_DATA_PREFIX + key;
    const value = await env.KV.get(fullKey);
    if (value !== null) {
      try {
        result[key] = JSON.parse(value);
      } catch {
        result[key] = value;
      }
    }
  }

  return new Response(JSON.stringify(result, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="gw2_toolbox_backup_${new Date().toISOString().split('T')[0]}.json"`
    }
  });
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + "gw2_salt_2024");
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

async function verifyPassword(password, storedHash) {
  const hash = await hashPassword(password);
  return hash === storedHash;
}

function generateToken() {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array).map(b => b.toString(16).padStart(2, "0")).join("");
}

async function verifyToken(token, env) {
  if (!token || token.length !== 64) return false;
  const key = `gw2_token_${token}`;
  const exists = await env.KV.get(key);
  return exists === "valid";
}

async function storeToken(token, env) {
  const key = `gw2_token_${token}`;
  await env.KV.put(key, "valid", { expirationTtl: 60 * 60 * 24 * 30 });
}
