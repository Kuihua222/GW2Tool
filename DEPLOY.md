# GW2 Toolbox - Cloudflare Workers 部署指南

## 项目架构

```
├── index.html          # 前端 SPA 入口
├── app.js              # 前端应用逻辑（支持云端同步）
├── styles.css          # 样式文件
├── src/
│   └── index.js        # Cloudflare Worker 后端
├── wrangler.toml       # Worker 配置文件
└── .github/workflows/
    └── deploy.yml      # GitHub Actions 自动部署
```

## 部署步骤（超简单）

### 第一步：Fork/推送代码到 GitHub

1. 在 GitHub 创建新仓库（如 `gw2-toolbox`）
2. 将代码推送到仓库：
```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/你的用户名/gw2-toolbox.git
git push -u origin main
```

### 第二步：获取 Cloudflare API Token

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com)
2. 点击右上角头像 → **My Profile** → **API Tokens** → **Create Token**
3. 选择 **Edit Cloudflare Workers** 模板
4. 权限设置：
   - Account: Cloudflare Workers:Edit
   - Zone: 如果需要自定义域名，添加 Zone:Read
5. 点击 **Continue to summary** → **Create Token**
6. **复制 Token**（只显示一次！）

### 第三步：获取 Cloudflare Account ID

1. 在 Cloudflare Dashboard 右侧边栏找到 **Account ID**
2. 复制这个 ID

### 第四步：配置 GitHub Secrets

1. 打开 GitHub 仓库 → **Settings** → **Secrets and variables** → **Actions**
2. 点击 **New repository secret**，添加以下两个：

| Secret 名称 | 值 |
|------------|-----|
| `CLOUDFLARE_API_TOKEN` | 第二步复制的 Token |
| `CLOUDFLARE_ACCOUNT_ID` | 第三步复制的 Account ID |

### 第五步：自动部署！

推送任意代码到 `main` 分支，GitHub Actions 会自动：
1. 部署 Worker 到 Cloudflare
2. 部署静态页面到 Cloudflare Pages

查看部署状态：GitHub 仓库 → **Actions** 标签页

### 第六步：绑定 Workers KV（仅需一次）

**方法一：自动创建（推荐）**

首次部署后，Wrangler 会自动创建 KV 命名空间。运行：

```bash
# 本地安装 wrangler
npm install -g wrangler

# 登录 Cloudflare
wrangler login

# 创建 KV 命名空间
wrangler kv:namespace create "GW2_DATA"

# 复制返回的 id，更新 wrangler.toml
```

**方法二：Dashboard 手动创建**

1. 打开 [Cloudflare Dashboard](https://dash.cloudflare.com) → **Workers & Pages**
2. 点击 **KV**
3. 点击 **Create a namespace**，命名为 `GW2_DATA`
4. 进入你的 Worker → **Settings** → **Variables** → **KV Namespace Bindings**
5. 点击 **Add binding**：
   - Variable name: `GW2_DATA`
   - KV namespace: 选择刚创建的 `GW2_DATA`
6. 点击 **Deploy**

### 第七步：配置前端同步

1. 打开部署后的网站地址（在 Cloudflare Pages 查看）
2. 在登录界面底部找到 **云端同步配置**
3. 填写：
   - **Worker 地址**：你的 Worker 地址（如 `https://gw2-toolbox.xxx.workers.dev`）
   - **同步令牌**：任意字符串（作为你的用户标识）
4. 点击 **保存配置**
5. 状态显示 **已连接** 即表示成功！

## 数据持久化说明

### 存储策略

- **本地优先**：所有数据先保存到 `localStorage`
- **云端同步**：配置 Worker 后，数据自动同步到 Cloudflare KV
- **离线可用**：无网络时正常使用，有网络时自动同步

### 数据隔离

- 每个用户通过 `token` 隔离数据
- KV 键格式：`user:{token}:{data_key}`
- 支持的数据：projects, trades, todos, daily_progress, theme, daily_preview_type

### 导出/导入

- **导出**：优先从云端导出完整数据
- **导入**：导入后自动同步到云端（如果已配置）

## 自定义域名（可选）

1. Cloudflare Dashboard → **Workers & Pages** → 你的 Pages 项目
2. 点击 **Custom domains** → **Set up a custom domain**
3. 输入你的域名（如 `gw2.yourdomain.com`）
4. 按提示添加 DNS 记录

## 常见问题

### Q: 部署失败怎么办？
A: 检查 GitHub Actions 日志，常见原因：
- API Token 权限不足（需要 Workers:Edit）
- Account ID 错误
- wrangler.toml 配置错误

### Q: KV 数据在哪里查看？
A: Cloudflare Dashboard → **Workers & Pages** → **KV** → 点击你的命名空间

### Q: 如何迁移已有本地数据到云端？
A: 配置云端同步后，数据会自动同步。也可以：
1. 先导出本地数据
2. 配置云端同步
3. 导入数据，会自动上传到 KV

### Q: 多端同步如何实现？
A: 在不同设备使用相同的 **Worker 地址** 和 **同步令牌**，数据自动同步。

## 技术栈

- **前端**：原生 HTML/CSS/JS（零框架依赖）
- **后端**：Cloudflare Workers
- **数据库**：Cloudflare Workers KV
- **部署**：GitHub Actions + Wrangler
- **CDN**：Cloudflare Pages + Workers

## 安全提示

1. **不要** 将 `CLOUDFLARE_API_TOKEN` 提交到代码仓库
2. **不要** 分享你的同步令牌（它相当于你的用户密码）
3. 生产环境建议使用 Cloudflare Access 或 JWT 认证
4. 定期备份重要数据（使用导出功能）
