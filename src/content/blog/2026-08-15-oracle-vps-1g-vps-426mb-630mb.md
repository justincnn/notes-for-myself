---
title: Oracle 免费 VPS 优化手册：1G 小内存 VPS 从 426MB 可用到 630MB 完整实战
excerpt: 以一台 Oracle Cloud 免费 1核/1G 小内存
  VPS（跑自用代理服务）为例，讲透小内存机器的完整优化方法论：内存审计、关闭无用服务、移除 snapd、journald 限容、swappiness
  调优、重启验证，以及把易失服务转成 systemd 开机自启。每一步都有真实数据对比和可复制命令
date: 2026-08-15
updated: 2026-08-15
category: VPS
tags:
  - VPS
  - Oracle
  - Linux
author: Justin
thumbnail: /vps-ssh-guide.webp
featured: false
draft: false
---
> **30 秒看懂**：Oracle 免费层给你一台 1 核 / 1G 内存的小鸡，跑个自用代理服务本来够，但会被一堆"看不见"的系统服务（snapd、fwupd、cloud-init、journald）偷偷吃掉一半内存。这篇手册带你用**内存审计 → 关掉无用服务 → 移除 snapd → 调优内核 → 重启验证 → 易失服务转 systemd** 一套流程，把可用内存从 426MB 提到 630MB，并且以后重启都不怕丢服务。

你有没有遇到过这种情况：一台只有 1G 内存的 VPS，跑着跑着可用内存只剩三四百兆，swap 用得越来越狠，机器越来越卡，查了半天也不知道谁吃了内存？

**别急着加钱换配置**——大部分内存都被系统默认开着的"你以为有用其实没用"的服务吃掉了。这篇手册用一台真实的 **Oracle Cloud 免费 1核/1G VPS**（跑自用代理服务）做实例，完整演示怎么一步步把小机的内存抠出来。

全程命令可直接复制，每一步都配**真实前后数据对比**，照着做你的机器也能瘦一圈。

---

## 这个优化能带来什么


| 指标 | 优化前 | 优化后 | 变化 |
| ------------------ | ------ | ---------- | ----------- |
| **可用内存 available** | 426 MB | **630 MB** | **+204 MB** |
| 空闲内存 free | 199 MB | **504 MB** | +305 MB |
| swap 使用量 | 172 MB | **0 MB** | 全部释放 |


> 说明：630MB 是重启后（调优全量生效）的峰值；平时稳定在 ~470MB 附近。关键是从 426MB 这个"挤兑"水位线拉出来，不再天天压 swap。

---

## 技术原理

```
Oracle 小内存 VPS（1核1G）
          │
          ├─ 真正要用的服务: 代理面板 + 代理内核 (约 120MB)
          ├─ 你想留的自用服务: 约 136MB
          └─ 被浪费的: snapd + fwupd + cloud-init + journald 等 (约 150MB) ← 削这里
```

**一句话**：小内存机的优化核心 = **找到并停掉"你以为有用其实没用"的服务**，而不是去限制那些真正在用的服务。

怎么找？打开任务管理器看内存排序 `ps aux --sort=-%mem`，把每个进程的占用和"它到底在干嘛"对上，就能分辨哪些是"吃干饭"的。

---

## 前置准备

先确认你要优化的是哪种机器，方法通用，只是具体命令会因发行版略有区别。


| 项目 | 说明 |
| --- | -------------------------------------------------- |
| VPS | Oracle / AWS / 各种云均可，本教程以 Oracle Ubuntu 24.04 为例 |
| 内存 | **1G（本教程核心场景）**，2G 以上同样适用，收益略小 |
| 系统 | Ubuntu / Debian（命令以 Ubuntu 为例，Debian 几乎一致） |
| 权限 | **root** 或 **带免密 sudo** 的普通用户（本机用 `ubuntu` + sudo） |
| 用时 | 约 15~20 分钟（不含重启等待） |


