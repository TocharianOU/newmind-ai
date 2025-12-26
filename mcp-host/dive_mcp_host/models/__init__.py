"""Additional models for the MCP."""

import logging
import requests
from importlib import import_module
from typing import Any

from langchain.chat_models import init_chat_model
from langchain_core.language_models import BaseChatModel

from dive_mcp_host.models.helpers import clean_model_kwargs
from dive_mcp_host.models.model_cache import model_cache

logger = logging.getLogger("dive_mcp_host.models")

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
            - "dive": use the model in dive_mcp_host.models
            - "__load__": load the model from the configuration
        model_name: The name of the model to load.
        args: Additional arguments to pass to the model.
        kwargs: Additional keyword arguments to pass to the model.

    Returns:
        The loaded model.

    If the provider is "dive", it should be like this:
        import dive_mcp_host.models.model_name_in_lower_case as model_module
        model = model_module.load_model(*args, **kwargs)
    If the provider is "__load__", the model_name is the class name of the model.
    For example, with model_name="package.module:ModelClass", it will be like this:
        import package.module as model_module
        model = model_module.ModelClass(*args, **kwargs)
    If the provider is neither "dive" nor "__load__", it will load model from langchain.
    """
    logger.debug(
        "Loading model %s with provider %s, kwargs: %s",
        model_name,
        provider,
        kwargs,
    )
    if provider == "dive":
        model_name_lower = model_name.replace("-", "_").replace(".", "_").lower()
        model_module = import_module(
            f"dive_mcp_host.models.{model_name_lower}",
        )
        model = model_module.load_model(*args, **kwargs)
    elif provider == "oap":
        # OAP动态Provider路由 - 根据Hub返回的信息选择真实provider
        base_url = kwargs.get('base_url', 'http://localhost:3000')
        api_key = kwargs.get('api_key', '')
        
        # 处理SecretStr对象 - 转换为普通字符串
        if hasattr(api_key, 'get_secret_value'):
            api_key_str = api_key.get_secret_value()
        else:
            api_key_str = str(api_key) if api_key else ''
        
        logger.info(f"🔄 [LOAD_MODEL] Loading OAP model {model_name} from Hub: {base_url}")
        logger.info(f"🔑 [LOAD_MODEL] API Key: {api_key_str[:20] if api_key_str else 'None'}...")
        
        # 尝试从全局配置中获取最新的token
        # 暂时跳过这个功能以避免启动时的循环依赖问题
        logger.debug(f"[LOAD_MODEL] Skipping global config access to avoid startup issues")
        
        # 从Hub获取模型的真实provider信息（使用缓存）
        logger.info(f"📡 [LOAD_MODEL] Fetching model info for {model_name}...")
        model_info = get_model_info_from_hub(model_name, base_url, api_key_str)
        logger.info(f"📊 [LOAD_MODEL] Model info result: {model_info}")
        
        logger.info(f"🔍 [LOAD_MODEL] Checking native format support...")
        if model_info and model_info.get('native_format'):
            logger.info(f"✅ [LOAD_MODEL] Native format supported for {model_name}")
            # 使用原生格式 - 这是我们的新架构
            real_provider = model_info.get('provider', 'openai')
            endpoint = model_info.get('endpoint', '/v1/messages')
            
            # 构建指向Hub透明代理的base_url
            clean_base_url = base_url.rstrip('/api/v1').rstrip('/v1').rstrip('/')
            
            # 不同的provider客户端对base_url的处理不同
            if real_provider == 'anthropic':
                # Anthropic客户端会自动在base_url后添加/v1/messages
                hub_proxy_url = f"{clean_base_url}/api"
                logger.info(f"Anthropic client will append /v1/messages to base_url")
            elif real_provider == 'openai':
                # OpenAI客户端会自动在base_url后添加特定的路径
                # 如果endpoint是/v1/chat/completions，base_url应该是/api/v1
                if endpoint == '/v1/chat/completions':
                    hub_proxy_url = f"{clean_base_url}/api/v1"
                else:
                    hub_proxy_url = f"{clean_base_url}/api"
                logger.info(f"OpenAI client will append appropriate path to base_url")
            else:
                # 其他provider可能需要完整的endpoint路径
                hub_proxy_url = f"{clean_base_url}/api{endpoint}"
                logger.info(f"Using full endpoint path for {real_provider}")
            
            logger.info(f"Using native provider: {real_provider} via Hub proxy: {hub_proxy_url}")
            logger.info(f"Original model: {model_name}, Real provider: {real_provider}, Endpoint: {endpoint}")
            
            # 根据真实provider选择对应的langchain实现
            if real_provider == 'anthropic':
                # 使用Anthropic原生客户端，指向Hub的透明代理
                model_kwargs = clean_model_kwargs("anthropic", kwargs)
                model_kwargs["api_key"] = api_key_str  # Hub认证token (使用字符串形式)
                model_kwargs["base_url"] = hub_proxy_url  # 现在是 http://localhost:3000/api
                
                # 保持原始模型名用于Hub映射
                logger.info(f"Creating Anthropic client for model: {model_name}")
                model = init_chat_model(
                    model=model_name,  # 保持newmind-medium等原始名称
                    model_provider="anthropic",
                    **model_kwargs,
                )
            elif real_provider == 'openai':
                # 使用OpenAI原生客户端，指向Hub的透明代理
                model_kwargs = clean_model_kwargs("openai", kwargs)
                model_kwargs["api_key"] = api_key_str
                model_kwargs["base_url"] = hub_proxy_url
                
                logger.info(f"Creating OpenAI client for model: {model_name}")
                model = init_chat_model(
                    model=model_name,
                    model_provider="openai",
                    **model_kwargs,
                )
            else:
                # 其他provider的通用处理
                model_kwargs = clean_model_kwargs(real_provider, kwargs)
                model_kwargs["api_key"] = api_key_str
                model_kwargs["base_url"] = hub_proxy_url
                
                logger.info(f"Creating {real_provider} client for model: {model_name}")
                model = init_chat_model(
                    model=model_name,
                    model_provider=real_provider,
                    **model_kwargs,
                )
        else:
            # Fallback到OpenAI兼容模式（使用废弃的兼容性端点）
            # 使用OpenAI兼容模式作为fallback
            if not model_info:
                logger.warning(f"❌ [LOAD_MODEL] Model {model_name} info not available yet, using OpenAI compatibility mode as fallback")
            else:
                logger.warning(f"⚠️ [LOAD_MODEL] Model {model_name} does not support native format, using OpenAI compatibility mode")
            clean_base_url = base_url.rstrip('/api/v1').rstrip('/v1').rstrip('/')
            fallback_url = f"{clean_base_url}/api/v1/chat/completions"
            
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
        # Map openai_compatible and other OpenAI-compatible providers to "openai"
        # These providers use OpenAI's API format but with custom base_url
        openai_compatible_providers = [
            "openai_compatible",
            "lmstudio",
            "openrouter",
            "groq",
            "grok",
            "nvdia",
            "perplexity",
        ]
        actual_provider = "openai" if provider in openai_compatible_providers else provider
        
        logger.debug(
            f"Loading model with provider: {provider} (mapped to: {actual_provider})"
        )
        
        model = init_chat_model(
            model=model_name,
            model_provider=actual_provider,
            **clean_model_kwargs(actual_provider, kwargs),
        )
    return model
