---
title: 新建 Oracle VPS 的推荐设置
excerpt: 针对 Oracle Cloud Ubuntu VPS 的新机初始化指南：清理默认 iptables、配置 UFW 防火墙、使用
  Fail2ban 自动封禁攻击 IP，并完成 SSH 端口加固。
date: 2026-08-08
updated: 2026-08-08
category: VPS
tags:
  - VPS
author: Justin
thumbnail: /ChatGPT Image 2026年8月8日 14_07_08.png
featured: true
draft: false
---
Oracle Cloud 的 Ubuntu 实例在创建时默认使用 `ubuntu` 用户（非 root，支持 `sudo` 提权），并且强制使用 SSH 密钥登录，基础安全性已经比传统的密码登录 VPS 好很多。

但新实例默认的 iptables 规则会限制大部分入站端口，SSH 也仍然暴露在默认的 22 端口上，长期运行仍会遭受大量扫描和攻击。

本文将带你完成一套面向 Oracle VPS 的推荐初始化设置：清理默认防火墙规则、配置 UFW、利用 Fail2ban 自动封禁恶意 IP，并加固 SSH 端口。

## 1. 系统更新与基础工具安装

```bash
sudo apt update -y && sudo apt upgrade -y
sudo apt install -y curl wget vim
```

> 首次 `apt upgrade` 可能需要较长时间，建议在 SSH 连接稳定的情况下执行。

## 2. 手动创建 SWAP 虚拟内存

Oracle 的免费实例通常只有 1G 内存，运行编译任务或数据库时容易内存不足。建议手动创建 SWAP 文件缓解压力：

```bash
# 查看当前内存与 SWAP 情况
free -m

# 创建 2G 的 SWAP 文件（可根据实际内存调整大小）
sudo fallocate -l 2G /swapfile

# 如果 fallocate 不支持，使用 dd 代替
# sudo dd if=/dev/zero of=/swapfile bs=1M count=2048

# 设置权限，防止普通用户读取
sudo chmod 600 /swapfile

# 格式化为 SWAP
sudo mkswap /swapfile

# 立即启用
sudo swapon /swapfile

# 写入 /etc/fstab，实现开机自动挂载
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# 验证
free -m
```

可选优化：降低 swappiness，让系统优先使用物理内存：

```bash
echo 'vm.swappiness=10' | sudo tee -a /etc/sysctl.conf
sudo sysctl -p
```

## 3. 清理 Oracle 默认 iptables 规则

Oracle Cloud 的 Ubuntu 镜像默认通过 `netfilter-persistent` 持久化了一套 iptables 规则，会拦截大部分入站连接。建议清除这些规则，之后统一交给 UFW 管理。

```bash
# 清空所有规则
sudo iptables -P INPUT ACCEPT
sudo iptables -P FORWARD ACCEPT
sudo iptables -P OUTPUT ACCEPT
sudo iptables -F

# 卸载 netfilter-persistent，防止重启后规则再次生效
sudo apt-get purge -y netfilter-persistent

# 删除残留规则文件
sudo rm -rf /etc/iptables

# 重启生效
sudo reboot
```

> 重启后重新连接 SSH，确认一切正常再继续后续配置。

> **注意**：Oracle Cloud 控制台还需要在 VCN 的安全列表（Security List）或 NSG 中放行对应端口，否则服务器内部放行也无法从外部访问。

## 4. 安装 UFW 防火墙

### 4.1 安装并启用 UFW

```bash
sudo apt install -y ufw
```

### 4.2 配置 UFW 规则

**务必先放行 SSH 端口，再启用防火墙**，避免失去连接：

```bash
# 放行 SSH（默认 22 端口）
sudo ufw allow OpenSSH

# 放行 Web 服务端口
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# 如果后续更改了 SSH 端口，需要同时放行新端口
# sudo ufw allow 1218/tcp

# 默认拒绝入站，允许出站
sudo ufw default deny incoming
sudo ufw default allow outgoing

# 启用防火墙
sudo ufw enable
sudo ufw status verbose
```

