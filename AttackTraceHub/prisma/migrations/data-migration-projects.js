/**
 * 数据迁移脚本：为现有用户创建 default 项目
 * 
 * 执行步骤：
 * 1. 为每个现有用户创建一个 "Default" 项目（如果不存在）
 * 2. 将所有现有的 ChatSession 关联到用户的 default 项目
 * 3. 将所有现有的 UserMcpConfig 关联到用户的 default 项目
 * 
 * 运行方式：
 * node prisma/migrations/data-migration-projects.js
 */

const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function main() {
  console.log('开始数据迁移：项目模式支持...')
  
  try {
    // 1. 获取所有用户
    const users = await prisma.user.findMany({
      select: { id: true, email: true }
    })
    
    console.log(`找到 ${users.length} 个用户`)
    
    let projectsCreated = 0
    let chatSessionsUpdated = 0
    let mcpConfigsUpdated = 0
    
    // 2. 为每个用户创建 default 项目
    for (const user of users) {
      console.log(`处理用户: ${user.email}`)
      
      // 检查是否已有 default 项目
      const existingDefault = await prisma.project.findFirst({
        where: {
          userId: user.id,
          isDefault: true
        }
      })
      
      let defaultProject
      
      if (existingDefault) {
        console.log(`  - 用户已有 default 项目: ${existingDefault.name}`)
        defaultProject = existingDefault
      } else {
        // 创建 default 项目
        defaultProject = await prisma.project.create({
          data: {
            name: 'Default',
            description: 'Default project (auto-created during migration)',
            userId: user.id,
            isDefault: true
          }
        })
        projectsCreated++
        console.log(`  - 创建 default 项目: ${defaultProject.id}`)
      }
      
      // 3. 更新该用户的所有 ChatSession
      const chatUpdate = await prisma.chatSession.updateMany({
        where: {
          userId: user.id,
          projectId: null
        },
        data: {
          projectId: defaultProject.id
        }
      })
      chatSessionsUpdated += chatUpdate.count
      console.log(`  - 更新 ${chatUpdate.count} 个聊天会话`)
      
      // 4. 更新该用户的所有 UserMcpConfig
      const mcpUpdate = await prisma.userMcpConfig.updateMany({
        where: {
          userId: user.id,
          projectId: null
        },
        data: {
          projectId: defaultProject.id
        }
      })
      mcpConfigsUpdated += mcpUpdate.count
      console.log(`  - 更新 ${mcpUpdate.count} 个 MCP 配置`)
    }
    
    console.log('\n迁移完成！')
    console.log(`统计信息：`)
    console.log(`  - 创建项目数: ${projectsCreated}`)
    console.log(`  - 更新聊天会话数: ${chatSessionsUpdated}`)
    console.log(`  - 更新 MCP 配置数: ${mcpConfigsUpdated}`)
    
  } catch (error) {
    console.error('迁移失败:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
