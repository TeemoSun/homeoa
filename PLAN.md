# HomeOA — 家庭 OA 审批系统开发计划

> 审批家里的预算（购买）请求。前后端分离，单镜像部署，Go 托管前端与 API，无 Nginx。

## 1. 已确认的决策

| 事项 | 决策 |
|---|---|
| 仓库 | `github.com/TeemoSun/homeoa`，**公开**仓库 |
| 前端 | React 18 + TypeScript + Vite + **Semi Design**（字节/抖音团队，现代风格、活跃维护） |
| 后端 | Go + Gin + GORM |
| 数据库 | PostgreSQL 16 |
| 审批流 | **单级审批**：提交 → 审批人通过/拒绝/退回 → 结束 |
| 账号体系 | **管理员创建成员账号**，无开放注册；成员首次登录可改密码、配邮箱 |
| 请求类型 | 只做一种：**预算申请**（用于购买东西）；类型仍为数据驱动（类型表 + 动态表单字段 JSON Schema），日后想加新类型时管理员在类型管理页自行添加，无需改代码 |
| 部署 | Docker；生产拉 GHCR 镜像，开发/测试本地构建 |
| CI | GitHub Actions 推 main 自动构建镜像发布到 GHCR |
| 测试 | 不做浏览器自动化测试（开发服务器资源有限），由用户人工验收；本地做 API 冒烟测试 |

## 2. 技术架构

```
浏览器 ──► Go (Gin)
           ├── /api/v1/*  ──► 业务 API ──► PostgreSQL (GORM)
           ├── /assets/*  ──► go:embed 嵌入的前端静态文件
           └── /*         ──► SPA fallback (index.html)
```

- **单镜像方案**：多阶段 Docker 构建——Node 构建前端产物 → Go `embed` 打进二进制 → alpine 运行。
- 邮件发送为异步 goroutine，失败只记日志、重试一次，不阻塞 API 响应。

### 目录结构

```
homeoa/
├── backend/
│   ├── cmd/server/main.go
│   ├── internal/
│   │   ├── config/       # 环境变量读取
│   │   ├── database/     # GORM 初始化、AutoMigrate、种子数据
│   │   ├── model/        # User / RequestType / Request / RequestLog
│   │   ├── handler/      # HTTP 处理器
│   │   ├── middleware/   # JWT 认证、角色校验
│   │   ├── service/      # 业务逻辑
│   │   ├── mailer/       # SMTP 客户端 + 邮件模板
│   │   └── router/       # 路由注册 + 静态托管 + SPA fallback
│   └── go.mod
├── frontend/
│   └── src/
│       ├── api/          # axios 封装
│       ├── layouts/      # Semi Nav 侧边栏布局
│       ├── pages/        # 登录/仪表盘/发起/列表/详情/审批/成员/类型/设置
│       └── components/
├── Dockerfile            # 多阶段构建（node → go → alpine），非 root 运行 + healthcheck
├── docker-compose.yml    # 生产：ghcr.io/teemosun/homeoa:latest
├── docker-compose.dev.yml# 开发/测试：本地 build
├── scripts/docker-push.sh# 本地手动构建并推送 GHCR 的一键脚本
├── docs/                 # 部署文档（Docker镜像打包上传.md）
├── .env                  # 本地真实配置（gitignore，绝不提交）
├── .env.example          # 占位符模板（提交）
└── .github/workflows/    # CI + 镜像发布
```

## 3. 数据库设计

**users**
| 字段 | 说明 |
|---|---|
| id, username(unique), password_hash(bcrypt) | 认证 |
| display_name, email | 邮箱用于收通知 |
| role | `admin` / `member` |
| mail_enabled | 是否接收邮件通知（默认开） |

**request_types**（可扩展类型）
| 字段 | 说明 |
|---|---|
| code, name, icon | 类型编码/名称/图标 |
| form_schema (JSON) | 动态表单字段定义（字段名/标签/类型/必填） |
| approver_id (nullable) | 该类型默认审批人，空 = 全部管理员 |
| enabled | 停用开关 |

**内置类型（种子数据，仅一种）**

| code | 名称 | 动态字段 |
|---|---|---|
| purchase | 预算申请（购买） | 物品名称、预估金额、购买理由、商品链接（选填）、期望到位时间（选填） |

提交时金额同步写入 `requests.amount`，供列表展示与仪表盘统计。只有一个启用类型时，「发起请求」页跳过类型选择，直接进表单。

