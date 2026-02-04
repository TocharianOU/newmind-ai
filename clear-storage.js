// 清理所有 localStorage 缓存
// 在浏览器开发者工具的 Console 中运行此脚本

console.log('开始清理 localStorage...');

// 获取所有 keys
const keys = Object.keys(localStorage);
console.log(`找到 ${keys.length} 个 localStorage 项`);

// 清理工具缓存
const toolsCacheKeys = keys.filter(k => k.startsWith('toolsCache'));
toolsCacheKeys.forEach(key => {
  localStorage.removeItem(key);
  console.log(`✓ 已删除: ${key}`);
});

// 清理 OAP 工具缓存
if (localStorage.getItem('oap_tools_cache')) {
  localStorage.removeItem('oap_tools_cache');
  console.log('✓ 已删除: oap_tools_cache');
}

// 清理其他可能的缓存
const cacheKeys = keys.filter(k => 
  k.includes('cache') || 
  k.includes('Cache') ||
  k.startsWith('mcp')
);

cacheKeys.forEach(key => {
  if (!key.startsWith('toolsCache')) { // 避免重复删除
    localStorage.removeItem(key);
    console.log(`✓ 已删除: ${key}`);
  }
});

console.log('✅ localStorage 清理完成！');
console.log('剩余项:', Object.keys(localStorage).length);
