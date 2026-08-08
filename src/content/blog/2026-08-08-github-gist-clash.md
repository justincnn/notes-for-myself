---
title: 打造基于 GitHub Gist 的 Clash 订阅
excerpt: 介绍如何利用 GitHub Gist 创建私有订阅链接，并整理 Clash 分流规则与配置示例，帮助你快速搭好自用配置
date: 2026-08-08
updated: 2026-08-08
category: GitHub
tags:
  - GitHub
  - Clash
author: Justin
thumbnail: /1786173963_e5134067a086b6e3692414da92304428.png
featured: false
draft: false
---
## 前言

Clash 是一个开源的网络代理工具，具有强大的功能和易于使用的特点。它支持各种协议，包括 SOCKS5、HTTP 和 HTTPS，可以用于绕过防火墙、隐藏 IP 地址和保护隐私。Clash 还支持广告过滤、DNS 解析和代理切换等功能。

Clash 的好处包括：

- **功能强大**：支持各种协议和功能，可以满足不同场景的需求。
- **易于使用**：用户界面简单直观，上手成本较低。
- **开源安全**：源代码公开，任何人都可以查看和审计，确保其安全与可靠。

Clash 的不便之处包括：

- **需要订阅配置**：Clash 需要使用订阅配置才能正常工作，这些配置通常来自 GitHub、论坛或私人服务器。
- **学习曲线较陡**：功能丰富的同时，也需要一定的时间来熟悉和配置。

尽管存在一些不便，Clash 仍然是一个功能强大且灵活的网络代理工具。本文介绍如何利用 GitHub Gist 创建属于自己的私有订阅。

## GitHub Gist 配置

