# Docker 镜像打包与发布流程

本项目镜像托管于 **GitHub Container Registry (`ghcr.io`)**，支持 **GitHub Actions 自动构建发布** 与 **本地一键脚本构建**。镜像为单镜像方案：前端静态资源通过 `go:embed` 打进 Go 二进制，容器内无需 Nginx。

## 自动化构建（推荐）

仓库已配置 GitHub Actions 工作流（`.github/workflows/docker-publish.yml`）：

- **触发条件**：当代码推送到 `main` 分支或发布版本标签（`v*.*.*`）时，自动触发多阶段构建，并将镜像推送至 `ghcr.io/teemosun/homeoa`。
- **自动标签**：
  - `latest`：始终指向 `main` 分支最新构建。
  - `YYYYMMDD`：按构建发布日期归档（如 `20260906`）。
  - `sha-xxxxxxx`：基于 Git Commit SHA。
  - `vX.Y.Z`：基于 Git Release 标签。
- **架构**：同时构建 `linux/amd64` 与 `linux/arm64` 双架构。

---

## 部署机使用镜像（生产）

```bash
# 1. 准备配置
cp .env.example .env
#    编辑 .env：JWT_SECRET、ADMIN_INITIAL_PASSWORD、DB_PASSWORD、
#    MYSQL_ROOT_PASSWORD、SMTP 等（可用 openssl rand -hex 32 生成密钥）

# 2. 启动（应用 + MySQL 两个容器，应用等数据库健康后启动）
docker compose up -d

# 3. 更新版本
docker compose pull && docker compose up -d
```

浏览器访问 `http://<host>:8080` 即可使用（默认只绑定 127.0.0.1，
需要外网访问时在 `.env` 中设置 `HOST_BIND=0.0.0.0`）。

> **安全要求**：本应用自身不终止 TLS。暴露到公网时**必须**前置支持 HTTPS 的反向代理
> （如 Caddy / Traefik / Nginx / 云负载均衡）并启用 HSTS，不要以明文 HTTP 直接对外提供服务。
> 部署完成后请立即修改初始管理员密码。

> **提示**：公开镜像无需执行 `docker login`，任何机器均可直接拉取。

---

## 开发/测试环境

```bash
cp .env.example .env   # 同样需要先完成 .env 配置
docker compose -f docker-compose.dev.yml up -d --build
```

开发环境从本地源码构建镜像，使用独立的数据库名（`homeoa_dev`）与独立数据卷，与生产数据互不影响。

---

## 本地手动构建与推送（可选）

### 1. 登录 GitHub Container Registry

```bash
# 使用具备 packages:write 权限的 GitHub Personal Access Token (PAT) 登录
echo "$GITHUB_TOKEN" | docker login ghcr.io -u <your-github-username> --password-stdin
```

### 2. 执行一键构建推送脚本

仓库已提供 `scripts/docker-push.sh`（需 `chmod +x`）：

```bash
bash scripts/docker-push.sh
```

或手动构建：

```bash
docker build -t ghcr.io/teemosun/homeoa:latest -t ghcr.io/teemosun/homeoa:$(date +%Y%m%d) .
docker push ghcr.io/teemosun/homeoa:latest
docker push ghcr.io/teemosun/homeoa:$(date +%Y%m%d)
```

---

## 镜像分层与精简说明

多阶段构建（`Dockerfile`）：

1. `node:20-alpine`：`npm ci` + `npm run build` 产出前端静态文件（npm 缓存挂载）。
2. `golang:1.23-alpine`：Go modules 缓存挂载，`CGO_ENABLED=0` 编译静态二进制（`-trimpath -ldflags "-s -w"` 去除调试信息）。
3. `alpine:3.20`：仅安装 `ca-certificates`、`tzdata`、`wget`，以非 root 用户运行单二进制，`HEALTHCHECK` 探活 `/api/health`。

`.dockerignore` 已排除 `.git`、`node_modules`、文档、脚本与所有 `.env*`（密钥不进构建上下文）。
