# 会话隔离功能实施变更日志

**日期**: 2026-02-10  
**功能**: 基于项目的会话历史隔离（方案A：每项目独立 SQLite）  
**状态**: ✅ 已完成

---

## 🎯 实施目标

实现真正的项目级别会话隔离，确保不同项目的聊天记录完全独立存储在各自的数据库文件中。

---

## 📝 代码变更

### 1. `electron/main/constant.ts`

#### 变更内容
- 将固定的 `dbPath` 改为 `legacyDbPath`（仅用于向后兼容）
- 新增 `getProjectHttpdConfig(projectId)` 函数，动态生成项目特定的数据库配置
- 添加注释说明默认配置仅作为占位符

#### 关键代码
```typescript
export function getProjectHttpdConfig(projectId: string = 'default') {
  const projectDbPath = getProjectDbPath(projectId)
  return {
    "db": {
      "uri": `sqlite:///${projectDbPath}`,
      "pool_size": 5,
      "pool_recycle": 60,
      "max_overflow": 10,
      "echo": false,
      "pool_pre_ping": true,
      "migrate": true
    },
    "checkpointer": {
      "uri": `sqlite:///${projectDbPath}`
    }
  }
}
```

### 2. `electron/main/service.ts`

#### 变更内容A：导入新函数
- 添加 `getProjectHttpdConfig`, `getCurrentProjectFilePath`, `getProjectDir`, `getProjectDbPath` 导入

#### 变更内容B：新增 `migrateLegacyDatabase()` 函数
- 检测旧版本的全局 `~/.attacktrace/config/db.sqlite`
- 如果存在且 `default` 项目没有数据库，则自动复制
- 创建备份文件 `db.sqlite.backup`
- 提供详细的日志输出

#### 变更内容C：修改 `initApp()` 函数
- 添加 `await migrateLegacyDatabase().catch(console.error)`

#### 变更内容D：修改 `startHostService()` 函数
- 在启动 Host 前读取当前项目 ID
- 调用 `getProjectHttpdConfig(currentProjectId)` 生成项目配置
- 通过 `DIVE_SERVICE_CONFIG_CONTENT` 环境变量传递配置给 MCP Host
- 添加详细日志：`[Host] Starting with project: <id>` 和 `[Host] Using database: <path>`

#### 关键代码
```typescript
// Load current project ID
let currentProjectId = "default"
try {
  const currentProjectFile = getCurrentProjectFilePath()
  if (await fse.pathExists(currentProjectFile)) {
    const data = await fse.readJSON(currentProjectFile)
    currentProjectId = data.projectId || "default"
  }
} catch (error) {
  console.error("[Project] Failed to load current project, using default:", error)
}

// Generate project-specific database configuration
const projectHttpdConfig = getProjectHttpdConfig(currentProjectId)

const httpdEnv: any = {
  ...process.env,
  ATTACKTRACE_CONFIG_DIR: baseConfigDir,
  RESOURCE_DIR: hostCacheDir,
  DIVE_SERVICE_CONFIG_CONTENT: JSON.stringify(projectHttpdConfig),
}

console.log(`[Host] Starting with project: ${currentProjectId}`)
console.log(`[Host] Using database: ${projectHttpdConfig.db.uri}`)
```

---

## 🆕 新增文件

### 1. `test-project-isolation.sh`
- 自动化测试脚本
- 列出所有项目的数据库状态
- 显示数据库大小、表数量、会话数量
- 检查遗留数据库是否存在
- 提供测试指导

### 2. `docs/SESSION_ISOLATION_IMPLEMENTATION.md`
- 完整的实施文档
- 技术细节说明
- 验证方法
- 故障排查指南
- 后续优化建议

---

## 🔄 工作流程变化

### 应用启动流程
```
应用启动
  ↓
initApp()
  ↓
migrateLegacyDatabase()  ← 新增：自动迁移旧数据
  ↓
startHostService()
  ↓
读取 current_project.json  ← 修改：读取当前项目
  ↓
生成项目配置  ← 新增：动态生成配置
  ↓
设置环境变量 DIVE_SERVICE_CONFIG_CONTENT  ← 新增：传递配置
  ↓
启动 MCP Host
  ↓