**先记住一个安全原则**：下面每一步都只 `stop + disable`（停止 + 禁止开机自启)，**不卸载**软件包。这样就算判断失误，一条 `systemctl enable --now <服务>` 就能恢复。只有 snapd 这种明确无用的才走到卸载。

---

## 第一步：给机器做"内存体检"

优化之前，先搞清楚**到底谁在吃内存**。这个步骤只读，不会改任何东西，放心跑。

### 1.1 整体资源概况

```bash
free -h                # 看内存总量和可用(注意看 available, 不是 free)
nproc                  # 核数
uptime                 # 负载
df -h /                # 磁盘
```

**一个判断坑**：看内存要看 `available`，**不要只看 `free`**。`free` 很小不代表不够，因为 Linux 会把空闲内存拿去当缓存（buff/cache），需要时会自动释放。`available` 才是"实际可用的内存"。

本机初始状态：

```text
Mem:  954M total   527M used    199M free    4M shared  42 378M buff/cache  426M available
Swap: 2G  total    172M used
```

> 关键判断：`available 426M`，说明这台 1G 机内存已经偏紧（可用不足一半）。

### 1.2 找出内存大户

```bash
ps aux --sort=-%mem | head -12
```

本机真实输出（已格式化）：


| 排名 | 进程 | 内存占用 | 是什么 | 该不该动 |
| --- | ---------------------- | ------------ | --------------- | ------------------- |
| 1 | **手动启动的自用服务 python** | 14.2% ≈ 136M | 业务网关 | ⚠️ 看用途，必要时转 systemd |
| 2 | **代理面板** | 9.4% ≈ 90M | 自用代理面板（主业） | ❌ 保留 |
| 3 | **systemd-journald** | 4.4% ≈ 42M | 系统日志 | 🔄 重启释放 + 限容 |
| 4 | **代理内核** | 3.7% ≈ 35M | 代理转发内核（主业） | ❌ 保留 |
| 5 | **fail2ban** | 3.4% ≈ 33M | 防爆破 | ❌ 保留 |
| 6 | **snapd** | 1.9% ≈ 18M | **只装了无用的 snap** | 🟡 移除 |
| 7 | **fwupd** | 1.6% ≈ 16M | **虚拟机固件更新，无用** | 🟡 停 |
| ... | udisksd / cloud-init 等 | 各 ~8M | **都是默认开但没用上的** | 🟡 停 |


**体检结论**：真正要用的代理面板 + 内核才 120M，剩下三百多兆被一堆默认服务瓜分。这里有个直觉要先建立——**Oracle 云的 Ubuntu 镜像默认开了一大堆"在云上没有意义"的服务**（fwupd 固件更新、udisks 桌面磁盘、cloud-init 云初始化、pollinate 熵补充），对一台跑代理服务的小鸡全是负担。

---

## 第二步：停掉并禁用无用服务

体检完就知道该关谁了。以下服务对一台 Oracle 小鸡**都没有实际用途**，但吃内存。全部用 `disable --now`（停止 + 禁止开机自启），一条命令搞定：

```bash
for svc in fwupd udisks2 pollinate iscsid open-iscsi nvmf-autoconnect nvmefc-boot-connections; do
  sudo systemctl disable --now "$svc.service" 2>/dev/null && echo "已停: $svc" || echo "跳过: $svc"
done
```

**每个服务是干嘛的，为什么能关：**


| 服务 | 用途 | 为什么能关 |
| ---------------------------------------------- | ----------------- | ------------------------ |
| `fwupd` | 固件更新 | **QEMU/虚拟机没有可更新的固件**，纯占位 |
| `udisks2` | 桌面磁盘管理 | 服务器没有插拔磁盘的需求 |
| `pollinate` | 熵池补充 | 云上可有可无 |
| `iscsid` / `open-iscsi` | iSCSI 存储连接 | 没有 iSCSI 存储 |
| `nvmf-autoconnect` / `nvmefc-boot-connections` | NVMe over Fabrics | 云盘不需要 |
| `cloud-init*` | 云初始化 | **开机第一次跑完就没用了**，后续纯轮询 |


### cloud-init 单独处理

