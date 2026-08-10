---
title: 自建 Cloudflare 临时邮箱（临时邮箱 API 完整教程）
excerpt: 基于 cloudflare_temp_email 开源项目，从零搭建属于自己的临时邮箱服务：开箱即用的 API、自定义域名、随机二级域名防封，
  Step by Step
date: 2026-08-10
updated: 2026-08-10
category: Cloudflare
tags:
  - Cloudflare
author: Justin
thumbnail: /email-management-760.jpg
featured: false
draft: false
---
> 文章结论先行：你只需要一个 Cloudflare 账号 + 一个域名，就能拥有**专属的临时邮箱服务**——自带 API、支持自定义域名、自动随机二级域名分散风控，完全免费（Cloudflare 免费套餐就够）。

你有没有遇到过这种情况：想注册某个网站、接一个验证码，又不想暴露真实邮箱？公共临时邮箱（如 temp-mail）要么被封、要么收不到验证码、要么隐私堪忧。

**自己搭一个不就好了？** 这篇教程带你从零搭建，全程可视化，跟着做就行。

---

## 这个服务能干什么

- ✅ 一键生成临时邮箱地址（每次不同）
- ✅ 自动收取验证码邮件（API 即查即用）
- ✅ **随机二级域名**——`abc@x7k2p.your-domain.com`，每个邮箱独立子域，防批量封禁
- ✅ 支持多个域名随机分配
- ✅ 完全免费（Cloudflare 免费套餐 + 域名）

## 技术原理（30 秒看懂）

```
发件人 → 你的域名(Email Routing 接收) → Cloudflare Worker(解析邮件) → D1 数据库(存储) → API 读取
```

用大白话说：**Cloudflare 帮你收邮件，Worker 帮你拆邮件，数据库帮你存邮件，API 帮你取邮件。**

---

## 前置准备

| 项目 | 说明 | 费用 |
|---|---|---|
| **Cloudflare 账号** | https://dash.cloudflare.com 注册 | 免费 |
| **一个域名** | 已托管在 Cloudflare（NS 指向 CF）| 域名费 |
| **Node.js 18+** | 本地跑部署命令 | 免费 |
| **基础命令行知识** | 会复制粘贴即可 | — |

> 💡 没有域名？几块钱买个便宜的，或者用免费域名（如 eu.org）。

---

## 第一步：部署 Worker（10 分钟）

### 1.1 克隆项目

```bash
git clone https://github.com/dreamhunter2333/cloudflare_temp_email.git
cd cloudflare_temp_email/worker
```

> 这是社区最活跃的 Cloudflare 临时邮箱项目，持续维护中。

### 1.2 安装依赖

```bash
npm install
```

### 1.3 创建 D1 数据库和 KV 存储（2 个命令）

```bash
# 创建数据库
npx wrangler d1 create tempmail
# 创建 KV
npx wrangler kv namespace create MAIL_KV
```

> 记下返回的 `database_id` 和 `kv id`，后面要用。

### 1.4 生成配置文件

```bash
cp wrangler.toml.template wrangler.toml
```

编辑 `wrangler.toml`，填入刚才的信息：

```toml
name = "tempmail"
compatibility_date = "2026-04-04"
compatibility_flags = [ "nodejs_compat" ]

[vars]
DOMAINS = ["your-domain.com"]              # ← 换成你的域名
RANDOM_SUBDOMAIN_DOMAINS = ["your-domain.com"]  # 随机二级域名域名
RANDOM_SUBDOMAIN_LENGTH = "5"              # 随机前缀长度
JWT_SECRET = "换成超长随机字符串"           # 用 openssl rand -hex 32 生成
ADMIN_PASSWORDS = ["换成你的管理密码"]

[[d1_databases]]
binding = "DB"
database_name = "tempmail"
database_id = "刚才创建的 database_id"     # ← 替换

[[kv_namespaces]]
binding = "KV"
id = "刚才创建的 kv id"                    # ← 替换
```

### 1.5 登录并部署

```bash
# 首次需要登录（会打开浏览器）
npx wrangler login

# 部署
npx wrangler deploy
```

看到 `Uploaded tempmail` + `Deployed tempmail triggers` 就成功了！

---

## 第二步：接入域名收信（10 分钟）

Worker 部署好了，但要让域名**能收邮件**，还需要开启 Email Routing。

### 2.1 开启 Email Routing

1. 打开 Cloudflare 控制台 → 选择你的域名
2. 左侧菜单 **Email → Email Routing**
3. 点击 **Get started**（启用后自动添加 MX 记录）

### 2.2 配置邮件路由规则

在 **Routing rules** 页面：

1. 找到 **Catch-all** 规则（默认是"丢弃"）
2. 点击编辑 → Action 改为 **Send to a Worker**
3. 选择你刚部署的 **tempmail** Worker
4. 保存

### 2.3 关键：添加通配符 MX（随机子域名必做！）

⚠️ **这是最容易踩的坑**：Email Routing 只为根域名加 MX 记录，**随机二级域名（如 `x7k2p.your-domain.com`）收不到邮件**！

需要在 DNS 记录里手动加 3 条通配符 MX（和你根域名的 MX 一样）：

| 类型 | 名称 | 内容 | 优先级 |
|---|---|---|---|
| MX | `*.your-domain.com` | `route1.mx.cloudflare.net` | 54 |
| MX | `*.your-domain.com` | `route2.mx.cloudflare.net` | 67 |
| MX | `*.your-domain.com` | `route3.mx.cloudflare.net` | 29 |

