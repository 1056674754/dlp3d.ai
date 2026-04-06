#!/usr/bin/env bash
set -euo pipefail

# ──────────────────────────────────────────────
#  DLP3D Web Frontend 部署脚本
#
#  用法:
#    ./scripts/deploy.sh                    # 同步源码 + 构建 + 重启
#    ./scripts/deploy.sh --assets           # 额外同步大资源文件（首次部署或资源更新时）
#    ./scripts/deploy.sh --assets-only      # 只同步大资源，不构建
#    ./scripts/deploy.sh --no-build         # 只同步 + 重启，跳过构建
# ──────────────────────────────────────────────

REMOTE="${DEPLOY_REMOTE:-SUIS-QP-TX-LIGHT-HK-1}"
REMOTE_DIR="${DEPLOY_DIR:-/data/DockerDLP3D}"
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

SYNC_ASSETS=false
ASSETS_ONLY=false
NO_BUILD=false

for arg in "$@"; do
  case "$arg" in
    --assets)      SYNC_ASSETS=true ;;
    --assets-only) ASSETS_ONLY=true; SYNC_ASSETS=true ;;
    --no-build)    NO_BUILD=true ;;
    --help|-h)
      sed -n '3,10p' "$0"
      exit 0 ;;
    *)
      echo "Unknown flag: $arg"; exit 1 ;;
  esac
done

log() { echo -e "\033[1;36m▶ $1\033[0m"; }
ok()  { echo -e "\033[1;32m✓ $1\033[0m"; }
err() { echo -e "\033[1;31m✗ $1\033[0m"; exit 1; }

RSYNC_BASE="rsync -az --delete --exclude='._*' --exclude='.DS_Store' -e ssh"

# ── 1. 同步大资源文件 ──
ASSET_DIRS=(
  "public/characters"
  "public/models"
  "public/scripts"
  "public/img/hdr"
  "public/img/model"
)

if $SYNC_ASSETS; then
  log "同步大资源文件到 $REMOTE:$REMOTE_DIR ..."
  for d in "${ASSET_DIRS[@]}"; do
    src="$PROJECT_ROOT/$d/"
    dst="$REMOTE:$REMOTE_DIR/$d/"
    echo "  $d"
    $RSYNC_BASE "$src" "$dst"
  done
  ok "资源文件同步完成"
fi

$ASSETS_ONLY && { ok "仅资源同步模式，完成。"; exit 0; }

# ── 2. 同步源码（排除大文件和构建产物） ──
log "同步源码到 $REMOTE:$REMOTE_DIR ..."

EXCLUDES=(
  --exclude='node_modules'
  --exclude='.next'
  --exclude='out'
  --exclude='data'
  --exclude='.git'
  --exclude='.cursor'
  --exclude='.sisyphus'
  --exclude='.vscode'
  --exclude='weights'
  --exclude='motion_data'
  --exclude='android'
  --exclude='docs'
  --exclude='*.db'
  --exclude='*.zip'
  --exclude='android-webview-*.png'
  # 大资源目录（通过 volume 挂载，不进镜像）
  --exclude='public/characters'
  --exclude='public/models'
  --exclude='public/scripts'
  --exclude='public/img/hdr'
  --exclude='public/img/model'
)

$RSYNC_BASE "${EXCLUDES[@]}" "$PROJECT_ROOT/" "$REMOTE:$REMOTE_DIR/"
ok "源码同步完成"

# ── 3. 远程清理 macOS 残留 ──
ssh "$REMOTE" "find $REMOTE_DIR -name '._*' -delete 2>/dev/null; true"

# ── 4. Docker 构建 ──
if ! $NO_BUILD; then
  log "在 $REMOTE 上构建 Docker 镜像 ..."
  ssh "$REMOTE" "cd $REMOTE_DIR && docker build -t dlp3d/web:latest -f dockerfiles/web/Dockerfile ." \
    || err "Docker 构建失败"
  ok "Docker 镜像构建完成"
fi

# ── 5. 重启容器 ──
log "重启 web_frontend ..."
ssh "$REMOTE" "cd $REMOTE_DIR && docker-compose up -d web_frontend"
ok "web_frontend 已重启"

# ── 6. 验证 ──
log "等待启动 ..."
sleep 3
ssh "$REMOTE" "cd $REMOTE_DIR && docker-compose logs --tail=5 web_frontend 2>&1 | tail -5"

echo ""
ok "部署完成！"