Host 从环境变量读取配置  ← 已有机制
  ↓
连接到项目特定的数据库  ← 实现隔离
```

### 项目切换流程
```
用户切换项目
  ↓
保存新的 projectId 到 current_project.json
  ↓
重启 MCP Host  ← 已有机制
  ↓
Host 重新读取 current_project.json
  ↓
加载新项目的数据库配置  ← 自动生效
  ↓
连接到新项目的数据库
  ↓
页面刷新
  ↓
显示新项目的会话历史
```

---

## ✅ 验证检查清单

### 自动化检查
- [x] 代码无 linter 错误
- [x] 添加了测试脚本
- [x] 添加了迁移逻辑
- [x] 添加了详细日志

### 功能检查（需手动测试）
- [ ] 首次启动时旧数据正确迁移到 `default` 项目
- [ ] 创建新项目后有独立的数据库文件
- [ ] 项目切换后会话历史正确隔离
- [ ] 删除项目后对应的数据库文件被删除
- [ ] `default` 项目无法删除

### 边界情况检查
- [ ] 没有旧数据库的全新安装
- [ ] 有旧数据库的升级安装
- [ ] 多次切换项目的稳定性
- [ ] Host 重启失败时的错误处理

---

## 🔍 关键日志标识

启动应用后，在日志中查找以下关键信息：

```
[Migration] Checking for legacy database migration...
[Migration] ✓ Successfully migrated legacy database to default project
[Project] Initialized with project: default
[Host] Starting with project: default
[Host] Using database: sqlite:////Users/xxx/.attacktrace/projects/default/db.sqlite
```

切换项目时：

```
[ProjectSelector] Switching from default to test-project-1
[ProjectSelector] Project switched successfully to test-project-1
[ProjectSelector] Restarting MCP Host...
[Host] Starting with project: test-project-1
[Host] Using database: sqlite:////Users/xxx/.attacktrace/projects/test-project-1/db.sqlite
[ProjectSelector] Host restarted successfully on port 61990
```

---

## ⚠️ 兼容性说明

### 向后兼容
- ✅ 旧版本用户升级后无需手动操作
- ✅ 数据自动迁移，不会丢失
- ✅ 保留旧数据库备份
- ✅ 降级后仍可使用旧数据库（如果未删除）

### 向前兼容
- ⚠️ 使用新版本创建的项目数据库，旧版本无法识别
- ⚠️ 建议在团队内统一升级

---

## 📊 性能影响

### 优势
- ✅ 数据库文件更小（仅包含当前项目数据）
- ✅ 查询速度更快（数据量更少）
- ✅ 无需过滤查询（天然隔离）
- ✅ 备份和导出更简单（按项目操作）

### 劣势
- ⚠️ 项目切换需要重启 Host（约1-2秒）
- ⚠️ 每个新项目需要运行数据库迁移（初次）
- ⚠️ 跨项目全局检索需要额外实现

---

## 🐛 已知问题

### 问题1：长期记忆隔离
- **状态**: 待验证
- **描述**: `LongTermMemoryStore` 可能仍然是全局的
- **优先级**: P2

### 问题2：云端同步未集成
- **状态**: 待实现
- **描述**: OAP Platform 的 `/api/v1/sync/sessions` 尚未与项目隔离集成
- **优先级**: P2

---

## 🚀 后续工作

### 必需（P0）
- [ ] 手动测试所有功能
- [ ] 验证迁移逻辑在不同场景下的正确性

### 重要（P1）
- [ ] 验证长期记忆的项目隔离
- [ ] 添加跨项目检索功能（可选）
- [ ] 实现云端同步的项目支持

### 可选（P2）
- [ ] 项目数据导出/导入工具
- [ ] 项目克隆功能
- [ ] 数据库压缩和优化工具

---

## 📚 相关资源

- **实施文档**: `docs/SESSION_ISOLATION_IMPLEMENTATION.md`
- **测试脚本**: `test-project-isolation.sh`
- **架构文档**: `docs/ARCHITECTURE_CONSENSUS.md`
- **项目测试**: `docs/PROJECT_MODE_TESTING.md`

---

**实施团队**: AI Agent  
**审核**: 待审核  
**发布版本**: 下一版本