再加一条通配符 SPF（防止邮件被判垃圾）：

| 类型 | 名称 | 内容 |
|---|---|---|
| TXT | `*.your-domain.com` | `v=spf1 include:_spf.mx.cloudflare.net ~all` |

> Cloudflare 控制台 → 你的域名 → DNS → 添加记录，照着填就行。

---

## 第三步：验证（2 分钟）

### 3.1 测试 Worker 是否在线

```bash
curl https://tempmail.你的账号.workers.dev/
# 返回 OK 即正常
```

### 3.2 创建第一个临时邮箱

```bash
curl -X POST https://tempmail.你的账号.workers.dev/api/new_address \
  -H "Content-Type: application/json" \
  -d '{"enableRandomSubdomain":true}'
```

返回类似：

```json
{
  "jwt": "eyJhbGciOiJIUz...",
  "address": "tmpabc123@x7k2p.your-domain.com",
  "address_id": 1
}
```

看到 `x7k2p.` 前缀了吗？**随机二级域名已经生效**！

### 3.3 实测收信

1. 用任意邮箱发一封邮件到刚才生成的地址
2. 等几秒，查询收件箱：

```bash
curl "https://tempmail.你的账号.workers.dev/api/mails" \
  -H "Authorization: Bearer eyJhbGciOiJIUz..."  # 用 jwt
```

如果能看到邮件列表——**恭喜，你的临时邮箱服务搭建完成！** 🎉

---

## API 速查手册

所有请求都发到你的 Worker 地址（`https://tempmail.你的账号.workers.dev`）。

| 功能 | 方法 | 路径 | 认证 |
|---|---|---|---|
| 创建邮箱 | POST | `/api/new_address` | 无 |
| 收件箱列表 | GET | `/api/mails` | Bearer JWT |
| 读单封邮件 | GET | `/api/mail/:id` | Bearer JWT |
| 删除邮件 | DELETE | `/api/mails/:id` | Bearer JWT |
| 管理员登录 | POST | `/open_api/admin_login` | 无（body 带密码）|

### 创建邮箱参数说明

```bash
# 全随机（域名+随机子域）
-d '{"enableRandomSubdomain":true}'

# 指定域名
-d '{"domain":"your-domain.com"}'

# 自定义前缀
-d '{"name":"mytest"}'
```

### 一个完整调用流程（自动收验证码）

```bash
# 1. 创建邮箱
RESP=$(curl -s -X POST https://你的Worker地址/api/new_address \
  -H "Content-Type: application/json" -d '{"enableRandomSubdomain":true}')
JWT=$(echo $RESP | jq -r .jwt)

# 2. 轮询等验证码邮件（每 3 秒查一次）
while true; do
  MAILS=$(curl -s ".../api/mails" -H "Authorization: Bearer $JWT")
  if [ "$(echo $MAILS | jq '.items | length')" -gt 0 ]; then break; fi
  sleep 3
done

# 3. 提取验证码
FIRST_ID=$(echo $MAILS | jq -r '.items[0].id')
MAIL=$(curl -s ".../api/mail/$FIRST_ID" -H "Authorization: Bearer $JWT")
echo "$MAIL" | grep -oE '[0-9]{6}' | head -1  # 打印 6 位验证码
```

---

## 进阶玩法

### 绑定自定义域名（不用 workers.dev）

在 `wrangler.toml` 加：

```toml
routes = [
  { pattern = "mail.your-domain.com", custom_domain = true },
]
```

重新 `npx wrangler deploy`，就能用 `https://mail.your-domain.com` 访问了。

### 多个域名随机分配

```toml
DOMAINS = ["domain1.com", "domain2.com", "domain3.com"]
RANDOM_SUBDOMAIN_DOMAINS = ["domain1.com", "domain2.com", "domain3.com"]
```

每次创建邮箱都会在多个域名间随机，**更分散、更不容易被目标网站封**。

### 前端界面（可选）

项目带一个 Vue 前端，部署到 Cloudflare Pages 就有图形界面可用（邮箱列表、收件箱、验证码快捷复制）。

---

## 常见问题 FAQ

**Q1: 创建的邮箱收不到邮件？**
先确认 Email Routing 已启用（控制台能看到），再确认发了正确的域名——**根域名的邮箱直接发，随机子域名的邮箱也直接发**（通配符 MX 已配置）。等 1-2 分钟再看。

**Q2: 随机子域名邮箱收信失败？**
99% 是因为**没加通配符 MX**。检查 DNS 里有没有 `*.your-domain.com` 的 MX 记录（第二步 2.3 节）。

**Q3: 部署报错 `Missing entry point`？**
确认在 `worker/` 目录下运行命令，且 `wrangler.toml` 里 `main = "src/worker.ts"` 存在。

**Q4: 邮箱能创建，但 API 读邮件 401？**
JWT 过期了。每个邮箱创建时返回的 JWT 与该邮箱绑定，**换邮箱必须换 JWT**（重新创建或管理员登录拿新 token）。

**Q5: 免费套餐够用吗？**
够了！Worker 免费额度每天 10 万次请求，D1 免费 5GB，个人使用绰绰有余。

**Q6: 域名不在 Cloudflare 托管怎么办？**
需要先把域名 NS 改成 Cloudflare 的（免费），等生效后再操作。或者把域名**迁移到同一个账号**下统一管理。

---

## 免责声明

临时邮箱只建议用于接收验证码、测试等场景。请遵守目标网站的使用条款，不要用于违法用途。本项目仅供学习交流。

---
