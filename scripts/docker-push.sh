#!/usr/bin/env bash
set -euo pipefail

# 本地手动构建镜像并推送到 GHCR（需先 docker login ghcr.io，PAT 需 packages:write 权限）
# 登录方式：echo "$GITHUB_TOKEN" | docker login ghcr.io -u <username> --password-stdin

USER="${GHCR_USER:-teemosun}"
REGISTRY="${GHCR_REGISTRY:-ghcr.io}"
IMAGE="${REGISTRY}/${USER}/homeoa"
DATE_TAG="$(date +%Y%m%d)"

echo "==> Building $IMAGE:latest and :$DATE_TAG"
docker build -t "$IMAGE:latest" -t "$IMAGE:$DATE_TAG" .

echo "==> Pushing tags"
docker push "$IMAGE:latest"
docker push "$IMAGE:$DATE_TAG"

echo "==> Done: $IMAGE:latest, $IMAGE:$DATE_TAG"
