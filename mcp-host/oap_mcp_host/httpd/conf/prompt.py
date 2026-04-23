import logging
import os
from enum import Enum
from pathlib import Path
from typing import Optional

from oap_mcp_host.env import OAP_CONFIG_DIR
from oap_mcp_host.httpd.conf.misc import write_then_replace
from oap_mcp_host.httpd.conf.system_prompt import system_prompt

# Logger setup
logger = logging.getLogger(__name__)

# Default app-level prompt (hardcoded in code)
DEFAULT_APP_PROMPT = """每次生成的内容都在最前面和最后面加上👌👌✅标志

<Document_Rendering_Rules>
  当 MCP 工具（如 Elasticsearch）返回包含 <document_card> 标签的文档元数据时，请遵循以下规则：
  
  1. **保持标签完整性**：不要删除或修改 <document_card> 标签及其属性
  2. **自然语言描述**：在标签前后添加自然语言描述，例如：
     "我找到了相关文档：
     <document_card title="..." page="3" preview_url="..." ... />
     这是第 3 页的内容，主要包含..."
  
  3. **标签格式**：<document_card> 标签包含以下属性：
     - title: 文档标题
     - page: 当前页码
     - total_pages: 总页数
     - preview_url: 页面预览图片 URL (PNG)
     - original_file_url: 完整文档下载 URL (原始文件，如 PDF)
     - minio_base_url: MinIO S3 基础 URL
     - minio_bucket: MinIO 存储桶名称
     - minio_prefix: MinIO 对象前缀
     - file_type: 文件类型 (pdf, docx, etc.)
     - file_size: 文件大小（字节）
     - project_name: 项目名称
     - drawing_number: 图纸编号
     - checksum: 文件校验和
  
  4. **用户体验**：前端会自动将这些标签渲染为文档卡片，包含：
     - 文档页面缩略图
     - "下载页面" 按钮：下载当前页面的 PNG 图片
     - "下载文档" 按钮：下载完整的原始文档 (PDF/DOCX 等)
  
  示例输出：
  "根据您的查询，我找到了相关文档：
  
  <document_card title="luke.pdf" page="1" total_pages="1" preview_url="http://localhost:9000/rag-bucket/luke_1_a1b2c3d4/page_001_300dpi.png" original_file_url="http://localhost:9000/rag-bucket/luke_1_a1b2c3d4/luke.pdf" minio_bucket="rag-bucket" minio_prefix="luke_1_a1b2c3d4" minio_base_url="http://localhost:9000" file_type="pdf" file_size="524288" project_name="Luke Project" drawing_number="LK-2024-001" checksum="a1b2c3d4..." />
  
  这是 Luke 项目的相关文档，编号为 LK-2024-001。"

</Document_Rendering_Rules>"""


class PromptKey(str, Enum):
    """Prompt key enum."""

    SYSTEM = "system"
    CUSTOM = "custom"
    APP = "app"


class PromptManager:
    """Prompt Manager for handling system prompts and custom rules."""

    def __init__(self, custom_rules_path: Optional[str] = None) -> None:
        """Initialize the PromptManager.

        The system prompt is set according to the following priority:
        1. Hub-level configuration (highest priority)
        2. App-level configuration (hardcoded DEFAULT_APP_PROMPT)
        3. User-defined custom rules (lowest priority)
        4. Default to empty string if no other source is available

        Args:
            custom_rules_path: Optional path to the custom rules file.
        """
        self.prompts: dict[str, str] = {}
        self.custom_rules_path = custom_rules_path or str(
            OAP_CONFIG_DIR / "custom_rules"
        )

    def initialize(self) -> None:
        """Initialize the PromptManager."""
        logger.info("Initializing PromptManager from %s", self.custom_rules_path)
        
        # Use hardcoded app-level prompt
        app_prompt = DEFAULT_APP_PROMPT
        
        # Load user-defined custom rules
        custom_rules = self.load_custom_rules()
        
        # Combine prompts with proper priority
        combined_prompt = self._combine_prompts(app_prompt, custom_rules)
        
        self.prompts[PromptKey.SYSTEM] = system_prompt(combined_prompt)
        self.prompts[PromptKey.CUSTOM] = custom_rules
        self.prompts[PromptKey.APP] = app_prompt

    def set_prompt(self, key: str, prompt: str) -> None:
        """Set a prompt by key.

        Args:
            key: The key to store the prompt under.
            prompt: The prompt text.
        """
        self.prompts[key] = prompt

    def get_prompt(self, key: str) -> Optional[str]:
        """Get a prompt by key.

        Args:
            key: The key of the prompt to retrieve.

        Returns:
            The prompt text or None if not found.
        """
        return self.prompts.get(key)

    def write_custom_rules(self, prompt: str) -> None:
        """Write custom rules to file.

        Args:
            prompt: The prompt text.
        """
        write_then_replace(Path(self.custom_rules_path), prompt)

    def load_custom_rules(self) -> str:
        """Load custom rules from file or environment variable.

        Returns:
            The custom rules text.
        """
        try:
            return os.environ.get("DIVE_CUSTOM_RULES_CONTENT") or Path(
                self.custom_rules_path
            ).read_text(encoding="utf-8")
        except OSError as error:
            logger.warning("Cannot read %s: %s", self.custom_rules_path, error)
            return ""

    def _combine_prompts(self, app_prompt: str, custom_rules: str) -> str:
        """Combine app prompt and custom rules with proper priority.
        
        Priority order:
        1. Hub-level configuration (handled elsewhere)
        2. App-level configuration (app_prompt)
        3. User-defined custom rules (custom_rules)
        
        Args:
            app_prompt: The app-level prompt.
            custom_rules: The user-defined custom rules.
            
        Returns:
            Combined prompt text.
        """
        combined_parts = []
        
        if app_prompt:
            combined_parts.append(f"<App_Level_Configuration>\n{app_prompt}\n</App_Level_Configuration>")
        
        if custom_rules:
            combined_parts.append(f"<User_Defined_Rules>\n{custom_rules}\n</User_Defined_Rules>")
        
        return "\n\n".join(combined_parts)

    def update_prompts(self) -> None:
        """Update the system prompt with current custom rules."""
        app_prompt = DEFAULT_APP_PROMPT
        custom_rules = self.load_custom_rules()
        combined_prompt = self._combine_prompts(app_prompt, custom_rules)
        
        self.prompts[PromptKey.SYSTEM] = system_prompt(combined_prompt)
        self.prompts[PromptKey.CUSTOM] = custom_rules
        self.prompts[PromptKey.APP] = app_prompt
