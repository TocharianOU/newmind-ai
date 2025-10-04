#!/bin/bash

# 提交并推送到 GitHub 的脚本

echo "🚀 开始提交和推送到 GitHub..."

# 检查 git 状态
echo "📋 检查 git 状态..."
git status

# 添加所有更改
echo "📁 添加所有更改..."
git add .

# 提交更改
echo "💾 提交更改..."
git commit -m "feat: 集成独立的 Kibana MCP 服务器

- 移除 workspace 配置，确保 MCP 服务器完全独立
- 更新构建脚本，支持独立构建和打包
- 优化复制逻辑，确保所有依赖正确传输
- 添加完整的文档和构建指南
- 支持多平台打包（macOS、Windows、Linux）

主要改进：
- MCP Kibana 服务器现在完全独立，包含所有必要依赖
- 应用启动时自动复制到用户目录
- 支持版本检查和自动更新
- 完整的开发和生产环境支持"

# 推送到远程仓库
echo "🌐 推送到 GitHub..."
git push origin main

echo "✅ 完成！项目已成功推送到 GitHub"
echo "🔗 仓库地址: https://github.com/TocharianOU/newmind-ai.git"
