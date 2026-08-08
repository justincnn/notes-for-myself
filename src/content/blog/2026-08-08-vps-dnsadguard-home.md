---
title: VPS 自建加密 DNS：AdGuard Home
excerpt: 用 VPS 部署 AdGuard Home，并通过 DNS-over-TLS 接入 Android 私人 DNS，打造属于自己的加密 DNS 服务
date: 2026-08-08
updated: 2026-08-08
category: VPS
tags:
  - Android
  - VPS
author: Justin
thumbnail: /1786172163_c7424c875d70e8f0a69ccd53e130cf12.png
featured: false
draft: false
---
在 VPS 上部署 AdGuard Home，并将其配置为 Android 9+ 的「私人 DNS」，核心在于启用 **DNS-over-TLS（DoT）**。Android 原生私人 DNS 功能只支持 DoT 协议，而不支持 DoH（DNS-over-HTTPS），因此我们需要围绕 DoT 来配置服务端。

下面是完整的操作指南。

## 准备工作

1. **一台 VPS**：建议使用 Ubuntu 20.04 / 22.04 或 Debian 11 / 12。
2. **一个域名**：你需要拥有一个域名（例如 `example.com`），并为其添加一个子域名（例如 `dns.example.com`）。
3. **SSH 工具**：用于连接 VPS。

## 1. 设置域名解析

在域名注册商或 DNS 服务商（如 Cloudflare、GoDaddy、AliYun）后台，添加一条 **A 记录**：

| 字段 | 值 |
| --- | --- |
| 类型 | `A` |
| 名称 | `dns` |
| 内容 | 你的 VPS IP 地址 |
| 代理状态 | 关闭代理（DNS Only） |

> 如果使用 Cloudflare，请务必**关闭小黄云**，否则 SSL 证书申请和 DoT 端口连接会出现问题。

## 2. 处理系统端口冲突

Ubuntu / Debian 默认的 `systemd-resolved` 会占用 `53` 端口，导致 AdGuard Home 无法启动 DNS 服务。我们需要先停用它并释放端口。

### 2.1 停止并禁用 systemd-resolved

```bash
sudo systemctl stop systemd-resolved
sudo systemctl disable systemd-resolved
```

### 2.2 手动设置系统的 DNS

编辑 `/etc/resolv.conf`：

```bash
sudo nano /etc/resolv.conf
```

将其内容修改为：

```text
nameserver 8.8.8.8
nameserver 1.1.1.1
```

> 按 `Ctrl+O` 保存，`Ctrl+X` 退出。这一步是为了防止停止 systemd-resolved 后 VPS 无法解析域名。

## 3. 安装 AdGuard Home

AdGuard Home 提供了一键安装脚本：

```bash
curl -s -S -L https://raw.githubusercontent.com/AdguardTeam/AdGuardHome/master/scripts/install.sh | sh -s - -v
```

### 放行防火墙端口

如果你的 VPS 启用了防火墙（如 UFW），需要放行以下端口：

- `80/tcp`：申请证书验证用
- `3000/tcp`：AdGuard Home 初始化向导
- `853/tcp`：**关键端口，Android 私人 DNS 使用 DoT**
- `443/tcp`：HTTPS / DoH
- `53/tcp` + `53/udp`：普通 DNS

```bash
sudo ufw allow 80/tcp
sudo ufw allow 3000/tcp
sudo ufw allow 853/tcp
sudo ufw allow 443/tcp
sudo ufw allow 53/tcp
sudo ufw allow 53/udp
```

## 4. 初始化 AdGuard Home

1. 打开浏览器，访问 `http://你的VPS_IP:3000`。
2. 点击「开始配置」。
3. **网页管理界面端口**：可以保持 `3000`，也可以改为 `8080`。建议不要设置为 `80`，因为之后申请 Let's Encrypt 证书需要用到。
4. **DNS 服务器端口**：必须设置为 `53`。
5. 设置管理员账号密码，完成配置。

## 5. 申请 SSL 证书

