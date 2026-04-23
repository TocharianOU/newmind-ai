import express from 'express'
import { v4 as uuidv4 } from 'uuid'
import { prisma } from '../config/database.js'
import { authenticateToken } from '../middleware/auth.js'
import { writeAudit, AUDIT_ACTIONS, RESOURCE_TYPES } from '../utils/auditLog.js'
import logger from '../utils/logger.js'
import { validateBody } from '../middleware/validate.js'
import { CreateProjectSchema, UpdateProjectSchema } from '../schemas/projects.schemas.js'

const router = express.Router()

router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id

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
            ChatSession: true,
            AuditLog: true,
          },
        },
      },
      orderBy: [
        { isDefault: 'desc' },
        { createdAt: 'desc' },
      ],
    })

    res.json({ projects })
  } catch (error) {
    logger.error('Failed to fetch projects:', error)
    res.status(500).json({ error: 'Failed to fetch projects' })
  }
})

router.get('/:projectId', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id
    const { projectId } = req.params

    const project = await prisma.project.findFirst({
      where: { id: projectId, userId },
      include: {
        _count: {
          select: {
            ChatSession: true,
            AuditLog: true,
          },
        },
      },
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

router.post('/', authenticateToken, validateBody(CreateProjectSchema), async (req, res) => {
  try {
    const userId = req.user.id
    const { id: requestedId, name, description, isDefault = false, inheritOrgIntegrations = true } = req.body

    const existing = await prisma.project.findFirst({
      where: { userId, name: name.trim() },
    })

    if (existing) {
      return res.status(409).json({ error: 'Project with this name already exists' })
    }

    // If caller requests isDefault, unset any previous default for this user
    if (isDefault) {
      await prisma.project.updateMany({
        where: { userId, isDefault: true },
        data: { isDefault: false },
      })
    }

    const projectId = requestedId || uuidv4()

    const project = await prisma.project.create({
      data: {
        id: projectId,
        name: name.trim(),
        description: description?.trim() || null,
        userId,
        isDefault,
        inheritOrgIntegrations,
        updatedAt: new Date(),
      },
    })

    await writeAudit(req, {
      userId,
      action: AUDIT_ACTIONS.PROJECT_CREATED,
      resourceType: RESOURCE_TYPES.PROJECT,
      resourceId: project.id,
      projectId: project.id,
      metadata: { name: project.name, description: project.description },
    })

    logger.info(`Project created: ${project.id} by user ${userId}`)
    res.status(201).json({ project })
  } catch (error) {
    logger.error('Failed to create project:', error)
    res.status(500).json({ error: 'Failed to create project' })
  }
})

router.patch('/:projectId', authenticateToken, validateBody(UpdateProjectSchema), async (req, res) => {
  try {
    const userId = req.user.id
    const { projectId } = req.params
    const { name, description } = req.body

    const existing = await prisma.project.findFirst({
      where: { id: projectId, userId },
    })

    if (!existing) {
      return res.status(404).json({ error: 'Project not found' })
    }

    if (existing.isDefault && name && name !== existing.name) {
      return res.status(403).json({ error: 'Cannot rename default project' })
    }

    const updateData = {}
    if (name !== undefined && name.trim().length > 0) {
      const duplicate = await prisma.project.findFirst({
        where: { userId, name: name.trim(), id: { not: projectId } },
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
      data: { ...updateData, updatedAt: new Date() },
    })

    await writeAudit(req, {
      userId,
      action: AUDIT_ACTIONS.PROJECT_UPDATED,
      resourceType: RESOURCE_TYPES.PROJECT,
      resourceId: project.id,
      projectId: project.id,
      metadata: { changes: updateData },
    })

    logger.info(`Project updated: ${project.id}`)
    res.json({ project })
  } catch (error) {
    logger.error('Failed to update project:', error)
    res.status(500).json({ error: 'Failed to update project' })
  }
})

router.delete('/:projectId', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id
    const { projectId } = req.params

    const existing = await prisma.project.findFirst({
      where: { id: projectId, userId },
    })

    if (!existing) {
      return res.status(404).json({ error: 'Project not found' })
    }

    if (existing.isDefault) {
      return res.status(403).json({ error: 'Cannot delete default project' })
    }

    await prisma.project.delete({ where: { id: projectId } })

    await writeAudit(req, {
      userId,
      action: AUDIT_ACTIONS.PROJECT_DELETED,
      resourceType: RESOURCE_TYPES.PROJECT,
      resourceId: projectId,
      metadata: { name: existing.name },
    })

    logger.info(`Project deleted: ${projectId}`)
    res.json({ message: 'Project deleted successfully' })
  } catch (error) {
    logger.error('Failed to delete project:', error)
    res.status(500).json({ error: 'Failed to delete project' })
  }
})

export default router
