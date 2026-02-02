# Project Mode Data Migration

## Overview

This directory contains the data migration script for transitioning from single-workspace mode to multi-project mode.

## Migration Script

### `migrate-to-projects.sh`

This script migrates existing AttackTrace data to the new project-based structure.

**What it does:**
1. Creates a `projects/default/` directory structure
2. Copies `mcp_config.json` to `projects/default/mcp_config.json`
3. Copies `db.sqlite` to `projects/default/db.sqlite`
4. Creates backup copies of all migrated files
5. Sets up `current_project.json` pointing to the default project

**How to run:**

```bash
# Make the script executable
chmod +x scripts/migrate-to-projects.sh

# Run the migration
./scripts/migrate-to-projects.sh
```

**Safety Features:**
- Creates timestamped backups before any changes
- Checks if migration is needed (skips if no old files exist)
- Never overwrites existing new files
- Provides clear output and confirmation

**After Migration:**

The directory structure will look like this:

```
~/.attacktrace/
├── current_project.json          # Stores active project ID
├── projects/
│   └── default/
│       ├── mcp_config.json       # Migrated MCP config
│       ├── db.sqlite             # Migrated database
│       ├── cache/                # Project cache directory
│       └── reports/              # Project reports directory
├── backup_YYYYMMDD_HHMMSS/      # Backup of old files
│   ├── mcp_config.json
│   └── db.sqlite
└── [old files remain untouched]
```

**Manual Cleanup (Optional):**

After verifying everything works correctly, you can remove old files:

```bash
cd ~/.attacktrace
rm -f mcp_config.json
rm -f db.sqlite
```

## Hub Database Migration

For the AttackTrace Hub backend, run the Prisma migration and data migration script:

```bash
cd AttackTraceHub  # OAP Platform

# Apply schema migration
npx prisma migrate deploy

# Run data migration script
node prisma/migrations/data-migration-projects.js
```

This will:
1. Create Project and AuditLog tables
2. Add projectId fields to ChatSession and UserMcpConfig
3. Create a "Default" project for each existing user
4. Associate all existing data with the user's default project

## Troubleshooting

### Migration Script Fails

If the migration script encounters an error:

1. Check the backup directory (timestamped in output)
2. Verify file permissions on `~/.attacktrace`
3. Ensure sufficient disk space
4. Re-run the script (it's idempotent and safe to run multiple times)

### Hub Migration Fails

If the Prisma migration fails:

1. Check database connection
2. Verify database user has CREATE/ALTER permissions
3. Review migration logs in `AttackTraceHub/prisma/migrations/`  # OAP Platform
4. Manually apply the migration SQL if needed

### Data Not Migrated

If data appears missing after migration:

1. Check the backup directory for original files
2. Verify `current_project.json` exists and contains `{"projectId":"default"}`
3. Restart the application to reload configuration
4. Check application logs for errors

## Rollback

If you need to rollback the migration:

1. Stop the application
2. Restore old files from the backup directory:
   ```bash
   cp ~/.attacktrace/backup_YYYYMMDD_HHMMSS/* ~/.attacktrace/
   ```
3. Remove the projects directory:
   ```bash
   rm -rf ~/.attacktrace/projects
   ```
4. Remove current_project.json:
   ```bash
   rm ~/.attacktrace/current_project.json
   ```
5. Restart the application with the old version

## Notes

- The migration is **backward compatible** - if no old files exist, nothing happens
- The default project automatically uses the migrated data
- New projects can be created from the UI after migration
- All API calls automatically route to the correct project via X-Project-ID header
