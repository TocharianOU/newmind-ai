import json
import logging
import os
from enum import Enum
from pathlib import Path
from typing import Optional

from dive_mcp_host.env import DIVE_CONFIG_DIR
from dive_mcp_host.httpd.conf.misc import write_then_replace
from dive_mcp_host.httpd.conf.system_prompt import system_prompt

# Logger setup
logger = logging.getLogger(__name__)


class PromptKey(str, Enum):
    """Prompt key enum."""

    SYSTEM = "system"
    CUSTOM = "custom"
    APP = "app"


class PromptManager:
    """Prompt Manager for handling system prompts and custom rules."""

    def __init__(self, custom_rules_path: Optional[str] = None, app_config_path: Optional[str] = None) -> None:
        """Initialize the PromptManager.

        The system prompt is set according to the following priority:
        1. Hub-level configuration (highest priority)
        2. App-level configuration (app_config.json)
        3. User-defined custom rules (lowest priority)
        4. Default to empty string if no other source is available

        Args:
            custom_rules_path: Optional path to the custom rules file.
            app_config_path: Optional path to the app configuration file.
        """
        self.prompts: dict[str, str] = {}
        self.custom_rules_path = custom_rules_path or str(
            DIVE_CONFIG_DIR / "custom_rules"
        )
        self.app_config_path = app_config_path or "app_config.json"

    def initialize(self) -> None:
        """Initialize the PromptManager."""
        logger.info("Initializing PromptManager from %s", self.custom_rules_path)
        
        # Load app-level configuration
        app_prompt = self.load_app_prompt()
        
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

    def load_app_prompt(self) -> str:
        """Load app-level prompt from configuration file.
        
        Returns:
            The app prompt text.
        """
        try:
            app_config_path = Path(self.app_config_path)
            if app_config_path.exists():
                with open(app_config_path, 'r', encoding='utf-8') as f:
                    config = json.load(f)
                    return config.get('app_prompt', '')
            else:
                logger.warning("App config file not found: %s", self.app_config_path)
                return ""
        except (json.JSONDecodeError, OSError) as error:
            logger.warning("Cannot read app config %s: %s", self.app_config_path, error)
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
        app_prompt = self.load_app_prompt()
        custom_rules = self.load_custom_rules()
        combined_prompt = self._combine_prompts(app_prompt, custom_rules)
        
        self.prompts[PromptKey.SYSTEM] = system_prompt(combined_prompt)
        self.prompts[PromptKey.CUSTOM] = custom_rules
        self.prompts[PromptKey.APP] = app_prompt
