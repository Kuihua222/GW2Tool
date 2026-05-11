/**
 * GW2 Toolbox - Cloudflare Worker
 */

const HEADER_TOKEN = "x-gw2-token";
const KV_DATA_PREFIX = "gw2_data_";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // API 请求
    if (path.startsWith("/api/")) {
      return handleAPI(request, env);
    }

    // 静态文件 - 让 wrangler 自动处理
    return env.ASSETS.fetch(request);
  }
};

/**
 * API 处理
 */
async function handleAPI(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;

  // 认证路由（无需 token）
  if (path === "/api/auth") {
    return handleAuth(request, env);
  }

  // 验证 token
  const token = request.headers.get(HEADER_TOKEN);
  if (!token) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  const isValid = await verifyToken(token, env);
  if (!isValid) {
    return jsonResponse({ error: "Invalid token" }, 401);
  }

  // 数据路由
  if (path === "/api/data" && request.method === "GET") {
    return getAllData(env);
  }

  if (path === "/api/export") {
    return exportAllData(env);
  }

  if (path.startsWith("/api/data/")) {
    const key = path.substring("/api/data/".length);
    return handleDataRequest(request, env, key);
  }

  return jsonResponse({ error: "Not found" }, 404);
}

/**
 * 认证处理
 */
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

  const storedHash = await env.KV.get("gw2_password_hash");

  if (action === "setup") {
    if (storedHash) {
      return jsonResponse({ error: "Already configured" }, 403);
    }

    const hash = await hashPassword(password);
    await env.KV.put("gw2_password_hash", hash);

    const token = generateToken();
    await storeToken(token, env);

    return jsonResponse({ success: true, token });
  }

  if (action === "login" || action === "check") {
    if (!storedHash) {
      return jsonResponse({ exists: false });
    }

    const valid = await verifyPassword(password, storedHash);
    if (valid) {
      const token = generateToken();
      await storeToken(token, env);
      return jsonResponse({ authenticated: true, token });
    }

    return jsonResponse({ authenticated: false });
  }

  return jsonResponse({ error: "Invalid action" }, 400);
}

/**
 * 数据请求处理
 */
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

/**
 * 获取所有数据
 */
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

/**
 * 导出数据
 */
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

/**
 * 工具函数
 */
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" }
  });
}

async function hashPassword(password) {
  const salt = "gw2_salt_2024_secure";
  const encoder = new TextEncoder();
  const data = encoder.encode(password + salt);
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