1. 打开 [GitHub Gist](https://gist.github.com)，Gist description 可以不用填写。
2. 在 **Filename including extension** 中填入包含扩展名的完整文件名，例如 `myconfig.yaml`。
3. 点击右下角的 **Create secret gist**，不要选择 **Create public gist**，以保证配置私有。

![创建 Gist 截图](https://cdn.jsdelivr.net/gh/justincnn/pictures/img/202307291111002.webp)

创建完成后，点击右上角的 **Raw**，复制当前页面的地址，例如：

```text
https://gist.githubusercontent.com/github/bf480acnew747d25e59/raw/1cc5824c712a0c8fe0aaa7ee6fa644cc26e9fb31/gistfile1.txt
```

将 `/raw/` 之后的那串随机数（commit ID）删除，得到形如：

```text
https://gist.githubusercontent.com/github/bf480sacf31a969e3acbc7ea2df4747ed25e59/raw/gistfile1.txt
```

最后，将处理后的 URL 填入任意使用 Clash Premium 或 Meta 内核的 Clash 图形化客户端中，即可作为订阅链接使用。

## Clash 分流规则

在配置 Clash 订阅时，常用到的分流规则可以从 `Loyalsoldier/clash-rules` 仓库获取。

### 在线地址（URL）

> 如果无法访问 `raw.githubusercontent.com`，可以使用第二个地址（`cdn.jsdelivr.net`），但内容更新会有 12 小时的延迟。以下地址填写在 Clash 配置文件中的 `rule-providers` 的 `url` 配置项中。

- 直连域名列表 direct.txt：
  ```text
  https://raw.githubusercontent.com/Loyalsoldier/clash-rules/release/direct.txt
  https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/direct.txt
  ```
- 代理域名列表 proxy.txt：
  ```text
  https://raw.githubusercontent.com/Loyalsoldier/clash-rules/release/proxy.txt
  https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/proxy.txt
  ```
- 广告域名列表 reject.txt：
  ```text
  https://raw.githubusercontent.com/Loyalsoldier/clash-rules/release/reject.txt
  https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/reject.txt
  ```
- 私有网络专用域名列表 private.txt：
  ```text
  https://raw.githubusercontent.com/Loyalsoldier/clash-rules/release/private.txt
  https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/private.txt
  ```
- Apple 在中国大陆可直连的域名列表 apple.txt：
  ```text
  https://raw.githubusercontent.com/Loyalsoldier/clash-rules/release/apple.txt
  https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/apple.txt
  ```
- iCloud 域名列表 icloud.txt：
  ```text
  https://raw.githubusercontent.com/Loyalsoldier/clash-rules/release/icloud.txt
  https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/icloud.txt
  ```
- [慎用] Google 在中国大陆可直连的域名列表 google.txt：
  ```text
  https://raw.githubusercontent.com/Loyalsoldier/clash-rules/release/google.txt
  https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/google.txt
  ```
- GFWList 域名列表 gfw.txt：
  ```text
  https://raw.githubusercontent.com/Loyalsoldier/clash-rules/release/gfw.txt
  https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/gfw.txt
  ```
- 非中国大陆使用的顶级域名列表 tld-not-cn.txt：
  ```text
  https://raw.githubusercontent.com/Loyalsoldier/clash-rules/release/tld-not-cn.txt
  https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/tld-not-cn.txt
  ```
- Telegram 使用的 IP 地址列表 telegramcidr.txt：
  ```text
  https://raw.githubusercontent.com/Loyalsoldier/clash-rules/release/telegramcidr.txt
  https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/telegramcidr.txt
  ```
- 局域网 IP 及保留 IP 地址列表 lancidr.txt：
  ```text
  https://raw.githubusercontent.com/Loyalsoldier/clash-rules/release/lancidr.txt
  https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/lancidr.txt
  ```
- 中国大陆 IP 地址列表 cncidr.txt：
  ```text
  https://raw.githubusercontent.com/Loyalsoldier/clash-rules/release/cncidr.txt
  https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/cncidr.txt
  ```
- 需要直连的常见软件列表 applications.txt：
  ```text
  https://raw.githubusercontent.com/Loyalsoldier/clash-rules/release/applications.txt
  https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/applications.txt
  ```

### 使用方法

在 Clash 配置文件的 `rule-providers` 字段中添加如下内容：

```yaml
rule-providers:
  reject:
    type: http
    behavior: domain
    url: "https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/reject.txt"
    path: ./ruleset/reject.yaml
    interval: 86400

  icloud:
    type: http
    behavior: domain
    url: "https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/icloud.txt"
    path: ./ruleset/icloud.yaml
    interval: 86400

  apple:
    type: http
    behavior: domain
    url: "https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/apple.txt"
    path: ./ruleset/apple.yaml
    interval: 86400

  google:
    type: http
    behavior: domain
    url: "https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/google.txt"
    path: ./ruleset/google.yaml
    interval: 86400

  proxy:
    type: http
    behavior: domain
    url: "https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/proxy.txt"
    path: ./ruleset/proxy.yaml
    interval: 86400

  direct:
    type: http
    behavior: domain
    url: "https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/direct.txt"
    path: ./ruleset/direct.yaml
    interval: 86400

  private:
    type: http
    behavior: domain
    url: "https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/private.txt"
    path: ./ruleset/private.yaml
    interval: 86400

  gfw:
    type: http
    behavior: domain
    url: "https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/gfw.txt"
    path: ./ruleset/gfw.yaml
    interval: 86400

  tld-not-cn:
    type: http
    behavior: domain
    url: "https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/tld-not-cn.txt"
    path: ./ruleset/tld-not-cn.yaml
    interval: 86400

  telegramcidr:
    type: http
    behavior: ipcidr
    url: "https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/telegramcidr.txt"
    path: ./ruleset/telegramcidr.yaml
    interval: 86400

  cncidr:
    type: http
    behavior: ipcidr
    url: "https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/cncidr.txt"
    path: ./ruleset/cncidr.yaml
    interval: 86400

  lancidr:
    type: http
    behavior: ipcidr
    url: "https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/lancidr.txt"
    path: ./ruleset/lancidr.yaml
    interval: 86400

  applications:
    type: http
    behavior: classical
    url: "https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/applications.txt"
    path: ./ruleset/applications.yaml
    interval: 86400
```

### 白名单模式 Rules 配置方式（推荐）

白名单模式意为「没有命中规则的网络流量，统统使用代理」，适用于服务器线路网络质量稳定、快速，且不缺服务器流量的用户。

以下配置中，除了 `DIRECT` 和 `REJECT` 是默认存在于 Clash 中的 policy（路由策略/流量处理策略），其余均为自定义 policy，对应配置文件中 `proxies` 或 `proxy-groups` 中的 `name`。如果直接使用下面的 `rules` 规则，则需要在 `proxies` 或 `proxy-groups` 中手动配置一个名为 `PROXY` 的 policy。

- 如果希望 Apple、iCloud 和 Google 列表中的域名使用代理，把对应的 policy 由 `DIRECT` 改为 `PROXY`，以此类推。
- 如果不希望进行 DNS 解析，可在 GEOIP 规则的最后加上 `,no-resolve`，例如：`GEOIP,CN,DIRECT,no-resolve`。

```yaml
rules:
  - RULE-SET,applications,DIRECT
  - DOMAIN,clash.razord.top,DIRECT
  - DOMAIN,yacd.haishan.me,DIRECT
  - RULE-SET,private,DIRECT
  - RULE-SET,reject,REJECT
  - RULE-SET,icloud,DIRECT
  - RULE-SET,apple,DIRECT
  - RULE-SET,google,DIRECT
  - RULE-SET,proxy,PROXY
  - RULE-SET,direct,DIRECT
  - RULE-SET,lancidr,DIRECT
  - RULE-SET,cncidr,DIRECT
  - RULE-SET,telegramcidr,PROXY
  - GEOIP,LAN,DIRECT
  - GEOIP,CN,DIRECT
  - MATCH,PROXY
```

### 黑名单模式 Rules 配置方式

黑名单模式意为「只有命中规则的网络流量才使用代理」，适用于服务器线路网络质量不稳定、速度不够快，或服务器流量紧缺的用户。通常也是软路由用户、家庭网关用户的常用模式。

```yaml
rules:
  - RULE-SET,applications,DIRECT
  - DOMAIN,clash.razord.top,DIRECT
  - DOMAIN,yacd.haishan.me,DIRECT
  - RULE-SET,private,DIRECT
  - RULE-SET,reject,REJECT
  - RULE-SET,tld-not-cn,PROXY
  - RULE-SET,gfw,PROXY
  - RULE-SET,telegramcidr,PROXY
  - MATCH,DIRECT
```

---

通过以上步骤，你就可以基于 GitHub Gist 搭建自己的私有 Clash 订阅，并灵活配置分流规则，兼顾安全与效率。