**requests**（审批单）
| 字段 | 说明 |
|---|---|
| type_id, title, amount (nullable) | 摘要信息（列表展示） |
| form_data (JSON) | 按类型 Schema 填写的动态字段 |
| status | `pending` / `approved` / `rejected` / `returned`(退回修改) / `withdrawn` |
| submitter_id, approver_id, decision_comment, decided_at | 审批信息 |

**request_logs**（流转记录）
- request_id, actor_id, action(`submit`/`approve`/`reject`/`return`/`withdraw`/`comment`), comment, created_at → 详情页时间线展示

种子数据：内置购买、出游两个类型；首个 admin 账号（用户名 `admin`，密码取 `ADMIN_INITIAL_PASSWORD`）。全部使用虚构信息。

## 4. 后端 API（/api/v1，JWT Bearer）

| 方法与路径 | 说明 | 权限 |
|---|---|---|
| GET /api/health | 健康检查（容器 HEALTHCHECK 用） | 公开 |
| POST /auth/login | 登录，返回 JWT | 公开 |
| GET /auth/me、PUT /users/me | 个人信息、改邮箱/密码 | 登录 |
| GET/POST/PUT/DELETE /users | 成员管理、重置密码、角色 | admin |
| GET/POST/PUT/DELETE /request-types | 类型管理 | 查看：登录；改：admin |
| POST /requests | 提交请求（按类型动态校验 form_data） | 登录 |
| GET /requests?scope=mine\|pending\|all | 我的 / 待我审批 / 全部 | all 仅 admin |
| GET /requests/:id | 详情（含流转记录） | 提交人/审批人/admin |
| POST /requests/:id/approve・reject・return・withdraw・comment | 审批动作 | 对应角色 |
| GET /dashboard/stats | 各状态计数 + 待办 | 登录 |

错误响应统一 `{code, message}`；密码永不返回；日志表留痕所有动作。

## 5. 前端页面（Semi Design，中文界面）

1. **登录页** — 居中卡片
2. **布局** — Semi `Nav` 侧边栏 + 顶栏（用户菜单）
3. **仪表盘** — 统计卡片（待审批/已通过/已拒绝/本月发起）+ 待办列表
4. **发起请求** — 按 form_schema 动态渲染表单（Semi Form）；当前仅预算申请一种类型，无类型选择步骤
5. **我的请求** — Table + 状态 Tag，可撤回
6. **请求详情** — Descriptions 摘要 + 动态字段 + Timeline 流转记录 + 评论/审批操作
7. **待我审批** — 审批人视图，通过/拒绝/退回需填意见
8. **请求管理** — admin 全量视图
9. **成员管理** — admin 增删改、重置密码
10. **类型管理** — admin 维护类型与表单字段
11. **个人设置** — 邮箱、通知开关、改密码

## 6. 邮件通知

- SMTP 从环境变量读取（465 SSL）；收件人只用用户资料里配置的 `email`；未配置邮箱的用户跳过发送并记日志。
- 触发点：
  | 事件 | 通知谁 |
  |---|---|
  | 提交新请求 | 审批人 |
  | 通过 / 拒绝 / 退回 | 提交人 |
  | 新评论 | 对方（提交人或审批人） |
  | 撤回 | 审批人 |
- 邮件为中文模板，含请求标题、类型、金额、发起人、结果与意见。
- `MAIL_ENABLED=false` 时全部跳过（便于本地无 SMTP 调试）。
- 库：`github.com/wneessen/go-mail`（活跃维护，SSL 支持好）。

## 7. 环境变量（.env 放项目根目录，仅本地存在）

```dotenv
# ===== 应用 =====
APP_PORT=8080
JWT_SECRET=<随机长字符串>
TZ=Asia/Shanghai
ADMIN_INITIAL_PASSWORD=<首次初始化管理员密码>

# ===== 数据库 =====
DB_HOST=postgres
DB_PORT=5432
DB_USER=homeoa
DB_PASSWORD=<自行生成>
DB_NAME=homeoa

# ===== 邮件（测试用 QQ 邮箱 SMTP，真实值仅写本地 .env）=====
SMTP_HOST=smtp.qq.com
SMTP_PORT=465
SMTP_USER=<发件邮箱>
SMTP_PASSWORD=<QQ邮箱授权码>
MAIL_ENABLED=true
```

- 仓库只提交 `.env.example`（同样的键、占位符值）。
- 真实 SMTP 授权码只写本地 `.env`；因授权码已在聊天中出现过，系统跑通后建议到 QQ 邮箱更换新授权码。

