/**
 * GW2 Toolbox - Cloudflare Worker
 * 提供 KV 数据持久化和 API 服务
 */

const HEADER_TOKEN = "x-gw2-token";
const KV_DATA_PREFIX = "gw2_data_";

// 内联的静态资源，用于快速部署
const STATIC_FILES = {
  'index.html': '',
  'app.js': '',
  'styles.css': ''
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    // API 路由处理
    if (path.startsWith("/api/")) {
      return await handleAPI(request, env);
    }

    // 静态资源处理
    return await handleStatic(request, env);
  }
};

/**
 * 处理静态资源请求
 */
async function handleStatic(request, env) {
  const url = new URL(request.url);
  let path = url.pathname;

  // 默认路由到 index.html
  if (path === "/" || path === "") {
    path = "/index.html";
  }

  // 去除前导斜杠
  const filePath = path.startsWith("/") ? path.slice(1) : path;

  // 尝试从 __STATIC_CONTENT 获取（wrangler site）
  try {
    if (typeof __STATIC_CONTENT !== 'undefined') {
      const content = await __STATIC_CONTENT.get(filePath);
      if (content) {
        return new Response(content, {
          headers: {
            'Content-Type': getContentType(filePath),
            'Cache-Control': 'public, max-age=3600'
          }
        });
      }
    }
  } catch (e) {
    // 继续尝试其他方法
  }

  // 如果找不到，返回 404
  return new Response("Not Found", { status: 404 });
}

/**
 * 根据文件扩展名获取 MIME 类型
 */
function getContentType(path) {
  const ext = path.split('.').pop().toLowerCase();
  const types = {
    'html': 'text/html; charset=utf-8',
    'css': 'text/css; charset=utf-8',
    'js': 'application/javascript; charset=utf-8',
    'json': 'application/json; charset=utf-8',
    'png': 'image/png',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'gif': 'image/gif',
    'svg': 'image/svg+xml',
    'ico': 'image/x-icon'
  };
  return types[ext] || 'application/octet-stream';
}

/**
 * API 路由处理
 */
async function handleAPI(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;

  // 认证相关路由（不需要 token）
  if (path === "/api/auth") {
    return await handleAuth(request, env);
  }

  // 检查认证 token
  const token = request.headers.get(HEADER_TOKEN);
  if (!token) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  const isValid = await verifyToken(token, env);
  if (!isValid) {
    return jsonResponse({ error: "Invalid token" }, 401);
  }

  // 数据相关路由
  if (path === "/api/data" && request.method === "GET") {
    return await getAllData(env);
  }

  if (path === "/api/export") {
    return await exportAllData(env);
  }

  if (path.startsWith("/api/data/")) {
    const key = path.substring("/api/data/".length);
    return await handleDataRequest(request, env, key);
  }

  return jsonResponse({ error: "Not found" }, 404);
}

/**
 * 处理认证请求
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

  // 检查密码是否已设置
  const storedHash = await env.KV.get("gw2_password_hash");

  if (action === "setup") {
    // 设置初始密码
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
    // 登录或验证
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
 * 处理数据请求
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
 * 导出所有数据
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
 * 工具函数：返回 JSON 响应
 */
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" }
  });
}

/**
 * 密码哈希（使用 SHA-256 + salt）
 */
async function hashPassword(password) {
  const salt = "gw2_salt_2024_secure";
  const encoder = new TextEncoder();
  const data = encoder.encode(password + salt);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

/**
 * 验证密码
 */
async function verifyPassword(password, storedHash) {
  const hash = await hashPassword(password);
  return hash === storedHash;
}

/**
 * 生成随机 token
 */
function generateToken() {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array).map(b => b.toString(16).padStart(2, "0")).join("");
}

/**
 * 验证 token
 */
async function verifyToken(token, env) {
  if (!token || token.length !== 64) return false;
  const key = `gw2_token_${token}`;
  const exists = await env.KV.get(key);
  return exists === "valid";
}

/**
 * 存储 token（有效期 30 天）
 */
async function storeToken(token, env) {
  const key = `gw2_token_${token}`;
  await env.KV.put(key, "valid", { expirationTtl: 60 * 60 * 24 * 30 });
}
