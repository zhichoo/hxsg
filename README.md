# 幻想三国 · 经典版 Web 怀旧复刻 (HXSG)

致敬 2010 年代冒泡社区 / 汉风经典像素回合制 RPG《幻想三国》的 Web 怀旧复刻项目，支持 **独立 Web 自托管** 与 **LINUX.DO 微应用（Discourse Mini App）** 双模式运行。

---

## 核心特性

### 经典视觉与交互还原
- **1:1 复古像素界面**：顶栏底纹、人物/设施/移动/功能四大主栏、红底金框、3 副将槽位、7 菱形战斗指令、战场地形拼接、三职业头/身/腿拆件像素角色动画、闪电/火攻/呼风唤雨/封印/毒系像素特效与像素伤害数字。
- **双模式自适应**：
  - **独立 Web 模式**：支持账密注册/登录、2~10 字自定义角色名、直连 HTTP + 原生 WebSocket。
  - **LINUX.DO 微应用模式**：自动探测 `globalThis.miniApp`，接入平台 ES256 JWT 免密鉴权、社区昵称自动建角（重名自动后缀）、SDK 持久化存储与深浅色主题适配。
- **高响应战斗体验（`v0.1.1`）**：
  - 开战与战斗回合出招优先走**已建立的 WebSocket 长连接**（断线自动回退 HTTP），显著降低回合间隔延迟；
  - 支持 `×1 / ×2` 倍速、自动战斗、副将自动托管及设置持久化记忆，快捷键 `1-7` 操控。

### 完整玩法闭环
- **角色与成长**：武士 / 文人 / 异人三职业男女创角、自由属性加点/洗点、抗性配点、技能修炼、转生进阶（含专属转生头像）。
- **主线与大地图**：经典开局路线 **新手村 → 下邳 → 小沛·九里山 → 许昌** 及后续多章主线任务与路线指引。
- **副将系统**：招贤馆寻访招募、战中残血招降、3 出战槽位自由切换、洗髓、喂经验丹/忠诚丹、打技能书与副将转生。
- **装备与经济**：商店购装、装备穿脱、打造与重铸、藏宝图挖宝、钱庄银两存取、玩家集市自由摆摊交易。
- **日常与挑战**：跑环任务（接取/交付/放弃）、天玄塔爬塔与每日扫荡、科举答题、押镖、世界首领、全服排行榜与玩家擂台切磋、赌坊（骰子 / 赤壁）。
- **实时社交**：原生 WebSocket 多频道聊天（区 / 派 / 商 / 世 / 私聊）、24 个经典聊天表情、同地图在线玩家列表与角色查看、好友系统、飞鸽传书（支持附件寄送）。

---

## 技术栈

- **前端**：Vite 6 + React 19 + TypeScript + Tailwind CSS v4 + HTML5 2D Pixel Canvas
- **后端**：Fastify 5 + 原生 `ws` WebSocket（聊天 + 地图同步 + 战斗长连接 RPC）+ Node.js 内置 `node:sqlite`（WAL 模式，零原生 C++ 编译依赖）
- **运行要求**：Node.js `>= 22.13.0`（支持 `node:sqlite`），单实例内存占用约 60~150 MB，1C1G 或 2C4G 轻量服务器即可流畅运行

---

## 项目结构

```text
hxsg/
├── apps/
│   ├── server/                   # Fastify API + ws WebSocket + SQLite 存档与战斗引擎
│   │   └── src/
│   │       ├── index.ts          # HTTP 路由、CORS 配置与静态文件托管
│   │       ├── socket.ts         # WebSocket 鉴权、实时聊天、在线同步与战斗 RPC
│   │       ├── battleEngine.ts   # 回合制战斗结算、技能/状态/招降/掉落逻辑
│   │       ├── gameService.ts    # 角色、任务、副将、装备、钱庄、集市、飞鸽等核心服务
│   │       ├── mappAuth.ts       # LINUX.DO 平台 ES256 JWT / JWKS 验签
│   │       ├── auth.ts           # 独立 Web HMAC Token 鉴权
│   │       └── db.ts             # node:sqlite Schema 与 WAL 初始化
│   └── web/                      # React 19 前端 + LINUX.DO 微应用打包
│       ├── public/assets/hxsg/   # 经典复古原版像素美术素材
│       ├── mapp/                 # 微应用 manifest 模板与原创像素资产包
│       ├── scripts/              # 微应用打包脚本 (package-mapp.mjs)
│       └── src/
│           ├── platform/host.ts  # 独立 Web / MAPP SDK 统一适配层
│           ├── api.ts            # API 客户端与本地偏好持久化
│           └── components/       # 主城、战斗舞台、创角、聊天栏、各类子面板
├── packages/
│   ├── shared/                   # 前后端共享类型、地图、技能、怪物与任务配置
│   └── mapp-sdk/                 # Discourse Mini App SDK 本地工作区包
├── deploy/
│   └── tencent-cftunnel/         # Docker Compose + Cloudflare Tunnel 双环境部署示例
├── docs/
│   └── MAPP.md                   # LINUX.DO 微应用环境变量与打包指南
├── scripts/
│   └── sync-assets.mjs           # 从本地解包目录同步素材脚本
├── Dockerfile                    # 多阶段生产镜像构建
└── docker-compose.yml            # 单容器一键部署配置
```

---

## 快速开始（本地开发）

确保本机已安装 **Node.js >= 22.13.0** 与 **pnpm**：

```bash
pnpm install
pnpm dev
```

- 前端开发地址：`http://localhost:5173`
- 后端服务地址：`http://localhost:3001`
- 生产构建与类型检查：

```bash
pnpm build
pnpm typecheck
```

---

## 部署指南

### 1. Docker 单容器部署（独立 Web）

```bash
HXSG_SECRET="$(openssl rand -hex 32)" docker compose up -d --build
```

- 默认监听 `3001` 端口，配合 Caddy / Nginx 反代即可自动签发 HTTPS 并支持 `/ws` WebSocket 升级。
- SQLite 数据持久化在宿主机 `./data/hxsg.db`，备份可直接用 SQLite `VACUUM INTO` 热备份。

### 2. LINUX.DO 微应用 & 双环境部署

- 微应用环境变量、双模式鉴权与 `app.zip` 打包流程请参考：[docs/MAPP.md](docs/MAPP.md)
- 无公网 80/443 的 Cloudflare Tunnel 双环境部署示例请参考：[deploy/tencent-cftunnel/README.md](deploy/tencent-cftunnel/README.md)

---

## 免责声明与开源协议

- **代码协议**：本项目源代码基于 [MIT License](LICENSE) 开源。
- **美术资源声明**：本项目为个人怀旧与技术学习复刻作品，不用于任何商业用途。`apps/web/public/assets/hxsg/` 中的经典复古美术素材版权归原著作权方所有，仅作怀旧学习交流展示；如涉及版权问题，请通过 Issue 联系，我们将第一时间配合移除。
