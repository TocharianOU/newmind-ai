import express from 'express'
import { PrismaClient } from '@prisma/client'
import { authenticateToken } from '../middleware/auth.js'
import logger from '../utils/logger.js'

const router = express.Router()

const prisma = new PrismaClient()

// 获取用户所有项目
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId
    
    const projects = await prisma.project.findMany({
      where: { userId },
      select: {
        id: true,
        name: true,
        description: true,
        isDefault: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            chatSessions: true,
            userMcpConfigs: true,
            auditLogs: true
          }
        }
      },
      orderBy: [
        { isDefault: 'desc' },
        { createdAt: 'desc' }
      ]
    })
    
    res.json({ projects })
  } catch (error) {
    logger.error('Failed to fetch projects:', error)
    res.status(500).json({ error: 'Failed to fetch projects' })
  }
})

// 获取单个项目详情
router.get('/:projectId', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId
    const { projectId } = req.params
    
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        userId
      },
      include: {
        _count: {
          select: {
            chatSessions: true,
            userMcpConfigs: true,
            auditLogs: true
          }
        }
      }
    })
    
    if (!project) {
      return res.status(404).json({ error: 'Project not found' })
    }
    
    res.json({ project })
  } catch (error) {
    logger.error('Failed to fetch project:', error)
    res.status(500).json({ error: 'Failed to fetch project' })
  }
})

// 创建新项目
router.post('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId
    const { name, description, inheritOrgIntegrations = true } = req.body
    
    if (!name || name.trim().length === 0) {
      return res.status(400).json({ error: 'Project name is required' })
    }
    
    // 检查同名项目
    const existing = await prisma.project.findFirst({
      where: {
        userId,
        name: name.trim()
      }
    })
    
    if (existing) {
      return res.status(409).json({ error: 'Project with this name already exists' })
    }
    
    const project = await prisma.project.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        userId,
        isDefault: false,
        inheritOrgIntegrations
      }
    })
    
    // 记录审计日志
    try {
      await prisma.auditLog.create({
        data: {
          projectId: project.id,
          userId,
          action: 'CREATE_PROJECT',
          resourceType: 'PROJECT',
          resourceId: project.id,
          metadata: { name: project.name, description: project.description },
          ipAddress: req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress,
          userAgent: req.headers['user-agent']
        }
      })
    } catch (auditError) {
      logger.error('Failed to create audit log:', auditError)
    }
    
    logger.info(`Project created: ${project.id} by user ${userId}`)
    res.status(201).json({ project })
  } catch (error) {
    logger.error('Failed to create project:', error)
    res.status(500).json({ error: 'Failed to create project' })
  }
})

// 更新项目
router.patch('/:projectId', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId
    const { projectId } = req.params
    const { name, description } = req.body
    
    // 验证项目所有权
    const existing = await prisma.project.findFirst({
      where: { id: projectId, userId }
    })
    
    if (!existing) {
      return res.status(404).json({ error: 'Project not found' })
    }
    
    // 不允许修改 default 项目的名称
    if (existing.isDefault && name && name !== existing.name) {
      return res.status(403).json({ error: 'Cannot rename default project' })
    }
    
    const updateData = {}
    if (name !== undefined && name.trim().length > 0) {
      // 检查同名项目
      const duplicate = await prisma.project.findFirst({
        where: {
          userId,
          name: name.trim(),
          id: { not: projectId }
        }
      })
      
      if (duplicate) {
        return res.status(409).json({ error: 'Project with this name already exists' })
      }
      
      updateData.name = name.trim()
    }
    
    if (description !== undefined) {
      updateData.description = description?.trim() || null
    }
    
    const project = await prisma.project.update({
      where: { id: projectId },
      data: updateData
    })
    
    // 记录审计日志
    try {
      await prisma.auditLog.create({
        data: {
          projectId: project.id,
          userId,
          action: 'UPDATE_PROJECT',
          resourceType: 'PROJECT',
          resourceId: project.id,
          metadata: { changes: updateData },
          ipAddress: req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress,
          userAgent: req.headers['user-agent']
        }
      })
    } catch (auditError) {
      logger.error('Failed to create audit log:', auditError)
    }
    
    logger.info(`Project updated: ${project.id}`)
    res.json({ project })
  } catch (error) {
    logger.error('Failed to update project:', error)
    res.status(500).json({ error: 'Failed to update project' })
  }
})

// 删除项目
router.delete('/:projectId', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId
    const { projectId } = req.params
    
    // 验证项目所有权
    const existing = await prisma.project.findFirst({
      where: { id: projectId, userId }
    })
    
    if (!existing) {
      return res.status(404).json({ error: 'Project not found' })
    }
    
    // 不允许删除 default 项目
    if (existing.isDefault) {
      return res.status(403).json({ error: 'Cannot delete default project' })
    }
    
    // 删除项目（级联删除相关数据）
    await prisma.project.delete({
      where: { id: projectId }
    })
    
    logger.info(`Project deleted: ${projectId}`)
    res.json({ message: 'Project deleted successfully' })
  } catch (error) {
    logger.error('Failed to delete project:', error)
    res.status(500).json({ error: 'Failed to delete project' })
  }
})

export default router
