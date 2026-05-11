# GW2 Toolbox - Cloudflare Workers 部署

一个基于 Cloudflare Workers 和 KV 存储的 GW2 工具箱项目。

## 功能特性

- ✅ 日常任务追踪（通过外部 API 实时获取）
- ✅ 制作材料计算器（数据持久化到 KV）
- ✅ 交易利润分析器（数据持久化到 KV）
- ✅ 待办事项列表（数据持久化到 KV）
- ✅ 用户密码认证
- ✅ 数据导出/导入
- ✅ 深色/浅色主题

## 项目结构

```
GW2/
├── worker/              # Cloudflare Worker 代码
│   ├── index.js        # Worker 主文件
│   └── wrangler.toml   # Wrangler 配置
├── index.html          # 前端页面
├── app.js              # 前端逻辑
├── styles.css          # 样式文件
└── README.md           # 本文档
```

## 部署前准备

### 1. 安装依赖

首先确保你已安装 Node.js，然后：

```bash
npm install
```

### 2. 登录 Cloudflare

```bash
npx wrangler login
```

### 3. 创建 KV 命名空间

在部署前，需要先创建 KV 命名空间：

```bash
npx wrangler kv:namespace create "GW2_DATA"
```

创建成功后，复制输出中的 `id`，替换 `wrangler.toml` 中的 KV 命名空间 ID。

### 4. 更新 wrangler.toml

编辑 `worker/wrangler.toml`，将你的 KV 命名空间 ID 填入：

```toml
[[kv_namespaces]]
binding = "KV"
id = "你的-KV-命名空间-ID"
preview_id = "你的-KV-命名空间-ID"
```

## 本地开发

```bash
npm run dev
```

这将启动本地预览服务器，默认地址是 `http://localhost:8787`

## 部署

### 预览/测试部署

```bash
npm run deploy
```

### 生产部署

```bash
npm run deploy:prod
```

## 首次使用

1. 访问部署后的 Worker 地址
2. 设置访问密码（首次访问时设置）
3. 开始使用各项功能

## 数据存储说明

### 持久化存储（KV）
- 制作项目和材料数据
- 交易记录
- 待办事项
- 日常任务进度
- 用户主题设置

### 实时 API（不存储）
- 日常碎层数据
- 活动数据
- 事件计时器

## API 接口

### 认证
- `POST /api/auth` - 认证、设置密码

### 数据操作
- `GET /api/data` - 获取所有数据
- `GET /api/data/{key}` - 获取指定数据
- `POST /api/data/{key}` - 保存数据
- `DELETE /api/data/{key}` - 删除数据
- `GET /api/export` - 导出所有数据

## 技术栈

- Cloudflare Workers - 边缘计算
- Cloudflare KV - 键值存储
- Vanilla JavaScript - 前端
- CSS3 - 样式

## 常见问题

### 如何重置密码？

你可以通过 Cloudflare Dashboard 直接删除 KV 中的 `gw2_password_hash` 键，然后重新访问应用设置新密码。

### 数据会丢失吗？

Cloudflare KV 提供高可用性的数据存储，数据会自动在多个边缘节点复制。

### 如何迁移数据？

使用应用内置的导出功能导出数据，然后在新实例中通过浏览器导入功能恢复。