Android 的私人 DNS（DoT）要求服务端必须使用合法的 SSL 证书。这里使用 `certbot` 申请免费的 Let's Encrypt 证书。

### 5.1 安装 Certbot

```bash
sudo apt update
sudo apt install certbot -y
```

### 5.2 申请证书

确保此时没有其他程序占用 `80` 端口，然后执行：

```bash
sudo certbot certonly --standalone -d dns.example.com
```

申请成功后，证书会保存在 `/etc/letsencrypt/live/dns.example.com/` 目录下：

- `fullchain.pem`：证书公钥
- `privkey.pem`：证书私钥

## 6. 在 AdGuard Home 中启用加密

1. 回到 AdGuard Home，访问 `http://你的VPS_IP:3000` 并登录。
2. 点击「设置」→「加密设置」。
3. 勾选「启用加密」。
4. **服务器名称**：填写你的域名，例如 `dns.example.com`。
5. **HTTPS 自动重定向**：如果管理面板不在 80 / 443 端口，可以不勾选。
6. 配置证书：

   由于 AdGuard Home 默认没有权限直接读取 `/etc/letsencrypt`，推荐使用**粘贴内容**的方式：

   - 在 VPS 上执行以下命令，复制证书内容：
     ```bash
     cat /etc/letsencrypt/live/dns.example.com/fullchain.pem
     ```
   - 再执行以下命令，复制私钥内容：
     ```bash
     cat /etc/letsencrypt/live/dns.example.com/privkey.pem
     ```
   - 将复制的内容分别粘贴到 AdGuard Home 的「证书」和「私钥」输入框中。

7. 点击「保存配置」。

> 如果你使用「填写路径」的方式，AdGuard Home 可能会提示无权限。此时需要调整证书目录权限或修改运行用户，但会降低安全性，不建议新手操作。

## 7. 在 Android 手机上设置

服务端配置完成后，接下来配置 Android 手机。

1. 确认 Android 版本为 9 或更高。
2. 打开「设置」→「网络和互联网」。
3. 点击「私人 DNS」。
4. 选择「私人 DNS 提供商主机名」。
5. 输入域名：`dns.example.com`。
6. 保存设置。

**验证是否成功：**

如果没有出现「无法连接」的提示，且可以正常上网，说明配置成功。你可以回到 AdGuard Home 的仪表盘，刷新后应该能看到来自手机 IP 的 DNS 查询记录，且协议类型显示为 `DoT`。

## 8. 高级提示与避坑

### 8.1 防止 DNS 被滥用

将 AdGuard Home 开放到公网后，可能被扫描器发现并用于 DNS 放大攻击。建议：

- 在「设置 → DNS 设置 → 允许的客户端」中配置访问白名单。
- 手机在移动网络下 IP 是动态变化的，无法通过固定 IP 白名单限制。
- 折中方案：不要公开你的 `dns.example.com`，同时开启请求频率限制（Rate Limit）。

### 8.2 证书自动续期

Let's Encrypt 证书有效期为 90 天，需要设置自动续期。

如果 AdGuard Home 没有占用 80 端口，可以直接执行：

```bash
certbot renew
```

如果申请证书时使用了 `--standalone` 模式，并且 AdGuard Home 占用了 80 端口，建议使用 `--pre-hook` 和 `--post-hook` 重启服务：

```bash
certbot renew --pre-hook "systemctl stop adguardhome" --post-hook "systemctl start adguardhome"
```

### 8.3 延迟问题

VPS 的物理位置直接影响 DNS 解析速度。如果 VPS 在美国，而你在国内使用，DNS 解析延迟可能会达到 150ms 以上，打开网页时会明显感觉变慢。建议选择香港、日本等地区的 VPS，或使用国内需备案的服务器。

## 总结

到这一步，你已经拥有了一套属于自己的加密 DNS 服务。AdGuard Home 可以帮你拦截广告、恶意域名和追踪器，同时通过 DoT 加密 DNS 查询，避免 ISP 窥探你的浏览记录。

这套方案非常适合在个人设备、家庭网络中使用，一次配置，长期受益。
