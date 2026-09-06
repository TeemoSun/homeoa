# syntax=docker/dockerfile:1

# ---- Stage 1: 前端构建 ----
FROM node:20-alpine AS frontend
WORKDIR /build
COPY frontend/package.json frontend/package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci
COPY frontend/ ./
RUN npm run build

# ---- Stage 2: 后端编译（go:embed 嵌入前端产物）----
FROM golang:1.23-alpine AS backend-builder
WORKDIR /build
ENV CGO_ENABLED=0 \
    GOPROXY=https://goproxy.cn,https://proxy.golang.org,direct
COPY backend/go.mod backend/go.sum ./
RUN --mount=type=cache,target=/go/pkg/mod go mod download
COPY backend/ .
COPY --from=frontend /build/dist ./internal/web/dist
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    go build -trimpath -ldflags="-s -w" -o /out/homeoa ./cmd/server

# ---- Stage 3: 运行镜像（非 root + healthcheck）----
FROM alpine:3.20
RUN apk add --no-cache ca-certificates tzdata wget && \
    addgroup -g 1000 -S app && \
    adduser -u 1000 -S app -G app
ENV TZ=Asia/Shanghai \
    APP_ENV=production \
    APP_PORT=8080
COPY --from=backend-builder /out/homeoa /usr/local/bin/homeoa
USER app
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD wget -q -O - "http://127.0.0.1:${APP_PORT}/api/health" >/dev/null || exit 1
ENTRYPOINT ["homeoa"]
