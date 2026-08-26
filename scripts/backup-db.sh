#!/usr/bin/env bash
# MySQL 自动备份脚本
# 用法：crontab -e 后添加 → 0 3 * * * /path/to/home_app/scripts/backup-db.sh
# 每日凌晨 3:00 执行，保留最近 30 天备份，自动清理过期文件。
#
# 环境变量（从 .env 读取或手动设置）：
#   DATABASE_URL="mysql://user:pass@host:3306/dbname"
# 或单独设置：
#   DB_HOST / DB_PORT / DB_USER / DB_PASS / DB_NAME
#
# 恢复示例：
#   gunzip < /path/to/backup_20260101.sql.gz | mysql -u root -p dbname

set -euo pipefail

# 加载 .env（如果存在）
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
if [ -f "$PROJECT_DIR/.env" ]; then
  set -a
  source "$PROJECT_DIR/.env"
  set +a
fi

BACKUP_DIR="${BACKUP_DIR:-$PROJECT_DIR/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"

# 从 DATABASE_URL 解析连接信息
if [ -n "${DATABASE_URL:-}" ]; then
  # mysql://user:pass@host:port/dbname
  DB_USER=$(echo "$DATABASE_URL" | sed -E 's#.*//([^:]+):.*#\1#')
  DB_PASS=$(echo "$DATABASE_URL" | sed -E 's#.*://[^:]+:([^@]+)@.*#\1#')
  DB_HOST=$(echo "$DATABASE_URL" | sed -E 's#.*@([^:]+):.*#\1#')
  DB_PORT=$(echo "$DATABASE_URL" | sed -E 's#.*:([0-9]+)/.*#\1#')
  DB_NAME=$(echo "$DATABASE_URL" | sed -E 's#.*/([^?]+).*#\1#')
else
  DB_HOST="${DB_HOST:-127.0.0.1}"
  DB_PORT="${DB_PORT:-3306}"
  DB_USER="${DB_USER:-root}"
  DB_PASS="${DB_PASS:-}"
  DB_NAME="${DB_NAME:-laoma}"
fi

mkdir -p "$BACKUP_DIR"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
FILENAME="backup_${DB_NAME}_${TIMESTAMP}.sql.gz"
FILEPATH="$BACKUP_DIR/$FILENAME"

echo "[$(date)] 开始备份数据库: $DB_NAME@$DB_HOST:$DB_PORT"
mysqldump \
  -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p"$DB_PASS" \
  --single-transaction --routines --triggers --events \
  "$DB_NAME" | gzip > "$FILEPATH"

FILE_SIZE=$(du -h "$FILEPATH" | cut -f1)
echo "[$(date)] 备份完成: $FILEPATH ($FILE_SIZE)"

# 清理过期备份
find "$BACKUP_DIR" -name "backup_*.sql.gz" -mtime +$RETENTION_DAYS -delete
EXPIRED=$(find "$BACKUP_DIR" -name "backup_*.sql.gz" -mtime +$RETENTION_DAYS 2>/dev/null | wc -l)
echo "[$(date)] 清理 ${EXPIRED} 个过期备份（>${RETENTION_DAYS}天）"
