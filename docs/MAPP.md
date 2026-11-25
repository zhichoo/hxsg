# LINUX.DO 微应用（Discourse Mini App）部署与打包指南

本项目已实现 **「独立 Web + LINUX.DO 微应用」双模式兼容**：同一套 React 前端与 Fastify 后端，可同时用于独立自托管（账密登录）与 LINUX.DO 社区微应用（平台 ES256 JWT 免密登录）。

## 1. 架构兼容说明

- **前端运行时自动探测**（`apps/web/src/platform/host.ts`）：
  - **独立 Web**：使用 `fetch` + 原生 `WebSocket (/ws)` + `/assets/hxsg/...` + `window.localStorage` + 账密登录与手动起名。
  - **LINUX.DO 微应用**：检测到 `globalThis.miniApp` 后自动切换为 `sdk.http.request` + `sdk.webSocket.connect` + `sdk.assets.readBytes`（Blob URL 缓存）+ `sdk.localStorage` + 社区免密身份（自动使用社区昵称建角，重名自动加后缀）+ `sdk.theme` 明暗主题。
  - **长连接战斗（`v0.1.1`）**：建立 WebSocket 后，开战（`battle:start`）与回合出招（`battle:action`）优先通过 WebSocket RPC 发送，减少每回合 HTTP 鉴权往返；连接未就绪或异常时自动回退 HTTP 接口。
- **后端双模式鉴权**（`apps/server/src/mappAuth.ts` + `apps/server/src/socket.ts`）：
  - 独立 Web 走 2 段 HMAC Token；
  - MAPP 请求携带 3 段 ES256 JWT，后端自动从 `${HXSG_MAPP_ISSUER}/mini-app-api/jwks` 拉取并缓存公钥（也支持通过 `HXSG_MAPP_PUBLIC_KEY` 或 `HXSG_MAPP_JWKS_URL` 兜底），按 `(iss, sub, channel)` 绑定/自动建号，且原生 WebSocket `/ws` 在 upgrade 前完成验签与 `Origin` 校验。

## 2. 后端环境变量（正式 / 沙盒分离）

提审要求 **sandbox 与正式环境数据必须分离**。`HXSG_MAPP_CHANNEL=sandbox` 时默认写入独立的 `hxsg-sandbox.db`（也可用 `HXSG_DB_FILE` 或 `HXSG_DATA_DIR` 显式分开）：

```bash
# 必填：开启 LINUX.DO 平台 JWT 验签
HXSG_MAPP_ISSUER=https://linux.do
HXSG_MAPP_AUDIENCE=https://hxsg.example.com
HXSG_MAPP_APP_ID=<社区应用页分配的 UUIDv7>

# production（默认）或 sandbox（沙盒测试后端单独起一个实例）
HXSG_MAPP_CHANNEL=production

# 可选：开启严格 CORS 仅允许社区与白名单 origin（已内置 Access-Control-Max-Age: 86400）
HXSG_CORS_STRICT=1
HXSG_CORS_ORIGINS=https://hxsg.example.com

# 可选（网络受限机房兜底）：自定义 JWKS 反代地址或单条 JWK JSON 公钥
HXSG_MAPP_JWKS_URL=
HXSG_MAPP_PUBLIC_KEY=

# 可选：设为 1 关闭独立 Web 匿名注册（仅开放社区登录，防垃圾号）
HXSG_DISABLE_PUBLIC_REGISTER=1
```

## 3. 打包上传 `app.zip`

### 方式 A：美术资源直接打入 ZIP（默认，开箱即用）

默认脚本 `apps/web/scripts/package-mapp.mjs` 会将 `apps/web/mapp/assets/` 中的 164 张原创像素 PNG 打入 `app.zip`（约 6.8 MiB，符合解压 ≤ 128 MiB / 文件数 ≤ 1024 规范）：

```bash
MINI_APP_ID=<应用ID> \
MINI_APP_VERSION=0.1.1 \
MAPP_API_BASE_URL=https://hxsg.example.com \
pnpm build:mapp
```

### 方式 B：美术资源托管到开发者 CDN（ZIP 仅 ~200 KB）

如果社区上传页对单包体积有更严格限制，可将美术素材上传到支持 CORS GET 的 HTTPS CDN/R2 后执行：

```bash
MINI_APP_ID=<应用ID> \
MINI_APP_VERSION=0.1.1 \
MAPP_API_BASE_URL=https://hxsg.example.com \
MAPP_ASSET_MODE=cdn \
MAPP_CDN_BASE_URL=https://cdn.example.com/hxsg/v1 \
pnpm build:mapp
```

构建脚本会自动计算每张图的 `size`、`mime` 与 `sha256` 并写入 `manifest.json` 的 `remote_assets`（同时申请 `assets.remote` 权限）。

最终产物位于：`apps/web/dist-mapp/package/app.zip`，在社区微应用管理页的「沙箱」页签上传生成构建，验证就绪后可在「正式」页签选择对应构建提审。
调试包（含 inline source map）：将 `pnpm build:mapp` 改为 `pnpm build:mapp:debug`。
