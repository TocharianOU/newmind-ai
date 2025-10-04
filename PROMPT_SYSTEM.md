# Prompt 系统配置说明

## 概述

本文档描述了 Dive AI 应用的 Prompt 系统架构及其优先级机制。该系统支持多层级的 prompt 配置，确保在不同环境下都能正确应用用户的定制化规则。

## 架构变更历史

### 之前的实现（存在问题）

在之前的实现中，App-level prompt 通过 `app_config.json` 文件配置：

```json
// mcp-host/app_config.json
{
  "app_prompt": "每次生成的内容都在最前面和最后面加上🎉🎉标志"
}
```

**存在的问题**：
1. **路径依赖问题**：`PromptManager` 使用相对路径读取 `app_config.json`
2. **开发与生产环境不一致**：
   - 开发模式：`cwd` 设置为 `mcp-host`，能正确读取文件
   - 生产模式：`cwd` 不同，文件路径错误，导致 prompt 无法加载
3. **配置文件管理复杂**：需要在 Electron 侧创建和维护配置文件

### 当前实现（硬编码方案）

为了解决上述问题，我们采用了**硬编码 App-level prompt** 的方案：

#### 1. Python 侧修改

**文件**: `mcp-host/dive_mcp_host/httpd/conf/prompt.py`

**主要变更**：

```python
# 新增：硬编码的默认 App-level prompt
DEFAULT_APP_PROMPT = "每次生成的内容都在最前面和最后面加上🎉🎉✅标志"

class PromptManager:
    """Prompt Manager for handling system prompts and custom rules."""

    def __init__(self, custom_rules_path: Optional[str] = None) -> None:
        """Initialize the PromptManager.
        
        The system prompt is set according to the following priority:
        1. Hub-level configuration (highest priority - via set_prompt)
        2. App-level configuration (medium priority - hardcoded)
        3. User-defined custom rules (lowest priority - from file)
        """
        self.prompts: dict[str, str] = {}
        self.custom_rules_path = custom_rules_path or str(
            DIVE_CONFIG_DIR / "custom_rules"
        )
        # 移除了 app_config_path 参数

    def initialize(self) -> None:
        """Initialize the PromptManager."""
        logger.info("Initializing PromptManager from %s", self.custom_rules_path)
        
        # 直接使用硬编码的 App-level prompt
        app_prompt = DEFAULT_APP_PROMPT
        
        # 加载用户自定义规则
        custom_rules = self.load_custom_rules()
        
        # 按优先级组合 prompts
        combined_prompt = self._combine_prompts(app_prompt, custom_rules)
        
        self.prompts[PromptKey.SYSTEM] = system_prompt(combined_prompt)
        self.prompts[PromptKey.CUSTOM] = custom_rules
        self.prompts[PromptKey.APP] = app_prompt

    # 移除了 load_app_prompt 方法
```

**关键改进**：
- ✅ 移除了 `app_config_path` 参数和 `load_app_prompt()` 方法
- ✅ 引入 `DEFAULT_APP_PROMPT` 常量，直接在代码中定义
- ✅ `initialize()` 方法直接使用硬编码的 prompt，无需读取文件
- ✅ 消除了路径依赖问题，确保开发和生产环境一致

#### 2. Electron 侧修改

**文件**: `electron/main/constant.ts`

**变更**：移除了 `DEF_APP_CONFIG` 的导出

```typescript
// 移除了以下代码：
// export const DEF_APP_CONFIG = {
//   "app_prompt": "每次生成的内容都在最前面和最后面加上🎉🎉标志"
// }
```

**文件**: `electron/main/service.ts`

**变更**：移除了 `app_config.json` 的创建逻辑

```typescript
async function initApp() {
  // ... 其他配置文件创建 ...
  
  // 移除了以下代码：
  // const appConfigPath = path.join(baseConfigDir, "app_config.json")
  // await createFileIfNotExists(appConfigPath, JSON.stringify(DEF_APP_CONFIG, null, 2))
}
```

## Prompt 优先级机制

PromptManager 支持三层 prompt 配置，优先级从高到低：

### 1. Hub-level Configuration（最高优先级）
- **来源**：云端同步的 Hub 平台配置
- **设置方式**：通过 `PromptManager.set_prompt()` 方法
- **应用场景**：当用户在 Hub 平台设置了全局 prompt 时，会覆盖本地配置
- **特点**：动态更新，可通过 API 同步

### 2. App-level Configuration（中等优先级）
- **来源**：硬编码在 `prompt.py` 中的 `DEFAULT_APP_PROMPT`
- **修改方式**：直接编辑 `DEFAULT_APP_PROMPT` 常量
- **应用场景**：应用级别的默认行为定制
- **特点**：
  - ✅ 稳定可靠，不依赖文件系统
  - ✅ 开发和生产环境一致
  - ✅ 易于版本控制和部署

