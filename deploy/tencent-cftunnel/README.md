# 腾讯云上海 + Cloudflare Tunnel 部署指南

适用于无 ICP 备案的大陆 2C4G 5M 机器，通过 `cloudflared`（`--protocol http2`）主动出站接入 Cloudflare，同时承载：
- 正式环境：`https://hxsg.9961212.xyz`（独立库 `data/prod/hxsg.db`）
- 沙盒环境：`https://hxsg-sandbox.9961212.xyz`（独立库 `data/sandbox/hxsg-sandbox.db`）

宿主机 **无需开放 80/443 公网端口**，HTTPS 与 WebSocket (`wss://`) 均由 Cloudflare 边缘自动终结。

---

## 第一步：在 Cloudflare Zero Trust 创建 Tunnel

1. 打开 Cloudflare Zero Trust → **Networks → Tunnels → Create a tunnel**（选 Cloudflared），命名如 `hxsg-shanghai`。
2. 复制生成的 `CF_TUNNEL_TOKEN`。
3. 在该 Tunnel 的 **Public Hostname** 添加两条路由（CF 会自动给 `9961212.xyz` 创建对应 CNAME）：

| Public Hostname | Service Type | URL |
| :--- | :--- | :--- |
| `hxsg.9961212.xyz` | `HTTP` | `hxsg-prod:3001` |
| `hxsg-sandbox.9961212.xyz` | `HTTP` | `hxsg-sandbox:3002` |

> 可选优化：在 Cloudflare 的 `9961212.xyz` → **Caching → Cache Rules** 为 `URI Path starts with /assets/hxsg/` 开启 Edge Cache，可让 416 张原版图走 CF 边缘缓存，进一步省掉腾讯云 5M 带宽。

---

## 第二步：在腾讯云上海启动容器

```bash
git clone https://github.com/zhichoo/hxsg.git /opt/hxsg
cd /opt/hxsg/deploy/tencent-cftunnel
cp .env.example .env
# 编辑 .env，填入 CF_TUNNEL_TOKEN、随机 HXSG_SECRET_* 及（创建应用后的）HXSG_MAPP_APP_ID
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

## 第三步：核对大陆出站拉取 JWKS（微应用关键检查）

在腾讯云上海上测试是否能直连拉取 LINUX.DO 公钥：

```bash
curl -fsS --max-time 8 https://linux.do/mini-app-api/jwks
```

- 如果正常返回 `{"keys":[...]}`：无需额外配置，后端会自动缓存并定期刷新公钥。
- 如果大陆机房直连超时：二选一兜底：
  1. 在本机执行 `curl -fsS https://linux.do/mini-app-api/jwks`，把 `keys[0]` 那段 JWK JSON 填到 `.env` 的 `HXSG_MAPP_PUBLIC_KEY`；
  2. 或在你的 Netcup / CF Worker 做一个只读反代转发到 `https://linux.do/mini-app-api/jwks`，把地址填到 `HXSG_MAPP_JWKS_URL`。

修改 `.env` 后执行 `docker compose up -d` 生效。

---

## 第四步：在本机打包微应用 `app.zip`

### 沙盒测试包（指向 `hxsg-sandbox.9961212.xyz`）

```bash
MINI_APP_ID=<社区应用页分配的ID> \
MINI_APP_VERSION=0.1.0 \
MAPP_API_BASE_URL=https://hxsg-sandbox.9961212.xyz \
pnpm build:mapp:debug
```

### 正式发布包（指向 `hxsg.9961212.xyz`）

```bash
MINI_APP_ID=<社区应用页分配的ID> \
MINI_APP_VERSION=0.1.0 \
MAPP_API_BASE_URL=https://hxsg.9961212.xyz \
pnpm build:mapp
```

生成的 `apps/web/dist-mapp/package/app.zip` 直接上传到社区对应页签即可。

---

## 每日 SQLite 热备份（推荐加入 crontab）

```bash
mkdir -p /opt/hxsg/backups
# 每天凌晨 4:00 备份正式存档并保留最近 14 天
0 4 * * * docker exec hxsg-prod node -e "const {DatabaseSync}=require('node:sqlite');new DatabaseSync('/data/hxsg.db').exec(\"VACUUM INTO '/data/backup-' + new Date().toISOString().slice(0,10) + '.db'\")" && find /opt/hxsg/data/prod -name 'backup-*.db' -mtime +14 -delete
```
