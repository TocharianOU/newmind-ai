"""
Model information cache manager for OAP models.
Implements a two-layer cache with smart refresh strategy.
"""

import time
import threading
import asyncio
import logging
import requests
from typing import Dict, Optional, Any
from dataclasses import dataclass, field

logger = logging.getLogger("attacktrace_mcp_host.models.cache")

@dataclass
class ModelInfo:
    """Cached model information"""
    id: str
    provider: str
    endpoint: str
    metadata: Dict[str, Any]
    cached_at: float
    hub_base_url: str
    native_format: bool = False
    
    def is_expired(self, ttl: int = 1800) -> bool:
        """Check if cache entry is expired (default 30 minutes)"""
        return time.time() - self.cached_at > ttl
    
    def should_refresh(self, refresh_threshold: int = 1500) -> bool:
        """Check if cache should be refreshed (default 25 minutes)"""
        return time.time() - self.cached_at > refresh_threshold


class ModelInfoCache:
    """
    Optimized model information cache with smart refresh.
    Features:
    - L1 memory cache for instant access
    - Async background refresh
    - Fallback mechanism
    """
    
    _instance = None
    _lock = threading.Lock()
    
    def __new__(cls):
        """Singleton pattern to ensure single cache instance"""
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super().__new__(cls)
        return cls._instance
    
    def __init__(self):
        """Initialize cache if not already initialized"""
        if not hasattr(self, '_initialized'):
            self.l1_cache: Dict[str, ModelInfo] = {}
            self.cache_lock = threading.RLock()
            self.refresh_tasks: Dict[str, asyncio.Task] = {}
            self.cache_ttl = 1800  # 30 minutes
            self.refresh_threshold = 1500  # 25 minutes
            self._initialized = True
            logger.info("ModelInfoCache initialized")
    
    def get_cached(self, model_name: str) -> Optional[ModelInfo]:
        """Get cached model info without fetching"""
        with self.cache_lock:
            cached = self.l1_cache.get(model_name)
            if cached and not cached.is_expired(self.cache_ttl):
                return cached
        return None
    
    def get_or_fetch(self, model_name: str, hub_base_url: str, api_key: str) -> Optional[Dict[str, Any]]:
        """
        Get model info from cache or fetch from hub.
        Implements smart refresh strategy.
        """
        logger.info(f"💾 [CACHE] get_or_fetch called for {model_name}")
        logger.info(f"🔑 [CACHE] API key: {api_key[:20] if api_key else 'None'}...")
        
        # Check L1 cache
        with self.cache_lock:
            cached = self.l1_cache.get(model_name)
            logger.info(f"📁 [CACHE] Cache status for {model_name}: {'HIT' if cached else 'MISS'}")
            
            if cached:
                # Return cached data if valid
                if not cached.is_expired(self.cache_ttl):
                    # Trigger async refresh if approaching expiry
                    if cached.should_refresh(self.refresh_threshold):
                        self._trigger_async_refresh(model_name, hub_base_url, api_key)
                    
                # Return cached data immediately
                result = {
                    'id': cached.id,
                    'provider': cached.provider,
                    'endpoint': cached.endpoint,
                    'metadata': cached.metadata,
                    'native_format': cached.native_format
                }
                logger.info(f"✅ [CACHE] Returning cached data for {model_name}: {result}")
                return result
        
        # No valid cache, fetch synchronously
        logger.info(f"📡 [CACHE] No valid cache, fetching from hub for {model_name}")
        return self._fetch_and_cache(model_name, hub_base_url, api_key)
    
    def _fetch_and_cache(self, model_name: str, hub_base_url: str, api_key: str) -> Optional[Dict[str, Any]]:
        """Fetch model info from hub and update cache"""
        try:
            # Only fetch if we have a valid API key
            if not api_key or api_key == "":
                logger.warning(f"❌ [CACHE] Skipping fetch for {model_name}: no API key")
                return None
            
            logger.info(f"🌐 [CACHE] Fetching from hub: {hub_base_url}/api/v1/models")
                
            clean_base_url = hub_base_url.rstrip('/api/v1').rstrip('/v1').rstrip('/')
            response = requests.get(
                f"{clean_base_url}/api/v1/models",
                headers={"Authorization": f"Bearer {api_key}"},
                timeout=5  # Shorter timeout for better UX
            )
            
            if response.status_code == 200:
                models_data = response.json()
                models = models_data.get('data', [])
                
                # Find and cache the model
                for model in models:
                    if model.get('id') == model_name:
                        model_info = ModelInfo(
                            id=model_name,
                            provider=model.get('provider', 'openai'),
                            endpoint=model.get('endpoint', '/v1/chat/completions'),
                            metadata=model.get('metadata', {}),
                            cached_at=time.time(),
                            hub_base_url=hub_base_url,
                            native_format=model.get('metadata', {}).get('native_format', False)
                        )
                        
                        with self.cache_lock:
                            self.l1_cache[model_name] = model_info
                        
                        logger.info(f"✅ [CACHE] Successfully cached model info for {model_name}: provider={model_info.provider}, native_format={model_info.native_format}")
                        
                        return {
                            'id': model_info.id,
                            'provider': model_info.provider,
                            'endpoint': model_info.endpoint,
                            'metadata': model_info.metadata,
                            'native_format': model_info.native_format
                        }
            
            elif response.status_code == 401:
                logger.warning(f"🚫 [CACHE] Auth failed for {model_name}: invalid or expired token")
                return None
                
            logger.warning(f"🔍 [CACHE] Model {model_name} not found in hub response")
            return None
            
        except requests.exceptions.RequestException as e:
            logger.debug(f"Failed to fetch model info for {model_name}: {e}")
            return None
        except Exception as e:
            logger.error(f"Unexpected error fetching model info for {model_name}: {e}")
            return None
    
    def _trigger_async_refresh(self, model_name: str, hub_base_url: str, api_key: str):
        """Trigger async background refresh of model info"""
        try:
            # Check if refresh is already in progress
            if model_name in self.refresh_tasks:
                task = self.refresh_tasks[model_name]
                if not task.done():
                    return  # Refresh already in progress
            
            # Create async refresh task
            async def refresh():
                logger.debug(f"Starting async refresh for {model_name}")
                # Run fetch in thread pool to avoid blocking
                loop = asyncio.get_event_loop()
                await loop.run_in_executor(
                    None, 
                    self._fetch_and_cache, 
                    model_name, 
                    hub_base_url, 
                    api_key
                )
                logger.debug(f"Async refresh completed for {model_name}")
            
            # Schedule the refresh task
            try:
                loop = asyncio.get_event_loop()
                task = loop.create_task(refresh())
                self.refresh_tasks[model_name] = task
            except RuntimeError:
                # No event loop, skip async refresh
                logger.debug(f"No event loop for async refresh of {model_name}")
                
        except Exception as e:
            logger.debug(f"Failed to trigger async refresh for {model_name}: {e}")
    
    def clear_cache(self, model_name: Optional[str] = None):
        """Clear cache for specific model or all models"""
        with self.cache_lock:
            if model_name:
                self.l1_cache.pop(model_name, None)
                logger.info(f"Cleared cache for {model_name}")
            else:
                self.l1_cache.clear()
                logger.info("Cleared all model cache")
    
    def update_cache(self, model_name: str, model_info: Dict[str, Any], hub_base_url: str):
        """Manually update cache entry"""
        with self.cache_lock:
            self.l1_cache[model_name] = ModelInfo(
                id=model_name,
                provider=model_info.get('provider', 'openai'),
                endpoint=model_info.get('endpoint', '/v1/chat/completions'),
                metadata=model_info.get('metadata', {}),
                cached_at=time.time(),
                hub_base_url=hub_base_url,
                native_format=model_info.get('metadata', {}).get('native_format', False)
            )
            logger.info(f"Manually updated cache for {model_name}")


# Global cache instance
model_cache = ModelInfoCache()