### 3. User-defined Custom Rules（最低优先级）
- **来源**：用户在 `~/.dive/config/custom_rules` 文件中定义
- **设置方式**：通过应用 UI 或直接编辑文件
- **应用场景**：用户个性化的定制规则
- **特点**：灵活，用户可随时修改

## Prompt 组合逻辑

`PromptManager._combine_prompts()` 方法将不同层级的 prompt 组合在一起：

```python
def _combine_prompts(self, app_prompt: str, custom_rules: str) -> str:
    """Combine app prompt and custom rules with proper priority."""
    combined_parts = []
    
    if app_prompt:
        combined_parts.append(f"<App_Level_Configuration>\n{app_prompt}\n</App_Level_Configuration>")
    
    if custom_rules:
        combined_parts.append(f"<User_Defined_Rules>\n{custom_rules}\n</User_Defined_Rules>")
    
    return "\n\n".join(combined_parts)
```

最终生成的系统 prompt 格式：

```
<App_Level_Configuration>
每次生成的内容都在最前面和最后面加上🎉🎉✅标志
</App_Level_Configuration>

<User_Defined_Rules>
[用户自定义规则内容]
</User_Defined_Rules>
```

## 如何修改 App-level Prompt

### 方法 1：直接修改源码（推荐）

编辑 `mcp-host/dive_mcp_host/httpd/conf/prompt.py`：

```python
# 修改这个常量即可
DEFAULT_APP_PROMPT = "你的新 prompt 内容"
```

### 方法 2：通过 Hub 平台覆盖（动态）

当应用连接到 Hub 平台时，Hub 可以通过 API 调用 `PromptManager.set_prompt()` 来动态覆盖本地 prompt：

```python
# Hub 平台可以调用
prompt_manager.set_prompt(PromptKey.SYSTEM, "Hub 平台的全局 prompt")
```

## 与 Hub 云端同步的兼容性

✅ **完全兼容**：当前的硬编码方案不影响 Hub 云端同步功能：

1. **Hub-level prompt 优先级更高**：
   - Hub 平台通过 `set_prompt()` 设置的 prompt 会直接覆盖本地 prompt
   - 用户在 Hub 平台的设置始终优先

2. **本地 prompt 作为后备**：
   - 当未连接 Hub 或 Hub 未设置 prompt 时，使用硬编码的 `DEFAULT_APP_PROMPT`
   - 确保应用在任何情况下都有可用的 prompt

3. **用户自定义规则保留**：
   - 用户在本地设置的 `custom_rules` 仍然会被加载和应用
   - 优先级最低，但提供了额外的定制化能力

## 配置文件位置

### 开发环境
- **配置目录**：`<project_root>/.config/`
- **Custom Rules**：`<project_root>/.config/custom_rules`

### 生产环境（打包后）
- **配置目录**：`~/.dive/config/`
- **Custom Rules**：`~/.dive/config/custom_rules`
- **数据库**：`~/.dive/config/db.sqlite`

## 优势总结

采用硬编码方案后的优势：

1. ✅ **环境一致性**：开发和生产环境行为完全一致
2. ✅ **简化配置**：减少了配置文件管理的复杂性
3. ✅ **可靠性提升**：消除了文件路径相关的潜在错误
4. ✅ **易于维护**：prompt 配置集中在代码中，便于版本控制
5. ✅ **保持灵活性**：仍然支持 Hub 云端同步和用户自定义规则
6. ✅ **向后兼容**：不影响现有的 Hub 集成和用户配置

## 未来扩展

如果需要更灵活的 App-level prompt 配置，可以考虑：

1. **环境变量方式**：
   ```python
   DEFAULT_APP_PROMPT = os.getenv("DIVE_APP_PROMPT", "默认 prompt")
   ```

2. **配置中心方式**：
   - 从远程配置中心拉取 prompt
   - 支持动态更新，无需重启应用

3. **多语言支持**：
   ```python
   DEFAULT_APP_PROMPTS = {
       "en": "English prompt...",
       "zh-CN": "中文 prompt..."
   }
   ```

## 相关文件

- `mcp-host/dive_mcp_host/httpd/conf/prompt.py` - Prompt Manager 核心逻辑
- `mcp-host/dive_mcp_host/httpd/conf/system_prompt.py` - 系统 prompt 模板
- `electron/main/constant.ts` - Electron 侧常量定义
- `electron/main/service.ts` - 服务初始化逻辑

## 问题排查

### 问题：Prompt 没有生效

**检查步骤**：
1. 检查 `DEFAULT_APP_PROMPT` 是否正确设置
2. 查看日志：`~/.dive/log/host/` 目录下的日志文件
3. 确认 PromptManager 是否正确初始化
4. 检查 Hub 是否覆盖了本地配置

### 问题：开发环境和生产环境行为不一致

**解决方案**：
- 当前的硬编码方案已经解决了这个问题
- 确保使用最新版本的代码
- 如果问题仍然存在，检查是否有遗留的 `app_config.json` 文件

---

**最后更新**：2025-10-04  
**版本**：v1.0  
**维护者**：Dive AI Team