cloud-init 是"开机时按云厂商给的配置初始化系统"，跑完就没用了。可以禁掉它的自动运行但**保留本体**（防止某些云盘挂载依赖它）：

```bash
sudo systemctl disable cloud-config.service cloud-init.service cloud-init-local.service
```

> 验证：重启后确认这些服务**没有自动起来**。判断标准是 `systemctl is-enabled <服务>` 显示 `disabled`。注意 **udisks2 显示 `static` 是正常的**（它由 `.socket` 管理），重点是重启后 `systemctl is-active udisks2` 为 `inactive` 即可。

---

## 第三步：完整移除 snapd

**为什么 snapd 值得卸**：snapd 是 Ubuntu 的软件包管理系统，但它默认带一堆服务（snapd.service、snapd.apparmor、snapd.seeded 等 9 个）+ 一个 `core18` 基础包，在这台机器上**没有任何实际用到的 snap 应用**。卸掉它清掉的不只是进程，还有一堆开机自启的服务。

### 3.1 先确认 snapd 没装你需要的应用

```bash
snap list
```

本机输出只有 `core18`（基础库）和 `snapd`（本体），没有其他应用 → 可以放心卸。

### 3.2 停 + 禁用所有 snapd 服务

```bash
sudo systemctl list-unit-files --type=service 2>/dev/null | grep snapd | awk '{print $1}' | \
  while read svc; do sudo systemctl disable --now "$svc"; done
```

这一步把 9 个 snapd.* 服务全部 `stop + disable`。

### 3.3 mask 掉 socket

**很多人漏了这一步**：snapd 有 `.socket` 单元（snapd.socket），只禁 `.service` 不够，socket 会重新拉起服务。必须连 socket 一起 mask：

```bash
sudo systemctl mask snapd.service snapd.socket
```

> `mask` = 把服务链接到 `/dev/null`，彻底禁止启动。即使有东西想拉它也会失败。

### 3.4 卸载 snapd 软件包

```bash
sudo apt-get purge -y snapd
sudo apt-get autoremove -y
sudo apt-get clean
```

`purge` 会连带移除 `core18`、`squashfs-tools` 等依赖。

### 3.5 验证彻底干净

```bash
ps aux | grep snapd | grep -v grep        # 应为空
dpkg -l snapd 2>/dev/null | tail -1        # 应显示 un <none>
mount | grep -c snap                        # 应为 0
```

本机验证结果：

```text
ps    -> NONE（无进程）
dpkg  -> un snapd <none>（未安装）
mount -> 0（无 snap 挂载残留）
```

**这一步回收**：snapd 相关进程 + 服务 + core18 基础包，累计释放约 25~30MB 内存 + 数百 MB 磁盘（core18 squashfs）。

---

## 第四步：journald 限容 + swappiness 调优

前面关的是"无用服务"，这两个是**内核/日志层面的调优**，不关任何服务也能减少内存和 swap 压力，是低成本高回报的动作。

### 4.1 journald 限制日志占用的内存和磁盘

systemd-journald 能把日志全塞进内存（占几个百分点），限制它在磁盘上的上限和保留时间，能缓解内存拥挤：

```bash
sudo mkdir -p /etc/systemd/journald.conf.d
cat <<'EOF' | sudo tee /etc/systemd/journald.conf.d/limit.conf
[Journal]
SystemMaxUse=50M
SystemMaxFileSize=10M
MaxRetentionSec=7day
EOF
sudo systemctl restart systemd-journald
```

- `SystemMaxUse=50M`：日志最多占 50M 磁盘
- `SystemMaxFileSize=10M`：单文件上限
- `MaxRetentionSec=7day`：只保留 7 天

### 4.2 降低 swappiness

**swappiness 是"系统多爱用 swap"的程度**（0~100，默认 60）。对小内存机来说，60 偏高——系统太早把内存里的东西换去 swap，反而更卡。调低到 10，让系统**尽量先用内存、少用 swap**：

