# Project Mode Testing Guide

## Overview

This document provides comprehensive testing procedures for the new Project Mode feature in AttackTrace.

## Test Environment Setup

### Prerequisites

1. Clean AttackTrace installation or backed-up existing data
2. AttackTraceHub running locally or accessible remotely
3. At least one MCP integration configured (e.g., Elasticsearch or Kibana)

### Initial Setup

```bash
# 1. Ensure Hub backend is running
cd AttackTraceHub
npm run dev

# 2. Run Hub database migrations
npx prisma migrate deploy
node prisma/migrations/data-migration-projects.js

# 3. Build and run AttackTrace client
cd ..
npm run dev
```

## Test Cases

### 1. Backward Compatibility Tests

**Objective**: Verify that existing installations upgrade seamlessly.

#### Test 1.1: Fresh Installation
- **Steps**:
  1. Install AttackTrace on a clean system
  2. Launch the application
  3. Check that `~/.attacktrace/projects/default/` exists
  4. Verify `current_project.json` points to "default"
- **Expected**: Default project created automatically, no errors

#### Test 1.2: Upgrade from Old Version
- **Steps**:
  1. Start with AttackTrace installation that has old file structure
  2. Run migration script: `./scripts/migrate-to-projects.sh`
  3. Launch upgraded application
  4. Verify old data (mcp_config.json, db.sqlite) is accessible
  5. Check that chat history and integrations still work
- **Expected**: All old data migrated, application works normally

### 2. Project Management UI Tests

**Objective**: Verify project CRUD operations work correctly.

#### Test 2.1: View Project List
- **Steps**:
  1. Open Settings → Projects tab
  2. Verify "Default" project is listed
  3. Check that project shows correct session/integration counts
- **Expected**: Projects list displays correctly with stats

#### Test 2.2: Create New Project
- **Steps**:
  1. Click "Create Project" button
  2. Enter name: "Test Project 1"
  3. Enter description: "Testing project mode"
  4. Click "Create"
  5. Verify project appears in list
- **Expected**: Project created successfully, shows in list

#### Test 2.3: Switch Project
- **Steps**:
  1. Click project selector in header
  2. Select "Test Project 1"
  3. Confirm switch
  4. Verify page reloads
  5. Check that project selector shows "Test Project 1"
- **Expected**: Project switches successfully, UI updates

#### Test 2.4: Edit Project
- **Steps**:
  1. In Projects tab, click Edit on "Test Project 1"
  2. Change name to "Test Project 1 - Updated"
  3. Update description
  4. Click "Save"
  5. Verify changes reflected in list
- **Expected**: Project updated successfully

#### Test 2.5: Delete Project
- **Steps**:
  1. Create a temporary project "To Delete"
  2. Switch to another project (e.g., "Default")
  3. Delete "To Delete" project
  4. Confirm deletion
  5. Verify project removed from list
- **Expected**: Project deleted, switched to default if was current

#### Test 2.6: Cannot Delete Default
- **Steps**:
  1. Try to delete "Default" project
  2. Verify delete button is disabled or error shown
- **Expected**: Default project cannot be deleted

### 3. Data Isolation Tests

**Objective**: Verify that projects have isolated data.

#### Test 3.1: Integration Isolation
- **Steps**:
  1. Switch to "Default" project
  2. Add Elasticsearch integration "ES-Default"
  3. Switch to "Test Project 1"
  4. Verify Elasticsearch integration is NOT visible
  5. Add new Elasticsearch integration "ES-Test"
  6. Switch back to "Default"
  7. Verify only "ES-Default" is visible
- **Expected**: Each project has its own set of integrations

#### Test 3.2: Chat History Isolation
- **Steps**:
  1. Switch to "Default" project
  2. Create a new chat session
  3. Send a message: "This is Default project"
  4. Switch to "Test Project 1"
  5. Verify chat history is empty or shows only Test Project 1 chats
  6. Create a new chat session
  7. Send a message: "This is Test Project 1"
  8. Switch back to "Default"
  9. Verify chat history shows only Default project chats
- **Expected**: Chat sessions are isolated per project

#### Test 3.3: Configuration Isolation
- **Steps**:
  1. Check `~/.attacktrace/projects/default/mcp_config.json`
  2. Check `~/.attacktrace/projects/test-project-1/mcp_config.json`
  3. Verify they are different files with different content
  4. Check `~/.attacktrace/projects/default/db.sqlite`
  5. Check `~/.attacktrace/projects/test-project-1/db.sqlite`
  6. Verify they are different database files
- **Expected**: Each project has separate config and database files

### 4. API Header Injection Tests

**Objective**: Verify X-Project-ID header is correctly injected.

#### Test 4.1: API Calls Include Header
- **Steps**:
  1. Open browser DevTools → Network tab
  2. Switch to "Test Project 1"
  3. Reload the application or trigger API calls
  4. Inspect API requests (e.g., `/api/tools`, `/api/config/mcpserver`)
  5. Verify `X-Project-ID` header is present with correct project ID
- **Expected**: All API requests include X-Project-ID header

#### Test 4.2: Default Project Header
- **Steps**:
  1. Switch to "Default" project
  2. Check API requests in Network tab
  3. Verify `X-Project-ID` header is either absent or set to "default"
- **Expected**: Default project uses correct header value

#### Test 4.3: MCP Host Receives Header
- **Steps**:
  1. Enable MCP Host debug logging
  2. Switch projects and make API calls
  3. Check MCP Host logs for project context
  4. Verify correct project ID is logged
