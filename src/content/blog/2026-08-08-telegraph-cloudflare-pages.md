---
title: 自建图床：Telegraph 与 Cloudflare Pages
excerpt: 手把手教你用 Cloudflare Pages 和 Telegraph 免费搭建个人图床，包含 Bot Token、Chat ID、KV 存储与自动更新配置
date: 2026-08-08
updated: 2026-08-08
category: Cloudflare
tags:
  - Cloudflare
  - 图床
author: Justin
thumbnail: /1786175812_27d7de975f703b64e336c9f2c407d999.png
featured: false
draft: false
---
想要一个免费、稳定且支持外链的图片托管服务？除了 Flickr、Imgur，你还可以利用 **Cloudflare Pages + Telegraph** 搭建属于自己的免费图床，不需要购买服务器，也不需要维护数据库。

## 前置准备

- 一个 Telegram 账号
- 一个 GitHub 账号
- 一个 Cloudflare 账号

## Telegram 配置

### 获取 Bot Token 和 Chat ID

1. 获取 `BotToken`

   在 Telegram 中，向 [@BotFather](https://t.me/BotFather) 发送命令 `/newbot`，根据提示依次输入你的机器人名称和用户名。成功创建机器人后，你会收到一个 `BOT_TOKEN`，用于与 Telegram API 进行交互。



2. 将机器人设置为频道管理员

   创建一个新的频道（Channel），进入频道设置，将刚创建的机器人添加为频道管理员。只有成为管理员，机器人才有权限向频道发送消息。


3. 获取 `ChatID`

   可以任选以下任一 Bot 来获取你的频道 ID：

   - 向 [@VersaToolsBot](https://t.me/VersaToolsBot) 发送消息，按照提示操作即可获得 `CHAT_ID`。
   - 向 [@GetTheirIDBot](https://t.me/GetTheirIDBot) 发送消息，按照提示操作即可获得 `CHAT_ID`。



## 部署到 Cloudflare Pages

### 1. Fork 仓库

进入 [cf-pages/Telegraph-Image](https://github.com/cf-pages/Telegraph-Image) 仓库，点击右上角 **Fork**，将项目复制到你的 GitHub 账号下。



### 2. 创建 Pages 项目

打开 Cloudflare Dashboard，进入 **Workers & Pages** 页面，点击 **创建项目**，选择 **连接到 Git 提供程序**。



### 3. 部署站点

输入项目名称，选择刚才 Fork 的仓库，点击 **部署站点** 即可完成首次部署。



部署完成后，可以通过 Cloudflare 分配的默认域名访问你的图床。

### 4. 添加自定义域名（可选）

如果你希望使用自己的域名，可以在 Pages 项目设置中绑定自定义域名。绑定完成后，等待 SSL 证书生效即可。



### 5. 配置 Telegram 环境变量

进入 Pages 项目的 **设置 → 变量和机密**，添加以下环境变量：

| 变量名 | 示例值 | 说明 |
| --- | --- | --- |
| `TG_Bot_Token` | `123456:AA...` | 从 @BotFather 获取的 Telegram Bot Token |
| `TG_Chat_ID` | `-1001234567890` | 频道 ID，确保 Bot 是频道管理员 |

> **注意**：修改环境变量后，需要点击 **重新部署** 才能生效。

## 开启图片管理功能

### 1. 创建 KV 命名空间

在 Cloudflare Dashboard 中进入 **Workers & Pages → KV**，创建一个新的 KV 命名空间，例如 `img_url`。



### 2. Pages 绑定 KV

在 Pages 项目的 **Settings → 绑定** 中，添加一个 KV 命名空间绑定：

| 变量名称 | KV 命名空间 |
| --- | --- |
| `img_url` | 选择刚才创建好的 KV 命名空间 |



### 3. 配置后台管理密码

后台管理登录验证功能默认关闭。如需开启，请在部署完成后的后台 **Settings → 变量和机密** 中添加以下变量：

| 变量名 | 值 |
| --- | --- |
| `BASIC_USER` | 你的后台管理登录用户名 |
| `BASIC_PASS` | 你的后台管理登录密码 |

后台登录地址为：

```text
https://你的域名/admin
```

## 重新部署

修改环境变量或 KV 绑定后，必须重新部署一次配置才会生效。


重新部署后，打开图床访问即可正常使用：



## 开启自动更新

Fork 项目后，由于 GitHub 的限制，需要手动进入你 Fork 后的仓库，打开 **Actions** 页面，启用 **Upstream Sync Action**。启用后，项目会每小时自动同步上游更新。



如果遇到 **Upstream Sync 执行错误**，可以在 GitHub 上手动执行 **Sync Fork** 一次。

## 限制

- 图片实际存储在 Telegraph，Telegraph 单张图片大小限制最大为 **5MB**。
- 由于使用 Cloudflare 网络，部分地区的图片加载速度可能无法保证。
- Cloudflare Functions 免费版每日限制 **100,000 个请求**，即每天上传或加载图片的次数上限。如果超过限制，可能需要购买 Cloudflare Functions 付费版。
- 开启图片管理功能后，KV 也有操作次数限制，超过配额后会按 Cloudflare KV 计费规则计算。