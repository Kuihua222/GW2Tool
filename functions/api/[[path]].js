// Cloudflare Pages Function for API routes
// 提供 API 代理和 KV 数据持久化

// API 缓存配置
const CACHE_DURATION = 5 * 60; // 5分钟 (秒)

// 响应头
const JSON_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Cache-Control': `public, max-age=${CACHE_DURATION}`
};

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  // CORS 预检请求
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

  // API 代理 - 日常数据
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

  // API 代理 - 活动数据
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

  // KV 数据持久化 API - 用户数据存储
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

  return new Response('API Not Found', { status: 404 });
}
