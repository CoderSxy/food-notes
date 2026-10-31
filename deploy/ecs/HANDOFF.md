# ECS 发布交接

核验日期：2026-10-30（Asia/Shanghai）。本文不包含密钥。

## 已核验

- 目标 ECS：`101.37.135.116`，杭州，Ubuntu 24.04，2 vCPU / 2 GiB。
- Node.js `22.22.0`，npm `10.9.4`，Nginx 已运行。
- 根盘剩余约 12 GiB，内存 available 约 775 MiB，swap 3 GiB。
- 应用预留 `127.0.0.1:3200`，核验时未被占用；不要改成公网监听。
- Supabase：`bbjifgrprncpgwqupelu`。9 张业务表可访问，10 条菜系、14 条分类，已有 1 个用户名密码账号。
- `users.username/password_hash` 字段存在，`entries.rating` 为 numeric；未重跑迁移或种子。
- 匿名访问 users、entries、categories、cuisines、otp_codes 均返回 401 / 42501。
- 本地 `.env.local` 已有 Supabase、AI 和会话配置；没有将其提交到版本库。
- Certbot 使用 snap，`snap.certbot.renew.timer` 已存在。已独立签发 food 证书，原站点证书未改动。

## 已在 ECS 准备

- 非登录系统用户 `food-notes`。
- `/opt/food-notes/current`、`/opt/food-notes/releases`，由 `food-notes` 持有。
- `/opt/food-notes/prepared/{http,https,maintenance,proxy}.conf`。
- `/etc/systemd/system/food-notes.service`：未启用、未启动，限定本机 3200；无构建时跳过启动。
- `/etc/food-notes/food-notes.env.example`：空密钥模板；目录 0700，文件 0600。
- `/etc/food-notes/food-notes.env`：已安全写入本项目 Supabase / AI 配置；在 ECS 生成独立 64 字符生产 SESSION_SECRET。权限已核验为 `600 root:root`，目录为 `700 root:root`。不要复制该文件到仓库或让代理打印内容。
- `/var/www/food-notes/.well-known/acme-challenge/`。
- `/opt/food-notes/prepared/existing-sites.sha256`：原站点配置指纹。
- `systemd-analyze verify` 通过；HTTP 配置、当前 HTTPS 配置和未来发布用的 HTTPS 反向代理配置均通过 `nginx -t`。

## 域名与 HTTPS

已获得用户确认并提交：`food.nerosun.cn A 101.37.135.116`，TTL 10 分钟，启用。ECS DNS 查询和本机公网访问均已验证。

已启用 `/etc/nginx/sites-available/food-notes`，由 sites-enabled 同名符号链接加载。HTTP 返回 301 到 HTTPS，HTTPS 返回 503 及 `Food Notes: deployment pending.`；这是发布前的预期占位状态。Chrome 和不跳过证书校验的 curl 均验证 HTTPS 可访问。

独立证书路径：`/etc/letsencrypt/live/food.nerosun.cn/{fullchain,privkey}.pem`。到期时间：2027-01-28 14:03:49（Asia/Shanghai）。Certbot webroot：`/var/www/food-notes`，设置了续期成功后 `nginx -t && systemctl reload nginx` 的 deploy hook。续期任务已存在；`certbot renew --cert-name food.nerosun.cn --dry-run --no-random-sleep-on-renew --non-interactive` 演练成功，退出码 0。日志保存在 `/opt/food-notes/prepared/renew-dry-run.log`。

原四份站点配置 `sha256sum -c` 均为 OK。ECS 和本机对 agent、jnbjt、api 三个现有 HTTPS 站点的请求均返回 200。

ECS 使用生产 env 请求 Supabase users 只读接口返回 200，AI `/models` 接口返回 200。8 项环境变量齐全，SESSION_SECRET 长度为 64。仅核验了连接及密钥认证，没有调用付费推理或实际应用的推荐接口。

## Grokbot 正式发布时

1. 阅读本文核验范围；不要把密钥写到代码、聊天或日志里。实际应用尚未部署，也未做真实账号登录和 AI 推荐端到端检查。
2. 在 Linux x64 构建并打包 Next.js 产物，或在 ECS 低负载时构建。不要上传 macOS 的 node_modules。当前项目没有启用 standalone，需要 `.next`、public（若有）、package 文件、配置和 Linux 运行依赖。
3. 构建需要访问 Google Fonts；本项目使用 `next/font/google`，运行时自托管字体。
4. 注意 `NEXT_PUBLIC_*` 在构建时注入，必须使用本项目生产 Supabase URL 和 anon key。service role 和 AI key 只在服务器运行时提供。
5. 将版本放入 `/opt/food-notes/releases/<版本>`，设置正确归属后切换 current；保留上个版本用于回退。current 初始为一个空目录，首次发布时确认其仍为空后移走，再创建指向版本目录的符号链接；后续原子替换链接。
6. `systemctl enable --now food-notes`。确认 `ss -lntp` 只显示 `127.0.0.1:3200`，本机访问登录页成功，匿名业务 API 返回 401。
7. 切换反向代理：将 prepared/proxy.conf 安装到 `/etc/nginx/snippets/food-notes-mode.conf`，执行 `nginx -t` 后 reload。HTTPS 主配置包含 Origin 校验映射，代理拒绝非本站 Origin 的写请求；这不是应用内的完整 CSRF token 机制。
8. 用已有账号从 HTTPS 登录，验证 secure/httpOnly/sameSite Cookie、登记、列表、半星评分和 AI 推荐。未完成这些检查不能声称应用发布成功。
9. `sha256sum -c /opt/food-notes/prepared/existing-sites.sha256` 验证原站点文件未变，并实际检查原站点 HTTP 状态。

## 安全组与现有服务

安全组 `sg-bp122xlparxmbnyd979g` 已允许公网 80、443、22、3389、7864 和 ICMP；主机 UFW inactive。没有新增应用端口的安全组规则。

7864 正由已有 Python 服务监听 `0.0.0.0`，且 api.nerosun.cn 反代至该端口。3389 未发现监听。现有规则与“公网只开放 80/443”的截图建议有差异，本次没有擅自关闭，以免中断既有使用；如需收紧，先确认 Grokbot 和 Workbench 的管理连接方式及 7864 的直接访问依赖。

现有 Nginx 站点：默认站、jnbjt、nero-agent、workbuddy。不要覆盖这些文件或停止 Nginx。

本机已有 SSH 配置直接认证失败；本次通过用户已登录的阿里云 Workbench 操作，期间也通过 ECS 控制台的已有免密连接成功建立新会话。Grokbot 的 SSH 可达性需由其自身验证，不能据此宣称已打通。

服务器也保存了一份本文：`/opt/food-notes/HANDOFF.md`。本地 `deploy/ecs/` 内的配置可供复核，ECS 上已生效的文件及 prepared 目录是此次实际安装版本。
