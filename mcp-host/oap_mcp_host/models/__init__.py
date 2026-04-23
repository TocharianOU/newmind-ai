"""Additional models for the MCP."""

import logging
import os
import re
import requests
from importlib import import_module
from typing import Any

from langchain.chat_models import init_chat_model
from langchain_core.language_models import BaseChatModel

from oap_mcp_host.models.helpers import clean_model_kwargs
from oap_mcp_host.models.model_cache import model_cache

logger = logging.getLogger("oap_mcp_host.models")

_HUB_INTERNAL_URL = os.environ.get("HUB_INTERNAL_URL", "").rstrip("/")


_HUB_EXTERNAL_PORT = os.environ.get("HUB_EXTERNAL_PORT", "23000")


def _rewrite_hub_url(url: str) -> str:
    """Rewrite browser-facing Hub URLs to the Docker-internal address.

    Handles both localhost and any external IP/hostname that targets the
    Hub's published port (default 23000).
    """
    if not _HUB_INTERNAL_URL or not url:
        return url
    rewritten = re.sub(
        rf"https?://[^/\s]+:{re.escape(_HUB_EXTERNAL_PORT)}",
        _HUB_INTERNAL_URL,
        url,
    )
    if rewritten == url:
        rewritten = re.sub(
            r"https?://(?:localhost|127\.0\.0\.1)(?::\d+)?",
            _HUB_INTERNAL_URL,
            url,
        )
    if rewritten != url:
        logger.info("[URL_REWRITE] %s -> %s", url, rewritten)
    return rewritten

def get_model_info_from_hub(model_name: str, hub_base_url: str, api_key: str) -> dict:
    """从Hub获取模型的详细信息，包括真实provider
    
    简化版本，直接请求Hub以避免启动时问题
    """
    try:
        # 只在有API key时才请求
        if not api_key or api_key == "":
            logger.debug(f"[HUB] Skipping fetch for {model_name}: no API key")
            return {}
            
        clean_base_url = hub_base_url.rstrip('/api/v1').rstrip('/v1').rstrip('/')
        response = requests.get(
            f"{clean_base_url}/api/v1/models",
            headers={"Authorization": f"Bearer {api_key}"},
            timeout=5
        )
        
        if response.status_code == 200:
            models_data = response.json()
            models = models_data.get('data', [])
            
            for model in models:
                if model.get('id') == model_name:
                    logger.info(f"[HUB] Found model info for {model_name}: provider={model.get('provider')}")
                    return {
                        'id': model_name,
                        'provider': model.get('provider', 'openai'),
                        'endpoint': model.get('endpoint', '/v1/messages'),
                        'metadata': model.get('metadata', {}),
                        'native_format': model.get('metadata', {}).get('native_format', False)
                    }
        
        logger.debug(f"[HUB] Model {model_name} not found or auth failed")
        return {}
        
    except Exception as e:
        logger.debug(f"[HUB] Failed to get model info for {model_name}: {e}")
        return {}


