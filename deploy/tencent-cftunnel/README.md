# Cloudflare Tunnel 双环境部署指南

适用于无公网 80/443 入口或免备案轻量服务器，通过 `cloudflared`（`--protocol http2`）主动出站接入 Cloudflare，同时承载：
- 正式环境：`https://hxsg.example.com`（独立库 `data/prod/hxsg.db`）
- 沙盒环境：`https://hxsg-sandbox.example.com`（独立库 `data/sandbox/hxsg-sandbox.db`）

宿主机 **无需开放 80/443 公网端口**，HTTPS 与 WebSocket（`wss://`）均由 Cloudflare 边缘自动终结。

> 如果使用海外直连 VPS（如配合 Caddy 自动 HTTPS），直接运行服务端并反代 `127.0.0.1:3001` 往往延迟更低。

---

## 第一步：在 Cloudflare Zero Trust 创建 Tunnel

1. 打开 Cloudflare Zero Trust → **Networks → Tunnels → Create a tunnel**（选 Cloudflared），命名如 `hxsg-tunnel`。
2. 复制生成的 `CF_TUNNEL_TOKEN`。
3. 在该 Tunnel 的 **Public Hostname** 添加两条路由（CF 会自动为你的域名创建对应 CNAME）：

| Public Hostname | Service Type | URL |
| :--- | :--- | :--- |
| `hxsg.example.com` | `HTTP` | `hxsg-prod:3001` |
| `hxsg-sandbox.example.com` | `HTTP` | `hxsg-sandbox:3002` |

> 可选优化：在 Cloudflare → **Caching → Cache Rules** 为 `URI Path starts with /assets/hxsg/` 开启 Edge Cache，可让静态图片走 CF 边缘缓存，节省源站带宽。

---

## 第二步：启动容器

```bash
git clone https://github.com/zhichoo/hxsg.git /opt/hxsg
cd /opt/hxsg/deploy/tencent-cftunnel
cp .env.example .env
# 编辑 .env，填入 CF_TUNNEL_TOKEN、随机 HXSG_SECRET_*、实际域名与 HXSG_MAPP_APP_ID
nano .env

docker compose up -d --build
```

验证容器与健康接口：

```bash
docker compose ps
curl -s http://127.0.0.1:3001/api/health
curl -s http://127.0.0.1:3002/api/health
```

---

## 第三步：核对出站拉取 JWKS（微应用关键检查）

在服务器上测试是否能直连拉取 LINUX.DO 公钥：

```bash
curl -fsS --max-time 8 https://linux.do/mini-app-api/jwks
```

- 如果正常返回 `{"keys":[...]}`：无需额外配置，后端会自动缓存并定期刷新公钥。
- 如果大陆机房直连超时，可二选一兜底：
  1. 在可连通环境执行 `curl -fsS https://linux.do/mini-app-api/jwks`，把 `keys[0]` 的单条 JWK JSON 填到 `.env` 的 `HXSG_MAPP_PUBLIC_KEY`；
  2. 或通过可信海外反代 / Cloudflare Worker 转发到 `https://linux.do/mini-app-api/jwks`，把地址填到 `HXSG_MAPP_JWKS_URL`。

修改 `.env` 后执行 `docker compose up -d` 生效。

---

## 第四步：在本机打包微应用 `app.zip`

### 沙盒测试包（指向 `hxsg-sandbox.example.com`）

```bash
MINI_APP_ID=<社区应用页分配的ID> \
MINI_APP_VERSION=0.1.1 \
MAPP_API_BASE_URL=https://hxsg-sandbox.example.com \
pnpm build:mapp:debug
```

### 正式发布包（指向 `hxsg.example.com`）

```bash
MINI_APP_ID=<社区应用页分配的ID> \
MINI_APP_VERSION=0.1.1 \
MAPP_API_BASE_URL=https://hxsg.example.com \
pnpm build:mapp
```

生成的 `apps/web/dist-mapp/package/app.zip` 直接上传到社区微应用沙箱页签即可验证，确认无误后再从正式页签选择构建提审。

---

## 每日 SQLite 热备份（推荐加入 crontab）

```bash
# 每天凌晨 4:00 备份正式存档并保留最近 14 天
0 4 * * * docker exec hxsg-prod node --input-type=module -e "import { DatabaseSync } from 'node:sqlite'; new DatabaseSync('/data/hxsg.db').exec(\`VACUUM INTO '/data/backup-\${new Date().toISOString().slice(0,10)}.db'\`);" && find /opt/hxsg/data/prod -name 'backup-*.db' -mtime +14 -delete
```