> 建议只保留必要端口。如果管理 IP 固定，可用 `sudo ufw allow from <你的 IP>` 设置白名单，安全性更高。

## 5. 安装 Fail2ban

```bash
sudo apt install -y fail2ban python3-pyinotify
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

> `python3-pyinotify` 是 `backend = pyinotify` 依赖的 Python 库，第 6 节配置 UFW BLOCK 日志监控时会用到。

## 6. Fail2ban 监控 UFW BLOCK 日志并自动封禁

这是本文的核心功能：让 Fail2ban 监控 UFW 日志，发现被 UFW 拦截的可疑 IP 后，自动执行封禁。

### 6.1 创建 UFW BLOCK 过滤器

```bash
sudo vi /etc/fail2ban/filter.d/ufw-block.conf
```

内容如下：

```ini
[Definition]
# 匹配 UFW BLOCK 日志中的 SRC=<IP>
failregex = ^.*\[UFW BLOCK\].*SRC=<HOST>.*$
ignoreregex =
```

> **注意**：`# 注释` 必须单独成行。如果直接写在 `failregex` 行尾，注释内容会被并入正则表达式，`$` 锚点之后还有字符，导致这条规则永远匹配不到任何日志。

- `<HOST>` 是 Fail2ban 内置变量，自动匹配 IP 地址。
- 该规则会匹配 `/var/log/ufw.log` 中所有包含 `[UFW BLOCK]` 的日志行。

### 6.2 创建 UFW 封禁 Action

```bash
sudo vi /etc/fail2ban/action.d/ufw-blockip.conf
```

内容如下：

```ini
[Definition]
actionban = ufw insert 1 <blocktype> from <ip> to any
actionunban = ufw delete <blocktype> from <ip> to any
```

- `blocktype` 用于控制封禁方式：`deny` 为静默丢弃，`reject` 会主动返回拒绝响应。
- 默认推荐 `deny`：不暴露主机存在，扫描方无法判断端口是否存活。
- 后续如需调整封禁策略，只需修改 6.3 节中传入的 `blocktype` 参数，无需改动 action 文件。

### 6.3 配置 jail.local

```bash
sudo vi /etc/fail2ban/jail.local
```

参考配置：

```ini
[DEFAULT]
# 白名单：本机、内网以及你自己的管理 IP
ignoreip = 127.0.0.1/8 ::1 192.168.1.0/24 123.123.123.123
allowipv6 = true
backend = auto

# 全局默认参数
bantime = 3600
findtime = 600
maxretry = 5

# SSH 暴力破解防护
[sshd]
enabled = true
filter = sshd
port = ssh
logpath = %(sshd_log)s
bantime = 86400
findtime = 86400
maxretry = 3
action = nftables[type=allports]

# 监控 UFW BLOCK 日志，自动封禁攻击 IP
[ufw-block]
enabled = true
filter = ufw-block
logpath = /var/log/ufw.log
backend = pyinotify
maxretry = 5
findtime = 600
bantime = -1
action = ufw-blockip[blocktype=deny]

# 可选：Nginx 恶意爬虫防护（需先安装 Nginx）
# [nginx-botsearch]
# enabled = true
# port = http,https
# logpath = /var/log/nginx/access.log
# maxretry = 100
# findtime = 600
# bantime = 2592000
```

配置要点：

