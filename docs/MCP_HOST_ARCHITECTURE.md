# AttackTrace MCP Host 架构深度解析

## 📚 目录

1. [整体架构](#整体架构)
2. [核心概念](#核心概念)
3. [项目上下文传递流程](#项目上下文传递流程)
4. [API 请求完整流程](#api-请求完整流程)
5. [关键变量传递链路](#关键变量传递链路)
6. [配置文件加载机制](#配置文件加载机制)
7. [Instance vs Package](#instance-vs-package)
8. [常见问题和调试指南](#常见问题和调试指南)

---

## 整体架构

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (React)                         │
│  ┌──────────────────┐        ┌──────────────────────────────┐  │
│  │ IntegrationMarket│        │     ProjectSelector          │  │
│  │                  │        │                              │  │
│  │ - searchText     │        │ currentProjectIdAtom         │  │
│  │ - toolList       │        │   ↓                          │  │
│  │ - instances      │        │ "luke2" / "default"          │  │
│  └──────────────────┘        └──────────────────────────────┘  │
│           ↓                             ↓                       │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │      fetch("/api/plugins/oap-platform/...")               │ │
│  │      headers: { "X-Project-ID": currentProjectId }        │ │
│  └───────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              ↓ HTTP
┌─────────────────────────────────────────────────────────────────┐
│                   Backend (Python FastAPI)                      │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    FastAPI App                            │  │
│  │  - CORSMiddleware (allow X-Project-ID header)            │  │
│  │  - Routes: /api/plugins/oap-platform/*                   │  │
│  └──────────────────────────────────────────────────────────┘  │
│           ↓                                                     │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │           OAPHttpHandlers                                 │  │
│  │  - create_instance_handler(x_project_id: str)            │  │
│  │  - list_instances_handler(x_project_id: str)             │  │
│  │  - update_instance_handler(x_project_id: str)            │  │
│  │  - delete_instance_handler(x_project_id: str)            │  │
│  └──────────────────────────────────────────────────────────┘  │
│           ↓                                                     │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │        _get_project_config_manager(x_project_id)         │  │
│  │          ↓                                                │  │
│  │    MCPServerManager(project_id=x_project_id)             │  │
│  │          ↓                                                │  │
│  │    config_path = get_project_config_path(project_id)     │  │
│  │    → ~/.attacktrace/projects/{project_id}/mcp_config.json│  │
│  └──────────────────────────────────────────────────────────┘  │
│           ↓                                                     │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │           InstanceManager(project_id)                     │  │
│  │  - create_instance() → 创建实例到项目配置                  │  │
│  │  - list_instances() → 读取项目配置                        │  │
│  │  - delete_instance() → 从项目配置删除                     │  │
│  └──────────────────────────────────────────────────────────┘  │
│           ↓                                                     │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │           PackageManager (Global)                         │  │
│  │  - download_package() → ~/.attacktrace/mcp-packages/     │  │
│  │  - verify_hash() → SHA256/SHA512 integrity check         │  │
│  │  - list_packages() → 列出所有已下载包                     │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    File System                                  │
│                                                                 │
│  ~/.attacktrace/                                                │
│  ├── current_project.json          # 全局：当前活跃项目ID       │
│  │   └── {"projectId": "luke2"}                                │
│  │                                                             │
│  ├── mcp-packages/                 # 全局：所有项目共享的包     │
│  │   ├── Kibana@0.7.2/                                         │
│  │   ├── Elasticsearch@0.7.3/                                  │
│  │   └── ...                                                   │
│  │                                                             │
│  └── projects/                     # 项目隔离的配置             │
│      ├── default/                                              │
│      │   ├── mcp_config.json       # default 项目的实例配置    │
│      │   ├── db.sqlite             # default 项目的数据库      │
│      │   ├── cache/                                            │
│      │   └── reports/                                          │
│      │                                                         │
│      └── luke2/                                                │
│          ├── mcp_config.json       # luke2 项目的实例配置      │
│          ├── db.sqlite             # luke2 项目的数据库        │
│          ├── cache/                                            │
│          └── reports/                                          │
└─────────────────────────────────────────────────────────────────┘
```

---

## 核心概念

### 1. **Project（项目）**
- **定义**: 独立的工作空间，每个项目有自己的配置、数据库、缓存
- **标识**: `project_id` (字符串，如 "default", "luke2")
- **持久化**: `~/.attacktrace/current_project.json` 存储当前活跃项目ID
- **前端状态**: `currentProjectIdAtom` (Jotai atom)

### 2. **Instance（实例）**
- **定义**: 一个已配置的 MCP 工具实例，包含环境变量、命令、参数等
- **存储位置**: `~/.attacktrace/projects/{project_id}/mcp_config.json`
- **项目隔离**: ✅ 每个项目有独立的实例列表
- **示例**:
  ```json
  {
    "mcpServers": {
      "Kibana": {
        "transport": "stdio",
        "enabled": true,
        "command": "node",
        "args": ["/Users/.../.attacktrace/mcp-packages/Kibana@0.7.2/dist/index.js"],
        "env": {
          "KIBANA_URL": "http://...",
          "KIBANA_USERNAME": "elastic"
        },
        "version": "0.7.2"
      }
    }
  }
  ```

### 3. **Package（包）**
- **定义**: 物理存储的 MCP 工具二进制文件/脚本
- **存储位置**: `~/.attacktrace/mcp-packages/{name}@{version}/`
- **项目隔离**: ❌ 所有项目共享包（节省磁盘空间）
- **Hash 验证**: 支持 SHA256/SHA512 完整性检查

### 4. **X-Project-ID Header**
- **作用**: HTTP 请求中携带的项目上下文标识
- **传递路径**: Frontend → Backend → Config Manager → File Path
- **默认值**: 如果缺失，后端默认使用 "default"

---

## 项目上下文传递流程

### 流程图

```
┌─────────────────────────────────────────────────────────────────┐
│  1. 应用启动                                                     │
│                                                                 │
│  App.tsx:                                                       │
│  useEffect(() => {                                              │
│    const init = async () => {                                   │
│      await loadCurrentProjectId()  ← 从 IPC 读取 current_project.json│
│      loadTools()                                                │
│      loadMcpConfig()                                            │
│    }                                                            │
│    init()                                                       │
│  }, [])                                                         │
│                                                                 │
│  ✅ CRITICAL: 必须先加载 projectId，再加载任何工具/配置         │
└─────────────────────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────────────┐
│  2. IPC 调用 (Electron Main Process)                            │
│                                                                 │
│  electron/main/ipc/project.ts:                                  │
│  ipcMain.handle("project:getCurrentProject", async () => {      │
│    const configPath = path.join(homedir(), ".attacktrace",      │
│                                  "current_project.json")        │
│    const data = JSON.parse(fs.readFileSync(configPath))         │
│    return data.projectId  // "luke2"                            │
│  })                                                             │
└─────────────────────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────────────┐
│  3. 前端状态更新                                                 │
│                                                                 │
│  src/atoms/projectState.ts:                                     │
│  export const currentProjectIdAtom = atom<string>("default")    │
│  //                                              ^^^^^^^ 初始值  │
│                                                                 │
│  export const loadCurrentProjectIdAtom = atom(                  │
│    null,                                                        │
│    async (get, set) => {                                        │
│      const projectId = await getCurrentProject() // IPC call    │
│      set(currentProjectIdAtom, projectId) // "luke2"            │
│    }                                                            │
│  )                                                              │
└─────────────────────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────────────┐
│  4. 组件使用                                                     │
│                                                                 │
│  src/views/Drawer/IntegrationMarket.tsx:                        │
│  const currentProjectId = useAtomValue(currentProjectIdAtom)    │
│  // currentProjectId = "luke2"                                  │
│                                                                 │
│  const res = await fetch("/api/plugins/oap-platform/instances", {│
│    method: "POST",                                              │
│    headers: {                                                   │
│      "Content-Type": "application/json",                        │
│      "X-Project-ID": currentProjectId  ← 关键传递点             │
│    },                                                           │
│    body: JSON.stringify({...})                                  │
│  })                                                             │
└─────────────────────────────────────────────────────────────────┘
                    ↓ HTTP Request
┌─────────────────────────────────────────────────────────────────┐
│  5. 后端接收                                                     │
│                                                                 │
│  mcp-host/attacktrace_mcp_host/httpd/app.py:                    │
│  app.add_middleware(                                            │
│    CORSMiddleware,                                              │
│    allow_headers=[                                              │
│      "X-Project-ID",  ← 允许该自定义 header                     │
│    ],                                                           │
│  )                                                              │
└─────────────────────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────────────┐
│  6. Handler 提取 Header                                         │
│                                                                 │
│  mcp-host/attacktrace_mcp_host/oap_plugin/http_handlers.py:     │
│  async def create_instance_handler(                             │
│      self,                                                      │
│      request: CreateInstanceRequest,                            │
│      x_project_id: Optional[str] = Header(None,                 │
│                                   alias="X-Project-ID"),  ← 提取│
│      app: AttackTraceHostAPI = Depends(get_app)                 │
│  ):                                                             │
│      # x_project_id = "luke2"                                   │
│      config_manager = await self._get_project_config_manager(   │
│          x_project_id  ← 传递给配置管理器                        │
│      )                                                          │
└─────────────────────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────────────┐
│  7. 创建项目特定的配置管理器                                     │
│                                                                 │
│  http_handlers.py:                                              │
│  async def _get_project_config_manager(                         │
│      self,                                                      │
│      project_id: Optional[str] = None                           │
│  ) -> MCPServerManager:                                         │
│      # project_id = "luke2"                                     │
│      config_path = get_project_config_path(project_id)          │
│      # → ~/.attacktrace/projects/luke2/mcp_config.json          │
│                                                                 │
│      return MCPServerManager(                                   │
│          config_path=str(config_path),                          │
│          project_id=project_id  ← 关键传递                      │
│      )                                                          │
└─────────────────────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────────────┐
│  8. 路径解析                                                     │
│                                                                 │
│  mcp-host/attacktrace_mcp_host/httpd/conf/project_context.py:   │
│  def get_project_dir(project_id: Optional[str] = None) -> Path: │
│      pid = project_id or get_current_project_id()               │
│      # pid = "luke2"                                            │
│                                                                 │
│      project_dir = ATTACKTRACE_CONFIG_DIR.parent / "projects"   │
│                    / pid                                        │
│      # → ~/.attacktrace/projects/luke2/                         │
│                                                                 │
│      project_dir.mkdir(parents=True, exist_ok=True)             │
│      return project_dir                                         │
│                                                                 │
│  def get_project_config_path(project_id: Optional[str]) -> Path:│
│      return get_project_dir(project_id) / "mcp_config.json"     │
│      # → ~/.attacktrace/projects/luke2/mcp_config.json          │
└─────────────────────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────────────┐
│  9. 实例创建                                                     │
│                                                                 │
│  mcp-host/attacktrace_mcp_host/oap_plugin/instance_manager.py:  │
│  class InstanceManager:                                         │
│      def __init__(self, ..., project_id: str | None = None):    │
│          self.project_id = project_id  # "luke2"                │
│          logger.info(f"InstanceManager for project: {project_id}")│
│                                                                 │
│      async def create_instance(self, config: Config, ...):      │
│          # 将实例写入 config 对象                                │
│          # config 对应 luke2 项目的 mcp_config.json             │
│          config.mcp_servers[instance_name] = MCPServerConfig(...)│
│                                                                 │
│          # 保存到文件                                            │
│          config_manager.save_config(config)                     │
│          # → 写入 ~/.attacktrace/projects/luke2/mcp_config.json │
└─────────────────────────────────────────────────────────────────┘
```

---

## API 请求完整流程

### 示例：创建 Kibana 实例

#### 前端代码
```typescript
// src/views/Drawer/IntegrationMarket.tsx:633-640
const currentProjectId = useAtomValue(currentProjectIdAtom) // "luke2"

const res = await fetch("/api/plugins/oap-platform/instances", {
  method: "POST",
  headers: { 
    "Content-Type": "application/json",
    "X-Project-ID": currentProjectId  // "luke2"
  },
  body: JSON.stringify({
    tool_id: "kibana",
    tool_name: "Kibana",
    instance_name: "Kibana",
    transport: "stdio",
    env: {
      KIBANA_URL: "http://...",
      KIBANA_USERNAME: "elastic",
      KIBANA_PASSWORD: "..."
    },
    version: "0.7.2",
    download_url: "https://..."
  }),
})
```

#### 后端 Handler
```python
# mcp-host/attacktrace_mcp_host/oap_plugin/http_handlers.py:264-320

async def create_instance_handler(
    self,
    request: CreateInstanceRequest,
    x_project_id: Optional[str] = Header(None, alias="X-Project-ID"),
    app: AttackTraceHostAPI = Depends(get_app)
):
    """POST /instances - Create a new instance"""
    try:
        # 1. 获取项目特定的配置管理器
        config_manager = await self._get_project_config_manager(x_project_id)
        # x_project_id = "luke2"
        # config_manager.config_path = "~/.attacktrace/projects/luke2/mcp_config.json"
        
        # 2. 加载配置
        config_manager.initialize()
        config = await config_manager.get_current_config()
        
        # 3. 创建实例管理器
        instance_manager = InstanceManager(
            package_manager=self._package_manager,
            device_token=self._oap_store.device_token,
            project_id=x_project_id  # "luke2"
        )
        
        # 4. 创建实例
        instance_request = InstanceRequest(
            tool_id=request.tool_id,
            tool_name=request.tool_name,
            instance_name=request.instance_name,
            env=request.env,
            version=request.version,
            download_url=request.download_url
        )
        
        instance_id, instance_name, install_path = await instance_manager.create_instance(
            config, instance_request
        )
        
        # 5. 保存配置
        await config_manager.save_config(config)
        # 写入 ~/.attacktrace/projects/luke2/mcp_config.json
        
        # 6. 重新加载配置到内存
        await app.mcp_client.reload_config_from_file(
            str(get_project_config_path(x_project_id))
        )
        
        return {
            "success": True,
            "instance_id": instance_id,
            "instance_name": instance_name
        }
    except Exception as e:
        logger.error(f"Failed to create instance: {e}")
        raise HTTPException(status_code=500, detail=str(e))
```

#### 配置管理器创建
```python
# http_handlers.py:235-249

async def _get_project_config_manager(
    self,
    project_id: Optional[str] = None
) -> MCPServerManager:
    """Get project-specific config manager"""
    
    # 解析配置路径
    config_path = get_project_config_path(project_id)
    # project_id = "luke2"
    # config_path = Path("~/.attacktrace/projects/luke2/mcp_config.json")
    
    # 创建项目特定的配置管理器
    return MCPServerManager(
        config_path=str(config_path),
        project_id=project_id  # "luke2"
    )
```

#### 实例创建逻辑
```python
# mcp-host/attacktrace_mcp_host/oap_plugin/instance_manager.py:70-130

async def create_instance(
    self, config: Config, request: InstanceRequest
) -> tuple[str, str, Path | None]:
    """创建新实例"""
    instance_id = str(uuid.uuid4())
    logger.info(f"Creating instance for tool {request.tool_name}")
    
    # 1. 下载包（如果需要）- 全局共享
    install_path = None
    if request.download_url and request.version:
        pkg = await self.package_manager.download_package(
            request.tool_name, request.version, request.download_url
        )
        install_path = pkg.install_path
        # → ~/.attacktrace/mcp-packages/Kibana@0.7.2/
    
    # 2. 生成唯一实例名
    instance_name = self._generate_unique_name(config, request.instance_name)
    
    # 3. 构建配置
    server_config = MCPServerConfig(
        transport=request.transport,
        enabled=True,
        command="node",
        args=[f"{install_path}/dist/index.js"],
        env=request.env,
        version=request.version
    )
    
    # 4. 添加到配置对象（会被保存到项目特定的 mcp_config.json）
    config.mcp_servers[instance_name] = server_config
    
    return instance_id, instance_name, install_path
```

---

## 关键变量传递链路

### 1. `project_id` 传递链

```
┌─────────────────────────────────────────────────────────────────┐
│  Layer          │  Variable Name      │  Value     │  Location  │
│─────────────────┼─────────────────────┼────────────┼────────────│
│  File System    │  projectId          │  "luke2"   │  current_  │
│                 │                     │            │  project.  │
│                 │                     │            │  json      │
│─────────────────┼─────────────────────┼────────────┼────────────│
│  Electron IPC   │  projectId          │  "luke2"   │  ipcMain   │
│                 │                     │            │  handler   │
│─────────────────┼─────────────────────┼────────────┼────────────│
│  Frontend Atom  │  currentProjectId   │  "luke2"   │  Jotai     │
│                 │  Atom               │            │  atom      │
│─────────────────┼─────────────────────┼────────────┼────────────│
│  React Hook     │  currentProjectId   │  "luke2"   │  useAtom   │
│                 │                     │            │  Value()   │
│─────────────────┼─────────────────────┼────────────┼────────────│
│  HTTP Header    │  X-Project-ID       │  "luke2"   │  fetch()   │
│                 │                     │            │  headers   │
│─────────────────┼─────────────────────┼────────────┼────────────│
│  FastAPI Param  │  x_project_id       │  "luke2"   │  Header()  │
│─────────────────┼─────────────────────┼────────────┼────────────│
│  Config Manager │  project_id         │  "luke2"   │  MCP       │
│                 │                     │            │  Server    │
│                 │                     │            │  Manager   │
│─────────────────┼─────────────────────┼────────────┼────────────│
│  Instance Mgr   │  self.project_id    │  "luke2"   │  Instance  │
│                 │                     │            │  Manager   │
│─────────────────┼─────────────────────┼────────────┼────────────│
│  File Path      │  {project_id}       │  "luke2"   │  ~/.attack │
│                 │                     │            │  trace/    │
│                 │                     │            │  projects/ │
│                 │                     │            │  luke2/    │
└─────────────────────────────────────────────────────────────────┘
```

### 2. 配置路径解析链

```python
# 调用链
x_project_id ("luke2")
    ↓
get_project_config_path(project_id="luke2")
    ↓
get_project_dir(project_id="luke2")
    ↓
pid = project_id or get_current_project_id()
    # pid = "luke2"
    ↓
project_dir = ATTACKTRACE_CONFIG_DIR.parent / "projects" / pid
    # ATTACKTRACE_CONFIG_DIR = ~/.attacktrace/.config
    # project_dir = ~/.attacktrace/projects/luke2
    ↓
project_dir.mkdir(parents=True, exist_ok=True)  # 确保目录存在
    ↓
return project_dir / "mcp_config.json"
    # → ~/.attacktrace/projects/luke2/mcp_config.json
```

### 3. 包下载路径（全局共享）

```python
# mcp-host/attacktrace_mcp_host/oap_plugin/package_manager.py

class PackageManager:
    def __init__(self, packages_dir: Path):
        self.packages_dir = packages_dir
        # packages_dir = ~/.attacktrace/mcp-packages (全局)
    
    async def download_package(self, name: str, version: str, url: str):
        # 包路径：{name}@{version}
        package_dir = self.packages_dir / f"{name}@{version}"
        # → ~/.attacktrace/mcp-packages/Kibana@0.7.2/
        
        # 注意：这里不使用 project_id，所有项目共享包
```

---

## 配置文件加载机制

### 1. 启动时加载（冷启动）

```python
# mcp-host/attacktrace_mcp_host/httpd/conf/mcp_servers.py:148-167

def initialize(self) -> None:
    """Initialize the MCPServerManager"""
    logger.info(f"Initializing MCPServerManager from {self._config_path}")
    
    # self._config_path 由构造函数传入：
    # ~/.attacktrace/projects/{project_id}/mcp_config.json
    
    # 1. 检查环境变量（优先级最高）
    env_config = os.environ.get("DIVE_MCP_CONFIG_CONTENT")
    
    if env_config:
        config_content = env_config
    # 2. 读取文件
    elif Path(self._config_path).exists():
        with Path(self._config_path).open(encoding="utf-8") as f:
            config_content = f.read()
    else:
        logger.warning("MCP server configuration not found")
        return
    
    # 3. 解析 JSON
    config_dict = json.loads(config_content)
    self._current_config = Config(**config_dict)
```

### 2. 配置保存

```python
# mcp-host/attacktrace_mcp_host/httpd/conf/mcp_servers.py

async def save_config(self, config: Config) -> None:
    """Save config to file"""
    config_path = Path(self._config_path)
    # → ~/.attacktrace/projects/{project_id}/mcp_config.json
    
    # 序列化
    config_dict = config.model_dump(exclude_none=True)
    
    # 写入文件
    config_path.parent.mkdir(parents=True, exist_ok=True)
    with config_path.open("w", encoding="utf-8") as f:
        json.dump(config_dict, f, indent=2, ensure_ascii=False)
    
    logger.info(f"Config saved to {config_path}")
```

### 3. 老配置迁移机制

```python
# mcp-host/attacktrace_mcp_host/httpd/conf/project_context.py:155-184

def ensure_default_project():
    """Ensure default project directory exists"""
    default_dir = get_project_dir(DEFAULT_PROJECT_ID)
    
    # 老配置路径（已废弃）
    old_config_path = ATTACKTRACE_CONFIG_DIR / "mcp_config.json"
    # → ~/.attacktrace/.config/mcp_config.json
    
    # 新配置路径
    new_config_path = default_dir / "mcp_config.json"
    # → ~/.attacktrace/projects/default/mcp_config.json
    
    # 迁移逻辑：如果老配置存在且新配置不存在，自动迁移
    if old_config_path.exists() and not new_config_path.exists():
        import shutil
        try:
            shutil.copy2(old_config_path, new_config_path)
            print(f"Migrated old config to default project: {new_config_path}")
        except Exception as e:
            print(f"Failed to migrate old config: {e}")
```

**⚠️ 注意事项：**
- `ensure_default_project()` 在每次创建 `MCPServerManager` 时都会被调用
- 这可能导致老配置被意外迁移到 `default` 项目
- 如果需要彻底删除老配置，应该手动删除 `~/.attacktrace/.config/mcp_config.json`

---

## Instance vs Package

### 对比表

| 维度 | Instance（实例） | Package（包） |
|------|------------------|---------------|
| **定义** | 已配置的工具实例 | 物理存储的工具文件 |
| **存储位置** | `~/.attacktrace/projects/{project_id}/mcp_config.json` | `~/.attacktrace/mcp-packages/{name}@{version}/` |
| **项目隔离** | ✅ 每个项目独立 | ❌ 所有项目共享 |
| **包含内容** | 配置参数（env、command、args、enabled 等） | 可执行文件、脚本、依赖 |
| **创建时机** | 用户在 UI 中"添加集成"并配置环境变量 | 下载包时（首次使用或更新版本） |
| **生命周期** | 随项目删除而删除 | 手动删除或清理缓存时删除 |
| **唯一标识** | `instance_name` (如 "Kibana", "Kibana_2") | `name@version` (如 "Kibana@0.7.2") |

### 关系图

```
┌──────────────────────────────────────────────────────────────┐
│  Project: luke2                                              │
│                                                              │
│  mcp_config.json:                                            │
│  {                                                           │
│    "mcpServers": {                                           │
│      "Kibana": {                    ← Instance #1            │
│        "command": "node",                                    │
│        "args": ["/.../.attacktrace/mcp-packages/             │
│                 Kibana@0.7.2/dist/index.js"],  ← 引用 Package│
│        "env": { "KIBANA_URL": "..." },                       │
│        "version": "0.7.2"                                    │
│      },                                                      │
│      "Elasticsearch": {             ← Instance #2            │
│        "command": "node",                                    │
│        "args": ["/.../.attacktrace/mcp-packages/             │
│                 Elasticsearch@0.7.3/dist/index.js"],         │
│        "env": { "ES_URL": "..." },                           │
│        "version": "0.7.3"                                    │
│      }                                                       │
│    }                                                         │
│  }                                                           │
└──────────────────────────────────────────────────────────────┘
                    ↓ 引用
┌──────────────────────────────────────────────────────────────┐
│  Global Packages (Shared by all projects)                   │
│                                                              │
│  ~/.attacktrace/mcp-packages/                                │
│  ├── Kibana@0.7.2/                ← Package #1               │
│  │   ├── dist/                                              │
│  │   │   └── index.js                                       │
│  │   ├── package.json                                       │
│  │   └── node_modules/                                      │
│  │                                                           │
│  └── Elasticsearch@0.7.3/         ← Package #2               │
│      ├── dist/                                              │
│      ├── package.json                                       │
│      └── node_modules/                                      │
└──────────────────────────────────────────────────────────────┘
```

### 典型场景

#### 场景 1: 同一个包，多个实例

```
Project: luke2
  ├─ Instance: Kibana_prod
  │    └─ env: { KIBANA_URL: "https://prod.example.com" }
  │    └─ args: ["/.../.attacktrace/mcp-packages/Kibana@0.7.2/dist/index.js"]
  │
  └─ Instance: Kibana_dev
       └─ env: { KIBANA_URL: "https://dev.example.com" }
       └─ args: ["/.../.attacktrace/mcp-packages/Kibana@0.7.2/dist/index.js"]
                                                     ↑
                            两个实例共享同一个包：Kibana@0.7.2
```

#### 场景 2: 跨项目共享包

```
Project: luke2                      Project: default
  ├─ Kibana (v0.7.2)                 ├─ Kibana (v0.7.2)
  │    └─ env: {...}                 │    └─ env: {...}
                 ↓                                ↓
           共享同一个包：~/.attacktrace/mcp-packages/Kibana@0.7.2/
```

---

## 常见问题和调试指南

### 问题 1: 实例创建到了错误的项目

**症状:**
- 在项目 `luke2` 中添加集成
- 实例出现在 `default` 项目的 `mcp_config.json` 中

**根本原因:**
`currentProjectIdAtom` 初始值为 `"default"`，应用启动时未在全局加载真实的项目 ID

**检查点:**
```bash
# 1. 检查当前项目
cat ~/.attacktrace/current_project.json

# 2. 检查前端是否先加载了 projectId
# 查看 src/App.tsx 的 useEffect 顺序

# 3. 检查 HTTP 请求是否携带正确的 header
# 打开浏览器开发者工具 → Network → 查看请求头
```

**修复:**
```typescript
// src/App.tsx
useEffect(() => {
  const init = async () => {
    await loadCurrentProjectId()  // ✅ 先加载项目 ID
    loadTools()
    loadMcpConfig()
  }
  init()
}, [loadCurrentProjectId, loadTools, loadMcpConfig])
```

### 问题 2: 项目切换后实例列表未更新

**症状:**
- 切换项目后，仍然显示旧项目的实例列表

**根本原因:**
组件未监听 `currentProjectId` 的变化

**检查点:**
```typescript
// src/views/Drawer/IntegrationMarket.tsx
// 是否有这个 useEffect？
useEffect(() => {
  if (isInitializedRef.current) {
    loadInstalledInstances()
  }
}, [currentProjectId, loadInstalledInstances])
```

**修复:**
添加监听 `currentProjectId` 变化的 `useEffect`

### 问题 3: CORS 错误 - Failed to fetch

**症状:**
```
Access to fetch at 'http://localhost:5173/api/plugins/oap-platform/instances' 
from origin 'http://localhost:5173' has been blocked by CORS policy: 
Request header field x-project-id is not allowed by Access-Control-Allow-Headers
```

**根本原因:**
后端 CORS 中间件未允许 `X-Project-ID` header

**检查点:**
```python
# mcp-host/attacktrace_mcp_host/httpd/app.py
app.add_middleware(
    CORSMiddleware,
    allow_headers=[
        "X-Project-ID",  # ← 是否存在？
    ],
)
```

**修复:**
在 `allow_headers` 列表中添加 `"X-Project-ID"`

### 问题 4: 添加集成后 UI 卡住

**症状:**
- 填写完配置，点击确认
- 实例已创建（重启后能看到）
- 但 UI 停留在配置页面

**根本原因:**
创建成功后未重置 `viewMode` 和相关状态

**检查点:**
```typescript
// src/views/Drawer/IntegrationMarket.tsx
// 在 handleConfigSubmit 成功后是否有：
setViewMode("browse")
setSelectedTool(null)
setConfigData([])
setIsSubmitting(false)
```

**修复:**
在成功创建实例后添加完整的状态重置逻辑

### 问题 5: 包已下载但显示"未安装"

**症状:**
- 包存在于 `~/.attacktrace/mcp-packages/`
- UI 中仍显示"未安装"

**检查点:**
```bash
# 1. 检查包目录
ls -la ~/.attacktrace/mcp-packages/

# 2. 检查包版本是否匹配
# 前端请求的版本：0.7.2
# 实际包版本：Kibana@0.7.2

# 3. 检查 API 端点
curl http://localhost:5173/api/plugins/oap-platform/packages/check/Kibana/0.7.2
```

**根本原因:**
- 版本号不匹配
- API 端点路径错误
- 包目录命名格式不一致

### 问题 6: 老配置干扰

**症状:**
- 新项目中出现不应该存在的实例
- 所有项目显示相同的实例列表

**检查点:**
```bash
# 1. 检查是否存在老配置
ls -la ~/.attacktrace/.config/mcp_config.json

# 2. 检查迁移逻辑是否被触发
# 查看后端日志：grep "Migrated old config" ~/.attacktrace/logs/*.log

# 3. 检查各项目配置
cat ~/.attacktrace/projects/default/mcp_config.json
cat ~/.attacktrace/projects/luke2/mcp_config.json
```

**修复:**
```bash
# 删除老配置（如果不再需要）
rm ~/.attacktrace/.config/mcp_config.json

# 或者手动迁移到特定项目
mv ~/.attacktrace/.config/mcp_config.json \
   ~/.attacktrace/projects/luke2/mcp_config.json
```

---

## 调试工具和技巧

### 1. 日志位置

```bash
# 前端日志（浏览器控制台）
# Chrome DevTools → Console

# 后端日志（Python FastAPI）
~/.attacktrace/logs/attacktrace-mcp-host.log

# Electron 日志
~/Library/Logs/AttackTrace/  # macOS
```

### 2. 检查项目状态

```bash
# 当前项目
cat ~/.attacktrace/current_project.json

# 项目列表
ls -la ~/.attacktrace/projects/

# 项目配置
cat ~/.attacktrace/projects/{project_id}/mcp_config.json | jq .

# 已下载包
ls -la ~/.attacktrace/mcp-packages/
```

### 3. 网络请求调试

```javascript
// 在浏览器控制台中拦截所有 fetch 请求
const originalFetch = window.fetch
window.fetch = function(...args) {
  console.log('[Fetch]', args[0], args[1]?.headers)
  return originalFetch.apply(this, args)
}
```

### 4. Atom 状态调试

```typescript
// 在组件中打印 atom 值
import { useAtomValue } from 'jotai'
import { currentProjectIdAtom } from '@/atoms/projectState'

const currentProjectId = useAtomValue(currentProjectIdAtom)
console.log('[Debug] currentProjectId:', currentProjectId)
```

### 5. 后端 API 测试

```bash
# 测试实例列表 API
curl -H "X-Project-ID: luke2" \
     http://localhost:5173/api/plugins/oap-platform/instances

# 测试包检查 API
curl http://localhost:5173/api/plugins/oap-platform/packages/check/Kibana/0.7.2
```

---

## 最佳实践

### 1. 项目上下文传递
- ✅ 在应用启动时立即加载 `currentProjectId`
- ✅ 所有 API 请求都携带 `X-Project-ID` header
- ✅ 后端所有项目相关的 handler 都接受 `x_project_id` 参数
- ❌ 不要依赖后端的默认值（如 "default"）

### 2. 状态管理
- ✅ 使用 `useEffect` 监听 `currentProjectId` 变化
- ✅ 项目切换后重新加载项目相关数据
- ✅ 使用 `useRef` 标记初始化状态，避免重复加载
- ❌ 不要在组件中缓存跨项目的数据

### 3. 错误处理
- ✅ 所有 API 调用都包裹在 try-catch 中
- ✅ 使用 `AbortController` 支持请求取消
- ✅ 失败后重置 UI 状态到可操作状态
- ❌ 不要让错误导致 UI 卡死

### 4. 配置管理
- ✅ 使用项目特定的配置管理器
- ✅ 保存配置后立即重新加载
- ✅ 配置文件使用 JSON 格式并包含版本信息
- ❌ 不要修改其他项目的配置文件

---

## 附录

### A. 关键文件清单

#### 前端
- `src/App.tsx` - 应用入口，负责初始化项目 ID
- `src/atoms/projectState.ts` - 项目状态管理（Jotai）
- `src/views/Drawer/IntegrationMarket.tsx` - 集成市场主组件
- `src/components/ProjectSelector.tsx` - 项目选择器
- `src/ipc/project.ts` - 项目相关 IPC 调用

#### 后端
- `mcp-host/attacktrace_mcp_host/httpd/app.py` - FastAPI 应用入口
- `mcp-host/attacktrace_mcp_host/httpd/conf/project_context.py` - 项目上下文管理
- `mcp-host/attacktrace_mcp_host/httpd/conf/mcp_servers.py` - MCP 配置管理器
- `mcp-host/attacktrace_mcp_host/oap_plugin/http_handlers.py` - API handlers
- `mcp-host/attacktrace_mcp_host/oap_plugin/instance_manager.py` - 实例管理
- `mcp-host/attacktrace_mcp_host/oap_plugin/package_manager.py` - 包管理

#### Electron
- `electron/main/ipc/project.ts` - 项目 IPC handlers

### B. 环境变量

| 变量名 | 作用 | 示例 |
|--------|------|------|
| `DIVE_MCP_CONFIG_CONTENT` | 覆盖配置文件内容（用于测试） | `{"mcpServers": {...}}` |
| `ATTACKTRACE_CONFIG_DIR` | 配置目录路径 | `~/.attacktrace/.config` |

### C. 参考链接

- [MCP Protocol Specification](https://modelcontextprotocol.io/)
- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [Jotai Documentation](https://jotai.org/)
- [Electron IPC Documentation](https://www.electronjs.org/docs/latest/api/ipc-main)

---

**文档版本**: 1.0  
**最后更新**: 2026-02-03  
**维护者**: AttackTrace Team