```bash
echo "vm.swappiness=10" | sudo tee /etc/sysctl.d/99-swappiness.conf
sudo sysctl -w vm.swappiness=10
```

> 这个设置写进 `/etc/sysctl.d/`，**重启后依然生效**。改完可以立即验证：`sysctl -n vm.swappiness` 应输出 `10`。

### 4.3 清理 apt 缓存

```bash
sudo apt-get clean
sudo apt-get autoremove -y
```

---

## 第五步：重启让所有调优生效

sysctl 和 journald 的改动**重启后才会完整生效**（虽然 swappiness 可以即时生效，但 journald 限容和"服务不再自启"要重启才彻底）。重启也是验证前面所有 `disable` 是否真正生效的唯一手段。

### 5.1 安全重启（避免 SSH 断开导致中断）

直接 `reboot` 会断开 SSH。用 systemd-run 调度一个延迟重启，命令能安全返回：

```bash
sudo systemd-run --on-active=3 systemctl reboot
```

> 小技巧：`systemd-run --on-active=3` 让它在 3 秒后执行，你的 SSH 命令能先正常返回，不用等下一条输出。

### 5.2 重启后验证

连回来（可能需等 1~3 分钟）后，逐项确认：

```bash
uptime -s                        # 看启动时间是不是刚才
free -m                          # 内存对比
sysctl -n vm.swappiness          # 应为 10
cat /etc/systemd/journald.conf.d/limit.conf   # 限容还在
systemctl is-active 代理面板服务    # 主业服务起来了
```

**真实效果对比（本机）：**


| 指标 | 重启前 | 重启后 |
| --------- | ------- | ---------- |
| available | ~480 MB | **630 MB** |
| free | 244 MB | **504 MB** |
| swap used | 168 MB | **0 MB** |


**关键验证**：之前停的无用服务重启后 `systemctl is-active` 全部为 `inactive`，`代理面板`、`fail2ban` 自动恢复。

### ⚠️ 重启后的意外：非 systemd 服务会丢

重启前我注意到有一个自用服务（业务网关）**不是 systemd 服务**——它是手动前台跑的进程。重启后果然端口未监听、进程消失。**非 systemd 的后台进程重启后不会自动回来**，这是小内存机上最常见的"重启丢服务"事故来源。解决见下一步。

---

## 进阶：这台机器长期积累的其他优化与精简

前面几步聚焦"内存"，但一台小 VPS 在长期使用中往往还做过**安全加固、内核调优、磁盘/用户精简**。这些和内存优化同等重要，这里补充完整，让手册覆盖"一台 VPS 从低配到够用"的全过程。

> 说明：以下命令来自这台机器实际执行过的操作记录整理，都已本机验证可用。

### 进阶一：BBR 加速（网络层）

BBR 是 Google 的拥塞控制算法，对跨国网络、流媒体访问提速明显。Oracle 云内核自带，只需启用：

```bash
# 写进 /etc/sysctl.d/99-bbr.conf
echo "net.core.default_qdisc=fq" | sudo tee /etc/sysctl.d/99-bbr.conf
echo "net.ipv4.tcp_congestion_control=bbr" | sudo tee -a /etc/sysctl.d/99-bbr.conf
sudo sysctl -p /etc/sysctl.d/99-bbr.conf
```

验证：`sysctl net.ipv4.tcp_congestion_control` 应输出 `bbr`。

### 进阶二：内核网络参数调优（/etc/sysctl.d/）

这台机器在 `/etc/sysctl.d/` 里配了一整套网络调优，小 VPS 跑代理服务常用。关键几项：

```bash
# 开启 IP 转发（代理服务需要）
echo "net.ipv4.ip_forward=1" | sudo tee /etc/sysctl.d/99-proxy.conf
echo "net.ipv6.conf.all.forwarding=1" | sudo tee -a /etc/sysctl.d/99-proxy.conf
# 开启反向路径过滤（防 IP 欺骗）
echo "net.ipv4.conf.all.rp_filter=2" | sudo tee -a /etc/sysctl.d/99-proxy.conf
# 提升 mmap 上限（多进程/容器需要）
echo "vm.max_map_count=1048576" | sudo tee -a /etc/sysctl.d/99-proxy.conf
sudo sysctl -p
```

