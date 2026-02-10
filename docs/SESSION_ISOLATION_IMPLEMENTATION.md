# 会话隔离实施文档

**实施日期**: 2026-02-10  
**方案**: 每个项目使用独立的 SQLite 数据库文件（方案A）

---

## 📋 实施概述

本次实施完成了基于项目的会话历史隔离，确保不同项目的聊天记录完全独立存储。

### 核心改动

1. **动态数据库配置**：Host 启动时根据当前项目 ID 加载对应的数据库文件
2. **自动迁移**：旧版本的全局数据库会自动迁移到 `default` 项目
3. **完整隔离**：每个项目拥有独立的 `db.sqlite` 文件

---

## 🔧 技术实现

### 1. 数据库文件路径结构

```
~/.attacktrace/
├── config/
│   └── db.sqlite               ← 旧版本（已废弃，会自动迁移）
│
└── projects/
    ├── default/
    │   ├── db.sqlite           ← 默认项目的数据库
    │   ├── mcp_config.json
    │   ├── cache/
    │   └── reports/
    │
    ├── project-a/
    │   ├── db.sqlite           ← 项目A的数据库
    │   ├── mcp_config.json
    │   └── ...
    │
    └── project-b/
        ├── db.sqlite           ← 项目B的数据库
        └── ...
```

### 2. 关键修改文件

#### `electron/main/constant.ts`
- 新增 `getProjectHttpdConfig()` 函数
- 根据项目 ID 动态生成数据库配置
- 保留旧的 `DEF_ATTACKTRACE_HTTPD_CONFIG` 作为回退

```typescript
export function getProjectHttpdConfig(projectId: string = 'default') {
  const projectDbPath = getProjectDbPath(projectId)
  return {
    "db": {
      "uri": `sqlite:///${projectDbPath}`,
      ...
    },
    "checkpointer": {
      "uri": `sqlite:///${projectDbPath}`
    }
  }
}
```

#### `electron/main/service.ts`
- 在 `startHostService()` 中读取当前项目 ID
- 生成项目特定的数据库配置
- 通过 `DIVE_SERVICE_CONFIG_CONTENT` 环境变量传递给 MCP Host
- 新增 `migrateLegacyDatabase()` 函数处理旧数据迁移

```typescript
// 读取当前项目
const currentProjectId = loadCurrentProjectId()

// 生成项目配置
const projectHttpdConfig = getProjectHttpdConfig(currentProjectId)

// 通过环境变量传递
const httpdEnv = {
  ...process.env,
  DIVE_SERVICE_CONFIG_CONTENT: JSON.stringify(projectHttpdConfig),
}
```

### 3. 工作流程

#### 应用启动
1. `initApp()` → 运行 `migrateLegacyDatabase()`
2. 检测 `~/.attacktrace/config/db.sqlite` 是否存在
3. 如果存在且 `default` 项目没有数据库，则复制过去
4. 创建备份文件 `db.sqlite.backup`

#### Host 启动
1. 读取 `~/.attacktrace/current_project.json` 获取当前项目 ID
2. 调用 `getProjectHttpdConfig(projectId)` 生成配置
3. 设置环境变量 `DIVE_SERVICE_CONFIG_CONTENT`
4. MCP Host 从环境变量读取配置并连接到项目特定的数据库

#### 项目切换
1. 用户选择新项目 → 保存到 `current_project.json`
2. 重启 MCP Host
3. Host 重新读取项目 ID → 加载新项目的数据库
4. 页面刷新 → 显示新项目的会话历史

---

## ✅ 验证方法

### 方法1：使用测试脚本

运行自动化测试脚本：

```bash
cd /Users/macbook2022/Downloads/kuqay/attacktrace
./test-project-isolation.sh
```

脚本会显示：
- 所有项目的数据库文件状态
- 每个数据库的大小和表数量
- 当前活跃项目
- 是否存在遗留数据库

### 方法2：手动验证

#### 步骤1：启动应用
```bash
npm run dev
```

#### 步骤2：创建测试会话（默认项目）
1. 打开 AttackTrace
2. 确认当前在 "Default" 项目
3. 创建一个新的聊天会话
4. 发送消息："This is a test in Default project"

#### 步骤3：创建新项目
1. 打开 Settings → Projects
2. 创建新项目 "Test Project 1"
3. 切换到新项目（会自动重启 Host）

#### 步骤4：验证隔离
1. 在 "Test Project 1" 中，侧边栏应该是空的（没有历史会话）
2. 创建新的聊天会话
3. 发送消息："This is Test Project 1"
4. 切换回 "Default" 项目
5. 验证只能看到 "Default" 的会话，看不到 "Test Project 1" 的

#### 步骤5：检查文件系统
```bash
ls -lh ~/.attacktrace/projects/default/db.sqlite
ls -lh ~/.attacktrace/projects/test-project-1/db.sqlite
```

两个文件应该存在且大小不同。

---

## 🔍 技术细节

### 数据库引擎初始化

MCP Host 在启动时通过以下流程初始化数据库：

```python
# httpd_service.py
if env_config := os.environ.get("DIVE_SERVICE_CONFIG_CONTENT"):
    config_content = env_config  # 从环境变量读取
else:
    with Path(self._config_path).open() as f:
        config_content = f.read()  # 从文件读取