- **Expected**: MCP Host processes requests with correct project context

### 5. Multi-Project Workflow Tests

**Objective**: Verify realistic multi-project usage scenarios.

#### Test 5.1: Security Analyst Workflow
- **Setup**: Create projects for different security domains
- **Steps**:
  1. Create project "Network Security"
  2. Add Elasticsearch integration for network logs
  3. Create chat sessions for network analysis
  4. Create project "Application Security"
  5. Add Kibana integration for app logs
  6. Create chat sessions for app analysis
  7. Switch between projects
  8. Verify data isolation and context switching
- **Expected**: Smooth switching, no data leakage

#### Test 5.2: Team Collaboration Workflow
- **Setup**: Multiple team members using different projects
- **Steps**:
  1. Team member A creates "Project Alpha"
  2. Team member A adds integrations and creates sessions
  3. Team member B creates "Project Beta"
  4. Team member B adds different integrations
  5. Verify each member can only see their own projects (if implemented)
- **Expected**: Team members have independent project spaces

### 6. Edge Cases and Error Handling

#### Test 6.1: Network Failure During Project Switch
- **Steps**:
  1. Disconnect from network
  2. Try to switch projects
  3. Verify error message is shown
  4. Reconnect network
  5. Retry switch
- **Expected**: Graceful error handling, retry succeeds

#### Test 6.2: Invalid Project ID
- **Steps**:
  1. Manually edit `current_project.json` with non-existent project ID
  2. Restart application
  3. Verify application falls back to default project
- **Expected**: Automatic fallback to default, no crash

#### Test 6.3: Concurrent Project Operations
- **Steps**:
  1. Open two AttackTrace windows (if possible)
  2. Perform operations in both simultaneously
  3. Verify no conflicts or data corruption
- **Expected**: Operations succeed without conflicts

#### Test 6.4: Large Number of Projects
- **Steps**:
  1. Create 50+ projects
  2. Verify project selector performance
  3. Verify list scrolling and search (if implemented)
- **Expected**: UI remains responsive

### 7. Performance Tests

#### Test 7.1: Project Switch Latency
- **Steps**:
  1. Measure time to switch between projects
  2. Compare with and without cached data
  3. Test with different numbers of integrations
- **Expected**: Switch completes within 2-3 seconds

#### Test 7.2: Large Project Database
- **Steps**:
  1. Create project with 1000+ chat sessions
  2. Switch to this project
  3. Verify loading time is acceptable
  4. Check memory usage
- **Expected**: Reasonable loading time (<5s), no memory leaks

### 8. Hub Backend Tests

#### Test 8.1: Hub API CRUD
- **Steps**:
  1. Use curl or Postman to test Hub project APIs
  2. Create project via API: `POST /api/v1/projects`
  3. List projects: `GET /api/v1/projects`
  4. Update project: `PATCH /api/v1/projects/:id`
  5. Delete project: `DELETE /api/v1/projects/:id`
- **Expected**: All CRUD operations succeed

#### Test 8.2: Audit Log Verification
- **Steps**:
  1. Perform project operations (create, update, delete)
  2. Query audit logs: `GET /api/v1/audit/projects/:projectId`
  3. Verify all actions are logged
  4. Check log includes user, timestamp, action, metadata
- **Expected**: All operations audited correctly

#### Test 8.3: Project-Scoped MCP Configs
- **Steps**:
  1. Create project via Hub
  2. Create MCP instance for this project with X-Project-ID header
  3. Verify instance saved to correct project
  4. Switch projects and verify instance not visible
- **Expected**: MCP configs correctly scoped to projects

## Test Checklist

- [ ] Fresh installation creates default project
- [ ] Migration script works on existing installation
- [ ] Can create new project via UI
- [ ] Can switch between projects
- [ ] Can edit project details
- [ ] Can delete non-default project
- [ ] Cannot delete default project
- [ ] Integrations are isolated per project
- [ ] Chat sessions are isolated per project
- [ ] Config files are separate per project
- [ ] Database files are separate per project
- [ ] X-Project-ID header injected in API calls
- [ ] MCP Host processes project context correctly
- [ ] Error handling works for network failures
- [ ] Application recovers from invalid project ID
- [ ] Project switch latency is acceptable
- [ ] Hub project API CRUD works
- [ ] Audit logs are created correctly
- [ ] No memory leaks during project switching
- [ ] UI remains responsive with many projects

## Bug Reporting Template

When reporting bugs, include:

```
**Bug Title**: [Brief description]

**Environment**:
- OS: [macOS/Linux/Windows]
- AttackTrace Version: [version]
- Hub Version: [version]
- Current Project: [project ID]

**Steps to Reproduce**:
1. [Step 1]
2. [Step 2]
3. ...

**Expected Behavior**:
[What should happen]

**Actual Behavior**:
[What actually happened]

**Logs** (if available):
[Paste relevant logs from ~/.attacktrace/logs/ or console]

**Screenshots**:
[Attach if UI-related]
```

## Success Criteria

Project Mode is considered fully tested and production-ready when:

1. ✅ All test cases pass
2. ✅ No data loss during migration
3. ✅ No performance degradation
4. ✅ No memory leaks
5. ✅ Error messages are clear and actionable
6. ✅ Documentation is complete and accurate
7. ✅ Backward compatibility maintained
8. ✅ Enterprise audit requirements met

## Notes

- Always test migration on a backup first
- Keep old data until confirmed migration succeeded
- Monitor logs during testing for any warnings
- Report any unexpected behavior immediately
- Test with realistic data sizes (not just empty projects)
