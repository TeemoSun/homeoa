# HomeOA · 家庭 OA 审批系统

审批家里的预算（购买）请求：管理员创建成员账号，成员提交预算申请，审批人通过/拒绝/退回，全程邮件通知、流转留痕。

## 特性

- **单级审批流**：提交 → 审批（通过 / 拒绝 / 退回修改）→ 结束；支持撤回、评论、退回后重新提交
- **数据驱动的请求类型**：内置「预算申请（购买）」一种类型，类型由「类型表 + 动态表单 JSON Schema」定义，管理员可在类型管理页扩展新类型，无需改代码
- **账号体系**：管理员创建成员账号，无开放注册；成员首次登录可改密码、配邮箱
- **邮件通知**：提交、审批结果、退回、评论、撤回均邮件通知对应人（用户资料里的邮箱，未配置则跳过并记日志）
- **审计留痕**：流转记录时间线 + 邮件发送日志
- **单镜像部署**：前端（React 18 + Semi Design）构建产物通过 `go:embed` 打进 Go 二进制，Go 同时托管前端与 API，无需 Nginx

## 技术栈

| 层 | 选型 |
|---|---|
| 前端 | React 18 + TypeScript + Vite + Semi Design |
| 后端 | Go + Gin + GORM |
| 数据库 | PostgreSQL 16 |
| 邮件 | SMTP（`github.com/wneessen/go-mail`） |
| 部署 | Docker Compose（app + postgres），镜像发布到 GHCR |

## 快速开始（生产）

```bash
cp .env.example .env
# 编辑 .env：JWT_SECRET / ADMIN_INITIAL_PASSWORD / DB_PASSWORD / SMTP 等

docker compose up -d
# 浏览器访问 http://<host>:8080，用 .env 中的 ADMIN_INITIAL_PASSWORD 登录 admin
```

开发/测试环境（本地构建镜像、独立数据库）：

```bash
docker compose -f docker-compose.dev.yml up -d --build
```

> **安全要求**：本应用自身不终止 TLS，且默认只绑定 `127.0.0.1`。需要暴露到公网时，
> 请在 `.env` 中设置 `HOST_BIND=0.0.0.0`，并**必须**前置支持 HTTPS 的反向代理
> （如 Caddy / Traefik / Nginx / 云负载均衡）并启用 HSTS，不要以明文 HTTP 直接对外。
> 部署完成后请立即修改初始管理员密码。

详见 [docs/Docker镜像打包上传.md](docs/Docker镜像打包上传.md)。

## 本地开发（前后端分离）

```bash
# 后端（需本地 PostgreSQL，或在 .env 中指向开发库）
cd backend && go run ./cmd/server

# 前端（Vite 代理 /api 到 127.0.0.1:8080）
cd frontend && npm run dev
```

## 目录结构

```
homeoa/
├── backend/               # Go 后端（Gin + GORM）
│   ├── cmd/server/        # 入口
│   └── internal/          # config / database / model / handler / middleware / service / mailer / router / web(embed)
├── frontend/              # React 前端（Semi Design）
├── Dockerfile             # 多阶段构建：node → go(embed dist) → alpine 非 root
├── docker-compose.yml     # 生产：ghcr.io/teemosun/homeoa:latest + postgres:16-alpine
├── docker-compose.dev.yml # 开发/测试：本地 build + 独立数据库
├── scripts/               # 本地手动构建推送脚本
└── .github/workflows/     # CI + GHCR 镜像自动发布
```

## 安全说明

- 敏感配置全部通过环境变量注入（`.env` 不入库、不进构建上下文，仓库只提交 `.env.example` 占位模板）
- 密码使用 bcrypt 哈希存储；接口使用 JWT 认证；登录接口按 IP 限流
- 全部数据库查询经 GORM 参数绑定；无 Nginx 直接暴露时默认仅绑定 `127.0.0.1`，暴露公网请自行评估网络防护