## 8. 部署（沿用 thingspan 项目的打包上传方案）

**Dockerfile（多阶段，风格对齐 thingspan）**
1. `node:20-alpine`：npm cache mount 构建 frontend → `dist/`
2. `golang:1.23-alpine`：go modules cache mount 编译 backend（`embed` dist 产物）
3. `alpine:3.20` + `ca-certificates` + `tzdata`：非 root 用户运行单二进制，`HEALTHCHECK` 用 wget 探活 `/api/health`，`TZ=Asia/Shanghai`

**docker-compose.yml（生产）**
- `app`：`image: ghcr.io/teemosun/homeoa:latest`，`env_file: .env`，端口 `${HOST_BIND:-127.0.0.1}:${HOST_PORT:-8080}:8080`（默认只绑本机，需外网访问时在 `.env` 覆盖），`restart: unless-stopped`
- `postgres:16-alpine`：本地相对目录持久化（`./data/postgres`） + healthcheck；app `depends_on` postgres 健康后启动

**docker-compose.dev.yml（开发/测试服务器）**
- 相同拓扑，`app` 改为 `build: .` 从本地构建，数据库独立命名（`homeoa_dev`）与独立本地数据目录（`./data/postgres_dev`）
- 更新方式：`docker compose -f docker-compose.dev.yml up -d --build`

**镜像发布（两条通道）**
- 自动：`.github/workflows/docker-publish.yml`，推 `main` / 打 `v*.*.*` 标签 / 手动触发时构建并推送，双架构 `amd64` + `arm64`，标签策略 `latest`、`YYYYMMDD` 日期、`sha-xxxxxxx`、`vX.Y.Z`，GHA 构建缓存，镜像名取 `${{ github.repository }}`（对齐 thingspan）
- 手动：`scripts/docker-push.sh` 一键本地构建并推送 `latest` + 日期标签（需 PAT 登录 GHCR）
- 文档：`docs/Docker镜像打包上传.md` 记录完整流程（自动发布、部署机拉取、手动构建）

**GitHub Actions**
- `ci.yml`：PR/push 时 go vet/test + 前端构建检查

## 9. 安全与隐私清单（公开仓库红线）

- [ ] `.gitignore`：`.env*`（例外 `!.env.example`）、`node_modules/`、`frontend/dist/`、`backend/bin/`、日志、`.DS_Store`、IDE 目录
- [ ] `.dockerignore`：`.env*`（例外 `!.env.example`，**密钥不进构建上下文**）、`.git`、`node_modules`、`dist`、`docs/`、`scripts/`、`.github`
- [ ] 仓库内无任何真实姓名、邮箱、密码、授权码；种子数据全虚构
- [ ] 推送前执行检查：`git ls-files` 确认无 `.env`；`grep` 全仓库无真实邮箱/授权码字样
- [ ] JWT_SECRET、DB 密码、管理员初始密码均由 `.env` 注入，代码中无默认硬编码值（缺失时启动报错）

## 10. 实施步骤

1. 初始化目录结构、go.mod、Vite 前端脚手架（Semi Design）
2. 后端：config → database/模型/迁移/种子 → JWT 认证 → 用户管理 → 类型管理 → 请求与审批 → 邮件 → 静态托管/SPA fallback
3. 前端：登录 → 布局与路由 → 仪表盘 → 发起请求（动态表单）→ 列表/详情/审批 → 成员/类型/设置页
4. Dockerfile + 两个 compose + `scripts/docker-push.sh` + `docs/Docker镜像打包上传.md` + `.env.example` + `.gitignore`/`.dockerignore`
5. GitHub Actions（ci + release）
6. 本地验证：`go test`、前端 `npm run build`、`docker compose -f docker-compose.dev.yml up` 起服务、curl 冒烟（登录→建用户→提交→审批→查邮件日志）——**不跑浏览器测试**（由用户人工验收）
7. 创建公开仓库 `TeemoSun/homeoa` 并推送；推送前执行第 9 节红线检查
8. 确认 Actions 构建镜像发布到 GHCR 成功

## 11. 验收标准

- 生产服务器：`.env` + `docker-compose.yml` 两条命令起服务，浏览器访问 `http://<host>:8080` 即用
- 管理员建成员账号 → 成员登录改邮箱 → 提交预算（购买）请求 → 审批人收邮件 → 审批 → 提交人收结果邮件 → 全流程数据落库可查
- GHCR 上能看到自动发布的镜像
