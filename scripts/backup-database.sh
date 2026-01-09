#!/bin/bash
# VSys Database Backup Script
# Run daily via cron: 0 2 * * * /opt/vsys/scripts/backup-database.sh

set -e

# Configuration
BACKUP_DIR="/opt/backups/vsys-daily"
RETENTION_DAYS=30
CONTAINER_NAME="vsys-postgres"
DB_USER="vsys"
DB_NAME="vsys_next"
DATE=$(date +%Y%m%d_%H%M%S)

# Create backup directory if not exists
mkdir -p "$BACKUP_DIR"

# Create backup
echo "Creating backup: vsys_${DATE}.dump"
docker exec $CONTAINER_NAME pg_dump -U $DB_USER -d $DB_NAME --format=custom > "$BACKUP_DIR/vsys_${DATE}.dump"

# Create SQL backup for easy restore
docker exec $CONTAINER_NAME pg_dump -U $DB_USER -d $DB_NAME --format=plain > "$BACKUP_DIR/vsys_${DATE}.sql"

# Compress SQL backup
gzip "$BACKUP_DIR/vsys_${DATE}.sql"

# Remove old backups
echo "Removing backups older than $RETENTION_DAYS days"
find "$BACKUP_DIR" -type f -name "vsys_*.dump" -mtime +$RETENTION_DAYS -delete
find "$BACKUP_DIR" -type f -name "vsys_*.sql.gz" -mtime +$RETENTION_DAYS -delete

# List current backups
echo "Current backups:"
ls -lh "$BACKUP_DIR"

echo "Backup completed successfully!"
