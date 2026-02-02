import express from 'express'
import { PrismaClient } from '@prisma/client'
import { authenticateToken } from '../middleware/auth.js'
import logger from '../utils/logger.js'

const router = express.Router()

const prisma = new PrismaClient()

// 获取项目审计日志
router.get('/projects/:projectId', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId
    const { projectId } = req.params
    const { 
      action, 
      resourceType, 
      limit = 100, 
      offset = 0,
      startDate,
      endDate
    } = req.query
    
    // 验证项目权限
    const project = await prisma.project.findFirst({
      where: { id: projectId, userId }
    })
    
    if (!project) {
      return res.status(404).json({ error: 'Project not found' })
    }
    
    // 构建查询条件
    const where = {
      projectId
    }
    
    if (action) {
      where.action = action
    }
    
    if (resourceType) {
      where.resourceType = resourceType
    }
    
    if (startDate || endDate) {
      where.createdAt = {}
      if (startDate) {
        where.createdAt.gte = new Date(startDate)
      }
      if (endDate) {
        where.createdAt.lte = new Date(endDate)
      }
    }
    
    // 获取审计日志
    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              username: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip: parseInt(offset),
        take: Math.min(parseInt(limit), 100)
      }),
      prisma.auditLog.count({ where })
    ])
    
    res.json({
      logs,
      pagination: {
        total,
        offset: parseInt(offset),
        limit: Math.min(parseInt(limit), 100)
      }
    })
  } catch (error) {
    logger.error('Failed to fetch audit logs:', error)
    res.status(500).json({ error: 'Failed to fetch audit logs' })
  }
})

// 导出审计日志（企业版功能）
router.post('/projects/:projectId/export', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId
    const { projectId } = req.params
    const { format = 'json', startDate, endDate } = req.body
    
    // 验证项目权限
    const project = await prisma.project.findFirst({
      where: { id: projectId, userId }
    })
    
    if (!project) {
      return res.status(404).json({ error: 'Project not found' })
    }
    
    // TODO: 检查企业版权限
    // if (req.user.plan !== 'ENTERPRISE') {
    //   return res.status(403).json({ error: 'Enterprise plan required' })
    // }
    
    const where = { projectId }
    
    if (startDate || endDate) {
      where.createdAt = {}
      if (startDate) {
        where.createdAt.gte = new Date(startDate)
      }
      if (endDate) {
        where.createdAt.lte = new Date(endDate)
      }
    }
    
    const logs = await prisma.auditLog.findMany({
      where,
      include: {
        user: {
          select: {
            email: true,
            username: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })
    
    if (format === 'csv') {
      // 转换为 CSV
      const csv = [
        'Timestamp,User,Action,Resource Type,Resource ID,IP Address',
        ...logs.map(log => 
          `${log.createdAt.toISOString()},${log.user.email},${log.action},${log.resourceType},${log.resourceId || ''},${log.ipAddress || ''}`
        )
      ].join('\n')
      
      res.setHeader('Content-Type', 'text/csv')
      res.setHeader('Content-Disposition', `attachment; filename="audit-log-${projectId}-${Date.now()}.csv"`)
      res.send(csv)
    } else {
      // 返回 JSON
      res.setHeader('Content-Type', 'application/json')
      res.setHeader('Content-Disposition', `attachment; filename="audit-log-${projectId}-${Date.now()}.json"`)
      res.json({ logs })
    }
    
    logger.info(`Audit log exported for project ${projectId} by user ${userId}`)
  } catch (error) {
    logger.error('Failed to export audit logs:', error)
    res.status(500).json({ error: 'Failed to export audit logs' })
  }
})

export default router