- **SSH 封禁必须覆盖所有端口**：`[sshd]` 中默认的 `action = %(action_)s` 只生成 `tcp dport 22` 的封禁规则，如果 SSH 运行在 1218 等非默认端口，这条规则永远匹配不上，暴力破解封禁形同虚设。改用 `nftables[type=allports]` 后，Fail2ban 会直接封禁源 IP 的所有端口连接，无论 SSH 使用哪个端口都有效。
- **`backend = pyinotify` 解决日志空转**：全局 `backend = auto` 在 systemd 系统上会被解析为 `systemd`，导致 `[ufw-block]` 从 journal 读取日志，而 `/var/log/ufw.log` 的内容在 journal 中并没有对应的匹配项，最终 `Total failed` 永远为 0，jail 一直在空转。强制指定 `pyinotify` 后，Fail2ban 直接监听日志文件变化，实时读取 UFW BLOCK 记录。
- **`blocktype = deny` 优于 `reject`**：`reject` 会向攻击者返回 ICMP 不可达等拒绝响应，等于告诉对方“这里有一台主机”；`deny` 则静默丢弃，不提供任何反馈。这也是本文 action 文件默认使用 `deny` 的原因。
- `bantime = -1` 表示永久封禁。担心误封可改为 `86400`（24 小时）。
- `ignoreip` 中务必加入自己的管理 IP，避免误封。

### 6.4 重启并验证

```bash
# 检查配置语法
sudo fail2ban-client -t

# 重启 Fail2ban
sudo systemctl restart fail2ban

# 查看所有 jail
sudo fail2ban-client status
```

预期输出：

```text
Status
|- Number of jail:      2
`- Jail list:   sshd, ufw-block
```

查看具体封禁情况：

```bash
sudo fail2ban-client status ufw-block
```

输出示例：

```text
Status for the jail: ufw-block
|- Filter
|  |- Currently failed: 1
|  |- Total failed: 12
|  `- File list: /var/log/ufw.log
`- Actions
   |- Currently banned: 2
   |- Total banned: 5
   `- Banned IP list: 123.123.123.123 45.45.45.45
```

> 如果修复后 `Total failed` 仍然为 0，优先检查 `backend` 是否被 systemd 接管，以及 `failregex` 行尾是否混入了注释。

### 6.5 手动解封 IP

```bash
sudo fail2ban-client set ufw-block unbanip 123.123.123.123
```

也可以直接查看和管理 UFW 规则：

```bash
sudo ufw status numbered
sudo ufw delete <编号>
```

## 7. 修改 SSH 端口（推荐）

Oracle 默认使用密钥登录，安全性已经不错。但 22 端口仍然每天被大量扫描，修改默认端口可以有效减少这类噪音。

### 7.1 备份并修改配置

```bash
sudo cp /etc/ssh/sshd_config /etc/ssh/sshd_config.backup
sudo vi /etc/ssh/sshd_config
```

取消注释或添加以下内容：

```text
Port 1218
```

> 建议先保留默认的 `Port 22`，新端口测试成功后再删除 22，防止改错导致无法连接。

### 7.2 重启 SSH 服务

```bash
sudo systemctl restart sshd
```

验证端口监听：

```bash
ss -ntl | grep 1218
```

### 7.3 更新 UFW 规则

```bash
sudo ufw allow 1218/tcp
sudo ufw delete allow OpenSSH   # 确认新端口可用后再执行
```

同时到 Oracle Cloud 控制台，在 VCN 安全列表 / NSG 中将新 SSH 端口加入入站规则。

> 由于 `[sshd]` jail 已使用 `nftables[type=allports]`，封禁针对 IP 的所有端口，因此修改 SSH 端口后无需调整 Fail2ban 的 action 配置。

## 8. 总结

完成以上配置后，你的 Oracle VPS 将具备：

- **UFW 默认拒绝入站**，只开放必要端口，攻击面大幅缩小。
- **Fail2ban 自动监控 UFW BLOCK 日志**，达到阈值后自动永久封禁攻击 IP。
- **SSH 暴力破解防护**，3 次失败即封禁 24 小时，且封禁规则覆盖所有端口。
- **SSH 非默认端口**，显著减少扫描攻击噪音。
- **SWAP 虚拟内存**，缓解小内存实例的资源压力。