> `rp_filter=2` 是"松散模式"，防欺骗同时避免误伤合理流量；`max_map_count` 调大能避免某些应用报 "out of memory" 类的 mmap 错误。

### 进阶三：内核安全加固（防信息泄露）

Oracle 云 Ubuntu 默认偏"桌面宽松"，安全加固是让服务器变"硬"的关键：

```bash
# 限制 dmesg 输出 (kernel.printk)
echo "kernel.printk=4 4 1 7" | sudo tee /etc/sysctl.d/99-kernel-hardening.conf
# 限制内核指针暴露
echo "kernel.kptr_restrict=1" | sudo tee -a /etc/sysctl.d/99-kernel-hardening.conf
# 限制 ptrace (防调试器附加其他进程)
echo "kernel.yama.ptrace_scope=1" | sudo tee -a /etc/sysctl.d/99-kernel-hardening.conf
# 禁用 SysRq 危险组合
echo "kernel.sysrq=176" | sudo tee -a /etc/sysctl.d/99-kernel-hardening.conf
sudo sysctl -p
```

### 进阶四：swap 与磁盘精简

1G 内存机**必须有 swap 兜底**。如果还没有，创建 2G swap：

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

磁盘精简（可回收几百 MB）：

```bash
sudo apt-get clean              # 清理 apt 缓存
sudo apt-get autoremove -y      # 移除孤儿依赖
sudo journalctl --vacuum-size=50M   # 日志限容
```

### 进阶五：用户精简

这台机器只有 `ubuntu`（业务用户）+ `opc`（Oracle 云默认）+ `nobody`，没有多余账号：

```bash
# 查看所有可登录账号（uid>=1000 且 shell 是 bash/sh）
getent passwd | awk -F: '$3>=1000 && $7 ~ /(bash|sh)$/ {print $1}'
# 删除多余账号
sudo userdel -r <多余账号>
```

> Oracle 云有个 `opc` 用户是镜像默认的，别删；只清理你确认不用的账号。

---

## 第六步：把易失服务转成 systemd 开机自启

怎么判断一个服务是不是 systemd 管的？一句话：`**systemctl list-unit-files | grep <名字>` 查不到它，就是野进程**。野进程重启就丢，必须转正。

### 6.1 确认启动命令

先用 `ps` 找到它当初怎么启动的（把 `your-service` 换成你自己的服务名）：

```bash
ps aux | grep -i your-service
```

拿到完整命令（例如本机自用网关的真实启动命令，用占位符表示路径）：

```text
/opt/your-app/bin/python -m your_app gateway --foreground --port <你的端口>
```

### 6.2 写 systemd 单元文件

关键有三点：**用对用户**（配置/二进制属于谁就用谁跑）、**指定工作目录**（让程序能找到它的配置）、**Restart=always**（挂了自动拉起）：

```bash
sudo tee /etc/systemd/system/your-service.service <<'EOF'
[Unit]
Description=Your App Gateway
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=your-user
WorkingDirectory=/path/to/your/app
Environment=HOME=/path/to/home
ExecStart=/opt/your-app/bin/python -m your_app gateway --foreground --port <你的端口>
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF
```

### 6.3 启用并启动

```bash
sudo systemctl daemon-reload
sudo systemctl enable your-service.service    # 开机自启
sudo systemctl start your-service.service      # 现在启动
```

### 6.4 验证

```bash
systemctl status your-service.service    # 应 active (running)
sudo ss -tlnp | grep <你的端口>                # 端口应监听
```

**以后重启不再丢**——`enable` 了它，开机自动起，`Restart=always` 也让它在崩溃时自动复活。

---

## 第七步（可选）：确认并开启 BBR

BBR 是 Google 的拥塞控制算法，对跨国网络/流媒体访问提速明显。**Oracle 云的内核（如 6.17.0-1019-oracle）自带 BBR，无需装额外模块**，只需确认它开着：