self._current_setting = ServiceConfig.model_validate_json(config_content)
```

```python
# server.py
self._engine = create_async_engine(
    self._service_config_manager.current_setting.db.async_uri,
    ...
)
```

### 迁移机制

数据库迁移（Alembic）会自动应用到配置中指定的数据库文件：

```python
# migrate.py
def db_migration(uri: str, migrations_dir: str) -> Config:
    config = Config()
    config.set_main_option("sqlalchemy.url", uri)
    command.upgrade(config, "head")
```

由于每次启动时 URI 都指向当前项目的数据库，迁移会自动为每个项目创建表结构。

---

## ⚠️ 注意事项

### 1. 向后兼容性
- ✅ 旧版本用户升级后，数据会自动迁移到 `default` 项目
- ✅ 旧数据库文件会保留备份（`db.sqlite.backup`）
- ✅ 不会丢失任何历史数据

### 2. 项目删除
- 删除项目时，整个项目目录会被删除（包括数据库）
- `default` 项目不允许删除（硬编码保护）

### 3. 性能影响
- 每个项目的数据库文件独立，不会相互影响
- 切换项目需要重启 Host（约1-2秒）
- 首次启动新项目时会运行数据库迁移（创建表结构）

### 4. 云端同步
- 当前实施仅处理本地数据库隔离
- OAP Platform 的 `ChatSession` 表已有 `projectId` 字段
- 云端同步 API（`/api/v1/sync/sessions`）尚未与项目隔离集成
- 建议：云端同步作为可选功能，默认使用本地数据库

---

## 📊 实施状态

| 组件 | 状态 | 说明 |
|------|------|------|
| Electron 配置生成 | ✅ | 动态生成项目特定配置 |
| Host 启动脚本 | ✅ | 通过环境变量传递配置 |
| 数据库迁移 | ✅ | 自动应用到项目数据库 |
| 旧数据迁移 | ✅ | 自动迁移到 default 项目 |
| 测试脚本 | ✅ | 提供验证工具 |
| 会话历史 API | ✅ | 自动使用项目数据库 |
| 长期记忆 | ⚠️ | 待验证项目隔离 |

---

## 🚀 后续优化建议

### 短期（P1）
1. **验证长期记忆隔离**：确保 `LongTermMemoryStore` 也按项目隔离
2. **优化切换体验**：探索热切换可能性（无需重启 Host）
3. **添加迁移工具**：提供命令行工具手动迁移/合并项目数据

### 中期（P2）
4. **云端同步集成**：实现项目级别的云端同步开关
5. **隐私控制**：添加项目级别的隐私设置（本地 only / 云端同步）
6. **数据导出**：按项目导出会话历史和配置

### 长期（P3）
7. **跨项目检索**：提供全局搜索功能（跨所有项目）
8. **项目模板**：支持从模板创建项目（预配置工具和设置）
9. **数据迁移工具**：项目间复制/移动会话

---

## 🐛 故障排查

### 问题：切换项目后仍然看到旧项目的会话

**可能原因**：
1. Host 未正确重启
2. 浏览器缓存未清除

**解决方法**：
1. 检查日志中是否有 `[Host] Starting with project: <project-id>`
2. 检查日志中是否有 `[Host] Using database: <path>`
3. 强制刷新页面（Cmd+Shift+R / Ctrl+Shift+R）
4. 完全重启应用

### 问题：数据库文件未创建

**可能原因**：
1. 项目目录权限问题
2. 数据库迁移失败

**解决方法**：
1. 检查 `~/.attacktrace/projects/<project-id>/` 目录权限
2. 查看 MCP Host 日志中的迁移错误
3. 手动创建空数据库文件并重启

### 问题：旧数据未迁移

**可能原因**：
1. `default` 项目的数据库已存在（不会覆盖）
2. 迁移逻辑未执行

**解决方法**：
1. 检查 Electron 日志中的 `[Migration]` 消息
2. 手动复制：`cp ~/.attacktrace/config/db.sqlite ~/.attacktrace/projects/default/db.sqlite`
3. 重启应用

---

## 📝 开发日志

### 变更总结
- ✅ 实现了每个项目使用独立的 SQLite 数据库文件
- ✅ 项目切换时自动切换数据库连接
- ✅ 旧数据自动迁移到 `default` 项目
- ✅ 提供测试脚本验证隔离效果
- ✅ 完整的向后兼容性

### 测试建议
1. 在现有安装上测试升级流程
2. 在全新安装上测试初始化流程
3. 测试多项目切换的稳定性
4. 验证数据库迁移的完整性

---

## 📚 相关文档

- [架构共识](./ARCHITECTURE_CONSENSUS.md) - 本地优先的设计原则
- [项目模式测试](./PROJECT_MODE_TESTING.md) - 完整的测试用例
- [MCP Host 架构](./MCP_HOST_ARCHITECTURE.md) - MCP Host 的详细架构

---

## 👥 团队沟通

如果你是团队成员，请注意：
- 升级到此版本后，首次启动会自动运行数据迁移
- 旧的 `~/.attacktrace/config/db.sqlite` 会被备份为 `db.sqlite.backup`
- 不会丢失任何数据
- 如有问题，可以从备份恢复

---

**实施完成** ✅
