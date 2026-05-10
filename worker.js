// Cloudflare Worker for GW2 Toolbox
// 提供API代理、静态文件服务和KV数据持久化

// API缓存配置
const CACHE_DURATION = 5 * 60; // 5分钟 (秒)

// 响应头
const JSON_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Cache-Control': `public, max-age=${CACHE_DURATION}`
};

const HTML_HEADERS = {
  'Content-Type': 'text/html;charset=UTF-8',
  'Cache-Control': 'public, max-age=3600'
};

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // CORS预检请求
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        }
      });
    }

    // API代理 - 日常数据
    if (url.pathname === '/api/daily') {
      try {
        const response = await fetch('https://gw2.wishingstarmoye.com/gw2api/daily');
        const data = await response.json();
        return new Response(JSON.stringify(data), { headers: JSON_HEADERS });
      } catch (error) {
        return new Response(JSON.stringify({ code: 500, msg: '获取日常数据失败' }), {
          status: 500,
          headers: JSON_HEADERS
        });
      }
    }

    // API代理 - 活动数据
    if (url.pathname === '/api/activity') {
      try {
        const count = url.searchParams.get('count') || '5';
        const day = url.searchParams.get('day') || '7';
        const targetUrl = `https://gw2.wishingstarmoye.com/gw2api/activity?count=${count}&day=${day}`;
        const response = await fetch(targetUrl);
        const data = await response.json();
        return new Response(JSON.stringify(data), { headers: JSON_HEADERS });
      } catch (error) {
        return new Response(JSON.stringify({ code: 500, msg: '获取活动数据失败' }), {
          status: 500,
          headers: JSON_HEADERS
        });
      }
    }

    // KV数据持久化API - 用户数据存储
    if (url.pathname.startsWith('/api/data/')) {
      const userId = url.pathname.replace('/api/data/', '');
      
      if (!userId) {
        return new Response(JSON.stringify({ code: 400, msg: '用户ID不能为空' }), {
          status: 400,
          headers: JSON_HEADERS
        });
      }

      // GET - 读取用户数据
      if (request.method === 'GET') {
        try {
          const data = await env.GW2_DATA.get(`user_${userId}`, { type: 'json' });
          return new Response(JSON.stringify({ 
            code: 200, 
            data: data || {} 
          }), { headers: JSON_HEADERS });
        } catch (error) {
          return new Response(JSON.stringify({ code: 500, msg: '读取数据失败' }), {
            status: 500,
            headers: JSON_HEADERS
          });
        }
      }

      // POST/PUT - 保存用户数据
      if (request.method === 'POST' || request.method === 'PUT') {
        try {
          const body = await request.json();
          await env.GW2_DATA.put(`user_${userId}`, JSON.stringify(body));
          return new Response(JSON.stringify({ 
            code: 200, 
            msg: '数据已保存' 
          }), { headers: JSON_HEADERS });
        } catch (error) {
          return new Response(JSON.stringify({ code: 500, msg: '保存数据失败' }), {
            status: 500,
            headers: JSON_HEADERS
          });
        }
      }

      // DELETE - 删除用户数据
      if (request.method === 'DELETE') {
        try {
          await env.GW2_DATA.delete(`user_${userId}`);
          return new Response(JSON.stringify({ 
            code: 200, 
            msg: '数据已删除' 
          }), { headers: JSON_HEADERS });
        } catch (error) {
          return new Response(JSON.stringify({ code: 500, msg: '删除数据失败' }), {
            status: 500,
            headers: JSON_HEADERS
          });
        }
      }
    }

    // 静态文件服务
    if (url.pathname === '/' || url.pathname === '/index.html') {
      return new Response(INDEX_HTML, { headers: HTML_HEADERS });
    }

    if (url.pathname === '/styles.css') {
      return new Response(STYLES_CSS, {
        headers: { 'Content-Type': 'text/css', 'Cache-Control': 'public, max-age=86400' }
      });
    }

    if (url.pathname === '/app.js') {
      return new Response(APP_JS, {
        headers: { 'Content-Type': 'application/javascript', 'Cache-Control': 'public, max-age=86400' }
      });
    }

    // 默认返回主页
    return new Response(INDEX_HTML, { headers: HTML_HEADERS });
  }
};

// 内联静态文件（简化版本）
const INDEX_HTML = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>GW2 工具箱</title>
<style>
body{font-family:system-ui,-apple-system,sans-serif;background:#0f1115;color:#e8e8e8;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:20px}
.container{max-width:600px;text-align:center}
h1{font-size:28px;margin-bottom:16px;color:#3b82f6}
p{color:#9ca3af;line-height:1.6;margin-bottom:24px}
.code{background:#1e2028;padding:16px;border-radius:8px;font-family:monospace;font-size:13px;text-align:left;overflow-x:auto;margin-bottom:16px;border:1px solid #2a2d35}
.btn{display:inline-block;padding:12px 24px;background:#3b82f6;color:#fff;text-decoration:none;border-radius:8px;font-weight:500;transition:opacity .2s}
.btn:hover{opacity:.9}
</style>
</head>
<body>
<div class="container">
<h1>GW2 工具箱</h1>
<p>请使用静态文件部署方式以获得完整功能。<br>当前Worker仅提供API代理服务。</p>
<div class="code">
推荐部署方式：<br><br>
1. Cloudflare Pages (推荐)<br>
2. Vercel / Netlify<br>
3. GitHub Pages<br><br>
上传文件：index.html, styles.css, app.js
</div>
<a href="https://github.com" class="btn">查看部署文档</a>
</div>
</body>
</html>`;

const STYLES_CSS = `/* 请使用 styles.css 文件 */`;
const APP_JS = `/* 请使用 app.js 文件 */`;