```bash
sysctl net.ipv4.tcp_congestion_control
sysctl net.core.default_qdisc
```

本机输出：

```text
net.ipv4.tcp_congestion_control = bbr
net.core.default_qdisc = fq
```

如果显示 `cubic`，一次性开启：

```bash
echo "net.core.default_qdisc=fq" | sudo tee -a /etc/sysctl.d/99-bbr.conf
echo "net.ipv4.tcp_congestion_control=bbr" | sudo tee -a /etc/sysctl.d/99-bbr.conf
sudo sysctl -p /etc/sysctl.d/99-bbr.conf
```

> 老内核可能需要 `modprobe tcp_bbr`，Oracle 云现代内核默认已编译进内核，一般不用。

---

## 命令速查表（全文精华）


| 目的 | 命令 |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| 内存体检 | `free -h` 然后 `ps aux --sort=-%mem | head -12` |
| 停用一组服务 | `for s in fwupd udisks2 pollinate iscsid open-iscsi nvmf-autoconnect nvmefc-boot-connections; do sudo systemctl disable --now "$s"; done` |
| 移除 snapd | `systemctl mask snapd.service snapd.socket; sudo apt-get purge -y snapd` |
| journald 限容 | 写入 `/etc/systemd/journald.conf.d/limit.conf` 后 `systemctl restart systemd-journald` |
| 降 swappiness | `echo "vm.swappiness=10" | sudo tee /etc/sysctl.d/99-swappiness.conf; sudo sysctl -w vm.swappiness=10` |
| 安全重启 | `sudo systemd-run --on-active=3 systemctl reboot` |
| 重启后查服务 | `systemctl list-unit-files | grep <名字>` |


## FAQ（常见问题排查）

**Q1：重启后 `free` 显示内存还是不高，是不是优化没生效？**
A：看 `available` 而不是 `free`。刚开机 buff/cache 会缓存磁盘，`free` 小是正常的；`available` 才是可用水位。等跑一会儿缓存被回收，available 会稳定在优化后的水位。

**Q2：我把 fwupd / udisks2 停了，会不会影响系统安全或功能？**
A：不会。fwupd 是虚拟机固件更新（云上没固件可刷），udisks2 是桌面磁盘管理（服务器用不上）。真要恢复，`sudo systemctl enable --now <服务>` 一条命令就回来。

**Q3：为什么要 mask snapd 的 socket？只 disable 不够吗？**
A：不够。snapd 有 `.socket` 单元，禁用 `.service` 后，socket 激活机制可能把服务重新拉起。mask 把它建链到 `/dev/null` 彻底禁止，双保险。

**Q4：我的服务重启后丢了，怎么办？**
A：先 `ps aux | grep <服务>` 找到启动命令，再把它转成 systemd 服务（写 service 文件 + enable）。这就是"重启丢服务"的标准解法，详见第六步。

**Q5：swappiness 调到 10 会不会内存不够反而 OOM？**
A：调到 10 只是让系统更不情愿用 swap，优先复用空闲内存。这台机有 2G swap 兜底，不会 OOM。真正怕的是默认 60 频繁换页卡顿，调低反而顺滑。

**Q6：这些优化对 2G/4G 内存的机器适用吗？**
A：适用，方法一样，只是收益递减。但移除 snapd、journald 限容、BBR 对任何规格都值得做。

**Q7：我删了 snapd，以后还能装 snap 应用吗？**
A：能。需要时 `sudo apt-get install snapd` 重新装回。如果这台机没有非用不可的 snap 应用，删掉很划算。

---

> **免责声明**：本教程基于一台实际 Oracle Cloud 免实例的优化过程整理。操作涉及停止/卸载系统服务，请务必在**能通过 SSH 重连**的前提下操作，并确认每项服务不是你正在使用的。文中所有命令在 Ubuntu 24.04 验证通过，其他发行版可能有差异。生产环境建议先在测试机验证。因操作不当造成的任何损失，本文作者不承担相关责任。