def load_model(
    provider: str,
    model_name: str,
    *args: Any,
    **kwargs: Any,
) -> BaseChatModel:
    """Load a model from the models directory.

    Args:
        provider: provider name. Two special providers are supported:
            - "dive": use the model in oap_mcp_host.models
            - "__load__": load the model from the configuration
        model_name: The name of the model to load.
        args: Additional arguments to pass to the model.
        kwargs: Additional keyword arguments to pass to the model.

    Returns:
        The loaded model.

    If the provider is "dive", it should be like this:
        import oap_mcp_host.models.model_name_in_lower_case as model_module
        model = model_module.load_model(*args, **kwargs)
    If the provider is "__load__", the model_name is the class name of the model.
    For example, with model_name="package.module:ModelClass", it will be like this:
        import package.module as model_module
        model = model_module.ModelClass(*args, **kwargs)
    If the provider is neither "dive" nor "__load__", it will load model from langchain.
    """
    logger.debug("Loading model %s with provider %s", model_name, provider)
    if provider == "dive":
        model_name_lower = model_name.replace("-", "_").replace(".", "_").lower()
        model_module = import_module(
            f"oap_mcp_host.models.{model_name_lower}",
        )
        model = model_module.load_model(*args, **kwargs)
    elif provider == "oap":
        base_url = _rewrite_hub_url(kwargs.get('base_url', 'http://localhost:3000'))
        api_key = kwargs.get('api_key', '')
        
        # 处理SecretStr对象 - 转换为普通字符串
        if hasattr(api_key, 'get_secret_value'):
            api_key_str = api_key.get_secret_value()
        else:
            api_key_str = str(api_key) if api_key else ''
        
        logger.info(f"[LOAD_MODEL] Loading OAP model {model_name}")
        
        model_info = get_model_info_from_hub(model_name, base_url, api_key_str)

        if model_info and model_info.get('native_format'):
            real_provider = model_info.get('provider', 'openai')
            endpoint = model_info.get('endpoint', '/v1/messages')
            # native_client tells us which LangChain adapter to use; it may differ
            # from the public provider name (e.g. 'oap') when the Hub uses a
            # product-level alias.
            native_client = model_info.get('metadata', {}).get('native_client') or real_provider
            logger.info(f"[LOAD_MODEL] {model_name} -> client={native_client}")

            clean_base_url = base_url.rstrip('/api/v1').rstrip('/v1').rstrip('/')

            if native_client == 'anthropic':
                hub_proxy_url = f"{clean_base_url}/api"
            elif native_client == 'openai':
                hub_proxy_url = f"{clean_base_url}/api/v1" if endpoint == '/v1/chat/completions' else f"{clean_base_url}/api"
            else:
                hub_proxy_url = f"{clean_base_url}/api{endpoint}"

            if native_client == 'anthropic':
                model_kwargs = clean_model_kwargs("anthropic", kwargs)
                model_kwargs["api_key"] = api_key_str
                model_kwargs["base_url"] = hub_proxy_url
                model = init_chat_model(
                    model=model_name,
                    model_provider="anthropic",
                    **model_kwargs,
                )
            elif native_client == 'openai':
                model_kwargs = clean_model_kwargs("openai", kwargs)
                model_kwargs["api_key"] = api_key_str
                model_kwargs["base_url"] = hub_proxy_url
                model = init_chat_model(
                    model=model_name,
                    model_provider="openai",
                    **model_kwargs,
                )
            else:
                model_kwargs = clean_model_kwargs(native_client, kwargs)
                model_kwargs["api_key"] = api_key_str
                model_kwargs["base_url"] = hub_proxy_url
                model = init_chat_model(
                    model=model_name,
                    model_provider=native_client,
                    **model_kwargs,
                )
        else:
            if not model_info:
                logger.warning(f"[LOAD_MODEL] Model {model_name} info not available, falling back to OpenAI compatibility mode")
            else:
                logger.warning(f"[LOAD_MODEL] Model {model_name} does not support native format, falling back to OpenAI compatibility mode")
            clean_base_url = base_url.rstrip('/api/v1').rstrip('/v1').rstrip('/')
            fallback_url = f"{clean_base_url}/api/v1"

            model_kwargs = clean_model_kwargs("openai", kwargs)
            model_kwargs["api_key"] = api_key_str
            model_kwargs["base_url"] = fallback_url

            model = init_chat_model(
                model=model_name,
                model_provider="openai",
                **model_kwargs,
            )
    elif provider == "__load__":
        module_path, class_name = model_name.rsplit(":", 1)
        model_module = import_module(module_path)
        class_ = getattr(model_module, class_name)
        model = class_(*args, **clean_model_kwargs(class_, kwargs))
    else:
        if len(args) > 0:
            raise ValueError(
                f"Additional arguments are not supported for {provider} provider.",
            )
        model = init_chat_model(
            model=model_name,
            model_provider=provider,
            **clean_model_kwargs(provider, kwargs),
        )
    return model
