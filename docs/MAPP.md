# LINUX.DO 微应用（Discourse Mini App）部署与打包指南

本项目已实现 **「独立 Web + LINUX.DO 微应用」双模式兼容**：同一套 React 前端与 Fastify 后端，可同时用于独立自托管（账密登录）与 LINUX.DO 社区微应用（平台 ES256 JWT 免密登录）。

## 1. 架构兼容说明

- **前端运行时自动探测**（`apps/web/src/platform/host.ts`）：
  - 独立 Web：使用 `fetch` + 原生 `WebSocket (/ws)` + `/assets/hxsg/...` + `window.localStorage` + 账密登录。
  - LINUX.DO 微应用：检测到 `globalThis.miniApp` 后自动切换为 `sdk.http.request` + `sdk.webSocket.connect` + `sdk.assets.readBytes`（Blob URL 缓存）+ `sdk.localStorage` + 社区免密身份 + `sdk.theme` 明暗主题。
- **后端双模式鉴权**（`apps/server/src/mappAuth.ts` + `apps/server/src/socket.ts`）：
  - 独立 Web 仍走原有 2 段 HMAC Token；
  - MAPP 请求携带 3 段 ES256 JWT，后端自动从 `${HXSG_MAPP_ISSUER}/mini-app-api/jwks` 拉取并缓存公钥，按 `(iss, sub, channel)` 绑定/自动建号，且原生 WebSocket `/ws` 在 upgrade 前完成验签与 `Origin` 校验。

## 2. 后端环境变量（正式 / 沙盒分离）

提审要求 **sandbox 与正式环境数据必须分离**。`HXSG_MAPP_CHANNEL=sandbox` 时默认写入独立的 `hxsg-sandbox.db`（也可用 `HXSG_DB_FILE` 或 `HXSG_DATA_DIR` 显式分开）：

```bash
# 必填：开启 LINUX.DO 平台 JWT 验签
HXSG_MAPP_ISSUER=https://linux.do
HXSG_MAPP_AUDIENCE=https://hxsg-api.your-domain.com
HXSG_MAPP_APP_ID=<社区应用页分配的 UUIDv7>

# production（默认）或 sandbox（沙盒测试后端单独起一个实例）
HXSG_MAPP_CHANNEL=production

# 可选：指定为服主 GM 的社区用户 sub ID（逗号分隔）
HXSG_MAPP_GM_SUBS=12345

# 可选：开启严格 CORS 仅允许社区与白名单 origin
HXSG_CORS_STRICT=1
HXSG_CORS_ORIGINS=https://hxsg.your-domain.com
```

## 3. 打包上传 `app.zip`

### 方式 A：美术资源直接打入 ZIP（默认，开箱即用）

将 416 张原版 PNG 一并打入 `app.zip`（约 13 MB，符合解压 ≤ 128 MiB / 文件数 ≤ 1024 规范）：

```bash
MINI_APP_ID=<应用ID> \
MINI_APP_VERSION=0.1.0 \
MAPP_API_BASE_URL=https://hxsg-api.your-domain.com \
pnpm build:mapp
```

### 方式 B：美术资源托管到开发者 CDN（ZIP 仅 ~200 KB）

如果社区上传页单包限制小于 13 MB，将 `apps/web/public/assets/hxsg/` 原样上传到支持 CORS GET 的 HTTPS CDN/R2 后执行：

```bash
MINI_APP_ID=<应用ID> \
MINI_APP_VERSION=0.1.0 \
MAPP_API_BASE_URL=https://hxsg-api.your-domain.com \
MAPP_ASSET_MODE=cdn \
MAPP_CDN_BASE_URL=https://cdn.your-domain.com/hxsg/v1 \
pnpm build:mapp
```

构建脚本会自动计算每张图的 `size`、`mime` 与 `sha256` 并写入 `manifest.json` 的 `remote_assets`（同时申请 `assets.remote` 权限）。

最终产物位于：`apps/web/dist-mapp/package/app.zip`，直接上传至社区沙箱页签即可验证。
调试包（含 inline source map）：将 `pnpm build:mapp` 改为 `pnpm build:mapp:debug`。
